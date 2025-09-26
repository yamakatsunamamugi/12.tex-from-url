let isProcessing = false;
let abortController = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_PROCESSING") {
    startProcessing(message.config);
    sendResponse({ success: true });
  } else if (message.action === "STOP_PROCESSING") {
    stopProcessing();
    sendResponse({ success: true });
  }
  return true;
});

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function startProcessing(config) {
  if (isProcessing) {
    sendMessageToPopup({
      type: "ERROR",
      error: "処理は既に実行中です",
    });
    return;
  }

  isProcessing = true;
  abortController = new AbortController();

  try {
    const token = await getAuthToken();
    await processUrls(config, token);
  } catch (error) {
    if (error.name !== "AbortError") {
      sendMessageToPopup({
        type: "ERROR",
        error: error.message,
      });
    }
  } finally {
    isProcessing = false;
    abortController = null;
  }
}

function stopProcessing() {
  if (abortController) {
    abortController.abort();
    sendMessageToPopup({
      type: "STOPPED",
      message: "処理を停止しました",
    });
  }
}

async function processUrls(config, token) {
  let processed = 0;
  const errors = [];

  try {
    const urls = await readUrlsFromSheet(config, token);

    sendMessageToPopup({
      type: "PROGRESS_UPDATE",
      data: { total: urls.length, processed: 0 },
    });

    for (let i = 0; i < urls.length; i += config.batchSize) {
      if (abortController?.signal.aborted) {
        throw new Error("処理が中断されました");
      }

      const batch = urls.slice(i, i + config.batchSize);
      const results = [];

      for (const item of batch) {
        if (abortController?.signal.aborted) {
          throw new Error("処理が中断されました");
        }

        try {
          if (item.existingDocUrl && !config.overwriteMode) {
            results.push({
              row: item.row,
              status: "skipped",
              reason: "既存のドキュメントあり",
            });
            continue;
          }

          const content = await extractContent(item.url);
          const docName = generateDocumentName(processed + 1, item);
          const docUrl = await createGoogleDoc(content, docName, token);

          results.push({
            row: item.row,
            docUrl: docUrl,
            status: "success",
          });
        } catch (error) {
          console.error(`Error processing row ${item.row}:`, error);
          errors.push({ row: item.row, error: error.message });
          results.push({
            row: item.row,
            status: "error",
            error: error.message,
          });
        }

        processed++;
        sendMessageToPopup({
          type: "PROGRESS_UPDATE",
          data: { total: urls.length, processed },
        });
      }

      await writeResultsToSheet(config, results, token);

      await sleep(1000);
    }

    sendMessageToPopup({
      type: "COMPLETE",
      result: { processed, errors },
    });
  } catch (error) {
    throw error;
  }
}

async function readUrlsFromSheet(config, token) {
  const range = config.sheetName
    ? `${config.sheetName}!${config.urlColumn}:${config.subjectColumn}`
    : `${config.urlColumn}:${config.subjectColumn}`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}`;

  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  const values = data.values || [];

  const urls = [];
  for (let i = config.headerRow; i < values.length; i++) {
    const row = values[i];
    if (row && row[columnToIndex(config.urlColumn)]) {
      urls.push({
        row: i + 1,
        url: row[columnToIndex(config.urlColumn)],
        existingDocUrl: row[columnToIndex(config.docUrlColumn)] || "",
        name: row[columnToIndex(config.nameColumn)] || "",
        subject: row[columnToIndex(config.subjectColumn)] || "",
      });
    }
  }

  return urls;
}

async function writeResultsToSheet(config, results, token) {
  const updates = results
    .filter((r) => r.status === "success")
    .map((r) => ({
      range: `${config.sheetName ? config.sheetName + "!" : ""}${config.docUrlColumn}${r.row}`,
      values: [[r.docUrl]],
    }));

  if (updates.length === 0) return;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values:batchUpdate`;

  await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: updates,
    }),
  });
}

async function extractContent(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title = doc.querySelector("title")?.textContent || "No Title";

    const contentSelectors = [
      "main",
      "article",
      '[role="main"]',
      ".content",
      "#content",
    ];

    let content = "";
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        content = element.textContent;
        break;
      }
    }

    if (!content) {
      content = doc.body?.textContent || "";
    }

    content = content.replace(/\s+/g, " ").trim();

    return {
      title: title,
      content: content.substring(0, 10000),
      url: url,
    };
  } catch (error) {
    throw new Error(`コンテンツ抽出エラー: ${error.message}`);
  }
}

async function createGoogleDoc(content, docName, token) {
  const createUrl = "https://docs.googleapis.com/v1/documents";

  const createResponse = await fetchWithRetry(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: docName,
    }),
  });

  const doc = await createResponse.json();
  const documentId = doc.documentId;

  const updateUrl = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: `タイトル: ${content.title}\n\nURL: ${content.url}\n\n内容:\n${content.content}`,
      },
    },
  ];

  await fetchWithRetry(updateUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  return `https://docs.google.com/document/d/${documentId}/edit`;
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        await sleep(delay);
        continue;
      }

      if (response.status === 401) {
        const token = await getAuthToken();
        options.headers["Authorization"] = `Bearer ${token}`;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await sleep(1000);
      }
    }
  }

  throw lastError;
}

function generateDocumentName(index, item) {
  const parts = [index.toString()];
  if (item.name) parts.push(item.name);
  if (item.subject) parts.push(item.subject);
  return parts.join("_");
}

function columnToIndex(column) {
  const letters = column.toUpperCase();
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - "A".charCodeAt(0));
  }
  return index;
}

function sendMessageToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    console.log("Popup is not open");
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
