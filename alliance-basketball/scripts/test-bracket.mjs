import { build } from "esbuild";
import assert from "node:assert/strict";

await build({
  stdin: {
    contents:
      "export { layoutBrackets } from './app/bracket.tsx'; export * as E from './lib/engine.ts';",
    resolveDir: ".",
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  alias: { "@": "." },
  outfile: ".sites-runtime/bracket-test.mjs",
});
const { layoutBrackets, E } = await import("../.sites-runtime/bracket-test.mjs");

const team = (i) => ({ id: "t" + i, name: "Team " + i, players: [] });
for (let n = 2; n <= 64; n++) {
  const teams = Array.from({ length: n }, (_, i) => team(i));
  for (const mode of ["knockout", "combined"]) {
    if (mode === "combined" && n < 3) continue;
    const t = E.newTournament("T", "2026-10-27", teams.map((x) => x.id));
    t.mode = mode;
    t.finalists = Math.min(4, n - 1);
    E.generate(t);
    const trees = layoutBrackets(t.games);
    const knockout = t.games.filter((g) => g.stage === "knockout");
    const placed = trees.flatMap((tr) => tr.placed.map((p) => p.game.id));
    assert.equal(new Set(placed).size, placed.length, `${mode} ${n}: game placed twice`);
    assert.equal(placed.length, knockout.length, `${mode} ${n}: game missing`);
    for (const tr of trees) {
      for (const a of tr.placed)
        for (const b of tr.placed)
          if (a !== b && a.col === b.col)
            assert.ok(Math.abs(a.row - b.row) >= 1, `${mode} ${n}: overlap in col ${a.col}`);
      assert.ok(tr.titles.every(Boolean), `${mode} ${n}: missing round title`);
    }
  }
}
console.log("PASS: bracket layout for 2–64 teams, knockout and combined: every match placed once, no overlapping cards, every column titled.");
