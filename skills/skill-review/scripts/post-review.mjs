#!/usr/bin/env node
// Post a skill-review as one GitHub review: inline comments plus a summary. Zero dependencies.
//
// Usage:
//   post-review.mjs <review.json> [--dry-run]
//
// review.json:
//   { "repo": "owner/name", "pr": 42, "commit": "<head sha>", "summary": "<markdown>",
//     "findings": [ { "path", "line", "rule", "severity", "title", "body" } ] }
//
// Rules:
//   - Event is always COMMENT: a bot review never approves or blocks.
//   - Dedupe by path + rule against existing skill-review threads (one GraphQL call).
//     Open thread → skip. Resolved thread → post again, marked "still present".
//   - A line outside the diff cannot take an inline comment (HTTP 422), so it goes in the summary.
//
// Exit: 0 posted (or dry run), 1 gh failure, 2 usage.

import { readFileSync, realpathSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const marker = (rule) => `<!-- skill-review:${rule} -->`;
const MARKER_RE = /<!-- skill-review:([^ ]+) -->/;
const SUMMARY_MARKER = '<!-- skill-review:summary -->';

// RIGHT-side line numbers a review comment may target, from a unified-diff patch.
export function commentableLines(patch = '') {
  const lines = new Set();
  let n = 0;
  for (const row of patch.split('\n')) {
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { n = Number(hunk[1]); continue; }
    if (!row.startsWith('+') && !row.startsWith(' ')) continue;
    lines.add(n);
    n++;
  }
  return lines;
}

// Merge same path + rule, then sort each into inline / summary / skipped.
export function plan(findings, threads, commentable) {
  const merged = new Map();
  for (const f of findings) {
    const key = `${f.path}\u0000${f.rule}`;
    const prev = merged.get(key);
    if (prev) prev.also.push(f.line);
    else merged.set(key, { ...f, also: [] });
  }
  const existing = new Map();
  for (const t of threads) {
    const rule = t.body.match(MARKER_RE)?.[1];
    if (!rule) continue;
    const key = `${t.path}\u0000${rule}`;
    // An open thread wins over a resolved one for the same key.
    if (!existing.has(key) || !t.isResolved) existing.set(key, t.isResolved ? 'resolved' : 'open');
  }

  const inline = [];
  const summary = [];
  const skipped = [];
  for (const [key, f] of merged) {
    const state = existing.get(key);
    if (state === 'open') { skipped.push({ ...f, reason: 'already raised in an open thread' }); continue; }
    const out = { ...f, stillPresent: state === 'resolved' };
    if (commentable.get(f.path)?.has(f.line)) inline.push(out);
    else summary.push(out);
  }
  return { inline, summary, skipped };
}

export function commentBody(f) {
  const lead = f.stillPresent ? '_Still present after the earlier thread was resolved._\n\n' : '';
  const also = f.also.length ? `\n\nAlso on line${f.also.length > 1 ? 's' : ''} ${f.also.join(', ')}.` : '';
  return `${lead}**${f.severity}** \`${f.rule}\` ${f.title}\n\n${f.body}${also}\n\n${marker(f.rule)}`;
}

export function reviewPayload(review, { inline, summary }) {
  const outside = summary.length
    ? `\n\n### Outside the diff\n\n${summary.map((f) => `- \`${f.path}:${f.line}\` **${f.severity}** \`${f.rule}\` ${f.title}${f.stillPresent ? ' (still present)' : ''}. ${f.body.replace(/\n+/g, ' ')}`).join('\n')}`
    : '';
  return {
    commit_id: review.commit,
    event: 'COMMENT',
    body: `${review.summary}${outside}\n\n${SUMMARY_MARKER}`,
    comments: inline.map((f) => ({ path: f.path, line: f.line, side: 'RIGHT', body: commentBody(f) })),
  };
}

function gh(args, input) {
  const r = spawnSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}

function fetchThreads(repo, pr) {
  const [owner, name] = repo.split('/');
  const query = `query($owner:String!,$name:String!,$pr:Int!){repository(owner:$owner,name:$name){pullRequest(number:$pr){reviewThreads(first:100){nodes{isResolved path comments(first:1){nodes{body}}}}}}}`;
  const out = JSON.parse(gh(['api', 'graphql', '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `pr=${pr}`, '-f', `query=${query}`]));
  return out.data.repository.pullRequest.reviewThreads.nodes.map((t) => ({
    isResolved: t.isResolved,
    path: t.path,
    body: t.comments.nodes[0]?.body || '',
  }));
}

function fetchCommentable(repo, pr) {
  const files = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/pulls/${pr}/files?per_page=100`])).flat();
  return new Map(files.map((f) => [f.filename, commentableLines(f.patch)]));
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { console.error('usage: post-review.mjs <review.json> [--dry-run]'); return 2; }
  const review = JSON.parse(readFileSync(file, 'utf8'));
  if (!/^[\w.-]+\/[\w.-]+$/.test(review.repo || '') || !Number.isInteger(review.pr) || !/^[0-9a-f]{40}$/.test(review.commit || '')) {
    console.error('review.json needs repo "owner/name", integer pr, and a 40-hex commit');
    return 2;
  }

  try {
    const result = plan(review.findings || [], fetchThreads(review.repo, review.pr), fetchCommentable(review.repo, review.pr));
    const payload = reviewPayload(review, result);
    const counts = `inline ${result.inline.length}, summary ${result.summary.length}, skipped ${result.skipped.length}`;
    if (dryRun) {
      console.log(JSON.stringify({ counts, payload, skipped: result.skipped }, null, 2));
      return 0;
    }
    const payloadFile = join(mkdtempSync(join(tmpdir(), 'skill-review-')), 'payload.json');
    writeFileSync(payloadFile, JSON.stringify(payload));
    const posted = JSON.parse(gh(['api', '-X', 'POST', `repos/${review.repo}/pulls/${review.pr}/reviews`, '--input', payloadFile]));
    console.log(`posted review ${posted.html_url} (${counts})`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = main(process.argv.slice(2));
