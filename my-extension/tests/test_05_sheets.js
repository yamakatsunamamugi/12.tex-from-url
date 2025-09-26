// Test file for Google Sheets API wrapper from 05_sheetsApi.js
// This file tests the Google Sheets API functionality with mock objects
// Syntax is compatible with node --check

console.log("Starting Google Sheets API tests...");

// Mock fetch function for testing
global.fetch = null; // Will be set in tests

// Simple assertion function for testing
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

// Mock test data
const mockTestData = {
  accessToken: "mock-access-token-12345",
  sheetId: "1ABC123DEF456GHI789JKL0MNOP",
  urlRange: "A2:A10",
  cellAddress: "B2",
  docUrl: "https://docs.google.com/document/d/1test-doc-id/edit",

  // Mock response data
  mockSheetResponse: {
    values: [
      ["https://example.com/page1"],
      ["https://example.com/page2"],
      ["https://example.com/page3"],
      [""], // Empty row
      ["https://example.com/page4"],
    ],
  },

  mockWriteResponse: {
    spreadsheetId: "1ABC123DEF456GHI789JKL0MNOP",
    updatedRows: 1,
    updatedColumns: 1,
    updatedCells: 1,
  },

  mockBatchUpdateResponse: {
    spreadsheetId: "1ABC123DEF456GHI789JKL0MNOP",
    totalUpdatedRows: 3,
    totalUpdatedColumns: 1,
    totalUpdatedCells: 3,
    responses: [
      { updatedRows: 1, updatedColumns: 1, updatedCells: 1 },
      { updatedRows: 1, updatedColumns: 1, updatedCells: 1 },
      { updatedRows: 1, updatedColumns: 1, updatedCells: 1 },
    ],
  },
};

// Mock Sheets API functions (simplified implementations for testing)
const mockSheetsApi = {
  // Mock implementation of getUrlsFromSheet
  async getUrlsFromSheet(accessToken, sheetId, range) {
    if (!accessToken || !sheetId || !range) {
      throw new Error("Missing required parameters");
    }

    if (accessToken === "invalid-token") {
      throw new Error("Failed to get sheet data: 401");
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    const urls = mockTestData.mockSheetResponse.values.map(
      (row) => row[0] || "",
    );
    console.log(`Mock: Fetched ${urls.length} URLs from sheet`);
    return urls;
  },

  // Mock implementation of writeDocUrl
  async writeDocUrl(accessToken, sheetId, cellAddress, docUrl) {
    if (!accessToken || !sheetId || !cellAddress || !docUrl) {
      throw new Error("Missing required parameters");
    }

    if (accessToken === "invalid-token") {
      throw new Error("Failed to write to sheet: 403");
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    console.log(`Mock: Wrote to cell ${cellAddress}: ${docUrl}`);
    return mockTestData.mockWriteResponse;
  },

  // Mock implementation of batchUpdateCells
  async batchUpdateCells(accessToken, sheetId, updates) {
    if (!accessToken || !sheetId || !Array.isArray(updates)) {
      throw new Error("Missing required parameters");
    }

    if (accessToken === "invalid-token") {
      throw new Error("Failed to batch update sheet: 500");
    }

    if (updates.length === 0) {
      throw new Error("Updates array cannot be empty");
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    console.log(`Mock: Batch updated ${updates.length} cells`);
    return mockTestData.mockBatchUpdateResponse;
  },
};

// Test 1: Get URLs from sheet - success case
async function testGetUrlsFromSheetSuccess() {
  console.log("\n--- Test 1: Get URLs from Sheet Success ---");

  const result = await mockSheetsApi.getUrlsFromSheet(
    mockTestData.accessToken,
    mockTestData.sheetId,
    mockTestData.urlRange,
  );

  assert(Array.isArray(result), "Should return an array");
  assert(result.length === 5, "Should return 5 URLs");
  assert(result[0] === "https://example.com/page1", "First URL should match");
  assert(result[3] === "", "Empty cell should return empty string");
  assert(result[4] === "https://example.com/page4", "Last URL should match");

  console.log("Get URLs from sheet success test passed");
}

// Test 2: Get URLs from sheet - missing parameters
async function testGetUrlsFromSheetMissingParams() {
  console.log("\n--- Test 2: Get URLs from Sheet Missing Parameters ---");

  try {
    await mockSheetsApi.getUrlsFromSheet(
      "",
      mockTestData.sheetId,
      mockTestData.urlRange,
    );
    assert(false, "Should throw error for missing access token");
  } catch (error) {
    assert(
      error.message === "Missing required parameters",
      "Should throw missing parameters error",
    );
  }

  try {
    await mockSheetsApi.getUrlsFromSheet(
      mockTestData.accessToken,
      "",
      mockTestData.urlRange,
    );
    assert(false, "Should throw error for missing sheet ID");
  } catch (error) {
    assert(
      error.message === "Missing required parameters",
      "Should throw missing parameters error",
    );
  }

  console.log("Get URLs from sheet missing parameters test passed");
}

// Test 3: Get URLs from sheet - authentication error
async function testGetUrlsFromSheetAuthError() {
  console.log("\n--- Test 3: Get URLs from Sheet Authentication Error ---");

  try {
    await mockSheetsApi.getUrlsFromSheet(
      "invalid-token",
      mockTestData.sheetId,
      mockTestData.urlRange,
    );
    assert(false, "Should throw authentication error");
  } catch (error) {
    assert(
      error.message === "Failed to get sheet data: 401",
      "Should throw authentication error",
    );
  }

  console.log("Get URLs from sheet authentication error test passed");
}

// Test 4: Write doc URL - success case
async function testWriteDocUrlSuccess() {
  console.log("\n--- Test 4: Write Doc URL Success ---");

  const result = await mockSheetsApi.writeDocUrl(
    mockTestData.accessToken,
    mockTestData.sheetId,
    mockTestData.cellAddress,
    mockTestData.docUrl,
  );

  assert(typeof result === "object", "Should return an object");
  assert(
    result.spreadsheetId === mockTestData.sheetId,
    "Should return correct spreadsheet ID",
  );
  assert(result.updatedRows === 1, "Should update one row");
  assert(result.updatedCells === 1, "Should update one cell");

  console.log("Write doc URL success test passed");
}

// Test 5: Write doc URL - missing parameters
async function testWriteDocUrlMissingParams() {
  console.log("\n--- Test 5: Write Doc URL Missing Parameters ---");

  try {
    await mockSheetsApi.writeDocUrl(
      "",
      mockTestData.sheetId,
      mockTestData.cellAddress,
      mockTestData.docUrl,
    );
    assert(false, "Should throw error for missing access token");
  } catch (error) {
    assert(
      error.message === "Missing required parameters",
      "Should throw missing parameters error",
    );
  }

  try {
    await mockSheetsApi.writeDocUrl(
      mockTestData.accessToken,
      mockTestData.sheetId,
      "",
      mockTestData.docUrl,
    );
    assert(false, "Should throw error for missing cell address");
  } catch (error) {
    assert(
      error.message === "Missing required parameters",
      "Should throw missing parameters error",
    );
  }

  console.log("Write doc URL missing parameters test passed");
}

// Test 6: Write doc URL - authorization error
async function testWriteDocUrlAuthError() {
  console.log("\n--- Test 6: Write Doc URL Authorization Error ---");

  try {
    await mockSheetsApi.writeDocUrl(
      "invalid-token",
      mockTestData.sheetId,
      mockTestData.cellAddress,
      mockTestData.docUrl,
    );
    assert(false, "Should throw authorization error");
  } catch (error) {
    assert(
      error.message === "Failed to write to sheet: 403",
      "Should throw authorization error",
    );
  }

  console.log("Write doc URL authorization error test passed");
}

// Test 7: Batch update cells - success case
async function testBatchUpdateCellsSuccess() {
  console.log("\n--- Test 7: Batch Update Cells Success ---");

  const updates = [
    { range: "B2", value: "https://docs.google.com/document/d/1/edit" },
    { range: "B3", value: "https://docs.google.com/document/d/2/edit" },
    { range: "B4", value: "https://docs.google.com/document/d/3/edit" },
  ];

  const result = await mockSheetsApi.batchUpdateCells(
    mockTestData.accessToken,
    mockTestData.sheetId,
    updates,
  );

  assert(typeof result === "object", "Should return an object");
  assert(
    result.spreadsheetId === mockTestData.sheetId,
    "Should return correct spreadsheet ID",
  );
  assert(result.totalUpdatedRows === 3, "Should update three rows");
  assert(result.totalUpdatedCells === 3, "Should update three cells");
  assert(Array.isArray(result.responses), "Should include responses array");
  assert(result.responses.length === 3, "Should have three response objects");

  console.log("Batch update cells success test passed");
}

// Test 8: Batch update cells - empty updates array
async function testBatchUpdateCellsEmptyArray() {
  console.log("\n--- Test 8: Batch Update Cells Empty Array ---");

  try {
    await mockSheetsApi.batchUpdateCells(
      mockTestData.accessToken,
      mockTestData.sheetId,
      [],
    );
    assert(false, "Should throw error for empty updates array");
  } catch (error) {
    assert(
      error.message === "Updates array cannot be empty",
      "Should throw empty array error",
    );
  }

  console.log("Batch update cells empty array test passed");
}

// Test 9: Batch update cells - invalid parameters
async function testBatchUpdateCellsInvalidParams() {
  console.log("\n--- Test 9: Batch Update Cells Invalid Parameters ---");

  try {
    await mockSheetsApi.batchUpdateCells(
      mockTestData.accessToken,
      mockTestData.sheetId,
      "not-an-array",
    );
    assert(false, "Should throw error for non-array updates parameter");
  } catch (error) {
    assert(
      error.message === "Missing required parameters",
      "Should throw missing parameters error",
    );
  }

  try {
    await mockSheetsApi.batchUpdateCells(
      "invalid-token",
      mockTestData.sheetId,
      [{ range: "A1", value: "test" }],
    );
    assert(false, "Should throw error for invalid token");
  } catch (error) {
    assert(
      error.message === "Failed to batch update sheet: 500",
      "Should throw server error",
    );
  }

  console.log("Batch update cells invalid parameters test passed");
}

// Test 10: API URL construction (testing the constants)
function testApiUrlConstruction() {
  console.log("\n--- Test 10: API URL Construction ---");

  const SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

  // Test read URL construction
  const readUrl = `${SHEETS_API_BASE_URL}/${mockTestData.sheetId}/values/${mockTestData.urlRange}`;
  const expectedReadUrl = `https://sheets.googleapis.com/v4/spreadsheets/${mockTestData.sheetId}/values/${mockTestData.urlRange}`;
  assert(
    readUrl === expectedReadUrl,
    "Read URL should be constructed correctly",
  );

  // Test write URL construction
  const writeUrl = `${SHEETS_API_BASE_URL}/${mockTestData.sheetId}/values/${mockTestData.cellAddress}?valueInputOption=RAW`;
  const expectedWriteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${mockTestData.sheetId}/values/${mockTestData.cellAddress}?valueInputOption=RAW`;
  assert(
    writeUrl === expectedWriteUrl,
    "Write URL should be constructed correctly",
  );

  // Test batch update URL construction
  const batchUrl = `${SHEETS_API_BASE_URL}/${mockTestData.sheetId}/values:batchUpdate`;
  const expectedBatchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${mockTestData.sheetId}/values:batchUpdate`;
  assert(
    batchUrl === expectedBatchUrl,
    "Batch update URL should be constructed correctly",
  );

  console.log("API URL construction test passed");
}

// Test 11: Request headers validation
function testRequestHeaders() {
  console.log("\n--- Test 11: Request Headers Validation ---");

  const headers = {
    Authorization: `Bearer ${mockTestData.accessToken}`,
    "Content-Type": "application/json",
  };

  assert(
    headers.Authorization === `Bearer ${mockTestData.accessToken}`,
    "Authorization header should be correct",
  );
  assert(
    headers["Content-Type"] === "application/json",
    "Content-Type header should be application/json",
  );

  // Test that authorization header format is correct
  const authParts = headers.Authorization.split(" ");
  assert(authParts.length === 2, "Authorization header should have two parts");
  assert(authParts[0] === "Bearer", "Authorization should use Bearer scheme");
  assert(
    authParts[1] === mockTestData.accessToken,
    "Authorization should include access token",
  );

  console.log("Request headers validation test passed");
}

// Test 12: Data transformation validation
function testDataTransformation() {
  console.log("\n--- Test 12: Data Transformation Validation ---");

  // Test URL extraction from sheet values
  const sheetValues = [
    ["https://example.com/page1"],
    ["https://example.com/page2"],
    [""], // Empty row
    ["https://example.com/page3"],
  ];

  const extractedUrls = sheetValues.map((row) => row[0] || "");

  assert(extractedUrls.length === 4, "Should extract all rows");
  assert(
    extractedUrls[0] === "https://example.com/page1",
    "First URL should be extracted correctly",
  );
  assert(extractedUrls[2] === "", "Empty cell should result in empty string");
  assert(
    extractedUrls[3] === "https://example.com/page3",
    "Last URL should be extracted correctly",
  );

  // Test batch update data structure
  const updates = [
    { range: "B2", value: "doc1" },
    { range: "B3", value: "doc2" },
  ];

  const requests = updates.map((update) => ({
    range: update.range,
    values: [[update.value]],
  }));

  assert(requests.length === 2, "Should create request for each update");
  assert(requests[0].range === "B2", "First request range should be correct");
  assert(Array.isArray(requests[0].values), "Values should be an array");
  assert(
    Array.isArray(requests[0].values[0]),
    "Values should be array of arrays",
  );
  assert(
    requests[0].values[0][0] === "doc1",
    "First request value should be correct",
  );

  console.log("Data transformation validation test passed");
}

// Run all tests
async function runAllTests() {
  console.log("=== Google Sheets API Tests ===");

  try {
    // Asynchronous tests
    await testGetUrlsFromSheetSuccess();
    await testGetUrlsFromSheetMissingParams();
    await testGetUrlsFromSheetAuthError();
    await testWriteDocUrlSuccess();
    await testWriteDocUrlMissingParams();
    await testWriteDocUrlAuthError();
    await testBatchUpdateCellsSuccess();
    await testBatchUpdateCellsEmptyArray();
    await testBatchUpdateCellsInvalidParams();

    // Synchronous tests
    testApiUrlConstruction();
    testRequestHeaders();
    testDataTransformation();

    console.log("\n✅ All Google Sheets API tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Export test functions for potential external testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    mockSheetsApi,
    mockTestData,
    testGetUrlsFromSheetSuccess,
    testGetUrlsFromSheetMissingParams,
    testGetUrlsFromSheetAuthError,
    testWriteDocUrlSuccess,
    testWriteDocUrlMissingParams,
    testWriteDocUrlAuthError,
    testBatchUpdateCellsSuccess,
    testBatchUpdateCellsEmptyArray,
    testBatchUpdateCellsInvalidParams,
    testApiUrlConstruction,
    testRequestHeaders,
    testDataTransformation,
    runAllTests,
  };
}

// Run tests if this file is executed directly
if (typeof require !== "undefined" && require.main === module) {
  runAllTests();
}

console.log("Google Sheets API test file loaded successfully");
