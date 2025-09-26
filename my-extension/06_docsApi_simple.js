// シンプルなGoogle Docs API ラッパー
const DOCS_API_BASE = "https://docs.googleapis.com/v1/documents";

export async function createSimpleDoc(accessToken, title, content) {
  try {
    // Step 1: 空のドキュメントを作成
    const createResponse = await fetch(DOCS_API_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title || "無題のドキュメント",
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error("Failed to create document:", error);
      throw new Error(`Failed to create document: ${createResponse.status}`);
    }

    const doc = await createResponse.json();
    const documentId = doc.documentId;
    console.log(`Document created with ID: ${documentId}`);

    // Step 2: コンテンツを追加（改行を保持）
    if (content && content.trim()) {
      console.log("Original content length:", content.length);
      console.log("Content preview:", content.substring(0, 200));

      const updateResponse = await fetch(
        `${DOCS_API_BASE}/${documentId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: content,
                },
              },
            ],
          }),
        },
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        console.error("Failed to update document:", error);
        // エラーが発生してもURLは返す
      } else {
        console.log("Document content updated successfully");
      }
    }

    // Google DocsのURLを返す
    return `https://docs.google.com/document/d/${documentId}/edit`;
  } catch (error) {
    console.error("Error in createSimpleDoc:", error);
    throw error;
  }
}
