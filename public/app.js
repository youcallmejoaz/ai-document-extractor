import { buildRows, fieldStatus, canApprove, buildPayload, summarize } from './review-logic.js';

const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const dropzone = document.getElementById('dropzone');
const dropzoneText = document.getElementById('dropzone-text');
const extractBtn = document.getElementById('extract-btn');
const statusEl = document.getElementById('status');
const documentsEl = document.getElementById('documents');

let selectedFiles = [];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child != null) node.append(child);
  return node;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function setFiles(files) {
  selectedFiles = [...files].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  extractBtn.disabled = selectedFiles.length === 0;
  dropzoneText.textContent = selectedFiles.length
    ? selectedFiles.map((f) => f.name).join(', ')
    : 'Drop PDFs here or click to choose files';
}

fileInput.addEventListener('change', () => setFiles(fileInput.files));
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  setFiles(e.dataTransfer.files);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedFiles.length) return;

  const body = new FormData();
  for (const file of selectedFiles) body.append('files', file);
  extractBtn.disabled = true;
  setStatus(`Extracting ${selectedFiles.length} document(s)… this can take a little while per PDF.`);

  try {
    const res = await fetch('/api/extract', { method: 'POST', body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    for (const doc of data.documents) documentsEl.prepend(renderDocument(doc));
    const failed = data.documents.filter((d) => d.error).length;
    setStatus(
      `Extracted ${data.documents.length - failed} of ${data.documents.length} document(s). Review each one below.`,
      failed > 0,
    );
    form.reset();
    setFiles([]);
  } catch (err) {
    setStatus(err.message, true);
    extractBtn.disabled = false;
  }
});

function renderDocument(doc) {
  const card = el('section', { class: 'panel doc-card' });
  const head = el('div', { class: 'card-head' }, el('h3', { text: doc.filename }));
  card.append(head);

  if (doc.error) {
    head.append(el('span', { class: 'badge red', text: 'Extraction failed' }));
    card.append(el('div', { class: 'banner red', text: doc.error }));
    const dismiss = el('button', { type: 'button', text: 'Dismiss' });
    dismiss.addEventListener('click', () => card.remove());
    card.append(el('div', { class: 'actions' }, dismiss));
    return card;
  }

  const rows = buildRows(doc);
  const state = { duplicate: doc.duplicate, existing: doc.existing, checking: false, saving: false };
  const inputs = {};
  const tableRows = {};

  const badges = el('span', { class: 'badges' });
  head.append(badges);
  const banner = el('div', { class: 'banner red', hidden: '' });
  card.append(banner);

  const tbody = el('tbody');
  for (const row of rows) {
    const input = el('input', { type: 'text', 'aria-label': row.label, 'data-field': row.name });
    input.value = row.value;
    inputs[row.name] = input;

    const editedNote = el('span', { class: 'edited-note', hidden: '', text: 'edited' });
    input.addEventListener('input', () => {
      const edited = input.value.trim() !== row.value.trim();
      input.classList.toggle('edited', edited);
      editedNote.hidden = !edited;
      if (row.name === 'quote_reference') scheduleDuplicateCheck();
    });

    const quote = row.missing
      ? el('span', { class: 'quote none', text: 'Not found in document' })
      : el('span', { class: 'quote', text: row.source_quote ? `“${row.source_quote}”` : '(no quote given)' });

    const tr = el(
      'tr',
      { 'data-row': row.name },
      el('td', {}, el('span', { class: 'field-label', text: row.label }), el('span', { class: 'field-flag' })),
      el('td', {}, input, editedNote),
      el('td', {}, quote),
      el('td', { class: 'page', text: row.page ? `p. ${row.page}` : '–' }),
    );
    tableRows[row.name] = tr;
    tbody.append(tr);
  }

  card.append(
    el(
      'div',
      { class: 'table-wrap' },
      el(
        'table',
        {},
        el(
          'thead',
          {},
          el('tr', {}, el('th', { text: 'Field' }), el('th', { text: 'Value' }), el('th', { text: 'Source quote' }), el('th', { text: 'Page' })),
        ),
        tbody,
      ),
    ),
  );

  const approveBtn = el('button', { type: 'button', class: 'primary', text: 'Approve' });
  const rejectBtn = el('button', { type: 'button', text: 'Reject' });
  const message = el('span', { class: 'message' });
  card.append(el('div', { class: 'actions' }, approveBtn, rejectBtn, message));

  function refresh() {
    for (const row of rows) {
      const status = fieldStatus(row, { duplicate: state.duplicate });
      const tr = tableRows[row.name];
      tr.className = status === 'ok' ? '' : status;
      tr.querySelector('.field-flag').textContent =
        status === 'red' ? 'Duplicate' : row.missing ? 'Missing' : row.confidence === 'low' ? 'Low confidence' : '';
    }

    const counts = summarize(rows, { duplicate: state.duplicate });
    badges.replaceChildren(
      ...(counts.duplicate ? [el('span', { class: 'badge red', text: 'Duplicate' })] : []),
      ...(counts.low ? [el('span', { class: 'badge amber', text: `${counts.low} low confidence` })] : []),
      ...(counts.missing ? [el('span', { class: 'badge amber', text: `${counts.missing} missing` })] : []),
    );

    if (state.duplicate) {
      const ex = state.existing;
      banner.textContent =
        `Duplicate: quote reference "${inputs.quote_reference.value.trim()}" was already approved` +
        (ex ? ` on ${new Date(ex.approved_at).toLocaleString()} (${ex.client_name ?? 'unknown client'}, ${ex.source_filename ?? 'unknown file'})` : '') +
        '. Correct the reference or reject this document.';
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }

    approveBtn.disabled = !canApprove({
      quoteReference: inputs.quote_reference.value,
      duplicate: state.duplicate,
      checking: state.checking,
      saving: state.saving,
    });
  }

  let checkTimer;
  let checkSeq = 0;
  function scheduleDuplicateCheck() {
    clearTimeout(checkTimer);
    state.checking = true;
    refresh();
    checkTimer = setTimeout(async () => {
      const seq = ++checkSeq;
      const ref = inputs.quote_reference.value.trim();
      try {
        const res = await fetch(`/api/duplicates?quote_reference=${encodeURIComponent(ref)}`);
        const data = await res.json();
        if (seq !== checkSeq) return;
        state.duplicate = data.duplicate;
        state.existing = data.existing;
      } catch {
        // The server checks again on Approve, so a failed lookup is not fatal.
      }
      if (seq === checkSeq) {
        state.checking = false;
        refresh();
      }
    }, 300);
  }

  approveBtn.addEventListener('click', async () => {
    const values = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.value]));
    state.saving = true;
    message.textContent = '';
    refresh();
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(doc, rows, values)),
      });
      const data = await res.json();
      if (res.status === 409) {
        state.duplicate = true;
        state.existing = data.existing;
        return;
      }
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      card.replaceChildren(
        el(
          'div',
          { class: 'card-head' },
          el('h3', { text: doc.filename }),
          el('span', { class: 'badge green', text: 'Approved' }),
        ),
        el(
          'div',
          { class: 'banner green' },
          `Saved quote ${data.record.quote_reference}. `,
          el('a', { href: '/dashboard.html', text: 'View approved records' }),
        ),
      );
    } catch (err) {
      message.textContent = err.message;
    } finally {
      state.saving = false;
      if (card.isConnected && approveBtn.isConnected) refresh();
    }
  });

  rejectBtn.addEventListener('click', () => card.remove());

  refresh();
  return card;
}
