#!/usr/bin/env node
// Deterministic checks for the voice-rules skill. Zero dependencies, Node 18+.
//
// Usage:
//   voice-lint.mjs [--json] [--audience auto|agent|human] <file|->...
//
// Exit: 0 no errors (notes allowed), 1 at least one error, 2 usage or unreadable file.

import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Words that only read as AI tells. `(?![\w])` instead of a trailing \b so entries may end in punctuation.
const phrase = (list) => new RegExp(`\\b(${list.join('|')})(?!\\w)`, 'gi');

const AI_VOCAB = phrase(['delve[sd]?', 'delving', 'crucial', 'pivotal', 'robust', 'seamless(?:ly)?', 'tapestry', 'interplay', 'vibrant', 'showcas(?:e|es|ing)', 'fostering', 'intricate', 'additionally']);
// Same tell, but with a common literal meaning (an underscore character, an "enhanced" mode): a reader decides.
const AI_VOCAB_SOFT = phrase(['underscores?', 'enhance[sd]?', 'garner(?:s|ed)?', 'testament']);

const PLAIN_WORDS = [
  [/\butili[sz](e|es|ed|ing)\b/gi, 'use'],
  [/\bleverag(e|es|ed|ing)\b/gi, 'use'],
  [/\bfacilitat(e|es|ed|ing)\b/gi, 'help'],
  [/\bnumerous\b/gi, 'many'],
  [/\bcommenc(e|es|ed|ing)\b/gi, 'start'],
  [/\binitiat(e|es|ed|ing)\b/gi, 'start'],
  [/\bsufficient\b/gi, 'enough'],
  [/\bprior to\b/gi, 'before'],
  [/\bin the event that\b/gi, 'if'],
];

const FILLER = phrase(['in order to', "it(?:'s| is) worth noting", 'it is important to note', 'due to the fact that', 'as previously mentioned', 'needless to say', 'at the end of the day', 'could potentially']);
const CHATBOT = phrase(['great question', 'i hope this helps', 'let me know if', "you're absolutely right", 'happy to help', 'certainly!', 'of course!']);
const PASSIVE = /\b(is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|built|done|made|given|taken|written|shown|known|seen|sent|kept|held|found)\b/gi;
const SHOUT = /\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT|DO NOT)\b/g;
const LONG_SENTENCE = 30; // words; H6 aims under 20, so 30 flags only clear outliers

// rule → [voice-rules ID, audiences it applies to, severity]
const RULES = {
  'em-dash': ['H2', ['human'], 'error'],
  'ai-vocab': ['H3', ['human'], 'error'],
  'ai-vocab-soft': ['H3', ['human'], 'note'],
  'plain-word': ['H3', ['human'], 'note'],
  filler: ['H7/A9', ['human', 'agent'], 'note'],
  chatbot: ['H8', ['human'], 'error'],
  'curly-quote': ['H9', ['human'], 'error'],
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

// Paragraphs a reader sees as prose: drops frontmatter, code fences and tables; masks inline code.
// A paragraph ends at a blank line, a heading or a list item, so hard-wrapped sentences stay whole.
// Each block keeps `starts`: the text offset where each source line begins, to map a match back to its line.
export function proseBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let block = null;
  let fence = null;
  const close = () => { if (block) blocks.push(block); block = null; };

  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      close();
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence || /^\s*\|/.test(line) || line.trim() === '') { close(); continue; }
    const heading = /^#{1,6}\s/.test(line);
    if (heading || /^\s*([-*+]|\d+[.)])\s/.test(line)) close();
    if (!block) block = { text: '', starts: [], lines: [], heading };
    block.starts.push(block.text.length ? block.text.length + 1 : 0);
    block.lines.push(i + 1);
    block.text += (block.text ? ' ' : '') + line.trim();
    if (heading) close();
  }
  close();
  for (const b of blocks) b.text = b.text.replace(/`[^`]*`/g, (m) => '`'.padEnd(m.length - 1, ' ') + '`');
  return blocks;
}

const lineAt = (block, index) => {
  let n = block.lines[0];
  for (let k = 0; k < block.starts.length && block.starts[k] <= index; k++) n = block.lines[k];
  return n;
};

export function lint(text, audience) {
  const findings = [];
  const add = (rule, line, excerpt, extra = '') => {
    const [id, audiences, severity] = RULES[rule];
    if (!audiences.includes(audience)) return;
    findings.push({ rule, id, severity, line, excerpt: excerpt.trim().slice(0, 120), ...(extra && { suggest: extra }) });
  };
  const scan = (block, re, rule, suggest) => {
    for (const m of block.text.matchAll(re)) add(rule, lineAt(block, m.index), m[0], suggest);
  };
  const shouts = [];

  for (const block of proseBlocks(text)) {
    scan(block, /—|\s–\s/g, 'em-dash');
    scan(block, AI_VOCAB, 'ai-vocab');
    scan(block, AI_VOCAB_SOFT, 'ai-vocab-soft');
    for (const [re, plain] of PLAIN_WORDS) scan(block, re, 'plain-word', plain);
    scan(block, FILLER, 'filler');
    scan(block, CHATBOT, 'chatbot');
    scan(block, /[“‘][^“”‘’]{0,80}[”’]|[“”‘’]/g, 'curly-quote');
    scan(block, PASSIVE, 'passive');
    if (block.heading && /\p{Extended_Pictographic}/u.test(block.text)) add('heading-emoji', block.lines[0], block.text);
    let offset = 0;
    for (const sentence of block.text.split(/(?<=[.!?])\s+/)) {
      const at = block.text.indexOf(sentence, offset);
      offset = at + sentence.length;
      const count = sentence.split(/\s+/).filter((w) => /\w/.test(w)).length;
      if (count > LONG_SENTENCE) add('long-sentence', lineAt(block, at), sentence, `${count} words`);
    }
    for (const m of block.text.matchAll(SHOUT)) shouts.push({ line: lineAt(block, m.index), word: m[0] });
  }
  if (shouts.length >= 3) for (const { line, word } of shouts) add('shouting', line, word);

  return findings.sort((a, b) => a.line - b.line);
}

const USAGE = 'usage: voice-lint.mjs [--json] [--audience auto|agent|human] <file|->...';

function main(argv) {
  let json = false;
  let audience = 'auto';
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--audience') audience = argv[++i];
    else if (arg === '-h' || arg === '--help') { console.log(USAGE); return 0; }
    else files.push(arg);
  }
  if (!['auto', 'agent', 'human'].includes(audience)) {
    console.error(`voice-lint: --audience must be auto, agent or human (got ${audience ?? 'nothing'})`);
    return 2;
  }
  if (!files.length) { console.error(USAGE); return 2; }

  const results = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file === '-' ? 0 : file, 'utf8');
    } catch (err) {
      console.error(`voice-lint: cannot read ${file}: ${err.code || err.message}`);
      return 2;
    }
    const aud = audience === 'auto' ? (file === '-' ? 'human' : audienceFor(file)) : audience;
    results.push({ file, audience: aud, findings: lint(text, aud) });
  }

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
