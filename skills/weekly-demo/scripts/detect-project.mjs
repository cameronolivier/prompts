#!/usr/bin/env node
// Works out a weekly-demo config entry from a project folder, so a new project needs no manual setup.
//
// Usage:
//   node detect-project.mjs --path /Users/me/dev/acme
//
// Prints JSON: { name, projectPrefix, reposRoot, authorPattern, githubOwner, footer, repos }
// The caller asks the user for anything left empty (for example a Jira project key) and saves the entry.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Claude Code names a project's history folder after its path, with "/" and "." replaced by "-".
export function projectPrefixFor(dir) {
  return path.resolve(dir).replace(/[/.]/g, "-");
}

// Returns the owner part of a GitHub remote URL (SSH or HTTPS), or "".
export function githubOwnerOf(url) {
  const match = url.match(/github\.com[:/]([^/]+)\//);
  return match ? match[1] : "";
}

export function mostCommon(values) {
  const counts = new Map();
  for (const v of values.filter(Boolean)) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function git(repo, args) {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// The folder itself when it is a repo, else every repo directly under it.
export function reposUnder(root) {
  if (fs.existsSync(path.join(root, ".git"))) return [root];
  return fs
    .readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((dir) => fs.existsSync(path.join(dir, ".git")));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detect(dir) {
  const root = path.resolve(dir);
  if (!fs.existsSync(root)) throw new Error(`No such folder: ${root}`);
  const repos = reposUnder(root);
  const owners = repos.map((repo) => githubOwnerOf(git(repo, ["remote", "get-url", "origin"])));
  const probe = repos[0] || root;
  const authors = [git(probe, ["config", "user.name"]), git(probe, ["config", "user.email"])]
    .filter(Boolean)
    .map(escapeRegex);
  const name = path.basename(root).toLowerCase();
  return {
    name,
    projectPrefix: projectPrefixFor(root),
    reposRoot: root,
    authorPattern: authors.join("|"),
    githubOwner: mostCommon(owners),
    footer: path.basename(root).toUpperCase(),
    repos: repos.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const i = process.argv.indexOf("--path");
    if (i === -1 || !process.argv[i + 1]) throw new Error("--path is required");
    console.log(JSON.stringify(detect(process.argv[i + 1]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
