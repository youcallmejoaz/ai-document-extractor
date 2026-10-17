import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { ExtractionError } from '../src/extractor.js';

const PDF = Buffer.from('%PDF-1.4\n% test document\n');

const VALUES = {
  client_name: 'Brightwater Bakery Ltd',
  insurer: 'Harbourline Mutual Insurance',
  policy_type: 'Commercial Property',
  premium: '4812.50',
  currency: 'GBP',
  start_date: '2026-11-01',
  cover_limit: '1500000',
  quote_reference: 'HLM-2026-04417',
};

function extractionFor(ref) {
  return {
    fields: [{ name: 'quote_reference', value: ref, source_quote: `Quote ref: ${ref}`, page: 1, confidence: 'high' }],
    missing: ['client_name'],
    raw: { fields: [], missing: [] },
  };
}

// Picks a canned result based on the uploaded filename.
function fakeExtractor() {
  return {
    async extract(buffer, filename) {
      if (filename === 'broken.pdf') throw new ExtractionError('Gemini did not return valid JSON');
      if (filename === 'dup.pdf') return extractionFor('hlm-2026-04417');
      return extractionFor('NEW-1');
    },
  };
}

function setup({ extractor = fakeExtractor() } = {}) {
  const db = openDb();
  return { db, app: createApp({ db, extractor }) };
}

test('extract returns results per document without saving anything', async () => {
  const { app, db } = setup();
  const res = await request(app)
    .post('/api/extract')
    .attach('files', PDF, 'a.pdf')
    .attach('files', PDF, 'b.pdf');
  assert.equal(res.status, 200);
  assert.equal(res.body.documents.length, 2);
  assert.equal(res.body.documents[0].filename, 'a.pdf');
  assert.equal(res.body.documents[0].fields[0].value, 'NEW-1');
  assert.equal(res.body.documents[0].duplicate, false);
  assert.equal(db.listRecords().length, 0);
});

test('extract flags a quote reference that is already approved', async () => {
  const { app, db } = setup();
  db.insertRecord({ values: VALUES });
  const res = await request(app).post('/api/extract').attach('files', PDF, 'dup.pdf');
  assert.equal(res.body.documents[0].duplicate, true);
  assert.equal(res.body.documents[0].existing.quote_reference, 'HLM-2026-04417');
});

test('one bad document does not stop the others', async () => {
  const { app } = setup();
  const res = await request(app)
    .post('/api/extract')
    .attach('files', Buffer.from('hello'), 'notes.txt')
    .attach('files', PDF, 'broken.pdf')
    .attach('files', PDF, 'good.pdf');
  const [txt, broken, good] = res.body.documents;
  assert.equal(txt.error, 'Not a PDF file.');
  assert.match(broken.error, /valid JSON/);
  assert.equal(good.fields[0].value, 'NEW-1');
});

test('extract requires at least one file', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/extract');
  assert.equal(res.status, 400);
});

test('extract returns 503 when no API key is configured', async () => {
  const { app } = setup({ extractor: null });
  const res = await request(app).post('/api/extract').attach('files', PDF, 'a.pdf');
  assert.equal(res.status, 503);
  assert.match(res.body.error, /GEMINI_API_KEY/);
});

test('extract rejects too many files', async () => {
  const { app } = setup();
  let req = request(app).post('/api/extract');
  for (let i = 0; i < 11; i++) req = req.attach('files', PDF, `f${i}.pdf`);
  const res = await req;
  assert.equal(res.status, 400);
});

test('approve saves a record, and the dashboard lists it', async () => {
  const { app } = setup();
  const res = await request(app)
    .post('/api/records')
    .send({ filename: 'a.pdf', values: VALUES, extraction: { fields: [] }, edited_fields: ['premium', 'bogus'] });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.record.edited_fields, ['premium']);

  const list = await request(app).get('/api/records');
  assert.equal(list.body.records.length, 1);
  assert.equal(list.body.records[0].insurer, 'Harbourline Mutual Insurance');
});

test('approving a duplicate quote reference returns 409 and saves nothing', async () => {
  const { app, db } = setup();
  await request(app).post('/api/records').send({ values: VALUES });
  const res = await request(app)
    .post('/api/records')
    .send({ values: { ...VALUES, quote_reference: ' hlm-2026-04417 ' } });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /already been approved/);
  assert.equal(db.listRecords().length, 1);
});

test('approving without a quote reference is rejected', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/records').send({ values: { ...VALUES, quote_reference: '  ' } });
  assert.equal(res.status, 400);
});

test('duplicate check endpoint', async () => {
  const { app, db } = setup();
  db.insertRecord({ values: VALUES });
  const dup = await request(app).get('/api/duplicates').query({ quote_reference: 'HLM-2026-04417' });
  assert.equal(dup.body.duplicate, true);
  const fresh = await request(app).get('/api/duplicates').query({ quote_reference: 'OTHER' });
  assert.equal(fresh.body.duplicate, false);
  const empty = await request(app).get('/api/duplicates');
  assert.equal(empty.body.duplicate, false);
});

test('serves the front end', async () => {
  const { app } = setup();
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /Document Extractor/);
});
