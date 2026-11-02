import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const template = readFileSync(fileURLToPath(new URL("../deck-template.html", import.meta.url)), "utf8");

test("has the placeholders the skill fills", () => {
  assert.equal(template.match(/\{\{TITLE\}\}/g).length, 2);
  assert.equal(template.match(/<!-- SLIDES -->/g).length, 1);
  assert.match(template.slice(0, 8192), /<title>/);
});

test("has no document skeleton (the Artifact tool adds it)", () => {
  assert.doesNotMatch(template, /<!doctype|<html|<head|<body/i);
});

test("inline script parses", () => {
  const scripts = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
});

