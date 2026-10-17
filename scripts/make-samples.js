// Generates the three sample insurance quotes in samples/.
// All companies, people and references are invented.
//
//   npm run samples
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FIXED_DATE = new Date('2026-10-06T09:00:00Z'); // keeps regenerated files stable
const DISCLAIMER = 'SAMPLE DOCUMENT - fictitious companies and figures, for software testing only.';

export const SAMPLES = [
  {
    file: 'quote-clean.pdf',
    description: 'Clean quote: every field clearly stated, cover limit on page 2',
    expected: {
      client_name: 'Brightwater Bakery Ltd',
      insurer: 'Harbourline Mutual Insurance',
      policy_type: 'Commercial Property',
      premium: '4,812.50',
      currency: 'GBP',
      start_date: '2026-11-01',
      cover_limit: '1,500,000',
      quote_reference: 'HLM-2026-04417',
    },
    render: renderClean,
  },
  {
    file: 'quote-unclear-cover.pdf',
    description: 'Cover limit is provisional and contradictory (should come back low confidence)',
    expected: {
      client_name: 'Kestrel Logistics Ltd',
      insurer: 'Northgate Assurance plc',
      policy_type: 'Public Liability',
      premium: '2,340.00',
      currency: 'GBP',
      start_date: '2026-12-15',
      cover_limit: null,
      quote_reference: 'NGA-PL-77120',
    },
    render: renderUnclearCover,
  },
  {
    file: 'quote-duplicate.pdf',
    description: 'Reissued copy of the clean quote with the same quote reference',
    expected: {
      client_name: 'Brightwater Bakery Ltd',
      insurer: 'Harbourline Mutual Insurance',
      policy_type: 'Commercial Property',
      premium: '4,812.50',
      currency: 'GBP',
      start_date: '2026-11-01',
      cover_limit: '1,500,000',
      quote_reference: 'HLM-2026-04417',
    },
    render: renderDuplicate,
  },
];

function letterhead(doc, name, tagline, colour) {
  doc.rect(0, 0, doc.page.width, 90).fill(colour);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(name, 50, 28);
  doc.font('Helvetica').fontSize(10).text(tagline, 50, 56);
  doc.fillColor('#000000').moveDown(3);
  doc.y = 110;
}

function disclaimer(doc) {
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#aa0000').text(DISCLAIMER, 50, doc.page.height - 60, {
    width: doc.page.width - 100,
    align: 'center',
  });
  doc.fillColor('#000000');
}

function heading(doc, text) {
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).text(text, 50).moveDown(0.4);
}

function rows(doc, pairs) {
  for (const [label, value] of pairs) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).text(label, 50, y, { width: 170 });
    doc.font('Helvetica').fontSize(10).text(value, 230, y, { width: 315 });
    doc.moveDown(0.5);
  }
}

function para(doc, text) {
  doc.font('Helvetica').fontSize(10).text(text, 50, doc.y, { width: doc.page.width - 100, align: 'left' }).moveDown(0.6);
}

function renderClean(doc) {
  letterhead(doc, 'Harbourline Mutual Insurance', 'Commercial lines  |  12 Anchor Row, Portwell PW1 4QT', '#1f4e79');
  doc.font('Helvetica-Bold').fontSize(16).text('Commercial Property Insurance Quotation', 50);
  heading(doc, 'Quotation details');
  rows(doc, [
    ['Quote reference', 'HLM-2026-04417'],
    ['Date of quotation', '6 October 2026'],
    ['Quotation valid until', '5 November 2026'],
    ['Broker', 'Saltmarsh & Finch Brokers'],
  ]);
  heading(doc, 'The insured');
  rows(doc, [
    ['Client name', 'Brightwater Bakery Ltd'],
    ['Address', '14 Quay Street, Portwell PW2 7HD'],
    ['Business activity', 'Artisan bakery and cafe'],
  ]);
  heading(doc, 'Cover');
  rows(doc, [
    ['Policy type', 'Commercial Property (Buildings and Contents)'],
    ['Policy start date', '1 November 2026'],
    ['Period of insurance', '12 months'],
  ]);
  heading(doc, 'Premium');
  rows(doc, [
    ['Annual premium', '£4,812.50 (GBP), including Insurance Premium Tax'],
    ['Payment options', 'Annual, or 10 monthly instalments'],
  ]);
  para(doc, 'The schedule of cover, including the sum insured, is set out on page 2.');
  disclaimer(doc);

  doc.addPage();
  letterhead(doc, 'Harbourline Mutual Insurance', 'Quote HLM-2026-04417  |  Page 2 of 2', '#1f4e79');
  heading(doc, 'Schedule of cover');
  rows(doc, [
    ['Cover limit (sum insured)', '£1,500,000 any one loss'],
    ['Buildings', 'Included within the cover limit'],
    ['Contents and stock', 'Included within the cover limit'],
    ['Standard excess', '£500 each and every claim'],
  ]);
  heading(doc, 'Conditions');
  para(doc, '1. Intruder alarm to be maintained and set whenever the premises are unattended.');
  para(doc, '2. Deep-fat fryers to be fitted with thermostatic cut-outs and cleaned weekly.');
  para(doc, 'Signed on behalf of Harbourline Mutual Insurance: Imogen Strand, Senior Underwriter');
  disclaimer(doc);
}

function renderUnclearCover(doc) {
  letterhead(doc, 'Northgate Assurance plc', 'Liability division  |  Unit 4, Fellside Park, Ashbridge AB3 9LN', '#3d6b35');
  doc.font('Helvetica-Bold').fontSize(16).text('Public Liability Quotation', 50);
  heading(doc, 'Summary');
  rows(doc, [
    ['Our reference', 'NGA-PL-77120'],
    ['Proposer', 'Kestrel Logistics Ltd'],
    ['Class of business', 'Public Liability'],
    ['Inception date', '15/12/2026'],
    ['Premium', 'GBP 2,340.00 per annum (inclusive of IPT)'],
  ]);
  heading(doc, 'Limit of indemnity');
  para(
    doc,
    'Indicative limit of indemnity: £2,000,000 any one occurrence. The aggregate limit is to be confirmed by ' +
      'the underwriter following receipt of the five-year claims history, and a limit of £5,000,000 may apply ' +
      'if the fleet telematics data is supplied. The final limit will be stated in the schedule.',
  );
  heading(doc, 'Subjectivities');
  para(doc, 'This quotation is subject to a satisfactory claims history and a site survey of the Ashbridge depot.');
  disclaimer(doc);

  doc.addPage();
  letterhead(doc, 'Northgate Assurance plc', 'Reference NGA-PL-77120  |  Schedule', '#3d6b35');
  heading(doc, 'Schedule');
  rows(doc, [
    ['Limit of indemnity', 'TBC - see page 1'],
    ['Excess', '£1,000 each and every claim (property damage only)'],
    ['Territorial limits', 'Great Britain, Northern Ireland, the Channel Islands and the Isle of Man'],
  ]);
  disclaimer(doc);
}

function renderDuplicate(doc) {
  letterhead(doc, 'HARBOURLINE MUTUAL', 'Reissued quotation  -  replaces all earlier copies', '#7a2e5c');
  doc.font('Helvetica-Bold').fontSize(14).text('Re: Your property insurance quotation (reissue)', 50).moveDown(0.8);
  para(doc, 'Dear Ms Okafor,');
  para(
    doc,
    'Further to your broker\'s request, please find below a reissued copy of our quotation ' +
      'ref. HLM-2026-04417 for Brightwater Bakery Ltd. The terms are unchanged.',
  );
  para(
    doc,
    'Policy: Commercial Property (Buildings and Contents). Cover commences on 1 November 2026 for a period of ' +
      '12 months. The cover limit is £1,500,000 any one loss, subject to a £500 excess.',
  );
  para(doc, 'The annual premium is £4,812.50 GBP including Insurance Premium Tax.');
  para(doc, 'Yours sincerely,');
  para(doc, 'Imogen Strand, Senior Underwriter, Harbourline Mutual Insurance');
  disclaimer(doc);
}

export function writeSample(sample, dir) {
  return new Promise((resolve, reject) => {
    const path = join(dir, sample.file);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: sample.file,
        Author: 'Document Extractor sample generator',
        Subject: DISCLAIMER,
        CreationDate: FIXED_DATE,
        ModDate: FIXED_DATE,
      },
    });
    const out = createWriteStream(path);
    out.on('finish', () => resolve(path));
    out.on('error', reject);
    doc.pipe(out);
    sample.render(doc);
    doc.end();
  });
}

export async function writeSamples(dir) {
  mkdirSync(dir, { recursive: true });
  return Promise.all(SAMPLES.map((s) => writeSample(s, dir)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = fileURLToPath(new URL('../samples', import.meta.url));
  const paths = await writeSamples(dir);
  for (const p of paths) console.log(`wrote ${p}`);
}
