// Typed access to everything in src/content. Pages import from here only.

import { marked } from 'marked';
import profileJson from './profile.json';
import experienceJson from './experience.json';
import extracurricularsJson from './extracurriculars.json';
import aboutMd from './about.md?raw';

export const profile = profileJson;

export interface Role {
  title: string; org: string; place: string; when: string; kind: string;
  note?: string; bullets: string[];
}
export const experience = experienceJson as Role[];
export const extracurriculars = extracurricularsJson as Role[];

export interface ProjectImage { src: string; caption?: string; alt?: string }
export interface Project {
  title: string; slug: string; order: number; kind: 'main' | 'small';
  summary: string; blurb: string; where: string; when: string; role: string;
  team: string[]; filter: string[]; stack: string[];
  stats: { v: string; k: string }[];
  cover?: string; images: ProjectImage[];
  links: { label: string; href: string }[];
  html: string;
}

marked.setOptions({ gfm: true });
export const md = (src: string): string => marked.parse(src, { async: false }) as string;

/** Minimal frontmatter: `key: value` lines; JSON for arrays and objects. */
function parseProject(raw: string): Project {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('Project file is missing frontmatter');
  const data: Record<string, unknown> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    data[key] = /^[[{]/.test(val) ? JSON.parse(val) : /^\d+$/.test(val) ? Number(val) : val;
  }
  return { ...(data as unknown as Project), html: md(m[2]) };
}

const files = import.meta.glob('./projects/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const projects: Project[] = Object.values(files).map(parseProject).sort((a, b) => a.order - b.order);
export const projectBySlug = (slug?: string) => projects.find((p) => p.slug === slug);
export const projectFilters = [...new Set(projects.flatMap((p) => p.filter))];

export const aboutHtml = md(aboutMd);
