// Renders the Open Graph link card (public/og.png) straight from the board
// layout. Run with `npm run og` after changing layout.ts.
//   npm run og -- --debug <file.png>   full-board render for inspecting layout

import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { boardMarkup, COLORS } from '../src/board/svg';
import { BOARD } from '../src/board/layout';
import { NAV } from '../src/board/nets';
import { navPaths } from '../src/board/svg';
import profile from '../src/content/profile.json';

const args = process.argv.slice(2);
const render = (svg: string, width: number) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: 'Consolas' } }).render().asPng();

if (args[0] === '--debug') {
  const vb = args[2] ?? `0 0 ${BOARD.w} ${BOARD.h}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${boardMarkup((args[3] as 'flat' | 'texture') ?? 'flat')}</svg>`;
  fs.writeFileSync(args[1], render(svg, 2400));
  console.log('wrote', args[1]);
} else {
  // 1200 x 630 card: board on the right, name on the left, nets lit.
  const W = 1200, H = 630, scale = 5.4;
  const glow = NAV.map((n) => navPaths(n.id).map((p) =>
    `<path d="${p.d}" fill="none" stroke="${n.color}" stroke-width="${p.layer === 'top' ? 0.42 : 0.3}" stroke-opacity="${p.layer === 'top' ? 1 : 0.45}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${COLORS.bg}"/>
  <g transform="translate(${W - BOARD.w * scale + 250} ${(H - BOARD.h * scale) / 2}) scale(${scale})">${boardMarkup('flat')}${glow}</g>
  <defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${COLORS.bg}"/><stop offset="0.42" stop-color="${COLORS.bg}" stop-opacity="0.94"/><stop offset="0.75" stop-color="${COLORS.bg}" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <g font-family="Consolas, 'DejaVu Sans Mono', monospace" fill="#eef2ee">
    <text x="64" y="250" font-size="26" fill="#7fe3a4" letter-spacing="3">U1 · MAIN MCU · REV A</text>
    <text x="64" y="330" font-size="68" font-weight="700">${profile.name}</text>
    <text x="64" y="386" font-size="25" fill="#aab4ad">${profile.tagline}</text>
    <text x="64" y="452" font-size="22" fill="#7d8780">${profile.school} · ${profile.degreeShort}</text>
  </g>
</svg>`;
  const out = path.resolve('public/og.png');
  fs.writeFileSync(out, render(svg, W));
  console.log('wrote', out);
}
