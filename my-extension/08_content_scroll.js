// スクロールして全コンテンツを取得する関数
async function scrollToLoadAllContent() {
  console.log("Starting auto-scroll to load all content...");

  let lastHeight = 0;
  let currentHeight = document.body.scrollHeight;
  let scrollAttempts = 0;
  const maxScrollAttempts = 50; // 最大50回スクロール

  while (lastHeight !== currentHeight && scrollAttempts < maxScrollAttempts) {
    // 最下部までスクロール
    window.scrollTo(0, document.body.scrollHeight);

    // コンテンツ読み込みを待機
    await new Promise((resolve) => setTimeout(resolve, 1000));

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

// Note.com専用の抽出関数（スクロール対応版）
async function extractNoteWithScroll(doc) {
  // まずスクロールして全コンテンツを読み込む
  await scrollToLoadAllContent();

  // その後、通常の抽出処理
  const selectors = {
    title: [
      "h1.o-noteContentHeader__title",
      'h1[class*="title"]',
      "article h1",
      "h1",
    ],
    content: [
      "div.note-common-styles__textnote-body",
      'div[class*="body"]',
      'article div[class*="content"]',
      "main article",
    ],
  };

  let title = "";
  for (const selector of selectors.title) {
    const element = doc.querySelector(selector);
    if (element) {
      title = element.textContent.trim();
      break;
    }
  }

  let content = "";
  for (const selector of selectors.content) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      content = Array.from(elements)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0)
        .join("\n\n");
      break;
    }
  }

  // すべてのテキストノードを取得（フォールバック）
  if (!content) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          // スクリプトやスタイルタグは除外
          if (
            node.parentElement.tagName === "SCRIPT" ||
            node.parentElement.tagName === "STYLE" ||
            node.parentElement.tagName === "NOSCRIPT"
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          // 空白のみのテキストは除外
          if (!/\S/.test(node.textContent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node.textContent.trim());
    }

    content = textNodes.join(" ");
  }

  return {
    title: title || document.title,
    content: content,
    url: window.location.href,
    extractedAt: new Date().toISOString(),
  };
}

export { scrollToLoadAllContent, extractNoteWithScroll };
