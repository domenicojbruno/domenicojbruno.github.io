// Every number here is measured, out of the reports and simulation decks.
// If a value can't be traced back to a sim result, it doesn't belong on the site.

export interface Stat { v: string; k: string }
export interface Block {
  name: string;
  mine: boolean;
  img?: string;          // key into src/assets/schematics
  spec: string;
  note: string;
}
export interface Project {
  slug: string;
  n: string;
  title: string;
  short: string;
  blurb: string;
  where: string;
  when: string;
  role: string;
  team?: string[];
  stack: string[];
  stats: Stat[];
}

export const projects: Project[] = [
  {
    slug: 'clear-exg',
    n: '01',
    title: 'clEAR-ExG',
    short: 'In-Ear EEG/ECG Analog Front-End',
    blurb:
      'A complete biopotential front-end in 180 nm CMOS, small enough to sit in an earbud and quiet enough to pick brain activity out of the noise. Built for continuous seizure monitoring — roughly 2.9 million U.S. adults live with active epilepsy, and the diagnostic hardware is still a hospital appointment rather than something you wear.',
    where: 'WPI · ECE 524 Advanced Analog IC Design',
    when: 'Jan – May 2026',
    role: 'Notch filter · low-pass filter · output buffer · beta-multiplier reference',
    team: ['Matthew Chigos', 'Ryan Martinkat'],
    stack: ['180 nm CMOS', 'Cadence Virtuoso', 'Spectre', 'ADE L / XL'],
    stats: [
      { v: '80 dB', k: 'Total gain' },
      { v: '427 µW', k: 'Total power' },
      { v: '100 dB', k: 'CMRR' },
      { v: '101.3 Hz', k: 'EEG corner' },
      { v: '249.6 Hz', k: 'ECG corner' },
      { v: '2.6–40 nA', k: 'Bias range' },
    ],
  },
  {
    slug: 'miller-ota',
    n: '02',
    title: 'Two-Stage Miller OTA',
    short: 'Amplifier + bandgap reference, schematic to layout',
    blurb:
      'A two-stage Miller-compensated operational transconductance amplifier with its own bandgap reference, startup circuit and power-enable — taken all the way from schematic through layout, DRC, LVS and parasitic extraction, then re-simulated post-layout to prove it still met spec with the parasitics in.',
    where: 'WPI · ECE 4902 CMOS Fundamentals',
    when: 'Sept – Dec 2025',
    role: 'Amplifier sizing, compensation network, bandgap, full physical verification',
    team: ['Chaz Aguiar', 'Jonathon Chang'],
    stack: ['TSMC 180 nm', 'Cadence Virtuoso', 'Calibre DRC/LVS/PEX'],
    stats: [
      { v: '82.55 dB', k: 'Open-loop gain' },
      { v: '60°', k: 'Phase margin' },
      { v: '25 MHz', k: 'Unity-gain freq' },
      { v: '2.1 V', k: 'ICMR' },
      { v: '80 ppm/°C', k: 'Bandgap drift' },
      { v: '0–70 °C', k: 'Verified range' },
    ],
  },
  {
    slug: 'event-camera',
    n: '03',
    title: 'Event-Camera Autofocus',
    short: 'Microsecond focus on targets a frame camera smears',
    blurb:
      'A conventional camera shooting 120 fps sees a hypersonic target as a streak, and its autofocus has nothing sharp to lock onto. An event sensor reports per-pixel brightness changes with microsecond latency instead of whole frames — so focus can be driven off the event rate itself. Seven Python simulations model the sensor, the optics and the control loop, and render the comparison directly.',
    where: 'MIT Lincoln Laboratory · "Intern vs. Sharks" pitch',
    when: 'Summer 2026',
    role: 'DVS sensor model, autofocus control loop, simulation and rendering',
    team: ['Ishan Renjen', 'Peter Kaya Gretchikha'],
    stack: ['Python', 'NumPy', 'Matplotlib', 'DVS / neuromorphic imaging'],
    stats: [
      { v: '7', k: 'Simulations' },
      { v: 'µs', k: 'Event latency' },
      { v: '120 fps', k: 'Frame baseline' },
      { v: '2', k: 'AF methods modelled' },
    ],
  },
];

/** The clEAR-ExG chain, in signal order. `mine` marks the blocks he owned. */
export const chain: Block[] = [
  {
    name: 'Bandgap Reference',
    mine: false,
    spec: '1.247 V · 15.5 µW',
    note: 'Supply- and temperature-independent voltage for everything downstream.',
  },
  {
    name: 'LDO Regulator',
    mine: false,
    spec: '1.8 V · 51.36 µW',
    note: 'Clean rail for the analog blocks, isolated from the battery.',
  },
  {
    name: 'Beta-Multiplier Reference',
    mine: true,
    img: 'filter-bias-schem6',
    spec: '2.6 – 40 nA',
    note: 'Every filter corner on the chip is set by this current. Nanoampere bias is what keeps the OTAs in subthreshold, and subthreshold is what makes a 100 Hz filter possible without an off-chip capacitor.',
  },
  {
    name: 'Chopper CCIA',
    mine: false,
    spec: '100 dB CMRR',
    note: 'Capacitively-coupled instrumentation amp with a DC servo loop and impedance boosting — the first gain stage, where noise matters most.',
  },
  {
    name: '60 Hz Notch',
    mine: true,
    img: 'notch-v2-schem',
    spec: '63.1 Hz · −18.67 dB · 91.2 nW',
    note: 'Fourth-order OTA-C notch on 2.67 nA of bias. Mains hum is orders of magnitude larger than an EEG signal; if it is not removed here it saturates everything after it.',
  },
  {
    name: 'OTA-C Low-Pass',
    mine: true,
    img: 'filter-lpfeeg-schem',
    spec: '101.3 / 249.6 Hz · 37.44 / 93.6 nW',
    note: 'Two parallel biquads — one bandlimited for EEG, one wider for ECG. Corner is gm/C, and gm comes straight from the bias current, so the same topology serves both by changing one number.',
  },
  {
    name: 'Folded Cascode',
    mine: false,
    spec: '87 dB · UGB 8.75 MHz · PM 87.76°',
    note: 'Second gain stage, bringing the chain to 80 dB overall.',
  },
  {
    name: 'Class-AB Buffer',
    mine: true,
    img: 'filter-buffer-schem',
    spec: '19.71 µW',
    note: 'Drives the ADC without loading the filter behind it. Class-AB so it can source and sink current without burning quiescent power waiting to.',
  },
];

/** Honest limitations — stated on the case study, because an analog engineer
 *  will ask, and having the answer ready is worth more than the omission. */
export const clearExgLimits = [
  'Input-referred noise came in at 63.34 nV/√Hz, above the target.',
  'Electrode offset tolerance reached ±15 mV, short of specification.',
  'Bandgap PSRR+ is the weakest link in the supply chain and wants a redesign.',
];

export const smallBuilds = [
  {
    title: 'VGA Pointer Display',
    when: 'Oct 2025',
    tech: 'Verilog · Basys 3',
    note: 'A movable cursor on a 640×480 VGA output. The cursor jittered until I noticed I was clocking the control logic off the 25 MHz pixel tick; splitting out a 1 kHz control domain fixed it. Extra credit: the cursor leaves a persistent trail in a 2-D memory array.',
  },
  {
    title: 'Three-Digit Digital Lock',
    when: 'Apr 2024',
    tech: 'Verilog · Basys 3',
    note: 'FSM-driven combination lock with debounced entry, seven-segment feedback and a latched locked state.',
  },
  {
    title: 'Microwave Oven Controller',
    when: 'Sept 2025',
    tech: 'Verilog · Basys 3',
    note: 'Timer FSM with clock division, debounce and multiplexed seven-segment display.',
  },
  {
    title: '8-Bit Binary to BCD',
    when: 'Sept 2025',
    tech: 'Verilog',
    note: 'Double-dabble shift-and-add-3 converter feeding a multiplexed display.',
  },
  {
    title: 'FSM Calculator',
    when: 'Sept 2025',
    tech: 'Verilog · testbench',
    note: 'Arithmetic unit sequenced by an FSM, verified against a self-checking testbench.',
  },
];
