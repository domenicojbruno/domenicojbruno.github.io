import { useStore } from '../state/store';

const STEPS: [number, string][] = [
  [0.1, 'Clock init — HSE 8 MHz, PLL locked'],
  [0.35, 'Loading board layout (4-layer, 200 × 150 mm)'],
  [0.55, 'Lighting rig, environment map'],
  [0.9, 'Rasterising soldermask + silkscreen'],
  [1, 'Probing peripherals: EEPROM, FLASH, RTC, RF, USB, PHY'],
];

/** Instant HTML loading state, styled as a serial console, while WebGL boots. */
export function Boot() {
  const boot = useStore((s) => s.boot);
  const ready = useStore((s) => s.sceneReady);
  return (
    <div className={`boot${ready ? ' is-done' : ''}`} role="status" aria-live="polite" aria-hidden={ready}>
      <div className="boot__box">
        <p className="boot__line boot__line--head">Booting DJB-MAINBOARD REV A…</p>
        {STEPS.map(([at, text]) => (
          <p key={text} className={`boot__line${boot >= at ? ' is-ok' : ''}`}>
            <span className="boot__tag">{boot >= at ? '[ OK ]' : '[ .. ]'}</span> {text}
          </p>
        ))}
        <div className="boot__bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0.04, boot)})` }} /></div>
      </div>
    </div>
  );
}
