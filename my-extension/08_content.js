import { extractContent } from "./07_extractor.js";

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
    return {
      text: mainContent.innerText || mainContent.textContent,
      html: mainContent.innerHTML,
      structure: extractStructure(mainContent),
    };
  }

  return {
    text: document.body.innerText || document.body.textContent,
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

async function extractAndSendContent() {
  try {
    await waitForPageLoad();

    const url = window.location.href;

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
