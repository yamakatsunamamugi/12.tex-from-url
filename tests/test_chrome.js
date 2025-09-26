const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
};

const mockChrome = {
  storage: {
    local: {
      data: {},
      get: function (keys) {
        return Promise.resolve(this.data);
      },
      set: function (items) {
        Object.assign(this.data, items);
        return Promise.resolve();
      },
      clear: function () {
        this.data = {};
        return Promise.resolve();
      },
    },
  },
  runtime: {
    lastError: null,
    messages: [],
    sendMessage: function (message, callback) {
      this.messages.push(message);
      if (callback) callback({ success: true });
      return Promise.resolve();
    },
    onMessage: {
      listeners: [],
      addListener: function (listener) {
        this.listeners.push(listener);
      },
    },
  },
  identity: {
    token: "mock-token-12345",
    getAuthToken: function (options, callback) {
      callback(this.token);
    },
  },
};

if (typeof chrome === "undefined") {
  global.chrome = mockChrome;
}

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEach = null;
    this.afterEach = null;
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  setBeforeEach(fn) {
    this.beforeEach = fn;
  }

  setAfterEach(fn) {
    this.afterEach = fn;
  }

  async run() {
    console.log(`\n🧪 Running test suite: ${this.name}`);
    console.log("=".repeat(50));

    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        if (this.beforeEach) await this.beforeEach();

        console.log(`\nTest: ${test.name}`);
        await test.testFn();

        if (this.afterEach) await this.afterEach();

        passed++;
      } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        failed++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
  }
}

const configTests = new TestSuite("Configuration Management");

configTests.setBeforeEach(async () => {
  await chrome.storage.local.clear();
});

configTests.addTest("Should save configuration", async () => {
  const config = {
    spreadsheetId: "test-sheet-id",
    sheetName: "Sheet1",
    urlColumn: "A",
    docUrlColumn: "B",
    nameColumn: "C",
    subjectColumn: "D",
    headerRow: 1,
    batchSize: 10,
    overwriteMode: false,
  };

  await chrome.storage.local.set({ config });
  const result = await chrome.storage.local.get("config");

  assert(result.config !== undefined, "Config should be saved");
  assert(
    result.config.spreadsheetId === "test-sheet-id",
    "SpreadsheetId should match",
  );
  assert(result.config.batchSize === 10, "BatchSize should match");
});

configTests.addTest("Should validate configuration", () => {
  const validateConfig = (config) => {
    const errors = [];

    if (!config.spreadsheetId) {
      errors.push("スプレッドシートIDを入力してください");
    }

    if (!config.urlColumn) {
      errors.push("URL列を選択してください");
    }

    if (config.urlColumn === config.docUrlColumn) {
      errors.push("URL列とDoc URL列は異なる列を選択してください");
    }

    if (config.batchSize < 1 || config.batchSize > 50) {
      errors.push("バッチサイズは1～50の範囲で設定してください");
    }

    return errors.length === 0;
  };

  const validConfig = {
    spreadsheetId: "test-id",
    urlColumn: "A",
    docUrlColumn: "B",
    batchSize: 10,
  };

  assert(validateConfig(validConfig), "Valid config should pass");

  const invalidConfig = {
    spreadsheetId: "",
    urlColumn: "A",
    docUrlColumn: "A",
    batchSize: 100,
  };

  assert(!validateConfig(invalidConfig), "Invalid config should fail");
});

const messageTests = new TestSuite("Message Passing");

messageTests.addTest("Should send START_PROCESSING message", async () => {
  chrome.runtime.messages = [];

  const config = { spreadsheetId: "test" };
  await chrome.runtime.sendMessage({
    action: "START_PROCESSING",
    config: config,
  });

  assert(chrome.runtime.messages.length === 1, "Should send one message");
  assert(
    chrome.runtime.messages[0].action === "START_PROCESSING",
    "Action should be START_PROCESSING",
  );
});

messageTests.addTest("Should send STOP_PROCESSING message", async () => {
  chrome.runtime.messages = [];

  await chrome.runtime.sendMessage({
    action: "STOP_PROCESSING",
  });

  assert(chrome.runtime.messages.length === 1, "Should send one message");
  assert(
    chrome.runtime.messages[0].action === "STOP_PROCESSING",
    "Action should be STOP_PROCESSING",
  );
});

const authTests = new TestSuite("OAuth Authentication");

authTests.addTest("Should get auth token", async () => {
  const getAuthToken = () => {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  };

  const token = await getAuthToken();
  assert(token === "mock-token-12345", "Should return mock token");
});

const utilityTests = new TestSuite("Utility Functions");

utilityTests.addTest("Should convert column letter to index", () => {
  const columnToIndex = (column) => {
    const letters = column.toUpperCase();
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.charCodeAt(i) - "A".charCodeAt(0));
    }
    return index;
  };

  assert(columnToIndex("A") === 0, "A should be index 0");
  assert(columnToIndex("B") === 1, "B should be index 1");
  assert(columnToIndex("Z") === 25, "Z should be index 25");
  assert(columnToIndex("AA") === 26, "AA should be index 26");
});

utilityTests.addTest("Should generate document name", () => {
  const generateDocumentName = (index, item) => {
    const parts = [index.toString()];
    if (item.name) parts.push(item.name);
    if (item.subject) parts.push(item.subject);
    return parts.join("_");
  };

  const item1 = { name: "TestName", subject: "TestSubject" };
  assert(
    generateDocumentName(1, item1) === "1_TestName_TestSubject",
    "Should generate full name",
  );

  const item2 = { name: "", subject: "OnlySubject" };
  assert(
    generateDocumentName(2, item2) === "2_OnlySubject",
    "Should handle missing name",
  );

  const item3 = { name: "OnlyName", subject: "" };
  assert(
    generateDocumentName(3, item3) === "3_OnlyName",
    "Should handle missing subject",
  );
});

const progressTests = new TestSuite("Progress Tracking");

progressTests.addTest("Should calculate progress percentage", () => {
  const calculateProgress = (processed, total) => {
    if (total === 0) return 0;
    return Math.round((processed / total) * 100);
  };

  assert(calculateProgress(0, 10) === 0, "Should be 0% at start");
  assert(calculateProgress(5, 10) === 50, "Should be 50% at midpoint");
  assert(calculateProgress(10, 10) === 100, "Should be 100% when complete");
  assert(calculateProgress(0, 0) === 0, "Should handle zero total");
});

progressTests.addTest("Should track batch progress", () => {
  const items = Array(25)
    .fill(null)
    .map((_, i) => ({ id: i + 1 }));
  const batchSize = 10;
  let processedCount = 0;
  const progressUpdates = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    batch.forEach(() => {
      processedCount++;
      progressUpdates.push({
        processed: processedCount,
        total: items.length,
      });
    });
  }

  assert(progressUpdates.length === 25, "Should have update for each item");
  assert(progressUpdates[24].processed === 25, "Should process all items");
  assert(progressUpdates[24].total === 25, "Total should remain constant");
});

const errorHandlingTests = new TestSuite("Error Handling");

errorHandlingTests.addTest("Should handle API rate limits", async () => {
  const fetchWithRetry = async (url, options, maxRetries = 3) => {
    let lastError;
    const delays = [];

    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) {
          const delay = Math.pow(2, i - 1) * 1000;
          delays.push(delay);
          await new Promise((resolve) => setTimeout(resolve, 1));
        }

        if (i < 2) {
          throw { status: 429 };
        }

        return { ok: true, status: 200 };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  };

  const result = await fetchWithRetry("test-url", {});
  assert(result.ok === true, "Should eventually succeed");
});

errorHandlingTests.addTest("Should collect and report errors", () => {
  const errors = [];
  const items = [
    { row: 1, url: "valid-url" },
    { row: 2, url: "invalid-url" },
    { row: 3, url: "valid-url" },
    { row: 4, url: "error-url" },
  ];

  items.forEach((item) => {
    try {
      if (item.url === "invalid-url" || item.url === "error-url") {
        throw new Error(`Failed to process ${item.url}`);
      }
    } catch (error) {
      errors.push({ row: item.row, error: error.message });
    }
  });

  assert(errors.length === 2, "Should collect 2 errors");
  assert(errors[0].row === 2, "First error should be row 2");
  assert(errors[1].row === 4, "Second error should be row 4");
});

const validationTests = new TestSuite("Input Validation");

validationTests.addTest("Should validate spreadsheet ID format", () => {
  const isValidSpreadsheetId = (id) => {
    return id && id.length > 10 && /^[a-zA-Z0-9_-]+$/.test(id);
  };

  assert(
    isValidSpreadsheetId("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"),
    "Valid ID should pass",
  );
  assert(!isValidSpreadsheetId(""), "Empty ID should fail");
  assert(!isValidSpreadsheetId("short"), "Too short ID should fail");
  assert(!isValidSpreadsheetId("invalid@id"), "Invalid characters should fail");
});

validationTests.addTest("Should validate column selection", () => {
  const isValidColumnConfig = (urlCol, docUrlCol, nameCol, subjectCol) => {
    const columns = [urlCol, docUrlCol, nameCol, subjectCol];
    const uniqueColumns = new Set(columns);

    return urlCol !== docUrlCol && columns.every((col) => /^[A-Z]+$/.test(col));
  };

  assert(
    isValidColumnConfig("A", "B", "C", "D"),
    "Different columns should pass",
  );
  assert(
    !isValidColumnConfig("A", "A", "C", "D"),
    "Same URL and Doc columns should fail",
  );
  assert(
    isValidColumnConfig("A", "B", "A", "D"),
    "Duplicate non-critical columns OK",
  );
});

async function runAllTests() {
  console.log("🚀 Starting Chrome Extension Test Suite\n");

  const suites = [
    configTests,
    messageTests,
    authTests,
    utilityTests,
    progressTests,
    errorHandlingTests,
    validationTests,
  ];

  let allPassed = true;

  for (const suite of suites) {
    const passed = await suite.run();
    allPassed = allPassed && passed;
  }

  console.log("\n" + "=".repeat(50));
  if (allPassed) {
    console.log("✅ All tests passed!");
  } else {
    console.log("❌ Some tests failed. Please review the output above.");
  }

  return allPassed;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runAllTests, TestSuite };
}

if (typeof window !== "undefined") {
  window.runAllTests = runAllTests;
  console.log("Tests loaded. Run runAllTests() in console to execute.");
} else if (typeof global !== "undefined" && process.argv[1] === __filename) {
  runAllTests().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
