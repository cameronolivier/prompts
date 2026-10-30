#!/usr/bin/env node
// Token measurement for skill-write. Zero dependencies.
//
// Measures a skill folder the way Claude Code pays for it: the description in every session,
// the SKILL.md body on every turn after it loads, and only the first 5,000 tokens of the
// body after compaction. Token counts are approximate (characters / 4, as skill-review's pre-gate).
//
// Usage:
//   measure.mjs <skill-dir> [--baseline <measure.json>]
//
//   --baseline  an earlier output of this script; adds a `delta` block (after minus before)
//
// Output: JSON on stdout. Exit 0, or 2 on a usage error or an unreadable folder.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DESCRIPTION_CAP = 1536;
export const COMPACTION_TOKENS = 5000;
const TEXT = /\.(md|mjs|js|cjs|ts|sh|py|json|ya?ml|txt)$/;

export const approxTokens = (text) => Math.round(text.length / 4);

// Reads `description` and `when_to_use`: inline, quoted, or a `>`/`|` block scalar.
export function listingText(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const out = [];
  for (const key of ['description', 'when_to_use']) {
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i < 0) continue;
    const inline = lines[i].slice(key.length + 1).trim();
    if (inline && !/^[>|][-+]?$/.test(inline)) {
      out.push(inline.replace(/^(["'])(.*)\1$/, '$2'));
      continue;
    }
    const block = [];
    for (let j = i + 1; j < lines.length && (/^\s+\S/.test(lines[j]) || lines[j].trim() === ''); j++) block.push(lines[j].trim());
    out.push(block.join(' ').trim());
  }
  return out.join(' ');
}

export function splitSkill(text) {
  const lines = text.split(/\r?\n/);
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  if (end < 0) return { frontmatter: '', body: text, bodyStartLine: 1 };
  return { frontmatter: lines.slice(1, end).join('\n'), body: lines.slice(end + 1).join('\n'), bodyStartLine: end + 2 };
}

// First SKILL.md line that falls past the compaction cut, or null when the whole body survives.
export function compactionLine(body, bodyStartLine) {
  let chars = 0;
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    chars += lines[i].length + 1;
    if (chars / 4 > COMPACTION_TOKENS) return bodyStartLine + i;
  }
  return null;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(path);
    return e.isFile() && TEXT.test(e.name) ? [path] : [];
  });
}

export function measure(dir) {
  const skillText = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  const { frontmatter, body, bodyStartLine } = splitSkill(skillText);
  const listing = listingText(frontmatter);
  const files = walk(dir)
    .map((path) => {
      const text = readFileSync(path, 'utf8');
      return { path: relative(dir, path), lines: text.split('\n').length, approxTokens: approxTokens(text) };
    })
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  return {
    dir,
    listing: { chars: listing.length, cap: DESCRIPTION_CAP, overCap: listing.length > DESCRIPTION_CAP },
    body: {
      lines: body.split('\n').length,
      approxTokens: approxTokens(body),
      compactionCutLine: compactionLine(body, bodyStartLine),
    },
    files,
    totalTokens: files.reduce((sum, f) => sum + f.approxTokens, 0),
  };
}

export function delta(before, after) {
  const pct = (b, a) => (b ? Math.round(((a - b) / b) * 100) : 0);
  return {
    listingChars: after.listing.chars - before.listing.chars,
    bodyTokens: after.body.approxTokens - before.body.approxTokens,
    bodyTokensPct: pct(before.body.approxTokens, after.body.approxTokens),
    totalTokens: after.totalTokens - before.totalTokens,
    totalTokensPct: pct(before.totalTokens, after.totalTokens),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const b = args.indexOf('--baseline');
  const baselinePath = b >= 0 ? args.splice(b, 2)[1] : null;
  const [dir] = args;
  if (!dir || args.length > 1 || (b >= 0 && !baselinePath)) {
    console.error('usage: measure.mjs <skill-dir> [--baseline <measure.json>]');
    process.exit(2);
  }
  try {
    if (!statSync(dir).isDirectory()) throw new Error(`${dir} is not a folder`);
    const result = measure(resolve(dir));
    if (baselinePath) result.delta = delta(JSON.parse(readFileSync(baselinePath, 'utf8')), result);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
