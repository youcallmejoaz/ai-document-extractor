import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExtractor, normalizeExtraction, ExtractionError } from '../src/extractor.js';
import { FIELD_NAMES, EXTRACTION_SCHEMA } from '../src/fields.js';

function fakeClient(responseOrError) {
  const calls = [];
  return {
    calls,
    models: {
      async generateContent(request) {
        calls.push(request);
        if (responseOrError instanceof Error) throw responseOrError;
        return responseOrError;
      },
    },
  };
}

function okResponse(payload) {
  return {
    text: JSON.stringify(payload),
    candidates: [{ finishReason: 'STOP' }],
  };
}

const pdf = Buffer.from('%PDF-1.4 fake');

test('sends the PDF inline with a JSON schema and the chosen model', async () => {
  const client = fakeClient(okResponse({ fields: [], missing: FIELD_NAMES }));
  await createExtractor({ client, model: 'gemini-test' }).extract(pdf);

  const [request] = client.calls;
  assert.equal(request.model, 'gemini-test');
  const [docPart, textPart] = request.contents[0].parts;
  assert.equal(docPart.inlineData.mimeType, 'application/pdf');
  assert.equal(Buffer.from(docPart.inlineData.data, 'base64').toString(), '%PDF-1.4 fake');
  assert.match(textPart.text, /JSON only/);
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.deepEqual(request.config.responseJsonSchema, EXTRACTION_SCHEMA);
});

test('returns normalised fields, missing list and the raw output', async () => {
  const payload = {
    fields: [
      { name: 'quote_reference', value: 'HLM-1', source_quote: 'Ref: HLM-1', page: 1, confidence: 'high' },
      { name: 'cover_limit', value: '2,000,000', source_quote: 'TBC', page: 2, confidence: 'low' },
    ],
    missing: ['premium'],
  };
  const result = await createExtractor({ client: fakeClient(okResponse(payload)) }).extract(pdf);
  assert.deepEqual(result.fields.map((f) => f.name), ['cover_limit', 'quote_reference']);
  assert.equal(result.missing.length, 6);
  assert.deepEqual(result.raw, payload);
});

test('normalisation fills in missing fields, drops junk and fixes confidence', () => {
  const result = normalizeExtraction({
    fields: [
      { name: 'premium', value: '  100  ', source_quote: 'Premium 100', page: 1, confidence: 'HIGH' },
      { name: 'premium', value: '999', source_quote: 'dup', page: 1, confidence: 'high' },
      { name: 'insurer', value: '', source_quote: '', page: 1, confidence: 'high' },
      { name: 'not_a_field', value: 'x', source_quote: 'x', page: 1, confidence: 'high' },
      { name: 'client_name', value: 'Acme', source_quote: 'Acme', page: 0, confidence: 'high' },
    ],
    missing: [],
  });

  assert.deepEqual(result.fields, [
    { name: 'client_name', value: 'Acme', source_quote: 'Acme', page: null, confidence: 'high' },
    { name: 'premium', value: '100', source_quote: 'Premium 100', page: 1, confidence: 'low' },
  ]);
  assert.deepEqual(
    result.missing,
    FIELD_NAMES.filter((n) => n !== 'client_name' && n !== 'premium'),
  );
});

test('a field listed as missing but also extracted counts as extracted', () => {
  const result = normalizeExtraction({
    fields: [{ name: 'currency', value: 'GBP', source_quote: '£', page: 1, confidence: 'high' }],
    missing: ['currency'],
  });
  assert.ok(!result.missing.includes('currency'));
});

test('rejects malformed JSON', async () => {
  const client = fakeClient({ text: 'Sure! Here is the JSON:', candidates: [{ finishReason: 'STOP' }] });
  await assert.rejects(createExtractor({ client }).extract(pdf), /valid JSON/);
});

test('rejects JSON without a fields array', async () => {
  const client = fakeClient(okResponse({ missing: [] }));
  await assert.rejects(createExtractor({ client }).extract(pdf), ExtractionError);
});

test('reports blocked prompts', async () => {
  const client = fakeClient({ promptFeedback: { blockReason: 'SAFETY' } });
  await assert.rejects(createExtractor({ client }).extract(pdf), /blocked the document \(SAFETY\)/);
});

test('reports truncated output', async () => {
  const client = fakeClient({ text: '{"fields": [', candidates: [{ finishReason: 'MAX_TOKENS' }] });
  await assert.rejects(createExtractor({ client }).extract(pdf), /MAX_TOKENS/);
});

test('unwraps the message from Gemini JSON error bodies', async () => {
  const body = JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } });
  const err = Object.assign(new Error(body), { status: 400 });
  await assert.rejects(
    createExtractor({ client: fakeClient(err) }).extract(pdf),
    { message: 'Gemini rejected the request (400): API key not valid. Please pass a valid API key.' },
  );
});

test('maps quota errors to a readable message', async () => {
  const err = Object.assign(new Error('Resource exhausted'), { status: 429 });
  await assert.rejects(createExtractor({ client: fakeClient(err) }).extract(pdf), /quota reached/);
});
