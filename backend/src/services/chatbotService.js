const { GoogleGenAI } = require('@google/genai');

let ai;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 120000 } 
  });
}

async function uploadFileToGemini(filePath, mimeType, displayName) {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');
  try {
    const response = await ai.files.upload({
      file: filePath,
      mimeType: mimeType,
      displayName: displayName
    });
    return {
      uri: response.uri,
      name: response.name 
    };
  } catch (error) {
    console.error('Error uploading to Gemini:', error);
    throw new Error('Failed to upload file to Gemini AI');
  }
}

async function deleteGeminiFile(geminiName) {
  if (!ai) return;
  try {
    await ai.files.delete({ name: geminiName });
  } catch (err) {
    console.error('Error deleting Gemini file:', err);
  }
}

async function chatWithContext({ fileUri, mimeType }, userQuery) {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');
  const prompt = `You are a helpful academic assistant. Answer the user's question strictly based on the provided notes context.
If the answer is not found in the notes, say: "I couldn't find that in your notes."

Question: ${userQuery}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error('Error with GenAI generation:', error);
    throw new Error('Failed to generate response from Gemini');
  }
}

module.exports = {
  uploadFileToGemini,
  deleteGeminiFile,
  chatWithContext
};
