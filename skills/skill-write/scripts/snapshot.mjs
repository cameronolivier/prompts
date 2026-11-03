#!/usr/bin/env node
// Baseline snapshot for skill-write. Zero dependencies.
//
// Copies a skill folder to <dest>, so Step 6 can compare and restore against it.
// Re-running replaces an earlier snapshot; any other existing <dest> is refused.
// A skill with any symlink is refused, never followed. A copied link can still point at the
// original or outside the skill, so later edits would leak into the "before" version;
// skill-review flags every symlink in a skill anyway (SEC-5).
//
// Usage:
//   snapshot.mjs <skill-dir> <dest>
//
// Output: the snapshot path on stdout. Exit 0, 1 when <dest> exists and is not a snapshot,
// overlaps <skill-dir>, or the skill has a symlink, 2 on a usage error or a <skill-dir>
// without SKILL.md. Nothing is deleted or written on a non-zero exit.

import { cpSync, existsSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '.skill-write-snapshot';

// Every symlink under src, as paths relative to src.
export function symlinks(src, dir = src) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isSymbolicLink()) return [relative(src, path)];
    return e.isDirectory() ? symlinks(src, path) : [];
  });
}

// Real path, following symlinked ancestors; for a path not yet created, its parent's real path.
const canonical = (p) => (existsSync(p) ? realpathSync(p) : join(canonical(dirname(p)), basename(p)));
const within = (inner, outer) => inner === outer || inner.startsWith(outer + sep);

export function snapshot(src, dest) {
  if (!existsSync(join(src, 'SKILL.md')) || !statSync(src).isDirectory()) {
    return { code: 2, message: `${src} is not a skill folder (no SKILL.md)` };
  }
  const links = symlinks(src);
  if (links.length) return { code: 1, message: `the skill has symlinks; remove them first: ${links.join(', ')}` };
  const [realSrc, realDest] = [canonical(src), canonical(dest)];
  if (within(realSrc, realDest) || within(realDest, realSrc)) {
    return { code: 1, message: `${dest} overlaps the skill folder; pick a path outside it` };
  }
  if (existsSync(dest)) {
    if (!existsSync(join(dest, MARKER))) return { code: 1, message: `${dest} exists and is not a skill-write snapshot; pick another path` };
    rmSync(dest, { recursive: true });
  }
  cpSync(src, dest, { recursive: true });
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
