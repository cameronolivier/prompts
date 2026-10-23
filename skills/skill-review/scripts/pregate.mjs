#!/usr/bin/env node
// Deterministic pre-gate for skill-review. Zero dependencies.
//
// Finds the skills a change touches and runs every check a script can decide.
// Reviewers get its JSON and judge only what is left.
//
// Usage:
//   pregate.mjs --root <tree> [--changed <file>] [<skill-dir>...]
//
//   --root     tree to review (a PR-head worktree, or the repo for a local review)
//   --changed  file of changed paths (one per line, relative to --root); picks the skills
//   <skill-dir> review these skill folders directly (relative to --root)
//
// Output: JSON on stdout. Exit 0 always unless usage error (2); findings live in the JSON.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

// Claude Code frontmatter fields + Agent Skills spec fields.
const KNOWN_FIELDS = new Set([
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation',
  'user-invocable', 'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent',
  'background', 'hooks', 'paths', 'shell', 'license', 'compatibility', 'metadata',
]);
const MODELS = /^(haiku|sonnet|opus|fable|inherit|default|claude-[a-z0-9.-]+)(\[1m\])?$/;
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKILL_FILES = ['SKILL.md', 'skill.md'];

// --- frontmatter -------------------------------------------------------------

// Small YAML subset: scalars, quoted strings, `- item` lists, `>`/`|` block scalars, inline [a, b].
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { error: 'no frontmatter: file must start with ---', data: null, bodyStart: 0 };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { error: 'frontmatter never closes (no second ---)', data: null, bodyStart: 0 };

  const data = {};
  const lineOf = {};
  let key = null;
  let block = null;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (block) {
      if (/^\s+\S/.test(line) || line.trim() === '') { block.push(line.trim()); continue; }
      data[key] = block.join(block.style === '|' ? '\n' : ' ').trim();
      block = null;
    }
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) {
      if (/^\s+\S/.test(line) && key) continue; // nested map (hooks, metadata)
      return { error: `line ${i + 1}: cannot parse "${line}"`, data: null, bodyStart: end + 1 };
    }
    key = kv[1];
    lineOf[key] = i + 1;
    const value = kv[2];
    if (value === '>' || value === '|' || /^[>|][-+]?$/.test(value)) {
      block = [];
      block.style = value[0];
      data[key] = '';
    } else if (/^\[.*\]$/.test(value)) {
      data[key] = value.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else {
      data[key] = unquote(value);
    }
  }
  if (block) data[key] = block.join(block.style === '|' ? '\n' : ' ').trim();
  return { error: null, data, lineOf, bodyStart: end + 1 };
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

const toList = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/[\s,]+(?![^(]*\))/) : []);

// --- skill discovery ---------------------------------------------------------

function skillFileIn(dir) {
  for (const f of SKILL_FILES) {
    if (existsSync(join(dir, f)) && readdirSync(dir).includes(f)) return f;
  }
  return null;
}

export function findSkills(root, changed) {
  const skills = new Set();
  const skipped = [];
  for (const path of changed) {
    let dir = dirname(path);
    let found = null;
    while (dir && dir !== '.' && dir !== '/') {
      if (skillFileIn(join(root, dir))) { found = dir; break; }
      dir = dirname(dir);
    }
    if (found) { skills.add(found); continue; }
    if (SKILL_FILES.includes(basename(path))) { skipped.push({ path, reason: 'skill deleted in this change' }); continue; }
    if (/(^|\/)commands\/[^/]+\.md$/.test(path)) skipped.push({ path, reason: 'command: out of scope in v1' });
    else if (/(^|\/)agents\/[^/]+\.md$/.test(path)) skipped.push({ path, reason: 'agent: out of scope in v1' });
  }
  return { skills: [...skills].sort(), skipped };
}

// --- checks ------------------------------------------------------------------

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim(), missing: r.error?.code === 'ENOENT' };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export function voiceLintPath() {
  const candidates = [
    process.env.VOICE_LINT,
    join(SKILL_DIR, '..', 'voice-rules', 'scripts', 'voice-lint.mjs'),
    join(process.env.HOME || '', '.claude', 'skills', 'voice-rules', 'scripts', 'voice-lint.mjs'),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

export function checkSkill(root, dir, { voiceLint = voiceLintPath() } = {}) {
  const abs = join(root, dir);
  const file = skillFileIn(abs);
  const rel = (p) => relative(root, p);
  const skillPath = join(dir, file);
  const findings = [];
  const add = (check, severity, path, line, message, cites) => findings.push({ check, severity, file: path, line, message, cites });

  if (file === 'skill.md') {
    add('skill-file-case', 'should', skillPath, 1, 'Rename skill.md to SKILL.md. Claude Code and the Agent Skills spec look for SKILL.md.', 'BP-S1');
  }

  const text = readFileSync(join(abs, file), 'utf8');
  const lines = text.split(/\r?\n/);
  const fm = parseFrontmatter(text);
  const data = fm.data || {};
  const at = (k) => fm.lineOf?.[k] || 1;

  if (fm.error) add('frontmatter', 'must', skillPath, 1, `Frontmatter does not parse: ${fm.error}.`, 'BP-A1');
  else {
    // name
    const folder = basename(dir);
    if (!data.name) add('name', 'must', skillPath, 1, `No name. Claude Code falls back to the folder name "${folder}"; the spec and npx skills require it.`, 'BP-S2');
    else {
      if (!NAME_RE.test(data.name) || data.name.length > 64) {
        add('name', 'must', skillPath, at('name'), `name "${data.name}" must be 1-64 chars of a-z, 0-9 and single hyphens.`, 'BP-S3');
      }
      if (data.name !== folder) add('name', 'must', skillPath, at('name'), `name "${data.name}" differs from folder "${folder}".`, 'BP-S4');
      if (/anthropic|claude|<[^>]+>/i.test(data.name)) add('name', 'must', skillPath, at('name'), `name "${data.name}" uses a reserved word or an XML tag.`, 'BP-A3');
    }
    if (/^synced$/i.test(folder) || /^anthropic-skills/i.test(folder)) add('name', 'must', skillPath, 1, `Folder name "${folder}" is reserved.`, 'BP-A3');

    // description
    const desc = typeof data.description === 'string' ? data.description : '';
    if (!desc) add('description', 'must', skillPath, 1, 'No description. Claude picks skills by description, so the skill will not trigger.', 'BP-A5');
    else {
      if (desc.length > 1024) add('description', 'must', skillPath, at('description'), `description is ${desc.length} chars; the spec limit is 1024.`, 'BP-S5');
      const listing = desc.length + (typeof data.when_to_use === 'string' ? data.when_to_use.length : 0);
      if (listing > 1536) add('description', 'must', skillPath, at('description'), `description + when_to_use is ${listing} chars; the skill listing cuts it at 1536.`, 'BP-A7');
      if (/<([a-z][\w-]*)[^>]*>[\s\S]*<\/\1>/i.test(desc)) add('description', 'must', skillPath, at('description'), 'description contains an XML tag pair; the spec forbids XML tags in descriptions.', 'BP-S5');
      else if (/<[a-z][\w-]*>/i.test(desc)) add('description', 'note', skillPath, at('description'), 'description has an angle-bracket placeholder; Claude Code accepts it, the spec forbids XML tags.', 'BP-S5');
      if (/\b(I can|I will|I'll|you can|you should)\b/i.test(desc)) add('description', 'should', skillPath, at('description'), 'Write the description in third person ("Reviews X. Use when...").', 'BP-A6');
      if (!/["“][^"”]{3,}["”]|\buse when\b|\bwhen the user\b/i.test(desc)) add('description', 'note', skillPath, at('description'), 'No trigger phrases or "Use when" clause in the description.', 'BP-A9');
    }

    for (const k of Object.keys(data)) {
      if (!KNOWN_FIELDS.has(k)) add('frontmatter', 'should', skillPath, at(k), `Unknown frontmatter field "${k}"; Claude Code ignores it.`, 'BP-A2');
    }
    if (data.compatibility !== undefined && (typeof data.compatibility !== 'string' || !data.compatibility || data.compatibility.length > 500)) {
      add('frontmatter', 'must', skillPath, at('compatibility'), 'compatibility must be 1-500 characters.', 'BP-S6');
    }
    if (data.metadata !== undefined && typeof data.metadata === 'string' && data.metadata !== '') {
      add('frontmatter', 'should', skillPath, at('metadata'), 'metadata must be a map of string keys to string values.', 'BP-S7');
    }

    // allowed-tools
    for (const tool of toList(data['allowed-tools'])) {
      if (/^Bash(\(\*\))?$/.test(tool.trim())) add('allowed-tools', 'must', skillPath, at('allowed-tools'), `"${tool}" pre-approves every shell command. Scope it: Bash(cmd:*).`, 'SC-1');
    }

    // model
    if (!data.model) add('model', 'should', skillPath, 1, 'No model: set. Bind the model to the work (haiku | sonnet | opus | inherit).', 'SC-7');
    else if (!MODELS.test(String(data.model))) add('model', 'should', skillPath, at('model'), `model "${data.model}" is not a /model alias, inherit, or claude-* id.`, 'BP-A42');
  }

  // length and budget
  const body = lines.slice(fm.bodyStart).join('\n');
  const bodyLines = lines.length - fm.bodyStart;
  const tokens = Math.round(body.length / 4);
  if (bodyLines > 500) add('length', 'should', skillPath, 1, `Body is ${bodyLines} lines; keep SKILL.md under 500 and move reference to sibling files.`, 'BP-A19');
  if (tokens > 5000) add('length', 'should', skillPath, 1, `Body is ~${tokens} tokens. After compaction only the first 5,000 survive: put constraints and output shape first.`, 'BP-S10');

  // inline shell
  let fence = null;
  let fenceStart = 0;
  let fenceLines = 0;
  let heredoc = false;
  lines.forEach((line, i) => {
    const m = line.match(/^\s*```(\w*)/);
    if (m && !fence) { fence = m[1] || 'text'; fenceStart = i + 1; fenceLines = 0; heredoc = false; return; }
    if (m && fence) {
      if (/^(bash|sh|shell|zsh)$/.test(fence)) {
        if (fenceLines > 20) add('inline-bash', 'should', skillPath, fenceStart, `${fenceLines}-line shell block. Move it to scripts/ and call the script.`, 'SC-2');
        if (heredoc) add('inline-bash', 'should', skillPath, fenceStart, 'Shell block writes a file with a heredoc. Move it to a script.', 'SC-2');
      }
      fence = null;
      return;
    }
    if (fence) {
      fenceLines++;
      if (/<<-?\s*['"]?\w+/.test(line) && (/>\s*[^\s&|>]/.test(line.replace(/<<-?\s*['"]?\w+['"]?/, '')) || /\btee\b/.test(line))) heredoc = true;
    }
  });

  // paths
  lines.forEach((line, i) => {
    if (/(^|[\s`(])(\/Users\/|\/home\/[a-z]|~\/\.claude\/skills\/)/.test(line)) {
      add('paths', 'should', skillPath, i + 1, 'Hard-coded absolute path. Use ${CLAUDE_SKILL_DIR} (or ${CLAUDE_PLUGIN_ROOT}).', 'BP-A36');
    }
    if (/(^|[\s`])\.\/scripts\//.test(line)) {
      add('paths', 'should', skillPath, i + 1, './scripts/ resolves against the project, not the skill. Use ${CLAUDE_SKILL_DIR}/scripts/.', 'BP-A36');
    }
    if (/\b[\w.-]+\\[\w.-]+\.(md|py|sh|mjs|js|json|ya?ml)\b/.test(line)) {
      add('paths', 'must', skillPath, i + 1, 'Windows-style path. Use forward slashes.', 'BP-A23');
    }
    const call = line.match(/(^|[\s`])(\S*)\$\{CLAUDE_(SKILL_DIR|PLUGIN_ROOT)\}\/\S+\.(sh|mjs|js|py)\b/);
    if (call && !/\b(node|bash|sh|zsh|python3?|deno|bun)\s+["']?$/.test(line.slice(0, call.index + call[1].length))) {
      add('paths', 'note', skillPath, i + 1, 'Call bundled scripts through their interpreter (node …, bash …); some packagers drop the exec bit.', 'BP-X3');
    }
  });

  // links to sibling files
  const mdFiles = walk(abs).filter((p) => p.endsWith('.md') && !/\/tests?\//.test(relative(abs, p).replace(/^/, '/')));
  for (const md of mdFiles) {
    const mdLines = readFileSync(md, 'utf8').split(/\r?\n/);
    const isSkillFile = md === join(abs, file);
    mdLines.forEach((line, i) => {
      for (const [, target] of line.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:|^\$\{|^\//i.test(target)) continue;
        const dest = resolve(dirname(md), target);
        if (!existsSync(dest)) add('links', 'must', rel(md), i + 1, `Link target "${target}" does not exist.`, 'BP-S11');
        else if (!isSkillFile && dest.endsWith('.md') && dest !== join(abs, file)) {
          add('links', 'should', rel(md), i + 1, `Reference file links on to "${target}"; link every reference directly from ${file}.`, 'BP-A21');
        }
      }
    });
    if (!isSkillFile && mdLines.length > 100 && !/^#+\s*(contents|table of contents)/im.test(mdLines.slice(0, 30).join('\n'))) {
      add('reference-toc', 'should', rel(md), 1, `${mdLines.length}-line reference file with no table of contents near the top.`, 'BP-A22');
    }
  }

  // scripts
  for (const script of walk(abs).filter((p) => /\.(sh|bash|mjs|cjs|js|py)$/.test(p) && !/\/tests?\//.test(p))) {
    const path = rel(script);
    const src = readFileSync(script, 'utf8');
    const hasShebang = src.startsWith('#!');
    const executable = (statSync(script).mode & 0o111) !== 0;
    if (hasShebang && !executable) add('scripts', 'should', path, 1, 'Has a shebang but is not executable (chmod +x).', 'SC-2');
    const check = /\.(sh|bash)$/.test(script) ? run('bash', ['-n', script])
      : /\.py$/.test(script) ? run('python3', ['-m', 'py_compile', script])
      : run(process.execPath, ['--check', script]);
    if (!check.ok && !check.missing) add('scripts', 'must', path, 1, `Syntax check fails: ${check.out.split('\n')[0]}`, 'CR-1');
  }
  const testsDir = ['tests', 'test'].map((d) => join(abs, d)).find((d) => existsSync(d));
  const hasScripts = existsSync(join(abs, 'scripts'));
  if (hasScripts && !testsDir) add('tests', 'note', skillPath, 1, 'Skill ships scripts but no tests/ folder.', 'CR-6');

  // voice
  let voice = { ran: false, reason: 'voice-rules not installed' };
  if (voiceLint) {
    const r = run(process.execPath, [voiceLint, '--json', ...mdFiles]);
    try {
      voice = { ran: true, linter: voiceLint };
      for (const res of JSON.parse(r.out.slice(r.out.indexOf('[')))) {
        for (const f of res.findings) {
          add(`voice:${f.rule}`, f.severity === 'error' ? 'should' : 'note', rel(res.file), f.line, `${f.excerpt}${f.suggest ? ` → ${f.suggest}` : ''}`, `${f.id} (voice-rules, ${res.audience})`);
        }
      }
    } catch {
      voice = { ran: false, reason: `voice-lint output did not parse: ${r.out.slice(0, 200)}` };
    }
  }

  // Agent Skills reference validator, when installed
  let skillsRef = { ran: false, reason: 'skills-ref not installed' };
  const sr = run('skills-ref', ['validate', abs]);
  if (!sr.missing) {
    skillsRef = { ran: true, ok: sr.ok };
    if (!sr.ok) add('skills-ref', 'must', skillPath, 1, sr.out.split('\n').slice(0, 5).join(' | '), 'BP-S12');
  }

  return {
    dir,
    skillFile: skillPath,
    frontmatter: data,
    bodyLines,
    approxTokens: tokens,
    files: walk(abs).map(rel).sort(),
    voice,
    skillsRef,
    findings,
  };
}

// --- cli ---------------------------------------------------------------------

function main(argv) {
  let root = null;
  let changedFile = null;
  const dirs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--changed') changedFile = argv[++i];
    else if (argv[i] === '-h' || argv[i] === '--help') { console.log('usage: pregate.mjs --root <tree> [--changed <file>] [<skill-dir>...]'); return 0; }
    else dirs.push(argv[i]);
  }
  if (!root || (!changedFile && !dirs.length)) {
    console.error('usage: pregate.mjs --root <tree> [--changed <file>] [<skill-dir>...]');
    return 2;
  }
  root = resolve(root);
  let skipped = [];
  let skillDirs = dirs.map((d) => relative(root, resolve(root, d)));
  if (changedFile) {
    const changed = readFileSync(changedFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const found = findSkills(root, changed);
    skillDirs = [...new Set([...skillDirs, ...found.skills])];
    skipped = found.skipped;
  }
  const missing = skillDirs.filter((d) => !existsSync(join(root, d)) || !skillFileIn(join(root, d)));
  const skills = skillDirs.filter((d) => !missing.includes(d)).map((d) => checkSkill(root, d));
  for (const d of missing) skipped.push({ path: d, reason: 'no SKILL.md in folder' });
  console.log(JSON.stringify({ root, skills, skipped }, null, 2));
  return 0;
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = main(process.argv.slice(2));
