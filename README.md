# Document Extractor

Upload PDF insurance quotes, let Gemini pull out the key fields, review and correct them, and approve them into a SQLite database.

- **Extract:** each PDF is sent to the Gemini API, which must reply with JSON only, matching this schema:
  `{ fields: [{ name, value, source_quote, page, confidence: "high"|"low" }], missing: string[] }`.
  Fields: `client_name`, `insurer`, `policy_type`, `premium`, `currency`, `start_date`, `cover_limit`, `quote_reference`.
- **Review:** each document gets a card showing every field's value, the exact source quote and its page number.
  - Low-confidence and missing fields are **amber**.
  - Every field is editable, and edited fields are marked.
- **Duplicate check:** if the quote reference has already been approved, the row and a banner turn **red** and Approve is disabled. The check runs again as you edit the reference, and the server enforces it too (HTTP 409).
- **Approve:** a record is written only when the reviewer clicks Approve. Reject discards the card.
- **Dashboard:** lists every approved record, including which fields the reviewer changed.

## Requirements

- Node.js **22.5+**. The app uses the built-in `node:sqlite` module, so there are no native builds.
- A Gemini API key. You can get one free at <https://aistudio.google.com/apikey>.

## Setup

```bash
npm install
cp .env.example .env      # then paste your key into GEMINI_API_KEY
npm start                 # http://localhost:3000
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | (none) | Required for extraction. Without it the server still starts and the dashboard works, but `/api/extract` returns 503. |
| `GEMINI_MODEL` | `gemini-flash-latest` | Any Gemini model that accepts PDFs. For example, try a Flash-Lite model if you hit free-tier limits. |
| `PORT` | `3000` | HTTP port. |
| `DB_PATH` | `data/records.db` | SQLite file, created on first run. |

`npm start` loads `.env` automatically. You can also export the variables yourself.

### Free tier notes

- Free-tier limits are per model, fairly small (requests per minute and per day), and Google changes them from time to time. Check the current numbers in [AI Studio](https://aistudio.google.com/). The app processes uploads one at a time and shows "quota reached" on any document that hits the limit.
- On the free tier, Google may use prompts and uploaded content to improve its products. **Don't upload real client documents with a free-tier key.** Use a paid (billing-enabled) key for real data.

## Try it with the sample quotes

`samples/` contains three invented quotes. Every company, person and reference in them is fictitious.

| File | What it tests |
| --- | --- |
| `quote-clean.pdf` | Harbourline Mutual / Brightwater Bakery. Every field is clearly stated, and the cover limit is on page 2. |
| `quote-unclear-cover.pdf` | Northgate Assurance / Kestrel Logistics. The cover limit is "indicative", the aggregate is "to be confirmed", £5m "may apply", and the schedule says "TBC". It should come back **amber**. |
| `quote-duplicate.pdf` | A reissued Harbourline quote with the **same reference** (`HLM-2026-04417`) as the clean quote. |

Walkthrough:
1. Upload `quote-clean.pdf` and `quote-unclear-cover.pdf` together. Check the amber cover limit on the second card.
2. Approve `quote-clean.pdf`.
3. Upload `quote-duplicate.pdf`. The quote reference is flagged red and Approve is disabled.
4. Open **Approved records** to see the dashboard.

To try the UI with no API key, run `npm run dev:mock`. It uses canned results for the three samples and an in-memory database that resets on restart.

To regenerate the PDFs, run `npm run samples`. The output is deterministic.

## Tests

```bash
npm test             # unit + API tests; the live Gemini tests are skipped without a key
npm run test:live    # calls Gemini on the sample PDFs (needs GEMINI_API_KEY; uses 3 requests)
```

Coverage:
- extractor request shape, normalisation and error handling (with a fake Gemini client)
- database duplicate rules
- every API route (via supertest)
- the review screen's amber/red/approve logic
- the sample PDFs

## Demo clips

`clips/` holds 1080p MP4 clips for a client demo video, with a manifest in `clips/MANIFEST.md`. They show the app
running on the sample quotes, three explainer cards and a replay of the build prompts.

```bash
npm run clips              # re-record every clip (needs ffmpeg; uses the mock extractor, no API key)
npm run clips -- C06 C07   # re-record some scenes
npm run clips:verify       # check every clip against the manifest
```

`clips/record.mjs` drives Chromium with Playwright and pauses like a person between steps. It captures at 3840×2160 and
encodes H.264 with ffmpeg. Outside this repo's dev container, run `npx playwright install chromium` once first.

## How it works

```
public/            static front end (no build step)
  index.html       upload + review cards        app.js
  dashboard.html   approved records             dashboard.js
  review-logic.js  pure status/payload logic, shared with the tests
src/
  server.js        reads env, wires Gemini + SQLite, listens
  app.js           Express routes (createApp is injectable for tests)
  extractor.js     Gemini call, JSON schema, result normalisation
  db.js            SQLite records table (quote_reference UNIQUE, case-insensitive)
  fields.js        field list + JSON schema
scripts/           sample PDF generator, mock dev server
```

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/extract` | Multipart `files` field, up to 10 PDFs of 20 MB each. Returns `{documents: [{filename, fields, missing, duplicate, existing} \| {filename, error}]}`. Saves nothing. |
| `GET` | `/api/duplicates?quote_reference=…` | Returns `{duplicate, existing}`. |
| `POST` | `/api/records` | Approve. Body: `{filename, values, extraction, edited_fields}`. Returns 201, 400 (no reference) or 409 (duplicate). |
| `GET` | `/api/records` | Approved records, newest first. |

Extraction details:
- The PDF is sent inline (base64) with `responseMimeType: "application/json"` and a JSON schema, at temperature 0.
- The model is told to:
  - quote the source verbatim
  - give 1-based page numbers
  - mark anything provisional or contradictory as `low`
  - list fields it can't find under `missing` rather than guess
- The server then normalises the result: every field is either extracted or missing, unknown names are dropped and duplicates removed. The original model output is stored with each approved record for audit.
