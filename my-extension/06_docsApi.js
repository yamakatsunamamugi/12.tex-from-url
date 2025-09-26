export class DocsApiClient {
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
    const response = await fetch(`${this.baseUrl}/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: documentName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `Failed to create document: ${response.status}`,
      );
    }

    const doc = await response.json();
    return {
      documentId: doc.documentId,
      url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
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
            namedStyleType: "HEADING_1",
            spaceAbove: { magnitude: 18, unit: "PT" },
            spaceBelow: { magnitude: 6, unit: "PT" },
          },
          fields: "namedStyleType,spaceAbove,spaceBelow",
        },
      },
    ];
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
        const response = await fetch(
          `${this.baseUrl}/documents/${documentId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ requests }),
          },
        );

        if (response.status === 429) {
          const delay = Math.pow(2, i) * 1000;
          await this.sleep(delay);
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error.message);
        }

        return await response.json();
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

      await this.sleep(500);
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

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${documentId}/permissions`;

    const response = await fetch(driveUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: settings.role,
        type: settings.type,
        allowFileDiscovery: settings.allowDiscovery,
      }),
    });

    if (!response.ok) {
      console.warn("共有設定の更新に失敗しました");
    }
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

export class DocsApiWrapper extends DocsApiClient {
  constructor(accessToken) {
    super(accessToken);
    this.accessToken = accessToken;
    this.docsApiUrl = "https://docs.googleapis.com/v1/documents";
  }

  async makeRequest(url, method = "GET", body = null) {
    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Docs API request failed:", error);
      throw error;
    }
  }

  async createDoc(title, text, metadata = {}) {
    console.log(`[DocsAPI] Creating document with title: ${title}`);

    try {
      const extractedContent = {
        title: title,
        text: text,
        url: metadata.url,
      };

      const documentName = this.generateDocumentName(
        metadata.index || 1,
        metadata.name || "",
        metadata.subject || title,
      );

      const url = await this.createDocument(
        extractedContent,
        documentName,
        metadata,
      );

      console.log(`[DocsAPI] Document created successfully:`, url);

      return url;
    } catch (error) {
      console.error("[DocsAPI] Failed to create and populate document:", error);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  async batchCreateDocs(documents) {
    console.log(`[DocsAPI] Batch creating ${documents.length} documents`);

    const results = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      try {
        const metadata = {
          ...doc.metadata,
          index: i + 1,
        };
        const url = await this.createDoc(doc.title, doc.text, metadata);
        results.push({
          success: true,
          url: url,
          title: doc.title,
        });
      } catch (error) {
        console.error(
          `[DocsAPI] Failed to create document "${doc.title}":`,
          error,
        );
        results.push({
          success: false,
          error: error.message,
          title: doc.title,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[DocsAPI] Batch creation complete: ${successCount}/${documents.length} successful`,
    );

    return results;
  }

  async getDocument(documentId) {
    console.log(`[DocsAPI] Getting document: ${documentId}`);

    const url = `${this.docsApiUrl}/${documentId}`;

    try {
      const response = await this.makeRequest(url);
      console.log(`[DocsAPI] Document retrieved successfully:`, {
        documentId: response.documentId,
        title: response.title,
      });
      return response;
    } catch (error) {
      console.error("[DocsAPI] Failed to get document:", error);
      throw new Error(`Failed to get document: ${error.message}`);
    }
  }

  async moveToFolder(fileId, folderId) {
    console.log(`[DocsAPI] Moving document ${fileId} to folder ${folderId}`);

    const url = `${this.driveApiUrl}/${fileId}?addParents=${folderId}&removeParents=root`;

    try {
      const response = await this.makeRequest(url, "PATCH");
      console.log(`[DocsAPI] Document moved to folder successfully`);
      return response;
    } catch (error) {
      console.error("[DocsAPI] Failed to move document to folder:", error);
      throw new Error(`Failed to move document: ${error.message}`);
    }
  }

  formatContentForDoc(content) {
    const lines = [];

    lines.push(`${content.title}\n\n`);

    if (content.metadata && content.metadata.description) {
      lines.push(`📝 概要\n${content.metadata.description}\n\n`);
    }

    lines.push(`🔗 ソースURL\n${content.url}\n`);
    lines.push(`🏢 ドメイン: ${content.domain}\n`);
    lines.push(
      `📅 抽出日時: ${new Date(content.extractedAt).toLocaleString("ja-JP")}\n`,
    );
    lines.push(`📊 単語数: ${content.wordCount}\n\n`);

    if (content.metadata) {
      if (content.metadata.author) {
        lines.push(`✍️ 著者: ${content.metadata.author}\n`);
      }
      if (content.metadata.publishDate) {
        lines.push(`📅 公開日: ${content.metadata.publishDate}\n`);
      }
      if (content.metadata.keywords) {
        lines.push(`🏷️ キーワード: ${content.metadata.keywords}\n`);
      }
      lines.push("\n");
    }

    lines.push(`${"─".repeat(50)}\n\n`);

    lines.push(`📄 本文\n\n`);

    const paragraphs = content.text
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => p.trim());

    paragraphs.forEach((paragraph) => {
      if (paragraph.length > 1000) {
        const chunks = paragraph.match(/.{1,1000}[。！？\s]|.{1,1000}/g) || [
          paragraph,
        ];
        chunks.forEach((chunk) => {
          lines.push(`${chunk}\n\n`);
        });
      } else {
        lines.push(`${paragraph}\n\n`);
      }
    });

    return lines.join("");
  }

  async insertText(documentId, text, index = 1) {
    console.log(`[DocsAPI] Inserting text into document: ${documentId}`);

    const requests = [
      {
        insertText: {
          location: {
            index: index,
          },
          text: text,
        },
      },
    ];

    const body = {
      requests: requests,
    };

    const url = `${this.docsApiUrl}/${documentId}:batchUpdate`;

    try {
      const response = await this.makeRequest(url, "POST", body);
      console.log(`[DocsAPI] Text inserted successfully`);
      return response;
    } catch (error) {
      console.error("[DocsAPI] Failed to insert text:", error);
      throw new Error(`Failed to insert text: ${error.message}`);
    }
  }

  async formatDocument(documentId) {
    console.log(`[DocsAPI] Formatting document: ${documentId}`);

    const requests = [
      {
        updateParagraphStyle: {
          range: {
            startIndex: 1,
            endIndex: 2,
          },
          paragraphStyle: {
            namedStyleType: "TITLE",
          },
          fields: "namedStyleType",
        },
      },
      {
        updateTextStyle: {
          range: {
            startIndex: 1,
            endIndex: 2,
          },
          textStyle: {
            bold: true,
            fontSize: {
              magnitude: 18,
              unit: "PT",
            },
          },
          fields: "bold,fontSize",
        },
      },
    ];

    const body = {
      requests: requests,
    };

    const url = `${this.docsApiUrl}/${documentId}:batchUpdate`;

    try {
      const response = await this.makeRequest(url, "POST", body);
      console.log(`[DocsAPI] Document formatted successfully`);
      return response;
    } catch (error) {
      console.error("[DocsAPI] Failed to format document:", error);
      throw new Error(`Failed to format document: ${error.message}`);
    }
  }
}

export async function createDoc(accessToken, title, text, metadata = {}) {
  const api = new DocsApiWrapper(accessToken);
  return await api.createDoc(title, text, metadata);
}

export async function batchCreateDocs(accessToken, documents) {
  const api = new DocsApiWrapper(accessToken);
  return await api.batchCreateDocs(documents);
}

export async function getDocument(accessToken, documentId) {
  const api = new DocsApiWrapper(accessToken);
  return await api.getDocument(documentId);
}

export default DocsApiWrapper;
