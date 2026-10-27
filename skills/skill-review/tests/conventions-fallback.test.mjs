import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const SOURCE = new URL('../../skill-conventions/SKILL.md', import.meta.url);
const FALLBACK = new URL('../conventions-fallback.md', import.meta.url);

// The numbered sections run from "## 1." up to the checklist; the fallback adds only a header and contents list.
const sections = (text) => {
  const start = text.indexOf('## 1. ');
  const end = text.indexOf('## Checklist before shipping a skill');
  return text.slice(start, end > 0 ? end : undefined).trim();
};

test('conventions-fallback.md matches the skill-conventions sections', { skip: !existsSync(SOURCE) && 'skill-conventions not beside this skill' }, () => {
  assert.equal(sections(readFileSync(FALLBACK, 'utf8')), sections(readFileSync(SOURCE, 'utf8')));
});
