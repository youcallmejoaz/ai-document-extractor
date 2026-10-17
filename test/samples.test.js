import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLES, writeSamples } from '../scripts/make-samples.js';
import { FIELD_NAMES } from '../src/fields.js';

const samplesDir = fileURLToPath(new URL('../samples', import.meta.url));
const byFile = Object.fromEntries(SAMPLES.map((s) => [s.file, s]));

test('the three committed sample PDFs exist and are PDFs', () => {
  assert.deepEqual(Object.keys(byFile), ['quote-clean.pdf', 'quote-unclear-cover.pdf', 'quote-duplicate.pdf']);
  for (const { file } of SAMPLES) {
    const bytes = readFileSync(join(samplesDir, file));
    assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', file);
  }
});

test('sample expectations cover every field', () => {
  for (const sample of SAMPLES) assert.deepEqual(Object.keys(sample.expected), FIELD_NAMES, sample.file);
});

test('the duplicate sample reuses the clean sample quote reference', () => {
  assert.equal(
    byFile['quote-duplicate.pdf'].expected.quote_reference,
    byFile['quote-clean.pdf'].expected.quote_reference,
  );
  assert.notEqual(
    byFile['quote-unclear-cover.pdf'].expected.quote_reference,
    byFile['quote-clean.pdf'].expected.quote_reference,
  );
});

test('the generator produces valid PDFs with the expected page counts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'samples-'));
  await writeSamples(dir);
  const pageCount = (file) => {
    const text = readFileSync(join(dir, file)).toString('latin1');
    return Number(text.match(/\/Type \/Pages\s*\/Count (\d+)/)[1]);
  };
  assert.equal(pageCount('quote-clean.pdf'), 2);
  assert.equal(pageCount('quote-unclear-cover.pdf'), 2);
  assert.equal(pageCount('quote-duplicate.pdf'), 1);
});
