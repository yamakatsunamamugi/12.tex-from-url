/**
 * Google Sheets APIモジュールのテストコード
 */

const SheetsApi = require("../05_sheetsApi.js");

// モックデータ
const mockConfig = {
  spreadsheetId: "test-spreadsheet-id",
  sheetName: "TestSheet",
  urlColumn: "A",
  docUrlColumn: "B",
  nameColumn: "C",
  subjectColumn: "D",
  headerRow: 1,
  batchSize: 10,
};

const mockToken = "mock-access-token";

// テストランナー
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Sheets API テスト開始\n");

    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.error(`   ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 結果: ${this.passed}/${this.tests.length} 成功`);
    if (this.failed > 0) {
      console.log(`   ⚠️ ${this.failed}個のテストが失敗しました`);
    }
  }
}

// テスト実行
async function runTests() {
  const api = new SheetsApi();
  const runner = new TestRunner();

  // 1. 列番号変換テスト
  runner.test("列名を配列インデックスに変換", () => {
    const testCases = [
      { input: "A", expected: 0 },
      { input: "B", expected: 1 },
      { input: "Z", expected: 25 },
      { input: "AA", expected: 26 },
      { input: "AB", expected: 27 },
      { input: "BA", expected: 52 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = api.columnToIndex(input);
      if (result !== expected) {
        throw new Error(
          `列 ${input} の変換失敗: 期待値 ${expected}, 実際 ${result}`,
        );
      }
    });
  });

  // 2. URL検証テスト
  runner.test("URL形式の検証", () => {
    const validUrls = [
      "http://example.com",
      "https://example.com",
      "https://example.com/path",
      "https://example.com/path?query=value",
    ];

    const invalidUrls = [
      "",
      null,
      undefined,
      "not-a-url",
      "ftp://example.com",
      "javascript:alert(1)",
    ];

    validUrls.forEach((url) => {
      if (!api.validateUrl(url)) {
        throw new Error(`有効なURL "${url}" が無効と判定されました`);
      }
    });

    invalidUrls.forEach((url) => {
      if (api.validateUrl(url)) {
        throw new Error(`無効なURL "${url}" が有効と判定されました`);
      }
    });
  });

  // 3. API間隔制御テスト
  runner.test("API呼び出し間隔の確保", async () => {
    const startTime = Date.now();

    // 3回連続でAPI間隔確保を呼び出し
    await api.ensureApiInterval();
    await api.ensureApiInterval();
    await api.ensureApiInterval();

    const elapsed = Date.now() - startTime;

    // 少なくとも200ms（100ms × 2回の待機）かかるはず
    if (elapsed < 200) {
      throw new Error(`API間隔が正しく確保されていません: ${elapsed}ms`);
    }
  });

  // 4. 設定パラメータ検証テスト
  runner.test("設定パラメータの妥当性チェック", async () => {
    // モックfetch関数
    global.fetch = async (url) => {
      if (url.includes("test-spreadsheet-id")) {
        return {
          ok: true,
          json: async () => ({
            sheets: [
              { properties: { title: "TestSheet" } },
              { properties: { title: "Sheet2" } },
            ],
          }),
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      };
    };

    // 正常な設定
    const validResult = await api.validateSheet(mockConfig, mockToken);
    if (!validResult.isValid) {
      throw new Error("正常な設定が無効と判定されました");
    }

    // 無効な列指定
    const invalidColumnConfig = { ...mockConfig, urlColumn: "123" };
    const invalidResult = await api.validateSheet(
      invalidColumnConfig,
      mockToken,
    );
    if (invalidResult.isValid) {
      throw new Error("無効な列指定が有効と判定されました");
    }

    // 無効なヘッダー行
    const invalidHeaderConfig = { ...mockConfig, headerRow: 0 };
    const headerResult = await api.validateSheet(
      invalidHeaderConfig,
      mockToken,
    );
    if (headerResult.isValid) {
      throw new Error("無効なヘッダー行が有効と判定されました");
    }
  });

  // 5. readUrls メソッドのテスト
  runner.test("スプレッドシートからのURL読み取り", async () => {
    // モックfetch関数
    global.fetch = async (url) => {
      if (url.includes("values:batchGet")) {
        return {
          ok: true,
          json: async () => ({
            valueRanges: [
              {
                values: [
                  [
                    "https://example1.com",
                    "https://example2.com",
                    "invalid-url",
                  ],
                ],
              },
              { values: [["", "https://docs.google.com/doc1", ""]] },
              { values: [["田中太郎", "佐藤花子", "鈴木一郎"]] },
              { values: [["会議資料", "レポート", "プレゼン"]] },
            ],
          }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Not found" }),
      };
    };

    const results = await api.readUrls(mockConfig, mockToken);

    if (results.length !== 3) {
      throw new Error(`期待される行数: 3, 実際: ${results.length}`);
    }

    // 1行目のチェック
    const firstRow = results[0];
    if (firstRow.row !== 2) {
      throw new Error("行番号が正しくありません");
    }
    if (!firstRow.shouldProcess) {
      throw new Error("処理フラグが正しくありません");
    }

    // 2行目のチェック（既存ドキュメントURL）
    const secondRow = results[1];
    if (secondRow.shouldProcess) {
      throw new Error("既存URLがある行が処理対象になっています");
    }

    // 3行目のチェック（無効なURL）
    const thirdRow = results[2];
    if (thirdRow.isValidUrl) {
      throw new Error("無効なURLが有効と判定されています");
    }
  });

  // 6. writeDocUrls メソッドのテスト
  runner.test("ドキュメントURLの書き戻し", async () => {
    let batchGetCalled = false;
    let batchUpdateCalled = false;

    // モックfetch関数
    global.fetch = async (url, options) => {
      if (url.includes("values:batchGet")) {
        batchGetCalled = true;
        return {
          ok: true,
          json: async () => ({
            valueRanges: [
              { values: [[]] }, // 既存データなし
              { values: [[]] },
            ],
          }),
        };
      }
      if (url.includes("values:batchUpdate")) {
        batchUpdateCalled = true;
        const body = JSON.parse(options.body);
        if (!body.data || body.data.length === 0) {
          throw new Error("更新データが空です");
        }
        return {
          ok: true,
          json: async () => ({
            totalUpdatedCells: body.data.length,
          }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Not found" }),
      };
    };

    const writeResults = [
      { row: 2, docUrl: "https://docs.google.com/new1", status: "success" },
      { row: 3, docUrl: "https://docs.google.com/new2", status: "success" },
      { row: 4, docUrl: "", status: "error" },
      { row: 5, docUrl: "", status: "skipped" },
    ];

    const result = await api.writeDocUrls(mockConfig, writeResults, mockToken);

    if (!batchGetCalled) {
      throw new Error("既存データの確認が実行されませんでした");
    }
    if (!batchUpdateCalled) {
      throw new Error("バッチ更新が実行されませんでした");
    }
    if (result.updatedCount !== 2) {
      throw new Error(`更新件数が正しくありません: ${result.updatedCount}`);
    }
    if (result.skippedCount !== 1) {
      throw new Error(`スキップ件数が正しくありません: ${result.skippedCount}`);
    }
    if (result.errorCount !== 1) {
      throw new Error(`エラー件数が正しくありません: ${result.errorCount}`);
    }
  });

  // 7. 上書き防止のテスト
  runner.test("既存データの上書き防止", async () => {
    // モックfetch関数
    global.fetch = async (url) => {
      if (url.includes("values:batchGet")) {
        return {
          ok: true,
          json: async () => ({
            valueRanges: [
              { values: [["https://docs.google.com/existing"]] }, // 既存データあり
            ],
          }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Not found" }),
      };
    };

    const writeResults = [
      { row: 2, docUrl: "https://docs.google.com/new", status: "success" },
    ];

    const result = await api.writeDocUrls(mockConfig, writeResults, mockToken);

    if (result.success !== false) {
      throw new Error("上書き防止が機能していません");
    }
    if (!result.overwriteWarnings || result.overwriteWarnings.length === 0) {
      throw new Error("上書き警告が生成されませんでした");
    }
  });

  // 8. 処理状態の取得テスト
  runner.test("処理状態の取得", async () => {
    // モックfetch関数
    global.fetch = async (url) => {
      if (url.includes("values:batchGet")) {
        return {
          ok: true,
          json: async () => ({
            valueRanges: [
              { values: [["url1", "url2", "url3", "url4", "url5"]] },
              { values: [["doc1", "doc2", "", "", "doc5"]] },
            ],
          }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "Not found" }),
      };
    };

    const status = await api.getProcessingStatus(mockConfig, mockToken);

    if (status.totalRows !== 5) {
      throw new Error(`総行数が正しくありません: ${status.totalRows}`);
    }
    if (status.processedRows !== 3) {
      throw new Error(
        `処理済み行数が正しくありません: ${status.processedRows}`,
      );
    }
    if (status.pendingRows !== 2) {
      throw new Error(`未処理行数が正しくありません: ${status.pendingRows}`);
    }
    if (status.completionRate !== "60.0") {
      throw new Error(`完了率が正しくありません: ${status.completionRate}%`);
    }
  });

  // 9. エラーリトライのテスト
  runner.test("APIエラー時のリトライ機能", async () => {
    let callCount = 0;

    // モックfetch関数
    global.fetch = async () => {
      callCount++;
      if (callCount < 3) {
        // 最初の2回は500エラー
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        };
      }
      // 3回目は成功
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    };

    const result = await api.executeWithRetry(async () => {
      const res = await fetch("test-url");
      if (!res.ok) {
        const error = await res.json();
        throw { status: res.status, ...error };
      }
      return res.json();
    });

    if (callCount !== 3) {
      throw new Error(`リトライ回数が正しくありません: ${callCount}`);
    }
    if (!result.success) {
      throw new Error("リトライ後の成功が確認できません");
    }
  });

  // 10. API制限エラーのテスト
  runner.test("API制限（429）エラーの処理", async () => {
    let callCount = 0;
    const startTime = Date.now();

    // モックfetch関数
    global.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        // 最初は429エラー
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: "Rate limit exceeded" }),
        };
      }
      // 2回目は成功
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    };

    const result = await api.executeWithRetry(async () => {
      const res = await fetch("test-url");
      if (!res.ok) {
        const error = await res.json();
        throw { status: res.status, ...error };
      }
      return res.json();
    }, 2);

    const elapsed = Date.now() - startTime;

    // 指数バックオフにより1秒以上待機するはず
    if (elapsed < 1000) {
      throw new Error("API制限時の待機時間が不足しています");
    }
    if (!result.success) {
      throw new Error("API制限後のリトライが成功しませんでした");
    }
  });

  // テスト実行
  await runner.run();
}

// Node.js環境でのテスト実行
if (typeof module !== "undefined" && require.main === module) {
  runTests().catch((error) => {
    console.error("テスト実行エラー:", error);
    process.exit(1);
  });
}

// ブラウザ環境でのエクスポート
if (typeof window !== "undefined") {
  window.testSheetsApi = runTests;
}
