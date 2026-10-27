import { build } from "esbuild";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
await mkdir(".sites-runtime", { recursive: true });
await build({
  entryPoints: ["server/api.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/local-api.mjs",
});
const { handleApi } = await import("../.sites-runtime/local-api.mjs");
const db = new DatabaseSync(".sites-runtime/preview.sqlite");
// Local-only migration; production schema is migrated by Sites.
for (const file of (await readdir("drizzle"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const sql = await readFile("drizzle/" + file, "utf8");
  db.exec(sql.replaceAll("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"));
}
const adapter = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    return {
      bind(...values) {
        return {
          first() {
            return stmt.get(...values) ?? null;
          },
          all() {
            return { results: stmt.all(...values) };
          },
          run() {
            const r = stmt.run(...values);
            return { meta: { changes: Number(r.changes) } };
          },
        };
      },
    };
  },
  batch(queries) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const results = queries.map((q) => q.run());
      db.exec("COMMIT");
      return results;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};
createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    headers.set(
      "oai-authenticated-user-id",
      req.headers["x-preview-user"] || "local-owner",
    );
    headers.set(
      "oai-authenticated-user-email",
      req.headers["x-preview-email"] || "owner@alliance.local",
    );
    const request = new Request("http://127.0.0.1:5173" + req.url, {
      method: req.method,
      headers,
      ...(req.method === "GET" ? {} : { body: Buffer.concat(chunks) }),
    });
    const response = await handleApi(request, adapter);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end("Local preview error");
  }
}).listen(5174, "127.0.0.1", () =>
  console.log("Local API ready at http://127.0.0.1:5174"),
);
