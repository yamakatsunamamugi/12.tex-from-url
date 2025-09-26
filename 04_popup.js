document.addEventListener("DOMContentLoaded", initialize);

let isProcessing = false;

async function initialize() {
  await loadConfig();
  setupEventListeners();
  setupMessageListener();
}

async function loadConfig() {
  try {
    const result = await chrome.storage.local.get("config");
    if (result.config) {
      const config = result.config;

      document.getElementById("spreadsheetId").value =
        config.spreadsheetId || "";
      document.getElementById("sheetName").value = config.sheetName || "";
      document.getElementById("urlColumn").value = config.urlColumn || "A";
      document.getElementById("docUrlColumn").value =
        config.docUrlColumn || "B";
      document.getElementById("nameColumn").value = config.nameColumn || "C";
      document.getElementById("subjectColumn").value =
        config.subjectColumn || "D";
      document.getElementById("headerRow").value = config.headerRow || 1;
      document.getElementById("batchSize").value = config.batchSize || 10;
      document.getElementById("overwriteMode").checked =
        config.overwriteMode || false;
    }
  } catch (error) {
    console.error("設定の読み込みエラー:", error);
  }
}

async function saveConfig() {
  const config = {
    spreadsheetId: document.getElementById("spreadsheetId").value,
    sheetName: document.getElementById("sheetName").value,
    urlColumn: document.getElementById("urlColumn").value,
    docUrlColumn: document.getElementById("docUrlColumn").value,
    nameColumn: document.getElementById("nameColumn").value,
    subjectColumn: document.getElementById("subjectColumn").value,
    headerRow: parseInt(document.getElementById("headerRow").value),
    batchSize: parseInt(document.getElementById("batchSize").value),
    overwriteMode: document.getElementById("overwriteMode").checked,
  };

  await chrome.storage.local.set({ config });
  return config;
}

function setupEventListeners() {
  document
    .getElementById("startProcess")
    .addEventListener("click", startProcessing);
  document
    .getElementById("stopProcess")
    .addEventListener("click", stopProcessing);

  const inputs = document.querySelectorAll("input, select");
  inputs.forEach((input) => {
    input.addEventListener("change", async () => {
      await saveConfig();
    });
  });
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "PROGRESS_UPDATE":
        updateProgress(message.data);
        break;
      case "ERROR":
        showError(message.error);
        break;
      case "COMPLETE":
        showComplete(message.result);
        break;
      case "STOPPED":
        showStopped(message.message);
        break;
    }
  });
}

async function startProcessing() {
  const config = await saveConfig();

  if (!validateConfig(config)) {
    return;
  }

  isProcessing = true;
  updateUIState("processing");
  clearErrors();
  hideSuccessMessage();

  chrome.runtime.sendMessage(
    {
      action: "START_PROCESSING",
      config: config,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        showError("バックグラウンドスクリプトとの通信エラー");
        updateUIState("idle");
        isProcessing = false;
      }
    },
  );
}

function stopProcessing() {
  chrome.runtime.sendMessage(
    {
      action: "STOP_PROCESSING",
    },
    (response) => {
      if (chrome.runtime.lastError) {
        showError("処理の停止に失敗しました");
      }
    },
  );
}

function validateConfig(config) {
  const errors = [];

  if (!config.spreadsheetId) {
    errors.push("スプレッドシートIDを入力してください");
  }

  if (!config.urlColumn) {
    errors.push("URL列を選択してください");
  }

  if (!config.docUrlColumn) {
    errors.push("Doc URL列を選択してください");
  }

  if (config.urlColumn === config.docUrlColumn) {
    errors.push("URL列とDoc URL列は異なる列を選択してください");
  }

  if (config.headerRow < 0) {
    errors.push("ヘッダー行数は0以上にしてください");
  }

  if (config.batchSize < 1 || config.batchSize > 50) {
    errors.push("バッチサイズは1～50の範囲で設定してください");
  }

  if (errors.length > 0) {
    showError(errors.join("\n"));
    return false;
  }

  return true;
}

function updateUIState(state) {
  const startButton = document.getElementById("startProcess");
  const stopButton = document.getElementById("stopProcess");
  const progressSection = document.getElementById("progress");
  const currentStatus = document.getElementById("currentStatus");

  switch (state) {
    case "processing":
      startButton.disabled = true;
      stopButton.disabled = false;
      progressSection.classList.add("active");
      currentStatus.textContent = "処理中";
      break;
    case "idle":
      startButton.disabled = false;
      stopButton.disabled = true;
      currentStatus.textContent = "待機中";
      break;
    case "complete":
      startButton.disabled = false;
      stopButton.disabled = true;
      currentStatus.textContent = "完了";
      break;
    case "stopped":
      startButton.disabled = false;
      stopButton.disabled = true;
      currentStatus.textContent = "停止済み";
      break;
  }
}

function updateProgress(data) {
  const processedCount = document.getElementById("processedCount");
  const totalCount = document.getElementById("totalCount");
  const progressBar = document.getElementById("progressBar");

  processedCount.textContent = data.processed;
  totalCount.textContent = data.total;

  if (data.total > 0) {
    const percentage = (data.processed / data.total) * 100;
    progressBar.value = percentage;
  }
}

function showError(error) {
  const errorLog = document.getElementById("errorLog");
  const errorItem = document.createElement("div");
  errorItem.className = "error-item";
  errorItem.textContent = `エラー: ${error}`;
  errorLog.appendChild(errorItem);
  errorLog.classList.add("has-errors");
}

function clearErrors() {
  const errorLog = document.getElementById("errorLog");
  errorLog.innerHTML = "";
  errorLog.classList.remove("has-errors");
}

function showComplete(result) {
  updateUIState("complete");
  isProcessing = false;

  const successMessage = document.getElementById("successMessage");
  successMessage.textContent = `✅ 処理完了: ${result.processed}件を処理しました`;
  successMessage.classList.add("show");

  if (result.errors && result.errors.length > 0) {
    result.errors.forEach((error) => {
      showError(`行 ${error.row}: ${error.error}`);
    });
  }

  setTimeout(() => {
    updateUIState("idle");
  }, 3000);
}

function showStopped(message) {
  updateUIState("stopped");
  isProcessing = false;

  const successMessage = document.getElementById("successMessage");
  successMessage.textContent = `⏹ ${message}`;
  successMessage.classList.add("show");

  setTimeout(() => {
    updateUIState("idle");
    hideSuccessMessage();
  }, 3000);
}

function hideSuccessMessage() {
  const successMessage = document.getElementById("successMessage");
  successMessage.classList.remove("show");
}

window.addEventListener("unload", async () => {
  await saveConfig();
});
