import {
  getSheetHeaders,
  getUrlsFromColumn,
  writeDocUrl,
  getSheetInfo,
  getRowData,
} from "./05_sheetsApi_v2.js";
import { createSimpleDoc } from "./06_docsApi_simple.js";
import {
  deleteGoogleDoc,
  clearSheetCell,
  batchDeleteDocs,
} from "./06_docsApi_delete.js";

class ExtensionController {
  constructor() {
    this.accessToken = null;
    this.processing = false;
    this.shouldStop = false; // 処理停止フラグ
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error("Authentication error:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          this.accessToken = token;
          console.log("Authentication successful");
          resolve(token);
        }
      });
    });
  }

  async processUrls(sheetId, manualConfig = null) {
    try {
      this.processing = true;
      this.shouldStop = false; // 処理開始時にリセット

      if (!this.accessToken) {
        await this.authenticate();
      }

      console.log("=== Starting Sheet Processing ===");
      console.log("Sheet ID:", sheetId);

      // 1. シート構造を表示（デバッグ用）
      console.log("\n--- Getting sheet structure ---");
      await getSheetInfo(this.accessToken, sheetId);

      // 2. 列設定を取得（手動設定 or 自動検出）
      let sheetConfig;
      if (manualConfig && (manualConfig.urlColumn || manualConfig.docColumn)) {
        console.log("\n--- Using manual column configuration ---");
        console.log("Manual config:", manualConfig);

        // 手動設定を使用（列文字を数値に変換）
        sheetConfig = {
          urlColumn: manualConfig.urlColumn
            ? this.columnToIndex(manualConfig.urlColumn)
            : 0,
          docColumn: manualConfig.docColumn
            ? this.columnToIndex(manualConfig.docColumn)
            : 12, // デフォルトM列
          nameColumn:
            manualConfig.nameColumn === "HIDDEN"
              ? -2 // 非表示を示す特別な値
              : manualConfig.nameColumn
                ? this.columnToIndex(manualConfig.nameColumn)
                : -1,
          subjectColumn:
            manualConfig.subjectColumn === "HIDDEN"
              ? -2 // 非表示を示す特別な値
              : manualConfig.subjectColumn
                ? this.columnToIndex(manualConfig.subjectColumn)
                : -1,
        };
      } else {
        console.log("\n--- Auto-detecting columns from headers (Row 2) ---");
        sheetConfig = await getSheetHeaders(this.accessToken, sheetId);
      }

      console.log("Final configuration:", {
        urlColumnIndex: sheetConfig.urlColumn,
        docColumnIndex: sheetConfig.docColumn,
        nameColumnIndex: sheetConfig.nameColumn,
        subjectColumnIndex: sheetConfig.subjectColumn,
      });

      // 3. URL列からデータを取得（3行目以降）
      console.log("\n--- Fetching URLs ---");
      const urls = await getUrlsFromColumn(
        this.accessToken,
        sheetId,
        sheetConfig.urlColumn,
      );

      // 4. 処理範囲を決定
      const startRow = manualConfig?.startRow || 3;

      console.log(`\n--- Processing URLs starting from row ${startRow} ---`);
      const results = [];

      for (let i = 0; i < urls.length; i++) {
        // 停止フラグチェック
        if (this.shouldStop) {
          console.log("Processing stopped by user");
          break;
        }

        const url = urls[i];
        const rowNumber = i + startRow; // 設定された開始行から開始

        if (!url || url.trim() === "") {
          console.log(`Row ${rowNumber}: Empty URL, skipping`);
          continue;
        }

        try {
          console.log(`\nProcessing Row ${rowNumber}: ${url}`);

          // URLの検証
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            console.warn(`Row ${rowNumber}: Invalid URL format: ${url}`);
            results.push({
              row: rowNumber,
              url: url,
              error: `無効なURL形式: ${url}`,
              status: "failed",
            });
            continue;
          }

          // タブでURLを開く（アクティブで開く）
          console.log(`Opening URL in active tab...`);
          const tab = await chrome.tabs.create({ url: url, active: true });

          // ページ読み込み待機
          await this.waitForTabLoad(tab.id);

          // コンテンツを抽出
          console.log(`Extracting content from page...`);
          const content = await this.extractContentFromTab(tab.id);

          // タブを閉じる
          await chrome.tabs.remove(tab.id);

          // 行データを取得して名前と件名を取得
          const rowData = await getRowData(
            this.accessToken,
            sheetId,
            rowNumber,
          );
          const name =
            sheetConfig.nameColumn >= 0
              ? rowData[sheetConfig.nameColumn] || ""
              : sheetConfig.nameColumn === -2
                ? "" // 非表示の場合は空文字
                : "";
          const subject =
            sheetConfig.subjectColumn >= 0
              ? rowData[sheetConfig.subjectColumn] || ""
              : sheetConfig.subjectColumn === -2
                ? "" // 非表示の場合は空文字
                : "";

          // タイトル形式: 連番-名前-件名（非表示項目は除外）
          const serialNumber = rowNumber - startRow + 1;
          const titleParts = [serialNumber];
          if (sheetConfig.nameColumn !== -2 && name) titleParts.push(name);
          if (sheetConfig.subjectColumn !== -2 && subject)
            titleParts.push(subject);
          const docTitle = titleParts.join("-").trim();
          console.log(`Creating Google Doc: "${docTitle}"`);

          // コンテンツを保持（改行を維持）
          let docContent = "";
          if (content.title) {
            docContent += `タイトル: ${content.title}\n\n`;
          }
          if (content.url) {
            docContent += `URL: ${content.url}\n\n`;
          }
          if (content.content || content.text) {
            const mainContent = content.content || content.text || "";
            // 改行を保持したまま使用
            docContent += mainContent;
          } else {
            docContent += "コンテンツを抽出できませんでした。";
          }

          // リトライ機能付きでDocs作成
          let docUrl;
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries) {
            try {
              docUrl = await createSimpleDoc(
                this.accessToken,
                docTitle,
                docContent,
              );
              break; // 成功したらループを抜ける
            } catch (docError) {
              retryCount++;
              console.error(
                `Docs creation attempt ${retryCount} failed:`,
                docError,
              );
              if (retryCount >= maxRetries) {
                throw docError;
              }
              // 1秒待ってリトライ
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          // スプレッドシートに書き戻し
          console.log(`Writing Doc URL to sheet...`);
          await writeDocUrl(
            this.accessToken,
            sheetId,
            rowNumber,
            sheetConfig.docColumn,
            docUrl,
          );

          results.push({
            row: rowNumber,
            url: url,
            docUrl: docUrl,
            status: "success",
          });

          console.log(`✓ Row ${rowNumber} completed successfully`);
        } catch (error) {
          console.error(`✗ Row ${rowNumber} failed:`, error);
          console.error("Error details:", {
            message: error.message || "No message",
            stack: error.stack || "No stack",
            type: error.constructor.name,
          });

          results.push({
            row: rowNumber,
            url: url,
            error: error.message || error.toString() || "不明なエラー",
            status: "failed",
          });
        }

        // API制限対策のため少し待機
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("\n=== Processing Complete ===");
      console.log(`Processed: ${results.length} URLs`);
      console.log(
        `Success: ${results.filter((r) => r.status === "success").length}`,
      );
      console.log(
        `Failed: ${results.filter((r) => r.status === "failed").length}`,
      );

      this.processing = false;
      return results;
    } catch (error) {
      console.error("Fatal error in processUrls:", error);
      this.processing = false;
      throw error;
    }
  }

  async waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 最大5秒待機

      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.warn("Tab not found:", chrome.runtime.lastError);
            resolve();
            return;
          }

          if (tab.status === "complete") {
            // 追加で3秒待機（動的コンテンツの読み込み）
            setTimeout(resolve, 3000);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkTab, 100);
          } else {
            console.warn("Tab load timeout");
            resolve();
          }
        });
      };

      checkTab();
    });
  }

  async extractContentFromTab(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "extractContent" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Content script error:", chrome.runtime.lastError);
            reject(new Error("コンテンツの抽出に失敗しました"));
          } else if (response && response.success && response.content) {
            resolve(response.content);
          } else {
            console.warn("No content extracted, using fallback");
            // フォールバック：基本情報のみ
            chrome.tabs.get(tabId, (tab) => {
              resolve({
                title: tab.title || "無題",
                content: tab.url || "",
                url: tab.url,
              });
            });
          }
        },
      );
    });
  }

  async refreshToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token: this.accessToken }, () => {
        this.accessToken = null;
        this.authenticate().then(resolve).catch(reject);
      });
    });
  }

  // 列文字（A, B, C...）を数値インデックス（0, 1, 2...）に変換
  columnToIndex(column) {
    column = column.toUpperCase();
    let result = 0;
    for (let i = 0; i < column.length; i++) {
      result = result * 26 + (column.charCodeAt(i) - 64);
    }
    return result - 1; // 0ベースのインデックスに変換
  }
}

const controller = new ExtensionController();

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request.action);

  if (request.action === "authenticate") {
    controller
      .authenticate()
      .then((token) => sendResponse({ success: true, token: token }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "processUrls") {
    const { sheetId, manualConfig } = request.data;
    console.log("Starting processUrls with sheetId:", sheetId);
    console.log("Manual config:", manualConfig);

    controller
      .processUrls(sheetId, manualConfig)
      .then((results) => sendResponse({ success: true, results: results }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "getStatus") {
    sendResponse({
      processing: controller.processing,
      authenticated: !!controller.accessToken,
    });
    return true;
  }

  // 処理を停止
  if (request.action === "stopProcessing") {
    controller.shouldStop = true;
    console.log("Stop processing requested");
    sendResponse({ success: true });
    return true;
  }

  // Docsを削除してシートをクリア
  if (request.action === "deleteDoc") {
    const { docUrl, sheetId, row, column } = request.data;
    console.log(
      `Deleting doc: ${docUrl} and clearing cell at row ${row}, column ${column}`,
    );

    (async () => {
      try {
        // 1. Google Docsを削除
        const deleteResult = await deleteGoogleDoc(
          controller.accessToken,
          docUrl,
        );

        // 2. スプレッドシートのセルをクリア
        let clearResult = { success: false };
        if (deleteResult.success && sheetId && row && column !== undefined) {
          clearResult = await clearSheetCell(
            controller.accessToken,
            sheetId,
            row,
            column,
          );
        }

        sendResponse({
          success: deleteResult.success && clearResult.success,
          deleteResult,
          clearResult,
        });
      } catch (error) {
        console.error("Error in deleteDoc:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 複数のDocsを一括削除
  if (request.action === "batchDeleteDocs") {
    const { docUrls } = request.data;
    console.log(`Batch deleting ${docUrls.length} documents`);

    batchDeleteDocs(controller.accessToken, docUrls)
      .then((results) => sendResponse({ success: true, results }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 3行目以降のすべてのドキュメントを削除
  if (request.action === "deleteAllDocs") {
    const { sheetId } = request.data;
    console.log(
      `Deleting all documents from row 3 onwards in sheet: ${sheetId}`,
    );

    (async () => {
      try {
        // 1. まずヘッダーを取得して列を特定
        const sheetConfig = await getSheetHeaders(
          controller.accessToken,
          sheetId,
        );
        console.log("Doc column index:", sheetConfig.docColumn);

        // 2. ドキュメント列（M列）からすべてのURLを取得（3行目以降）
        const columnLetter = String.fromCharCode(65 + sheetConfig.docColumn); // M列
        const range = `${columnLetter}3:${columnLetter}1000`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${controller.accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to get document URLs: ${response.status}`);
        }

        const data = await response.json();
        const docUrls = data.values
          ? data.values.map((row) => row[0]).filter((url) => url && url.trim())
          : [];

        console.log(`Found ${docUrls.length} documents to delete`);

        // 3. 各ドキュメントを削除
        const results = [];
        for (let i = 0; i < docUrls.length; i++) {
          const docUrl = docUrls[i];
          const rowNumber = i + 3; // 3行目から開始

          try {
            // Docsを削除
            const deleteResult = await deleteGoogleDoc(
              controller.accessToken,
              docUrl,
            );

            // セルをクリア
            if (deleteResult.success) {
              await clearSheetCell(
                controller.accessToken,
                sheetId,
                rowNumber,
                sheetConfig.docColumn,
              );
            }

            results.push({
              row: rowNumber,
              url: docUrl,
              success: deleteResult.success,
              error: deleteResult.error,
            });

            console.log(
              `Row ${rowNumber}: ${deleteResult.success ? "✓" : "✗"}`,
            );
          } catch (error) {
            results.push({
              row: rowNumber,
              url: docUrl,
              success: false,
              error: error.message,
            });
          }

          // API制限対策
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        sendResponse({ success: true, results });
      } catch (error) {
        console.error("Error in deleteAllDocs:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 新しいウィンドウでポップアップを開く
  if (request.action === "openInNewWindow") {
    console.log("Opening popup in new window...");
    const popupUrl = chrome.runtime.getURL("popup.html");

    chrome.windows.create(
      {
        url: popupUrl,
        type: "popup",
        width: 500,
        height: 700,
        focused: true,
      },
      (window) => {
        if (chrome.runtime.lastError) {
          console.error("Error creating window:", chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("Window created successfully:", window);
          sendResponse({ success: true, windowId: window.id });
        }
      },
    );
    return true; // 非同期レスポンスのため
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated - v2 with header detection");
});

// 拡張機能アイコンがクリックされた時、独立ウィンドウで開く
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked, opening popup in new window");
  const popupUrl = chrome.runtime.getURL("popup.html");

  chrome.windows.create(
    {
      url: popupUrl,
      type: "popup",
      width: 500,
      height: 700,
      focused: true,
    },
    (window) => {
      if (chrome.runtime.lastError) {
        console.error("Error creating window:", chrome.runtime.lastError);
      } else {
        console.log("Popup window created successfully:", window);
      }
    },
  );
});
