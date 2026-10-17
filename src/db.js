import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { FIELD_NAMES, normalizeQuoteRef } from './fields.js';

export class DuplicateQuoteError extends Error {
  constructor(quoteReference, existing) {
    super(`Quote reference "${quoteReference}" has already been approved`);
    this.existing = existing;
  }
}

export function openDb(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_reference TEXT NOT NULL UNIQUE COLLATE NOCASE,
      client_name TEXT,
      insurer TEXT,
      policy_type TEXT,
      premium TEXT,
      currency TEXT,
      start_date TEXT,
      cover_limit TEXT,
      source_filename TEXT,
      extraction_json TEXT,
      edited_fields TEXT NOT NULL DEFAULT '[]',
      approved_at TEXT NOT NULL
    )
  `);

  const findStmt = db.prepare('SELECT * FROM records WHERE quote_reference = ?');
  const listStmt = db.prepare('SELECT * FROM records ORDER BY approved_at DESC, id DESC');
  const insertStmt = db.prepare(`
    INSERT INTO records (${FIELD_NAMES.join(', ')}, source_filename, extraction_json, edited_fields, approved_at)
    VALUES (${FIELD_NAMES.map(() => '?').join(', ')}, ?, ?, ?, ?)
  `);

  function toRecord(row) {
    if (!row) return null;
    return { ...row, edited_fields: JSON.parse(row.edited_fields) };
  }

  return {
    findByQuoteRef(ref) {
      const normalized = normalizeQuoteRef(ref);
      if (!normalized) return null;
      return toRecord(findStmt.get(normalized));
    },

    insertRecord({ values, filename = null, extraction = null, editedFields = [] }) {
      const quoteReference = normalizeQuoteRef(values.quote_reference);
      if (!quoteReference) throw new Error('quote_reference is required');
      const existing = this.findByQuoteRef(quoteReference);
      if (existing) throw new DuplicateQuoteError(quoteReference, existing);

      const fieldValues = FIELD_NAMES.map((name) =>
        name === 'quote_reference' ? quoteReference : (values[name] ?? '').toString().trim() || null,
      );
      const result = insertStmt.run(
        ...fieldValues,
        filename,
        extraction ? JSON.stringify(extraction) : null,
        JSON.stringify(editedFields),
        new Date().toISOString(),
      );
      return toRecord(db.prepare('SELECT * FROM records WHERE id = ?').get(result.lastInsertRowid));
    },

    listRecords() {
      return listStmt.all().map(toRecord);
    },

    close() {
      db.close();
    },
  };
}
