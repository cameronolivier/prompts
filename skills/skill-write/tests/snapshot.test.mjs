import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { snapshot } from '../scripts/snapshot.mjs';

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'snapshot-'));
  const src = join(base, 'my-skill');
  mkdirSync(src);
  writeFileSync(join(src, 'SKILL.md'), 'v1');
  const root = join(base, 'tmp');
  mkdirSync(root);
  return { base, src, root };
}

test('copies into a new temp folder; a second run makes another and deletes nothing', () => {
  const { src, root } = setup();
  const first = snapshot(src, root);
  assert.equal(first.code, 0);
  assert.equal(dirname(first.message), root);
  assert.match(basename(first.message), /^skill-write-/);
  writeFileSync(join(src, 'SKILL.md'), 'v2');
  const second = snapshot(src, root);
  assert.equal(second.code, 0);
  assert.notEqual(second.message, first.message);
  assert.equal(readFileSync(join(first.message, 'SKILL.md'), 'utf8'), 'v1');
  assert.equal(readFileSync(join(second.message, 'SKILL.md'), 'utf8'), 'v2');
  assert.equal(readFileSync(join(src, 'SKILL.md'), 'utf8'), 'v2');
});

test('a skill folder reached through a symlink is copied as files, independent of the live skill', () => {
  const { base, src, root } = setup();
  const alias = join(base, 'alias-skill');
  symlinkSync(src, alias);
  const result = snapshot(alias, root);
  assert.equal(result.code, 0);
  assert.equal(lstatSync(result.message).isDirectory(), true);
  assert.equal(lstatSync(join(result.message, 'SKILL.md')).isFile(), true);
  writeFileSync(join(src, 'SKILL.md'), 'v2');
  assert.equal(readFileSync(join(result.message, 'SKILL.md'), 'utf8'), 'v1');
});

test('refuses any symlink: inside, outside, absolute, or a chain through one', () => {
  for (const [name, target] of [
    ['alias.md', 'SKILL.md'],
    ['notes.md', '../outside.md'],
    ['abs.md', '/etc/hosts'],
    ['jump', '.'],
    ['refs/via.md', '../jump/../outside.md'],
  ]) {
    const { base, src, root } = setup();
    writeFileSync(join(base, 'outside.md'), 'x');
    if (name.startsWith('refs/')) mkdirSync(join(src, 'refs'));
    symlinkSync(target, join(src, name));
    const result = snapshot(src, root);
    assert.equal(result.code, 1, name);
    assert.match(result.message, new RegExp(name.replace('.', '\\.')));
    assert.deepEqual(readdirSync(root), [], name);
  }
});

test('refuses a source without SKILL.md', () => {
  const { base, root } = setup();
  assert.equal(snapshot(base, root).code, 2);
});
