#!/usr/bin/env node
// Requirement check for skill-write. Zero dependencies.
//
// Looks for each skill skill-write depends on in every place Claude Code loads skills from,
// and prints what is missing with the command that installs it.
//
// Usage:
//   check-deps.mjs [--project <dir>] [--home <dir>]
//
//   --project  project root whose .claude/skills to search (default: cwd)
//   --home     home directory to search (default: os.homedir(); for tests)
//
// Output: JSON on stdout. Exit 0 when every required skill is found, 1 when one is missing,
// 2 on a usage error.

import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PROMPTS = 'https://github.com/cameronolivier/prompts/tree/main/skills';

export const REQUIRED = [
  { name: 'skill-review', role: 'reviews the skill (Step 4)', install: `npx -y skills add ${PROMPTS}/skill-review` },
  { name: 'voice-rules', role: 'agent-text rules for compression (Step 3)', install: `npx -y skills add ${PROMPTS}/voice-rules` },
  { name: 'skill-conventions', role: 'house rules for drafting and fixing', install: `/plugin install mo-ai-labs@mohara, or npx -y skills add ${PROMPTS}/skill-conventions` },
];

// Any one of these covers drafting a new skill. Improve mode needs none.
export const OPTIONAL = [
  { name: 'skill-creator', role: 'drafting interview and full eval benchmarks', install: '/plugin install skill-creator@claude-plugins-official' },
  { name: 'write-a-skill', role: 'drafting interview', install: 'npx -y skills add mattpocock/skills' },
];

const hasSkill = (dir) => existsSync(join(dir, 'SKILL.md')) || existsSync(join(dir, 'skill.md'));
const subdirs = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => join(dir, e.name));
  } catch {
    return [];
  }
};

// Flat skill roots, then plugin skill roots: cache/<marketplace>/<plugin>/<version>/skills.
// skillDir's parent holds sibling skills from the same repo or plugin.
export function skillRoots({ project, home, skillDir = SKILL_DIR }) {
  const roots = [dirname(skillDir), join(project, '.claude', 'skills'), join(home, '.claude', 'skills'), join(home, '.agents', 'skills')];
  for (const marketplace of subdirs(join(home, '.claude', 'plugins', 'cache'))) {
    for (const plugin of subdirs(marketplace)) {
      for (const version of subdirs(plugin)) roots.push(join(version, 'skills'));
    }
  }
  return roots;
}

export function findSkill(name, roots) {
  for (const root of roots) {
    const dir = join(root, name);
    if (hasSkill(dir)) return dir;
  }
  return null;
}

export function check(opts) {
  const roots = skillRoots(opts);
  const look = (dep) => ({ ...dep, path: findSkill(dep.name, roots) });
  const required = REQUIRED.map(look);
  const optional = OPTIONAL.map(look);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const missing = required.filter((d) => !d.path).map(({ name, role, install }) => ({ name, role, install }));
  if (nodeMajor < 18) missing.push({ name: 'node', role: 'runs the bundled scripts', install: 'install Node 18 or later' });
  return {
    ok: missing.length === 0,
    node: process.versions.node,
    required,
    optional,
    drafting: optional.some((d) => d.path),
    missing,
  };
}

function parseArgs(argv) {
  const opts = { project: process.cwd(), home: homedir() };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if ((flag === '--project' || flag === '--home') && argv[i + 1]) opts[flag.slice(2)] = resolve(argv[++i]);
    else return null;
  }
  return opts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    console.error('usage: check-deps.mjs [--project <dir>] [--home <dir>]');
    process.exit(2);
  }
  const result = check(opts);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
