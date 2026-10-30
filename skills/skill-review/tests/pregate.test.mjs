import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkSkill, findSkills, isTestFile, parseFrontmatter, unclaimed } from '../scripts/pregate.mjs';

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
    'not part of any skill: not reviewed',
  ]);
});

test('plugin-level and repo-level evals attach to the skill they name, longest name first', () => {
  const root = tree({
    'plugins/p/skills/document-checks/SKILL.md': GOOD,
    'plugins/p/skills/document/SKILL.md': GOOD,
    'plugins/p/evals/document-checks-basic/case.yaml': 'x: 1\n',
    'plugins/p/evals/document-checks-basic/scaffold.sh': '#!/usr/bin/env bash\nif then fi\n',
    'plugins/p/evals/document-checks-basic/graders/g.md': '# g\n',
    'plugins/p/evals/orphan-x/case.yaml': '',
    'evals/document-checks.md': '',
  });
  const { skills, skipped } = findSkills(root, [
    'plugins/p/evals/document-checks-basic/case.yaml',
    'plugins/p/evals/document-checks-basic/scaffold.sh',
    'plugins/p/evals/orphan-x/case.yaml',
    'evals/document-checks.md',
  ]);
  assert.deepEqual(skills, ['plugins/p/skills/document-checks']);
  assert.deepEqual(skipped, [{ path: 'plugins/p/evals/orphan-x/case.yaml', reason: 'eval that names no skill in the tree: not reviewed' }]);

  const result = checkSkill(root, 'plugins/p/skills/document-checks', noVoice);
  assert.deepEqual(result.evals, [
    'evals/document-checks.md',
    'plugins/p/evals/document-checks-basic/case.yaml',
    'plugins/p/evals/document-checks-basic/graders/g.md',
    'plugins/p/evals/document-checks-basic/scaffold.sh',
  ]);
  assert.ok(result.findings.some((f) => f.check === 'scripts' && f.severity === 'must' && f.path.endsWith('scaffold.sh')));
  assert.deepEqual(checkSkill(root, 'plugins/p/skills/document', noVoice).evals, []);
});

test('evals inside the skill folder are listed too', () => {
  const root = tree({ 'skills/e/SKILL.md': GOOD, 'skills/e/evals/evals.md': '# evals\n' });
  assert.deepEqual(checkSkill(root, 'skills/e', noVoice).evals, ['skills/e/evals/evals.md']);
});

test('a changed path no skill read goes to skipped', () => {
  const root = tree({ 'skills/h/SKILL.md': GOOD, 'skills/h/.env': 'x' });
  const changed = ['skills/h/SKILL.md', 'skills/h/.env', 'README.md'];
  const found = findSkills(root, changed);
  const skipped = unclaimed([checkSkill(root, 'skills/h', noVoice)], changed, found.skipped);
  assert.deepEqual(skipped.map((s) => s.path), ['README.md', 'skills/h/.env']);
});

test('skills-ref not run names the unchecked rules and the install command', () => {
  const root = tree({ 'skills/r/SKILL.md': GOOD });
  const { skillsRef } = checkSkill(root, 'skills/r', noVoice);
  if (skillsRef.ran) return;
  assert.deepEqual(skillsRef.unchecked, ['BP-S12', 'BP-S8']);
  assert.match(skillsRef.install, /skills-ref/);
});

test('voice-lint findings are folded in with their voice-rules ID', () => {
  const root = tree({ 'skills/v/SKILL.md': GOOD, 'skills/v/README.md': 'This is crucial — yes.\n' });
  const lint = new URL('../../voice-rules/scripts/voice-lint.mjs', import.meta.url).pathname;
  const result = checkSkill(root, 'skills/v', { voiceLint: lint });
  assert.equal(result.voice.ran, true);
  const voice = result.findings.filter((f) => f.check.startsWith('voice:'));
  assert.deepEqual(voice.map((f) => [f.check, f.severity, f.path]), [
    ['voice:em-dash', 'should', 'skills/v/README.md'],
    ['voice:ai-vocab', 'should', 'skills/v/README.md'],
  ]);
  assert.equal(voice[0].rule, 'H2 (voice-rules, human)');
});

test('every finding cites a rule ID', () => {
  const root = tree({ 'skills/bad/SKILL.md': '---\nname: bad\n---\nRun ./scripts/x.sh\n' });
  for (const f of checkSkill(root, 'skills/bad', noVoice).findings) {
    assert.match(f.rule, /^(BP-[ASX]\d+|SC-\d+|CR-\d+|SEC-\d+|[AH]\d+ \(voice-rules)/, f.check);
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
  const found = checkSkill(root, 'skills/claude-helper', noVoice).findings.map((f) => `${f.rule}:${f.path.split('/').pop()}`);
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

test('symlinks are reported and never followed', () => {
  const root = tree({ 'skills/s/SKILL.md': GOOD, 'secret.txt': 'TOKEN=hunter2 — crucial\n' });
  symlinkSync(join(root, 'secret.txt'), join(root, 'skills/s/notes.md'));
  const lint = new URL('../../voice-rules/scripts/voice-lint.mjs', import.meta.url).pathname;
  const result = checkSkill(root, 'skills/s', { voiceLint: lint });
  assert.deepEqual(result.symlinks, ['skills/s/notes.md']);
  assert.ok(!result.files.includes('skills/s/notes.md'));
  assert.deepEqual(result.findings.filter((f) => f.check === 'symlink').map((f) => [f.path, f.severity, f.rule]), [['skills/s/notes.md', 'should', 'SEC-5']]);
  assert.ok(!JSON.stringify(result).includes('hunter2'));

  const linked = tree({ 'real.md': GOOD, 'skills/l/x.txt': '' });
  symlinkSync(join(linked, 'real.md'), join(linked, 'skills/l/SKILL.md'));
  assert.deepEqual(checkSkill(linked, 'skills/l', noVoice).findings.map((f) => [f.check, f.severity]), [['symlink', 'must']]);
});

test('findings carry review.json field names', () => {
  const root = tree({ 'skills/bad/SKILL.md': '---\nname: bad\n---\nbody\n' });
  for (const f of checkSkill(root, 'skills/bad', noVoice).findings) {
    assert.deepEqual(Object.keys(f), ['check', 'severity', 'path', 'line', 'rule', 'title', 'body']);
    assert.ok(f.title && !f.title.endsWith('.'));
  }
});

test('parseFrontmatter: wrapped plain and quoted scalars, quoted keys, nested maps, CRLF', () => {
  const { data, error } = parseFrontmatter([
    '---',
    'name: x',
    'description: Does a thing and',
    '  continues. Use when x',
    '"model": sonnet',
    "title: 'a: b'",
    'note: "starts here',
    '  and ends here"',
    'hooks:',
    '  PreToolUse:',
    '    - matcher: Bash',
    'allowed-tools:',
    '  - Read',
    '---',
  ].join('\r\n'));
  assert.equal(error, null);
  assert.equal(data.description, 'Does a thing and continues. Use when x');
  assert.equal(data.model, 'sonnet');
  assert.equal(data.title, 'a: b');
  assert.equal(data.note, 'starts here and ends here');
  assert.deepEqual(data.hooks, {});
  assert.deepEqual(data['allowed-tools'], ['Read']);
});

test('YAML the parser cannot read is a note about the parser, not a must on the skill', () => {
  const root = tree({ 'skills/y/SKILL.md': '---\nname: y\n? complex key\n---\nbody\n' });
  const found = checkSkill(root, 'skills/y', noVoice).findings.filter((f) => f.check === 'frontmatter');
  assert.deepEqual(found.map((f) => f.severity), ['note']);
  assert.match(found[0].body, /parser could not read/);
});

test('"Use whenever" counts as a trigger clause', () => {
  const root = tree({ 'skills/w/SKILL.md': GOOD.replace('Use when the user says "check my widget".', 'Use whenever editing a widget.') });
  assert.ok(!checkSkill(root, 'skills/w', noVoice).findings.some((f) => f.rule === 'BP-A9'));
});

test('prose that warns about a path pattern is not flagged', () => {
  const root = tree({ 'skills/p/SKILL.md': GOOD.replace('# Good', '# Good\n\nA `./scripts/` path resolves against the project. Never write /Users/ paths.') });
  assert.ok(!checkSkill(root, 'skills/p', noVoice).findings.some((f) => f.check === 'paths'));
});

test('a tree under a folder named test still gets script syntax checks', () => {
  const base = mkdtempSync(join(tmpdir(), 'pregate-'));
  const root = join(base, 'test', 'r');
  mkdirSync(join(root, 'skills/t/scripts'), { recursive: true });
  writeFileSync(join(root, 'skills/t/SKILL.md'), GOOD);
  writeFileSync(join(root, 'skills/t/scripts/bad.mjs'), 'const = ;\n');
  assert.ok(checkSkill(root, 'skills/t', noVoice).findings.some((f) => f.check === 'scripts' && f.severity === 'must'));
});
