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
    this.stopBtn = document.getElementById("stopBtn");
    this.deleteBtn = document.getElementById("deleteBtn");
    this.sheetUrlInput = document.getElementById("sheetUrl");
    this.progressEl = document.getElementById("progress");
    this.progressFillEl = document.getElementById("progressFill");
    this.progressTextEl = document.getElementById("progressText");
    this.errorMessageEl = document.getElementById("errorMessage");
    this.successMessageEl = document.getElementById("successMessage");
    this.saveBtn = document.getElementById("saveBtn");
    this.editSavedBtn = document.getElementById("editSavedBtn");
    this.openLinkBtn = document.getElementById("openLinkBtn");

    // 重要な要素の存在確認とデバッグ
    console.log("要素取得結果:");
    console.log("saveBtn:", this.saveBtn);
    console.log("editSavedBtn:", this.editSavedBtn);
    console.log("openLinkBtn:", this.openLinkBtn);

    if (!this.saveBtn) {
      console.error("保存ボタン要素が見つかりません");
    }
    if (!this.editSavedBtn) {
      console.error("保存済み編集ボタン要素が見つかりません");
    }
    if (!this.openLinkBtn) {
      console.error("リンクを開くボタン要素が見つかりません");
    }

    // 詳細設定の要素
    this.urlColumnInput = document.getElementById("urlColumn");
    this.docColumnInput = document.getElementById("docColumn");
    this.nameColumnInput = document.getElementById("nameColumn");
    this.subjectColumnInput = document.getElementById("subjectColumn");
    this.startRowInput = document.getElementById("startRow");
  }

  initEventListeners() {
    // 認証ボタン
    this.authBtn.addEventListener("click", () => this.authenticate());

    // 処理開始ボタン
    this.processBtn.addEventListener("click", () => this.startProcessing());

    // 削除ボタン
    if (this.deleteBtn) {
      this.deleteBtn.addEventListener("click", () => this.startDeleteProcess());
    }

    // 停止ボタン
    if (this.stopBtn) {
      this.stopBtn.addEventListener("click", () => this.stopProcessing());
    }

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
    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => {
        console.log("保存ボタンがクリックされました");
        this.saveCurrentUrl();
      });
      console.log("保存ボタンのイベントリスナーを設定しました");
    } else {
      console.error(
        "保存ボタンが見つからないため、イベントリスナーを設定できません",
      );
    }

    // 保存済み編集ボタン
    if (this.editSavedBtn) {
      this.editSavedBtn.addEventListener("click", () => {
        console.log("保存済み編集ボタンがクリックされました");
        this.editSavedUrls();
      });
    } else {
      console.error(
        "保存済み編集ボタンが見つからないため、イベントリスナーを設定できません",
      );
    }

    // リンクを開くボタン
    if (this.openLinkBtn) {
      this.openLinkBtn.addEventListener("click", () => {
        console.log("リンクを開くボタンがクリックされました");
        this.openCurrentLink();
      });
    } else {
      console.error(
        "リンクを開くボタンが見つからないため、イベントリスナーを設定できません",
      );
    }

    // 詳細設定フィールドの変更監視
    [
      this.urlColumnInput,
      this.docColumnInput,
      this.nameColumnInput,
      this.subjectColumnInput,
      this.startRowInput,
    ].forEach((input) => {
      if (input) {
        input.addEventListener("change", () => this.saveSettings());
      }
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
      this.deleteBtn.disabled = !this.sheetUrlInput.value.trim();
    } else {
      this.statusEl.textContent = "認証状態: 未認証";
      this.statusEl.className = "status not-authenticated";
      this.authBtn.textContent = "Googleでログイン";
      this.processBtn.disabled = true;
      this.deleteBtn.disabled = true;
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
    this.deleteBtn.disabled = true;
    this.processBtn.textContent = "処理中...";

    // 停止ボタンを表示（デバッグログ付き）
    console.log("停止ボタン要素:", this.stopBtn);
    if (this.stopBtn) {
      this.stopBtn.style.display = "inline-block";
      this.stopBtn.disabled = false;
      console.log("停止ボタンを表示しました");
    } else {
      console.error("停止ボタン要素が見つかりません");
    }
    this.progressEl.classList.add("active");
    this.updateProgress(0, "準備中...");

    // 処理データの準備（手動設定 + 自動検出）
    const data = {
      sheetId: sheetId,
      // 手動設定（空の場合は自動検出）
      manualConfig: {
        urlColumn: this.urlColumnInput?.value.trim() || null,
        docColumn: this.docColumnInput?.value.trim() || null,
        nameColumn: this.nameColumnInput?.value.trim() || null,
        subjectColumn: this.subjectColumnInput?.value.trim() || null,
        startRow: parseInt(this.startRowInput?.value || "3"),
      },
    };

    // バックグラウンドに処理を依頼
    chrome.runtime.sendMessage(
      { action: "processUrls", data: data },
      (response) => {
        this.processing = false;
        this.processBtn.disabled = false;
        this.authBtn.disabled = false;
        this.deleteBtn.disabled = false;
        this.processBtn.textContent = "処理開始";

        // 停止ボタンを非表示（デバッグログ付き）
        if (this.stopBtn) {
          this.stopBtn.style.display = "none";
          this.stopBtn.disabled = true;
          console.log("停止ボタンを非表示にしました");
        }

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
      // 詳細設定
      urlColumn: this.urlColumnInput?.value || "",
      docColumn: this.docColumnInput?.value || "",
      nameColumn: this.nameColumnInput?.value || "",
      subjectColumn: this.subjectColumnInput?.value || "",
      startRow: parseInt(this.startRowInput?.value || "3"),
    };
    chrome.storage.local.set({ settings });
  }

  loadSettings() {
    chrome.storage.local.get("settings", (result) => {
      if (result.settings) {
        this.sheetUrlInput.value = result.settings.sheetUrl || "";

        // 詳細設定の読み込み
        if (this.urlColumnInput)
          this.urlColumnInput.value = result.settings.urlColumn || "";
        if (this.docColumnInput)
          this.docColumnInput.value = result.settings.docColumn || "";
        if (this.nameColumnInput)
          this.nameColumnInput.value = result.settings.nameColumn || "";
        if (this.subjectColumnInput)
          this.subjectColumnInput.value = result.settings.subjectColumn || "";
        if (this.startRowInput)
          this.startRowInput.value = result.settings.startRow || "3";

        // URL検証
        this.validateAndExtractId();
      }
    });
  }

  saveCurrentUrl() {
    console.log("saveCurrentUrl関数が呼び出されました");

    const url = this.sheetUrlInput.value.trim();
    console.log("取得したURL:", url);

    if (!url) {
      console.log("URLが空のため、エラーメッセージを表示");
      this.showError("URLを入力してください");
      return;
    }

    console.log("Chrome storage APIでsavedUrlsを取得中...");
    chrome.storage.local.get("savedUrls", (result) => {
      console.log("Chrome storage結果:", result);

      const savedUrls = result.savedUrls || [];
      console.log("現在の保存済みURLリスト:", savedUrls);

      if (!savedUrls.includes(url)) {
        console.log("新しいURLを追加中...");
        savedUrls.push(url);

        chrome.storage.local.set({ savedUrls }, () => {
          console.log("URL保存完了");
          this.showSuccess("URLを保存しました");
        });
      } else {
        console.log("URLは既に保存済み");
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

  async startDeleteProcess() {
    const sheetId = this.validateAndExtractId();
    if (!sheetId) {
      this.showError("有効なスプレッドシートURLを入力してください");
      return;
    }

    // 確認なしで3行目以降のドキュメントをすべて削除
    this.deleteBtn.disabled = true;
    this.deleteBtn.textContent = "削除中...";
    this.progressEl.classList.add("active");
    this.updateProgress(0, "ドキュメントを削除中...");

    chrome.runtime.sendMessage(
      {
        action: "deleteAllDocs",
        data: { sheetId: sheetId },
      },
      (response) => {
        this.deleteBtn.disabled = false;
        this.deleteBtn.textContent = "🗑️ 3行目以降を全削除";
        this.progressEl.classList.remove("active");

        if (response && response.success) {
          const deletedCount =
            response.results?.filter((r) => r.success).length || 0;
          const failedCount =
            response.results?.filter((r) => !r.success).length || 0;

          let message = `削除完了: ${deletedCount}件のドキュメントを削除`;
          if (failedCount > 0) {
            message += `、${failedCount}件失敗`;
          }
          this.showSuccess(message);
        } else {
          this.showError(`削除失敗: ${response?.error || "不明なエラー"}`);
        }
      },
    );
  }

  stopProcessing() {
    chrome.runtime.sendMessage({ action: "stopProcessing" }, (response) => {
      if (response && response.success) {
        this.showSuccess("処理停止を要求しました");
        this.stopBtn.disabled = true;
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
