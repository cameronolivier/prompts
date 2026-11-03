import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, findSkill } from '../scripts/check-deps.mjs';

function skill(root, name) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
}

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'check-deps-'));
  const dirs = { home: join(base, 'home'), project: join(base, 'project'), skills: join(base, 'repo', 'skills') };
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
  return { ...dirs, skillDir: join(dirs.skills, 'skill-write') };
}

test('nothing installed: every required skill is missing, with an install command', () => {
  const s = setup();
  const result = check(s);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.map((m) => m.name), ['skill-review', 'voice-rules', 'skill-conventions']);
  assert.ok(result.missing.every((m) => m.install && m.role));
  assert.equal(result.drafting, false);
});

test('finds skills in sibling, project, home, ~/.agents and plugin cache', () => {
  const s = setup();
  skill(s.skills, 'skill-review');
  skill(join(s.project, '.claude', 'skills'), 'voice-rules');
  skill(join(s.home, '.claude', 'plugins', 'cache', 'mohara', 'mo-ai-labs', '0.1.14', 'skills'), 'skill-conventions');
  skill(join(s.home, '.agents', 'skills'), 'write-a-skill');
  const result = check(s);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.drafting, true);
  assert.match(result.required.find((d) => d.name === 'skill-conventions').path, /mo-ai-labs/);
});

test('a folder without SKILL.md does not count', () => {
  const s = setup();
  mkdirSync(join(s.home, '.claude', 'skills', 'skill-review'), { recursive: true });
  assert.equal(findSkill('skill-review', [join(s.home, '.claude', 'skills')]), null);
});
