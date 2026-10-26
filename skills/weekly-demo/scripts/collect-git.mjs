#!/usr/bin/env node
// Lists the user's commits in every git repo directly under a root folder, inside a time window.
//
// Usage:
//   node collect-git.mjs --root /Users/me/dev/acme --since 2026-10-16T14:00:00Z --author 'first|last'
//
// Prints one block per repo with commits: "== repo" then "  MM-DD hash subject" lines, oldest first.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  if (!args.root || !args.since || !args.author) throw new Error("--root, --since and --author are required");
  return args;
}

function commits(repo, since, author) {
  try {
    const out = execFileSync(
      "git",
      ["-C", repo, "log", "--all", `--since=${since}`, `--author=${author}`, "--regexp-ignore-case",
        "--extended-regexp", "--date=format:%m-%d", "--format=%ad %h %s", "--reverse"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return [...new Set(out.split("\n").filter(Boolean))];
  } catch {
    return [];
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  for (const name of fs.readdirSync(args.root).sort()) {
    const repo = path.join(args.root, name);
    if (!fs.existsSync(path.join(repo, ".git"))) continue;
    const lines = commits(repo, args.since, args.author);
    if (!lines.length) continue;
    console.log(`== ${name}`);
    for (const line of lines) console.log(`  ${line}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
