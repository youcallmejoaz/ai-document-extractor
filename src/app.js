import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { DuplicateQuoteError } from './db.js';
import { ExtractionError } from './extractor.js';
import { FIELD_NAMES, normalizeQuoteRef } from './fields.js';

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // Gemini's inline request limit

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

function isPdf(file) {
  return file.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

export function createApp({ db, extractor }) {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  app.post('/api/extract', upload.array('files', MAX_FILES), async (req, res) => {
    if (!extractor) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is not set on the server, so extraction is unavailable.' });
    }
    const files = req.files ?? [];
    if (files.length === 0) return res.status(400).json({ error: 'Upload at least one PDF.' });

    // One at a time keeps us under free-tier per-minute limits.
    const documents = [];
    for (const file of files) {
      const filename = file.originalname;
      if (!isPdf(file)) {
        documents.push({ filename, error: 'Not a PDF file.' });
        continue;
      }
      try {
        const { fields, missing, raw } = await extractor.extract(file.buffer, filename);
        const ref = fields.find((f) => f.name === 'quote_reference')?.value;
        const existing = ref ? db.findByQuoteRef(ref) : null;
        documents.push({ filename, fields, missing, raw, duplicate: Boolean(existing), existing });
      } catch (err) {
        if (!(err instanceof ExtractionError)) console.error(`Extraction failed for ${filename}:`, err);
        documents.push({ filename, error: err instanceof ExtractionError ? err.message : 'Extraction failed.' });
      }
    }
    res.json({ documents });
  });

  app.get('/api/duplicates', (req, res) => {
    const ref = normalizeQuoteRef(req.query.quote_reference);
    const existing = ref ? db.findByQuoteRef(ref) : null;
    res.json({ duplicate: Boolean(existing), existing });
  });

  app.get('/api/records', (req, res) => {
    res.json({ records: db.listRecords() });
  });

  app.post('/api/records', (req, res) => {
    const { filename = null, values, extraction = null, edited_fields: editedFields = [] } = req.body ?? {};
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'values is required.' });
    }
    if (!normalizeQuoteRef(values.quote_reference)) {
      return res.status(400).json({ error: 'quote_reference is required before approving.' });
    }
    const cleanValues = Object.fromEntries(FIELD_NAMES.map((name) => [name, values[name] ?? '']));
    const cleanEdited = Array.isArray(editedFields) ? editedFields.filter((n) => FIELD_NAMES.includes(n)) : [];

    try {
      const record = db.insertRecord({ values: cleanValues, filename, extraction, editedFields: cleanEdited });
      res.status(201).json({ record });
    } catch (err) {
      if (err instanceof DuplicateQuoteError) {
        return res.status(409).json({ error: err.message, existing: err.existing });
      }
      throw err;
    }
  });

  // multer and JSON parse errors -> 4xx; anything else -> 500
  app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Each PDF must be under ${MAX_FILE_BYTES / 1024 / 1024} MB.`
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Upload up to ${MAX_FILES} PDFs in the "files" field.`
            : err.message;
      return res.status(status).json({ error: message });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
