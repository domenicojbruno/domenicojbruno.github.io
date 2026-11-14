// Canvas-generated textures: the board surface (rasterised from the same SVG
// the 2D version uses), laser-etched package markings, and the inner planes.

import * as THREE from 'three';
import { boardSvgDocument } from '../board/svg';
import { BOARD, vias } from '../board/layout';

export async function loadBoardTexture(maxSize: number, anisotropy: number): Promise<THREE.CanvasTexture> {
  const W = Math.min(4096, maxSize), H = Math.round((W * BOARD.h) / BOARD.w);
  const svg = boardSvgDocument('texture', W, H);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.getContext('2d')!.drawImage(img, 0, 0, W, H);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Laser-etched marking for an IC top. Transparent, light grey, pin-1 dimple. */
export function markingTexture(lines: string[], w: number, h: number, hero = false): THREE.CanvasTexture {
  const px = hero ? 1024 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = px; canvas.height = Math.max(64, Math.round((px * h) / w));
  const g = canvas.getContext('2d')!;
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min((canvas.width * 0.84) / (longest * 0.61), (canvas.height * 0.78) / (lines.length * 1.45), canvas.width * 0.16);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const y0 = canvas.height / 2 - ((lines.length - 1) * size * 1.45) / 2;
  lines.forEach((l, i) => {
    g.font = `${i === 0 ? 700 : 500} ${size * (i === 0 ? 1 : 0.86)}px "JetBrains Mono", "IBM Plex Mono", Consolas, Menlo, monospace`;
    g.fillStyle = i === 0 ? 'rgba(214,219,224,0.92)' : 'rgba(176,183,190,0.8)';
    g.fillText(l, canvas.width / 2, y0 + i * size * 1.45);
  });
  // pin-1 dimple, top-left
  const r = canvas.width * (hero ? 0.018 : 0.04);
  g.fillStyle = 'rgba(120,126,134,0.55)';
  g.beginPath(); g.arc(r * 2.6, r * 2.6, r, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Copper plane seen from inside the board: hatch plus anti-pads around vias. */
export function planeTexture(tint: string): THREE.CanvasTexture {
  const W = 1024, H = 768, k = W / BOARD.w;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = tint; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 13) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 13) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = 'rgba(255,190,120,0.07)';
  for (let x = 0; x < W; x += 26) for (let y = 0; y < H; y += 26) g.fillRect(x + 1, y + 1, 12, 12);
  g.fillStyle = '#0a0503';
  for (const v of vias) {
    if (v.stitch) continue;
    g.beginPath(); g.arc(v.x * k, v.y * k, (v.pad / 2 + 0.45) * k, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
