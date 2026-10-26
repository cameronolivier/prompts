import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentBody, commentableLines, hasSummaryFor, invalidFindings, marker, plan, rateLimitProblem, reviewPayload } from '../scripts/post-review.mjs';

test('rateLimitProblem stops a run below the floor, with the reset time', () => {
  const now = 1_000_000_000_000;
  const ok = { resources: { graphql: { remaining: 4000, reset: 0 }, core: { remaining: 4000, reset: 0 } } };
  assert.equal(rateLimitProblem(ok, now), null);
  const low = { resources: { graphql: { remaining: 3, reset: now / 1000 + 600 }, core: { remaining: 4000, reset: 0 } } };
  assert.equal(rateLimitProblem(low, now), 'GitHub graphql rate limit low (3 left); resets in about 10 min. Nothing posted.');
});

test('hasSummaryFor matches only a skill-review summary on the same commit', () => {
  const sha = 'a'.repeat(40);
  const summary = { commit_id: sha, body: 'x <!-- skill-review:summary -->' };
  assert.equal(hasSummaryFor([summary], sha), true);
  assert.equal(hasSummaryFor([{ ...summary, commit_id: 'b'.repeat(40) }], sha), false);
  assert.equal(hasSummaryFor([{ commit_id: sha, body: 'human review' }], sha), false);
});

test('invalidFindings names each missing field', () => {
  const ok = { path: 'p', line: 3, rule: 'R', severity: 'should', title: 't', body: 'b' };
  assert.deepEqual(invalidFindings([ok]), []);
  assert.deepEqual(invalidFindings([{ path: 'p', line: 0, rule: 'OV-2', severity: 'high', rule_text: 'x' }]), [
    'finding 0 (OV-2 p): title, body, line (positive integer), severity (must|should|note)',
  ]);
});

const PATCH = `@@ -1,3 +1,4 @@
 line one
-old two
+new two
+added three
 line four
@@ -10,2 +11,2 @@
 ctx eleven
+new twelve`;

test('commentableLines: added and context lines on the RIGHT side', () => {
  assert.deepEqual([...commentableLines(PATCH)], [1, 2, 3, 4, 11, 12]);
  assert.deepEqual([...commentableLines(undefined)], []);
});

const f = (path, line, rule, extra = {}) => ({ path, line, rule, severity: 'should', title: 't', body: 'b', ...extra });

test('plan: inline vs summary vs skipped, merge by path + rule, resolved threads come back', () => {
  const commentable = new Map([['s/SKILL.md', new Set([2, 3])]]);
  const threads = [
    { path: 's/SKILL.md', isResolved: false, body: `x ${marker('SC-1')}` },
    { path: 's/SKILL.md', isResolved: true, body: `x ${marker('BP-A2')}` },
    { path: 's/other.md', isResolved: true, body: 'no marker' },
  ];
  const { inline, summary, skipped } = plan([
    f('s/SKILL.md', 2, 'H2'),
    f('s/SKILL.md', 3, 'H2'),
    f('s/SKILL.md', 3, 'SC-1'),
    f('s/SKILL.md', 2, 'BP-A2'),
    f('s/SKILL.md', 40, 'BP-A9'),
  ], threads, commentable);

  assert.deepEqual(inline.map((x) => [x.rule, x.line, x.also, x.stillPresent]), [
    ['H2', 2, [3], false],
    ['BP-A2', 2, [], true],
  ]);
  assert.deepEqual(summary.map((x) => x.rule), ['BP-A9']);
  assert.deepEqual(skipped.map((x) => [x.rule, x.reason]), [['SC-1', 'already raised in an open thread']]);
});

test('an open thread wins over a resolved one with the same key', () => {
  const threads = [
    { path: 'p', isResolved: true, body: marker('R') },
    { path: 'p', isResolved: false, body: marker('R') },
  ];
  assert.equal(plan([f('p', 1, 'R')], threads, new Map()).skipped.length, 1);
});

test('comment body carries severity, rule, extra lines and the marker', () => {
  const body = commentBody({ ...f('p', 1, 'H2'), also: [4, 9], stillPresent: true });
  assert.match(body, /^_Still present/);
  assert.match(body, /\*\*should\*\* `H2` t/);
  assert.match(body, /Also on lines 4, 9\./);
  assert.ok(body.endsWith(marker('H2')));
});

test('payload is always a COMMENT review with summary marker and outside-diff list', () => {
  const p = reviewPayload(
    { commit: 'a'.repeat(40), summary: 'Summary.' },
    { inline: [{ ...f('p', 1, 'R'), also: [] }], summary: [{ ...f('q', 50, 'S'), also: [] }] },
  );
  assert.equal(p.event, 'COMMENT');
  assert.equal(p.comments.length, 1);
  assert.deepEqual(Object.keys(p.comments[0]), ['path', 'line', 'side', 'body']);
  assert.match(p.body, /### Outside the diff\n\n- `q:50` \*\*should\*\* `S`/);
  assert.ok(p.body.endsWith('<!-- skill-review:summary -->'));
});
