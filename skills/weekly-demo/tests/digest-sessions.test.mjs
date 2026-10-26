import { test } from "node:test";
import assert from "node:assert/strict";
import { digestLines, balanceGroups } from "../scripts/digest-sessions.mjs";

const since = "2026-10-16T14:00:00.000Z";
const line = (obj) => JSON.stringify(obj);

test("keeps in-window user and assistant text, drops the rest", () => {
  const jsonl = [
    line({ type: "user", timestamp: "2026-10-15T10:00:00Z", message: { content: "too early" } }),
    line({ type: "user", timestamp: "2026-10-17T09:00:00Z", message: { content: "retire the database" } }),
    line({ type: "assistant", timestamp: "2026-10-17T09:01:00Z", isSidechain: true, message: { content: [{ type: "text", text: "sidechain" }] } }),
    line({ type: "user", timestamp: "2026-10-17T09:02:00Z", message: { content: [{ type: "tool_result", content: "noise" }] } }),
    line({
      type: "assistant",
      timestamp: "2026-10-17T09:03:00Z",
      message: { content: [{ type: "text", text: "Done." }, { type: "tool_use", name: "Bash", input: { command: "gcloud sql instances list", description: "List" } }, { type: "tool_use", name: "Grep", input: { pattern: "x" } }] },
    }),
    line({ type: "system", timestamp: "2026-10-17T09:04:00Z" }),
    "not json",
  ].join("\n");

  const result = digestLines(jsonl, since);
  assert.equal(result.lines.length, 2);
  assert.equal(result.firstPrompt, "retire the database");
  assert.match(result.lines[1], /\[TOOL Bash .*gcloud sql instances list/);
  assert.doesNotMatch(result.lines.join("\n"), /too early|sidechain|noise|Grep/);
  assert.equal(result.first, "2026-10-17T09:00:00Z");
  assert.equal(result.last, "2026-10-17T09:03:00Z");
});

test("balances groups by size, largest first", () => {
  const items = [{ bytes: 10 }, { bytes: 9 }, { bytes: 5 }, { bytes: 4 }, { bytes: 1 }];
  const groups = balanceGroups(items, 2);
  const sizes = groups.map((g) => g.reduce((n, i) => n + i.bytes, 0)).sort((a, b) => a - b);
  assert.deepEqual(sizes, [14, 15]);
});

test("drops empty groups when there are fewer items than groups", () => {
  assert.equal(balanceGroups([{ bytes: 3 }], 4).length, 1);
});
