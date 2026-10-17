// Runs the app with a canned extractor instead of Gemini, so the review flow can be
// tried without an API key. Uses an in-memory database that resets on restart.
//
//   npm run dev:mock
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { createMockExtractor } from './mock-extractor.js';

const port = Number(process.env.PORT) || 3000;
createApp({ db: openDb(':memory:'), extractor: createMockExtractor() }).listen(port, () => {
  console.log(`Document Extractor (MOCK extractor, in-memory DB) at http://localhost:${port}`);
});
