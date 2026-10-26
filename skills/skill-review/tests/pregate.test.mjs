import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkSkill, findSkills, isTestFile, parseFrontmatter } from '../scripts/pregate.mjs';

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'pregate-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const GOOD = `---
name: good
description: Reviews widgets. Use when the user says "check my widget".
allowed-tools:
  - Bash(node \${CLAUDE_SKILL_DIR}/scripts/run.mjs *)
model: sonnet
---

# Good

Run \`node \${CLAUDE_SKILL_DIR}/scripts/run.mjs\`. See [reference](reference.md).
`;

const checks = (result) => result.findings.map((f) => `${f.severity}:${f.check}`).sort();
const noVoice = { voiceLint: null };

test('parseFrontmatter: scalars, lists, block scalars, inline lists', () => {
  const { data, error } = parseFrontmatter('---\nname: x\ndescription: >\n  one\n  two\nallowed-tools:\n  - Read\n  - Bash(gh:*)\npaths: [a, "b"]\n---\nbody');
  assert.equal(error, null);
  assert.deepEqual(data, { name: 'x', description: 'one two', 'allowed-tools': ['Read', 'Bash(gh:*)'], paths: ['a', 'b'] });
  assert.match(parseFrontmatter('no fm').error, /no frontmatter/);
  assert.match(parseFrontmatter('---\nname: x\n').error, /never closes/);
});

test('a clean skill has no findings', () => {
  const root = tree({
    'skills/good/SKILL.md': GOOD,
    'skills/good/reference.md': '# Ref\n',
    'skills/good/scripts/run.mjs': '#!/usr/bin/env node\nconsole.log(1);\n',
    'skills/good/tests/run.test.mjs': '',
  });
  chmodSync(join(root, 'skills/good/scripts/run.mjs'), 0o755);
  assert.deepEqual(checks(checkSkill(root, 'skills/good', noVoice)), []);
});

test('a broken skill trips every deterministic check', () => {
  const bash = Array.from({ length: 22 }, (_, i) => `echo ${i}`).join('\n');
  const root = tree({
    'skills/bad/skill.md': `---
name: Bad_Name
description: I can help with things <example>x</example>
allowed-tools: Read, Bash
colour: blue
---

Run ./scripts/go.sh from /Users/someone/skills.
Broken [link](missing.md).

\`\`\`bash
cat > out.txt <<EOF
${bash}
EOF
\`\`\`
`,
    'skills/bad/scripts/go.sh': '#!/usr/bin/env bash\nif then fi\n',
  });
  assert.deepEqual(checks(checkSkill(root, 'skills/bad', noVoice)), [
    'must:allowed-tools',
    'must:description',
    'must:links',
    'must:name',
    'must:name',
    'must:scripts',
    'note:description',
    'note:tests',
    'should:description',
    'should:frontmatter',
    'should:inline-bash',
    'should:inline-bash',
    'should:model',
    'should:paths',
    'should:paths',
    'should:scripts',
    'should:skill-file-case',
  ]);
});

test('frontmatter that does not parse is a must', () => {
  const root = tree({ 'skills/x/SKILL.md': '# no frontmatter\n' });
  assert.ok(checks(checkSkill(root, 'skills/x', noVoice)).includes('must:frontmatter'));
});

test('length: over 500 body lines is a should', () => {
  const root = tree({ 'skills/long/SKILL.md': GOOD.replace('# Good', `# Good\n${'line\n'.repeat(520)}`) });
  assert.ok(checks(checkSkill(root, 'skills/long', noVoice)).includes('should:length'));
});

test('findSkills maps changed paths to skill folders and names what it skips', () => {
  const root = tree({ 'skills/a/SKILL.md': GOOD, 'skills/a/scripts/x.mjs': '', 'skills/b/skill.md': GOOD });
  const { skills, skipped } = findSkills(root, [
    'skills/a/scripts/x.mjs',
    'skills/a/SKILL.md',
    'skills/b/skill.md',
    'skills/gone/SKILL.md',
    'commands/foo.md',
    'plugins/p/agents/bar.md',
    'README.md',
  ]);
  assert.deepEqual(skills, ['skills/a', 'skills/b']);
  assert.deepEqual(skipped.map((s) => s.reason), [
    'skill deleted in this change',
    'command: out of scope in v1',
    'agent: out of scope in v1',
  ]);
});

test('voice-lint findings are folded in with their voice-rules ID', () => {
  const root = tree({ 'skills/v/SKILL.md': GOOD, 'skills/v/README.md': 'This is crucial — yes.\n' });
  const lint = new URL('../../voice-rules/scripts/voice-lint.mjs', import.meta.url).pathname;
  const result = checkSkill(root, 'skills/v', { voiceLint: lint });
  assert.equal(result.voice.ran, true);
  const voice = result.findings.filter((f) => f.check.startsWith('voice:'));
  assert.deepEqual(voice.map((f) => [f.check, f.severity, f.file]), [
    ['voice:em-dash', 'should', 'skills/v/README.md'],
    ['voice:ai-vocab', 'should', 'skills/v/README.md'],
  ]);
  assert.equal(voice[0].cites, 'H2 (voice-rules, human)');
});

test('every finding cites a rule ID', () => {
  const root = tree({ 'skills/bad/SKILL.md': '---\nname: bad\n---\nRun ./scripts/x.sh\n' });
  for (const f of checkSkill(root, 'skills/bad', noVoice).findings) {
    assert.match(f.cites, /^(BP-[ASX]\d+|SC-\d+|CR-\d+|[AH]\d+ \(voice-rules)/, f.check);
  }
});

test('reserved names, Windows paths, nested references, missing TOC, interpreter prefix', () => {
  const root = tree({
    'skills/claude-helper/SKILL.md': `---
name: claude-helper
description: Helps. Use when "x".
model: haiku
---

Read [ref](ref.md). Open scripts\\run.py.
Run \${CLAUDE_SKILL_DIR}/scripts/run.mjs, or node \${CLAUDE_SKILL_DIR}/scripts/run.mjs.
`,
    'skills/claude-helper/ref.md': `# Ref\n\nSee [deeper](deeper.md).\n${'line\n'.repeat(110)}`,
    'skills/claude-helper/deeper.md': '# Deeper\n',
  });
  const found = checkSkill(root, 'skills/claude-helper', noVoice).findings.map((f) => `${f.cites}:${f.file.split('/').pop()}`);
  assert.deepEqual(found.sort(), [
    'BP-A21:ref.md',
    'BP-A23:SKILL.md',
    'BP-A3:SKILL.md',
    'BP-X3:SKILL.md',
    'SC-9:ref.md',
  ]);
});

test('tests beside the code count as tests', () => {
  assert.ok(isTestFile('tests/run.test.mjs'));
  assert.ok(isTestFile('scripts/test-council-workflow.mjs'));
  assert.ok(isTestFile('scripts/run.test.mjs'));
  assert.ok(isTestFile('scripts/test_run.py'));
  assert.ok(!isTestFile('scripts/council-workflow.js'));
  assert.ok(!isTestFile('scripts/attest.mjs'));
  const withTest = tree({ 'skills/c/SKILL.md': GOOD, 'skills/c/scripts/run.mjs': '', 'skills/c/scripts/test-run.mjs': '' });
  assert.ok(!checks(checkSkill(withTest, 'skills/c', noVoice)).includes('note:tests'));
  const without = tree({ 'skills/d/SKILL.md': GOOD, 'skills/d/scripts/run.mjs': '' });
  assert.ok(checks(checkSkill(without, 'skills/d', noVoice)).includes('note:tests'));
});
