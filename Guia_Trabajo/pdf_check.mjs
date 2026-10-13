// Verificación: abre el PDF en Chrome y captura cada página
// para comprobar que ninguna quedó en blanco.
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

const profile = path.join(HERE, ".chrome-check-" + Date.now());
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn(
  CHROME,
  ["--remote-debugging-port=9237", "--headless=new", "--no-first-run", "--no-default-browser-check",
   "--disable-sync", "--disable-crash-reporter", "--disable-breakpad", "--no-sandbox",
   "--remote-allow-origins=*", `--user-data-dir=${profile}`, "--window-size=900,1250", "about:blank"],
  { stdio: "ignore", detached: true }
);
let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const j = await (await fetch("http://127.0.0.1:9237/json/version")).json();
    ws = j.webSocketDebuggerUrl;
    break;
  } catch { await sleep(500); }
}
const browser = await puppeteer.connect({ browserWSEndpoint: ws });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1250, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(PDF).href, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(4000);

const shots = path.join(HERE, "pdf_check");
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

// Enfocar el visor y avanzar con PageDown
await page.mouse.click(450, 600);
const pages = 45;
for (let i = 1; i <= pages; i++) {
  const f = path.join(shots, `p${String(i).padStart(2, "0")}.png`);
  await page.screenshot({ path: f });
  if (i < pages) {
    await page.keyboard.press("PageDown");
    await sleep(350);
  }
}
await browser.close().catch(() => {});
try { proc.kill(); } catch {}

// Análisis de tinta: tamaño de archivo como indicador
const files = fs.readdirSync(shots).filter((f) => f.endsWith(".png")).sort();
let blanks = [];
for (const f of files) {
  const size = fs.statSync(path.join(shots, f)).size;
  if (size < 8000) blanks.push(`${f} (${size} B)`);
}
console.log("Páginas capturadas:", files.length);
console.log("Posibles páginas en blanco:", blanks.length === 0 ? "ninguna ✓" : blanks.join(", "));
