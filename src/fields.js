// The fields extracted from every insurance quote, in display order.
export const FIELD_NAMES = [
  'client_name',
  'insurer',
  'policy_type',
  'premium',
  'currency',
  'start_date',
  'cover_limit',
  'quote_reference',
];

export const FIELD_LABELS = {
  client_name: 'Client name',
  insurer: 'Insurer',
  policy_type: 'Policy type',
  premium: 'Premium',
  currency: 'Currency',
  start_date: 'Start date',
  cover_limit: 'Cover limit',
  quote_reference: 'Quote reference',
};

// JSON Schema the model's response must match.
export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: FIELD_NAMES },
          value: { type: 'string' },
          source_quote: { type: 'string' },
          page: { type: 'integer' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['name', 'value', 'source_quote', 'page', 'confidence'],
      },
    },
    missing: {
      type: 'array',
      items: { type: 'string', enum: FIELD_NAMES },
    },
  },
  required: ['fields', 'missing'],
};

export function normalizeQuoteRef(ref) {
  return typeof ref === 'string' ? ref.trim() : '';
}
