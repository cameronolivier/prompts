import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const SOURCE = new URL('../../voice-rules/SKILL.md', import.meta.url);
const FALLBACK = new URL('../voice-fallback.md', import.meta.url);

// The rule sections run from "Which set applies" up to the next section after "Human rules".
const ruleSections = (text) => text.slice(text.indexOf('## Which set applies'), text.indexOf('## Lint') > 0 ? text.indexOf('## Lint') : undefined).trim();

test('voice-fallback.md matches the voice-rules rule sections', { skip: !existsSync(SOURCE) && 'voice-rules not beside this skill' }, () => {
  assert.equal(ruleSections(readFileSync(FALLBACK, 'utf8')), ruleSections(readFileSync(SOURCE, 'utf8')));
});
