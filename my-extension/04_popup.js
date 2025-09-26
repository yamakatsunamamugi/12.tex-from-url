class PopupController {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.loadSavedSettings();
    this.checkAuthStatus();
  }

  initElements() {
    this.statusEl = document.getElementById("status");
    this.authBtn = document.getElementById("authBtn");
    this.processBtn = document.getElementById("processBtn");
    this.sheetIdInput = document.getElementById("sheetId");
    this.urlRangeInput = document.getElementById("urlRange");
    this.docRangeInput = document.getElementById("docRange");
    this.progressEl = document.getElementById("progress");
    this.progressFillEl = document.getElementById("progressFill");
    this.progressTextEl = document.getElementById("progressText");
    this.resultsEl = document.getElementById("results");
  }

  initEventListeners() {
    this.authBtn.addEventListener("click", () => this.authenticate());
    this.processBtn.addEventListener("click", () => this.startProcessing());

    this.sheetIdInput.addEventListener("input", () => this.saveSettings());
    this.urlRangeInput.addEventListener("input", () => this.saveSettings());
    this.docRangeInput.addEventListener("input", () => this.saveSettings());
  }

  loadSavedSettings() {
    chrome.storage.local.get(["sheetId", "urlRange", "docRange"], (result) => {
      if (result.sheetId) this.sheetIdInput.value = result.sheetId;
      if (result.urlRange) this.urlRangeInput.value = result.urlRange;
      if (result.docRange) this.docRangeInput.value = result.docRange;
    });
  }

  saveSettings() {
    chrome.storage.local.set({
      sheetId: this.sheetIdInput.value,
      urlRange: this.urlRangeInput.value,
      docRange: this.docRangeInput.value,
    });
  }

  async checkAuthStatus() {
    chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
      if (response && response.authenticated) {
        this.setAuthenticatedStatus(true);
      } else {
        this.setAuthenticatedStatus(false);
      }
    });
  }

  setAuthenticatedStatus(isAuthenticated) {
    if (isAuthenticated) {
      this.statusEl.textContent = "認証状態: 認証済み ✓";
      this.statusEl.className = "status authenticated";
      this.authBtn.textContent = "再認証";
      this.processBtn.disabled = false;
    } else {
      this.statusEl.textContent = "認証状態: 未認証";
      this.statusEl.className = "status not-authenticated";
      this.authBtn.textContent = "認証";
      this.processBtn.disabled = true;
    }
  }

  async authenticate() {
    this.authBtn.disabled = true;
    this.authBtn.textContent = "認証中...";

    chrome.runtime.sendMessage({ action: "authenticate" }, (response) => {
      this.authBtn.disabled = false;

      if (response && response.success) {
        this.setAuthenticatedStatus(true);
        this.showMessage("認証成功！", "success");
      } else {
        this.setAuthenticatedStatus(false);
        this.showMessage(
          `認証失敗: ${response?.error || "不明なエラー"}`,
          "error",
        );
      }
    });
  }

  validateInputs() {
    if (!this.sheetIdInput.value.trim()) {
      this.showMessage("スプレッドシートIDを入力してください", "error");
      return false;
    }
    if (!this.urlRangeInput.value.trim()) {
      this.showMessage("URL列の範囲を入力してください", "error");
      return false;
    }
    if (!this.docRangeInput.value.trim()) {
      this.showMessage("ドキュメント列を入力してください", "error");
      return false;
    }
    return true;
  }

  async startProcessing() {
    if (!this.validateInputs()) return;

    this.processBtn.disabled = true;
    this.authBtn.disabled = true;
    this.processBtn.textContent = "処理中...";

    this.progressEl.style.display = "block";
    this.resultsEl.style.display = "none";
    this.resultsEl.innerHTML = "";

    const data = {
      sheetId: this.sheetIdInput.value.trim(),
      urlRange: this.urlRangeInput.value.trim(),
      docRange: this.docRangeInput.value.trim(),
    };

    chrome.runtime.sendMessage(
      { action: "processUrls", data: data },
      (response) => {
        this.processBtn.disabled = false;
        this.authBtn.disabled = false;
        this.processBtn.textContent = "処理開始";
        this.progressEl.style.display = "none";

        if (response && response.success) {
          this.displayResults(response.results);
          this.showMessage("処理完了！", "success");
        } else {
          this.showMessage(
            `エラー: ${response?.error || "不明なエラー"}`,
            "error",
          );
        }
      },
    );

    this.simulateProgress();
  }

  simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress > 90) progress = 90;

      this.progressFillEl.style.width = `${progress}%`;
      this.progressTextEl.textContent = `処理中...`;

      if (progress >= 90) {
        clearInterval(interval);
      }
    }, 500);
  }

  displayResults(results) {
    if (!results || results.length === 0) {
      this.resultsEl.innerHTML =
        '<div class="result-item">処理結果がありません</div>';
      this.resultsEl.style.display = "block";
      return;
    }

    this.resultsEl.innerHTML = "";
    results.forEach((result) => {
      const itemEl = document.createElement("div");
      itemEl.className =
        result.status === "success"
          ? "result-item result-success"
          : "result-item result-error";

      if (result.status === "success") {
        itemEl.innerHTML = `✓ <a href="${result.docUrl}" target="_blank">ドキュメント</a> - ${result.url}`;
      } else {
        itemEl.textContent = `✗ エラー: ${result.error} - ${result.url}`;
      }

      this.resultsEl.appendChild(itemEl);
    });

    this.resultsEl.style.display = "block";
    this.progressFillEl.style.width = "100%";
    this.progressTextEl.textContent = `完了: ${results.length} 件処理`;
  }

  showMessage(message, type) {
    const messageEl = document.createElement("div");
    messageEl.className = `status ${type === "success" ? "authenticated" : "not-authenticated"}`;
    messageEl.textContent = message;
    messageEl.style.marginTop = "10px";

    this.statusEl.parentNode.insertBefore(messageEl, this.statusEl.nextSibling);

    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
