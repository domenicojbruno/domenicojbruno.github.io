---
title: VGA Pointer Display
slug: vga-pointer
order: 5
kind: small
summary: A movable cursor on a 640×480 VGA output.
blurb: A movable cursor on a 640×480 VGA output. The cursor jittered until I noticed I was clocking the control logic off the 25 MHz pixel tick; splitting out a 1 kHz control domain fixed it. Extra credit: the cursor leaves a persistent trail in a 2-D memory array.
where: WPI
when: Oct 2025
role:
team: []
filter: ["FPGA"]
stack: ["Verilog","Basys 3"]
stats: []
images: []
links: []
---

A movable cursor on a 640×480 VGA output. The cursor jittered until I noticed I was clocking the control logic off the 25 MHz pixel tick; splitting out a 1 kHz control domain fixed it. Extra credit: the cursor leaves a persistent trail in a 2-D memory array.
