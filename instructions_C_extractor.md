# 担当C: 本文抽出実装仕様書

## 担当ファイル
- `07_extractor.js` - 抽出ロジックモジュール
- `08_content.js` - コンテンツスクリプト
- `tests/test_extractor.js` - テストコード

## 実装要件

### 1. 対応サイト一覧（14サイト）
1. **ニュースサイト**
   - Yahoo!ニュース (news.yahoo.co.jp)
   - NHKニュース (www3.nhk.or.jp)
   - 朝日新聞 (asahi.com)
   - 読売新聞 (yomiuri.co.jp)
   - 日経新聞 (nikkei.com)

2. **ブログ・記事サイト**
   - note (note.com)
   - はてなブログ (hatenablog.com)
   - Qiita (qiita.com)
   - Zenn (zenn.dev)
   - Medium (medium.com)

3. **その他**
   - Wikipedia (wikipedia.org)
   - GitHub README (github.com)
   - 企業プレスリリース (prtimes.jp)
   - 汎用サイト（上記以外）

### 2. extractor.js - メインモジュール

#### サイト判定と振り分け
```javascript
class ContentExtractor {
  constructor() {
    this.extractors = {
      'news.yahoo.co.jp': this.extractYahooNews,
      'www3.nhk.or.jp': this.extractNHK,
      'asahi.com': this.extractAsahi,
      'yomiuri.co.jp': this.extractYomiuri,
      'nikkei.com': this.extractNikkei,
      'note.com': this.extractNote,
      'hatenablog': this.extractHatenaBlog,
      'qiita.com': this.extractQiita,
      'zenn.dev': this.extractZenn,
      'medium.com': this.extractMedium,
      'wikipedia.org': this.extractWikipedia,
      'github.com': this.extractGitHub,
      'prtimes.jp': this.extractPRTimes
    };
  }

  async extract(url) {
    const domain = new URL(url).hostname;

    // 専用エクストラクタを探す
    for (const [pattern, extractor] of Object.entries(this.extractors)) {
      if (domain.includes(pattern)) {
        return await extractor.call(this, url);
      }
    }

    // 汎用エクストラクタ
    return await this.extractGeneric(url);
  }
}
```

#### 各サイト専用抽出ロジック
```javascript
// Yahoo!ニュース
async extractYahooNews(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return {
    title: doc.querySelector('article header h1')?.textContent || '',
    content: doc.querySelector('div.article_body')?.textContent || '',
    author: doc.querySelector('span.author')?.textContent || '',
    date: doc.querySelector('time')?.getAttribute('datetime') || '',
    images: Array.from(doc.querySelectorAll('article img')).map(img => ({
      src: img.src,
      alt: img.alt
    }))
  };
}

// note
async extractNote(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return {
    title: doc.querySelector('h1.o-noteContentHeader__title')?.textContent || '',
    content: doc.querySelector('div.note-common-styles__textnote')?.textContent || '',
    author: doc.querySelector('a.o-noteContentHeader__userNameLink')?.textContent || '',
    date: doc.querySelector('time')?.textContent || '',
    images: Array.from(doc.querySelectorAll('figure img')).map(img => ({
      src: img.src,
      alt: img.alt
    }))
  };
}

// Qiita
async extractQiita(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // マークダウンコンテンツの取得
  const content = doc.querySelector('.it-MdContent');
  const processedContent = this.processMarkdown(content);

  return {
    title: doc.querySelector('h1.it-Header_title')?.textContent || '',
    content: processedContent,
    author: doc.querySelector('.it-Header_authorName')?.textContent || '',
    date: doc.querySelector('time')?.textContent || '',
    tags: Array.from(doc.querySelectorAll('.it-Tags_item')).map(tag => tag.textContent),
    codeBlocks: this.extractCodeBlocks(content)
  };
}

// GitHub README
async extractGitHub(url) {
  // README.mdの特別処理
  if (url.includes('/blob/') || url.includes('/tree/')) {
    // Raw URLに変換
    const rawUrl = url.replace('github.com', 'raw.githubusercontent.com')
                      .replace('/blob/', '/');
    const response = await fetch(rawUrl);
    const markdown = await response.text();

    return {
      title: this.extractTitleFromMarkdown(markdown),
      content: markdown,
      type: 'markdown',
      isReadme: true
    };
  }

  // 通常のGitHubページ
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return {
    title: doc.querySelector('.markdown-body h1')?.textContent ||
           doc.querySelector('h1')?.textContent || '',
    content: doc.querySelector('.markdown-body')?.textContent || '',
    repository: doc.querySelector('[itemprop="name"] a')?.textContent || ''
  };
}
```

#### 汎用抽出ロジック
```javascript
async extractGeneric(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // 不要な要素を削除
  this.removeUnwantedElements(doc);

  // メインコンテンツの検出
  const mainContent = this.detectMainContent(doc);

  return {
    title: this.extractTitle(doc),
    content: this.extractContent(mainContent || doc.body),
    author: this.extractAuthor(doc),
    date: this.extractDate(doc),
    images: this.extractImages(doc)
  };
}

removeUnwantedElements(doc) {
  // 広告、ナビゲーション、フッターなどを削除
  const selectors = [
    'script', 'style', 'noscript', 'iframe',
    'nav', 'header', 'footer', 'aside',
    '.advertisement', '.ads', '.banner',
    '.navigation', '.menu', '.sidebar',
    '#comments', '.related-articles'
  ];

  selectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });
}

detectMainContent(doc) {
  // 本文エリアの自動検出
  const candidates = [
    'main', 'article', '[role="main"]',
    '.content', '.main-content', '.article-body',
    '#content', '#main', '.entry-content'
  ];

  for (const selector of candidates) {
    const element = doc.querySelector(selector);
    if (element && element.textContent.length > 500) {
      return element;
    }
  }

  // ヒューリスティックによる検出
  return this.findContentByHeuristics(doc);
}

findContentByHeuristics(doc) {
  let maxScore = 0;
  let bestElement = null;

  doc.querySelectorAll('div, section, article').forEach(element => {
    const score = this.calculateContentScore(element);
    if (score > maxScore) {
      maxScore = score;
      bestElement = element;
    }
  });

  return bestElement;
}

calculateContentScore(element) {
  let score = 0;

  // テキスト長
  score += element.textContent.length / 100;

  // 段落の数
  score += element.querySelectorAll('p').length * 3;

  // リンクとテキストの比率
  const linkLength = Array.from(element.querySelectorAll('a'))
    .reduce((sum, a) => sum + a.textContent.length, 0);
  const textLength = element.textContent.length;
  score -= (linkLength / textLength) * 50;

  // クラス名・ID名のヒント
  const hints = ['content', 'article', 'main', 'body', 'text'];
  const classAndId = (element.className + ' ' + element.id).toLowerCase();
  hints.forEach(hint => {
    if (classAndId.includes(hint)) score += 20;
  });

  return score;
}
```

### 3. content.js - コンテンツスクリプト

```javascript
// ページ内での直接抽出（CORS回避）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_CONTENT') {
    const extractor = new ContentExtractor();

    // DOM直接アクセス版の抽出
    const result = {
      title: extractTitleFromDOM(),
      content: extractContentFromDOM(),
      author: extractAuthorFromDOM(),
      date: extractDateFromDOM(),
      images: extractImagesFromDOM()
    };

    sendResponse(result);
  }
});

function extractContentFromDOM() {
  // 現在のページのDOMから直接抽出
  const mainContent = detectMainContent(document);

  if (mainContent) {
    // テキストと構造を保持
    return {
      text: mainContent.innerText,
      html: mainContent.innerHTML,
      structure: extractStructure(mainContent)
    };
  }

  return null;
}

function extractStructure(element) {
  // 見出し、段落、リストなどの構造を保持
  const structure = [];

  element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre').forEach(el => {
    structure.push({
      tag: el.tagName.toLowerCase(),
      text: el.innerText,
      level: el.tagName.startsWith('H') ? parseInt(el.tagName[1]) : 0
    });
  });

  return structure;
}
```

### 4. エラー処理とフォールバック

```javascript
class RobustExtractor {
  async extractWithFallback(url) {
    const strategies = [
      () => this.extractViaContentScript(url),  // 最優先
      () => this.extractViaFetch(url),           // CORS可能な場合
      () => this.extractViaProxy(url),           // プロキシ経由
      () => this.extractBasicInfo(url)           // 最小限の情報
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result && result.content) {
          return this.validateAndClean(result);
        }
      } catch (error) {
        console.warn(`Strategy failed: ${error.message}`);
      }
    }

    throw new Error('すべての抽出方法が失敗しました');
  }

  validateAndClean(data) {
    // データクリーニング
    return {
      title: this.cleanText(data.title || '無題'),
      content: this.cleanContent(data.content || ''),
      author: this.cleanText(data.author || '不明'),
      date: this.normalizeDate(data.date || new Date().toISOString()),
      url: data.url,
      extractedAt: new Date().toISOString()
    };
  }

  cleanContent(content) {
    // 空白の正規化
    content = content.replace(/\s+/g, ' ').trim();

    // 無効な文字の削除
    content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 最小長チェック
    if (content.length < 100) {
      throw new Error('コンテンツが短すぎます');
    }

    return content;
  }
}
```

### 5. テスト項目
- [ ] 14サイト各々での抽出テスト
- [ ] タイトル、本文、著者、日付の正確な抽出
- [ ] 画像URLとalt属性の取得
- [ ] マークダウン形式の保持（Qiita, Zenn, GitHub）
- [ ] コードブロックの適切な処理
- [ ] 不要要素（広告、ナビ）の除去
- [ ] CORS対策（コンテンツスクリプト経由）
- [ ] エラー時のフォールバック動作
- [ ] 日本語コンテンツの文字化け防止
- [ ] 最小コンテンツ長の検証

## 実装の注意点
- fetchではCORS制限があるため、コンテンツスクリプトを活用
- 動的レンダリングサイト（SPA）への対応検討
- 文字エンコーディングの自動検出
- ページネーション対応（複数ページ記事）
- robots.txtやサイトポリシーの尊重