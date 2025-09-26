# 担当B: Chrome拡張基盤実装仕様書

## 担当ファイル
- `01_manifest.json` - 拡張機能マニフェスト
- `02_background.js` - バックグラウンド処理
- `03_popup.html` - ポップアップUI
- `04_popup.js` - UIロジック
- `tests/test_chrome.js` - テストコード

## 実装要件

### 1. manifest.json設定
```json
{
  "manifest_version": 3,
  "name": "URL to Google Docs Converter",
  "version": "1.0.0",
  "permissions": [
    "identity",
    "storage",
    "activeTab",
    "https://www.googleapis.com/*",
    "https://sheets.googleapis.com/*",
    "https://docs.googleapis.com/*"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents"
    ]
  }
}
```

### 2. ポップアップUI (popup.html)

#### 設定フォーム
```html
<!-- スプレッドシート設定 -->
<input id="spreadsheetId" placeholder="スプレッドシートID">
<input id="sheetName" placeholder="シート名（省略可）">

<!-- 列設定 -->
<select id="urlColumn">
  <option>A</option><option>B</option>...
</select>
<select id="docUrlColumn">...</select>
<select id="nameColumn">...</select>
<select id="subjectColumn">...</select>

<!-- 処理設定 -->
<input id="headerRow" type="number" value="1" min="0">
<input id="batchSize" type="number" value="10" min="1" max="50">

<!-- 上書き設定 -->
<input type="checkbox" id="overwriteMode">
<label>既存のドキュメントURLを上書き</label>

<!-- 実行ボタン -->
<button id="startProcess">処理開始</button>
<button id="stopProcess">停止</button>
```

#### 進捗表示
```html
<div id="progress">
  <div>処理状況: <span id="currentStatus">待機中</span></div>
  <div>処理済み: <span id="processedCount">0</span> / <span id="totalCount">0</span></div>
  <progress id="progressBar" max="100" value="0"></progress>
  <div id="errorLog"></div>
</div>
```

### 3. popup.js機能

#### 設定管理
```javascript
// 設定の保存・読み込み
async function saveConfig() {
  const config = {
    spreadsheetId: document.getElementById('spreadsheetId').value,
    sheetName: document.getElementById('sheetName').value,
    urlColumn: document.getElementById('urlColumn').value,
    docUrlColumn: document.getElementById('docUrlColumn').value,
    nameColumn: document.getElementById('nameColumn').value,
    subjectColumn: document.getElementById('subjectColumn').value,
    headerRow: parseInt(document.getElementById('headerRow').value),
    batchSize: parseInt(document.getElementById('batchSize').value),
    overwriteMode: document.getElementById('overwriteMode').checked
  };
  await chrome.storage.local.set({ config });
}

// 起動時に前回の設定を復元
async function loadConfig() {
  const { config } = await chrome.storage.local.get('config');
  if (config) {
    // 各フォーム要素に値をセット
  }
}
```

#### 処理制御
```javascript
// 処理開始
async function startProcessing() {
  const config = await getConfig();

  // 設定検証
  if (!validateConfig(config)) {
    showError('設定を確認してください');
    return;
  }

  // バックグラウンドに処理開始を通知
  chrome.runtime.sendMessage({
    action: 'START_PROCESSING',
    config: config
  });

  // UI更新
  updateUIState('processing');
}

// 進捗更新の受信
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROGRESS_UPDATE') {
    updateProgress(message.data);
  } else if (message.type === 'ERROR') {
    showError(message.error);
  } else if (message.type === 'COMPLETE') {
    showComplete(message.result);
  }
});
```

### 4. background.js処理フロー

#### OAuth認証
```javascript
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}
```

#### メイン処理ループ
```javascript
async function processUrls(config) {
  let token = await getAuthToken();
  let processed = 0;
  let errors = [];

  try {
    // 1. Sheets APIでURL一覧取得
    const urls = await sheetsApi.readUrls(config, token);

    // 2. 進捗通知
    sendProgress({ total: urls.length, processed: 0 });

    // 3. バッチ処理
    for (let i = 0; i < urls.length; i += config.batchSize) {
      const batch = urls.slice(i, i + config.batchSize);
      const results = [];

      for (const item of batch) {
        try {
          // 既存URLチェック
          if (item.existingDocUrl && !config.overwriteMode) {
            results.push({
              row: item.row,
              status: 'skipped',
              reason: '既存のドキュメントあり'
            });
            continue;
          }

          // URL処理
          const content = await extractContent(item.url);
          const docName = `${processed + 1}_${item.name}_${item.subject}`;
          const docUrl = await docsApi.createDocument(content, docName, token);

          results.push({
            row: item.row,
            docUrl: docUrl,
            status: 'success'
          });

        } catch (error) {
          errors.push({ row: item.row, error: error.message });
          results.push({
            row: item.row,
            status: 'error',
            error: error.message
          });
        }

        processed++;
        sendProgress({ total: urls.length, processed });
      }

      // 4. 結果をスプレッドシートに書き戻し
      await sheetsApi.writeDocUrls(config, results, token);

      // API制限対策の待機
      await sleep(1000);
    }

    // 5. 完了通知
    sendComplete({ processed, errors });

  } catch (error) {
    sendError(error.message);
  }
}
```

### 5. エラー処理とリトライ
```javascript
async function withRetry(fn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // API制限エラー
      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000; // 指数バックオフ
        await sleep(delay);
        continue;
      }

      // 認証エラー
      if (error.status === 401) {
        token = await getAuthToken();
        continue;
      }

      throw error; // その他のエラーは即座に失敗
    }
  }

  throw lastError;
}
```

### 6. テスト項目
- [ ] OAuth認証フロー
- [ ] 設定の保存・読み込み
- [ ] UIの状態遷移（待機中→処理中→完了）
- [ ] 進捗表示の更新
- [ ] エラーメッセージ表示
- [ ] 処理の停止機能
- [ ] 上書きモードの動作
- [ ] API制限時のリトライ
- [ ] ネットワークエラー処理

## 実装の注意点
- Chrome拡張のManifest V3仕様に準拠
- Service Workerの制約（DOM操作不可、永続化不可）
- メッセージングは非同期処理
- storage APIでの設定永続化（5MB制限）
- 日本語UIの文字化け対策（UTF-8）