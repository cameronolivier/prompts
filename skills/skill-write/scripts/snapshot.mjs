#!/usr/bin/env node
// Baseline snapshot for skill-write. Zero dependencies.
//
// Copies a skill folder to <dest>, so Step 6 can compare and restore against it.
// Re-running replaces an earlier snapshot; any other existing <dest> is refused.
//
// Usage:
//   snapshot.mjs <skill-dir> <dest>
//
// Output: the snapshot path on stdout. Exit 0, 1 when <dest> exists and is not a snapshot,
// 2 on a usage error or a <skill-dir> without SKILL.md.

import { cpSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '.skill-write-snapshot';

export function snapshot(src, dest) {
  if (!existsSync(join(src, 'SKILL.md')) || !statSync(src).isDirectory()) {
    return { code: 2, message: `${src} is not a skill folder (no SKILL.md)` };
  }
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
