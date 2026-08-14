// Single source of truth for identity + section order. Nav, <head>, and the
// page all read from here so they can't drift apart.

export const me = {
  name: 'Domenico Bruno',
  first: 'Domenico',
  last: 'Bruno',
  role: 'Analog IC Design',
  tagline: 'Analog IC design for low-power biopotential sensing.',
  email: 'djbruno@wpi.edu',
  phone: '+1 781-960-7292',
  location: 'Boston, MA',
  school: 'Worcester Polytechnic Institute',
  degree: 'BS/MS Electrical & Computer Engineering',
  grad: 'December 2027',
  gpa: '3.66 / 4.0',
  resume: '/domenico-bruno-resume.pdf',
  // TODO(polish): neither of these appears anywhere in his files — confirm
  // before launch. Nav hides any link left null.
  github: null as string | null,
  linkedin: null as string | null,
};

export type SectionId =
  | 'bias' | 'operating' | 'chain' | 'playground'
  | 'corners' | 'transient' | 'bench' | 'noise';

export const sections: { id: SectionId; n: string; label: string }[] = [
  { id: 'bias', n: '01', label: 'Bias Point' },
  { id: 'operating', n: '02', label: 'Operating Point' },
  { id: 'chain', n: '03', label: 'Signal Chain' },
  { id: 'playground', n: '04', label: 'Playground' },
  { id: 'corners', n: '05', label: 'Process Corners' },
  { id: 'transient', n: '06', label: 'Transient Response' },
  { id: 'bench', n: '07', label: 'Off the Bench' },
  { id: 'noise', n: '08', label: 'Noise Floor' },
];

export const ticker = [
  'Subthreshold OTA',
  'OTA-C Filters',
  '180 nm CMOS',
  'Bandgap References',
  'Chopper CCIA',
  'Calibre DRC/LVS/PEX',
  'Cadence Virtuoso',
  'PVT & Noise Analysis',
];
