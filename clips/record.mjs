// Records the client demo clips as 1920x1080 H.264 MP4s and writes clips/MANIFEST.md.
//
//   npm run clips                 # every scene
//   npm run clips -- C06 C07      # only some scenes
//
// The app runs in-process with the canned mock extractor (scripts/mock-extractor.js) and a
// fresh in-memory database per scene, so takes are repeatable and no API key is involved.
// Frames are captured with Chrome's screencast at 3x device pixels (3840x2160): main clips
// are downscaled to 1080p and CLOSEUP clips are cropped from the same frames, so both stay
// sharp. Needs ffmpeg on PATH.
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { createMockExtractor, CANNED } from '../scripts/mock-extractor.js';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLIPS = join(ROOT, 'clips');
const CARDS = join(CLIPS, 'cards');
const WORK = join(CLIPS, '.work');
const SAMPLES = join(ROOT, 'samples');

const VIEW = { w: 1280, h: 720 }; // CSS pixels
const DSF = 3; // capture at 3840x2160
const OUT = { w: 1920, h: 1080, fps: 30 };
const PAUSE = 1000; // "about 1 second after each step"

const sample = (name) => join(SAMPLES, name);

// ---------------------------------------------------------------------------
// Overlay: visible cursor, click ring, highlight box and drag ghost. Injected into every
// page; it only draws, it never changes what the app does.
// ---------------------------------------------------------------------------
const OVERLAY = String.raw`(() => {
  if (window.__demo) return;
  const css = ${'`'}
    #demo-cursor { position: fixed; left: 0; top: 0; width: 30px; height: 30px; z-index: 2147483647;
      pointer-events: none; opacity: 0; transition: opacity .2s; will-change: transform;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #demo-cursor.on { opacity: 1; }
    #demo-cursor svg { width: 30px; height: 30px; display: block; transition: transform .12s; transform-origin: 3px 3px; }
    #demo-cursor.down svg { transform: scale(.86); }
    .demo-ring { position: fixed; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%;
      border: 4px solid #2456c7; background: rgba(36,86,199,.18); pointer-events: none; z-index: 2147483646;
      animation: demo-ring .75s ease-out forwards; }
    @keyframes demo-ring { from { transform: scale(.35); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
    #demo-spot { position: absolute; z-index: 2147483645; pointer-events: none; border-radius: 10px;
      border: 3px solid #2456c7; box-shadow: 0 0 0 6px rgba(36,86,199,.16); opacity: 0;
      transition: left .45s cubic-bezier(.22,1,.36,1), top .45s cubic-bezier(.22,1,.36,1),
        width .45s cubic-bezier(.22,1,.36,1), height .45s cubic-bezier(.22,1,.36,1), opacity .3s; }
    #demo-spot.on { opacity: 1; }
    #demo-ghost { position: fixed; left: 0; top: 0; z-index: 2147483646; pointer-events: none; display: none;
      font: 600 15px Inter, system-ui, sans-serif; color: #1c2430; }
    #demo-ghost .files { position: relative; width: 70px; height: 78px; }
    #demo-ghost .file { position: absolute; width: 52px; height: 66px; border-radius: 6px; background: #fff;
      border: 2px solid #c5221f; box-shadow: 0 4px 10px rgba(0,0,0,.18); display: grid; place-items: end center;
      padding-bottom: 6px; font-size: 11px; font-weight: 800; color: #c5221f; }
    #demo-ghost .tag { margin-top: 4px; background: #2456c7; color: #fff; border-radius: 999px; padding: 3px 10px;
      display: inline-block; }
  ${'`'};
  let cursor, spot, ghost, x = -100, y = -100;
  function ensure() {
    if (cursor || !document.documentElement) return;
    const style = document.createElement('style');
    style.textContent = css;
    cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 2.5 3 19.5 7.6 15.3 10.6 22 13.6 20.7 10.7 14.2 17 14.2Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    spot = document.createElement('div');
    spot.id = 'demo-spot';
    ghost = document.createElement('div');
    ghost.id = 'demo-ghost';
    document.documentElement.append(style, spot, ghost, cursor);
  }
  function place() {
    cursor.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 3) + 'px)';
    ghost.style.transform = 'translate(' + (x + 14) + 'px,' + (y + 12) + 'px)';
  }
  addEventListener('mousemove', (e) => { ensure(); x = e.clientX; y = e.clientY; cursor.classList.add('on'); place(); }, true);
  addEventListener('mousedown', (e) => {
    ensure();
    cursor.classList.add('down');
    const ring = document.createElement('div');
    ring.className = 'demo-ring';
    ring.style.left = e.clientX + 'px';
    ring.style.top = e.clientY + 'px';
    document.documentElement.append(ring);
    setTimeout(() => ring.remove(), 800);
  }, true);
  addEventListener('mouseup', () => cursor && cursor.classList.remove('down'), true);
  window.__demo = {
    spot(rect, pad = 6) {
      ensure();
      if (!rect) return spot.classList.remove('on');
      Object.assign(spot.style, {
        left: rect.x + scrollX - pad + 'px', top: rect.y + scrollY - pad + 'px',
        width: rect.width + 2 * pad + 'px', height: rect.height + 2 * pad + 'px',
      });
      spot.classList.add('on');
    },
    ghost(count) {
      ensure();
      if (!count) { ghost.style.display = 'none'; return; }
      ghost.innerHTML = '<div class="files">' + Array.from({ length: count }, (_, i) =>
        '<div class="file" style="left:' + i * 8 + 'px;top:' + i * 5 + 'px">PDF</div>').join('') +
        '</div><span class="tag">' + count + ' PDF files</span>';
      ghost.style.display = 'block';
      place();
    },
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', ensure); else ensure();
})();`;

// ---------------------------------------------------------------------------
// Recorder: Chrome screencast frames -> ffmpeg
// ---------------------------------------------------------------------------
class Recorder {
  constructor(page, cdp, id) {
    this.page = page;
    this.cdp = cdp;
    this.dir = join(WORK, id);
    this.frames = [];
    this.writes = [];
    this.keyframes = [];
    this.onFrame = ({ data, sessionId, metadata }) => {
      const file = join(this.dir, `f${String(this.frames.length).padStart(6, '0')}.jpg`);
      this.frames.push({ file, t: metadata.timestamp });
      this.writes.push(writeFile(file, Buffer.from(data, 'base64')));
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    };
  }

  async begin() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp.on('Page.screencastFrame', this.onFrame);
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 90,
      maxWidth: VIEW.w * DSF,
      maxHeight: VIEW.h * DSF,
      everyNthFrame: 1,
    });
    while (!this.frames.length) await this.page.waitForTimeout(20);
    await this.page.waitForTimeout(150);
    this.start = Date.now() / 1000;
  }

  elapsed() {
    return Date.now() / 1000 - this.start;
  }

  /** Camera position for the CLOSEUP version, in CSS pixels, from now on. */
  keyframe(rect) {
    this.keyframes.push({ t: this.elapsed(), rect });
  }

  async end() {
    this.end_ = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast');
    this.cdp.off('Page.screencastFrame', this.onFrame);
    await Promise.all(this.writes);
  }

  /** ffmpeg concat list covering exactly [start, end]. */
  concatList() {
    const { frames, start } = this;
    const end = this.end_;
    let first = 0;
    for (let i = 0; i < frames.length; i++) if (frames[i].t <= start) first = i;
    const lines = [];
    let last;
    for (let i = first; i < frames.length; i++) {
      const from = Math.max(frames[i].t, start);
      const to = Math.min(frames[i + 1]?.t ?? end, end);
      if (to <= from) continue;
      lines.push(`file '${frames[i].file}'`, `duration ${(to - from).toFixed(6)}`);
      last = frames[i].file;
    }
    lines.push(`file '${last}'`); // concat demuxer needs the last file twice
    const path = join(this.dir, 'frames.txt');
    writeFileSync(path, lines.join('\n') + '\n');
    return path;
  }

  async encode(out, { crop } = {}) {
    const list = this.concatList();
    const filters = [`fps=${OUT.fps}`];
    if (crop) filters.push(crop);
    filters.push(`scale=${OUT.w}:${OUT.h}:flags=lanczos`, 'format=yuv420p');
    await run('ffmpeg', [
      '-v', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
      '-r', String(OUT.fps), '-movflags', '+faststart', '-an',
      out,
    ], { maxBuffer: 16 * 1024 * 1024 });
  }

  /**
   * Crop filter that follows the recorded keyframes: a fixed-size 16:9 window (big enough
   * for every keyframe box) that eases from one box to the next.
   */
  cropFilter({ pad = 36, minWidth = 640 } = {}) {
    const W = VIEW.w * DSF;
    const H = VIEW.h * DSF;
    const boxes = this.keyframes.map(({ t, rect }) => ({
      t,
      x: (rect.x - pad) * DSF,
      y: (rect.y - pad) * DSF,
      w: (rect.width + 2 * pad) * DSF,
      h: (rect.height + 2 * pad) * DSF,
    }));
    let cw = Math.max(minWidth * DSF, ...boxes.map((b) => Math.max(b.w, (b.h * 16) / 9)));
    cw = Math.min(W, Math.round(cw / 16) * 16);
    const ch = Math.round((cw * 9) / 16);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const pos = boxes.map((b) => ({
      t: b.t,
      x: Math.round(clamp(b.x + b.w / 2 - cw / 2, 0, W - cw)),
      y: Math.round(clamp(b.y + b.h / 2 - ch / 2, 0, H - ch)),
    }));
    const D = 0.8;
    const ease = (t0) => `(clip((t-${t0.toFixed(3)})/${D},0,1)^2*(3-2*clip((t-${t0.toFixed(3)})/${D},0,1)))`;
    const expr = (k) =>
      [String(pos[0][k]), ...pos.slice(1).map((p, i) => `(${p[k] - pos[i][k]})*${ease(p.t)}`)].join('+');
    return `crop=w=${cw}:h=${ch}:x='${expr('x')}':y='${expr('y')}'`;
  }

  /** Full-resolution PNG of the current page, downscaled to 1920x1080. */
  async still(out) {
    const shot = await this.cdp.send('Page.captureScreenshot', { format: 'png' });
    const tmp = join(this.dir, 'still-4k.png');
    writeFileSync(tmp, Buffer.from(shot.data, 'base64'));
    await run('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', `scale=${OUT.w}:${OUT.h}:flags=lanczos`, out]);
  }

  cleanup() {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// A careful human: eased mouse paths, a pause after every step, typing at human speed.
// ---------------------------------------------------------------------------
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Human {
  constructor(page, rec, seed = 7) {
    this.page = page;
    this.rec = rec;
    this.pos = { x: VIEW.w * 0.7, y: VIEW.h * 0.75 };
    this.random = rng(seed);
  }

  pause(ms = PAUSE) {
    return this.page.waitForTimeout(ms);
  }

  async place(x, y) {
    this.pos = { x, y };
    await this.page.mouse.move(x, y);
  }

  /** Re-show the cursor after a navigation (the overlay starts hidden on a new page). */
  async reappear() {
    await this.page.mouse.move(this.pos.x + 1, this.pos.y);
    await this.page.mouse.move(this.pos.x, this.pos.y);
  }

  async moveTo(x, y, ms) {
    const from = this.pos;
    const dist = Math.hypot(x - from.x, y - from.y);
    if (dist < 1) return;
    ms ??= Math.min(1100, Math.max(420, 300 + dist * 0.75));
    const bend = (this.random() - 0.5) * Math.min(80, dist * 0.18); // slight natural arc
    const nx = -(y - from.y) / dist;
    const ny = (x - from.x) / dist;
    // Time-based, so the move takes `ms` however slow each mouse event is while capturing.
    const t0 = Date.now();
    for (let p = 0; p < 1; ) {
      p = Math.min(1, (Date.now() - t0) / ms);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const arc = Math.sin(Math.PI * p) * bend;
      await this.page.mouse.move(from.x + (x - from.x) * e + nx * arc, from.y + (y - from.y) * e + ny * arc);
      await this.page.waitForTimeout(8);
    }
    this.pos = { x, y };
  }

  async scrollTo(top, ms = 900) {
    await this.page.evaluate(
      ([top, ms]) =>
        new Promise((done) => {
          const y0 = scrollY;
          const target = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
          const t0 = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - t0) / ms);
            const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            scrollTo(0, y0 + (target - y0) * e);
            if (p < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        }),
      [top, ms],
    );
  }

  /** Smooth-scrolls so the element's top sits `offset` px below the top of the window. */
  async scrollToElement(locator, offset = 60) {
    const box = await locator.boundingBox();
    const y = await this.page.evaluate(() => scrollY);
    await this.scrollTo(y + box.y - offset);
  }

  async ensureVisible(locator, margin = 70) {
    const box = await locator.boundingBox();
    if (box.y >= margin && box.y + box.height <= VIEW.h - margin) return;
    await this.scrollToElement(locator, VIEW.h / 2 - box.height / 2);
    await this.pause(300);
  }

  async hover(locator, { dx = 0.5, dy = 0.5, ms } = {}) {
    await this.ensureVisible(locator);
    const box = await locator.boundingBox();
    await this.moveTo(box.x + box.width * dx, box.y + box.height * dy, ms);
  }

  async click(locator, { after = PAUSE, dx, dy } = {}) {
    await this.hover(locator, { dx, dy });
    await this.pause(220);
    await this.page.mouse.down();
    await this.pause(90);
    await this.page.mouse.up();
    if (after) await this.pause(after);
  }

  /** Clicks something that opens the file picker and picks `files` (no OS dialog is drawn). */
  async chooseFiles(locator, files) {
    const chooser = this.page.waitForEvent('filechooser');
    await this.click(locator, { after: 0 });
    await (await chooser).setFiles(files);
    await this.pause(PAUSE);
  }

  async type(text) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await this.page.waitForTimeout(85 + this.random() * 90 + (ch === ' ' ? 60 : 0));
    }
    await this.pause(PAUSE);
  }

  /** Reads along a line of text with the cursor, like a reviewer checking it. */
  async readAlong(locator, ms = 2200) {
    const r = await textRect(locator);
    await this.moveTo(r.x + 4, r.y + r.height + 6);
    await this.moveTo(r.x + r.width - 4, r.y + r.height + 6, ms);
  }

  async spot(locator, pad) {
    const rect = locator ? await locator.boundingBox() : null;
    await this.page.evaluate(([rect, pad]) => window.__demo.spot(rect, pad), [rect, pad]);
  }

  /** Holds the final frame so the clip lands near its target length (never more than `cap`). */
  async holdUntil(target, { min = 1500, cap = 5000 } = {}) {
    const remaining = (target - this.rec.elapsed()) * 1000;
    await this.pause(Math.max(min, Math.min(cap, remaining)));
  }
}

/** Bounding box of an element's text (not its whole box), in viewport CSS pixels. */
async function textRect(locator) {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

function union(...rects) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

// ---------------------------------------------------------------------------
// App helpers
// ---------------------------------------------------------------------------
async function startApp() {
  const db = openDb(':memory:');
  const app = createApp({ db, extractor: createMockExtractor({ delayMs: 600 }) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    db,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function approveCanned(db, filename, edits = {}) {
  const values = Object.fromEntries(CANNED[filename].fields.map((f) => [f.name, f.value]));
  db.insertRecord({
    values: { ...values, ...edits },
    filename,
    extraction: CANNED[filename],
    editedFields: Object.keys(edits),
  });
}

const card = (page, filename) => page.locator('.doc-card', { hasText: filename });
const row = (scope, field) => scope.locator(`tr[data-row=${field}]`);

async function extractInstantly(page, files) {
  await page.setInputFiles('#file-input', files);
  await page.click('#extract-btn');
  await page.waitForFunction((n) => document.querySelectorAll('.doc-card table').length >= n, files.length);
}

async function dropFiles(page, h, names) {
  const files = names.map((name) => ({ name, b64: readFileSync(sample(name)).toString('base64') }));
  await page.evaluate((files) => {
    const dt = new DataTransfer();
    for (const f of files) {
      const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
      dt.items.add(new File([bytes], f.name, { type: 'application/pdf' }));
    }
    window.__demoFiles = dt;
  }, files);
  const fire = (type) =>
    page.evaluate((type) => {
      const zone = document.getElementById('dropzone');
      zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: window.__demoFiles }));
    }, type);

  const zone = await page.locator('#dropzone').boundingBox();
  await page.evaluate((n) => window.__demo.ghost(n), names.length);
  await h.moveTo(zone.x + zone.width * 0.62, zone.y + zone.height + 40, 1100);
  await fire('dragenter');
  await fire('dragover');
  await h.moveTo(zone.x + zone.width * 0.5, zone.y + zone.height * 0.5, 650);
  await h.pause(450);
  await fire('drop');
  await page.evaluate(() => window.__demo.ghost(0));
  await h.pause(PAUSE);
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
const SCENES = [
  {
    id: 'C01',
    slug: 'hook',
    target: 10,
    section: 'C1 · Hook (10s)',
    shows:
      'All three sample PDFs are dragged onto the upload page and dropped; Extract is clicked; three review cards appear and the view settles on the one amber field (the unclear cover limit).',
    async run({ page, h, rec, app }) {
      await page.goto(app.url + '/');
      await h.place(1180, 650);
      await rec.begin();
      await dropFiles(page, h, ['quote-duplicate.pdf', 'quote-clean.pdf', 'quote-unclear-cover.pdf']);
      await h.click(page.locator('#extract-btn'), { after: 0 });
      await page.waitForFunction(() => document.querySelectorAll('.doc-card table').length === 3);
      await h.pause(500);
      const amber = row(card(page, 'quote-unclear-cover.pdf'), 'cover_limit');
      const box = await amber.boundingBox();
      await h.scrollTo((await page.evaluate(() => scrollY)) + box.y - 330, 1000);
      await h.hover(amber.locator('.field-label'), { dx: 1.25, dy: 0.8 });
      await h.holdUntil(10, { min: 1200, cap: 2500 });
      await rec.end();
    },
  },
  {
    id: 'C03',
    slug: 'flow',
    target: 25,
    card: 'C03_flow.html',
    still: true,
    section: 'C3 · Flow card (25s)',
    shows:
      'Animated card: five boxes appear one by one, joined by arrows: PDF in → AI reads it → Shows the source → Person approves → Saved to dashboard.',
  },
  {
    id: 'C04',
    slug: 'upload',
    target: 15,
    section: 'C4 · Upload (15s)',
    shows:
      'Starts on the empty dashboard, opens the upload page, clicks the drop zone to choose the clean and unclear quotes, clicks Extract and scrolls to the review cards.',
    async run({ page, h, rec, app }) {
      await page.goto(app.url + '/dashboard.html');
      await h.place(820, 420);
      await rec.begin();
      await h.pause(800);
      await h.click(page.locator('header nav a[href="/"]'), { after: 0 });
      await page.waitForSelector('#dropzone');
      await h.reappear();
      await h.pause(PAUSE);
      await h.chooseFiles(page.locator('#dropzone'), [sample('quote-clean.pdf'), sample('quote-unclear-cover.pdf')]);
      await h.click(page.locator('#extract-btn'), { after: 0 });
      await page.waitForFunction(() => document.querySelectorAll('.doc-card table').length === 2);
      await h.pause(800);
      await h.scrollToElement(page.locator('.doc-card').first(), 24);
      await h.moveTo(640, 360);
      await h.holdUntil(15, { cap: 3000 });
      await rec.end();
    },
  },
  {
    id: 'C05',
    slug: 'record_fills',
    target: 25,
    section: 'C5 · Record fills in (25s)',
    shows:
      'The clean quote is extracted, then its eight fields are highlighted one at a time (client, insurer, policy type, premium, currency, start date, cover limit, quote reference) with value, source quote and page.',
    async run({ page, h, rec, app }) {
      await page.goto(app.url + '/');
      await page.setInputFiles('#file-input', sample('quote-clean.pdf'));
      await h.place(900, 420);
      await rec.begin();
      await h.pause(700);
      await h.click(page.locator('#extract-btn'), { after: 0 });
      await page.waitForSelector('.doc-card table');
      await h.pause(700);
      const c = card(page, 'quote-clean.pdf');
      await h.scrollToElement(c, 20);
      await h.pause(600);
      for (const field of ['client_name', 'insurer', 'policy_type', 'premium', 'currency', 'start_date', 'cover_limit', 'quote_reference']) {
        const r = row(c, field);
        await h.spot(r, 4);
        await h.hover(r.locator('input'), { dx: 0.93, ms: 450 });
        await h.pause(1850);
      }
      await h.spot(null);
      await h.holdUntil(25, { cap: 2500 });
      await rec.end();
    },
  },
  {
    id: 'C06',
    slug: 'source',
    target: 25,
    section: 'C6 · Source (25s)',
    closeup: 'source panel (source quote and page columns)',
    shows:
      'On the clean quote, the premium field is clicked and its source quote and page are highlighted; the same check on the cover limit shows it was found on page 2.',
    async run({ page, h, rec, app }) {
      await page.goto(app.url + '/');
      await extractInstantly(page, [sample('quote-clean.pdf')]);
      const c = card(page, 'quote-clean.pdf');
      await page.evaluate(() => scrollTo(0, 0));
      const top = await c.boundingBox();
      await page.evaluate((y) => scrollTo(0, y), top.y - 20);
      await h.place(1000, 640);
      const premium = row(c, 'premium');
      const cover = row(c, 'cover_limit');
      const sourceRect = async (r) => union(await r.locator('td').nth(2).boundingBox(), await r.locator('td').nth(3).boundingBox());

      await rec.begin();
      rec.keyframe(await sourceRect(premium));
      await h.pause(800);
      await h.click(premium.locator('input'));
      await h.spot(premium.locator('td').nth(2), 2);
      await h.readAlong(premium.locator('.quote'), 2800);
      await h.pause(1500);
      await h.spot(premium.locator('td').nth(3), 2);
      await h.hover(premium.locator('.page'), { dx: 0.3 });
      await h.pause(2300);
      await h.spot(premium, 4);
      await h.pause(2300);

      rec.keyframe(await sourceRect(cover));
      await h.click(cover.locator('input'));
      await h.spot(cover.locator('td').nth(2), 2);
      await h.readAlong(cover.locator('.quote'), 2400);
      await h.pause(PAUSE);
      await h.spot(cover.locator('td').nth(3), 2);
      await h.hover(cover.locator('.page'), { dx: 0.3 });
      await h.pause(1800);
      await h.spot(null);
      await h.holdUntil(25, { cap: 3500 });
      await rec.end();
    },
  },
  {
    id: 'C07',
    slug: 'human_check',
    target: 35,
    section: 'C7 · Human check (35s)',
    closeup: 'amber cover limit field and Approve button',
    shows:
      'On the unclear quote, the reviewer points at the amber "Low confidence" cover limit, reads its source quote, replaces the value with "2,000,000 any one occurrence", clicks Approve and the green "Saved quote NGA-PL-77120" message appears.',
    async run({ page, h, rec, app }) {
      await page.goto(app.url + '/');
      await extractInstantly(page, [sample('quote-unclear-cover.pdf')]);
      const c = card(page, 'quote-unclear-cover.pdf');
      const top = await c.boundingBox();
      await page.evaluate((y) => scrollTo(0, y), top.y - 20);
      await h.place(1000, 300);
      const cover = row(c, 'cover_limit');
      const approve = c.getByRole('button', { name: 'Approve' });
      const fieldRect = async () =>
        union(await cover.locator('td').nth(0).boundingBox(), await cover.locator('td').nth(1).boundingBox(), await approve.boundingBox());

      await rec.begin();
      rec.keyframe(await fieldRect());
      await h.pause(800);
      await h.hover(c.locator('.badge.amber'), { dx: 1.1, dy: 0.9 });
      await h.pause(1800);
      await h.spot(cover, 4);
      await h.hover(cover.locator('.field-flag'), { dx: 1.15, dy: 0.9 });
      await h.pause(2000);
      await h.readAlong(cover.locator('.quote'), 4800);
      await h.pause(1800);
      await h.spot(null);
      await h.click(cover.locator('input'), { dx: 0.9, after: 700 });
      await page.keyboard.press('ControlOrMeta+A');
      await h.pause(600);
      await h.type('2,000,000 any one occurrence');
      await h.hover(cover.locator('.edited-note'), { dx: 2.2, dy: 0.9 });
      await h.pause(1500);
      await h.readAlong(cover.locator('.quote'), 2400); // re-check the source before approving
      await h.pause(600);
      await h.spot(approve, 6);
      await h.pause(700);
      await h.click(approve, { after: 0 });
      await c.locator('.badge.green').waitFor();
      await h.spot(null);
      const banner = c.locator('.banner.green');
      await h.pause(300); // the card collapses, so the page is short again
      await h.scrollTo(0, 700);
      await h.pause(400);
      rec.keyframe(union(await c.locator('.card-head h3').boundingBox(), await c.locator('.badge.green').boundingBox(), await textRect(banner)));
      await h.pause(PAUSE);
      await h.spot(banner, 4);
      await h.hover(banner, { dx: 0.45, dy: 0.95 });
      await h.holdUntil(35, { min: 2500, cap: 4500 });
      await rec.end();
    },
  },
  {
    id: 'C08',
    slug: 'duplicate_dashboard',
    target: 25,
    section: 'C8 · Duplicate and dashboard (25s)',
    shows:
      'With the clean and unclear quotes already approved, the duplicate quote is uploaded: its quote reference row and banner turn red and Approve is disabled. Then the Approved records dashboard opens with both saved records.',
    async run({ page, h, rec, app }) {
      approveCanned(app.db, 'quote-clean.pdf');
      approveCanned(app.db, 'quote-unclear-cover.pdf', { cover_limit: '2,000,000 any one occurrence' });
      await page.goto(app.url + '/');
      await h.place(900, 480);
      await rec.begin();
      await h.pause(700);
      await h.chooseFiles(page.locator('#dropzone'), [sample('quote-duplicate.pdf')]);
      await h.click(page.locator('#extract-btn'), { after: 0 });
      await page.waitForSelector('.doc-card table');
      await h.pause(700);
      const c = card(page, 'quote-duplicate.pdf');
      await h.scrollToElement(c, 20);
      await h.pause(500);
      await h.spot(c.locator('.banner.red'), 4);
      await h.readAlong(c.locator('.banner.red'), 1800);
      await h.pause(1200);
      const ref = row(c, 'quote_reference');
      await h.spot(ref, 4);
      await h.hover(ref.locator('input'), { dx: 0.9 });
      await h.pause(1600);
      await h.spot(c.getByRole('button', { name: 'Approve' }), 6);
      await h.hover(c.getByRole('button', { name: 'Approve' }));
      await h.pause(1500);
      await h.spot(null);
      await h.scrollTo(0, 800);
      await h.click(page.locator('header nav a[href="/dashboard.html"]'), { after: 0 });
      await page.waitForSelector('#records tr td');
      await h.reappear();
      await h.pause(800);
      const dupRow = page.locator('#records tr', { hasText: 'HLM-2026-04417' });
      await h.spot(dupRow, 2);
      await h.hover(dupRow.locator('td').nth(1));
      await h.holdUntil(25, { min: 2000, cap: 3000 });
      await rec.end();
    },
  },
  {
    id: 'C09',
    slug: 'prompts',
    target: 40,
    card: 'C09_prompts.html',
    section: 'C9 · Prompt moments (40s)',
    shows:
      'Dark terminal-style replay of four build prompts being typed, each followed by a one-line result: starter prompt (first 2 lines), sources, review screen, tests and deploy. Each moment is 9.8 s.',
  },
  {
    id: 'C10',
    slug: 'limits',
    target: 25,
    card: 'C10_limits.html',
    still: true,
    section: 'C10 · Limits card (25s)',
    shows:
      'Animated card, three rows of limit → safeguard: Blurry scans → The person approves; Different layouts → Fields set per business; Misread values → Every value shows its source.',
  },
  {
    id: 'C11',
    slug: 'business',
    target: 30,
    card: 'C11_business.html',
    still: true,
    section: 'C11 · Business card (30s)',
    shows:
      'Animated card listing, one by one: Less typing; Fewer mistakes; Data you can trust; Built in a week; A few cents per document (estimate).',
  },
];

const fileOf = (s, suffix = '') => `${s.id}_${s.slug}${suffix}.mp4`;

async function recordScene(context, scene) {
  const page = await context.newPage(); // viewport comes from the window size (see launch)
  await page.addInitScript(OVERLAY);
  const cdp = await page.context().newCDPSession(page);
  const rec = new Recorder(page, cdp, scene.id);
  const h = new Human(page, rec, scene.id.charCodeAt(2) * 31);
  const outputs = [];
  let app;
  try {
    if (scene.card) {
      await page.goto(pathToFileURL(join(CARDS, scene.card)).href);
      await page.evaluate(() => document.fonts.ready);
      await rec.begin();
      await page.evaluate(() => document.body.classList.add('play'));
      await page.waitForTimeout(scene.target * 1000);
      await rec.end();
      if (scene.still) {
        const png = `${scene.id}_${scene.slug}.png`;
        await rec.still(join(CLIPS, png));
        outputs.push(png);
      }
    } else {
      app = await startApp();
      await scene.run({ page, h, rec, app });
    }
    await rec.encode(join(CLIPS, fileOf(scene)));
    outputs.unshift(fileOf(scene));
    if (scene.closeup) {
      await rec.encode(join(CLIPS, fileOf(scene, '_closeup')), { crop: rec.cropFilter() });
      outputs.push(fileOf(scene, '_closeup'));
    }
  } finally {
    await page.close();
    await app?.close();
    rec.cleanup();
  }
  return outputs;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
async function duration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(stdout.trim());
}

async function writeManifest() {
  const rows = [];
  for (const s of SCENES) {
    const entries = [[s.id, fileOf(s), s.shows]];
    if (s.closeup) entries.push([`${s.id}-CU`, fileOf(s, '_closeup'), `CLOSEUP of ${fileOf(s)}, zoomed on the ${s.closeup}.`]);
    for (const [id, file, shows] of entries) {
      const path = join(CLIPS, file);
      if (!existsSync(path)) continue;
      rows.push(`| ${id} | ${file} | ${(await duration(path)).toFixed(1)} s | ${shows} | ${s.section} |`);
    }
  }
  const stills = SCENES.filter((s) => s.still)
    .map((s) => `${s.id}_${s.slug}.png`)
    .filter((f) => existsSync(join(CLIPS, f)));

  const md = `# Demo clips manifest

All clips are 1920×1080, H.264 (High profile, yuv420p), ${OUT.fps} fps, with no audio track. They were recorded by
\`clips/record.mjs\` (\`npm run clips\`) and checked by \`clips/verify.mjs\` (\`npm run clips:verify\`).

| Clip ID | File | Duration | What it shows | Script section |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

Still frames (the final frame of each explainer card, 1920×1080 PNG): ${stills.map((f) => `\`${f}\``).join(', ')}.

## How these were made

- The app ran locally with the three sample PDFs in \`samples/\`. Extraction used the **canned mock extractor**
  (\`scripts/mock-extractor.js\`) instead of a live Gemini call, so every take is repeatable and no API key was used.
  The on-screen results are exactly what the app shows for those canned results. A live Gemini call takes longer than
  the ~0.6 s per PDF shown here.
- Each scene starts from a fresh in-memory database. For C8, the clean and unclear quotes are approved before the take,
  matching what happens in C7.
- The cursor, the blue click ring, the blue highlight box and the "3 PDF files" drag image are drawn by the recorder
  for clarity. They are not part of the app.
- CLOSEUP clips are cropped from the same 3840×2160 capture as the main clip, so they are native resolution, not
  upscaled. The camera eases to the next area when the action moves.
- The explainer cards are HTML pages in \`clips/cards/\`. The C9 prompt texts are in \`clips/cards/C09_prompts.html\`.

## Differences from the scene list

- **C1, C4:** the app's button is labelled **Extract**, not "Review", so that is what gets clicked.
- **C1:** the app has no green ticks. Fields without problems are plain; only the unclear cover limit is amber.
- **C5:** the app shows all fields at once. The clip highlights them one at a time rather than animating them in.
- **C6:** the source quote and page are always visible in each row, rather than appearing on click. The clip clicks
  the premium field and then highlights its source and page. It also shows the cover limit sourced from page 2.
- **C9:** the four prompts are verbatim excerpts from the build session. The starter prompt's line 2 says "Claude
  API" (the app was later switched to Gemini). The tests prompt asked for a new \`document-extractor\` repo, but the
  code went to the existing repository. Nothing was deployed.
`;
  writeFileSync(join(CLIPS, 'MANIFEST.md'), md);
}

// ---------------------------------------------------------------------------
async function main() {
  const wanted = process.argv.slice(2).map((a) => a.toUpperCase());
  const scenes = wanted.length ? SCENES.filter((s) => wanted.includes(s.id)) : SCENES;
  if (!scenes.length) throw new Error(`No scenes match ${wanted.join(', ')}. Known: ${SCENES.map((s) => s.id).join(', ')}`);

  mkdirSync(WORK, { recursive: true });
  const browser = await chromium.launch({
    args: [`--force-device-scale-factor=${DSF}`, `--window-size=${VIEW.w},${VIEW.h}`, '--hide-scrollbars'],
  });
  const context = await browser.newContext({ viewport: null, locale: 'en-GB', timezoneId: 'Europe/London' });
  try {
    for (const scene of scenes) {
      const t0 = Date.now();
      const outputs = await recordScene(context, scene);
      console.log(`${scene.id}: ${outputs.join(', ')} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  } finally {
    await browser.close();
  }
  await writeManifest();
  console.log('wrote clips/MANIFEST.md');
}

await main();
