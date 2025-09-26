import { getUrlsFromSheet, writeDocUrl } from "./05_sheetsApi.js";
import { createDoc } from "./06_docsApi.js";
import { extractContent } from "./07_extractor.js";

class ExtensionController {
  constructor() {
    this.accessToken = null;
    this.sheetId = null;
    this.processing = false;
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

  async processUrls(sheetId, urlRange, docRange) {
    try {
      this.processing = true;
      this.sheetId = sheetId;

      if (!this.accessToken) {
        await this.authenticate();
      }

      console.log("Fetching URLs from sheet...");
      const urls = await getUrlsFromSheet(this.accessToken, sheetId, urlRange);

      const results = [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (!url || url.trim() === "") {
          console.log(`Row ${i + 1}: Empty URL, skipping`);
          continue;
        }

        try {
          console.log(`Processing URL ${i + 1}/${urls.length}: ${url}`);

          const tab = await chrome.tabs.create({ url: url, active: false });

          await new Promise((resolve) => setTimeout(resolve, 3000));

          const content = await this.extractContentFromTab(tab.id);

          const docTitle = `Extracted: ${content.title || url}`;
          const docUrl = await createDoc(
            this.accessToken,
            docTitle,
            content.text,
          );

          const cellAddress = `${docRange}${i + 2}`;
          await writeDocUrl(this.accessToken, sheetId, cellAddress, docUrl);

          await chrome.tabs.remove(tab.id);

          results.push({
            url: url,
            docUrl: docUrl,
            status: "success",
          });
        } catch (error) {
          console.error(`Error processing URL ${url}:`, error);
          results.push({
            url: url,
            error: error.message,
            status: "failed",
          });
        }
      }

      this.processing = false;
      return results;
    } catch (error) {
      this.processing = false;
      throw error;
    }
  }

  async extractContentFromTab(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "extractContent" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.content) {
            resolve(response.content);
          } else {
            reject(new Error("Failed to extract content"));
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
}

const controller = new ExtensionController();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "authenticate") {
    controller
      .authenticate()
      .then((token) => sendResponse({ success: true, token: token }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "processUrls") {
    const { sheetId, urlRange, docRange } = request.data;
    controller
      .processUrls(sheetId, urlRange, docRange)
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
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
});
