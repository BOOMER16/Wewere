import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["scripts/local-api.mjs"], { stdio: "inherit" }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "inherit" },
  ),
];
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  });
