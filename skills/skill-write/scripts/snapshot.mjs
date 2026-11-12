#!/usr/bin/env node
// Baseline snapshot for skill-write. Zero dependencies.
//
// Copies a skill folder into a new folder under the system temp directory, so Step 6 can
// compare and restore against it. Each run makes a fresh folder and deletes nothing; the OS
// clears old temp folders. A skill with any symlink is refused, never followed: a copied link
// can still point at the original or outside the skill, so later edits would leak into the
// "before" version; skill-review flags every symlink in a skill anyway (SEC-5).
//
// Usage:
//   snapshot.mjs <skill-dir>
//
// Output: the snapshot path on stdout. Exit 0, 1 when the skill has a symlink, 2 on a usage
// error, a <skill-dir> without SKILL.md, or a failed copy.

import { cpSync, existsSync, mkdtempSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every symlink under src, as paths relative to src.
export function symlinks(src, dir = src) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isSymbolicLink()) return [relative(src, path)];
    return e.isDirectory() ? symlinks(src, path) : [];
  });
}

export function snapshot(path, root = tmpdir()) {
  if (!existsSync(join(path, 'SKILL.md')) || !statSync(path).isDirectory()) {
    return { code: 2, message: `${path} is not a skill folder (no SKILL.md)` };
  }
  // A skill folder reached through a symlink (~/.claude/skills/x -> ~/.agents/skills/x) is
  // copied from its real path, so the snapshot holds files, not a link back to the live skill.
  const src = realpathSync(path);
  const links = symlinks(src);
  if (links.length) return { code: 1, message: `the skill has symlinks; remove them first: ${links.join(', ')}` };
  const dest = mkdtempSync(join(root, 'skill-write-'));
  try {
    cpSync(src, dest, { recursive: true });
  } catch (err) {
    return { code: 2, message: `copy failed: ${err.message}` };
  }
  return { code: 0, message: dest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('usage: snapshot.mjs <skill-dir>');
    process.exit(2);
  }
  const { code, message } = snapshot(resolve(args[0]));
  (code ? console.error : console.log)(message);
  process.exit(code);
}
