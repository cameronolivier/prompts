import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot } from '../scripts/snapshot.mjs';

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'snapshot-'));
  const src = join(base, 'my-skill');
  mkdirSync(src);
  writeFileSync(join(src, 'SKILL.md'), 'v1');
  return { base, src, dest: join(base, 'before') };
}

test('copies the folder, and a re-run replaces the old snapshot without nesting', () => {
  const { src, dest } = setup();
  assert.equal(snapshot(src, dest).code, 0);
  writeFileSync(join(src, 'SKILL.md'), 'v2');
  assert.equal(snapshot(src, dest).code, 0);
  assert.equal(readFileSync(join(dest, 'SKILL.md'), 'utf8'), 'v2');
  assert.equal(existsSync(join(dest, 'my-skill')), false);
});

test('refuses a destination that is not an earlier snapshot', () => {
  const { src, dest } = setup();
  mkdirSync(dest);
  writeFileSync(join(dest, 'keep.txt'), 'x');
  assert.equal(snapshot(src, dest).code, 1);
  assert.equal(readFileSync(join(dest, 'keep.txt'), 'utf8'), 'x');
});

test('refuses a source without SKILL.md', () => {
  const { base, dest } = setup();
  assert.equal(snapshot(base, dest).code, 2);
});
