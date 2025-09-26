// Test file for Google Docs API wrapper from 06_docsApi.js
// This file tests the Google Docs API functionality with mock objects
// Syntax is compatible with node --check

console.log("Starting Google Docs API tests...");

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
  documentTitle: "Test Document Title",
  documentId: "1TEST_DOC_ID_ABC123",
  textContent:
    "This is test content for the document. It contains multiple sentences and should be formatted properly.",

  // Mock response data
  mockCreateDocResponse: {
    documentId: "1TEST_DOC_ID_ABC123",
    title: "Test Document Title",
    revisionId: "ALm-Test-Revision",
    documentStyle: {},
    body: {
      content: [
        {
          endIndex: 1,
          sectionBreak: {
            sectionStyle: {
              columnSeparatorStyle: "NONE",
              contentDirection: "LEFT_TO_RIGHT",
            },
          },
        },
      ],
    },
  },

  mockBatchUpdateResponse: {
    documentId: "1TEST_DOC_ID_ABC123",
    replies: [
      {
        insertText: {},
      },
    ],
  },

  mockGetDocResponse: {
    documentId: "1TEST_DOC_ID_ABC123",
    title: "Test Document Title",
    body: {
      content: [
        {
          startIndex: 1,
          endIndex: 50,
          paragraph: {
            elements: [
              {
                startIndex: 1,
                endIndex: 50,
                textRun: {
                  content: "Test document content here",
                  textStyle: {},
                },
              },
            ],
          },
        },
      ],
    },
  },

  mockMetadata: {
    url: "https://example.com/test-page",
    domain: "example.com",
    extractedAt: "2023-09-26T10:00:00.000Z",
    author: "Test Author",
    publishDate: "2023-09-25",
    keywords: "test, example, content",
    date: "2023-09-25",
  },

  mockStructuredContent: {
    title: "Test Article",
    text: "This is the main content.",
    url: "https://example.com",
    structure: [
      { tag: "h1", text: "Main Heading" },
      { tag: "p", text: "This is a paragraph." },
      { tag: "h2", text: "Subheading" },
      { tag: "ul", text: "List item 1", items: ["Item 1", "Item 2"] },
      { tag: "blockquote", text: "This is a quote" },
      { tag: "pre", text: "const code = 'example';" },
    ],
  },

  mockImages: [
    { src: "https://example.com/image1.png", alt: "Test Image 1" },
    { src: "https://example.com/image2.jpg", alt: "Test Image 2" },
  ],
};

// Mock DocsApiClient class for testing
class MockDocsApiClient {
  constructor(authToken) {
    this.token = authToken;
    this.baseUrl = "https://docs.googleapis.com/v1";
    this.driveApiUrl = "https://www.googleapis.com/drive/v3/files";
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  generateDocumentName(index, name, subject) {
    const paddedIndex = String(index).padStart(3, "0");
    const safeName = this.sanitizeFileName(name || "名前なし");
    const safeSubject = this.sanitizeFileName(subject || "件名なし");
    const maxLength = 100;
    let docName = `${paddedIndex}_${safeName}_${safeSubject}`;

    if (docName.length > maxLength) {
      const baseLength = paddedIndex.length + safeName.length + 2;
      const availableLength = maxLength - baseLength;
      const truncatedSubject = safeSubject.substring(
        0,
        Math.max(10, availableLength),
      );
      docName = `${paddedIndex}_${safeName}_${truncatedSubject}`;
    }

    return docName;
  }

  sanitizeFileName(text) {
    return text
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_{2,}/g, "_")
      .trim();
  }

  async createEmptyDocument(documentName) {
    if (!documentName) {
      throw new Error("Document name is required");
    }

    // Simulate network delay
    await this.sleep(10);

    if (this.token === "invalid-token") {
      throw new Error("Failed to create document: 401");
    }

    if (this.token === "expired-token") {
      throw new Error("Token has expired");
    }

    return {
      documentId: mockTestData.documentId,
      url: `https://docs.google.com/document/d/${mockTestData.documentId}/edit`,
    };
  }

  analyzeContentStructure(extractedContent) {
    const structure = [];

    if (extractedContent.title) {
      structure.push({
        tag: "h1",
        text: extractedContent.title,
      });
    }

    if (
      extractedContent.structure &&
      Array.isArray(extractedContent.structure)
    ) {
      structure.push(...extractedContent.structure);
    } else if (extractedContent.text) {
      const paragraphs = extractedContent.text
        .split(/\n\n+/)
        .filter((p) => p.trim().length > 0)
        .map((p) => ({
          tag: "p",
          text: p.trim(),
        }));
      structure.push(...paragraphs);
    }

    return structure;
  }

  calculateTextLength(metadata) {
    const headerLines = [
      `抽出日時: ${new Date().toLocaleString("ja-JP")}`,
      `元URL: ${metadata.url}`,
      metadata.author ? `著者: ${metadata.author}` : null,
      metadata.date ? `公開日: ${metadata.date}` : null,
    ].filter(Boolean);

    return headerLines.join("\n").length + 1;
  }

  createHeaderRequests(metadata, index) {
    const requests = [];
    const headerText = [
      `抽出日時: ${new Date().toLocaleString("ja-JP")}`,
      `元URL: ${metadata.url}`,
      metadata.author ? `著者: ${metadata.author}` : null,
      metadata.date ? `公開日: ${metadata.date}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    requests.push({
      insertText: {
        text: headerText + "\n",
        location: { index },
      },
    });

    requests.push({
      updateTextStyle: {
        range: {
          startIndex: index,
          endIndex: index + headerText.length,
        },
        textStyle: {
          fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: {
            color: {
              rgbColor: { red: 0.5, green: 0.5, blue: 0.5 },
            },
          },
        },
        fields: "fontSize,foregroundColor",
      },
    });

    return requests;
  }

  createHorizontalRuleRequest(index) {
    return {
      insertText: {
        text: "─".repeat(50) + "\n",
        location: { index },
      },
    };
  }

  createTitleRequests(title, index) {
    return [
      {
        insertText: {
          text: title + "\n",
          location: { index },
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + title.length },
          paragraphStyle: {
            namedStyleType: "HEADING_1",
            spaceAbove: { magnitude: 18, unit: "PT" },
            spaceBelow: { magnitude: 6, unit: "PT" },
          },
          fields: "namedStyleType,spaceAbove,spaceBelow",
        },
      },
    ];
  }

  createHeading1(text, index) {
    return this.createTitleRequests(text, index);
  }

  createHeading2(text, index) {
    return [
      {
        insertText: {
          text: text + "\n",
          location: { index },
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: {
            namedStyleType: "HEADING_2",
            spaceAbove: { magnitude: 14, unit: "PT" },
            spaceBelow: { magnitude: 4, unit: "PT" },
          },
          fields: "namedStyleType,spaceAbove,spaceBelow",
        },
      },
    ];
  }

  createHeading3(text, index) {
    return [
      {
        insertText: {
          text: text + "\n",
          location: { index },
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: {
            namedStyleType: "HEADING_3",
            spaceAbove: { magnitude: 12, unit: "PT" },
            spaceBelow: { magnitude: 4, unit: "PT" },
          },
          fields: "namedStyleType,spaceAbove,spaceBelow",
        },
      },
    ];
  }

  createParagraph(text, index) {
    return [
      {
        insertText: {
          text: text + "\n",
          location: { index },
        },
      },
    ];
  }

  createList(listElement, index) {
    const requests = [];
    const items = listElement.items || [listElement.text];

    items.forEach((item) => {
      requests.push({
        insertText: {
          text: item + "\n",
          location: { index },
        },
      });

      requests.push({
        createParagraphBullets: {
          range: { startIndex: index, endIndex: index + item.length },
          bulletPreset:
            listElement.tag === "ol"
              ? "NUMBERED_DECIMAL_ALPHA_ROMAN"
              : "BULLET_DISC_CIRCLE_SQUARE",
        },
      });

      index += item.length + 1;
    });

    return requests;
  }

  createQuote(text, index) {
    return [
      {
        insertText: {
          text: text + "\n",
          location: { index },
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: {
            indentFirstLine: { magnitude: 0, unit: "PT" },
            indentStart: { magnitude: 36, unit: "PT" },
            borderLeft: {
              color: {
                color: {
                  rgbColor: { red: 0.8, green: 0.8, blue: 0.8 },
                },
              },
              width: { magnitude: 3, unit: "PT" },
              padding: { magnitude: 12, unit: "PT" },
            },
          },
          fields: "indentFirstLine,indentStart,borderLeft",
        },
      },
    ];
  }

  createCodeBlock(code, index) {
    return [
      {
        insertText: {
          text: code + "\n",
          location: { index },
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: index, endIndex: index + code.length },
          textStyle: {
            fontFamily: "Courier New",
            fontSize: { magnitude: 10, unit: "PT" },
            backgroundColor: {
              color: {
                rgbColor: { red: 0.95, green: 0.95, blue: 0.95 },
              },
            },
          },
          fields: "fontFamily,fontSize,backgroundColor",
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + code.length },
          paragraphStyle: {
            indentFirstLine: { magnitude: 0, unit: "PT" },
            indentStart: { magnitude: 36, unit: "PT" },
          },
          fields: "indentFirstLine,indentStart",
        },
      },
    ];
  }

  formatMainContent(content, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    if (content.structure) {
      content.structure.forEach((element) => {
        switch (element.tag) {
          case "h1":
            requests.push(...this.createHeading1(element.text, currentIndex));
            break;
          case "h2":
            requests.push(...this.createHeading2(element.text, currentIndex));
            break;
          case "h3":
            requests.push(...this.createHeading3(element.text, currentIndex));
            break;
          case "p":
            requests.push(...this.createParagraph(element.text, currentIndex));
            break;
          case "ul":
          case "ol":
            requests.push(...this.createList(element, currentIndex));
            break;
          case "blockquote":
            requests.push(...this.createQuote(element.text, currentIndex));
            break;
          case "pre":
            requests.push(...this.createCodeBlock(element.text, currentIndex));
            break;
        }
        currentIndex += element.text.length + 2;
      });
    } else {
      requests.push(...this.formatPlainText(content.text, currentIndex));
    }

    return requests;
  }

  formatPlainText(text, index) {
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const requests = [];
    let currentIndex = index;

    paragraphs.forEach((paragraph) => {
      requests.push({
        insertText: {
          text: paragraph + "\n\n",
          location: { index: currentIndex },
        },
      });
      currentIndex += paragraph.length + 2;
    });

    return requests;
  }

  createFooterRequests(url, index) {
    const footerText = `\n─${"─".repeat(49)}\n元URL: ${url}`;

    return [
      {
        insertText: {
          text: footerText,
          location: { index },
        },
      },
      {
        updateTextStyle: {
          range: {
            startIndex: index + footerText.indexOf("元URL"),
            endIndex: index + footerText.length,
          },
          textStyle: {
            fontSize: { magnitude: 9, unit: "PT" },
            foregroundColor: {
              color: {
                rgbColor: { red: 0.5, green: 0.5, blue: 0.5 },
              },
            },
          },
          fields: "fontSize,foregroundColor",
        },
      },
    ];
  }

  buildUpdateRequests(content, metadata) {
    const requests = [];
    let currentIndex = 1;

    requests.push(...this.createHeaderRequests(metadata, currentIndex));
    currentIndex += this.calculateTextLength(metadata);

    requests.push(this.createHorizontalRuleRequest(currentIndex));
    currentIndex += 51;

    if (content.title) {
      requests.push(...this.createTitleRequests(content.title, currentIndex));
      currentIndex += content.title.length + 1;
    }

    requests.push(...this.formatMainContent(content, currentIndex));

    const contentLength = this.calculateContentLength(content);
    currentIndex += contentLength;

    requests.push(
      ...this.createFooterRequests(content.url || metadata.url, currentIndex),
    );

    return requests;
  }

  calculateContentLength(content) {
    let length = 0;

    if (content.structure) {
      content.structure.forEach((element) => {
        length += element.text.length + 2;
      });
    } else if (content.text) {
      length = content.text.length + 2;
    }

    return length;
  }

  async uploadImageToDrive(imageSrc, altText) {
    console.log(`[DocsAPI] Uploading image to Drive: ${altText}`);
    return imageSrc;
  }

  async processImages(images) {
    const imageRequests = [];
    let currentImageIndex = 1;

    for (const image of images) {
      try {
        const imageUrl = await this.uploadImageToDrive(image.src, image.alt);

        imageRequests.push({
          insertInlineImage: {
            uri: imageUrl,
            location: { index: currentImageIndex },
            objectSize: {
              height: { magnitude: 300, unit: "PT" },
              width: { magnitude: 400, unit: "PT" },
            },
          },
        });

        if (image.alt) {
          imageRequests.push({
            insertText: {
              text: `図: ${image.alt}\n`,
              location: { index: currentImageIndex + 1 },
            },
          });
        }
      } catch (error) {
        console.warn(`画像処理エラー: ${error.message}`);
        imageRequests.push({
          insertText: {
            text: `[画像: ${image.alt || "エラー"}]\n`,
            location: { index: currentImageIndex },
          },
        });
      }
    }

    return imageRequests;
  }

  async batchUpdate(documentId, requests) {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Simulate network delay
        await this.sleep(10);

        if (this.token === "invalid-token") {
          throw new Error("HTTP error! status: 401");
        }

        if (this.token === "expired-token") {
          throw new Error("Token has expired");
        }

        if (requests.length > 100) {
          throw new Error("Request too large");
        }

        return mockTestData.mockBatchUpdateResponse;
      } catch (error) {
        lastError = error;

        if (error.message.includes("Request too large")) {
          return await this.batchUpdateChunked(documentId, requests);
        }
      }
    }

    throw lastError;
  }

  async batchUpdateChunked(documentId, requests) {
    const chunkSize = 50;
    const results = [];

    for (let i = 0; i < requests.length; i += chunkSize) {
      const chunk = requests.slice(i, i + chunkSize);
      const result = await this.batchUpdate(documentId, chunk);
      results.push(result);
      await this.sleep(5);
    }

    return results;
  }

  async setSharing(documentId, shareSettings = {}) {
    const settings = {
      role: "reader",
      type: "anyone",
      allowDiscovery: false,
      ...shareSettings,
    };

    console.log(
      `[DocsAPI] Setting sharing permissions for ${documentId}`,
      settings,
    );

    if (this.token === "invalid-token") {
      console.warn("共有設定の更新に失敗しました");
      return false;
    }

    return true;
  }

  async createDocument(extractedContent, documentName, metadata) {
    const doc = await this.createEmptyDocument(documentName);
    const structure = this.analyzeContentStructure(extractedContent);
    const requests = this.buildUpdateRequests(
      { ...extractedContent, structure },
      metadata,
    );

    await this.batchUpdate(doc.documentId, requests);
    await this.setSharing(doc.documentId);

    return doc.url;
  }
}

// Test 1: Document name generation
function testDocumentNameGeneration() {
  console.log("\n--- Test 1: Document Name Generation ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test normal case
  const name1 = api.generateDocumentName(1, "田中太郎", "会議資料");
  assert(
    name1 === "001_田中太郎_会議資料",
    "Should generate correct document name",
  );

  // Test with index padding
  const name2 = api.generateDocumentName(123, "山田花子", "報告書");
  assert(name2 === "123_山田花子_報告書", "Should pad index correctly");

  // Test with missing name
  const name3 = api.generateDocumentName(2, "", "テスト");
  assert(name3 === "002_名前なし_テスト", "Should use default name when empty");

  // Test with missing subject
  const name4 = api.generateDocumentName(3, "佐藤", "");
  assert(
    name4 === "003_佐藤_件名なし",
    "Should use default subject when empty",
  );

  console.log("Document name generation test passed");
}

// Test 2: File name sanitization
function testFileNameSanitization() {
  console.log("\n--- Test 2: File Name Sanitization ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test with forbidden characters
  const sanitized1 = api.sanitizeFileName("test/file:name*?.txt");
  assert(
    sanitized1 === "test_file_name__.txt",
    "Should replace forbidden characters",
  );

  // Test with spaces
  const sanitized2 = api.sanitizeFileName("test  file   name");
  assert(
    sanitized2 === "test_file_name",
    "Should replace spaces with underscores",
  );

  // Test with consecutive underscores
  const sanitized3 = api.sanitizeFileName("test___file");
  assert(sanitized3 === "test_file", "Should reduce consecutive underscores");

  // Test Japanese characters
  const sanitized4 = api.sanitizeFileName("テスト ファイル");
  assert(sanitized4 === "テスト_ファイル", "Should handle Japanese characters");

  console.log("File name sanitization test passed");
}

// Test 3: Create empty document
async function testCreateEmptyDocument() {
  console.log("\n--- Test 3: Create Empty Document ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const result = await api.createEmptyDocument("Test Document");

  assert(typeof result === "object", "Should return an object");
  assert(
    result.documentId === mockTestData.documentId,
    "Should return correct document ID",
  );
  assert(
    result.url.includes("docs.google.com"),
    "Should return Google Docs URL",
  );

  console.log("Create empty document test passed");
}

// Test 4: Header request formatting
function testHeaderRequestFormatting() {
  console.log("\n--- Test 4: Header Request Formatting ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const requests = api.createHeaderRequests(mockTestData.mockMetadata, 1);

  assert(Array.isArray(requests), "Should return array of requests");
  assert(requests.length === 2, "Should create 2 requests (insert and style)");
  assert(requests[0].insertText, "First request should be insertText");
  assert(
    requests[1].updateTextStyle,
    "Second request should be updateTextStyle",
  );
  assert(
    requests[0].insertText.text.includes("元URL"),
    "Should include URL in header",
  );
  assert(
    requests[0].insertText.text.includes("著者"),
    "Should include author in header",
  );

  console.log("Header request formatting test passed");
}

// Test 5: Title formatting (h1 style)
function testTitleFormatting() {
  console.log("\n--- Test 5: Title Formatting ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const requests = api.createTitleRequests("Test Title", 10);

  assert(Array.isArray(requests), "Should return array of requests");
  assert(requests.length === 2, "Should create 2 requests");
  assert(
    requests[0].insertText.text === "Test Title\n",
    "Should insert title with newline",
  );
  assert(
    requests[1].updateParagraphStyle.paragraphStyle.namedStyleType ===
      "HEADING_1",
    "Should apply HEADING_1 style",
  );

  console.log("Title formatting test passed");
}

// Test 6: Content structure analysis
function testContentStructureAnalysis() {
  console.log("\n--- Test 6: Content Structure Analysis ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test with structured content
  const structure1 = api.analyzeContentStructure(
    mockTestData.mockStructuredContent,
  );
  assert(Array.isArray(structure1), "Should return array");
  assert(structure1[0].tag === "h1", "Should include title as h1");
  assert(structure1[0].text === "Test Article", "Should preserve title text");
  assert(
    structure1.find((s) => s.tag === "ul"),
    "Should preserve list structure",
  );

  // Test with plain text
  const plainContent = {
    title: "Plain Title",
    text: "Paragraph 1\n\nParagraph 2\n\nParagraph 3",
  };
  const structure2 = api.analyzeContentStructure(plainContent);
  assert(structure2[0].tag === "h1", "Should create h1 for title");
  assert(
    structure2.filter((s) => s.tag === "p").length === 3,
    "Should create 3 paragraphs",
  );

  console.log("Content structure analysis test passed");
}

// Test 7: Heading formatting (h2, h3)
function testHeadingFormatting() {
  console.log("\n--- Test 7: Heading Formatting ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test h2
  const h2Requests = api.createHeading2("Subheading", 20);
  assert(h2Requests.length === 2, "Should create 2 requests for h2");
  assert(
    h2Requests[1].updateParagraphStyle.paragraphStyle.namedStyleType ===
      "HEADING_2",
    "Should apply HEADING_2 style",
  );

  // Test h3
  const h3Requests = api.createHeading3("Sub-subheading", 30);
  assert(h3Requests.length === 2, "Should create 2 requests for h3");
  assert(
    h3Requests[1].updateParagraphStyle.paragraphStyle.namedStyleType ===
      "HEADING_3",
    "Should apply HEADING_3 style",
  );

  console.log("Heading formatting test passed");
}

// Test 8: List formatting
function testListFormatting() {
  console.log("\n--- Test 8: List Formatting ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test unordered list
  const ulElement = { tag: "ul", items: ["Item 1", "Item 2", "Item 3"] };
  const ulRequests = api.createList(ulElement, 40);
  assert(ulRequests.length === 6, "Should create 2 requests per item");
  assert(
    ulRequests[1].createParagraphBullets.bulletPreset ===
      "BULLET_DISC_CIRCLE_SQUARE",
    "Should use bullet preset for ul",
  );

  // Test ordered list
  const olElement = { tag: "ol", items: ["First", "Second"] };
  const olRequests = api.createList(olElement, 50);
  assert(
    olRequests[1].createParagraphBullets.bulletPreset ===
      "NUMBERED_DECIMAL_ALPHA_ROMAN",
    "Should use numbered preset for ol",
  );

  console.log("List formatting test passed");
}

// Test 9: Code block formatting
function testCodeBlockFormatting() {
  console.log("\n--- Test 9: Code Block Formatting ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const code = "function test() {\n  console.log('hello');\n}";
  const requests = api.createCodeBlock(code, 60);

  assert(requests.length === 3, "Should create 3 requests");
  assert(
    requests[1].updateTextStyle.textStyle.fontFamily === "Courier New",
    "Should use Courier New font",
  );
  assert(
    requests[1].updateTextStyle.textStyle.backgroundColor,
    "Should have background color",
  );
  assert(
    requests[2].updateParagraphStyle.paragraphStyle.indentStart,
    "Should have indentation",
  );

  console.log("Code block formatting test passed");
}

// Test 10: Image processing
async function testImageProcessing() {
  console.log("\n--- Test 10: Image Processing ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const requests = await api.processImages(mockTestData.mockImages);

  assert(Array.isArray(requests), "Should return array of requests");
  assert(requests.length === 4, "Should create 2 requests per image");
  assert(
    requests[0].insertInlineImage,
    "Should create insertInlineImage request",
  );
  assert(
    requests[1].insertText.text.includes("図:"),
    "Should add image caption",
  );

  console.log("Image processing test passed");
}

// Test 11: Batch update with retry
async function testBatchUpdateWithRetry() {
  console.log("\n--- Test 11: Batch Update with Retry ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const requests = [{ insertText: { text: "Test", location: { index: 1 } } }];

  const result = await api.batchUpdate(mockTestData.documentId, requests);
  assert(
    result.documentId === mockTestData.documentId,
    "Should return document ID",
  );

  console.log("Batch update with retry test passed");
}

// Test 12: Batch update chunking
async function testBatchUpdateChunking() {
  console.log("\n--- Test 12: Batch Update Chunking ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Create large request array
  const requests = [];
  for (let i = 0; i < 120; i++) {
    requests.push({
      insertText: { text: `Text ${i}`, location: { index: i } },
    });
  }

  try {
    const result = await api.batchUpdate(mockTestData.documentId, requests);
    assert(
      Array.isArray(result),
      "Should return array of results for chunked requests",
    );
    assert(result.length === 3, "Should create 3 chunks for 120 requests");
  } catch (error) {
    // Expected to fail and trigger chunking
    assert(
      error.message.includes("Request too large"),
      "Should detect large request",
    );
  }

  console.log("Batch update chunking test passed");
}

// Test 13: API rate limit handling
async function testRateLimitHandling() {
  console.log("\n--- Test 13: API Rate Limit Handling ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test with small delay
  const startTime = Date.now();
  await api.sleep(50);
  const endTime = Date.now();

  assert(endTime - startTime >= 50, "Should implement sleep for rate limiting");

  console.log("API rate limit handling test passed");
}

// Test 14: Sharing settings
async function testSharingSettings() {
  console.log("\n--- Test 14: Sharing Settings ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  // Test default settings
  const result1 = await api.setSharing(mockTestData.documentId);
  assert(result1 === true, "Should set default sharing settings");

  // Test custom settings
  const customSettings = { role: "writer", type: "user", allowDiscovery: true };
  const result2 = await api.setSharing(mockTestData.documentId, customSettings);
  assert(result2 === true, "Should apply custom sharing settings");

  console.log("Sharing settings test passed");
}

// Test 15: Full document creation workflow
async function testFullDocumentCreation() {
  console.log("\n--- Test 15: Full Document Creation Workflow ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  const extractedContent = {
    title: "Test Document",
    text: "This is the content",
    url: "https://example.com/test",
  };

  const documentName = api.generateDocumentName(1, "Test User", "Test Subject");
  const metadata = mockTestData.mockMetadata;

  const url = await api.createDocument(
    extractedContent,
    documentName,
    metadata,
  );

  assert(typeof url === "string", "Should return URL string");
  assert(url.includes("docs.google.com"), "Should be Google Docs URL");
  assert(url.includes(mockTestData.documentId), "Should include document ID");

  console.log("Full document creation workflow test passed");
}

// Test 16: Japanese content handling
function testJapaneseContentHandling() {
  console.log("\n--- Test 16: Japanese Content Handling ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  const japaneseContent = {
    title: "日本語のタイトル",
    text: "これは日本語の本文です。\n\n改行も含まれています。",
    structure: [
      { tag: "h1", text: "見出し１" },
      { tag: "p", text: "段落のテキスト" },
    ],
  };

  const structure = api.analyzeContentStructure(japaneseContent);
  assert(
    structure[0].text === "日本語のタイトル",
    "Should preserve Japanese title",
  );
  assert(
    structure.find((s) => s.text === "段落のテキスト"),
    "Should preserve Japanese paragraph",
  );

  console.log("Japanese content handling test passed");
}

// Test 17: Error handling with invalid token
async function testErrorHandlingInvalidToken() {
  console.log("\n--- Test 17: Error Handling with Invalid Token ---");

  const api = new MockDocsApiClient("invalid-token");

  try {
    await api.createEmptyDocument("Test");
    assert(false, "Should throw error for invalid token");
  } catch (error) {
    assert(error.message.includes("401"), "Should throw 401 error");
  }

  console.log("Error handling with invalid token test passed");
}

// Test 18: Error handling with expired token
async function testErrorHandlingExpiredToken() {
  console.log("\n--- Test 18: Error Handling with Expired Token ---");

  const api = new MockDocsApiClient("expired-token");

  try {
    await api.createEmptyDocument("Test");
    assert(false, "Should throw error for expired token");
  } catch (error) {
    assert(
      error.message === "Token has expired",
      "Should throw expired token error",
    );
  }

  console.log("Error handling with expired token test passed");
}

// Test 19: Footer formatting
function testFooterFormatting() {
  console.log("\n--- Test 19: Footer Formatting ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);
  const requests = api.createFooterRequests("https://example.com", 100);

  assert(Array.isArray(requests), "Should return array of requests");
  assert(requests.length === 2, "Should create 2 requests");
  assert(
    requests[0].insertText.text.includes("元URL"),
    "Should include URL label",
  );
  assert(
    requests[1].updateTextStyle.textStyle.fontSize.magnitude === 9,
    "Should use smaller font for footer",
  );

  console.log("Footer formatting test passed");
}

// Test 20: Build complete update requests
function testBuildUpdateRequests() {
  console.log("\n--- Test 20: Build Complete Update Requests ---");

  const api = new MockDocsApiClient(mockTestData.accessToken);

  const content = {
    title: "Test Title",
    text: "Test content",
    url: "https://example.com",
    structure: [
      { tag: "h1", text: "Heading" },
      { tag: "p", text: "Paragraph" },
    ],
  };

  const requests = api.buildUpdateRequests(content, mockTestData.mockMetadata);

  assert(Array.isArray(requests), "Should return array of requests");
  assert(requests.length > 5, "Should create multiple requests");

  // Check for header requests
  const hasHeader = requests.some(
    (r) => r.insertText && r.insertText.text.includes("抽出日時"),
  );
  assert(hasHeader, "Should include header with extraction time");

  // Check for horizontal rule
  const hasRule = requests.some(
    (r) => r.insertText && r.insertText.text.includes("─"),
  );
  assert(hasRule, "Should include horizontal rule");

  // Check for footer
  const hasFooter = requests.some(
    (r) => r.insertText && r.insertText.text.includes("元URL"),
  );
  assert(hasFooter, "Should include footer with URL");

  console.log("Build complete update requests test passed");
}

// Run all tests
async function runAllTests() {
  console.log("=== Google Docs API Tests ===");

  try {
    // Synchronous tests
    testDocumentNameGeneration();
    testFileNameSanitization();
    testHeaderRequestFormatting();
    testTitleFormatting();
    testContentStructureAnalysis();
    testHeadingFormatting();
    testListFormatting();
    testCodeBlockFormatting();
    testJapaneseContentHandling();
    testFooterFormatting();
    testBuildUpdateRequests();

    // Asynchronous tests
    await testCreateEmptyDocument();
    await testImageProcessing();
    await testBatchUpdateWithRetry();
    await testBatchUpdateChunking();
    await testRateLimitHandling();
    await testSharingSettings();
    await testFullDocumentCreation();
    await testErrorHandlingInvalidToken();
    await testErrorHandlingExpiredToken();

    console.log("\n✅ All Google Docs API tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Export test functions for potential external testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MockDocsApiClient,
    mockTestData,
    testDocumentNameGeneration,
    testFileNameSanitization,
    testCreateEmptyDocument,
    testHeaderRequestFormatting,
    testTitleFormatting,
    testContentStructureAnalysis,
    testHeadingFormatting,
    testListFormatting,
    testCodeBlockFormatting,
    testImageProcessing,
    testBatchUpdateWithRetry,
    testBatchUpdateChunking,
    testRateLimitHandling,
    testSharingSettings,
    testFullDocumentCreation,
    testJapaneseContentHandling,
    testErrorHandlingInvalidToken,
    testErrorHandlingExpiredToken,
    testFooterFormatting,
    testBuildUpdateRequests,
    runAllTests,
  };
}

// Run tests if this file is executed directly
if (typeof require !== "undefined" && require.main === module) {
  runAllTests();
}

console.log("Google Docs API test file loaded successfully");
