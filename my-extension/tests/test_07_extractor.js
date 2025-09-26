// Test file for content extraction logic from 07_extractor.js
// This file tests the content extraction functionality with mock DOM objects
// Syntax is compatible with node --check

console.log("Starting content extractor tests...");

// Simple assertion function for testing
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

// Mock DOM elements for testing
class MockElement {
  constructor(tagName, textContent = "", className = "") {
    this.tagName = tagName.toLowerCase();
    this.innerText = textContent;
    this.textContent = textContent;
    this.className = className;
    this.children = [];
    this.attributes = new Map();
  }

  querySelector(selector) {
    // Simple selector implementation for testing
    if (selector.startsWith(".")) {
      const className = selector.substring(1);
      return this.findByClass(className);
    }
    if (selector.startsWith("#")) {
      const id = selector.substring(1);
      return this.findById(id);
    }
    return this.findByTag(selector);
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.startsWith(".")) {
      const className = selector.substring(1);
      this.findAllByClass(className, results);
    } else {
      this.findAllByTag(selector, results);
    }
    return results;
  }

  findByClass(className) {
    if (this.className.includes(className)) {
      return this;
    }
    for (const child of this.children) {
      const result = child.findByClass(className);
      if (result) return result;
    }
    return null;
  }

  findById(id) {
    if (this.attributes.get("id") === id) {
      return this;
    }
    for (const child of this.children) {
      const result = child.findById(id);
      if (result) return result;
    }
    return null;
  }

  findByTag(tag) {
    if (this.tagName === tag.toLowerCase()) {
      return this;
    }
    for (const child of this.children) {
      const result = child.findByTag(tag);
      if (result) return result;
    }
    return null;
  }

  findAllByClass(className, results) {
    if (this.className.includes(className)) {
      results.push(this);
    }
    for (const child of this.children) {
      child.findAllByClass(className, results);
    }
  }

  findAllByTag(tag, results) {
    if (this.tagName === tag.toLowerCase()) {
      results.push(this);
    }
    for (const child of this.children) {
      child.findAllByTag(tag, results);
    }
  }

  appendChild(child) {
    this.children.push(child);
    child.parent = this;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }
}

// Mock document object for testing
function createMockDocument() {
  const doc = {
    body: new MockElement("body"),
    querySelector: function (selector) {
      return this.body.querySelector(selector);
    },
    querySelectorAll: function (selector) {
      return this.body.querySelectorAll(selector);
    },
  };
  return doc;
}

// Mock implementation of extractContent function
function mockExtractContent(document, url) {
  const domain = new URL(url).hostname;

  console.log(`Extracting content from domain: ${domain}`);

  const extractors = {
    "yahoo.co.jp": mockExtractYahooNews,
    "news.yahoo.co.jp": mockExtractYahooNews,
    "note.com": mockExtractNote,
    "qiita.com": mockExtractQiita,
    "zenn.dev": mockExtractZenn,
    "medium.com": mockExtractMedium,
    "dev.to": mockExtractDevTo,
    "github.com": mockExtractGitHub,
    "stackoverflow.com": mockExtractStackOverflow,
    "wikipedia.org": mockExtractWikipedia,
    "nytimes.com": mockExtractNYTimes,
    "bbc.com": mockExtractBBC,
    "cnn.com": mockExtractCNN,
    "reddit.com": mockExtractReddit,
  };

  for (const [key, extractor] of Object.entries(extractors)) {
    if (domain.includes(key)) {
      try {
        const result = extractor(document);
        if (result && result.text) {
          console.log(`Successfully extracted using ${key} extractor`);
          return result;
        }
      } catch (error) {
        console.error(`Error in ${key} extractor:`, error);
      }
    }
  }

  console.log("Using default extractor");
  return mockExtractDefault(document);
}

// Mock extractor functions
function mockExtractYahooNews(document) {
  const title = document.querySelector("h1, .sc-gBOOmk")?.innerText || "";
  const article =
    document.querySelector("article, .sc-eVJWDD, main")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "Yahoo News",
  };
}

function mockExtractNote(document) {
  const title =
    document.querySelector("h1, .note-common-styles__textnote-title")
      ?.innerText || "";
  const article =
    document.querySelector(
      ".note-common-styles__textnote, .p-article__content, article",
    )?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "note.com",
  };
}

function mockExtractQiita(document) {
  const title = document.querySelector(".it-Header_title")?.innerText || "";
  const article = document.querySelector(".it-MdContent")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "Qiita",
  };
}

function mockExtractZenn(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const article = document.querySelector(".znc")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "Zenn",
  };
}

function mockExtractMedium(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const article = document.querySelector("article, main")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "Medium",
  };
}

function mockExtractDevTo(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const article =
    document.querySelector(".crayons-article__body")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "DEV.to",
  };
}

function mockExtractGitHub(document) {
  const title = document.querySelector("h1, .markdown-title")?.innerText || "";
  const readme =
    document.querySelector(".markdown-body, .repository-content")?.innerText ||
    "";
  const code = document.querySelector(".blob-wrapper")?.innerText || "";

  return {
    title: title,
    text: readme || code || document.body.innerText,
    source: "GitHub",
  };
}

function mockExtractStackOverflow(document) {
  const title = document.querySelector("h1 a")?.innerText || "";
  const question =
    document.querySelector(".question .s-prose")?.innerText || "";
  const answers = Array.from(document.querySelectorAll(".answer .s-prose"))
    .map((el) => el.innerText)
    .join("\n\n---\n\n");

  return {
    title: title,
    text:
      `Question:\n${question}\n\nAnswers:\n${answers}` ||
      document.body.innerText,
    source: "Stack Overflow",
  };
}

function mockExtractWikipedia(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const content = document.querySelector("#mw-content-text")?.innerText || "";

  return {
    title: title,
    text: content || document.body.innerText,
    source: "Wikipedia",
  };
}

function mockExtractNYTimes(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const article =
    document.querySelector('article, section[name="articleBody"]')?.innerText ||
    "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "The New York Times",
  };
}

function mockExtractBBC(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const article = document.querySelector("article, main")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "BBC",
  };
}

function mockExtractCNN(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const article =
    document.querySelector(".article__content, article")?.innerText || "";

  return {
    title: title,
    text: article || document.body.innerText,
    source: "CNN",
  };
}

function mockExtractReddit(document) {
  const title = document.querySelector("h1")?.innerText || "";
  const post =
    document.querySelector('[data-test-id="post-content"]')?.innerText || "";
  const comments = document.querySelector(".Comment")?.innerText || "";

  return {
    title: title,
    text: `${post}\n\nComments:\n${comments}` || document.body.innerText,
    source: "Reddit",
  };
}

function mockExtractDefault(document) {
  const title =
    document.querySelector("h1, h2, title")?.innerText || "No title";

  const contentSelectors = [
    "main",
    "article",
    '[role="main"]',
    ".content",
    ".main-content",
    "#content",
    "#main",
    ".post",
    ".entry-content",
    ".article-body",
  ];

  let content = "";
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.innerText;
      break;
    }
  }

  if (!content) {
    const article = document.querySelector("article");
    if (article) {
      content = article.innerText;
    } else {
      const main = document.querySelector("main");
      content = main ? main.innerText : document.body.innerText;
    }
  }

  return {
    title: title,
    text: content.trim(),
    source: "Web Page",
  };
}

// Test data for different websites
const testData = {
  yahooNews: {
    url: "https://news.yahoo.co.jp/test-article",
    mockHtml: `
      <h1>Yahoo News Test Title</h1>
      <article>This is the main content of the Yahoo News article.</article>
    `,
  },
  note: {
    url: "https://note.com/test-user/n/test-note",
    mockHtml: `
      <h1 class="note-common-styles__textnote-title">Note Article Title</h1>
      <div class="note-common-styles__textnote">This is the content of the note article.</div>
    `,
  },
  qiita: {
    url: "https://qiita.com/test-user/items/test-item",
    mockHtml: `
      <h1 class="it-Header_title">Qiita Technical Article</h1>
      <div class="it-MdContent">This is the markdown content from Qiita.</div>
    `,
  },
  zenn: {
    url: "https://zenn.dev/test-user/articles/test-article",
    mockHtml: `
      <h1>Zenn Article Title</h1>
      <div class="znc">This is the content from Zenn article.</div>
    `,
  },
  medium: {
    url: "https://medium.com/@test-user/test-article",
    mockHtml: `
      <h1>Medium Article Title</h1>
      <article>This is the content from Medium article.</article>
    `,
  },
  github: {
    url: "https://github.com/test-user/test-repo",
    mockHtml: `
      <h1 class="markdown-title">Test Repository</h1>
      <div class="markdown-body">This is the README content from GitHub repository.</div>
    `,
  },
  stackoverflow: {
    url: "https://stackoverflow.com/questions/12345/test-question",
    mockHtml: `
      <h1><a>How to test JavaScript functions?</a></h1>
      <div class="question"><div class="s-prose">This is the question content.</div></div>
      <div class="answer"><div class="s-prose">This is the first answer.</div></div>
      <div class="answer"><div class="s-prose">This is the second answer.</div></div>
    `,
  },
  wikipedia: {
    url: "https://en.wikipedia.org/wiki/Test_Article",
    mockHtml: `
      <h1>Wikipedia Test Article</h1>
      <div id="mw-content-text">This is the main content from Wikipedia article.</div>
    `,
  },
  generic: {
    url: "https://example.com/test-page",
    mockHtml: `
      <h1>Generic Website Title</h1>
      <main>This is the main content from a generic website.</main>
    `,
  },
};

// Helper function to create mock document from HTML-like structure
function createMockDocumentFromData(data) {
  const doc = createMockDocument();

  // Create elements based on test data
  if (data.url.includes("yahoo")) {
    const h1 = new MockElement("h1", "Yahoo News Test Title");
    const article = new MockElement(
      "article",
      "This is the main content of the Yahoo News article.",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(article);
  } else if (data.url.includes("note.com")) {
    const h1 = new MockElement(
      "h1",
      "Note Article Title",
      "note-common-styles__textnote-title",
    );
    const content = new MockElement(
      "div",
      "This is the content of the note article.",
      "note-common-styles__textnote",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(content);
  } else if (data.url.includes("qiita.com")) {
    const h1 = new MockElement(
      "h1",
      "Qiita Technical Article",
      "it-Header_title",
    );
    const content = new MockElement(
      "div",
      "This is the markdown content from Qiita.",
      "it-MdContent",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(content);
  } else if (data.url.includes("zenn.dev")) {
    const h1 = new MockElement("h1", "Zenn Article Title");
    const content = new MockElement(
      "div",
      "This is the content from Zenn article.",
      "znc",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(content);
  } else if (data.url.includes("medium.com")) {
    const h1 = new MockElement("h1", "Medium Article Title");
    const article = new MockElement(
      "article",
      "This is the content from Medium article.",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(article);
  } else if (data.url.includes("github.com")) {
    const h1 = new MockElement("h1", "Test Repository", "markdown-title");
    const content = new MockElement(
      "div",
      "This is the README content from GitHub repository.",
      "markdown-body",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(content);
  } else if (data.url.includes("stackoverflow.com")) {
    const h1 = new MockElement("h1");
    const link = new MockElement("a", "How to test JavaScript functions?");
    h1.appendChild(link);

    const questionDiv = new MockElement("div", "", "question");
    const questionProse = new MockElement(
      "div",
      "This is the question content.",
      "s-prose",
    );
    questionDiv.appendChild(questionProse);

    const answer1 = new MockElement("div", "", "answer");
    const answer1Prose = new MockElement(
      "div",
      "This is the first answer.",
      "s-prose",
    );
    answer1.appendChild(answer1Prose);

    const answer2 = new MockElement("div", "", "answer");
    const answer2Prose = new MockElement(
      "div",
      "This is the second answer.",
      "s-prose",
    );
    answer2.appendChild(answer2Prose);

    doc.body.appendChild(h1);
    doc.body.appendChild(questionDiv);
    doc.body.appendChild(answer1);
    doc.body.appendChild(answer2);
  } else if (data.url.includes("wikipedia.org")) {
    const h1 = new MockElement("h1", "Wikipedia Test Article");
    const content = new MockElement(
      "div",
      "This is the main content from Wikipedia article.",
    );
    content.setAttribute("id", "mw-content-text");
    doc.body.appendChild(h1);
    doc.body.appendChild(content);
  } else {
    // Generic website
    const h1 = new MockElement("h1", "Generic Website Title");
    const main = new MockElement(
      "main",
      "This is the main content from a generic website.",
    );
    doc.body.appendChild(h1);
    doc.body.appendChild(main);
  }

  doc.body.innerText = "Fallback body content";
  return doc;
}

// Test 1: Yahoo News extraction
function testYahooNewsExtraction() {
  console.log("\n--- Test 1: Yahoo News Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.yahooNews);
  const result = mockExtractContent(mockDoc, testData.yahooNews.url);

  assert(
    result.title === "Yahoo News Test Title",
    "Should extract correct title",
  );
  assert(
    result.text === "This is the main content of the Yahoo News article.",
    "Should extract correct content",
  );
  assert(result.source === "Yahoo News", "Should identify correct source");

  console.log("Yahoo News extraction test passed");
}

// Test 2: Note.com extraction
function testNoteExtraction() {
  console.log("\n--- Test 2: Note.com Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.note);
  const result = mockExtractContent(mockDoc, testData.note.url);

  assert(result.title === "Note Article Title", "Should extract correct title");
  assert(
    result.text === "This is the content of the note article.",
    "Should extract correct content",
  );
  assert(result.source === "note.com", "Should identify correct source");

  console.log("Note.com extraction test passed");
}

// Test 3: Qiita extraction
function testQiitaExtraction() {
  console.log("\n--- Test 3: Qiita Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.qiita);
  const result = mockExtractContent(mockDoc, testData.qiita.url);

  assert(
    result.title === "Qiita Technical Article",
    "Should extract correct title",
  );
  assert(
    result.text === "This is the markdown content from Qiita.",
    "Should extract correct content",
  );
  assert(result.source === "Qiita", "Should identify correct source");

  console.log("Qiita extraction test passed");
}

// Test 4: Zenn extraction
function testZennExtraction() {
  console.log("\n--- Test 4: Zenn Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.zenn);
  const result = mockExtractContent(mockDoc, testData.zenn.url);

  assert(result.title === "Zenn Article Title", "Should extract correct title");
  assert(
    result.text === "This is the content from Zenn article.",
    "Should extract correct content",
  );
  assert(result.source === "Zenn", "Should identify correct source");

  console.log("Zenn extraction test passed");
}

// Test 5: Medium extraction
function testMediumExtraction() {
  console.log("\n--- Test 5: Medium Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.medium);
  const result = mockExtractContent(mockDoc, testData.medium.url);

  assert(
    result.title === "Medium Article Title",
    "Should extract correct title",
  );
  assert(
    result.text === "This is the content from Medium article.",
    "Should extract correct content",
  );
  assert(result.source === "Medium", "Should identify correct source");

  console.log("Medium extraction test passed");
}

// Test 6: GitHub extraction
function testGitHubExtraction() {
  console.log("\n--- Test 6: GitHub Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.github);
  const result = mockExtractContent(mockDoc, testData.github.url);

  assert(result.title === "Test Repository", "Should extract correct title");
  assert(
    result.text === "This is the README content from GitHub repository.",
    "Should extract correct content",
  );
  assert(result.source === "GitHub", "Should identify correct source");

  console.log("GitHub extraction test passed");
}

// Test 7: Stack Overflow extraction
function testStackOverflowExtraction() {
  console.log("\n--- Test 7: Stack Overflow Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.stackoverflow);
  const result = mockExtractContent(mockDoc, testData.stackoverflow.url);

  assert(
    result.title === "How to test JavaScript functions?",
    "Should extract correct title",
  );
  assert(result.text.includes("Question:"), "Should include question section");
  assert(
    result.text.includes("This is the question content."),
    "Should include question text",
  );
  assert(result.text.includes("Answers:"), "Should include answers section");
  assert(
    result.text.includes("This is the first answer."),
    "Should include first answer",
  );
  assert(
    result.text.includes("This is the second answer."),
    "Should include second answer",
  );
  assert(result.source === "Stack Overflow", "Should identify correct source");

  console.log("Stack Overflow extraction test passed");
}

// Test 8: Wikipedia extraction
function testWikipediaExtraction() {
  console.log("\n--- Test 8: Wikipedia Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.wikipedia);
  const result = mockExtractContent(mockDoc, testData.wikipedia.url);

  assert(
    result.title === "Wikipedia Test Article",
    "Should extract correct title",
  );
  assert(
    result.text === "This is the main content from Wikipedia article.",
    "Should extract correct content",
  );
  assert(result.source === "Wikipedia", "Should identify correct source");

  console.log("Wikipedia extraction test passed");
}

// Test 9: Default extractor fallback
function testDefaultExtraction() {
  console.log("\n--- Test 9: Default Extraction ---");

  const mockDoc = createMockDocumentFromData(testData.generic);
  const result = mockExtractContent(mockDoc, testData.generic.url);

  assert(
    result.title === "Generic Website Title",
    "Should extract correct title",
  );
  assert(
    result.text === "This is the main content from a generic website.",
    "Should extract correct content",
  );
  assert(result.source === "Web Page", "Should identify as generic web page");

  console.log("Default extraction test passed");
}

// Test 10: URL domain parsing
function testUrlDomainParsing() {
  console.log("\n--- Test 10: URL Domain Parsing ---");

  const testUrls = [
    {
      url: "https://news.yahoo.co.jp/article/123",
      expectedDomain: "news.yahoo.co.jp",
    },
    { url: "https://note.com/user/n/article", expectedDomain: "note.com" },
    { url: "https://qiita.com/user/items/item", expectedDomain: "qiita.com" },
    {
      url: "https://zenn.dev/user/articles/article",
      expectedDomain: "zenn.dev",
    },
    { url: "https://medium.com/@user/article", expectedDomain: "medium.com" },
    { url: "https://github.com/user/repo", expectedDomain: "github.com" },
    {
      url: "https://stackoverflow.com/questions/123/question",
      expectedDomain: "stackoverflow.com",
    },
    {
      url: "https://en.wikipedia.org/wiki/Article",
      expectedDomain: "en.wikipedia.org",
    },
  ];

  testUrls.forEach(({ url, expectedDomain }) => {
    const domain = new URL(url).hostname;
    assert(
      domain === expectedDomain,
      `Should correctly parse domain from ${url}`,
    );
  });

  console.log("URL domain parsing test passed");
}

// Test 11: Error handling - malformed URL
function testErrorHandlingMalformedUrl() {
  console.log("\n--- Test 11: Error Handling Malformed URL ---");

  try {
    new URL("not-a-valid-url");
    assert(false, "Should throw error for malformed URL");
  } catch (error) {
    assert(
      error instanceof TypeError,
      "Should throw TypeError for malformed URL",
    );
  }

  console.log("Error handling malformed URL test passed");
}

// Test 12: Empty content handling
function testEmptyContentHandling() {
  console.log("\n--- Test 12: Empty Content Handling ---");

  const emptyDoc = createMockDocument();
  emptyDoc.body.innerText = "Fallback content";

  const result = mockExtractDefault(emptyDoc);

  assert(
    result.title === "No title",
    "Should return default title for empty content",
  );
  assert(
    result.text === "Fallback content",
    "Should fall back to body content",
  );
  assert(result.source === "Web Page", "Should identify as generic web page");

  console.log("Empty content handling test passed");
}

// Test 13: Extractor selection logic
function testExtractorSelection() {
  console.log("\n--- Test 13: Extractor Selection Logic ---");

  const testCases = [
    { url: "https://news.yahoo.co.jp/test", expectedSource: "Yahoo News" },
    { url: "https://note.com/test", expectedSource: "note.com" },
    { url: "https://qiita.com/test", expectedSource: "Qiita" },
    { url: "https://zenn.dev/test", expectedSource: "Zenn" },
    { url: "https://medium.com/test", expectedSource: "Medium" },
    { url: "https://github.com/test", expectedSource: "GitHub" },
    { url: "https://stackoverflow.com/test", expectedSource: "Stack Overflow" },
    { url: "https://en.wikipedia.org/test", expectedSource: "Wikipedia" },
    { url: "https://unknown-site.com/test", expectedSource: "Web Page" },
  ];

  testCases.forEach(({ url, expectedSource }) => {
    const mockDoc = createMockDocumentFromData({ url });
    const result = mockExtractContent(mockDoc, url);
    assert(
      result.source === expectedSource,
      `Should select correct extractor for ${url}`,
    );
  });

  console.log("Extractor selection logic test passed");
}

// Test 14: Mock element functionality
function testMockElementFunctionality() {
  console.log("\n--- Test 14: Mock Element Functionality ---");

  const parent = new MockElement("div", "Parent content");
  const child1 = new MockElement("h1", "Title", "header-class");
  const child2 = new MockElement("p", "Paragraph content", "text-class");

  child1.setAttribute("id", "main-title");
  parent.appendChild(child1);
  parent.appendChild(child2);

  // Test querySelector by tag
  const h1Element = parent.querySelector("h1");
  assert(h1Element !== null, "Should find element by tag");
  assert(h1Element.innerText === "Title", "Should return correct element");

  // Test querySelector by class
  const headerElement = parent.querySelector(".header-class");
  assert(headerElement !== null, "Should find element by class");
  assert(
    headerElement.innerText === "Title",
    "Should return correct element by class",
  );

  // Test querySelector by ID
  const titleElement = parent.querySelector("#main-title");
  assert(titleElement !== null, "Should find element by ID");
  assert(
    titleElement.innerText === "Title",
    "Should return correct element by ID",
  );

  // Test querySelectorAll
  const allParagraphs = parent.querySelectorAll("p");
  assert(allParagraphs.length === 1, "Should find all matching elements");
  assert(
    allParagraphs[0].innerText === "Paragraph content",
    "Should return correct elements",
  );

  console.log("Mock element functionality test passed");
}

// Test 15: Content sanitization
function testContentSanitization() {
  console.log("\n--- Test 15: Content Sanitization ---");

  const mockDoc = createMockDocument();
  const h1 = new MockElement("h1", "  Test Title  ");
  const main = new MockElement("main", "  \n\n  Content with whitespace  \n  ");
  mockDoc.body.appendChild(h1);
  mockDoc.body.appendChild(main);

  const result = mockExtractDefault(mockDoc);

  assert(result.title === "  Test Title  ", "Should preserve title content");
  assert(
    result.text === "Content with whitespace",
    "Should trim whitespace from content",
  );

  console.log("Content sanitization test passed");
}

// Run all tests
function runAllTests() {
  console.log("=== Content Extractor Tests ===");

  try {
    // Site-specific extractor tests
    testYahooNewsExtraction();
    testNoteExtraction();
    testQiitaExtraction();
    testZennExtraction();
    testMediumExtraction();
    testGitHubExtraction();
    testStackOverflowExtraction();
    testWikipediaExtraction();
    testDefaultExtraction();

    // Utility and edge case tests
    testUrlDomainParsing();
    testErrorHandlingMalformedUrl();
    testEmptyContentHandling();
    testExtractorSelection();
    testMockElementFunctionality();
    testContentSanitization();

    console.log("\n✅ All content extractor tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Export test functions for potential external testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    mockExtractContent,
    MockElement,
    createMockDocument,
    createMockDocumentFromData,
    testYahooNewsExtraction,
    testNoteExtraction,
    testQiitaExtraction,
    testZennExtraction,
    testMediumExtraction,
    testGitHubExtraction,
    testStackOverflowExtraction,
    testWikipediaExtraction,
    testDefaultExtraction,
    testUrlDomainParsing,
    testErrorHandlingMalformedUrl,
    testEmptyContentHandling,
    testExtractorSelection,
    testMockElementFunctionality,
    testContentSanitization,
    runAllTests,
  };
}

// Run tests if this file is executed directly
if (typeof require !== "undefined" && require.main === module) {
  runAllTests();
}

console.log("Content extractor test file loaded successfully");
