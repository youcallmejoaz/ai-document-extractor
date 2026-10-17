import { FIELDS } from './review-logic.js';

const tbody = document.getElementById('records');
const countEl = document.getElementById('count');
const labels = Object.fromEntries(FIELDS);

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text ?? '–';
  if (className) td.className = className;
  return td;
}

async function load() {
  try {
    const res = await fetch('/api/records');
    const { records } = await res.json();
    countEl.textContent = `${records.length} approved record(s).`;

    if (!records.length) {
      const td = cell('No records approved yet. Upload a quote to get started.', 'empty');
      td.colSpan = 10;
      tbody.replaceChildren(document.createElement('tr'));
      tbody.firstChild.append(td);
      return;
    }

    tbody.replaceChildren(
      ...records.map((r) => {
        const tr = document.createElement('tr');
        const premium = r.premium ? [r.currency, r.premium].filter(Boolean).join(' ') : null;
        tr.append(
          cell(new Date(r.approved_at).toLocaleString(), 'num'),
          cell(r.quote_reference, 'num'),
          cell(r.client_name),
          cell(r.insurer),
          cell(r.policy_type),
          cell(premium, 'num'),
          cell(r.start_date, 'num'),
          cell(r.cover_limit),
          cell(r.source_filename),
          cell(r.edited_fields.length ? r.edited_fields.map((n) => labels[n] ?? n).join(', ') : 'None'),
        );
        return tr;
      }),
    );
  } catch (err) {
    countEl.textContent = `Could not load records: ${err.message}`;
  }
}

load();
