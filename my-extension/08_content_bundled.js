// Content script for extracting webpage content
// This is a bundled version that includes all extraction logic

// ContentExtractor class definition (bundled from 07_extractor.js)
class ContentExtractor {
  constructor() {
    this.extractors = {
      "news.yahoo.co.jp": this.extractYahooNews,
      "www3.nhk.or.jp": this.extractNHK,
      "asahi.com": this.extractAsahi,
      "yomiuri.co.jp": this.extractYomiuri,
      "nikkei.com": this.extractNikkei,
      "note.com": this.extractNote,
      hatenablog: this.extractHatenaBlog,
      "qiita.com": this.extractQiita,
      "zenn.dev": this.extractZenn,
      "medium.com": this.extractMedium,
      "wikipedia.org": this.extractWikipedia,
      "github.com": this.extractGitHub,
      "prtimes.jp": this.extractPRTimes,
    };
  }

  async extract(doc, url) {
    const domain = new URL(url).hostname;

    for (const [pattern, extractor] of Object.entries(this.extractors)) {
      if (domain.includes(pattern)) {
        return await extractor.call(this, doc, url);
      }
    }

    return await this.extractGeneric(doc, url);
  }

  extractYahooNews(doc) {
    return {
      title: doc.querySelector("article header h1")?.textContent || "",
      content: doc.querySelector("div.article_body")?.textContent || "",
      author: doc.querySelector("span.author")?.textContent || "",
      date: doc.querySelector("time")?.getAttribute("datetime") || "",
      images: Array.from(doc.querySelectorAll("article img")).map((img) => ({
        src: img.src,
        alt: img.alt,
      })),
    };
  }

  extractNote(doc) {
    // より多くのセレクタを試す
    const titleSelectors = [
      "h1.o-noteContentHeader__title",
      ".p-note__title",
      "article h1",
      'h1[class*="title"]',
      "h1",
    ];

    let title = "";
    for (const selector of titleSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim()) {
        title = element.textContent.trim();
        break;
      }
    }

    const contentSelectors = [
      "div.note-common-styles__textnote-body",
      "div.note-common-styles__textnote",
      ".p-article__body",
      '[class*="noteBody"]',
      'div[class*="body"]',
      "article section",
      "main article",
    ];

    let content = "";
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim()) {
        content = this.extractStructuredContent(element);
        break;
      }
    }

    // コンテンツが取れない場合はすべてのpタグを取得
    if (!content) {
      const paragraphs = doc.querySelectorAll("article p, main p, p");
      if (paragraphs.length > 0) {
        content = Array.from(paragraphs)
          .map((p) => p.textContent.trim())
          .filter((text) => text.length > 10)
          .join("\n\n");
      }
    }

    return {
      title: title || doc.title || "",
      content: content || "コンテンツを抽出できませんでした",
      author:
        doc.querySelector("a.o-noteContentHeader__userNameLink")?.textContent ||
        doc.querySelector('[class*="author"]')?.textContent ||
        "",
      date: doc.querySelector("time")?.textContent || "",
      images: Array.from(doc.querySelectorAll("figure img")).map((img) => ({
        src: img.src,
        alt: img.alt,
      })),
    };
  }

  extractGeneric(doc) {
    this.removeUnwantedElements(doc);
    const mainContent = this.detectMainContent(doc);

    return {
      title: this.extractTitle(doc),
      content: this.extractContent(mainContent || doc.body),
      author: this.extractAuthor(doc),
      date: this.extractDate(doc),
      images: this.extractImages(doc),
    };
  }

  removeUnwantedElements(doc) {
    const selectors = [
      "script",
      "style",
      "noscript",
      "iframe",
      "nav",
      "header",
      "footer",
      "aside",
      ".advertisement",
      ".ads",
      ".banner",
      ".navigation",
      ".menu",
      ".sidebar",
      "#comments",
      ".related-articles",
    ];

    selectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }

  detectMainContent(doc) {
    const candidates = [
      "main",
      "article",
      '[role="main"]',
      ".content",
      ".main-content",
      ".article-body",
      "#content",
      "#main",
      ".entry-content",
    ];

    for (const selector of candidates) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.length > 500) {
        return element;
      }
    }

    return this.findContentByHeuristics(doc);
  }

  findContentByHeuristics(doc) {
    let maxScore = 0;
    let bestElement = null;

    doc.querySelectorAll("div, section, article").forEach((element) => {
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
    score += element.textContent.length / 100;
    score += element.querySelectorAll("p").length * 3;

    const linkLength = Array.from(element.querySelectorAll("a")).reduce(
      (sum, a) => sum + a.textContent.length,
      0,
    );
    const textLength = element.textContent.length;
    score -= (linkLength / textLength) * 50;

    const hints = ["content", "article", "main", "body", "text"];
    const classAndId = (element.className + " " + element.id).toLowerCase();
    hints.forEach((hint) => {
      if (classAndId.includes(hint)) score += 20;
    });

    return score;
  }

  extractTitle(doc) {
    return (
      doc.querySelector("h1")?.textContent ||
      doc.querySelector("title")?.textContent ||
      ""
    );
  }

  extractContent(element) {
    return this.extractStructuredContent(element);
  }

  extractStructuredContent(element) {
    if (!element) return "";

    let content = "";

    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.trim();
        if (text) {
          content += text + " ";
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        // スキップすべき要素
        if (["script", "style", "noscript"].includes(tagName)) {
          continue;
        }

        switch (tagName) {
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6":
            content += "\n\n# " + child.textContent.trim() + "\n\n";
            break;
          case "p":
            content += "\n\n" + this.extractTextFromElement(child) + "\n\n";
            break;
          case "br":
            content += "\n";
            break;
          case "blockquote":
            content +=
              "\n\n> " +
              this.extractTextFromElement(child).replace(/\n/g, "\n> ") +
              "\n\n";
            break;
          case "ul":
          case "ol":
            content += "\n\n" + this.extractListContent(child) + "\n\n";
            break;
          case "img":
            const alt = child.getAttribute("alt") || "image";
            const src = child.getAttribute("src") || "";
            content += `\n\n[画像: ${alt}]${src ? ` (${src})` : ""}\n\n`;
            break;
          case "figure":
            const figureContent = this.extractFigureContent(child);
            content += "\n\n" + figureContent + "\n\n";
            break;
          case "div":
          case "section":
          case "article":
            // ブロック要素は再帰処理
            content += this.extractStructuredContent(child);
            break;
          default:
            // その他のインライン要素は子要素を再帰処理
            content += this.extractTextFromElement(child);
            break;
        }
      }
    }

    return this.cleanStructuredText(content);
  }

  extractTextFromElement(element) {
    let text = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (tagName === "strong" || tagName === "b") {
          text += "**" + node.textContent.trim() + "**";
        } else if (tagName === "em" || tagName === "i") {
          text += "*" + node.textContent.trim() + "*";
        } else if (tagName === "br") {
          text += "\n";
        } else {
          text += node.textContent;
        }
      }
    }
    return text.trim();
  }

  extractListContent(listElement) {
    let content = "";
    const items = listElement.querySelectorAll("li");
    const isOrdered = listElement.tagName.toLowerCase() === "ol";

    items.forEach((item, index) => {
      const prefix = isOrdered ? `${index + 1}. ` : "- ";
      content += prefix + this.extractTextFromElement(item) + "\n";
    });

    return content;
  }

  extractFigureContent(figureElement) {
    let content = "";
    const img = figureElement.querySelector("img");
    const caption = figureElement.querySelector("figcaption");

    if (img) {
      const alt = img.getAttribute("alt") || "image";
      const src = img.getAttribute("src") || "";
      content += `[画像: ${alt}]${src ? ` (${src})` : ""}`;
    }

    if (caption) {
      content += "\n" + this.extractTextFromElement(caption);
    }

    return content;
  }

  cleanStructuredText(text) {
    if (!text) return "";

    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    text = text.replace(/ +/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/^\n+|\n+$/g, "");

    return text;
  }

  extractAuthor(doc) {
    return (
      doc.querySelector('[class*="author"]')?.textContent ||
      doc.querySelector('meta[name="author"]')?.getAttribute("content") ||
      ""
    );
  }

  extractDate(doc) {
    return (
      doc.querySelector("time")?.getAttribute("datetime") ||
      doc.querySelector("time")?.textContent ||
      ""
    );
  }

  extractImages(doc) {
    return Array.from(doc.querySelectorAll("img"))
      .filter((img) => img.src && !img.src.includes("data:"))
      .map((img) => ({
        src: img.src,
        alt: img.alt,
      }));
  }
}

// Main extraction function
async function extractContent(doc, url) {
  const extractor = new ContentExtractor();
  return await extractor.extract(doc, url);
}

// Original content script code
function waitForPageLoad() {
  return new Promise((resolve) => {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      setTimeout(resolve, 1000);
    } else {
      window.addEventListener("load", () => {
        setTimeout(resolve, 1000);
      });
    }
  });
}

function detectMainContent(doc) {
  const candidates = [
    "main",
    "article",
    '[role="main"]',
    ".content",
    ".main-content",
    ".article-body",
    "#content",
    "#main",
    ".entry-content",
    ".post-content",
    ".page-content",
  ];

  for (const selector of candidates) {
    const element = doc.querySelector(selector);
    if (element && element.textContent.length > 500) {
      return element;
    }
  }

  return findContentByHeuristics(doc);
}

function findContentByHeuristics(doc) {
  let maxScore = 0;
  let bestElement = null;

  doc.querySelectorAll("div, section, article, main").forEach((element) => {
    const score = calculateContentScore(element);
    if (score > maxScore) {
      maxScore = score;
      bestElement = element;
    }
  });

  return bestElement;
}

function calculateContentScore(element) {
  if (!element || !element.textContent) return 0;

  let score = 0;
  score += element.textContent.length / 100;
  score += element.querySelectorAll("p").length * 3;

  const linkLength = Array.from(element.querySelectorAll("a")).reduce(
    (sum, a) => sum + (a.textContent?.length || 0),
    0,
  );
  const textLength = element.textContent.length;

  if (textLength > 0) {
    score -= (linkLength / textLength) * 50;
  }

  const hints = ["content", "article", "main", "body", "text", "post", "entry"];
  const classAndId = (
    (element.className || "") +
    " " +
    (element.id || "")
  ).toLowerCase();
  hints.forEach((hint) => {
    if (classAndId.includes(hint)) score += 20;
  });

  const negativeHints = [
    "sidebar",
    "menu",
    "nav",
    "footer",
    "header",
    "comment",
    "ad",
  ];
  negativeHints.forEach((hint) => {
    if (classAndId.includes(hint)) score -= 30;
  });

  return score;
}

function extractStructure(element) {
  const structure = [];

  element
    .querySelectorAll("h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre")
    .forEach((el) => {
      structure.push({
        tag: el.tagName.toLowerCase(),
        text: el.innerText || el.textContent,
        level: el.tagName.startsWith("H") ? parseInt(el.tagName[1]) : 0,
      });
    });

  return structure;
}

function extractTitleFromDOM() {
  const titleCandidates = [
    document.querySelector("h1"),
    document.querySelector("article h1"),
    document.querySelector(".title"),
    document.querySelector('[class*="title"]'),
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content"),
    document.querySelector("title"),
  ];

  for (const candidate of titleCandidates) {
    const text =
      typeof candidate === "string" ? candidate : candidate?.textContent;
    if (text && text.trim().length > 0) {
      return text.trim();
    }
  }

  return "No title";
}

function extractContentFromDOM() {
  const mainContent = detectMainContent(document);

  if (mainContent) {
    const extractor = new ContentExtractor();
    return {
      text: extractor.extractStructuredContent(mainContent),
      html: mainContent.innerHTML,
      structure: extractStructure(mainContent),
    };
  }

  const extractor = new ContentExtractor();
  return {
    text: extractor.extractStructuredContent(document.body),
    html: document.body.innerHTML,
    structure: [],
  };
}

function extractAuthorFromDOM() {
  const authorCandidates = [
    document.querySelector('[class*="author"]'),
    document.querySelector('[class*="writer"]'),
    document.querySelector('[class*="byline"]'),
    document.querySelector('meta[name="author"]')?.getAttribute("content"),
    document
      .querySelector('meta[property="article:author"]')
      ?.getAttribute("content"),
  ];

  for (const candidate of authorCandidates) {
    const text =
      typeof candidate === "string" ? candidate : candidate?.textContent;
    if (text && text.trim().length > 0) {
      return text.trim();
    }
  }

  return "不明";
}

function extractDateFromDOM() {
  const dateCandidates = [
    document.querySelector("time")?.getAttribute("datetime"),
    document.querySelector("time")?.textContent,
    document.querySelector('[class*="date"]')?.textContent,
    document.querySelector('[class*="publish"]')?.textContent,
    document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content"),
  ];

  for (const candidate of dateCandidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return new Date().toISOString();
}

function extractImagesFromDOM() {
  const images = [];
  const imgElements = document.querySelectorAll(
    "article img, main img, .content img, img",
  );

  imgElements.forEach((img) => {
    if (
      img.src &&
      !img.src.includes("data:") &&
      !img.src.includes("logo") &&
      !img.src.includes("icon")
    ) {
      images.push({
        src: img.src,
        alt: img.alt || "",
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    }
  });

  return images;
}

// スクロールして全コンテンツを読み込む
async function scrollToLoadAllContent() {
  console.log("Starting auto-scroll to load all content...");

  let lastHeight = 0;
  let currentHeight = document.body.scrollHeight;
  let scrollAttempts = 0;
  const maxScrollAttempts = 30; // 最大30回スクロール

  while (lastHeight !== currentHeight && scrollAttempts < maxScrollAttempts) {
    // 最下部までスクロール
    window.scrollTo(0, document.body.scrollHeight);

    // コンテンツ読み込みを待機
    await new Promise((resolve) => setTimeout(resolve, 1500));

    lastHeight = currentHeight;
    currentHeight = document.body.scrollHeight;
    scrollAttempts++;

    console.log(`Scroll attempt ${scrollAttempts}: Height ${currentHeight}px`);
  }

  // 最上部に戻る
  window.scrollTo(0, 0);
  console.log(`Scrolling completed. Total height: ${currentHeight}px`);

  // 追加で1秒待機（最後のコンテンツ読み込み用）
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function extractAndSendContent() {
  try {
    await waitForPageLoad();

    // スクロールして全コンテンツを読み込む（Note.comの場合）
    const url = window.location.href;
    if (url.includes("note.com")) {
      await scrollToLoadAllContent();
    }

    const content = await extractContent(document, url);

    console.log("Content extracted:", {
      title: content.title,
      textLength: content.content ? content.content.length : 0,
      author: content.author,
      date: content.date,
      imagesCount: content.images ? content.images.length : 0,
    });

    return content;
  } catch (error) {
    console.error("Error extracting content:", error);

    try {
      const fallbackContent = {
        title: extractTitleFromDOM(),
        content: extractContentFromDOM().text,
        author: extractAuthorFromDOM(),
        date: extractDateFromDOM(),
        images: extractImagesFromDOM(),
        url: window.location.href,
        error: error.message,
      };

      console.log("Using fallback extraction");
      return fallbackContent;
    } catch (fallbackError) {
      console.error("Fallback extraction also failed:", fallbackError);
      return {
        title: "Error",
        content: `Failed to extract content: ${error.message}`,
        author: "Unknown",
        date: new Date().toISOString(),
        url: window.location.href,
        error: error.message,
      };
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request.action === "extractContent" ||
    request.action === "EXTRACT_CONTENT"
  ) {
    extractAndSendContent()
      .then((content) => {
        sendResponse({ success: true, content: content });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "extractDirectly") {
    try {
      const result = {
        title: extractTitleFromDOM(),
        content: extractContentFromDOM(),
        author: extractAuthorFromDOM(),
        date: extractDateFromDOM(),
        images: extractImagesFromDOM(),
        url: window.location.href,
      };
      sendResponse({ success: true, content: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("Content script loaded and ready");
  });
} else {
  console.log("Content script loaded and ready");
}
