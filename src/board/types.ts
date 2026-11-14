// Shared board types. All dimensions are millimetres in board coordinates:
// x grows to the right, y grows downward (same as KiCad / SVG), origin at the
// top-left corner of the board outline.

export type PageId =
  | 'home' | 'about' | 'projects' | 'experience'
  | 'extracurriculars' | 'resume' | 'contact';
export type NavId = Exclude<PageId, 'home'>;

export type Layer = 'top' | 'inner' | 'bottom';

export interface Pt { x: number; y: number }

export type Mat = 'plastic' | 'metal' | 'gold' | 'ceramic' | 'led';

/** One primitive of a component body, in the footprint's local frame. */
export interface Part {
  shape: 'box' | 'cyl';
  x: number; y: number;     // centre, local mm
  z: number;                // base height above the board
  sx: number; sy: number;   // footprint size (box) or diameter (cyl: sx)
  sz: number;               // height
  mat: Mat;
  color: string;
}

export interface PadDef {
  n: number;                // pin number, 1-based
  x: number; y: number;
  w: number; h: number;
  round?: boolean;          // through-hole / test point
  hole?: number;            // drill diameter for through-hole pads
}

export interface Footprint {
  id: string;
  prefix: string;           // reference designator prefix (U, C, R, …)
  w: number; h: number;     // courtyard / body size in local x, y
  height: number;           // tallest point, mm
  parts: Part[];
  pads: PadDef[];
  silk: 'outline' | 'none';
  marking: boolean;         // gets a laser-etched top marking
}

export interface Component {
  ref: string;
  type: string;
  x: number; y: number;
  rotation: number;         // degrees, clockwise on screen
  layer: 'top';
  label?: string[];         // package marking lines
  pageId?: NavId | 'home';  // navigation peripheral for this page
  projectSlug?: string;     // project sub-chip
  silk?: { x: number; y: number; rot: number; size: number } | false;
}

export interface Trace {
  net: string;
  layer: Layer;
  width: number;
  points: Pt[];
  nav?: NavId;              // belongs to a navigation bus
  lead?: boolean;           // the member the camera rides
  kind?: 'signal' | 'power' | 'antenna';
}

export interface Via {
  x: number; y: number;
  fromLayer: Layer; toLayer: Layer;
  pad: number; drill: number;
  net?: string;
  nav?: NavId;
  lead?: boolean;
  stitch?: boolean;
}

export interface SilkText {
  x: number; y: number; text: string; size: number; rot?: number;
  anchor?: 'start' | 'middle' | 'end'; bold?: boolean;
}

export interface Zone { x: number; y: number; w: number; h: number; label?: string }

/** A ride waypoint: board position plus which layer the copper is on. */
export interface RoutePt extends Pt { layer: Layer; via?: boolean }

export interface NavBus {
  id: NavId;
  lead: RoutePt[];          // ordered MCU pin -> peripheral pin
  mcuPin: number;
  pinName: string;
  target: string;           // peripheral reference designator
  members: { net: string; pinName: string; mcuPin: number }[];
}
