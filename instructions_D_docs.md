# 担当D: Google Docs API実装仕様書

## 担当ファイル
- `06_docsApi.js` - Docs API操作モジュール
- `tests/test_docsApi.js` - テストコード

## 実装要件

### 1. ドキュメント作成フロー

#### メイン関数
```javascript
class DocsApiClient {
  constructor(authToken) {
    this.token = authToken;
    this.baseUrl = 'https://docs.googleapis.com/v1';
  }

  async createDocument(extractedContent, documentName, metadata) {
    // 1. 新規ドキュメント作成
    const doc = await this.createEmptyDocument(documentName);

    // 2. コンテンツ構造の解析
    const structure = this.analyzeContentStructure(extractedContent);

    // 3. バッチ更新リクエストの構築
    const requests = this.buildUpdateRequests(structure, metadata);

    // 4. ドキュメント更新
    await this.batchUpdate(doc.documentId, requests);

    // 5. 共有設定（オプション）
    await this.setSharing(doc.documentId);

    return doc.url;
  }
}
```

### 2. ドキュメント命名規則

```javascript
generateDocumentName(index, name, subject) {
  // フォーマット: "連番_名前_件名"
  // 例: "001_田中太郎_会議資料"

  const paddedIndex = String(index).padStart(3, '0');

  // ファイル名に使えない文字を削除
  const safeName = this.sanitizeFileName(name || '名前なし');
  const safeSubject = this.sanitizeFileName(subject || '件名なし');

  // 最大長制限（Googleドキュメントの制限）
  const maxLength = 100;
  let docName = `${paddedIndex}_${safeName}_${safeSubject}`;

  if (docName.length > maxLength) {
    // 件名を優先的に短縮
    const baseLength = paddedIndex.length + safeName.length + 2; // アンダースコア分
    const availableLength = maxLength - baseLength;
    const truncatedSubject = safeSubject.substring(0, Math.max(10, availableLength));
    docName = `${paddedIndex}_${safeName}_${truncatedSubject}`;
  }

  return docName;
}

sanitizeFileName(text) {
  // Google Driveで使用できない文字を置換
  return text
    .replace(/[\\/:*?"<>|]/g, '_')  // 禁止文字
    .replace(/\s+/g, '_')             // 空白
    .replace(/_{2,}/g, '_')           // 連続アンダースコア
    .trim();
}
```

### 3. コンテンツフォーマット

#### ドキュメント構造
```javascript
buildUpdateRequests(content, metadata) {
  const requests = [];
  let currentIndex = 1; // Google Docsのインデックスは1から

  // 1. ヘッダー情報の挿入
  requests.push(...this.createHeaderRequests(metadata, currentIndex));
  currentIndex += this.calculateTextLength(metadata);

  // 2. 区切り線
  requests.push(this.createHorizontalRuleRequest(currentIndex));
  currentIndex += 1;

  // 3. 本文タイトル
  if (content.title) {
    requests.push(...this.createTitleRequests(content.title, currentIndex));
    currentIndex += content.title.length + 1;
  }

  // 4. 本文コンテンツ
  requests.push(...this.formatMainContent(content, currentIndex));

  // 5. フッター情報
  requests.push(...this.createFooterRequests(content.url, currentIndex));

  return requests;
}
```

#### ヘッダー情報のフォーマット
```javascript
createHeaderRequests(metadata, index) {
  const requests = [];

  // メタデータセクション
  const headerText = [
    `抽出日時: ${new Date().toLocaleString('ja-JP')}`,
    `元URL: ${metadata.url}`,
    metadata.author ? `著者: ${metadata.author}` : null,
    metadata.date ? `公開日: ${metadata.date}` : null
  ].filter(Boolean).join('\n');

  // テキスト挿入
  requests.push({
    insertText: {
      text: headerText + '\n',
      location: { index }
    }
  });

  // スタイル適用（グレー、小さめフォント）
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: index,
        endIndex: index + headerText.length
      },
      textStyle: {
        fontSize: { magnitude: 10, unit: 'PT' },
        foregroundColor: {
          color: {
            rgbColor: { red: 0.5, green: 0.5, blue: 0.5 }
          }
        }
      },
      fields: 'fontSize,foregroundColor'
    }
  });

  return requests;
}
```

#### 本文のフォーマット
```javascript
formatMainContent(content, startIndex) {
  const requests = [];
  let currentIndex = startIndex;

  // 構造化されたコンテンツの処理
  if (content.structure) {
    content.structure.forEach(element => {
      switch (element.tag) {
        case 'h1':
          requests.push(...this.createHeading1(element.text, currentIndex));
          break;
        case 'h2':
          requests.push(...this.createHeading2(element.text, currentIndex));
          break;
        case 'h3':
          requests.push(...this.createHeading3(element.text, currentIndex));
          break;
        case 'p':
          requests.push(...this.createParagraph(element.text, currentIndex));
          break;
        case 'ul':
        case 'ol':
          requests.push(...this.createList(element, currentIndex));
          break;
        case 'blockquote':
          requests.push(...this.createQuote(element.text, currentIndex));
          break;
        case 'pre':
          requests.push(...this.createCodeBlock(element.text, currentIndex));
          break;
      }
      currentIndex += element.text.length + 2; // 改行分
    });
  } else {
    // プレーンテキストの処理
    requests.push(...this.formatPlainText(content.text, currentIndex));
  }

  return requests;
}
```

#### スタイル定義
```javascript
// 見出し1（h1）
createHeading1(text, index) {
  return [
    {
      insertText: {
        text: text + '\n',
        location: { index }
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: index, endIndex: index + text.length },
        paragraphStyle: {
          namedStyleType: 'HEADING_1',
          spaceAbove: { magnitude: 18, unit: 'PT' },
          spaceBelow: { magnitude: 6, unit: 'PT' }
        },
        fields: 'namedStyleType,spaceAbove,spaceBelow'
      }
    }
  ];
}

// コードブロック
createCodeBlock(code, index) {
  return [
    {
      insertText: {
        text: code + '\n',
        location: { index }
      }
    },
    {
      updateTextStyle: {
        range: { startIndex: index, endIndex: index + code.length },
        textStyle: {
          fontFamily: 'Courier New',
          fontSize: { magnitude: 10, unit: 'PT' },
          backgroundColor: {
            color: {
              rgbColor: { red: 0.95, green: 0.95, blue: 0.95 }
            }
          }
        },
        fields: 'fontFamily,fontSize,backgroundColor'
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: index, endIndex: index + code.length },
        paragraphStyle: {
          indentFirstLine: { magnitude: 0, unit: 'PT' },
          indentStart: { magnitude: 36, unit: 'PT' }
        },
        fields: 'indentFirstLine,indentStart'
      }
    }
  ];
}

// リスト
createList(listElement, index) {
  const requests = [];
  const items = listElement.items || [listElement.text];

  items.forEach(item => {
    requests.push({
      insertText: {
        text: item + '\n',
        location: { index }
      }
    });

    requests.push({
      createParagraphBullets: {
        range: { startIndex: index, endIndex: index + item.length },
        bulletPreset: listElement.tag === 'ol' ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE'
      }
    });

    index += item.length + 1;
  });

  return requests;
}
```

### 4. 画像処理

```javascript
async processImages(images, documentId) {
  const imageRequests = [];

  for (const image of images) {
    try {
      // 画像をGoogle Driveにアップロード
      const imageUrl = await this.uploadImageToDrive(image.src, image.alt);

      // ドキュメントに画像を挿入
      imageRequests.push({
        insertInlineImage: {
          uri: imageUrl,
          location: { index: this.currentImageIndex },
          objectSize: {
            height: { magnitude: 300, unit: 'PT' },
            width: { magnitude: 400, unit: 'PT' }
          }
        }
      });

      // キャプションを追加
      if (image.alt) {
        imageRequests.push({
          insertText: {
            text: `図: ${image.alt}\n`,
            location: { index: this.currentImageIndex + 1 }
          }
        });
      }

    } catch (error) {
      console.warn(`画像処理エラー: ${error.message}`);
      // 画像の代替テキストを挿入
      imageRequests.push({
        insertText: {
          text: `[画像: ${image.alt || 'エラー'}]\n`,
          location: { index: this.currentImageIndex }
        }
      });
    }
  }

  return imageRequests;
}
```

### 5. エラー処理とリトライ

```javascript
async batchUpdate(documentId, requests) {
  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(
        `${this.baseUrl}/documents/${documentId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests })
        }
      );

      if (response.status === 429) {
        // レート制限
        const delay = Math.pow(2, i) * 1000;
        await this.sleep(delay);
        continue;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error.message);
      }

      return await response.json();

    } catch (error) {
      lastError = error;

      // リクエストが大きすぎる場合は分割
      if (error.message.includes('Request too large')) {
        return await this.batchUpdateChunked(documentId, requests);
      }
    }
  }

  throw lastError;
}

async batchUpdateChunked(documentId, requests) {
  const chunkSize = 50; // 1回のリクエストあたりの最大更新数
  const results = [];

  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const result = await this.batchUpdate(documentId, chunk);
    results.push(result);

    // API制限対策の待機
    await this.sleep(500);
  }

  return results;
}
```

### 6. 共有設定

```javascript
async setSharing(documentId, shareSettings = {}) {
  // デフォルト設定
  const settings = {
    role: 'reader',           // 閲覧権限
    type: 'anyone',          // リンクを知っている全員
    allowDiscovery: false,   // 検索で見つからない
    ...shareSettings
  };

  const driveUrl = `https://www.googleapis.com/drive/v3/files/${documentId}/permissions`;

  const response = await fetch(driveUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: settings.role,
      type: settings.type,
      allowFileDiscovery: settings.allowDiscovery
    })
  });

  if (!response.ok) {
    console.warn('共有設定の更新に失敗しました');
  }
}
```

### 7. テスト項目
- [ ] ドキュメント作成（空のドキュメント）
- [ ] ドキュメント命名（連番_名前_件名）
- [ ] ファイル名のサニタイズ（禁止文字）
- [ ] ヘッダー情報の挿入とフォーマット
- [ ] タイトルの挿入（h1スタイル）
- [ ] 本文の構造保持（見出し、段落、リスト）
- [ ] コードブロックのフォーマット
- [ ] 画像の挿入（可能な場合）
- [ ] フッターにURL情報
- [ ] バッチ更新の実行
- [ ] 大量リクエストの分割処理
- [ ] API制限エラーのリトライ
- [ ] 共有設定の適用
- [ ] 日本語コンテンツの正常表示

## 実装の注意点
- Google Docs API v1を使用
- インデックスは1始まり（0ではない）
- バッチ更新は順序が重要（後ろから前へ）
- 画像はGoogle Drive経由でのみ挿入可能
- 日本語フォントの明示的指定
- ドキュメントIDとURLの区別
- 1リクエストあたりの更新数制限（100程度）