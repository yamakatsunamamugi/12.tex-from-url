# 担当A: Google Sheets API実装仕様書

## 担当ファイル
- `05_sheetsApi.js` - Sheets API操作モジュール
- `tests/test_sheetsApi.js` - テストコード

## 実装要件

### 1. 設定管理機能
```javascript
// UIから受け取る設定パラメータ
const config = {
  spreadsheetId: '',      // スプレッドシートID
  sheetName: '',          // シート名（省略時は最初のシート）
  urlColumn: 'A',         // URL記載列（A, B, C...）
  docUrlColumn: 'B',      // ドキュメントURL書き戻し列
  nameColumn: 'C',        // 名前列（ドキュメント命名用）
  subjectColumn: 'D',     // 件名列（ドキュメント命名用）
  headerRow: 1,           // ヘッダー行番号（データは+1行目から）
  batchSize: 10           // 一度に処理する行数（API制限対策）
};
```

### 2. 主要メソッド

#### `readUrls(config)`
- スプレッドシートから未処理のURLを取得
- ヘッダー行をスキップ
- 既にドキュメントURLがある行は読み込むが、フラグを付ける
- 名前・件名列のデータも同時取得
- 戻り値:
```javascript
[
  {
    row: 2,                    // 行番号
    url: 'https://...',        // URL
    name: '田中太郎',           // 名前
    subject: '会議資料',        // 件名
    existingDocUrl: '',        // 既存のドキュメントURL（あれば）
    shouldProcess: true        // 処理すべきか
  },
  ...
]
```

#### `writeDocUrls(config, results)`
- 処理結果をスプレッドシートに書き戻し
- バッチ更新API使用（効率化）
- 上書き時のエラーハンドリング
- 入力:
```javascript
[
  {
    row: 2,
    docUrl: 'https://docs.google.com/...',
    status: 'success' // or 'error', 'skipped'
  },
  ...
]
```

#### `validateSheet(config)`
- スプレッドシートの存在確認
- 列の妥当性チェック
- アクセス権限確認

### 3. エラー処理
- **上書き防止**: 既にドキュメントURLがある行の上書き時は警告＆確認
- **API制限対策**: 429エラー時は自動リトライ（指数バックオフ）
- **ネットワークエラー**: 3回まで自動リトライ
- **データ検証**: URL形式の妥当性チェック

### 4. パフォーマンス最適化
- バッチ読み込み: `batchGet`で複数範囲を一度に取得
- バッチ書き込み: `batchUpdate`で複数セルを一度に更新
- API呼び出し間隔: 100ms以上の間隔を確保

### 5. テスト項目
- [ ] 設定パラメータの検証
- [ ] URL読み込み（ヘッダースキップ）
- [ ] 名前・件名列の同時取得
- [ ] ドキュメントURL書き戻し
- [ ] 既存URL行のスキップ処理
- [ ] エラーハンドリング（上書き防止）
- [ ] API制限対策の動作確認

## 実装の注意点
- Google Sheets API v4を使用
- 認証トークンは`background.js`から受け取る
- 列番号（A,B,C）を配列インデックスに変換する処理必要
- 日本語データの文字化けに注意（UTF-8）