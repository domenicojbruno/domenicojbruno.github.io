// Navigation nets: one per page. Route, accent colour, silkscreen label and
// ride tuning live here; the copper itself is defined in layout.ts.

import type { NavId, PageId } from './types';

export interface NavNet {
  id: NavId;
  path: string;            // URL
  label: string;           // nav label
  net: string;             // bus name on the silkscreen
  color: string;           // accent / net colour
  ref: string;             // peripheral reference designator
  part: string;            // what the chip is
  title: string;           // <title>
  description: string;     // meta description
  /** Crest-over-IC hills: position along the ride (mm from the MCU pin). */
  hills: { at: number; height: number; width: number }[];
  header: boolean;         // shown in the top bar
}

export const NAV: NavNet[] = [
  {
    id: 'projects', path: '/projects', label: 'Projects', net: 'QSPI_IO[0:3]', color: '#f472d0',
    ref: 'U3', part: 'QSPI FLASH', header: true,
    title: 'Projects', description: 'Analog IC design, FPGA and simulation projects by Domenico J Bruno.',
    hills: [{ at: 13.5, height: 2.6, width: 5 }],
  },
  {
    id: 'experience', path: '/experience', label: 'Experience', net: 'I2C2 / RTC_INT', color: '#fbbf24',
    ref: 'U4', part: 'RTC', header: true,
    title: 'Experience', description: 'Research, industry and teaching experience of Domenico J Bruno.',
    hills: [{ at: 14.5, height: 2.4, width: 5 }],
  },
  {
    id: 'about', path: '/about', label: 'About Me', net: 'I2C1_SDA / SCL', color: '#22d3ee',
    ref: 'U2', part: 'ID EEPROM', header: false,
    title: 'About', description: 'About Domenico J Bruno: analog IC designer at Worcester Polytechnic Institute.',
    hills: [{ at: 16.5, height: 3.2, width: 6 }],
  },
  {
    id: 'extracurriculars', path: '/extracurriculars', label: 'Extracurriculars', net: 'UART_TX / RX', color: '#a3e635',
    ref: 'U5', part: 'RF MODULE', header: false,
    title: 'Extracurriculars', description: 'Clubs, leadership and programs: IEEE SSCS, Dell STEM Aspire, residential life, drum corps.',
    hills: [{ at: 12.5, height: 2.4, width: 5 }],
  },
  {
    id: 'resume', path: '/resume', label: 'Resume', net: 'USB_D+ / D−', color: '#fb923c',
    ref: 'U6', part: 'USB-UART BRIDGE', header: true,
    title: 'Resume', description: 'Resume of Domenico J Bruno — view inline or download the PDF.',
    hills: [{ at: 10.5, height: 2.2, width: 4.5 }],
  },
  {
    id: 'contact', path: '/contact', label: 'Contact', net: 'RMII_TXD / RXD', color: '#a78bfa',
    ref: 'U7', part: 'ETHERNET PHY', header: true,
    title: 'Contact', description: 'Contact Domenico J Bruno: email, LinkedIn and GitHub.',
    hills: [{ at: 15, height: 2.6, width: 5 }],
  },
];

export const navById = (id: NavId): NavNet => NAV.find((n) => n.id === id)!;

export const HOME = {
  title: 'Domenico J Bruno — Analog IC Design',
  description: 'Portfolio of Domenico J Bruno: analog IC design for low-power biopotential sensing. An interactive PCB — every page is a chip on the board.',
};

/** URL pathname -> page (+ project slug). Unknown paths fall back to home. */
export function pageFromPath(pathname: string): { page: PageId; slug?: string; known: boolean } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { page: 'home', known: true };
  // old-site case-study URLs (/work/<slug>) still resolve
  const m = clean.match(/^\/(?:projects|work)\/([^/]+)$/);
  if (m) return { page: 'projects', slug: decodeURIComponent(m[1]), known: true };
  const n = NAV.find((x) => x.path === clean);
  return n ? { page: n.id, known: true } : { page: 'home', known: false };
}

export const pathOf = (page: PageId): string => (page === 'home' ? '/' : navById(page).path);
