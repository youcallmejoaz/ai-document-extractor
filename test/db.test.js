import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, DuplicateQuoteError } from '../src/db.js';

const values = {
  client_name: 'Brightwater Bakery Ltd',
  insurer: 'Harbourline Mutual Insurance',
  policy_type: 'Commercial Property',
  premium: '4,812.50',
  currency: 'GBP',
  start_date: '2026-11-01',
  cover_limit: '1,500,000',
  quote_reference: 'HLM-2026-04417',
};

test('inserts and lists records', () => {
  const db = openDb();
  const saved = db.insertRecord({ values, filename: 'a.pdf', editedFields: ['premium'] });
  assert.equal(saved.quote_reference, 'HLM-2026-04417');
  assert.deepEqual(saved.edited_fields, ['premium']);
  assert.ok(saved.approved_at);

  const rows = db.listRecords();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].client_name, 'Brightwater Bakery Ltd');
});

test('stores blank values as null and trims the reference', () => {
  const db = openDb();
  const saved = db.insertRecord({ values: { ...values, cover_limit: '  ', quote_reference: '  REF-1  ' } });
  assert.equal(saved.cover_limit, null);
  assert.equal(saved.quote_reference, 'REF-1');
});

test('finds duplicates ignoring case and surrounding whitespace', () => {
  const db = openDb();
  db.insertRecord({ values });
  assert.ok(db.findByQuoteRef('hlm-2026-04417'));
  assert.ok(db.findByQuoteRef('  HLM-2026-04417 '));
  assert.equal(db.findByQuoteRef('HLM-2026-99999'), null);
  assert.equal(db.findByQuoteRef(''), null);
});

test('refuses to insert a duplicate quote reference', () => {
  const db = openDb();
  db.insertRecord({ values });
  assert.throws(
    () => db.insertRecord({ values: { ...values, quote_reference: 'hlm-2026-04417' } }),
    DuplicateQuoteError,
  );
  assert.equal(db.listRecords().length, 1);
});

test('requires a quote reference', () => {
  const db = openDb();
  assert.throws(() => db.insertRecord({ values: { ...values, quote_reference: '' } }), /required/);
});
