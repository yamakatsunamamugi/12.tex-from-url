import { ContentExtractor, RobustExtractor } from "../07_extractor.js";

class TestRunner {
  constructor() {
    this.extractor = new ContentExtractor();
    this.robustExtractor = new RobustExtractor();
    this.results = [];
    this.testUrls = this.generateTestUrls();
  }

  generateTestUrls() {
    return {
      yahooNews: [
        "https://news.yahoo.co.jp/articles/sample1",
        "https://news.yahoo.co.jp/pickup/sample2",
      ],
      nhk: [
        "https://www3.nhk.or.jp/news/html/sample1.html",
        "https://www3.nhk.or.jp/news/special/sample2",
      ],
      asahi: [
        "https://www.asahi.com/articles/sample1.html",
        "https://digital.asahi.com/articles/sample2.html",
      ],
      yomiuri: [
        "https://www.yomiuri.co.jp/national/sample1.html",
        "https://www.yomiuri.co.jp/economy/sample2.html",
      ],
      nikkei: [
        "https://www.nikkei.com/article/sample1/",
        "https://www.nikkei.com/article/sample2/",
      ],
      note: [
        "https://note.com/user1/n/sample1",
        "https://note.com/user2/n/sample2",
      ],
      hatenaBlog: [
        "https://sample.hatenablog.com/entry/sample1",
        "https://sample.hatenablog.jp/entry/sample2",
      ],
      qiita: [
        "https://qiita.com/user1/items/sample1",
        "https://qiita.com/user2/items/sample2",
      ],
      zenn: [
        "https://zenn.dev/user1/articles/sample1",
        "https://zenn.dev/user2/articles/sample2",
      ],
      medium: [
        "https://medium.com/@user1/sample1",
        "https://medium.com/publication/sample2",
      ],
      wikipedia: [
        "https://ja.wikipedia.org/wiki/Sample1",
        "https://en.wikipedia.org/wiki/Sample2",
      ],
      github: [
        "https://github.com/user/repo/blob/main/README.md",
        "https://github.com/user/repo/tree/main/docs",
      ],
      prtimes: [
        "https://prtimes.jp/main/html/rd/p/sample1.html",
        "https://prtimes.jp/main/html/rd/p/sample2.html",
      ],
      generic: [
        "https://example.com/article1",
        "https://blog.example.com/post1",
      ],
    };
  }

  createMockDocument(type) {
    const mockDocuments = {
      yahooNews: `
        <html>
          <head><title>Yahoo!ニュース テスト記事</title></head>
          <body>
            <article>
              <header><h1>テストニュースタイトル</h1></header>
              <div class="article_body">
                <p>これはテスト記事の本文です。Yahoo!ニュースの記事構造をシミュレートしています。</p>
                <p>複数の段落があります。内容は十分な長さを持っています。</p>
              </div>
              <span class="author">テスト記者</span>
              <time datetime="2024-09-27T10:00:00">2024年9月27日</time>
              <img src="test.jpg" alt="テスト画像">
            </article>
          </body>
        </html>
      `,
      note: `
        <html>
          <head><title>noteテスト記事</title></head>
          <body>
            <h1 class="o-noteContentHeader__title">noteのテスト記事タイトル</h1>
            <div class="note-common-styles__textnote">
              <p>noteの記事本文です。創作やエッセイなどが含まれます。</p>
              <p>複数の段落で構成されており、十分な長さがあります。</p>
            </div>
            <a class="o-noteContentHeader__userNameLink">テスト著者</a>
            <time>2024-09-27</time>
            <figure><img src="note-test.jpg" alt="note画像"></figure>
          </body>
        </html>
      `,
      qiita: `
        <html>
          <head><title>Qiitaテスト記事</title></head>
          <body>
            <h1 class="it-Header_title">Qiita技術記事のタイトル</h1>
            <div class="it-MdContent">
              <p>技術的な内容を含む記事です。コードサンプルも含まれます。</p>
              <pre><code class="language-javascript">
                const test = () => {
                  console.log('test');
                };
              </code></pre>
              <p>説明文が続きます。技術的な詳細が記載されています。</p>
            </div>
            <span class="it-Header_authorName">テスト投稿者</span>
            <time>2024-09-27T10:00:00</time>
            <span class="it-Tags_item">JavaScript</span>
            <span class="it-Tags_item">Testing</span>
          </body>
        </html>
      `,
      github: `
        <html>
          <head><title>GitHub Repository</title></head>
          <body>
            <div class="markdown-body">
              <h1>README</h1>
              <p>This is a test repository README file.</p>
              <p>It contains documentation about the project.</p>
              <h2>Installation</h2>
              <pre><code>npm install</code></pre>
              <h2>Usage</h2>
              <p>Run the following command to start:</p>
              <pre><code>npm start</code></pre>
            </div>
          </body>
        </html>
      `,
      generic: `
        <html>
          <head>
            <title>Generic Article</title>
            <meta property="og:title" content="Generic Article Title">
            <meta name="author" content="Generic Author">
          </head>
          <body>
            <header>Navigation Menu</header>
            <main>
              <article>
                <h1>Generic Article Title</h1>
                <div class="content">
                  <p>This is a generic article with standard HTML structure.</p>
                  <p>It should be extracted using the heuristic algorithm.</p>
                  <p>The content is long enough to be considered valid.</p>
                  <p>Multiple paragraphs ensure sufficient content length.</p>
                </div>
                <time>2024-09-27</time>
              </article>
            </main>
            <aside class="sidebar">Sidebar content</aside>
            <footer>Footer content</footer>
          </body>
        </html>
      `,
    };

    const parser = new DOMParser();
    const htmlString = mockDocuments[type] || mockDocuments.generic;
    return parser.parseFromString(htmlString, "text/html");
  }

  async testSiteExtractor(siteName, urls, extractorType) {
    console.log(`\n===== Testing ${siteName} =====`);
    const results = [];

    for (const url of urls) {
      try {
        const mockDoc = this.createMockDocument(extractorType);
        const extracted = await this.extractor.extract(url, mockDoc);

        const testResult = {
          site: siteName,
          url: url,
          success: true,
          hasTitle: !!extracted.title && extracted.title !== "無題",
          hasContent: !!extracted.content && extracted.content.length > 100,
          hasAuthor: !!extracted.author && extracted.author !== "不明",
          hasDate: !!extracted.date,
          hasImages: extracted.images && extracted.images.length > 0,
          contentLength: extracted.content ? extracted.content.length : 0,
        };

        console.log(`✓ URL: ${url}`);
        console.log(
          `  - Title: ${testResult.hasTitle ? "✓" : "✗"} ${extracted.title?.substring(0, 50)}...`,
        );
        console.log(
          `  - Content: ${testResult.hasContent ? "✓" : "✗"} (${testResult.contentLength} chars)`,
        );
        console.log(
          `  - Author: ${testResult.hasAuthor ? "✓" : "✗"} ${extracted.author}`,
        );
        console.log(
          `  - Date: ${testResult.hasDate ? "✓" : "✗"} ${extracted.date}`,
        );
        console.log(
          `  - Images: ${testResult.hasImages ? "✓" : "✗"} (${extracted.images?.length || 0} images)`,
        );

        results.push(testResult);
      } catch (error) {
        console.error(`✗ Failed to extract from ${url}: ${error.message}`);
        results.push({
          site: siteName,
          url: url,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  async testFallbackStrategies() {
    console.log("\n===== Testing Fallback Strategies =====");

    const testCases = [
      {
        name: "Normal extraction",
        url: "https://example.com/article",
        shouldSucceed: true,
      },
      {
        name: "Empty document",
        url: "https://empty.example.com",
        shouldSucceed: false,
      },
      {
        name: "Malformed HTML",
        url: "https://broken.example.com",
        shouldSucceed: false,
      },
    ];

    for (const testCase of testCases) {
      try {
        const mockDoc =
          testCase.name === "Empty document"
            ? new DOMParser().parseFromString(
                "<html><body></body></html>",
                "text/html",
              )
            : testCase.name === "Malformed HTML"
              ? new DOMParser().parseFromString(
                  "<html><body><div>Broken</div",
                  "text/html",
                )
              : this.createMockDocument("generic");

        const result = await this.robustExtractor.extractWithFallback(
          testCase.url,
          mockDoc,
        );

        console.log(`${testCase.shouldSucceed ? "✓" : "✗"} ${testCase.name}:`);
        console.log(`  - Extraction ${result ? "succeeded" : "failed"}`);
        console.log(`  - Content length: ${result?.content?.length || 0}`);
      } catch (error) {
        console.log(`✗ ${testCase.name}: ${error.message}`);
      }
    }
  }

  async testContentValidation() {
    console.log("\n===== Testing Content Validation =====");

    const testCases = [
      {
        name: "Valid content",
        content:
          "This is a valid article content with sufficient length. ".repeat(10),
        shouldPass: true,
      },
      {
        name: "Too short content",
        content: "Short",
        shouldPass: false,
      },
      {
        name: "Content with invalid characters",
        content: "Content with \x00 invalid \x0C characters",
        shouldPass: true,
      },
      {
        name: "Empty content",
        content: "",
        shouldPass: false,
      },
    ];

    for (const testCase of testCases) {
      const cleaned = this.extractor.cleanContent(testCase.content);
      const passed = cleaned.length >= 100;

      console.log(
        `${passed === testCase.shouldPass ? "✓" : "✗"} ${testCase.name}:`,
      );
      console.log(`  - Original length: ${testCase.content.length}`);
      console.log(`  - Cleaned length: ${cleaned.length}`);
      console.log(
        `  - Expected: ${testCase.shouldPass ? "Pass" : "Fail"}, Got: ${passed ? "Pass" : "Fail"}`,
      );
    }
  }

  async testHeuristicScoring() {
    console.log("\n===== Testing Heuristic Scoring =====");

    const mockDoc = this.createMockDocument("generic");
    const elements = mockDoc.querySelectorAll(
      "main, article, aside, footer, header",
    );

    elements.forEach((element) => {
      const score = this.extractor.calculateContentScore(element);
      console.log(
        `Element: ${element.tagName.toLowerCase()}${element.className ? "." + element.className : ""}`,
      );
      console.log(`  - Score: ${score.toFixed(2)}`);
      console.log(`  - Text length: ${element.textContent?.length || 0}`);
      console.log(`  - Paragraphs: ${element.querySelectorAll("p").length}`);
    });
  }

  async testImageExtraction() {
    console.log("\n===== Testing Image Extraction =====");

    const sitesWithImages = ["yahooNews", "note", "qiita"];

    for (const site of sitesWithImages) {
      const mockDoc = this.createMockDocument(site);
      const images = this.extractor.extractImages(mockDoc);

      console.log(`${site}: ${images.length} images found`);
      images.forEach((img, index) => {
        console.log(`  Image ${index + 1}: ${img.src} (alt: "${img.alt}")`);
      });
    }
  }

  async testCodeBlockExtraction() {
    console.log("\n===== Testing Code Block Extraction =====");

    const mockDoc = this.createMockDocument("qiita");
    const contentElement = mockDoc.querySelector(".it-MdContent");
    const codeBlocks = this.extractor.extractCodeBlocks(contentElement);

    console.log(`Found ${codeBlocks.length} code blocks`);
    codeBlocks.forEach((block, index) => {
      console.log(`  Block ${index + 1}:`);
      console.log(`    - Language: ${block.language}`);
      console.log(`    - Code length: ${block.code.length} chars`);
      console.log(`    - Preview: ${block.code.substring(0, 50)}...`);
    });
  }

  async runAllTests() {
    console.log("Starting Comprehensive Extractor Tests");
    console.log("=".repeat(50));

    const allResults = [];

    for (const [key, urls] of Object.entries(this.testUrls)) {
      const siteName = key.charAt(0).toUpperCase() + key.slice(1);
      const extractorType =
        key === "yahooNews" ? "yahooNews" : key === "hatenaBlog" ? "note" : key;
      const results = await this.testSiteExtractor(
        siteName,
        urls,
        extractorType,
      );
      allResults.push(...results);
    }

    await this.testFallbackStrategies();
    await this.testContentValidation();
    await this.testHeuristicScoring();
    await this.testImageExtraction();
    await this.testCodeBlockExtraction();

    this.printSummary(allResults);
  }

  printSummary(results) {
    console.log("\n" + "=".repeat(50));
    console.log("TEST SUMMARY");
    console.log("=".repeat(50));

    const totalTests = results.length;
    const successfulTests = results.filter((r) => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✓ Successful: ${successfulTests}`);
    console.log(`✗ Failed: ${failedTests}`);
    console.log(
      `Success Rate: ${((successfulTests / totalTests) * 100).toFixed(2)}%`,
    );

    const siteStats = {};
    results.forEach((result) => {
      if (!siteStats[result.site]) {
        siteStats[result.site] = { total: 0, success: 0 };
      }
      siteStats[result.site].total++;
      if (result.success) siteStats[result.site].success++;
    });

    console.log("\nPer-Site Statistics:");
    Object.entries(siteStats).forEach(([site, stats]) => {
      const rate = ((stats.success / stats.total) * 100).toFixed(2);
      console.log(`  ${site}: ${stats.success}/${stats.total} (${rate}%)`);
    });

    const extractionStats = {
      title: results.filter((r) => r.hasTitle).length,
      content: results.filter((r) => r.hasContent).length,
      author: results.filter((r) => r.hasAuthor).length,
      date: results.filter((r) => r.hasDate).length,
      images: results.filter((r) => r.hasImages).length,
    };

    console.log("\nExtraction Success by Field:");
    Object.entries(extractionStats).forEach(([field, count]) => {
      const rate = ((count / successfulTests) * 100).toFixed(2);
      console.log(`  ${field}: ${count}/${successfulTests} (${rate}%)`);
    });
  }
}

if (typeof window !== "undefined" && window.chrome && window.chrome.runtime) {
  console.log("Running in Chrome Extension environment");
  const tester = new TestRunner();
  tester
    .runAllTests()
    .then(() => {
      console.log("All tests completed");
    })
    .catch((error) => {
      console.error("Test runner failed:", error);
    });
} else {
  console.log(
    "Test file loaded. Create a TestRunner instance and call runAllTests() to execute tests.",
  );
}

export { TestRunner };
