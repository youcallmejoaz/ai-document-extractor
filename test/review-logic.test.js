import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELDS,
  buildRows,
  fieldStatus,
  canApprove,
  editedFields,
  buildPayload,
  summarize,
} from '../public/review-logic.js';
import { FIELD_NAMES } from '../src/fields.js';

const doc = {
  filename: 'quote.pdf',
  fields: [
    { name: 'insurer', value: 'Northgate Assurance', source_quote: 'Northgate Assurance plc', page: 1, confidence: 'high' },
    { name: 'cover_limit', value: '2000000', source_quote: 'aggregate TBC', page: 2, confidence: 'low' },
    { name: 'quote_reference', value: 'NGA-1', source_quote: 'Ref NGA-1', page: 1, confidence: 'high' },
  ],
  missing: ['client_name', 'policy_type', 'premium', 'currency', 'start_date'],
  raw: { fields: [], missing: [] },
};

test('front-end field list matches the server field list', () => {
  assert.deepEqual(FIELDS.map(([name]) => name), FIELD_NAMES);
});

test('builds a row for every field, marking missing ones', () => {
  const rows = buildRows(doc);
  assert.equal(rows.length, 8);
  const client = rows.find((r) => r.name === 'client_name');
  assert.equal(client.missing, true);
  assert.equal(client.value, '');
  const cover = rows.find((r) => r.name === 'cover_limit');
  assert.equal(cover.page, 2);
});

test('field status: low confidence and missing are amber, duplicate ref is red', () => {
  const rows = Object.fromEntries(buildRows(doc).map((r) => [r.name, r]));
  assert.equal(fieldStatus(rows.insurer), 'ok');
  assert.equal(fieldStatus(rows.cover_limit), 'amber');
  assert.equal(fieldStatus(rows.client_name), 'amber');
  assert.equal(fieldStatus(rows.quote_reference), 'ok');
  assert.equal(fieldStatus(rows.quote_reference, { duplicate: true }), 'red');
  assert.equal(fieldStatus(rows.insurer, { duplicate: true }), 'ok');
});

test('approve is only allowed with a unique, non-empty reference', () => {
  assert.equal(canApprove({ quoteReference: 'A', duplicate: false }), true);
  assert.equal(canApprove({ quoteReference: '  ', duplicate: false }), false);
  assert.equal(canApprove({ quoteReference: 'A', duplicate: true }), false);
  assert.equal(canApprove({ quoteReference: 'A', duplicate: false, checking: true }), false);
  assert.equal(canApprove({ quoteReference: 'A', duplicate: false, saving: true }), false);
});

test('tracks edited fields and builds the approve payload', () => {
  const rows = buildRows(doc);
  const values = Object.fromEntries(rows.map((r) => [r.name, r.value]));
  values.cover_limit = '2,000,000 per occurrence';
  values.client_name = ' Kestrel Logistics Ltd ';

  assert.deepEqual(editedFields(rows, values), ['client_name', 'cover_limit']);
  const payload = buildPayload(doc, rows, values);
  assert.equal(payload.filename, 'quote.pdf');
  assert.equal(payload.values.client_name, 'Kestrel Logistics Ltd');
  assert.equal(payload.values.quote_reference, 'NGA-1');
  assert.deepEqual(payload.edited_fields, ['client_name', 'cover_limit']);
  assert.equal(payload.extraction, doc.raw);
});

test('summarises low-confidence and missing counts', () => {
  assert.deepEqual(summarize(buildRows(doc), { duplicate: true }), { low: 1, missing: 5, duplicate: true });
});
