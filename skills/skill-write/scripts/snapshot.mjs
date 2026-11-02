#!/usr/bin/env node
// Baseline snapshot for skill-write. Zero dependencies.
//
// Copies a skill folder to <dest>, so Step 6 can compare and restore against it.
// Re-running replaces an earlier snapshot; any other existing <dest> is refused.
// A symlink that points outside the skill is refused, not followed: its target is not the
// skill's to snapshot, and later edits to it would leak into the "before" version.
//
// Usage:
//   snapshot.mjs <skill-dir> <dest>
//
// Output: the snapshot path on stdout. Exit 0, 1 when <dest> exists and is not a snapshot or
// the skill links outside itself, 2 on a usage error or a <skill-dir> without SKILL.md.

import { cpSync, existsSync, readdirSync, readlinkSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '.skill-write-snapshot';

// Symlinks under src whose target resolves outside src, as paths relative to src.
export function outsideLinks(src, dir = src) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isSymbolicLink()) {
      const target = resolve(dirname(path), readlinkSync(path));
      return target === src || target.startsWith(src + sep) ? [] : [relative(src, path)];
    }
    return e.isDirectory() ? outsideLinks(src, path) : [];
  });
}

export function snapshot(src, dest) {
  if (!existsSync(join(src, 'SKILL.md')) || !statSync(src).isDirectory()) {
    return { code: 2, message: `${src} is not a skill folder (no SKILL.md)` };
  }
  const links = outsideLinks(src);
  if (links.length) return { code: 1, message: `symlinks point outside the skill: ${links.join(', ')}` };
  if (existsSync(dest)) {
    if (!existsSync(join(dest, MARKER))) return { code: 1, message: `${dest} exists and is not a skill-write snapshot; pick another path` };
    rmSync(dest, { recursive: true });
  }
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
  cpSync(fileURLToPath(import.meta.url), join(dest, MARKER)); // any content marks it
  return { code: 0, message: dest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('usage: snapshot.mjs <skill-dir> <dest>');
    process.exit(2);
  }
  const { code, message } = snapshot(resolve(args[0]), resolve(args[1]));
  (code ? console.error : console.log)(message);
  process.exit(code);
}
