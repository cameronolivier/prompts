#!/usr/bin/env node
// Builds compact per-session digests of Claude Code transcripts inside a time window,
// then splits them into size-balanced groups for parallel summarising agents.
//
// Usage:
//   node digest-sessions.mjs --since 2026-10-16T14:00:00Z --prefix -Users-me-dev-acme \
//     --out /path/to/digests [--groups 4] [--exclude <session-id>] [--projects ~/.claude/projects]
//
// Prints JSON: { since, sessions: [{ id, file, digest, bytes, firstPrompt, first, last }], groups: [[digestPath]] }

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEPT_TOOLS = new Set(["Artifact", "Bash", "Write", "Edit"]);
const KEPT_INPUT_KEYS = ["action", "file_path", "url", "command", "title", "description"];

export function parseArgs(argv) {
  const args = { groups: 4, projects: path.join(os.homedir(), ".claude", "projects"), exclude: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    const value = argv[i + 1];
    if (key === "exclude") args.exclude.push(value);
    else if (key === "groups") args.groups = Number(value);
    else args[key] = value;
    i++;
  }
  if (!args.since || !args.prefix || !args.out) {
    throw new Error("--since, --prefix and --out are required");
  }
  return args;
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text") parts.push(block.text);
    else if (block.type === "tool_use" && KEPT_TOOLS.has(block.name)) {
      const input = block.input || {};
      const kept = Object.fromEntries(KEPT_INPUT_KEYS.filter((k) => k in input).map((k) => [k, input[k]]));
      parts.push(`[TOOL ${block.name} ${JSON.stringify(kept).slice(0, 300)}]`);
    }
  }
  return parts.join("\n");
}

// Returns { lines, firstPrompt, first, last } for entries at or after `since`.
export function digestLines(jsonlText, since) {
  const lines = [];
  let firstPrompt = "";
  let first = "";
  let last = "";
  for (const raw of jsonlText.split("\n")) {
    if (!raw.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    const { type, timestamp = "" } = entry;
    if ((type !== "user" && type !== "assistant") || entry.isSidechain || timestamp < since) continue;
    const content = entry.message?.content;
    if (Array.isArray(content) && content.some((b) => b?.type === "tool_result")) continue;
    const text = textOf(content).trim();
    if (!text) continue;
    const limit = type === "assistant" ? 4000 : 2500;
    lines.push(`--- ${type} ${timestamp.slice(0, 16)}\n${text.slice(0, limit)}`);
    if (type === "user" && !firstPrompt) firstPrompt = text.slice(0, 160).replace(/\s+/g, " ");
    if (!first) first = timestamp;
    last = timestamp;
  }
  return { lines, firstPrompt, first, last };
}

// Greedy largest-first split into `count` groups of similar total size.
export function balanceGroups(items, count) {
  const groups = Array.from({ length: count }, () => ({ size: 0, items: [] }));
  for (const item of [...items].sort((a, b) => b.bytes - a.bytes)) {
    const smallest = groups.reduce((min, g) => (g.size < min.size ? g : min));
    smallest.items.push(item);
    smallest.size += item.bytes;
  }
  return groups.filter((g) => g.items.length).map((g) => g.items);
}

export function run(args) {
  const sinceMs = Date.parse(args.since);
  if (Number.isNaN(sinceMs)) throw new Error(`--since is not a date: ${args.since}`);
  const since = new Date(sinceMs).toISOString();
  fs.mkdirSync(args.out, { recursive: true });

  const projectDirs = fs
    .readdirSync(args.projects)
    .filter((d) => d.startsWith(args.prefix))
    .map((d) => path.join(args.projects, d));

  const sessions = [];
  for (const dir of projectDirs) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".jsonl")) continue;
      const id = name.replace(/\.jsonl$/, "");
      if (args.exclude.includes(id)) continue;
      const file = path.join(dir, name);
      if (fs.statSync(file).mtimeMs < sinceMs) continue;
      const result = digestLines(fs.readFileSync(file, "utf8"), since);
      if (!result.lines.length) continue;
      const digest = path.join(args.out, `${id}.txt`);
      const body = result.lines.join("\n");
      fs.writeFileSync(digest, body);
      sessions.push({ id, file, digest, bytes: Buffer.byteLength(body), ...result, lines: undefined });
    }
  }

  const groups = balanceGroups(sessions, Math.max(1, args.groups)).map((g) => g.map((s) => s.digest));
  return { since, sessions, groups };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
