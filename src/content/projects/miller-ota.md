---
title: Two-Stage Miller OTA
slug: miller-ota
order: 2
kind: main
summary: Amplifier + bandgap reference, schematic to layout
blurb: A two-stage Miller-compensated operational transconductance amplifier with its own bandgap reference, startup circuit and power-enable — taken all the way from schematic through layout, DRC, LVS and parasitic extraction, then re-simulated post-layout to prove it still met spec with the parasitics in.
where: WPI · ECE 4902 CMOS Fundamentals
when: Sept – Dec 2025
role: Amplifier sizing, compensation network, bandgap, full physical verification
team: ["Chaz Aguiar", "Jonathon Chang"]
filter: ["Analog IC"]
stack: ["TSMC 180 nm", "Cadence Virtuoso", "Calibre DRC/LVS/PEX"]
stats: [{"v":"82.55 dB","k":"Open-loop gain"},{"v":"60°","k":"Phase margin"},{"v":"25 MHz","k":"Unity-gain freq"},{"v":"2.1 V","k":"ICMR"},{"v":"80 ppm/°C","k":"Bandgap drift"},{"v":"0–70 °C","k":"Verified range"}]
images: []
links: []
---

## The build

A textbook two-stage OTA is easy to draw and unforgiving to close. The first stage is a differential pair with an active load; the second is a common-source driver. Cascading them buys gain and costs you a second pole, which is where the compensation network earns its keep.

Miller compensation splits the poles by wrapping `Cc` around the second stage — but the same capacitor creates a right-half-plane zero that drags phase down exactly where you need margin. A zero-nulling resistor in series with `Cc` pushes that zero out of the way. That pairing is what takes the amplifier from unstable to 60° of phase margin without giving back bandwidth.

## Device sizing

| Device | W / L | Role |
|---|---|---|
| M1, M2 | 120 µm / 20 µm | Input differential pair |
| M3, M4 | 300 nm / 300 nm | Active load |
| M5 | 6.5 µm / 1 µm | Tail current source |
| M6 | 43.25 µm / 1 µm | Second-stage driver |
| M7 | 93 µm / 2 µm | Second-stage load |

`Cc = 1 fF · CL = 10 pF · Vbias = 947.049 mV`

## Target vs. measured

| Parameter | Target | Achieved | |
|---|---|---|---|
| Open-loop gain | ≥ 75 dB | 82.55 dB | ✓ |
| Phase margin | ≥ 60° | 60° | ✓ |
| Unity-gain frequency | ≥ 25 MHz | 25 MHz | ✓ |
| ICMR | ≥ 2 V | 2.1 V | ✓ |
| Bandgap output | 1.00 V | 1.00 V | ✓ |
| Temperature coefficient | < 100 ppm/°C | 80 ppm/°C | ✓ |
| Power | < 1.5 mW | within budget | ✓ |
| Supply range | 3.0 – 3.6 V | verified | ✓ |

Verified at 0 °C, 25 °C and 70 °C across the supply range. The bandgap includes a startup circuit — without one the reference has a perfectly stable second operating point at zero, and it will happily sit there forever.

## Layout and physical verification

This is the project where the design stopped being a schematic. The full flow in Calibre — DRC for the foundry rules, LVS to prove the layout is the circuit I drew, PEX to pull out the parasitics — then back into ADE L to re-simulate against the extracted netlist.

Post-layout is where optimistic schematics go to die: routing capacitance loads the compensation node and eats phase margin. Getting the amplifier to hold spec with the parasitics in was the actual work, and it is why I now draw the compensation network before I draw anything else.
