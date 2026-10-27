import { build } from "esbuild";
import assert from "node:assert/strict";
await build({
  entryPoints: ["lib/engine.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/engine-test.mjs",
});
const E = await import("../.sites-runtime/engine-test.mjs");
const team = (i) => ({
  id: "t" + i,
  name: "Team " + i,
  players: [{ id: "p" + i, name: "Player " + i, number: "1" }],
});
for (let n = 2; n <= 64; n++) {
  const teams = Array.from({ length: n }, (_, i) => team(i));
  for (const mode of ["knockout", "league", "combined"]) {
    if ((mode === "league" && n > 32) || (mode === "combined" && n < 3))
      continue;
    const t = E.newTournament(
      "Test",
      "2026-10-07",
      teams.map((t) => t.id),
    );
    t.mode = mode;
    t.finalists = Math.max(2, Math.min(4, n - 1));
    E.generate(t);
    const expected =
      mode === "knockout"
        ? n - 1
        : mode === "league"
          ? (n * (n - 1)) / 2
          : n - t.finalists + (t.finalists * (t.finalists - 1)) / 2;
    assert.equal(t.games.length, expected, mode + " n=" + n);
    const s = {
      version: 2,
      teams,
      tournaments: [t],
      reports: [],
      staffEmails: [],
    };
    E.assertState(s);
    for (const g of t.games) {
      const both = E.matchTeams(s, t, g);
      assert.ok(both[0] && both[1]);
      assert.notEqual(both[0].id, both[1].id);
      E.startMatch(s, t, g, "tester");
      g.lineups[0] = [both[0].players[0].id];
      E.recordEvent(s, t, g, 0, both[0].players[0].id, "points", 2, "tester");
      E.finish(s, t, g);
    }
    E.assertState(s);
    assert.equal(s.reports.length, expected);
    if (mode !== "knockout") {
      const rows = E.standingRows(s, t);
      assert.equal(rows.length, mode === "combined" ? t.finalists : n);
      assert.ok(
        rows.every(
          (r) => r.played === (mode === "combined" ? t.finalists - 1 : n - 1),
        ),
      );
    }
  }
}
// Ten entered teams, independent of what the app's empty starting state contains.
const seeded = () => {
  const s = E.initialState();
  s.teams = Array.from({ length: 10 }, (_, i) => ({
    id: "team" + i,
    name: "Team " + i,
    players: [],
  }));
  s.tournaments[0].teamIds = s.teams.map((x) => x.id);
  return s;
};
// Specific score/foul integrity, tie rejection, snapshots and invalidation.
const s = seeded();
s.teams.forEach(
  (t, i) => (t.players = [{ id: "p" + i, name: "P" + i, number: "1" }]),
);
const t = s.tournaments[0];
E.generate(t);
const g = t.games[0];
E.startMatch(s, t, g, "test");
const p = g.rosters[0].players[0].id;
g.lineups[0] = [p];
assert.throws(() => E.finish(s, t, g), /tied/);
E.recordEvent(s, t, g, 0, p, "points", 3, "test");
for (let i = 0; i < 5; i++) E.recordEvent(s, t, g, 0, p, "foul", 1, "test");
assert.equal(g.lineups[0].length, 0);
assert.throws(() => E.recordEvent(s, t, g, 0, p, "points", 2, "test"));
E.finish(s, t, g);
const report = s.reports[0];
E.reopen(t, g);
assert.equal(report.game.status, "final");
assert.equal(g.status, "live");
E.assertState(s);
console.log(
  "PASS: every team count 2–64, knockout counts & advancement, league unique match counts and standings, balanced combined qualifiers, player scoring, foul-out, tied final rejection, report snapshots.",
);

// Team-first scoring, late attribution, immutable totals and safe team removal.
const late = seeded(),
  lt = late.tournaments[0];
E.generate(lt);
const lg = lt.games[0];
E.recordTeamEvent(late, lt, lg, 0, "points", 3, "tester");
E.recordTeamEvent(late, lt, lg, 0, "foul", 1, "tester");
E.assertState(late);
assert.equal(E.total(lg, 0), 3);
assert.equal(lg.events[0].player, "");
const rt = late.teams.find((x) => x.id === lg.rosters[0].id);
rt.players.push({ id: "late-player", name: "Late player", number: "8" });
E.addRosterPlayers(late, lt, lg);
E.finish(late, lt, lg);
const rid = late.reports[0].id;
late.reports[0].notes = "Retain notes";
E.assignEvent(late, lt, lg, lg.events[0].id, "late-player");
E.assignEvent(late, lt, lg, lg.events[1].id, "late-player");
assert.equal(E.total(lg, 0), 3);
assert.equal(E.playerTotal(lg, 0, "late-player"), 3);
assert.equal(E.playerTotal(lg, 0, "late-player", "foul"), 1);
assert.equal(late.reports[0].id, rid);
assert.equal(late.reports[0].notes, "Retain notes");
assert.equal(late.reports[0].game.events[0].player, "late-player");
E.assignEvent(late, lt, lg, lg.events[0].id, "");
assert.equal(E.total(lg, 0), 3);
assert.equal(E.playerTotal(lg, 0, "late-player"), 0);
assert.throws(() => E.assignEvent(late, lt, lg, lg.events[0].id, "invalid"));
assert.throws(() => E.removeTeam(late, rt.id));
E.assertState(late);
const removable = seeded();
E.generate(removable.tournaments[0]);
const removed = removable.teams[0].id;
E.removeTeam(removable, removed);
assert.equal(removable.teams.length, 9);
assert.equal(removable.tournaments[0].games.length, 0);
assert.ok(!removable.tournaments[0].teamIds.includes(removed));
E.assertState(removable);
console.log(
  "PASS: roster-free scoring/fouls, late roster loading, post-final assignment/report refresh, unassignment, unchanged totals, invalid attribution and protected team removal.",
);
