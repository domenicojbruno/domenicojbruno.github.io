// Placeholder content -- swap in real copy before shipping.

export interface ProjectCard {
  title: string;
  blurb: string;
  tags: string[];
}

export interface ExperienceEntry {
  role: string;
  org: string;
  period: string;
  bullets: string[];
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface ContactLink {
  label: string;
  href: string;
}

export const PROJECTS: ProjectCard[] = [
  {
    title: "4-Layer PCB Power Supply",
    blurb: "Switching regulator board with synchronous buck conversion, designed and routed from schematic to fabrication.",
    tags: ["KiCad", "Power Electronics", "PCB Layout"],
  },
  {
    title: "ESP32 IoT Sensor Node",
    blurb: "Battery-powered environmental sensor with low-power sleep modes and an MQTT telemetry pipeline.",
    tags: ["Embedded C", "ESP32", "MQTT"],
  },
  {
    title: "FPGA Digital Filter",
    blurb: "Real-time FIR filter implemented on an FPGA, verified against a MATLAB reference model.",
    tags: ["Verilog", "FPGA", "DSP"],
  },
  {
    title: "Autonomous Rover Power System",
    blurb: "Capstone project: battery management and motor driver design for a small autonomous ground vehicle.",
    tags: ["Capstone", "BMS", "Motor Control"],
  },
];

export const EXPERIENCE: ExperienceEntry[] = [
  {
    role: "Electrical Engineering Intern",
    org: "Placeholder Co.",
    period: "Summer 2025",
    bullets: [
      "Designed and tested analog front-end circuitry for a sensor product line.",
      "Built automated test fixtures that cut manual bring-up time significantly.",
    ],
  },
  {
    role: "Undergraduate Research Assistant",
    org: "University Lab",
    period: "2024 -- 2025",
    bullets: [
      "Prototyped embedded firmware for a lab instrumentation project.",
      "Documented and presented findings at a department research showcase.",
    ],
  },
];

export const ABOUT_BIO =
  "Electrical engineering student focused on embedded systems, power electronics, and PCB design. This bio is placeholder text -- swap in the real version.";

export const SKILLS: SkillGroup[] = [
  { category: "Hardware", items: ["PCB Design", "Analog Circuits", "Power Electronics"] },
  { category: "Firmware", items: ["C / C++", "Embedded Linux", "RTOS"] },
  { category: "Tools", items: ["KiCad", "LTspice", "Git"] },
];

export const CONTACT_LINKS: ContactLink[] = [
  { label: "Email", href: "mailto:your.email@example.com" },
  { label: "GitHub", href: "https://github.com/your-username" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/your-username" },
];
