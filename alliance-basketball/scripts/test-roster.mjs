import { build } from "esbuild";
import assert from "node:assert/strict";

await build({
  entryPoints: ["lib/roster.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/roster-test.mjs",
});
const { parseRoster } = await import("../.sites-runtime/roster-test.mjs");
const pick = (rows) => rows.map((r) => [r.number, r.name, r.error]);

assert.deepEqual(
  pick(
    parseRoster(
      [
        "7 Rahul Sharma",
        "#11 Arjun",
        "23. Kabir",
        "Dev Patel 4",
        "Ishaan - #9",
        "1. Neel - 15",
        "- 30 Om",
        "",
        "  Zara, 2  ",
      ].join("\n"),
      [],
    ),
  ),
  [
    ["7", "Rahul Sharma", ""],
    ["11", "Arjun", ""],
    ["23", "Kabir", ""],
    ["4", "Dev Patel", ""],
    ["9", "Ishaan", ""],
    ["15", "Neel", ""],
    ["30", "Om", ""],
    ["2", "Zara", ""],
  ],
);
assert.deepEqual(
  pick(
    parseRoster("Rahul\n5 Sam\n5 Max\n8 Old", [
      { id: "x", name: "Old", number: "8" },
    ]),
  ),
  [
    ["", "Rahul", "No jersey number"],
    ["5", "Sam", ""],
    ["5", "Max", "#5 already taken"],
    ["8", "Old", "#8 already taken"],
  ],
);
console.log(
  "PASS: roster paste parsing for number-first, name-first, numbered lists, bullets, duplicates and missing numbers.",
);
