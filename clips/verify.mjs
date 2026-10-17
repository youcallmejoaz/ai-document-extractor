// Checks every clip listed in clips/MANIFEST.md: the file exists, decodes end to end without
// errors, is 1920x1080 H.264 with no audio, and its duration matches the manifest. Also
// checks the explainer-card stills and that no clip on disk is missing from the manifest.
//
//   npm run clips:verify
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const CLIPS = fileURLToPath(new URL('.', import.meta.url));
const manifest = readFileSync(join(CLIPS, 'MANIFEST.md'), 'utf8');

const rows = [...manifest.matchAll(/^\| (C\d\d(?:-CU)?) \| (\S+\.mp4) \| ([\d.]+) s \|/gm)].map((m) => ({
  id: m[1],
  file: m[2],
  duration: Number(m[3]),
}));
const stills = [...manifest.matchAll(/`(C\d\d_\w+\.png)`/g)].map((m) => m[1]);

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

for (const row of rows) {
  const path = join(CLIPS, row.file);
  console.log(`${row.id} ${row.file}`);
  if (!existsSync(path)) {
    fail('file missing');
    continue;
  }
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt:format=duration',
    '-of', 'json', path,
  ]);
  const info = JSON.parse(stdout);
  const video = info.streams.filter((s) => s.codec_type === 'video');
  const audio = info.streams.filter((s) => s.codec_type === 'audio');
  const duration = Number(info.format.duration);
  if (video.length !== 1) fail(`expected 1 video stream, found ${video.length}`);
  const v = video[0] ?? {};
  if (v.codec_name !== 'h264') fail(`codec ${v.codec_name}, expected h264`);
  if (v.width !== 1920 || v.height !== 1080) fail(`size ${v.width}x${v.height}, expected 1920x1080`);
  if (v.pix_fmt !== 'yuv420p') fail(`pixel format ${v.pix_fmt}, expected yuv420p`);
  if (audio.length) fail('has an audio stream');
  if (Math.abs(duration - row.duration) > 0.06) fail(`duration ${duration.toFixed(2)} s, manifest says ${row.duration} s`);

  // Decode every frame; any decoder error means the file does not play cleanly.
  const decode = await run('ffmpeg', ['-v', 'error', '-i', path, '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 });
  if (decode.stderr.trim()) fail(`decode errors: ${decode.stderr.trim().split('\n')[0]}`);
  console.log(`  ok  ${duration.toFixed(2)} s, ${v.codec_name} ${v.width}x${v.height}`);
}

for (const still of stills) {
  const path = join(CLIPS, still);
  console.log(still);
  if (!existsSync(path)) {
    fail('file missing');
    continue;
  }
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]);
  if (stdout.trim() !== '1920,1080') fail(`size ${stdout.trim()}, expected 1920,1080`);
  else console.log('  ok  1920x1080 PNG');
}

const listed = new Set(rows.map((r) => r.file));
for (const file of readdirSync(CLIPS).filter((f) => f.endsWith('.mp4'))) {
  if (!listed.has(file)) fail(`${file} is on disk but not in MANIFEST.md`);
}

if (!rows.length) fail('no clips found in MANIFEST.md');
console.log(failures ? `\n${failures} problem(s) found` : `\nAll ${rows.length} clips and ${stills.length} stills check out.`);
process.exit(failures ? 1 : 0);
