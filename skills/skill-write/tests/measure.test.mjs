import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactionLine, delta, listingText, measure, splitSkill } from '../scripts/measure.mjs';

test('listingText: inline, quoted and block descriptions plus when_to_use', () => {
  assert.equal(listingText('name: x\ndescription: Does X.'), 'Does X.');
  assert.equal(listingText('description: "Does X."'), 'Does X.');
  assert.equal(listingText('description: >\n  Does X\n  and Y.\nmodel: haiku'), 'Does X and Y.');
  assert.equal(listingText('description: Does X.\nwhen_to_use: On Y.'), 'Does X. On Y.');
});

test('compactionLine: null under the cut, the first line past it otherwise', () => {
  assert.equal(compactionLine('short\n', 5), null);
  const body = Array.from({ length: 300 }, () => 'x'.repeat(99)).join('\n'); // 100 chars a line = 25 tokens
  assert.equal(compactionLine(body, 5), 5 + 200);
});

test('measure and delta over a skill folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'measure-'));
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\ndescription: Does X.\n---\n\n# X\n\nBody text here.\n');
  writeFileSync(join(dir, 'scripts', 'run.mjs'), 'console.log(1);\n');
  writeFileSync(join(dir, 'logo.png'), 'binary');
  const before = measure(dir);
  assert.equal(before.listing.chars, 7);
  assert.equal(before.body.compactionCutLine, null);
  assert.deepEqual(before.files.map((f) => f.path), ['SKILL.md', 'scripts/run.mjs']);

  writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\ndescription: Does X.\n---\n\n# X\n');
  const d = delta(before, measure(dir));
  assert.ok(d.bodyTokens < 0 && d.bodyTokensPct < 0);
  assert.equal(d.listingChars, 0);
});

test('splitSkill: no frontmatter means the whole file is body', () => {
  assert.deepEqual(splitSkill('# X'), { frontmatter: '', body: '# X', bodyStartLine: 1 });
});
