import { build } from "esbuild";
import assert from "node:assert/strict";
await build({
  entryPoints: ["server/worker.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/worker-test.mjs",
});
const { default: worker } = await import("../.sites-runtime/worker-test.mjs");
const env = {
  ASSETS: {
    fetch: async (request) =>
      new Response(
        new URL(request.url).pathname === "/" ? "<html>App</html>" : "missing",
        { status: new URL(request.url).pathname === "/" ? 200 : 404 },
      ),
  },
};
for (const path of [
  "/",
  "/teams",
  "/fixtures",
  "/scoreboard",
  "/reports",
  "/scoreboard/",
]) {
  const r = await worker.fetch(
    new Request("https://test.local" + path, {
      headers: { "oai-authenticated-user-id": "test" },
    }),
    env,
  );
  assert.equal(r.status, 200, path);
  assert.match(await r.text(), /App/);
}
const denied = await worker.fetch(
  new Request("https://test.local/scoreboard"),
  env,
);
assert.equal(denied.status, 302);
assert.ok(denied.headers.get("location").includes("signin-with-chatgpt"));
assert.equal(
  (
    await worker.fetch(
      new Request("https://test.local/missing.js", {
        headers: { "oai-authenticated-user-id": "test" },
      }),
      env,
    )
  ).status,
  404,
);
console.log(
  "PASS: all page routes and trailing slash load app; authentication and missing-asset 404 retained.",
);
