const SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export async function getUrlsFromSheet(accessToken, sheetId, range) {
  try {
    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values/${range}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Sheets API Error:", error);
      throw new Error(`Failed to get sheet data: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `Successfully fetched ${data.values?.length || 0} rows from sheet`,
    );

    const urls = data.values ? data.values.map((row) => row[0] || "") : [];
    return urls;
  } catch (error) {
    console.error("Error in getUrlsFromSheet:", error);
    throw error;
  }
}

export async function writeDocUrl(accessToken, sheetId, cellAddress, docUrl) {
  try {
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
      console.error("Sheets API Error:", error);
      throw new Error(`Failed to write to sheet: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Successfully wrote to cell ${cellAddress}`);
    return result;
  } catch (error) {
    console.error("Error in writeDocUrl:", error);
    throw error;
  }
}

export async function batchUpdateCells(accessToken, sheetId, updates) {
  try {
    const url = `${SHEETS_API_BASE_URL}/${sheetId}/values:batchUpdate`;

    const requests = updates.map((update) => ({
      range: update.range,
      values: [[update.value]],
    }));

    const body = {
      valueInputOption: "RAW",
      data: requests,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Sheets API Batch Update Error:", error);
      throw new Error(`Failed to batch update sheet: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Successfully batch updated ${updates.length} cells`);
    return result;
  } catch (error) {
    console.error("Error in batchUpdateCells:", error);
    throw error;
  }
}
