---
title: Event-Camera Autofocus
slug: event-camera
order: 3
kind: main
summary: Microsecond focus on targets a frame camera smears
blurb: A conventional camera shooting 120 fps sees a hypersonic target as a streak, and its autofocus has nothing sharp to lock onto. An event sensor reports per-pixel brightness changes with microsecond latency instead of whole frames — so focus can be driven off the event rate itself. Seven Python simulations model the sensor, the optics and the control loop, and render the comparison directly.
where: MIT Lincoln Laboratory · "Intern vs. Sharks" pitch
when: Summer 2026
role: DVS sensor model, autofocus control loop, simulation and rendering
team: ["Ishan Renjen", "Peter Kaya Gretchikha"]
filter: ["Simulation"]
stack: ["Python", "NumPy", "Matplotlib", "DVS / neuromorphic imaging"]
stats: [{"v":"7","k":"Simulations"},{"v":"µs","k":"Event latency"},{"v":"120 fps","k":"Frame baseline"},{"v":"2","k":"AF methods modelled"}]
cover: /images/event-camera/missile-autofocus.webp
images: [{"src":"/images/event-camera/missile-framecamera.webp","caption":"120 fps frame camera. Motion blur across every exposure. Contrast-detect autofocus has nothing to lock onto.","alt":"Simulated 120 fps frame camera view of a fast-moving target, motion-blurred across each exposure"},{"src":"/images/event-camera/missile-autofocus.webp","caption":"Event sensor. ON/OFF polarity events, defocused at first, then a focus snap and a tracking lock — driven by event rate.","alt":"Simulated event-camera view of the same target, showing ON and OFF polarity events and a focus lock"},{"src":"/images/event-camera/missile-dualpixel.webp","caption":"Dual-pixel phase detect. The aperture is split in half and each half imaged separately. Blue and red diverge when the image is out of focus and fuse to purple at zero disparity — the same trick a modern camera uses, running on events instead of frames."},{"src":"/images/event-camera/artemis-reentry.webp","caption":"Thermal reentry. An Orion-class capsule on a reentry pass, viewed as thermal events. Extreme dynamic range is where event sensors are least replaceable: nothing in the scene clips, because nothing is integrated over an exposure."},{"src":"/images/event-camera/crowd-monitor.webp","caption":"Crowd monitoring. Only motion produces events, so no face is ever reconstructed — the sensor is privacy-preserving by construction rather than by policy. Region-of-interest focus lock plus a density heatmap."},{"src":"/images/event-camera/event-sim-helix.webp","caption":"What an event stream is. The explainer: a rotating scene unrolled into the x–y–t volume, where each point is one pixel reporting one brightness change. There are no frames anywhere in this representation."}]
links: []
---

## Frames are the wrong primitive

A conventional sensor integrates light over an exposure and hands you a whole frame. For anything fast, that exposure is a smear — and autofocus, which works by hunting for maximum contrast, has nothing sharp to hunt for. Raise the frame rate and you buy shorter exposures at the cost of light, bandwidth and power, all at once.

A dynamic-vision sensor throws the frame away. Each pixel fires independently the moment its log-brightness changes by a threshold, with microsecond latency and no global clock. What comes out is a sparse stream of events — and crucially, the *rate* of that stream is itself a focus signal. Sharp edges generate dense events; a blurred image generates few. You can close the focus loop on the data the sensor is already producing.

## How it was built

Seven Python simulations, each self-contained: a scene generator, a DVS pixel model that thresholds log-intensity change per pixel per timestep, an optical model that applies a defocus kernel, and a controller that walks the focus position to maximise event rate. Each script renders its own animation so the comparison is the output, not a plot of the output.

Presented at Lincoln Laboratory's "Intern vs. Sharks" pitch competition in summer 2026, with Ishan Renjen and Peter Kaya Gretchikha.
