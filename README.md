# domenicojbruno.github.io

Personal engineering portfolio, presented as one interactive printed circuit
board. The home page is the MCU; every other page is a peripheral chip on the
same board, and navigating is a first-person ride along the copper trace that
connects them.

Vite + React 18 + TypeScript, Three.js via React Three Fiber, GSAP, Zustand,
React Router. Static build, no backend, no tracking, no external requests.

```bash
npm install
npm run dev            # http://localhost:5173
npm run check:layout   # design-rule check for the board
npm run build          # typecheck + production build -> dist/
npm run og             # regenerate public/og.png from the board layout
```

## Deploy

Pushing to `main` builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`). In the repo settings, Pages source must be
**GitHub Actions**. This is a user site served from the domain root, so `base`
in `vite.config.ts` is `/`; for a project site set it to `/<repo>/`.
`public/404.html` is the SPA fallback that makes deep links such as `/resume`
work on Pages.

## Editing content

Nothing about me is hardcoded in components.

| What | Where |
|---|---|
| Name, intro, contacts, education, skills, coursework, photos | `src/content/profile.json` |
| About text | `src/content/about.md` |
| Work experience | `src/content/experience.json` |
| Extracurriculars | `src/content/extracurriculars.json` |
| Projects | `src/content/projects/*.md` (frontmatter + Markdown body) |
| Resume PDF | `public/resume.pdf` |
| Images | `public/images/...` |

Project frontmatter: `title`, `slug`, `order`, `kind` (`main` or `small`),
`summary`, `blurb`, `where`, `when`, `role`, and JSON arrays for `team`,
`filter` (the filter chips), `stack` (tech tags), `stats`, `images`
(`{src, caption, alt}`), `links` (`{label, href}`), plus an optional `cover`.
A new project also wants a chip on the board: add a `subchip(...)` line in
`src/board/layout.ts` with the same slug.

## Editing the board

`src/board/layout.ts` is the PCB, in millimetres (x right, y down, 200 x 150 mm).
Rendering code only reads its exported `components`, `traces` and `vias`.

- **Move a part:** change `x, y, rotation` in its `add(type, x, y, rot, {...})` call.
  Footprints live in `src/board/footprints.ts`.
- **Reroute a page bus:** each one is a `Path` of compass moves, e.g.
  `new Path(pin('U1', 6)).toX('W', 80).toX('NW', 70).toX('W', 64).via()...land(pin('U2', 6), 'W')`.
  Compass moves keep every bend at 45 degrees. `.via()` drops to the inner layer
  (and becomes a plunge on the ride). `bus({...})` makes the parallel members
  and staggers their vias; `flank(...)` places rows of passives beside a segment.
- **Ride tuning** (hills, colours, labels): `src/board/nets.ts`. The camera
  spline, speed profile, banking and drops are generated from the trace in
  `src/board/routes.ts`, so a rerouted trace gets a matching ride for free.
- Always run `npm run check:layout` afterwards. It fails on non-45-degree
  bends, same-layer crossings, traces through parts, overlapping courtyards and
  vias under components.

## Structure

```
src/
  content/           profile.json, about.md, experience.json, extracurriculars.json, projects/*.md
  board/
    layout.ts        the PCB definition
    footprints.ts    procedural package templates (no CAD models)
    geom.ts          45-degree path builder, bus offsets, serpentines, DRC geometry
    nets.ts          navigation nets: route, colour, label, ride tuning
    routes.ts        ride splines + speed profiles from the traces
    svg.ts           top-down SVG renderer (2D mode, 3D board texture, OG image)
    view.ts          camera framing shared by 3D, labels and CSS
  scene/             Scene, Board, Traces (pulse shader), CurrentPulse, CameraRig, Effects
  ui/                Header, NavLabels, DatasheetPanel, Board2D, Boot, pages/*
  state/store.ts     page / ride state machine
  audio/sound.ts     synthesised ride sound (muted by default)
scripts/             check-layout.ts, make-og.ts
```

## Behaviour notes

- Clicking a label or header link plays the ride; the URL updates on arrival.
  Back/forward plays the matching ride. Direct loads land on the page, no ride.
- `prefers-reduced-motion` swaps the ride for a gentle top-down glide.
- Below 768 px wide, or without WebGL, the site renders the same board as SVG
  and never downloads three.js (`?flat` forces this mode for testing).
- The canvas renders on demand: nothing is drawn while a content page is open.
- Sound is off until the speaker button in the header is pressed.

## Not published on purpose

Family photos, the ECE 524 exemplar paper by other authors, the WPI-RAU union
agreement, vendor reference designs and third-party paper figures stay in the
raw folders outside this repo.
