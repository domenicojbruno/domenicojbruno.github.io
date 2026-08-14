# domenicobruno.dev — portfolio

Astro static site. No React, no CSS framework, no animation library — total
runtime JavaScript is about **7 KB** across the whole site, hand-written.

```bash
npm install
npm run dev        # http://localhost:4321
npm run check      # typecheck + filter-math self-check
npm run build      # -> dist/
```

## Structure

The site is a signal chain: eight sections, each a stage in an analog front-end,
each with its own accent colour set by one CSS custom property.

| # | Section | id | What it is |
|---|---------|-----|-----------|
| 01 | Bias Point | `bias` | Hero, scope trace, ticker |
| 02 | Operating Point | `operating` | About |
| 03 | Signal Chain | `chain` | Work index → three case studies |
| 04 | Playground | `playground` | Live OTA-C filter simulator |
| 05 | Process Corners | `corners` | Skills + coursework |
| 06 | Transient Response | `transient` | Timeline |
| 07 | Off the Bench | `bench` | Personal — the one light-theme section |
| 08 | Noise Floor | `noise` | Contact |

```
src/
  lib/site.ts          identity + section order (nav and <head> read from here)
  lib/projects.ts      every measured number on the site, in one place
  lib/filter-math.ts   OTA-C response + digital biquads + self-check
  lib/canvas.ts        DPR sizing, offscreen pause, reduced-motion, shared
  lib/reveal.ts        entrance animations + rail highlighting (2 observers)
  components/          one per section, plus FilterSim and SignalChain
  pages/work/*.astro   the three case studies
scripts/prep-assets.mjs  one-off asset pipeline (see below)
```

## Editing content

Almost nothing is hardcoded in markup:

- **Contact details, section names** → `src/lib/site.ts`
- **Project numbers, the clEAR-ExG block list, smaller builds** → `src/lib/projects.ts`
- **Skills and coursework** → `src/components/Skills.astro`
- **Timeline entries** → `src/components/Timeline.astro`

## Assets

`npm run assets` rebuilds everything web-facing from the raw folders
(`../Images`, `../Side Hobbies`, `../Pets and Family`, and the event-camera
directory). It strips EXIF — including GPS — from every photo by construction,
normalises the Cadence screenshot filenames, transcodes the event-camera GIFs to
animated WebP (22.6 MB → ~1 MB in the worst case), and draws the `og.png` link
card. Slow to run; it is a one-off, not part of `build`.

Deliberately **not** published: the ECE 524 exemplar paper by other authors, the
WPI-RAU union agreement, the Xilinx `wave_gen` vendor reference design, and the
third-party figures pulled from papers in the event-camera folder.

## Before launch

- [x] LinkedIn → `src/lib/site.ts`. No GitHub account exists, so there is no
      GitHub link anywhere; add one to `site.ts` and `Contact.astro` if that changes.
- [ ] Headshot → save it as `headshot.jpg` in the raw `Portfolio Website` folder,
      then `npm run assets` picks it up automatically. Wire into `About.astro`.
- [ ] Real domain → `site` in `astro.config.mjs` (drives canonical + `og:image`)
- [ ] CO₂ sensor project — on the CV, no supporting material exists yet
- [x] Dates reconciled against LinkedIn. Corrections applied: the internship ran
      **May – Aug 2026** (CV said "Summer 2026") in **Westford** at the Lincoln
      Space Surveillance Complex, not Lexington. Location is Medford, not Boston.
      The CV is wrong on both counts and should be fixed.
- [ ] Two roles on the CV are missing from LinkedIn — the ECE 2201 TA position and
      the ICS Lab research assistantship. The site lists both; add them to LinkedIn.
- [ ] Confirm the Miller OTA figures. The CV says "Sept 2025, 54 dB"; the ECE 4902
      files say Dec 2025, 82.55 dB. The site currently uses the ECE 4902 numbers.
      If these are two different amplifiers, the second one needs its own entry.
- [ ] Miller OTA case study has no images — the schematics are trapped in the
      PDF/PPTX. Export a few and drop them in.

## Verification

- `npm run check:math` — asserts the published 101.3 Hz EEG corner actually falls
  out of the published 10.4 nA bias current through the subthreshold model, that
  the responses have the right shape, and that the notch really removes hum from
  the demo trace. If the simulator is ever silently wrong, this is what catches it.
- `npm run build && npx serve dist` — then Lighthouse against the built output.
- Toggle "reduce motion" in the OS and reload: every canvas should freeze on one
  static frame and no ambient animation should run.
