#!/usr/bin/env node
// Has any best-practice source changed since best-practice.md was distilled?
// Zero dependencies, no model. Used by `/skill-review --check`, `--update`, and CI.
//
// Usage:
//   check-drift.mjs [--json] [--write] [--sources <path>] [--save <dir>]
//
//   --write    store the current hashes in sources.json (after best-practice.md is refreshed)
//   --save     write each changed source's fetched text to <dir>/<id>.md for the update step
//   --sources  defaults to ../sources.json beside this script
//
// Exit: 0 all unchanged, 1 drift (changed, new or unreachable), 2 usage.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCES = join(dirname(dirname(fileURLToPath(import.meta.url))), 'sources.json');

// Whitespace-only edits upstream should not raise drift.
export function normalise(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}

export const hash = (text) => createHash('sha256').update(normalise(text)).digest('hex');

export async function checkSources(sources, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  return Promise.all(sources.map(async (src) => {
    try {
      const res = await fetchImpl(src.url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) return { ...src, status: 'unreachable', detail: `HTTP ${res.status}` };
      const text = await res.text();
      const current = hash(text);
      const status = !src.hash ? 'new' : src.hash === current ? 'unchanged' : 'changed';
      return { ...src, status, current, text };
    } catch (err) {
      return { ...src, status: 'unreachable', detail: err.name === 'TimeoutError' ? 'timeout' : err.message };
    }
  }));
}

async function main(argv) {
  let json = false;
  let write = false;
  let save = null;
  let sourcesPath = DEFAULT_SOURCES;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') json = true;
    else if (argv[i] === '--write') write = true;
    else if (argv[i] === '--save') save = argv[++i];
    else if (argv[i] === '--sources') sourcesPath = argv[++i];
    else {
      console.error('usage: check-drift.mjs [--json] [--write] [--sources <path>] [--save <dir>]');
      return 2;
    }
  }

  const doc = JSON.parse(readFileSync(sourcesPath, 'utf8'));
  const results = await checkSources(doc.sources);
  const drift = results.filter((r) => r.status !== 'unchanged');

  if (save) {
    mkdirSync(save, { recursive: true });
    for (const r of drift.filter((d) => d.text)) writeFileSync(join(save, `${r.id}.md`), r.text);
  }
  if (write) {
    const byId = Object.fromEntries(results.filter((r) => r.current).map((r) => [r.id, r.current]));
    doc.sources = doc.sources.map((s) => (byId[s.id] ? { ...s, hash: byId[s.id] } : s));
    writeFileSync(sourcesPath, `${JSON.stringify(doc, null, 2)}\n`);
  }

  const report = results.map(({ id, layer, url, status, detail }) => ({ id, layer, url, status, ...(detail && { detail }) }));
  const unreachable = report.filter((r) => r.status === 'unreachable');
  if (json) console.log(JSON.stringify({ drift: drift.length > 0, sources: report }, null, 2));
  else if (write) {
    console.log(`stored hashes for ${results.length - unreachable.length} of ${results.length} sources in ${sourcesPath}`);
    // A source that could not be read keeps its old hash; say so and fail, so the update does not ship as complete.
    if (unreachable.length) console.error(`not stored (unreachable): ${unreachable.map((r) => `${r.id} (${r.detail})`).join(', ')}`);
  } else if (!drift.length) console.log(`best-practice sources up to date (${results.length} checked)`);
  else for (const r of report.filter((x) => x.status !== 'unchanged')) console.log(`${r.status.padEnd(11)} ${r.id}  ${r.url}${r.detail ? `  (${r.detail})` : ''}`);

  if (write) return unreachable.length ? 1 : 0;
  return drift.length ? 1 : 0;
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = await main(process.argv.slice(2));
