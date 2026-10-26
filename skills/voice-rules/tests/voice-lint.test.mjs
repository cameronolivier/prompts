import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { audienceFor, lint } from '../scripts/voice-lint.mjs';

const CLI = fileURLToPath(new URL('../scripts/voice-lint.mjs', import.meta.url));
const rules = (findings) => findings.map((f) => f.rule);

test('audience comes from the file name', () => {
  assert.equal(audienceFor('skills/x/README.md'), 'human');
  assert.equal(audienceFor('skills/x/comment-format.md'), 'human');
  assert.equal(audienceFor('skills/x/pr-template.md'), 'human');
  assert.equal(audienceFor('skills/x/SKILL.md'), 'agent');
  assert.equal(audienceFor('skills/x/reference.md'), 'agent');
});

test('human text: em-dash, AI vocabulary, chatbot and curly quotes are errors', () => {
  const found = lint('This is crucial — really.\nI hope this helps.\nShe said “hi”.\n', 'human');
  assert.deepEqual(rules(found), ['em-dash', 'ai-vocab', 'chatbot', 'curly-quote']);
  assert.ok(found.every((f) => f.severity === 'error'));
});

test('agent text skips human-only rules', () => {
  assert.deepEqual(lint('This is crucial — really.\nI hope this helps.\n', 'agent'), []);
});

test('notes: plain words, filler, passive, long sentences', () => {
  const long = Array.from({ length: 31 }, () => 'word').join(' ') + '.';
  const found = lint(`We utilize it in order to ship.\nThe file was parsed by the loader.\n${long}\n`, 'human');
  assert.deepEqual(rules(found), ['plain-word', 'filler', 'passive', 'long-sentence']);
  assert.equal(found[0].suggest, 'use');
  assert.ok(found.every((f) => f.severity === 'note'));
});

test('code fences, tables, inline code and frontmatter are skipped', () => {
  const text = [
    '---',
    'description: crucial — thing',
    '---',
    '```',
    'crucial — code',
    '```',
    '| crucial — cell |',
    'Run `crucial — inline` now.',
  ].join('\n');
  assert.deepEqual(lint(text, 'human'), []);
});

test('heading emoji is flagged for humans', () => {
  assert.deepEqual(rules(lint('## 🚀 Launch\n', 'human')), ['heading-emoji']);
});

test('shouting needs three all-caps imperatives in one agent file', () => {
  assert.deepEqual(lint('You MUST do x.\nNEVER do y.\n', 'agent'), []);
  assert.deepEqual(rules(lint('You MUST do x.\nNEVER do y.\nALWAYS do z.\n', 'agent')), ['shouting', 'shouting', 'shouting']);
});

test('CLI: exit 1 on errors, 0 on notes only, JSON output, stdin defaults to human', () => {
  const run = (args, input) => spawnSync('node', [CLI, ...args], { input, encoding: 'utf8' });
  assert.equal(run(['-'], 'Crucial — yes.\n').status, 1);
  assert.equal(run(['-'], 'We utilize it.\n').status, 0);
  const json = JSON.parse(run(['--json', '-'], 'Crucial.\n').stdout);
  assert.equal(json[0].audience, 'human');
  assert.equal(json[0].findings[0].id, 'H3');
  assert.equal(run(['--audience', 'bogus', '-'], '').status, 2);
});

test('chatbot openers ending in "!" match before a space', () => {
  assert.deepEqual(rules(lint('Certainly! Here it is.\nOf course! Yes.\n', 'human')), ['chatbot', 'chatbot']);
});

test('words with a literal meaning are notes, not errors', () => {
  const found = lint('Snake case uses an underscore. The enhanced mode is on.\n', 'human');
  assert.deepEqual(found.map((f) => [f.rule, f.severity]), [['ai-vocab-soft', 'note'], ['ai-vocab-soft', 'note']]);
});

test('hard-wrapped prose is checked as one paragraph, with the right line numbers', () => {
  const words = Array.from({ length: 16 }, () => 'word').join(' ');
  const found = lint(`Intro line.\n\nWe ship this in order\nto test it. ${words}\n${words}.\n`, 'human');
  assert.deepEqual(found.map((f) => [f.rule, f.line]), [['filler', 3], ['long-sentence', 4]]);
});

test('a fence closes only on a marker at least as long as its opener', () => {
  assert.deepEqual(lint('````md\n```\ncrucial — inside\n```\n````\n', 'human'), []);
});

test('CLI: unreadable file and bad --audience exit 2 with a message', () => {
  const run = (args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
  const missing = run(['/nonexistent/file.md']);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /cannot read \/nonexistent\/file\.md: ENOENT/);
  assert.match(run(['--audience']).stderr, /must be auto, agent or human/);
});
