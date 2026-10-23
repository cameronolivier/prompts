#!/usr/bin/env node
// Deterministic checks for the voice-rules skill. Zero dependencies.
//
// Usage:
//   voice-lint.mjs [--json] [--audience auto|agent|human] <file|->...
//
// Exit: 0 no errors (notes allowed), 1 at least one error, 2 usage.

import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const words = (list) => new RegExp(`\\b(${list.join('|')})\\b`, 'i');

const AI_VOCAB = words([
  'delve[sd]?', 'delving', 'crucial', 'pivotal', 'robust', 'seamless(?:ly)?', 'tapestry',
  'testament', 'underscores?', 'showcas(?:e|es|ing)', 'fostering', 'garner', 'intricate',
  'interplay', 'vibrant', 'enhance[sd]?', 'additionally',
]);

const PLAIN_WORDS = [
  [/\butili[sz](e|es|ed|ing)\b/i, 'use'],
  [/\bleverag(e|es|ed|ing)\b/i, 'use'],
  [/\bfacilitat(e|es|ed|ing)\b/i, 'help'],
  [/\bnumerous\b/i, 'many'],
  [/\bcommenc(e|es|ed|ing)\b/i, 'start'],
  [/\binitiat(e|es|ed|ing)\b/i, 'start'],
  [/\bsufficient\b/i, 'enough'],
  [/\bprior to\b/i, 'before'],
  [/\bin the event that\b/i, 'if'],
];

const FILLER = words([
  'in order to', "it(?:'s| is) worth noting", 'it is important to note', 'due to the fact that',
  'as previously mentioned', 'needless to say', 'at the end of the day', 'could potentially',
]);

const CHATBOT = words([
  'great question', 'i hope this helps', 'let me know if', "you're absolutely right",
  'happy to help', 'certainly!', 'of course!',
]);

const PASSIVE = /\b(is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|built|done|made|given|taken|written|shown|known|seen|sent|kept|held|found)\b/i;
const SHOUT = /\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT|DO NOT)\b/;

// rule → [voice-rules ID, audiences it applies to, severity]
const RULES = {
  'em-dash': ['H2', ['human'], 'error'],
  'ai-vocab': ['H3', ['human'], 'error'],
  'plain-word': ['H3', ['human'], 'note'],
  filler: ['H7/A9', ['human', 'agent'], 'note'],
  chatbot: ['H8', ['human'], 'error'],
  'curly-quote': ['H9', ['human', 'agent'], 'error'],
  'heading-emoji': ['H9', ['human'], 'error'],
  passive: ['H5', ['human'], 'note'],
  'long-sentence': ['H6', ['human'], 'note'],
  shouting: ['A7', ['agent'], 'note'],
};

export function audienceFor(path) {
  const name = basename(path).toLowerCase();
  if (name.startsWith('readme') || name.includes('template') || name.includes('comment-format') || name.endsWith('.txt')) {
    return 'human';
  }
  return 'agent';
}

// Lines a reader sees as prose: drops frontmatter, code fences and tables; masks inline code.
function proseLines(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let fence = null;
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const marker = line.match(/^\s*(```|~~~)/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1] === fence) fence = null;
      continue;
    }
    if (fence || /^\s*\|/.test(line)) continue;
    out.push({ n: i + 1, text: line.replace(/`[^`]*`/g, '``') });
  }
  return out;
}

export function lint(text, audience) {
  const findings = [];
  const add = (rule, line, excerpt, extra = '') => {
    const [id, audiences, severity] = RULES[rule];
    if (!audiences.includes(audience)) return;
    findings.push({ rule, id, severity, line, excerpt: excerpt.trim().slice(0, 120), ...(extra && { suggest: extra }) });
  };
  const shouts = [];

  for (const { n, text: line } of proseLines(text)) {
    if (/—|\s–\s/.test(line)) add('em-dash', n, line);
    const vocab = line.match(AI_VOCAB);
    if (vocab) add('ai-vocab', n, vocab[0]);
    for (const [re, plain] of PLAIN_WORDS) {
      const m = line.match(re);
      if (m) add('plain-word', n, m[0], plain);
    }
    const filler = line.match(FILLER);
    if (filler) add('filler', n, filler[0]);
    const chat = line.match(CHATBOT);
    if (chat) add('chatbot', n, chat[0]);
    if (/[“”‘’]/.test(line)) add('curly-quote', n, line);
    if (/^#{1,6}\s/.test(line) && /\p{Extended_Pictographic}/u.test(line)) add('heading-emoji', n, line);
    const passive = line.match(PASSIVE);
    if (passive) add('passive', n, passive[0]);
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const count = sentence.split(/\s+/).filter((w) => /\w/.test(w)).length;
      if (count > 30) add('long-sentence', n, sentence, `${count} words`);
    }
    if (SHOUT.test(line)) shouts.push({ n, line });
  }
  if (shouts.length >= 3) for (const { n, line } of shouts) add('shouting', n, line);

  return findings.sort((a, b) => a.line - b.line);
}

function main(argv) {
  let json = false;
  let audience = 'auto';
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--audience') audience = argv[++i];
    else if (arg === '-h' || arg === '--help') {
      console.log('usage: voice-lint.mjs [--json] [--audience auto|agent|human] <file|->...');
      return 0;
    } else files.push(arg);
  }
  if (!files.length || !['auto', 'agent', 'human'].includes(audience)) {
    console.error('usage: voice-lint.mjs [--json] [--audience auto|agent|human] <file|->...');
    return 2;
  }

  const results = files.map((file) => {
    const text = readFileSync(file === '-' ? 0 : file, 'utf8');
    const aud = audience === 'auto' ? (file === '-' ? 'human' : audienceFor(file)) : audience;
    return { file, audience: aud, findings: lint(text, aud) };
  });

  if (json) console.log(JSON.stringify(results, null, 2));
  else {
    for (const { file, audience: aud, findings } of results) {
      if (!findings.length) { console.log(`${file} (${aud}): clean`); continue; }
      for (const f of findings) {
        console.log(`${file}:${f.line} ${f.rule} [${f.id} ${f.severity}] ${f.excerpt}${f.suggest ? ` → ${f.suggest}` : ''}`);
      }
    }
  }
  return results.some((r) => r.findings.some((f) => f.severity === 'error')) ? 1 : 0;
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = main(process.argv.slice(2));
