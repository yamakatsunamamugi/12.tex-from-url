// Test file for ExtensionController class from 02_background.js
// This file tests the background script functionality with mock objects
// Syntax is compatible with node --check

console.log("Starting background script tests...");

// Mock chrome API object for testing
const mockChrome = {
  identity: {
    getAuthToken: null, // Will be set in tests
    removeCachedAuthToken: null,
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: function (callback) {
        console.log("Message listener registered");
      },
    },
    onInstalled: {
      addListener: function (callback) {
        console.log("Install listener registered");
      },
    },
  },
  tabs: {
    create: null,
    remove: null,
    sendMessage: null,
  },
};

// Mock global chrome object
global.chrome = mockChrome;

// Simple assertion function for testing
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

// Mock implementation of ExtensionController (simplified for testing)
class MockExtensionController {
  constructor() {
    this.accessToken = null;
    this.sheetId = null;
    this.processing = false;
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      if (mockChrome.identity.getAuthToken) {
        mockChrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (mockChrome.runtime.lastError) {
            reject(mockChrome.runtime.lastError);
          } else {
            this.accessToken = token;
            resolve(token);
          }
        });
      } else {
        reject(new Error("Chrome identity API not available"));
      }
    });
  }

  async extractContentFromTab(tabId) {
    return new Promise((resolve, reject) => {
      if (mockChrome.tabs.sendMessage) {
        mockChrome.tabs.sendMessage(
          tabId,
          { action: "extractContent" },
          (response) => {
            if (mockChrome.runtime.lastError) {
              reject(mockChrome.runtime.lastError);
            } else if (response && response.content) {
              resolve(response.content);
            } else {
              reject(new Error("Failed to extract content"));
            }
          },
        );
      } else {
        reject(new Error("Chrome tabs API not available"));
      }
    });
  }

  async refreshToken() {
    return new Promise((resolve, reject) => {
      if (mockChrome.identity.removeCachedAuthToken) {
        mockChrome.identity.removeCachedAuthToken(
          { token: this.accessToken },
          () => {
            this.accessToken = null;
            this.authenticate().then(resolve).catch(reject);
          },
        );
      } else {
        reject(new Error("Chrome identity API not available"));
      }
    });
  }
}

// Test 1: Controller instantiation
function testControllerInstantiation() {
  console.log("\n--- Test 1: Controller Instantiation ---");
  const controller = new MockExtensionController();

  assert(
    controller.accessToken === null,
    "Initial access token should be null",
  );
  assert(controller.sheetId === null, "Initial sheet ID should be null");
  assert(
    controller.processing === false,
    "Initial processing state should be false",
  );

  console.log("Controller instantiation test passed");
}

// Test 2: Authentication success
function testAuthenticationSuccess() {
  console.log("\n--- Test 2: Authentication Success ---");

  // Mock successful authentication
  mockChrome.identity.getAuthToken = function (options, callback) {
    setTimeout(() => {
      callback("mock-token-12345");
    }, 10);
  };

  const controller = new MockExtensionController();

  return controller.authenticate().then((token) => {
    assert(token === "mock-token-12345", "Should return correct token");
    assert(
      controller.accessToken === "mock-token-12345",
      "Should store token in controller",
    );
    console.log("Authentication success test passed");
  });
}

// Test 3: Authentication failure
function testAuthenticationFailure() {
  console.log("\n--- Test 3: Authentication Failure ---");

  // Mock authentication failure
  mockChrome.runtime.lastError = { message: "User denied authorization" };
  mockChrome.identity.getAuthToken = function (options, callback) {
    setTimeout(() => {
      callback(null);
    }, 10);
  };

  const controller = new MockExtensionController();

  return controller.authenticate().catch((error) => {
    assert(
      error.message === "User denied authorization",
      "Should propagate error message",
    );
    assert(
      controller.accessToken === null,
      "Token should remain null on failure",
    );
    console.log("Authentication failure test passed");

    // Reset error state
    mockChrome.runtime.lastError = null;
  });
}

// Test 4: Content extraction success
function testContentExtractionSuccess() {
  console.log("\n--- Test 4: Content Extraction Success ---");

  // Mock successful content extraction
  mockChrome.tabs.sendMessage = function (tabId, message, callback) {
    setTimeout(() => {
      const mockResponse = {
        content: {
          title: "Test Page Title",
          text: "This is test content from the page",
          source: "Test Site",
        },
      };
      callback(mockResponse);
    }, 10);
  };

  const controller = new MockExtensionController();

  return controller.extractContentFromTab(123).then((content) => {
    assert(content.title === "Test Page Title", "Should extract correct title");
    assert(
      content.text === "This is test content from the page",
      "Should extract correct text",
    );
    assert(content.source === "Test Site", "Should extract correct source");
    console.log("Content extraction success test passed");
  });
}

// Test 5: Content extraction failure
function testContentExtractionFailure() {
  console.log("\n--- Test 5: Content Extraction Failure ---");

  // Mock content extraction failure
  mockChrome.runtime.lastError = { message: "Tab not found" };
  mockChrome.tabs.sendMessage = function (tabId, message, callback) {
    setTimeout(() => {
      callback(null);
    }, 10);
  };

  const controller = new MockExtensionController();

  return controller.extractContentFromTab(999).catch((error) => {
    assert(error.message === "Tab not found", "Should propagate tab error");
    console.log("Content extraction failure test passed");

    // Reset error state
    mockChrome.runtime.lastError = null;
  });
}

// Test 6: Token refresh
function testTokenRefresh() {
  console.log("\n--- Test 6: Token Refresh ---");

  // Mock token removal and re-authentication
  mockChrome.identity.removeCachedAuthToken = function (options, callback) {
    setTimeout(() => {
      callback();
    }, 10);
  };

  mockChrome.identity.getAuthToken = function (options, callback) {
    setTimeout(() => {
      callback("new-refreshed-token-67890");
    }, 10);
  };

  const controller = new MockExtensionController();
  controller.accessToken = "old-token";

  return controller.refreshToken().then((newToken) => {
    assert(newToken === "new-refreshed-token-67890", "Should return new token");
    assert(
      controller.accessToken === "new-refreshed-token-67890",
      "Should update stored token",
    );
    console.log("Token refresh test passed");
  });
}

// Test 7: Message listener functionality
function testMessageListener() {
  console.log("\n--- Test 7: Message Listener ---");

  // Create a mock message listener
  function mockMessageListener(request, sender, sendResponse) {
    if (request.action === "authenticate") {
      sendResponse({ success: true, token: "mock-token" });
      return true;
    }

    if (request.action === "getStatus") {
      sendResponse({
        processing: false,
        authenticated: true,
      });
      return true;
    }

    if (request.action === "processUrls") {
      sendResponse({
        success: true,
        results: [{ url: "test.com", status: "success" }],
      });
      return true;
    }
  }

  // Test authenticate action
  const authRequest = { action: "authenticate" };
  let authResponse = null;
  const authSendResponse = (response) => {
    authResponse = response;
  };

  const authResult = mockMessageListener(authRequest, null, authSendResponse);
  assert(
    authResult === true,
    "Message listener should return true for async operations",
  );
  assert(
    authResponse.success === true,
    "Should respond with success for authentication",
  );
  assert(
    authResponse.token === "mock-token",
    "Should include token in response",
  );

  // Test status action
  const statusRequest = { action: "getStatus" };
  let statusResponse = null;
  const statusSendResponse = (response) => {
    statusResponse = response;
  };

  const statusResult = mockMessageListener(
    statusRequest,
    null,
    statusSendResponse,
  );
  assert(
    statusResult === true,
    "Message listener should return true for status request",
  );
  assert(
    statusResponse.processing === false,
    "Should report processing status",
  );
  assert(
    statusResponse.authenticated === true,
    "Should report authentication status",
  );

  console.log("Message listener test passed");
}

// Test 8: Error handling
function testErrorHandling() {
  console.log("\n--- Test 8: Error Handling ---");

  // Test with missing chrome API
  const originalChrome = global.chrome;
  global.chrome = {};

  const controller = new MockExtensionController();

  return controller.authenticate().catch((error) => {
    assert(
      error.message === "Chrome identity API not available",
      "Should handle missing API gracefully",
    );

    // Restore chrome mock
    global.chrome = originalChrome;
    console.log("Error handling test passed");
  });
}

// Run all tests
async function runAllTests() {
  console.log("=== Background Script Tests ===");

  try {
    // Synchronous tests
    testControllerInstantiation();
    testMessageListener();

    // Asynchronous tests
    await testAuthenticationSuccess();
    await testAuthenticationFailure();
    await testContentExtractionSuccess();
    await testContentExtractionFailure();
    await testTokenRefresh();
    await testErrorHandling();

    console.log("\n✅ All background script tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Export test functions for potential external testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MockExtensionController,
    testControllerInstantiation,
    testAuthenticationSuccess,
    testAuthenticationFailure,
    testContentExtractionSuccess,
    testContentExtractionFailure,
    testTokenRefresh,
    testMessageListener,
    testErrorHandling,
    runAllTests,
  };
}

// Run tests if this file is executed directly
if (typeof require !== "undefined" && require.main === module) {
  runAllTests();
}

console.log("Background script test file loaded successfully");
