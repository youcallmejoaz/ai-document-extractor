import { FIELD_NAMES, EXTRACTION_SCHEMA } from './fields.js';

export const DEFAULT_MODEL = 'gemini-flash-latest';

export class ExtractionError extends Error {}

export const PROMPT = `You are extracting data from an insurance quote PDF for a human reviewer.

Extract these fields: ${FIELD_NAMES.join(', ')}.

Rules:
- Return JSON only, matching the provided schema. No prose, no markdown.
- "value": the value as written in the document (normalise dates to YYYY-MM-DD and currency to an ISO 4217 code such as GBP, USD or EUR; give premium and cover_limit as the amount without the currency symbol).
- "source_quote": copy the exact text from the document that the value comes from, verbatim.
- "page": the 1-based page number where the source quote appears.
- "confidence": "high" only when the document states the value clearly and unambiguously. Use "low" when the value is unclear, conditional, provisional (e.g. "TBC", "to be confirmed", "subject to"), inferred, or when the document gives conflicting values.
- If a field does not appear in the document at all, do not guess: leave it out of "fields" and list its name in "missing".`;

/**
 * Turns the model's raw JSON into a predictable shape: every known field appears exactly once,
 * either in `fields` (in FIELD_NAMES order) or in `missing`.
 */
export function normalizeExtraction(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.fields)) {
    throw new ExtractionError('Model response did not contain a "fields" array');
  }

  const byName = new Map();
  for (const field of raw.fields) {
    if (!field || !FIELD_NAMES.includes(field.name) || byName.has(field.name)) continue;
    const value = field.value == null ? '' : String(field.value).trim();
    if (!value) continue;
    const page = Number.isInteger(field.page) && field.page > 0 ? field.page : null;
    byName.set(field.name, {
      name: field.name,
      value,
      source_quote: typeof field.source_quote === 'string' ? field.source_quote.trim() : '',
      page,
      confidence: field.confidence === 'high' ? 'high' : 'low',
    });
  }

  return {
    fields: FIELD_NAMES.filter((name) => byName.has(name)).map((name) => byName.get(name)),
    missing: FIELD_NAMES.filter((name) => !byName.has(name)),
  };
}

// The SDK puts the raw JSON error body in err.message; pull out the human-readable part.
function apiErrorMessage(err) {
  try {
    return JSON.parse(err.message).error.message ?? err.message;
  } catch {
    return err.message;
  }
}

export function createExtractor({ client, model = DEFAULT_MODEL }) {
  return {
    model,

    async extract(pdfBuffer) {
      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } },
                { text: PROMPT },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: EXTRACTION_SCHEMA,
            temperature: 0,
          },
        });
      } catch (err) {
        if (err?.status === 429) {
          throw new ExtractionError('Gemini quota reached (free-tier rate limit). Wait a minute and try again.');
        }
        if (err?.status === 400 || err?.status === 403 || err?.status === 404) {
          throw new ExtractionError(`Gemini rejected the request (${err.status}): ${apiErrorMessage(err)}`);
        }
        throw new ExtractionError(`Gemini request failed: ${err?.message ?? err}`);
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) throw new ExtractionError(`Gemini blocked the document (${blockReason})`);

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new ExtractionError(`Gemini stopped before finishing (${finishReason})`);
      }

      const text = response.text;
      if (!text) throw new ExtractionError('Gemini returned an empty response');

      let raw;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ExtractionError('Gemini did not return valid JSON');
      }
      return { ...normalizeExtraction(raw), raw };
    },
  };
}
