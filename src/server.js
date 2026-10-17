import { GoogleGenAI } from '@google/genai';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { createExtractor, DEFAULT_MODEL } from './extractor.js';

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || 'data/records.db';
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

let extractor = null;
if (apiKey) {
  extractor = createExtractor({ client: new GoogleGenAI({ apiKey }), model });
} else {
  console.warn('GEMINI_API_KEY is not set: the dashboard works, but extraction is disabled.');
}

const app = createApp({ db: openDb(dbPath), extractor });
app.listen(port, () => {
  console.log(`Document Extractor running at http://localhost:${port} (model: ${model}, db: ${dbPath})`);
});
