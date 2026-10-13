// Verificación dirigida de las páginas finales del PDF usando #page=N
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHROME = "C:/Users/Sergio Andres/.cache/puppeteer/chrome/win64-155.0.8059.39/chrome-win64/chrome.exe";
const PDF = path.join(ROOT, "Guia_Usuario_Recetas_Farmacia.pdf");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = path.join(HERE, ".chrome-check2-" + Date.now());
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn(
  CHROME,
  ["--remote-debugging-port=9238", "--headless=new", "--no-first-run", "--no-default-browser-check",
   "--disable-sync", "--disable-crash-reporter", "--disable-breakpad", "--no-sandbox",
   "--remote-allow-origins=*", `--user-data-dir=${profile}`, "--window-size=900,1250", "about:blank"],
  { stdio: "ignore", detached: true }
);
let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const j = await (await fetch("http://127.0.0.1:9238/json/version")).json();
    ws = j.webSocketDebuggerUrl;
    break;
  } catch { await sleep(500); }
}
const browser = await puppeteer.connect({ browserWSEndpoint: ws });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1250, deviceScaleFactor: 1 });

const outDir = path.join(HERE, "pdf_check_tail");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const n of [36, 37, 38, 39, 40, 41, 42, 43, 44, 45]) {
  await page.goto(pathToFileURL(PDF).href + `#page=${n}`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(3500);
  const f = path.join(outDir, `p${String(n).padStart(2, "0")}.png`);
  await page.screenshot({ path: f });
}
await browser.close().catch(() => {});
try { proc.kill(); } catch {}

for (const n of [36, 37, 38, 39, 40, 41, 42, 43, 44, 45]) {
  const f = path.join(outDir, `p${String(n).padStart(2, "0")}.png`);
  const size = fs.existsSync(f) ? fs.statSync(f).size : 0;
  console.log(`página ${n}: ${(size / 1024).toFixed(0)} KB ${size < 8000 ? "⚠ BLANCA" : "✓"}`);
}
