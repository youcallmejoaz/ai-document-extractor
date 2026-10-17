// Runs the app with a canned extractor instead of Gemini, so the review flow can be
// tried without an API key. Recognises the sample PDFs by filename; any other PDF gets
// a generic result. Uses an in-memory database that resets on restart.
//
//   npm run dev:mock
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { normalizeExtraction } from '../src/extractor.js';

const high = (name, value, source_quote, page = 1) => ({ name, value, source_quote, page, confidence: 'high' });
const low = (name, value, source_quote, page = 1) => ({ name, value, source_quote, page, confidence: 'low' });

const harbourline = (premiumPage, coverQuote, coverPage) => [
  high('client_name', 'Brightwater Bakery Ltd', 'Client name Brightwater Bakery Ltd'),
  high('insurer', 'Harbourline Mutual Insurance', 'Harbourline Mutual Insurance'),
  high('policy_type', 'Commercial Property', 'Commercial Property (Buildings and Contents)'),
  high('premium', '4,812.50', '£4,812.50 (GBP), including Insurance Premium Tax', premiumPage),
  high('currency', 'GBP', '£4,812.50 (GBP)', premiumPage),
  high('start_date', '2026-11-01', 'Policy start date 1 November 2026'),
  high('cover_limit', '1,500,000', coverQuote, coverPage),
  high('quote_reference', 'HLM-2026-04417', 'Quote reference HLM-2026-04417'),
];

const CANNED = {
  'quote-clean.pdf': { fields: harbourline(1, 'Cover limit (sum insured) £1,500,000 any one loss', 2), missing: [] },
  'quote-duplicate.pdf': {
    fields: harbourline(1, 'The cover limit is £1,500,000 any one loss, subject to a £500 excess.', 1),
    missing: [],
  },
  'quote-unclear-cover.pdf': {
    fields: [
      high('client_name', 'Kestrel Logistics Ltd', 'Proposer Kestrel Logistics Ltd'),
      high('insurer', 'Northgate Assurance plc', 'Northgate Assurance plc'),
      high('policy_type', 'Public Liability', 'Class of business Public Liability'),
      high('premium', '2,340.00', 'GBP 2,340.00 per annum (inclusive of IPT)'),
      high('currency', 'GBP', 'GBP 2,340.00 per annum'),
      high('start_date', '2026-12-15', 'Inception date 15/12/2026'),
      low(
        'cover_limit',
        '2,000,000',
        'Indicative limit of indemnity: £2,000,000 any one occurrence. The aggregate limit is to be confirmed by the underwriter',
      ),
      high('quote_reference', 'NGA-PL-77120', 'Our reference NGA-PL-77120'),
    ],
    missing: [],
  },
};

const mockExtractor = {
  async extract(buffer, filename) {
    await new Promise((r) => setTimeout(r, 400)); // feel a little like a real call
    const raw = CANNED[filename] ?? {
      fields: [
        low('client_name', 'Unknown client', '(mock extractor: file not recognised)'),
        high('quote_reference', `MOCK-${Date.now()}`, '(mock extractor)'),
      ],
      missing: [],
    };
    return { ...normalizeExtraction(raw), raw };
  },
};

const port = Number(process.env.PORT) || 3000;
createApp({ db: openDb(':memory:'), extractor: mockExtractor }).listen(port, () => {
  console.log(`Document Extractor (MOCK extractor, in-memory DB) at http://localhost:${port}`);
});
