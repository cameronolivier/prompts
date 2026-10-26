#!/usr/bin/env node
// Lists commits inside a time window, for one repo or every repo directly under a folder.
//
// Usage:
//   node collect-git.mjs --root /Users/me/dev/acme --since 2026-10-16T14:00:00Z --author 'first|last'
//   node collect-git.mjs --root /Users/me/dev/acme --since 2026-10-16T14:00:00Z --team
//
// --author keeps only the user's commits. --team keeps every author and adds the author name to each line.
// Prints one block per repo with commits: "== repo" then "  MM-DD hash [author] subject" lines, oldest first.

import path from "node:path";
import { execFileSync } from "node:child_process";
import { reposUnder } from "./detect-project.mjs";

function parseArgs(argv) {
  const args = { team: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "team") args.team = true;
    else args[key] = argv[++i];
  }
  if (!args.root || !args.since || (!args.author && !args.team)) {
    throw new Error("--root, --since and one of --author or --team are required");
  }
  return args;
}

function commits(repo, { since, author, team }) {
  const gitArgs = ["-C", repo, "log", "--all", `--since=${since}`, "--date=format:%m-%d", "--reverse"];
  // Team mode skips merge commits and bots; in the user's own mode a merge they made is their work.
  if (team) gitArgs.push("--no-merges", "--format=%ad %h [%an] %s");
  else gitArgs.push(`--author=${author}`, "--regexp-ignore-case", "--extended-regexp", "--format=%ad %h %s");
  try {
    const out = execFileSync("git", gitArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const lines = out.split("\n").filter(Boolean).filter((line) => !team || !/\[[^\]]*\[bot\]\]/.test(line));
    return [...new Set(lines)];
  } catch {
    return [];
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  for (const repo of reposUnder(path.resolve(args.root)).sort()) {
    const lines = commits(repo, args);
    if (!lines.length) continue;
    console.log(`== ${path.basename(repo)}`);
    for (const line of lines) console.log(`  ${line}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
