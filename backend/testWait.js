require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.files.upload({
      file: 'd:\\test\\Comflex\\backend\\package.json',
      mimeType: 'text/plain',
      displayName: 'test'
    });
    console.log('Upload state:', res.state);
    let current = res;
    while (current.state === 'PROCESSING') {
      console.log('waiting...');
      await new Promise(r => setTimeout(r, 2000));
      current = await ai.files.get({ name: current.name });
    }
    console.log('Final state:', current.state);
  } catch (e) {
    console.error(e);
  }
}
test();
