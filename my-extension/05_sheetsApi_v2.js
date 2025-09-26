const SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

// ヘッダー（2行目）を取得して列名と列番号のマッピングを作成
export async function getSheetHeaders(accessToken, sheetId) {
  try {
    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values/2:2`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Sheets API Error (headers):", error);
      throw new Error(`Failed to get headers: ${response.status}`);
    }

    const data = await response.json();
    const headers = data.values && data.values[0] ? data.values[0] : [];

    console.log("Found headers:", headers);

    // ヘッダー名と列インデックスのマッピングを作成
    const headerMap = {};
    headers.forEach((header, index) => {
      if (header) {
        headerMap[header] = index;
        // 列文字（A, B, C...）もマッピング
        headerMap[`col_${indexToColumn(index)}`] = index;
      }
    });

    return {
      headers,
      headerMap,
      urlColumn: findUrlColumn(headers, headerMap),
      docColumn: findDocColumn(headers, headerMap),
      nameColumn: findNameColumn(headers, headerMap),
      subjectColumn: findSubjectColumn(headers, headerMap),
    };
  } catch (error) {
    console.error("Error in getSheetHeaders:", error);
    throw error;
  }
}

// 「必要なURL」列を探す
function findUrlColumn(headers, headerMap) {
  const urlColumnNames = [
    "必要なURL",
    "URL",
    "必要なurl",
    "url",
    "リンク",
    "Link",
  ];

  for (const name of urlColumnNames) {
    if (headerMap[name] !== undefined) {
      console.log(`Found URL column: "${name}" at index ${headerMap[name]}`);
      return headerMap[name];
    }
  }

  // 見つからない場合は0（A列）をデフォルトとする
  console.warn("URL column not found in headers, using column A as default");
  return 0;
}

// 「ドキュメント化」列を探す
function findDocColumn(headers, headerMap) {
  const docColumnNames = [
    "ドキュメント化",
    "ドキュメント",
    "Document",
    "Docs",
    "GoogleDocs",
    "結果",
  ];

  for (const name of docColumnNames) {
    if (headerMap[name] !== undefined) {
      console.log(
        `Found Document column: "${name}" at index ${headerMap[name]}`,
      );
      return headerMap[name];
    }
  }

  // 見つからない場合は最後の列の次を使用
  console.warn("Document column not found, will use next empty column");
  return headers.length;
}

// 「名前」列を探す
function findNameColumn(headers, headerMap) {
  const nameColumnNames = ["名前", "Name", "氏名", "お名前"];

  for (const name of nameColumnNames) {
    if (headerMap[name] !== undefined) {
      console.log(`Found Name column: "${name}" at index ${headerMap[name]}`);
      return headerMap[name];
    }
  }

  console.warn("Name column not found");
  return -1;
}

// 「件名」列を探す
function findSubjectColumn(headers, headerMap) {
  const subjectColumnNames = ["件名", "Subject", "タイトル", "Title", "題名"];

  for (const name of subjectColumnNames) {
    if (headerMap[name] !== undefined) {
      console.log(
        `Found Subject column: "${name}" at index ${headerMap[name]}`,
      );
      return headerMap[name];
    }
  }

  console.warn("Subject column not found");
  return -1;
}

// 列インデックスを列文字に変換（0 -> A, 1 -> B, 25 -> Z, 26 -> AA）
function indexToColumn(index) {
  let column = "";
  let temp = index;
  while (temp >= 0) {
    column = String.fromCharCode((temp % 26) + 65) + column;
    temp = Math.floor(temp / 26) - 1;
  }
  return column;
}

// 指定された列からURLを取得（3行目以降）
export async function getUrlsFromColumn(
  accessToken,
  sheetId,
  columnIndex,
  maxRows = 1000,
) {
  try {
    const columnLetter = indexToColumn(columnIndex);
    const range = `${columnLetter}3:${columnLetter}${maxRows}`;

    console.log(
      `Fetching URLs from column ${columnLetter} (index ${columnIndex}), range: ${range}`,
    );

    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values/${range}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Sheets API Error (URLs):", error);
      throw new Error(`Failed to get URLs: ${response.status}`);
    }

    const data = await response.json();
    const urls = data.values ? data.values.map((row) => row[0] || "") : [];

    console.log(`Retrieved ${urls.length} URLs from column ${columnLetter}`);
    console.log(
      "First 5 URLs:",
      urls.slice(0, 5).map((url, i) => `Row ${i + 3}: ${url}`),
    );

    // 空でないURLの数をカウント
    const validUrls = urls.filter((url) => url && url.trim());
    console.log(`Found ${validUrls.length} non-empty URLs`);

    return urls;
  } catch (error) {
    console.error("Error in getUrlsFromColumn:", error);
    throw error;
  }
}

// DocsのURLを指定された列に書き込む
export async function writeDocUrl(
  accessToken,
  sheetId,
  row,
  columnIndex,
  docUrl,
) {
  try {
    const columnLetter = indexToColumn(columnIndex);
    const cellAddress = `${columnLetter}${row}`;

    console.log(`Writing Doc URL to cell ${cellAddress}`);

    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values/${cellAddress}?valueInputOption=RAW`;

    const body = {
      values: [[docUrl]],
    };

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Sheets API Error (write):", error);
      throw new Error(`Failed to write Doc URL: ${response.status}`);
    }

    console.log(`Successfully wrote Doc URL to ${cellAddress}`);
    return true;
  } catch (error) {
    console.error("Error in writeDocUrl:", error);
    throw error;
  }
}

// 特定の行のデータを取得
export async function getRowData(accessToken, sheetId, rowNumber) {
  try {
    const range = `${rowNumber}:${rowNumber}`;
    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values/${range}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get row data: ${response.status}`);
    }

    const data = await response.json();
    return data.values && data.values[0] ? data.values[0] : [];
  } catch (error) {
    console.error("Error in getRowData:", error);
    return [];
  }
}

// スプレッドシート全体の情報を取得（デバッグ用）
export async function getSheetInfo(accessToken, sheetId) {
  try {
    // 最初の10行を取得して構造を確認
    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values/1:10`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get sheet info: ${response.status}`);
    }

    const data = await response.json();

    console.log("=== Sheet Structure ===");
    console.log("First 10 rows:");
    data.values?.forEach((row, i) => {
      console.log(`Row ${i + 1}:`, row);
    });

    return data.values;
  } catch (error) {
    console.error("Error in getSheetInfo:", error);
    throw error;
  }
}
