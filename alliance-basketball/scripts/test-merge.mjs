import { build } from "esbuild";
import assert from "node:assert/strict";
await build({
  entryPoints: ["lib/merge.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/merge-test.mjs",
});
const { mergeWorkspace } = await import("../.sites-runtime/merge-test.mjs");
const E = await import("../.sites-runtime/engine-test.mjs");
const base = E.initialState();
base.teams.forEach(
  (t, i) => (t.players = [{ id: "p" + i, name: "P" + i, number: "1" }]),
);
const t = base.tournaments[0];
E.generate(t);
const g = t.games[0];
E.recordTeamEvent(base, t, g, 0, "points", 2, "main");
const local = E.copy(base),
  remote = E.copy(base);
E.recordTeamEvent(
  local,
  local.tournaments[0],
  local.tournaments[0].games[0],
  0,
  "points",
  3,
  "main",
);
const rg = remote.tournaments[0].games[0];
E.assignEvent(
  remote,
  remote.tournaments[0],
  rg,
  rg.events[0].id,
  rg.rosters[0].players[0].id,
);
const merged = mergeWorkspace(base, local, remote);
assert.equal(E.total(merged.tournaments[0].games[0], 0), 5);
assert.equal(
  merged.tournaments[0].games[0].events.find((e) => e.id === rg.events[0].id)
    .player,
  rg.rosters[0].players[0].id,
);
const deletion = E.copy(base);
deletion.tournaments[0].games[0].events = [];
assert.throws(() => mergeWorkspace(base, deletion, remote), /Both operators/);
const a = E.copy(base),
  b = E.copy(base);
a.tournaments[0].name = "A";
b.tournaments[0].name = "B";
assert.throws(() => mergeWorkspace(base, a, b), /Both operators/);
const assignedAgain = mergeWorkspace(base, local, merged);
assert.equal(E.total(assignedAgain.tournaments[0].games[0], 0), 5);
console.log(
  "PASS: score plus concurrent assignment, preserved total, deletion conflict, same-field conflict, idempotent merge.",
);
