# Demo clips manifest

All clips are 1920×1080, H.264 (High profile, yuv420p), 30 fps, with no audio track. They were recorded by
`clips/record.mjs` (`npm run clips`) and checked by `clips/verify.mjs` (`npm run clips:verify`).

| Clip ID | File | Duration | What it shows | Script section |
| --- | --- | --- | --- | --- |
| C01 | C01_hook.mp4 | 10.4 s | All three sample PDFs are dragged onto the upload page and dropped; Extract is clicked; three review cards appear and the view settles on the one amber field (the unclear cover limit). | C1 · Hook (10s) |
| C03 | C03_flow.mp4 | 25.1 s | Animated card: five boxes appear one by one, joined by arrows: PDF in → AI reads it → Shows the source → Person approves → Saved to dashboard. | C3 · Flow card (25s) |
| C04 | C04_upload.mp4 | 14.4 s | Starts on the empty dashboard, opens the upload page, clicks the drop zone to choose the clean and unclear quotes, clicks Extract and scrolls to the review cards. | C4 · Upload (15s) |
| C05 | C05_record_fills.mp4 | 25.6 s | The clean quote is extracted, then its eight fields are highlighted one at a time (client, insurer, policy type, premium, currency, start date, cover limit, quote reference) with value, source quote and page. | C5 · Record fills in (25s) |
| C06 | C06_source.mp4 | 25.0 s | On the clean quote, the premium field is clicked and its source quote and page are highlighted; the same check on the cover limit shows it was found on page 2. | C6 · Source (25s) |
| C06-CU | C06_source_closeup.mp4 | 25.0 s | CLOSEUP of C06_source.mp4, zoomed on the source panel (source quote and page columns). | C6 · Source (25s) |
| C07 | C07_human_check.mp4 | 35.9 s | On the unclear quote, the reviewer points at the amber "Low confidence" cover limit, reads its source quote, replaces the value with "2,000,000 any one occurrence", clicks Approve and the green "Saved quote NGA-PL-77120" message appears. | C7 · Human check (35s) |
| C07-CU | C07_human_check_closeup.mp4 | 35.9 s | CLOSEUP of C07_human_check.mp4, zoomed on the amber cover limit field and Approve button. | C7 · Human check (35s) |
| C08 | C08_duplicate_dashboard.mp4 | 25.0 s | With the clean and unclear quotes already approved, the duplicate quote is uploaded: its quote reference row and banner turn red and Approve is disabled. Then the Approved records dashboard opens with both saved records. | C8 · Duplicate and dashboard (25s) |
| C09 | C09_prompts.mp4 | 40.0 s | Dark terminal-style replay of four build prompts being typed, each followed by a one-line result: starter prompt (first 2 lines), sources, review screen, tests and deploy. Each moment is 9.8 s. | C9 · Prompt moments (40s) |
| C10 | C10_limits.mp4 | 25.0 s | Animated card, three rows of limit → safeguard: Blurry scans → The person approves; Different layouts → Fields set per business; Misread values → Every value shows its source. | C10 · Limits card (25s) |
| C11 | C11_business.mp4 | 30.0 s | Animated card listing, one by one: Less typing; Fewer mistakes; Data you can trust; Built in a week; A few cents per document (estimate). | C11 · Business card (30s) |

Still frames (the final frame of each explainer card, 1920×1080 PNG): `C03_flow.png`, `C10_limits.png`, `C11_business.png`.

## How these were made

- The app ran locally with the three sample PDFs in `samples/`. Extraction used the **canned mock extractor**
  (`scripts/mock-extractor.js`) instead of a live Gemini call, so every take is repeatable and no API key was used.
  The on-screen results are exactly what the app shows for those canned results. A live Gemini call takes longer than
  the ~0.6 s per PDF shown here.
- Each scene starts from a fresh in-memory database. For C8, the clean and unclear quotes are approved before the take,
  matching what happens in C7.
- The cursor, the blue click ring, the blue highlight box and the "3 PDF files" drag image are drawn by the recorder
  for clarity. They are not part of the app.
- CLOSEUP clips are cropped from the same 3840×2160 capture as the main clip, so they are native resolution, not
  upscaled. The camera eases to the next area when the action moves.
- The explainer cards are HTML pages in `clips/cards/`. The C9 prompt texts are in `clips/cards/C09_prompts.html`.

## Differences from the scene list

- **C1, C4:** the app's button is labelled **Extract**, not "Review", so that is what gets clicked.
- **C1:** the app has no green ticks. Fields without problems are plain; only the unclear cover limit is amber.
- **C5:** the app shows all fields at once. The clip highlights them one at a time rather than animating them in.
- **C6:** the source quote and page are always visible in each row, rather than appearing on click. The clip clicks
  the premium field and then highlights its source and page. It also shows the cover limit sourced from page 2.
- **C9:** the four prompts are verbatim excerpts from the build session. The starter prompt's line 2 says "Claude
  API" (the app was later switched to Gemini). The tests prompt asked for a new `document-extractor` repo, but the
  code went to the existing repository. Nothing was deployed.
