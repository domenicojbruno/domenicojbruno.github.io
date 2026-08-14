// One-off asset pipeline. Reads the raw portfolio folders, writes web-ready
// assets into src/assets and public. Re-runnable; overwrites its outputs.
//
// sharp strips all metadata (incl. GPS EXIF) unless you explicitly keep it,
// so every image that passes through here is scrubbed by construction.
//
// Run: node scripts/prep-assets.mjs
import sharp from 'sharp';
import { mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const RAW = 'C:/Users/domen/Documents/Portfolio Website';
const EVENT = 'C:/Users/domen/OneDrive/Documents/I3C_EventCamera';
const SITE = dirname(import.meta.dirname);

const out = (...p) => join(SITE, ...p);
const kb = (n) => `${Math.round(n / 1024)} KB`;

async function report(label, path) {
  const { size } = await stat(path);
  console.log(`  ${label.padEnd(34)} ${kb(size).padStart(9)}`);
}

// ---------------------------------------------------------------- schematics
// His own clEAR-ExG block schematics, straight out of Cadence. Already small
// and already PNG; just normalise the names (every file is suffixed " - Copy").
async function schematics() {
  console.log('\nschematics');
  const dir = join(RAW, 'Images/ECE524');
  const dest = out('src/assets/schematics');
  await mkdir(dest, { recursive: true });

  for (const f of await readdir(dir)) {
    if (!f.startsWith('Project_') || !f.endsWith('.png')) continue;
    const name = f
      .replace(' - Copy', '')
      .replace(/\.png$/, '')
      .replace(/^Project_/, '')
      .replace(/_/g, '-')
      .toLowerCase() + '.png';
    // Cadence screenshots are line art on white — palette PNG keeps them crisp
    // and roughly halves the bytes.
    await sharp(join(dir, f)).png({ palette: true, quality: 90 }).toFile(join(dest, name));
    await report(name, join(dest, name));
  }
}

// ------------------------------------------------------------------ personal
const PHOTOS = [
  ['Pets and Family/Dog1.JPEG', 'dog.jpg', 1400],
  ['Side Hobbies/Img3.jpg', 'workbench.jpg', 2000],
  ['Side Hobbies/DCI Championship.jpg', 'drum-corps.jpg', 1600],
  ['Side Hobbies/LegoKanto_2.png', 'lego-kanto.jpg', 800],
  ['Side Hobbies/LegoDormRoom.png', 'lego-dorm.jpg', 800],
];

async function personal() {
  console.log('\npersonal  (EXIF + GPS stripped by sharp)');
  const dest = out('src/assets/personal');
  await mkdir(dest, { recursive: true });

  for (const [src, name, width] of PHOTOS) {
    const p = join(dest, name);
    await sharp(join(RAW, src))
      .rotate()                       // honour EXIF orientation before dropping it
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(p);
    await report(name, p);
  }
}

// --------------------------------------------------------------- event media
// No ffmpeg on this machine. Animated WebP gets these from tens of MB down to
// something shippable with zero extra tooling, and plain <img loading="lazy">
// plays it. `pages` caps the frame count on the worst offenders.
// ponytail: WebP over H.264 to avoid an ffmpeg dependency; if CrowdMonitor is
// still too heavy, transcode that one to mp4 by hand.
const CLIPS = [
  ['MissileAutofocus.gif', 'missile-autofocus.webp', 0],
  ['MissileAutofocusDualPixel.gif', 'missile-dualpixel.webp', 0],
  ['MissileFrameCamera.gif', 'missile-framecamera.webp', 0],
  ['ArtemisReentry.gif', 'artemis-reentry.webp', 0],
  ['CrowdMonitor.gif', 'crowd-monitor.webp', 90],
  ['EventCameraSim.gif', 'event-sim.webp', 0],
  ['EventCameraSimV2.gif', 'event-sim-helix.webp', 0],
];

async function clips() {
  console.log('\nevent camera  (gif -> animated webp)');
  const dest = out('public/clips');
  await mkdir(dest, { recursive: true });

  for (const [src, name, pages] of CLIPS) {
    const p = join(dest, name);
    const opts = { animated: true, ...(pages ? { pages } : {}) };
    // Sources are 800x500 / 240 frames. 720 wide is still sharp at the size
    // they render on the case study. Effort stays at 4: these are dense DVS
    // noise, so they are entropy-bound — effort 6 bought 8% for minutes of
    // encoding per clip.
    await sharp(join(EVENT, src), opts)
      .resize({ width: 720, withoutEnlargement: true })
      .webp({ quality: 60, effort: 4 })
      .toFile(p);
    const before = (await stat(join(EVENT, src))).size;
    const after = (await stat(p)).size;
    console.log(
      `  ${name.padEnd(34)} ${kb(after).padStart(9)}   (was ${kb(before)})`
    );
  }
}

// ---------------------------------------------------------------------- misc
async function misc() {
  console.log('\nmisc');
  await mkdir(out('public'), { recursive: true });
  const resume = out('public/domenico-bruno-resume.pdf');
  await copyFile(join(RAW, 'DomenicoBrunoResume2027 (1).pdf'), resume);
  await report('domenico-bruno-resume.pdf', resume);

  const logo = out('src/assets/focus-logo.png');
  await sharp(join(EVENT, 'focus_logo.png'))
    .resize({ width: 400, withoutEnlargement: true })
    .png({ palette: true })
    .toFile(logo);
  await report('focus-logo.png', logo);
}

// ---------------------------------------------------------------- og image
// Link-preview card. Drawn as SVG and rasterised by sharp, so it stays in sync
// with the site's palette without a headless browser anywhere in the loop.
// ponytail: system font, not Space Grotesk — resvg only sees installed fonts,
// and an OG card is not worth shipping a font-loading step for.
async function og() {
  console.log('\nog card');
  const W = 1200, H = 630;
  const grid = Array.from({ length: 25 }, (_, i) =>
    `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${H}"/><line x1="0" y1="${i * 50}" x2="${W}" y2="${i * 50}"/>`
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#050607"/>
    <g stroke="#1b2128" stroke-width="1" opacity="0.55">${grid}</g>
    <path d="M0 500 ${Array.from({ length: 60 }, (_, i) => {
      const x = (i / 59) * W;
      const y = 500 + Math.sin(i / 4) * 46 + Math.sin(i / 1.4) * 12;
      return `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ')}" fill="none" stroke="#00e08a" stroke-width="3" opacity="0.5"/>
    <text x="72" y="150" font-family="Segoe UI, Arial" font-size="22" letter-spacing="6" fill="#00e08a">ANALOG IC DESIGN</text>
    <text x="70" y="272" font-family="Segoe UI, Arial" font-size="104" font-weight="700" fill="#e9edf0">DOMENICO</text>
    <text x="70" y="378" font-family="Segoe UI, Arial" font-size="104" font-weight="700" fill="none" stroke="#00e08a" stroke-width="2">BRUNO</text>
    <text x="72" y="446" font-family="Segoe UI, Arial" font-size="27" fill="#97a1aa">Low-power biopotential front-ends in 180 nm CMOS.</text>
    <text x="72" y="580" font-family="Segoe UI, Arial" font-size="20" letter-spacing="3" fill="#5c666f">WPI BS/MS ECE  ·  SUBTHRESHOLD OTA  ·  OTA-C FILTERS  ·  CADENCE VIRTUOSO</text>
  </svg>`;

  const p = out('public/og.png');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(p);
  await report('og.png', p);
}

await schematics();
await personal();
await clips();
await misc();
await og();
console.log('\ndone');
