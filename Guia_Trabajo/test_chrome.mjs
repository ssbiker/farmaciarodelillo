import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Users/Sergio Andres/.cache/puppeteer/chrome/win64-155.0.8059.39/chrome-win64/chrome.exe";
const profile = path.join(HERE, ".chrome-profile-test");
fs.rmSync(profile, { recursive: true, force: true });

const outFd = fs.openSync(path.join(HERE, "chrome_stdout.log"), "a");
const errFd = fs.openSync(path.join(HERE, "chrome_stderr.log"), "a");

console.log("spawning...");
const proc = spawn(
  CHROME,
  [
    "--remote-debugging-port=9223",
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--remote-allow-origins=*",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--no-sandbox",
    "--disable-gpu",
    "--single-process",
    `--user-data-dir=${profile}`,
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: ["ignore", outFd, errFd], detached: true }
);
console.log("pid:", proc.pid);
proc.on("error", (e) => console.log("spawn error:", e.message));
proc.on("exit", (code, sig) => console.log("exit:", code, sig));

await new Promise((r) => setTimeout(r, 6000));
console.log("alive?", proc.exitCode === null);

try {
  const res = await fetch("http://127.0.0.1:9223/json/version");
  const j = await res.json();
  console.log("WS:", j.webSocketDebuggerUrl);
} catch (e) {
  console.log("fetch error:", e.message);
}
proc.kill();
console.log("done");
process.exit(0);
