import { test } from "node:test";
import assert from "node:assert/strict";
import { projectPrefixFor, githubOwnerOf, mostCommon } from "../scripts/detect-project.mjs";

test("encodes a project path the way Claude Code names history folders", () => {
  assert.equal(projectPrefixFor("/Users/me/dev/acme"), "-Users-me-dev-acme");
  assert.equal(projectPrefixFor("/Users/me/dev/acme.io"), "-Users-me-dev-acme-io");
});

test("reads the owner from SSH and HTTPS GitHub remotes", () => {
  assert.equal(githubOwnerOf("git@github.com:Acme-Inc/api.git"), "Acme-Inc");
  assert.equal(githubOwnerOf("https://github.com/Acme-Inc/web.git"), "Acme-Inc");
  assert.equal(githubOwnerOf("https://gitlab.com/acme/web.git"), "");
});

test("picks the most common non-empty value", () => {
  assert.equal(mostCommon(["a", "", "b", "a"]), "a");
  assert.equal(mostCommon([""]), "");
});
