class SimplePopupController {
  constructor() {
    this.authenticated = false;
    this.processing = false;
    this.initElements();
    this.initEventListeners();
    this.checkAuthStatus();
    this.loadSettings();
  }

  initElements() {
    this.statusEl = document.getElementById("status");
    this.authBtn = document.getElementById("authBtn");
    this.processBtn = document.getElementById("processBtn");
    this.sheetUrlInput = document.getElementById("sheetUrl");
    this.progressEl = document.getElementById("progress");
    this.progressFillEl = document.getElementById("progressFill");
    this.progressTextEl = document.getElementById("progressText");
    this.errorMessageEl = document.getElementById("errorMessage");
    this.successMessageEl = document.getElementById("successMessage");
    this.advancedToggle = document.getElementById("advancedToggle");
    this.advancedContent = document.getElementById("advancedContent");
    this.toggleIcon = document.getElementById("toggleIcon");
    this.saveBtn = document.getElementById("saveBtn");
    this.editSavedBtn = document.getElementById("editSavedBtn");
    this.openLinkBtn = document.getElementById("openLinkBtn");
  }

  initEventListeners() {
    // 認証ボタン
    this.authBtn.addEventListener("click", () => this.authenticate());

    // 処理開始ボタン
    this.processBtn.addEventListener("click", () => this.startProcessing());

    // URL入力の監視
    this.sheetUrlInput.addEventListener("input", () => {
      this.validateAndExtractId();
      this.saveSettings();
    });

    // URLフィールドにペースト時
    this.sheetUrlInput.addEventListener("paste", (e) => {
      setTimeout(() => {
        this.validateAndExtractId();
        this.saveSettings();
      }, 10);
    });

    // 保存ボタン
    this.saveBtn.addEventListener("click", () => this.saveCurrentUrl());

    // 保存済み編集ボタン
    this.editSavedBtn.addEventListener("click", () => this.editSavedUrls());

    // リンクを開くボタン
    this.openLinkBtn.addEventListener("click", () => this.openCurrentLink());

    // 詳細設定の開閉
    this.advancedToggle.addEventListener("click", () => {
      this.advancedContent.classList.toggle("show");
      this.toggleIcon.textContent = this.advancedContent.classList.contains(
        "show",
      )
        ? "▲"
        : "▼";
    });
  }

  validateAndExtractId() {
    const url = this.sheetUrlInput.value.trim();

    if (!url) {
      this.sheetUrlInput.classList.remove("valid", "invalid");
      this.processBtn.disabled = !this.authenticated;
      return null;
    }

    // GoogleスプレッドシートのURLかチェック
    if (url.includes("docs.google.com/spreadsheets")) {
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        this.sheetUrlInput.classList.add("valid");
        this.sheetUrlInput.classList.remove("invalid");
        this.processBtn.disabled = !this.authenticated;
        return match[1];
      }
    }

    this.sheetUrlInput.classList.add("invalid");
    this.sheetUrlInput.classList.remove("valid");
    this.processBtn.disabled = true;
    return null;
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
    this.authenticated = isAuthenticated;

    if (isAuthenticated) {
      this.statusEl.textContent = "認証状態: 認証済み ✓";
      this.statusEl.className = "status authenticated";
      this.authBtn.textContent = "再認証";
      this.processBtn.disabled = !this.sheetUrlInput.value.trim();
    } else {
      this.statusEl.textContent = "認証状態: 未認証";
      this.statusEl.className = "status not-authenticated";
      this.authBtn.textContent = "Googleでログイン";
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
        this.showSuccess("認証成功！処理を開始できます。");
      } else {
        this.setAuthenticatedStatus(false);
        this.showError(`認証失敗: ${response?.error || "不明なエラー"}`);
      }
    });
  }

  async startProcessing() {
    // URL検証とID抽出
    const sheetId = this.validateAndExtractId();
    if (!sheetId) {
      this.showError("有効なスプレッドシートURLを入力してください");
      return;
    }

    // UIを処理中状態に
    this.processing = true;
    this.processBtn.disabled = true;
    this.authBtn.disabled = true;
    this.processBtn.textContent = "処理中...";
    this.progressEl.classList.add("active");
    this.updateProgress(0, "準備中...");

    // 処理データの準備 - v2では列の範囲指定は不要（自動検出される）
    const data = {
      sheetId: sheetId,
    };

    // バックグラウンドに処理を依頼
    chrome.runtime.sendMessage(
      { action: "processUrls", data: data },
      (response) => {
        this.processing = false;
        this.processBtn.disabled = false;
        this.authBtn.disabled = false;
        this.processBtn.textContent = "処理開始";

        if (response && response.success) {
          this.updateProgress(100, "完了！");
          this.showSuccess(
            `処理完了: ${response.results?.length || 0}件のURLを変換しました`,
          );

          // 3秒後に進捗バーを非表示
          setTimeout(() => {
            this.progressEl.classList.remove("active");
          }, 3000);
        } else {
          this.progressEl.classList.remove("active");
          this.showError(`エラー: ${response?.error || "処理に失敗しました"}`);
        }
      },
    );

    // 進捗のシミュレーション
    this.simulateProgress();
  }

  simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      if (!this.processing) {
        clearInterval(interval);
        return;
      }

      progress += Math.random() * 10;
      if (progress > 90) progress = 90;

      this.updateProgress(progress, "処理中...");
    }, 1000);
  }

  updateProgress(percentage, text) {
    this.progressFillEl.style.width = `${percentage}%`;
    this.progressTextEl.textContent = text;
  }

  showError(message) {
    this.errorMessageEl.textContent = message;
    this.errorMessageEl.classList.add("show");
    this.successMessageEl.classList.remove("show");

    setTimeout(() => {
      this.errorMessageEl.classList.remove("show");
    }, 5000);
  }

  showSuccess(message) {
    this.successMessageEl.textContent = message;
    this.successMessageEl.classList.add("show");
    this.errorMessageEl.classList.remove("show");

    setTimeout(() => {
      this.successMessageEl.classList.remove("show");
    }, 5000);
  }

  saveSettings() {
    const sheetId = this.validateAndExtractId();
    const settings = {
      sheetUrl: this.sheetUrlInput.value,
      sheetId: sheetId,
    };
    chrome.storage.local.set({ settings });
  }

  loadSettings() {
    chrome.storage.local.get("settings", (result) => {
      if (result.settings) {
        this.sheetUrlInput.value = result.settings.sheetUrl || "";

        // URL検証
        this.validateAndExtractId();
      }
    });
  }

  saveCurrentUrl() {
    const url = this.sheetUrlInput.value.trim();
    if (!url) {
      this.showError("URLを入力してください");
      return;
    }

    chrome.storage.local.get("savedUrls", (result) => {
      const savedUrls = result.savedUrls || [];
      if (!savedUrls.includes(url)) {
        savedUrls.push(url);
        chrome.storage.local.set({ savedUrls }, () => {
          this.showSuccess("URLを保存しました");
        });
      } else {
        this.showError("このURLは既に保存済みです");
      }
    });
  }

  editSavedUrls() {
    chrome.storage.local.get("savedUrls", (result) => {
      const savedUrls = result.savedUrls || [];
      if (savedUrls.length === 0) {
        this.showError("保存済みURLがありません");
        return;
      }

      // 保存済みURLリストを表示して選択できるようにする
      const selectedUrl = prompt(
        "保存済みURLリスト:\n\n" +
          savedUrls.join("\n") +
          "\n\n削除するURLの番号を入力 (1-" +
          savedUrls.length +
          ")、または空白で選択:",
      );

      if (selectedUrl && !isNaN(selectedUrl)) {
        const index = parseInt(selectedUrl) - 1;
        if (index >= 0 && index < savedUrls.length) {
          if (confirm(`以下のURLを削除しますか？\n${savedUrls[index]}`)) {
            savedUrls.splice(index, 1);
            chrome.storage.local.set({ savedUrls }, () => {
              this.showSuccess("URLを削除しました");
            });
          }
        } else {
          this.showError("無効な番号です");
        }
      } else if (!selectedUrl) {
        // URLリストから選択
        const urlIndex = prompt(
          "使用するURLの番号を入力 (1-" + savedUrls.length + "):",
        );
        if (urlIndex && !isNaN(urlIndex)) {
          const index = parseInt(urlIndex) - 1;
          if (index >= 0 && index < savedUrls.length) {
            this.sheetUrlInput.value = savedUrls[index];
            this.validateAndExtractId();
            this.saveSettings();
            this.showSuccess("URLを読み込みました");
          } else {
            this.showError("無効な番号です");
          }
        }
      }
    });
  }

  openCurrentLink() {
    const url = this.sheetUrlInput.value.trim();
    if (!url) {
      this.showError("URLを入力してください");
      return;
    }

    if (url.includes("docs.google.com/spreadsheets")) {
      chrome.tabs.create({ url: url });
    } else {
      this.showError("有効なGoogleスプレッドシートURLではありません");
    }
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  new SimplePopupController();
});
