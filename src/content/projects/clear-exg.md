---
title: clEAR-ExG
slug: clear-exg
order: 1
kind: main
summary: In-Ear EEG/ECG Analog Front-End
blurb: A complete biopotential front-end in 180 nm CMOS, small enough to sit in an earbud and quiet enough to pick brain activity out of the noise. Built for continuous seizure monitoring — roughly 2.9 million U.S. adults live with active epilepsy, and the diagnostic hardware is still a hospital appointment rather than something you wear.
where: WPI · ECE 524 Advanced Analog IC Design
when: Jan – May 2026
role: Notch filter · low-pass filter · output buffer · beta-multiplier reference
team: ["Matthew Chigos", "Ryan Martinkat"]
filter: ["Analog IC"]
stack: ["180 nm CMOS", "Cadence Virtuoso", "Spectre", "ADE L / XL"]
stats: [{"v":"80 dB","k":"Total gain"},{"v":"427 µW","k":"Total power"},{"v":"100 dB","k":"CMRR"},{"v":"101.3 Hz","k":"EEG corner"},{"v":"249.6 Hz","k":"ECG corner"},{"v":"2.6–40 nA","k":"Bias range"}]
cover: /images/schematics/filter-lpfeeg-schem.png
images: [{"src":"/images/schematics/filter-bias-schem6.png","caption":"Beta-Multiplier Reference — 2.6 – 40 nA"},{"src":"/images/schematics/notch-v2-schem.png","caption":"60 Hz Notch — 63.1 Hz · −18.67 dB · 91.2 nW"},{"src":"/images/schematics/filter-lpfeeg-schem.png","caption":"OTA-C Low-Pass — 101.3 / 249.6 Hz · 37.44 / 93.6 nW"},{"src":"/images/schematics/filter-buffer-schem.png","caption":"Class-AB Buffer — 19.71 µW"},{"src":"/images/schematics/notch-v1-schem.png","caption":"Notch filter schematic, v1"},{"src":"/images/schematics/lpf-v2-schem.png","caption":"Low-pass filter schematic, v2"},{"src":"/images/schematics/lpf-v2.png","caption":"Low-pass filter, v2"},{"src":"/images/schematics/lpf-schem.png","caption":"Low-pass filter schematic"},{"src":"/images/schematics/filter-schem.png","caption":"Filter schematic"},{"src":"/images/schematics/filter-bias-schem.png","caption":"Filter bias schematic"},{"src":"/images/schematics/filter-bias-schem2.png","caption":"Filter bias schematic (2)"},{"src":"/images/schematics/filter-bias-schem3.png","caption":"Filter bias schematic (3)"},{"src":"/images/schematics/filter-bias-schem4.png","caption":"Filter bias schematic (4)"},{"src":"/images/schematics/filter-bias-schem7.png","caption":"Filter bias schematic (7)"}]
links: []
---

## The problem

Seizure diagnosis still depends on a clinical EEG: a technician, a cap of wet electrodes and a room. Roughly 2.9 million U.S. adults live with active epilepsy, at about $24 billion in annual healthcare spending, and most of that monitoring happens in short windows that may never overlap with an event.

Moving the electronics into an earbud means the front-end has to survive on a battery you would actually wear. An EEG signal is tens of microvolts; mains hum is millivolts; the electrode-tissue interface drifts. The chain has to reject all of that and still fit in a power budget measured in hundreds of microwatts.

## The chain

Blocks in signal order. ★ marks the blocks I owned.

| Block | Spec | What it does |
|---|---|---|
| Bandgap Reference | 1.247 V · 15.5 µW | Supply- and temperature-independent voltage for everything downstream. |
| LDO Regulator | 1.8 V · 51.36 µW | Clean rail for the analog blocks, isolated from the battery. |
| ★ Beta-Multiplier Reference | 2.6 – 40 nA | Every filter corner on the chip is set by this current. Nanoampere bias is what keeps the OTAs in subthreshold, and subthreshold is what makes a 100 Hz filter possible without an off-chip capacitor. |
| Chopper CCIA | 100 dB CMRR | Capacitively-coupled instrumentation amp with a DC servo loop and impedance boosting — the first gain stage, where noise matters most. |
| ★ 60 Hz Notch | 63.1 Hz · −18.67 dB · 91.2 nW | Fourth-order OTA-C notch on 2.67 nA of bias. Mains hum is orders of magnitude larger than an EEG signal; if it is not removed here it saturates everything after it. |
| ★ OTA-C Low-Pass | 101.3 / 249.6 Hz · 37.44 / 93.6 nW | Two parallel biquads — one bandlimited for EEG, one wider for ECG. Corner is gm/C, and gm comes straight from the bias current, so the same topology serves both by changing one number. |
| Folded Cascode | 87 dB · UGB 8.75 MHz · PM 87.76° | Second gain stage, bringing the chain to 80 dB overall. |
| ★ Class-AB Buffer | 19.71 µW | Drives the ADC without loading the filter behind it. Class-AB so it can source and sink current without burning quiescent power waiting to. |

## Why subthreshold

An OTA-C filter puts its corner at `f₀ = gm / 2πC`. To land at 100 Hz with an on-chip capacitor of a few picofarads, the transconductance has to be tiny — nanosiemens. In strong inversion that is impossible without an absurd capacitor. In subthreshold, `gm = I_D / nV_T`, so a 10 nA bias buys exactly the gm needed, and the power falls out of it: the EEG low-pass runs on **37.44 nW**.

That is the whole reason the beta-multiplier reference matters. It is the block that generates those nanoampere currents stably across process and temperature, and every filter corner on the chip inherits its accuracy.

## What it measured

| Parameter | Result | Block |
|---|---|---|
| Total gain | 80 dB | Full chain |
| CMRR | 100 dB | Chopper CCIA |
| Total power | 427 µW | Full chain |
| Quiescent current | 115.4 µA | Full chain |
| EEG low-pass corner | 101.3 Hz @ 10.4 nA | OTA-C biquad |
| ECG low-pass corner | 249.6 Hz @ 26 nA | OTA-C biquad |
| Notch depth | −18.67 dB @ 63.1 Hz | 4th-order notch |
| Notch power | 91.2 nW @ 2.67 nA | 4th-order notch |
| Bias current range | 2.6 – 40 nA | Beta-multiplier ref |
| Gain stage | 87 dB, PM 87.76°, UGB 8.75 MHz | Folded cascode |

## What it did not do

Three targets were missed, and they are the first things I would attack in a second pass:

- Input-referred noise came in at 63.34 nV/√Hz, above the target.
- Electrode offset tolerance reached ±15 mV, short of specification.
- Bandgap PSRR+ is the weakest link in the supply chain and wants a redesign.

The noise number is the important one. Chopping moves flicker noise out of band but the input devices still have to be sized for it, and I traded area away too early. That is a sizing decision, not a topology problem.
