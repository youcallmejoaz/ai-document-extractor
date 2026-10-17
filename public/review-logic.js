// Pure review-screen logic, shared by the browser and the Node tests.

export const FIELDS = [
  ['client_name', 'Client name'],
  ['insurer', 'Insurer'],
  ['policy_type', 'Policy type'],
  ['premium', 'Premium'],
  ['currency', 'Currency'],
  ['start_date', 'Start date'],
  ['cover_limit', 'Cover limit'],
  ['quote_reference', 'Quote reference'],
];

/** One row per field, whether it was extracted or missing. */
export function buildRows(doc) {
  const extracted = new Map((doc.fields ?? []).map((f) => [f.name, f]));
  return FIELDS.map(([name, label]) => {
    const field = extracted.get(name);
    return {
      name,
      label,
      value: field?.value ?? '',
      source_quote: field?.source_quote ?? '',
      page: field?.page ?? null,
      confidence: field?.confidence ?? null,
      missing: !field,
    };
  });
}

/**
 * 'red' for a duplicate quote reference, 'amber' for low confidence or missing
 * fields, otherwise 'ok'.
 */
export function fieldStatus(row, { duplicate = false } = {}) {
  if (row.name === 'quote_reference' && duplicate) return 'red';
  if (row.missing || row.confidence === 'low') return 'amber';
  return 'ok';
}

export function canApprove({ quoteReference, duplicate, checking = false, saving = false }) {
  return Boolean(quoteReference && quoteReference.trim()) && !duplicate && !checking && !saving;
}

/** Fields whose current value differs from what was extracted. */
export function editedFields(rows, values) {
  return rows.filter((row) => (values[row.name] ?? '').trim() !== row.value.trim()).map((row) => row.name);
}

export function buildPayload(doc, rows, values) {
  return {
    filename: doc.filename,
    values: Object.fromEntries(FIELDS.map(([name]) => [name, (values[name] ?? '').trim()])),
    extraction: doc.raw ?? { fields: doc.fields, missing: doc.missing },
    edited_fields: editedFields(rows, values),
  };
}

export function summarize(rows, { duplicate = false } = {}) {
  return {
    low: rows.filter((r) => !r.missing && r.confidence === 'low').length,
    missing: rows.filter((r) => r.missing).length,
    duplicate,
  };
}
