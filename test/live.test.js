// Calls the real Gemini API on the sample PDFs. Skipped unless GEMINI_API_KEY is set.
//   GEMINI_API_KEY=... npm run test:live
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createExtractor, DEFAULT_MODEL } from '../src/extractor.js';
import { FIELD_NAMES } from '../src/fields.js';

const apiKey = process.env.GEMINI_API_KEY;
const skip = apiKey ? false : 'GEMINI_API_KEY not set';
const sample = (file) => readFileSync(fileURLToPath(new URL(`../samples/${file}`, import.meta.url)));

async function extractor() {
  const { GoogleGenAI } = await import('@google/genai');
  return createExtractor({ client: new GoogleGenAI({ apiKey }), model: process.env.GEMINI_MODEL || DEFAULT_MODEL });
}

const simplify = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

test('clean sample: every field is extracted', { skip, timeout: 120_000 }, async () => {
  const result = await (await extractor()).extract(sample('quote-clean.pdf'));
  const values = Object.fromEntries(result.fields.map((f) => [f.name, f]));
  assert.deepEqual(result.missing, []);
  assert.deepEqual(Object.keys(values), FIELD_NAMES);
  assert.equal(simplify(values.quote_reference.value), simplify('HLM-2026-04417'));
  assert.equal(values.currency.value, 'GBP');
  assert.equal(values.start_date.value, '2026-11-01');
  assert.equal(values.cover_limit.page, 2);
});

test('unclear sample: cover limit is low confidence or missing', { skip, timeout: 120_000 }, async () => {
  const result = await (await extractor()).extract(sample('quote-unclear-cover.pdf'));
  const cover = result.fields.find((f) => f.name === 'cover_limit');
  assert.ok(!cover || cover.confidence === 'low', `cover_limit came back ${JSON.stringify(cover)}`);
});

test('duplicate sample: same quote reference as the clean sample', { skip, timeout: 120_000 }, async () => {
  const result = await (await extractor()).extract(sample('quote-duplicate.pdf'));
  const ref = result.fields.find((f) => f.name === 'quote_reference');
  assert.equal(simplify(ref.value), simplify('HLM-2026-04417'));
});
