import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, normalise } from '../scripts/check-drift.mjs';

const CLI = fileURLToPath(new URL('../scripts/check-drift.mjs', import.meta.url));

test('normalise ignores line endings and trailing whitespace', () => {
  assert.equal(normalise('a  \r\nb\t\n\n'), 'a\nb');
  assert.equal(hash('a\nb'), hash('a   \r\nb\n'));
  assert.notEqual(hash('a\nb'), hash('a\nc'));
});

test('sources.json is well formed', () => {
  const doc = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
  assert.ok(doc.sources.length > 0);
  const ids = new Set();
  for (const s of doc.sources) {
    assert.match(s.id, /^[a-z0-9-]+$/);
    assert.ok(['anthropic', 'spec', 'extra'].includes(s.layer), s.id);
    assert.match(s.url, /^https:\/\//);
    assert.ok(s.hash === null || /^[0-9a-f]{64}$/.test(s.hash), s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
  }
});

test('CLI against a local server: new → write → unchanged → changed → unreachable', async () => {
  const pages = { '/a': 'alpha', '/b': 'beta' };
  const server = createServer((req, res) => {
    if (pages[req.url] === undefined) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'text/markdown' }).end(pages[req.url]);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [
    { id: 'a', layer: 'anthropic', url: `${base}/a`, hash: null },
    { id: 'b', layer: 'spec', url: `${base}/b`, hash: null },
  ] }));
  // Async spawn: spawnSync would block the event loop the local server runs on.
  const run = (...args) => new Promise((resolve) => {
    const p = spawn(process.execPath, [CLI, '--sources', sources, ...args]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });

  try {
    let r = await run('--json');
    assert.equal(r.code, 1);
    assert.deepEqual(JSON.parse(r.out).sources.map((s) => s.status), ['new', 'new']);

    assert.equal((await run('--write')).code, 0);
    assert.ok(JSON.parse(readFileSync(sources, 'utf8')).sources.every((s) => /^[0-9a-f]{64}$/.test(s.hash)));

    r = await run();
    assert.equal(r.code, 0);
    assert.match(r.out, /up to date \(2 checked\)/);

    pages['/a'] = 'alpha v2';
    delete pages['/b'];
    const save = join(dir, 'changed');
    r = await run('--json', '--save', save);
    assert.equal(r.code, 1);
    const byId = Object.fromEntries(JSON.parse(r.out).sources.map((s) => [s.id, s]));
    assert.equal(byId.a.status, 'changed');
    assert.equal(byId.b.status, 'unreachable');
    assert.equal(byId.b.detail, 'HTTP 404');
    assert.equal(readFileSync(join(save, 'a.md'), 'utf8'), 'alpha v2');
    assert.equal(existsSync(join(save, 'b.md')), false);
  } finally {
    server.close();
  }
});
