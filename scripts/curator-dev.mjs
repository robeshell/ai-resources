import { spawn } from "node:child_process";
import process from "node:process";

const sitePort = process.env.CURATOR_SITE_PORT || "3000";
const children = [
  spawn(process.execPath, ["scripts/curator-server.mjs"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", sitePort], { stdio: "inherit", env: process.env }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
