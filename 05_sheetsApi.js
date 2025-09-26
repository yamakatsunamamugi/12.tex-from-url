/**
 * Google Sheets API操作モジュール
 * URLの読み取りとドキュメントURLの書き戻し
 */

class SheetsApi {
  constructor() {
    this.baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
    this.retryCount = 3;
    this.retryDelay = 1000;
    this.apiCallInterval = 100;
    this.lastApiCall = 0;
  }

  /**
   * 列名（A,B,C...）を配列インデックスに変換
   * @param {string} column - 列名
   * @returns {number} - 配列インデックス
   */
  columnToIndex(column) {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
      index = index * 26 + column.charCodeAt(i) - 64;
    }
    return index - 1;
  }

  /**
   * API呼び出しの間隔を確保
   */
  async ensureApiInterval() {
    const now = Date.now();
    const elapsed = now - this.lastApiCall;
    if (elapsed < this.apiCallInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.apiCallInterval - elapsed),
      );
    }
    this.lastApiCall = Date.now();
  }

  /**
   * APIリクエストのエラーハンドリングとリトライ
   * @param {Function} apiCall - API呼び出し関数
   * @param {number} retries - リトライ回数
   */
  async executeWithRetry(apiCall, retries = this.retryCount) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.ensureApiInterval();
        return await apiCall();
      } catch (error) {
        if (error.status === 429) {
          // API制限エラー：指数バックオフで待機
          const delay = this.retryDelay * Math.pow(2, i);
          console.log(`API制限に達しました。${delay}ms後に再試行...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (
          error.status >= 500 ||
          error.message?.includes("ネットワーク")
        ) {
          // サーバーエラーまたはネットワークエラー
          if (i < retries - 1) {
            console.log(
              `エラーが発生しました。再試行 ${i + 1}/${retries - 1}...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, this.retryDelay),
            );
          } else {
            throw error;
          }
        } else {
          // その他のエラーは即座に投げる
          throw error;
        }
      }
    }
  }

  /**
   * スプレッドシートの検証
   * @param {Object} config - 設定パラメータ
   * @param {string} token - 認証トークン
   * @returns {Object} - 検証結果
   */
  async validateSheet(config, token) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // スプレッドシートの存在確認
      const response = await this.executeWithRetry(async () => {
        const res = await fetch(`${this.baseUrl}/${config.spreadsheetId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const error = await res.json();
          throw { status: res.status, ...error };
        }
        return res.json();
      });

      // シートの存在確認
      const sheets = response.sheets || [];
      let targetSheet = null;

      if (config.sheetName) {
        targetSheet = sheets.find(
          (s) => s.properties.title === config.sheetName,
        );
        if (!targetSheet) {
          validation.isValid = false;
          validation.errors.push(
            `シート "${config.sheetName}" が見つかりません`,
          );
        }
      } else {
        targetSheet = sheets[0];
        if (!targetSheet) {
          validation.isValid = false;
          validation.errors.push("スプレッドシートにシートがありません");
        } else {
          validation.warnings.push(
            `シート名が指定されていないため、最初のシート "${targetSheet.properties.title}" を使用します`,
          );
        }
      }

      // 列の妥当性チェック
      const columns = [
        config.urlColumn,
        config.docUrlColumn,
        config.nameColumn,
        config.subjectColumn,
      ];
      const invalidColumns = columns.filter(
        (col) => col && !/^[A-Z]+$/i.test(col),
      );

      if (invalidColumns.length > 0) {
        validation.isValid = false;
        validation.errors.push(`無効な列指定: ${invalidColumns.join(", ")}`);
      }

      // ヘッダー行の妥当性チェック
      if (config.headerRow < 1) {
        validation.isValid = false;
        validation.errors.push("ヘッダー行は1以上である必要があります");
      }

      // バッチサイズの妥当性チェック
      if (config.batchSize < 1 || config.batchSize > 100) {
        validation.warnings.push("バッチサイズは1-100の範囲が推奨されます");
      }
    } catch (error) {
      validation.isValid = false;
      if (error.status === 404) {
        validation.errors.push("スプレッドシートが見つかりません");
      } else if (error.status === 403) {
        validation.errors.push("スプレッドシートへのアクセス権限がありません");
      } else {
        validation.errors.push(
          `検証エラー: ${error.message || JSON.stringify(error)}`,
        );
      }
    }

    return validation;
  }

  /**
   * スプレッドシートからURLを読み取り
   * @param {Object} config - 設定パラメータ
   * @param {string} token - 認証トークン
   * @returns {Array} - URL情報の配列
   */
  async readUrls(config, token) {
    const sheetName = config.sheetName || "Sheet1";
    const startRow = config.headerRow + 1;

    // 読み取り範囲を構築
    const ranges = [];
    const columns = [
      { key: "url", column: config.urlColumn },
      { key: "docUrl", column: config.docUrlColumn },
      { key: "name", column: config.nameColumn },
      { key: "subject", column: config.subjectColumn },
    ].filter((c) => c.column);

    // 各列の範囲を追加
    columns.forEach((col) => {
      ranges.push(`${sheetName}!${col.column}${startRow}:${col.column}`);
    });

    try {
      // バッチ取得APIを使用
      const response = await this.executeWithRetry(async () => {
        const params = new URLSearchParams({
          ranges: ranges,
          majorDimension: "COLUMNS",
        });

        const res = await fetch(
          `${this.baseUrl}/${config.spreadsheetId}/values:batchGet?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          const error = await res.json();
          throw { status: res.status, ...error };
        }
        return res.json();
      });

      // データを整形
      const columnData = {};
      columns.forEach((col, index) => {
        const values = response.valueRanges?.[index]?.values?.[0] || [];
        columnData[col.key] = values;
      });

      // 最大行数を取得
      const maxRows = Math.max(
        ...Object.values(columnData).map((arr) => arr.length),
        0,
      );

      // 結果配列を構築
      const results = [];
      for (let i = 0; i < Math.min(maxRows, config.batchSize || maxRows); i++) {
        const row = startRow + i;
        const url = columnData.url?.[i] || "";
        const existingDocUrl = columnData.docUrl?.[i] || "";

        // URL形式の検証
        const isValidUrl = this.validateUrl(url);

        results.push({
          row: row,
          url: url,
          name: columnData.name?.[i] || "",
          subject: columnData.subject?.[i] || "",
          existingDocUrl: existingDocUrl,
          shouldProcess: isValidUrl && !existingDocUrl,
          isValidUrl: isValidUrl,
        });
      }

      return results;
    } catch (error) {
      console.error("URL読み取りエラー:", error);
      throw new Error(
        `スプレッドシートからの読み取りに失敗しました: ${error.message || JSON.stringify(error)}`,
      );
    }
  }

  /**
   * URL形式の検証
   * @param {string} url - 検証するURL
   * @returns {boolean} - URLが有効かどうか
   */
  validateUrl(url) {
    if (!url || typeof url !== "string") return false;

    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * ドキュメントURLをスプレッドシートに書き戻し
   * @param {Object} config - 設定パラメータ
   * @param {Array} results - 書き込むデータ
   * @param {string} token - 認証トークン
   * @returns {Object} - 書き込み結果
   */
  async writeDocUrls(config, results, token) {
    if (!results || results.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const sheetName = config.sheetName || "Sheet1";
    const docUrlColumn = config.docUrlColumn;

    // バッチ更新用のデータを構築
    const data = [];
    let skippedCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.status === "error") {
        errorCount++;
        continue;
      }

      if (result.status === "skipped") {
        skippedCount++;
        continue;
      }

      if (result.docUrl) {
        data.push({
          range: `${sheetName}!${docUrlColumn}${result.row}`,
          values: [[result.docUrl]],
        });
      }
    }

    if (data.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        skippedCount: skippedCount,
        errorCount: errorCount,
      };
    }

    try {
      // 既存データの確認（上書き防止）
      const checkRanges = data.map((d) => d.range);
      const checkResponse = await this.executeWithRetry(async () => {
        const params = new URLSearchParams({
          ranges: checkRanges,
        });

        const res = await fetch(
          `${this.baseUrl}/${config.spreadsheetId}/values:batchGet?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          const error = await res.json();
          throw { status: res.status, ...error };
        }
        return res.json();
      });

      // 既存データがある場合の処理
      const overwriteWarnings = [];
      checkResponse.valueRanges?.forEach((range, index) => {
        if (range.values?.[0]?.[0]) {
          overwriteWarnings.push({
            range: data[index].range,
            existingValue: range.values[0][0],
            newValue: data[index].values[0][0],
          });
        }
      });

      if (overwriteWarnings.length > 0 && !config.forceOverwrite) {
        return {
          success: false,
          error: "上書き確認が必要です",
          overwriteWarnings: overwriteWarnings,
          updatedCount: 0,
          skippedCount: skippedCount,
          errorCount: errorCount,
        };
      }

      // バッチ更新実行
      const updateResponse = await this.executeWithRetry(async () => {
        const res = await fetch(
          `${this.baseUrl}/${config.spreadsheetId}/values:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              valueInputOption: "USER_ENTERED",
              data: data,
            }),
          },
        );

        if (!res.ok) {
          const error = await res.json();
          throw { status: res.status, ...error };
        }
        return res.json();
      });

      return {
        success: true,
        updatedCount: updateResponse.totalUpdatedCells || 0,
        skippedCount: skippedCount,
        errorCount: errorCount,
        overwriteCount: overwriteWarnings.length,
      };
    } catch (error) {
      console.error("書き込みエラー:", error);
      throw new Error(
        `スプレッドシートへの書き込みに失敗しました: ${error.message || JSON.stringify(error)}`,
      );
    }
  }

  /**
   * 処理状態の取得
   * @param {Object} config - 設定パラメータ
   * @param {string} token - 認証トークン
   * @returns {Object} - 処理状態
   */
  async getProcessingStatus(config, token) {
    const sheetName = config.sheetName || "Sheet1";
    const startRow = config.headerRow + 1;

    // URL列とドキュメントURL列の範囲を取得
    const ranges = [
      `${sheetName}!${config.urlColumn}${startRow}:${config.urlColumn}`,
      `${sheetName}!${config.docUrlColumn}${startRow}:${config.docUrlColumn}`,
    ];

    try {
      const response = await this.executeWithRetry(async () => {
        const params = new URLSearchParams({
          ranges: ranges,
          majorDimension: "COLUMNS",
        });

        const res = await fetch(
          `${this.baseUrl}/${config.spreadsheetId}/values:batchGet?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          const error = await res.json();
          throw { status: res.status, ...error };
        }
        return res.json();
      });

      const urls = response.valueRanges?.[0]?.values?.[0] || [];
      const docUrls = response.valueRanges?.[1]?.values?.[0] || [];

      let totalRows = 0;
      let processedRows = 0;
      let pendingRows = 0;

      for (let i = 0; i < urls.length; i++) {
        if (urls[i]) {
          totalRows++;
          if (docUrls[i]) {
            processedRows++;
          } else {
            pendingRows++;
          }
        }
      }

      return {
        totalRows,
        processedRows,
        pendingRows,
        completionRate:
          totalRows > 0 ? ((processedRows / totalRows) * 100).toFixed(1) : 0,
      };
    } catch (error) {
      console.error("ステータス取得エラー:", error);
      throw new Error(
        `処理状態の取得に失敗しました: ${error.message || JSON.stringify(error)}`,
      );
    }
  }
}

// エクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = SheetsApi;
}
