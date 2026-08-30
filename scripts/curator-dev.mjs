import { spawn } from "node:child_process";
import process from "node:process";

const sitePort = process.env.CURATOR_SITE_PORT || "3000";
const children = [
  // NODE_USE_ENV_PROXY: Node ignores HTTP_PROXY/HTTPS_PROXY for fetch() unless
  // asked, which left logo downloads and page fetches going direct on a machine
  // that only reaches GitHub through a local proxy. Set as an environment
  // variable rather than a CLI flag: an older Node ignores an unknown variable
  // but refuses to start on an unknown flag.
  spawn(process.execPath, ["scripts/curator-server.mjs"], {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY ?? "1" },
  }),
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
