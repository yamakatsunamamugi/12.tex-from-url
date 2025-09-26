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

  async extract(url, document) {
    const domain = new URL(url).hostname;
    console.log(`Extracting content from domain: ${domain}`);

    for (const [pattern, extractor] of Object.entries(this.extractors)) {
      if (domain.includes(pattern)) {
        try {
          const result = await extractor.call(this, document, url);
          if (result && result.content) {
            console.log(`Successfully extracted using ${pattern} extractor`);
            return this.validateAndClean(result, url);
          }
        } catch (error) {
          console.warn(`Extractor failed for ${pattern}:`, error);
        }
      }
    }

    console.log("Using generic extractor");
    const genericResult = await this.extractGeneric(document, url);
    return this.validateAndClean(genericResult, url);
  }

  extractYahooNews(document) {
    const title =
      document.querySelector(
        "article header h1, h1.sc-gBOOmk, .article-header h1",
      )?.textContent || "";
    const content =
      document.querySelector(
        "div.article_body, .sc-eVJWDD, article .article-main",
      )?.textContent || "";
    const author =
      document.querySelector("span.author, .article-author")?.textContent || "";
    const dateElement = document.querySelector("time");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll("article img, .article_body img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractNHK(document) {
    const title =
      document.querySelector("h1.content--title, .content-title, h1")
        ?.textContent || "";
    const content =
      document.querySelector(".content--summary, .content--detail, .body-text")
        ?.textContent || "";
    const dateElement = document.querySelector("time, .content--date");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".content img, figure img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: "NHK",
      date: date,
      images: images,
    };
  }

  extractAsahi(document) {
    const title =
      document.querySelector("h1.Title, h1, .article-title")?.textContent || "";
    const content =
      document.querySelector(".ArticleBody, .article-body, .tk_honbun")
        ?.textContent || "";
    const author =
      document.querySelector(".Author, .writer")?.textContent || "";
    const dateElement = document.querySelector("time, .date, .updatedate");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".ArticleBody img, figure img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractYomiuri(document) {
    const title =
      document.querySelector(".article-header h1, h1.title, h1")?.textContent ||
      "";
    const content =
      document.querySelector(".article-body, .p-main-contents, .article-text")
        ?.textContent || "";
    const author =
      document.querySelector(".byline, .writer")?.textContent || "";
    const dateElement = document.querySelector("time, .date");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".article-body img, figure img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractNikkei(document) {
    const title =
      document.querySelector(".article-header h1, h1.title, h1")?.textContent ||
      "";
    const content =
      document.querySelector(".article-body, .cmn-article_text, .body")
        ?.textContent || "";
    const author =
      document.querySelector(".author, .writer")?.textContent || "";
    const dateElement = document.querySelector("time, .date-area");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".article-body img, figure img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractNote(document) {
    const title =
      document.querySelector("h1.o-noteContentHeader__title, h1, .note-title")
        ?.textContent || "";
    const content =
      document.querySelector(
        "div.note-common-styles__textnote, .p-article__content, .note-body",
      )?.textContent || "";
    const author =
      document.querySelector(
        "a.o-noteContentHeader__userNameLink, .o-noteContentHeader__name",
      )?.textContent || "";
    const dateElement = document.querySelector(
      "time, .o-noteContentHeader__publishedAt",
    );
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll("figure img, .note-embed img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractHatenaBlog(document) {
    const title =
      document.querySelector(".entry-title, h1.title, h1")?.textContent || "";
    const content =
      document.querySelector(".entry-content, .entry-body, article")
        ?.textContent || "";
    const author =
      document.querySelector(".author, .entry-author-name")?.textContent || "";
    const dateElement = document.querySelector("time, .date, .entry-date");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".entry-content img, article img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractQiita(document) {
    const title =
      document.querySelector("h1.it-Header_title, h1")?.textContent || "";
    const contentElement = document.querySelector(
      ".it-MdContent, .p-items_main",
    );
    const content = contentElement?.textContent || "";
    const author =
      document.querySelector(".it-Header_authorName, .it-Header_author")
        ?.textContent || "";
    const dateElement = document.querySelector("time, .it-Header_time");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const tags = Array.from(
      document.querySelectorAll(".it-Tags_item, .tagList_item"),
    ).map((tag) => this.cleanText(tag.textContent));

    const codeBlocks = this.extractCodeBlocks(contentElement);

    const images = Array.from(
      document.querySelectorAll(".it-MdContent img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      tags: tags,
      codeBlocks: codeBlocks,
      images: images,
    };
  }

  extractZenn(document) {
    const title =
      document.querySelector("h1, .article-title")?.textContent || "";
    const contentElement = document.querySelector(
      ".znc, .article-content, article",
    );
    const content = contentElement?.textContent || "";
    const author =
      document.querySelector(".author-name, .article-author")?.textContent ||
      "";
    const dateElement = document.querySelector("time, .article-date");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const codeBlocks = this.extractCodeBlocks(contentElement);

    const images = Array.from(
      document.querySelectorAll(".znc img, article img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      codeBlocks: codeBlocks,
      images: images,
    };
  }

  extractMedium(document) {
    const title = document.querySelector("h1, article h1")?.textContent || "";
    const content =
      document.querySelector("article section, article, main")?.textContent ||
      "";
    const author =
      document.querySelector('[data-testid="authorName"], .author-name')
        ?.textContent || "";
    const dateElement = document.querySelector(
      'time, [data-testid="storyPublishDate"]',
    );
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll("article img, figure img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(author),
      date: date,
      images: images,
    };
  }

  extractWikipedia(document) {
    const title =
      document.querySelector("h1.firstHeading, h1#firstHeading, h1")
        ?.textContent || "";
    const contentElement = document.querySelector(
      "#mw-content-text .mw-parser-output, #mw-content-text",
    );
    const content = contentElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll("#mw-content-text img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: "Wikipedia",
      date: new Date().toISOString(),
      images: images,
    };
  }

  async extractGitHub(document, url) {
    if (url.includes("/blob/") || url.includes("/tree/")) {
      const rawUrl = url
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/blob/", "/");

      try {
        const response = await fetch(rawUrl);
        const markdown = await response.text();

        return {
          title: this.extractTitleFromMarkdown(markdown),
          content: markdown,
          type: "markdown",
          isReadme: true,
          author: "GitHub",
          date: new Date().toISOString(),
        };
      } catch (error) {
        console.warn("Failed to fetch raw content:", error);
      }
    }

    const title =
      document.querySelector(".markdown-body h1, h1")?.textContent ||
      document.querySelector('[itemprop="name"] a')?.textContent ||
      "";
    const content =
      document.querySelector(
        ".markdown-body, .repository-content, .blob-wrapper",
      )?.textContent || "";
    const repository =
      document.querySelector('[itemprop="name"] a')?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".markdown-body img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      repository: repository,
      author: "GitHub",
      date: new Date().toISOString(),
      images: images,
    };
  }

  extractPRTimes(document) {
    const title =
      document.querySelector("h1.title, h1, .release-title")?.textContent || "";
    const content =
      document.querySelector(".release-body, .content, article")?.textContent ||
      "";
    const company =
      document.querySelector(".company-name, .release-company")?.textContent ||
      "";
    const dateElement = document.querySelector("time, .release-date");
    const date =
      dateElement?.getAttribute("datetime") || dateElement?.textContent || "";

    const images = Array.from(
      document.querySelectorAll(".release-body img, article img"),
    ).map((img) => ({
      src: img.src,
      alt: img.alt || "",
    }));

    return {
      title: this.cleanText(title),
      content: this.cleanText(content),
      author: this.cleanText(company),
      date: date,
      images: images,
    };
  }

  async extractGeneric(document) {
    this.removeUnwantedElements(document);
    const mainContent = this.detectMainContent(document);

    return {
      title: this.extractTitle(document),
      content: this.extractContent(mainContent || document.body),
      author: this.extractAuthor(document),
      date: this.extractDate(document),
      images: this.extractImages(document),
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
      ".social-share",
      ".cookie-notice",
    ];

    selectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
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
      ".post-content",
      ".page-content",
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

    doc.querySelectorAll("div, section, article, main").forEach((element) => {
      const score = this.calculateContentScore(element);
      if (score > maxScore) {
        maxScore = score;
        bestElement = element;
      }
    });

    return bestElement;
  }

  calculateContentScore(element) {
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

    const hints = [
      "content",
      "article",
      "main",
      "body",
      "text",
      "post",
      "entry",
    ];
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

  extractTitle(doc) {
    const titleCandidates = [
      doc.querySelector("h1"),
      doc.querySelector("article h1"),
      doc.querySelector(".title"),
      doc.querySelector('[class*="title"]'),
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      doc.querySelector("title"),
    ];

    for (const candidate of titleCandidates) {
      const text =
        typeof candidate === "string" ? candidate : candidate?.textContent;
      if (text && text.trim().length > 0) {
        return this.cleanText(text);
      }
    }

    return "無題";
  }

  extractContent(element) {
    if (!element) return "";

    const structure = this.extractStructure(element);
    const text = element.textContent || "";

    return this.cleanText(text);
  }

  extractStructure(element) {
    const structure = [];

    element
      .querySelectorAll("h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre")
      .forEach((el) => {
        structure.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent,
          level: el.tagName.startsWith("H") ? parseInt(el.tagName[1]) : 0,
        });
      });

    return structure;
  }

  extractAuthor(doc) {
    const authorCandidates = [
      doc.querySelector('[class*="author"]'),
      doc.querySelector('[class*="writer"]'),
      doc.querySelector('[class*="byline"]'),
      doc.querySelector('meta[name="author"]')?.getAttribute("content"),
      doc
        .querySelector('meta[property="article:author"]')
        ?.getAttribute("content"),
    ];

    for (const candidate of authorCandidates) {
      const text =
        typeof candidate === "string" ? candidate : candidate?.textContent;
      if (text && text.trim().length > 0) {
        return this.cleanText(text);
      }
    }

    return "不明";
  }

  extractDate(doc) {
    const dateCandidates = [
      doc.querySelector("time")?.getAttribute("datetime"),
      doc.querySelector("time")?.textContent,
      doc.querySelector('[class*="date"]')?.textContent,
      doc.querySelector('[class*="publish"]')?.textContent,
      doc
        .querySelector('meta[property="article:published_time"]')
        ?.getAttribute("content"),
    ];

    for (const candidate of dateCandidates) {
      if (candidate && candidate.trim().length > 0) {
        return this.normalizeDate(candidate);
      }
    }

    return new Date().toISOString();
  }

  extractImages(doc) {
    const images = [];
    const imgElements = doc.querySelectorAll(
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
        });
      }
    });

    return images;
  }

  extractCodeBlocks(element) {
    if (!element) return [];

    const codeBlocks = [];
    element.querySelectorAll("pre code, pre, .code-block").forEach((block) => {
      const language = block.className?.match(/language-(\w+)/)?.[1] || "text";
      codeBlocks.push({
        language: language,
        code: block.textContent,
      });
    });

    return codeBlocks;
  }

  extractTitleFromMarkdown(markdown) {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1] : "README";
  }

  cleanText(text) {
    if (!text) return "";

    text = text.replace(/\s+/g, " ").trim();
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    return text;
  }

  cleanContent(content) {
    content = this.cleanText(content);

    if (content.length < 100) {
      console.warn("Content too short:", content.length);
    }

    return content;
  }

  normalizeDate(dateStr) {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (error) {
      console.warn("Date parsing failed:", error);
    }
    return dateStr;
  }

  validateAndClean(data, url) {
    return {
      title: this.cleanText(data.title || "無題"),
      content: this.cleanContent(data.content || ""),
      author: this.cleanText(data.author || "不明"),
      date: this.normalizeDate(data.date || new Date().toISOString()),
      url: url,
      images: data.images || [],
      tags: data.tags || [],
      codeBlocks: data.codeBlocks || [],
      type: data.type || "article",
      extractedAt: new Date().toISOString(),
    };
  }
}

export class RobustExtractor {
  constructor() {
    this.extractor = new ContentExtractor();
  }

  async extractWithFallback(url, document) {
    const strategies = [
      () => this.extractViaDOM(url, document),
      () => this.extractViaContentScript(url, document),
      () => this.extractBasicInfo(url, document),
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result && result.content) {
          return result;
        }
      } catch (error) {
        console.warn(`Strategy failed: ${error.message}`);
      }
    }

    throw new Error("すべての抽出方法が失敗しました");
  }

  async extractViaDOM(url, document) {
    return await this.extractor.extract(url, document);
  }

  async extractViaContentScript(url, document) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "EXTRACT_CONTENT" },
            (response) => {
              if (response && response.content) {
                resolve(response);
              } else {
                reject(new Error("Content script extraction failed"));
              }
            },
          );
        } else {
          reject(new Error("No active tab found"));
        }
      });
    });
  }

  async extractBasicInfo(url, document) {
    const title = document.querySelector("title")?.textContent || "No title";
    const content = document.body?.textContent || "";

    return {
      title: title,
      content: content,
      author: "不明",
      date: new Date().toISOString(),
      url: url,
      images: [],
      extractedAt: new Date().toISOString(),
    };
  }
}

export function extractContent(document, url) {
  const extractor = new RobustExtractor();
  return extractor.extractWithFallback(url, document);
}
