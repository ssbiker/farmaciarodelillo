// ============================================================
// Genera el PDF final de la guía a partir de guia.html.
// Requiere Chrome headless (misma técnica que capture.mjs).
// ============================================================
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHROME = "C:/Users/Sergio Andres/.cache/puppeteer/chrome/win64-155.0.8059.39/chrome-win64/chrome.exe";
const OUT = path.join(ROOT, "Guia_Usuario_Recetas_Farmacia.pdf");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEBUG_PORT = 9235;
const profile = path.join(HERE, ".chrome-pdf-" + Date.now());
fs.rmSync(profile, { recursive: true, force: true });

const chromeProc = spawn(
  CHROME,
  [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-component-update",
    "--disable-features=TranslateUI",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--no-sandbox",
    "--remote-allow-origins=*",
    `--user-data-dir=${profile}`,
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: "ignore", detached: true }
);

let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const j = await res.json();
    ws = j.webSocketDebuggerUrl;
    break;
  } catch {
    await sleep(500);
  }
}
if (!ws) {
  try { chromeProc.kill(); } catch {}
  throw new Error("No se pudo conectar al depurador de Chrome.");
}

const browser = await puppeteer.connect({ browserWSEndpoint: ws });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 1 });

const fileUrl = pathToFileURL(path.join(HERE, "guia.html")).href;
console.log("Cargando:", fileUrl);
await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 90000 });

// Asegurar fondos y colores al imprimir
await page.addStyleTag({
  content: `
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      img { max-width: 100%; }
    }
  `,
});

await page.emulateMediaType("print");

console.log("Generando PDF en:", OUT);
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "13mm", bottom: "15mm", left: "10mm", right: "10mm" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: `
    <div style="width:100%;font-size:8px;color:#8FA3C4;text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
      Guía de Uso — Recetas de Farmacia · CESFAM Rodelillo &nbsp;·&nbsp; Página <span class="pageNumber"></span> de <span class="totalPages"></span>
    </div>`,
});

const size = fs.statSync(OUT).size;
console.log(`✅ PDF generado: ${(size / 1024 / 1024).toFixed(2)} MB`);

await browser.close().catch(() => {});
try { chromeProc.kill(); } catch {}
process.exit(0);
