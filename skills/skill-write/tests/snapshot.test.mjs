import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
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

test('refuses any symlink: inside, outside, absolute, or a chain through one', () => {
  const { base, src, dest } = setup();
  writeFileSync(join(base, 'outside.md'), 'x');
  mkdirSync(join(src, 'refs'));
  for (const [name, target] of [
    ['alias.md', 'SKILL.md'],
    ['notes.md', '../outside.md'],
    ['abs.md', join(src, 'SKILL.md')],
    ['jump', '.'],
    ['refs/via.md', '../jump/../outside.md'],
  ]) {
    const { src: s, dest: d } = setup();
    if (name.startsWith('refs/')) mkdirSync(join(s, 'refs'));
    symlinkSync(target, join(s, name));
    const result = snapshot(s, d);
    assert.equal(result.code, 1, name);
    assert.match(result.message, new RegExp(name.replace('.', '\\.')));
    assert.equal(existsSync(d), false, name);
  }
  assert.equal(snapshot(src, dest).code, 0);
});

test('refuses a dest that is, contains, or sits inside the skill, and deletes nothing', () => {
  const { base, src, dest } = setup();
  assert.equal(snapshot(src, dest).code, 0);
  // dest is a marked snapshot; using it as the source too must not delete it.
  assert.equal(snapshot(dest, dest).code, 1);
  assert.equal(existsSync(join(dest, 'SKILL.md')), true);
  // A marked dest that contains the source.
  const inner = join(dest, 'inner-skill');
  mkdirSync(inner);
  writeFileSync(join(inner, 'SKILL.md'), 'x');
  assert.equal(snapshot(inner, dest).code, 1);
  assert.equal(existsSync(join(inner, 'SKILL.md')), true);
  // Reached through a symlinked alias of the same folder.
  symlinkSync(dest, join(base, 'alias'));
  assert.equal(snapshot(dest, join(base, 'alias')).code, 1);
  assert.equal(existsSync(join(dest, 'SKILL.md')), true);
  // dest inside the skill.
  assert.equal(snapshot(src, join(src, 'before')).code, 1);
  assert.equal(existsSync(join(src, 'before')), false);
});

test('refuses a source without SKILL.md', () => {
  const { base, dest } = setup();
  assert.equal(snapshot(base, dest).code, 2);
});
