import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const settings = JSON.parse(fs.readFileSync('./data/settings.json', 'utf-8'));
const apiKey = settings.apiKey;

console.log("Testing with API Key:", apiKey.slice(0, 10) + "...");

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent("Reply in exactly two words.");
  console.log("Success! Response:", result.response.text());
} catch (e) {
  console.error("Failed to run Gemini:", e.message);
}
