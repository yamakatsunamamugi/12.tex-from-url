// Google Docs削除機能
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// DocsのURLからDocument IDを抽出
function extractDocumentId(url) {
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9-_]+)/, // 標準形式
    /docs\.google\.com\/.*[?&]id=([a-zA-Z0-9-_]+)/, // パラメータ形式
    /^([a-zA-Z0-9-_]+)$/, // IDのみ
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Google Docsファイルを削除（ゴミ箱へ移動）
export async function deleteGoogleDoc(accessToken, docUrl) {
  try {
    // URLが空またはGoogle DocsのURLでない場合はスキップ
    if (!docUrl || !docUrl.includes("docs.google.com")) {
      console.log(`Skipping invalid URL: ${docUrl}`);
      return {
        success: false,
        error: `Invalid document URL format: ${docUrl}`,
      };
    }

    const documentId = extractDocumentId(docUrl);
    if (!documentId) {
      throw new Error(`Invalid document URL: ${docUrl}`);
    }

    console.log(`Deleting document: ${documentId}`);

    // Google Drive APIでファイルを削除（ゴミ箱へ）
    const response = await fetch(`${DRIVE_API_BASE}/${documentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 204) {
      console.log(`Document ${documentId} moved to trash successfully`);
      return { success: true, documentId };
    } else if (response.status === 404) {
      console.warn(`Document ${documentId} not found`);
      return { success: false, error: "Document not found" };
    } else {
      const error = await response.text();
      console.error(`Failed to delete document: ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.error("Error deleting document:", error);
    return { success: false, error: error.message };
  }
}

// Google Docsファイルを完全削除（復元不可）
export async function permanentlyDeleteGoogleDoc(accessToken, docUrl) {
  try {
    const documentId = extractDocumentId(docUrl);
    if (!documentId) {
      throw new Error(`Invalid document URL: ${docUrl}`);
    }

    console.log(`Permanently deleting document: ${documentId}`);

    // supportsAllDrivesパラメータを追加して完全削除
    const response = await fetch(
      `${DRIVE_API_BASE}/${documentId}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.status === 204) {
      console.log(`Document ${documentId} permanently deleted`);
      return { success: true, documentId };
    } else {
      const error = await response.text();
      console.error(`Failed to permanently delete: ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.error("Error permanently deleting:", error);
    return { success: false, error: error.message };
  }
}

// スプレッドシートのセルをクリア
export async function clearSheetCell(accessToken, sheetId, row, column) {
  try {
    const columnLetter = indexToColumn(column);
    const range = `${columnLetter}${row}`;

    console.log(`Clearing cell ${range} in sheet ${sheetId}`);

    const url = `${SHEETS_API_BASE}/${sheetId}/values/${range}:clear`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to clear cell: ${error}`);
      return { success: false, error };
    }

    console.log(`Cell ${range} cleared successfully`);
    return { success: true, range };
  } catch (error) {
    console.error("Error clearing cell:", error);
    return { success: false, error: error.message };
  }
}

// 複数のDocsを一括削除
export async function batchDeleteDocs(accessToken, docUrls) {
  const results = [];

  for (const docUrl of docUrls) {
    const result = await deleteGoogleDoc(accessToken, docUrl);
    results.push({
      url: docUrl,
      ...result,
    });

    // API制限対策
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

// スプレッドシートから行を削除
export async function deleteSheetRow(accessToken, sheetId, rowNumber) {
  try {
    const requests = [
      {
        deleteDimension: {
          range: {
            sheetId: 0, // デフォルトシート
            dimension: "ROWS",
            startIndex: rowNumber - 1, // 0-indexed
            endIndex: rowNumber,
          },
        },
      },
    ];

    const url = `${SHEETS_API_BASE}/${sheetId}:batchUpdate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to delete row: ${error}`);
      return { success: false, error };
    }

    console.log(`Row ${rowNumber} deleted successfully`);
    return { success: true, rowNumber };
  } catch (error) {
    console.error("Error deleting row:", error);
    return { success: false, error: error.message };
  }
}

// 列インデックスを列文字に変換
function indexToColumn(index) {
  let column = "";
  let temp = index;
  while (temp >= 0) {
    column = String.fromCharCode((temp % 26) + 65) + column;
    temp = Math.floor(temp / 26) - 1;
  }
  return column;
}
