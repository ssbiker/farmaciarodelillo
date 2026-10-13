// ============================================================
// Script de capturas de pantalla para la guía de usuario.
// Levanta la app REAL (servidor Vite) en un navegador headless,
// reemplazando SOLO los módulos de Firebase por mocks con datos
// de ejemplo. No modifica ningún archivo del proyecto.
// ============================================================
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SCREENS = path.join(HERE, "screens");
const BASE = "http://127.0.0.1:5199/";
const CHROME = "C:/Users/Sergio Andres/.cache/puppeteer/chrome/win64-155.0.8059.39/chrome-win64/chrome.exe";
const EXCEL = ROOT.replace(/\\/g, "/") + "/Reporte Stock.xlsx";

const mocks = {
  app: fs.readFileSync(path.join(HERE, "mocks", "firebase_app.js"), "utf8"),
  auth: fs.readFileSync(path.join(HERE, "mocks", "firebase_auth.js"), "utf8"),
  firestore: fs.readFileSync(path.join(HERE, "mocks", "firebase_firestore.js"), "utf8"),
};

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = [];

async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  page.on("dialog", async (d) => { try { await d.accept(); } catch {} });
  page.on("pageerror", (e) => log("  [pageerror]", e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      log("  [console." + m.type() + "]", m.text().slice(0, 220));
    }
  });
  await page.setRequestInterception(true);
  page.__fbRequests = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/firebase/i.test(u)) {
      page.__fbRequests.push(u);
      if (page.__fbRequests.length <= 8) log("  [firebase-url]", u.split("?")[0]);
    }
    let body = null;
    if (/firebase_app(\.js)?(\?|$)/.test(u) || /node_modules\/firebase\/app\//.test(u)) body = mocks.app;
    else if (/firebase_auth(\.js)?(\?|$)/.test(u) || /node_modules\/firebase\/auth\//.test(u)) body = mocks.auth;
    else if (/firebase_firestore(\.js)?(\?|$)/.test(u) || /node_modules\/firebase\/firestore\//.test(u)) body = mocks.firestore;
    if (body !== null) {
      req.respond({ status: 200, contentType: "application/javascript; charset=utf-8", body });
      return;
    }
    req.continue().catch(() => {});
  });
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(BASE)) log("  [requestfailed]", req.url(), req.failure()?.errorText);
  });
  page.on("response", (res) => {
    if (res.url().startsWith(BASE) && res.status() >= 400) log("  [http]", res.status(), res.url());
  });
  return page;
}

async function gotoApp(page) {
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 40000 });
  } catch (e) {
    log("  goto lento (se continúa igual):", e.message.split("\n")[0]);
  }
}

async function waitText(page, text, timeout = 20000) {
  try {
    await page.waitForFunction(
      (t) => document.body && document.body.innerText.includes(t),
      { timeout },
      text
    );
  } catch (e) {
    try {
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 600) : "(sin body)");
      log("  [waitText timeout]", JSON.stringify(text), "| texto actual:", JSON.stringify(bodyText.replace(/\s+/g, " ")));
      await page.screenshot({ path: path.join(SCREENS, "debug-timeout.png") });
    } catch {}
    throw e;
  }
}

async function clickByText(page, text, selector = "button, a", timeout = 10000) {
  await waitText(page, text, timeout);
  const el = await page.evaluateHandle(
    ({ text, selector }) => {
      const els = [...document.querySelectorAll(selector)];
      return els.find((e) => e.textContent.trim().includes(text)) || null;
    },
    { text, selector }
  );
  const handle = el.asElement();
  if (!handle) throw new Error("No se encontró elemento con texto: " + text);
  await handle.click();
  await sleep(250);
}

async function shot(page, file, opts = {}) {
  if (opts.delay !== 0) await sleep(opts.delay ?? 350);
  await page.screenshot({ path: path.join(SCREENS, file), fullPage: !!opts.fullPage });
  log("📸", file);
}

async function placeMarkers(page, list, noScroll = false) {
  return page.evaluate(
    (list, noScroll) => {
      document.querySelectorAll(".shot-marker").forEach((e) => e.remove());
      const placed = [];
      for (const m of list) {
        let el = null;
        if (m.find === "css") {
          el = document.querySelector(m.sel);
        } else if (m.find === "text") {
          const els = [...document.querySelectorAll(m.tag || "button, a, span, div, h1, h2, h3, p")];
          el = els.find((e) => (e.textContent || "").trim() === m.text) ||
               (m.includes ? els.find((e) => (e.textContent || "").trim().includes(m.text)) : null);
        }
        if (!el) { placed.push({ n: m.n, ok: false }); continue; }
        if (!noScroll) el.scrollIntoView({ block: "center", inline: "center" });
        const r = el.getBoundingClientRect();
        const d = document.createElement("div");
        d.className = "shot-marker";
        d.style.cssText =
          "position:fixed;z-index:2147483000;min-width:20px;height:20px;padding:0 4px;border-radius:9999px;background:#E11D48;color:#fff;display:flex;align-items:center;justify-content:center;font:900 12px/1 system-ui;box-shadow:0 2px 8px rgba(0,0,0,.45);pointer-events:none;border:2px solid #fff;";
        d.style.left = r.left + r.width / 2 - 10 + "px";
        d.style.top = r.top + r.height / 2 - 10 + "px";
        d.textContent = String(m.n);
        document.body.appendChild(d);
        placed.push({ n: m.n, ok: true });
      }
      return placed;
    },
    list,
    noScroll
  );
}

async function clearMarkers(page) {
  await page.evaluate(() => document.querySelectorAll(".shot-marker").forEach((e) => e.remove()));
}

async function annotatedShot(page, file, list, opts = {}) {
  await sleep(200);
  const placed = await placeMarkers(page, list, opts.noScroll);
  await sleep(120);
  await page.screenshot({ path: path.join(SCREENS, file), fullPage: false });
  await clearMarkers(page);
  manifest.push({ file, markers: list.map((m) => ({ n: m.n, label: m.label })), placed });
  log("📸", file, "→", placed.map((p) => p.n).join(","));
}

async function hoverRow(page, patientName) {
  const h = await page.evaluateHandle((name) => {
    const cells = [...document.querySelectorAll("td")];
    const cell = cells.find((c) => c.textContent.trim().includes(name) && c.textContent.trim().length < 40);
    return cell ? cell.closest("tr") : null;
  }, patientName);
  const el = h.asElement();
  if (!el) throw new Error("fila no encontrada: " + patientName);
  await el.hover();
  await sleep(350);
  return el;
}

async function doLogin(page, email, pass) {
  await waitText(page, "Ingresar al Sistema", 120000);
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(email, { delay: 8 });
  await passInput.click();
  await passInput.type(pass, { delay: 8 });
  const btn = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ingresar al Sistema"))
  );
  await btn.asElement().click();
}

async function logout(page) {
  await page.click('button[title="Cerrar sesión"]');
  await waitText(page, "Ingresar al Sistema", 15000);
}

// ══════════════════════════════════════════════════════════════
async function main() {
  log("Lanzando navegador...");
  // El sandbox bloquea procesos con stdio en pipe; por eso lanzamos
  // Chrome manualmente con stdio 'ignore' y conectamos por WebSocket.
  const DEBUG_PORT = 9233;
  const profile = path.join(HERE, ".chrome-profile-" + Date.now());
  fs.rmSync(profile, { recursive: true, force: true });

  // Limpiar Chrome huérfano de ejecuciones previas (puerto 9223), si existe
  try {
    const oldRes = await fetch("http://127.0.0.1:9223/json/version");
    const oldJson = await oldRes.json();
    const oldBrowser = await puppeteer.connect({ browserWSEndpoint: oldJson.webSocketDebuggerUrl });
    await oldBrowser.close();
    log("Cerrado Chrome huérfano de una ejecución anterior.");
  } catch {
    /* no había proceso previo */
  }
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
  log("Conectado a Chrome:", ws);

  const browser = await puppeteer.connect({
    browserWSEndpoint: ws,
    defaultViewport: { width: 1440, height: 1000 },
  });

  // ── 1) PANTALLA DE INICIO DE SESIÓN ─────────────────────────
  let page = await setupPage(browser);
  await gotoApp(page);
  await waitText(page, "Ingresar al Sistema", 120000);
  await sleep(600);
  await annotatedShot(page, "01-login.png", [
    { n: 1, label: "Logo del CESFAM", find: "css", sel: 'img[alt="Logo CESFAM Rodelillo"]' },
    { n: 2, label: "Nombre del sistema y aviso de acceso restringido", find: "text", text: "Recetas Farmacia", tag: "h1" },
    { n: 3, label: "Campo correo electrónico", find: "css", sel: 'input[type="email"]' },
    { n: 4, label: "Campo contraseña", find: "css", sel: 'input[type="password"]' },
    { n: 5, label: "Botón Ingresar al Sistema", find: "text", text: "Ingresar al Sistema" },
    { n: 6, label: "Aviso: solo personal autorizado", find: "text", text: "Solo personal autorizado del CESFAM puede acceder.", includes: true, tag: "p" },
  ]);

  // 2) ERROR DE CREDENCIALES
  await doLogin(page, "crojas@cesfamrodelillo.cl", "clave-mala");
  await waitText(page, "Credenciales incorrectas", 15000);
  await annotatedShot(page, "02-login-error.png", [
    { n: 1, label: "Mensaje de error: credenciales incorrectas", find: "text", text: "Credenciales incorrectas", includes: true, tag: "p" },
  ]);
  await page.close();

  // 3) ACCESO DENEGADO (usuario sin permisos)
  try {
    page = await setupPage(browser);
    await gotoApp(page);
    await waitText(page, "Ingresar al Sistema", 120000);
    await doLogin(page, "paravena@cesfamrodelillo.cl", "demo123");
    await page.waitForFunction(
      () => {
        const t = document.body ? document.body.innerText : "";
        return t.includes("Acceso Denegado") || t.includes("no tiene permisos") || t.includes("Error de seguridad");
      },
      { timeout: 20000 }
    );
    await annotatedShot(page, "03-acceso-denegado.png", [
      { n: 1, label: "Mensaje: la cuenta no tiene permisos para el módulo", find: "text", text: "Acceso Denegado", includes: true, tag: "p" },
    ]);
    await page.close();
  } catch (e) {
    log("❌ sección acceso denegado falló:", e.message.split("\n")[0]);
    try { await page.close(); } catch {}
  }

  // ── 4) ADMIN / QUÍMICO FARMACÉUTICO ─────────────────────────
  try {
    page = await setupPage(browser);
    await gotoApp(page);
    await waitText(page, "Ingresar al Sistema", 120000);
    await doLogin(page, "jherrera@cesfamrodelillo.cl", "demo123");
    await waitText(page, "Ctrl A", 30000);
    await sleep(800);

  // Barra superior
  await annotatedShot(page, "04-barra-superior.png", [
    { n: 1, label: "Logo y nombre del sistema (clic vuelve al tablero)", find: "css", sel: 'a[href="/"]' },
    { n: 2, label: "Botón Portal: volver al Portal de Funcionarios", find: "css", sel: 'a[title="Volver al Portal de Funcionarios"]' },
    { n: 3, label: "Correo de la sesión activa", find: "text", text: "jherrera@cesfamrodelillo.cl", includes: true, tag: "span" },
    { n: 4, label: "Insignia de rol Médico (permiso para autorizar)", find: "text", text: "🩺 Médico", tag: "span" },
    { n: 5, label: "Insignia de rol Funcionario (permiso para ingresar recetas)", find: "text", text: "📋 Funcionario", tag: "span" },
    { n: 6, label: "Rueda de Administración (solo administradores)", find: "css", sel: 'a[title="Administración"]' },
    { n: 7, label: "Botón salir / cerrar sesión", find: "css", sel: 'button[title="Cerrar sesión"]' },
  ]);

  // Pestañas + banner
  await annotatedShot(page, "05-pestanas.png", [
    { n: 1, label: "Pestañas de recetas CONTROLADAS por sector", find: "text", text: "Ctrl A" },
    { n: 2, label: "Ctrl B", find: "text", text: "Ctrl B" },
    { n: 3, label: "Ctrl CECOSF", find: "text", text: "Ctrl CECOSF" },
    { n: 4, label: "Pestañas de recetas CRÓNICAS por sector", find: "text", text: "Crón A" },
    { n: 5, label: "Crón B", find: "text", text: "Crón B" },
    { n: 6, label: "Crón CECOSF", find: "text", text: "Crón CECOSF" },
    { n: 7, label: "Contador rojo: recetas urgentes de esa pestaña", find: "css", sel: 'button:has(> span.bg-red-500) span.bg-red-500' },
    { n: 8, label: "Mi Panel (vista personal del médico)", find: "text", text: "Mi Panel" },
    { n: 9, label: "Inventario (Stock) — solo administradores", find: "text", text: "Inventario (Stock)" },
    { n: 10, label: "Estadísticas — solo administradores", find: "text", text: "Estadísticas" },
    { n: 11, label: "Papelera — solo administradores", find: "text", text: "Papelera" },
  ], { noScroll: true });

  // Banner de alerta
  const banner = await page.$('div.bg-red-50.border-red-200');
  if (banner) {
    await annotatedShot(page, "06-banner-alerta.png", [
      { n: 1, label: "Aviso de solicitudes con tiempo vencido", find: "css", sel: 'div.bg-red-50.border-red-200' },
    ], { noScroll: true });
  }

  // Resumen + barra de herramientas
  await annotatedShot(page, "07-resumen-y-toolbar.png", [
    { n: 1, label: "Tarjeta Total de recetas de la pestaña", find: "text", text: "Total", tag: "p" },
    { n: 2, label: "Tarjeta Pendientes", find: "text", text: "Pendientes", tag: "p" },
    { n: 3, label: "Tarjeta Vencidas (en rojo cuando hay)", find: "text", text: "Vencidas", includes: true, tag: "p" },
    { n: 4, label: "Tarjeta Completadas", find: "text", text: "Completadas", tag: "p" },
    { n: 5, label: "Buscador: por nombre, RUT o medicamento", find: "css", sel: 'input[placeholder*="Buscar por nombre"]' },
    { n: 6, label: "Filtro por estado", find: "css", sel: "select" },
    { n: 7, label: "Botón Nueva Solicitud", find: "text", text: "Nueva Solicitud" },
  ], { noScroll: true });

  // Tabla
  await annotatedShot(page, "08-tabla-recetas.png", [
    { n: 1, label: "Estado de la receta (Pendiente / Completado / Rechazado)", find: "text", text: "Pendiente", tag: "span" },
    { n: 2, label: "Alerta de plazo: Vencida / días restantes / días activa", find: "text", text: "Vencida", includes: true, tag: "span" },
    { n: 3, label: "Fila roja = receta vencida (requiere acción)", find: "text", text: "Juan Pérez González", tag: "span" },
    { n: 4, label: "Badge de auto-renovación (cuando el médico la autorizó con renovaciones)", find: "text", text: "Renovada", includes: true, tag: "span" },
    { n: 5, label: "Columna Médico / Receta (quién autorizó y cuándo)", find: "text", text: "Asignado (Pendiente)", includes: true, tag: "p" },
  ], { noScroll: true });

  // Acciones de fila (hover)
  const rowJuan = await hoverRow(page, "Juan Pérez González");
  await shotEl(page, rowJuan, "09-acciones-fila.png");
  // Limpiar hover con un movimiento de ratón a otra parte
  await page.mouse.move(700, 60);
  await sleep(300);

  // Nueva Solicitud (admin)
  await clickByText(page, "Nueva Solicitud");
  await waitText(page, "Nueva Solicitud", 10000);
  await sleep(700);
  await annotatedShot(page, "10-nueva-solicitud.png", [
    { n: 1, label: "Título de la ventana y sector al que se guardará", find: "text", text: "Nueva Solicitud", tag: "h2" },
    { n: 2, label: "Cerrar ventana (X)", find: "css", sel: 'form#receta-form' },
    { n: 3, label: "Nombre del paciente", find: "text", text: "Nombre del Paciente", tag: "label" },
    { n: 4, label: "RUT (se formatea solo, con puntos y guion)", find: "text", text: "RUT", tag: "label" },
    { n: 5, label: "Medicamento solicitado (busca en el inventario)", find: "text", text: "Medicamento Solicitado", tag: "label" },
    { n: 6, label: "Nota adicional (opcional)", find: "text", text: "Nota Adicional (Opcional)", tag: "label" },
    { n: 7, label: "Fecha límite de atención", find: "text", text: "Fecha Límite de Atención", tag: "p" },
  ], { noScroll: true });

  // Abrir el buscador de medicamentos
  const medInput = await page.$('input[placeholder="Buscar en el inventario..."]');
  await medInput.click();
  await medInput.type("clon", { delay: 60 });
  await sleep(600);
  await annotatedShot(page, "11-buscador-medicamento.png", [
    { n: 1, label: "Lista de medicamentos del inventario que coinciden", find: "css", sel: "div.max-h-60.overflow-y-auto" },
    { n: 2, label: "Stock disponible de cada medicamento (verde = hay, rojo = agotado)", find: "text", text: "Stock: 42", tag: "span" },
  ], { noScroll: true });
  // Seleccionar el primero
  await page.evaluate(() => {
    const items = document.querySelectorAll("div.max-h-60.overflow-y-auto > div");
    if (items[0]) items[0].click();
  });
  await sleep(300);

  // Parte inferior del formulario (scroll interno del modal)
  await page.evaluate(() => {
    const el = document.querySelector("form#receta-form")?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  });
  await sleep(500);
  await annotatedShot(page, "12-nueva-solicitud-abajo.png", [
    { n: 1, label: "Estado de la solicitud", find: "text", text: "Estado", tag: "label" },
    { n: 2, label: "Médico asignado / tratante", find: "text", text: "Médico Asignado / Tratante", tag: "label" },
    { n: 3, label: "Duración / auto-renovación en meses", find: "text", text: "Sin renovación automática", tag: "option" },
    { n: 4, label: "Cancelar sin guardar", find: "text", text: "Cancelar", tag: "button" },
    { n: 5, label: "Guardar el registro", find: "text", text: "Guardar Registro", tag: "button" },
  ], { noScroll: true });
  await page.evaluate(() => {
    const el = document.querySelector("form#receta-form")?.parentElement;
    if (el) el.scrollTop = 0;
  });
  await sleep(300);
  await clickByText(page, "Cancelar");
  await sleep(500);

  // Ticket de receta completada
  const rowRoberto = await hoverRow(page, "Roberto Núñez Vera");
  await page.click('button[title="Ver e Imprimir Ticket"]');
  await waitText(page, "Ticket de Receta", 10000);
  await sleep(600);
  await annotatedShot(page, "13-ticket.png", [
    { n: 1, label: "Título del ticket", find: "text", text: "Ticket de Receta", tag: "h2" },
    { n: 2, label: "Tipo de receta y sector", find: "text", text: "Sector A", tag: "div" },
    { n: 3, label: "Datos del paciente", find: "text", text: "Datos del Paciente", tag: "h4" },
    { n: 4, label: "Medicamento autorizado", find: "text", text: "Tramadol 50mg", tag: "p" },
    { n: 5, label: "Médico tratante y fecha de receta", find: "text", text: "Médico Tratante", tag: "p" },
    { n: 6, label: "Espacio para firma del médico", find: "text", text: "Firma Médico", tag: "p" },
    { n: 7, label: "Botón Imprimir", find: "text", text: "Imprimir", tag: "button" },
    { n: 8, label: "Botón Cerrar", find: "text", text: "Cerrar", tag: "button" },
  ], { noScroll: true });
  await clickByText(page, "Cerrar");
  await sleep(300);

  // Historial de auditoría
  const rowAna = await hoverRow(page, "Juan Pérez González");
  await page.click('button[title="Ver historial de cambios"]');
  await waitText(page, "Historial de Auditoría", 10000);
  await sleep(600);
  await annotatedShot(page, "14-auditoria.png", [
    { n: 1, label: "Título del historial", find: "text", text: "Historial de Auditoría", tag: "h2" },
    { n: 2, label: "Línea de tiempo de eventos (creación, cambios, etc.)", find: "css", sel: "div.absolute.left-4.top-0.bottom-0" },
    { n: 3, label: "Quién hizo el cambio y cuándo", find: "text", text: "Josefa Herrera Morales", includes: true, tag: "p" },
    { n: 4, label: "Valor anterior (tachado) y valor nuevo (verde)", find: "text", text: "→", tag: "span" },
  ], { noScroll: true });
  // Cerrar drawer (clic en el fondo)
  await page.mouse.click(60, 400);
  await sleep(400);
  await page.mouse.move(700, 60);

  // Enviar a papelera
  const rowCarmen = await hoverRow(page, "Roberto Núñez Vera");
  await page.click('button[title="Enviar a papelera"]');
  await waitText(page, "Enviar a Papelera", 10000);
  await sleep(500);
  await annotatedShot(page, "15-enviar-papelera.png", [
    { n: 1, label: "Advertencia: se guardará quién realiza la acción", find: "text", text: "Enviar a Papelera", tag: "h3" },
    { n: 2, label: "Motivo (obligatorio)", find: "text", text: "Motivo (obligatorio)", tag: "label" },
    { n: 3, label: "Botón Enviar (se activa al escribir el motivo)", find: "text", text: "Enviar", tag: "button" },
    { n: 4, label: "Botón Cancelar", find: "text", text: "Cancelar", tag: "button" },
  ], { noScroll: true });
  await page.type("textarea", "Receta de prueba para la guía", { delay: 10 });
  await sleep(300);
  await shot(page, "16-enviar-papelera-motivo.png");
  await clickByText(page, "Cancelar");
  await sleep(300);
  await page.mouse.move(700, 60);

  // Papelera
  await clickByText(page, "Papelera");
  await waitText(page, "Papelera de Recetas", 10000);
  await sleep(600);
  await annotatedShot(page, "17-papelera.png", [
    { n: 1, label: "Título y aviso: solo administrador puede restaurar/eliminar", find: "text", text: "Papelera de Recetas", tag: "h2" },
    { n: 2, label: "Receta eliminada: quién la envió, cuándo y el motivo", find: "text", text: "Receta duplicada", includes: true, tag: "p" },
    { n: 3, label: "Botón Restaurar (devuelve la receta a su lista)", find: "text", text: "Restaurar", tag: "button" },
    { n: 4, label: "Botón Eliminar definitivo (no se puede deshacer)", find: "text", text: "Eliminar definitivo", tag: "button" },
  ], { noScroll: true });
  await clickByText(page, "Eliminar definitivo");
  await waitText(page, "¡Acción irreversible!", 10000);
  await sleep(500);
  await annotatedShot(page, "18-papelera-confirmacion.png", [
    { n: 1, label: "Aviso de acción irreversible", find: "text", text: "¡Acción irreversible!", tag: "h3" },
    { n: 2, label: "Botón Sí, eliminar", find: "text", text: "Sí, eliminar", tag: "button" },
    { n: 3, label: "Botón Cancelar", find: "text", text: "Cancelar", tag: "button" },
  ], { noScroll: true });
  await clickByText(page, "Cancelar");
  await sleep(300);
  await page.mouse.click(60, 400); // cerrar papelera (fondo)
  await sleep(400);

  // Inventario
  await clickByText(page, "Inventario (Stock)");
  await waitText(page, "Inventario y Stock", 15000);
  await sleep(700);
  await annotatedShot(page, "19-inventario.png", [
    { n: 1, label: "Título de la sección", find: "text", text: "Inventario y Stock", tag: "h2" },
    { n: 2, label: "Subir Excel (stock maestro desde planilla)", find: "text", text: "Subir Excel (Stock Master)", tag: "button" },
    { n: 3, label: "Buscador por nombre o código", find: "css", sel: 'input[placeholder*="Buscar por nombre o código"]' },
    { n: 4, label: "Tabla con código, medicamento y stock actual", find: "text", text: "Stock Actual", tag: "th" },
    { n: 5, label: "Stock en verde (suficiente), amarillo (bajo) o rojo (agotado)", find: "text", text: "0", tag: "span" },
    { n: 6, label: "Total de ítems cargados", find: "text", text: "Total de ítems", includes: true, tag: "span" },
  ], { noScroll: true });

  // Vista previa de subida de Excel
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(EXCEL);
  await waitText(page, "Vista Previa de Sincronización", 20000);
  await sleep(600);
  await annotatedShot(page, "20-inventario-preview.png", [
    { n: 1, label: "Vista previa: cuántos medicamentos trae el Excel", find: "text", text: "Vista Previa de Sincronización", tag: "h3" },
    { n: 2, label: "Advertencia: el stock del sistema será reemplazado por el del Excel", find: "text", text: "Advertencia: Sincronización Maestra", tag: "p" },
    { n: 3, label: "Tabla de vista previa (código, medicamento, stock)", find: "text", text: "Stock a subir", tag: "th" },
    { n: 4, label: "Cancelar la subida", find: "text", text: "Cancelar", tag: "button" },
    { n: 5, label: "Confirmar y Subir Stock", find: "text", text: "Confirmar y Subir Stock", tag: "button" },
  ], { noScroll: true });
  await clickByText(page, "Cancelar");
  await sleep(500);

  // Estadísticas
  await clickByText(page, "Estadísticas");
  await waitText(page, "Estadísticas Generales", 15000);
  await sleep(700);
  await annotatedShot(page, "21-estadisticas-1.png", [
    { n: 1, label: "Título de la sección", find: "text", text: "Estadísticas Generales", tag: "h2" },
    { n: 2, label: "Tarjetas resumen (totales, pendientes, completadas, rechazadas, urgentes, médicos)", find: "text", text: "Total recetas", tag: "p" },
    { n: 3, label: "Tasa de resolución global", find: "text", text: "Tasa de resolución global", tag: "p" },
    { n: 4, label: "Resumen por tipo y sector", find: "text", text: "Por tipo y sector", tag: "p" },
    { n: 5, label: "Recetas más urgentes", find: "text", text: "Recetas más urgentes", tag: "p" },
  ], { noScroll: true });

  await page.evaluate(() => {
    const els = [...document.querySelectorAll("p")].filter((p) => p.textContent.trim() === "Actividad por médico");
    if (els[0]) els[0].scrollIntoView({ block: "start" });
  });
  await sleep(500);
  await annotatedShot(page, "22-estadisticas-2.png", [
    { n: 1, label: "Actividad por médico: pendientes, autorizadas y rechazadas de cada doctor", find: "text", text: "Actividad por médico", tag: "p" },
    { n: 2, label: "Barra de progreso de cada médico", find: "text", text: "resueltas", includes: true, tag: "p" },
  ], { noScroll: true });

  await page.evaluate(() => {
    const els = [...document.querySelectorAll("p")].filter((p) => p.textContent.trim() === "Top Medicamentos Entregados");
    if (els[0]) els[0].scrollIntoView({ block: "start" });
  });
  await sleep(500);
  await annotatedShot(page, "23-estadisticas-3.png", [
    { n: 1, label: "Ranking de medicamentos más entregados", find: "text", text: "Top Medicamentos Entregados", tag: "p" },
    { n: 2, label: "Unidades totales y cantidad de recetas por medicamento", find: "text", text: "Unidades Total", tag: "th" },
  ], { noScroll: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);

  // Administración
  await page.click('a[title="Administración"]');
  await waitText(page, "Tiempos de Alerta", 15000);
  await sleep(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await annotatedShot(page, "24-administracion-1.png", [
    { n: 1, label: "Título de la página", find: "text", text: "Administración", tag: "h2" },
    { n: 2, label: "Alerta amarilla: días de tolerancia", find: "text", text: "Alerta Amarilla (días)", tag: "label" },
    { n: 3, label: "Alerta roja crítica: días de tolerancia", find: "text", text: "Alerta Roja Crítica (días)", tag: "label" },
    { n: 4, label: "Guardar los tiempos", find: "text", text: "Guardar Tiempos", tag: "button" },
    { n: 5, label: "Sección papelera", find: "text", text: "Papelera de Recetas", tag: "h3" },
    { n: 6, label: "Botón Abrir Papelera", find: "text", text: "Abrir Papelera", tag: "button" },
    { n: 7, label: "Sección de usuarios y roles", find: "text", text: "Acceso y Roles de Usuarios", tag: "h3" },
  ], { noScroll: true });

  await page.evaluate(() => {
    const els = [...document.querySelectorAll("h3")].filter((h) => h.textContent.trim() === "Acceso y Roles de Usuarios");
    if (els[0]) els[0].scrollIntoView({ block: "start" });
  });
  await sleep(500);
  await annotatedShot(page, "25-administracion-2.png", [
    { n: 1, label: "Usuario y sus insignias de permisos", find: "text", text: "Josefa Herrera Morales", includes: true, tag: "p" },
    { n: 2, label: "Botón permiso Médico (estetoscopio)", find: "css", sel: 'button[title="Quitar rol Médico"], button[title="Marcar como Médico"]' },
    { n: 3, label: "Botón permiso Funcionario (tabla)", find: "css", sel: 'button[title="Quitar rol Funcionario"], button[title="Marcar como Funcionario"]' },
    { n: 4, label: "Botón acceso a Farmacia (escudo)", find: "css", sel: 'button[title="Retirar acceso a Farmacia"], button[title="Dar acceso a Farmacia"]' },
  ], { noScroll: true });

    await logout(page);
    await page.close();
  } catch (e) {
    log("❌ sección admin falló:", e.message.split("\n")[0]);
    try { await page.close(); } catch {}
  }

  // ── 5) MÉDICO ──────────────────────────────────────────────
  try {
    page = await setupPage(browser);
    await gotoApp(page);
    await waitText(page, "Ingresar al Sistema", 120000);
    await doLogin(page, "crojas@cesfamrodelillo.cl", "demo123");
    await waitText(page, "Mi Panel", 30000);
    await sleep(800);

  await annotatedShot(page, "26-mi-panel.png", [
    { n: 1, label: "Mi Panel: resumen personal del médico", find: "text", text: "Mi Panel", tag: "h2" },
    { n: 2, label: "Aviso de recetas urgentes esperando autorización", find: "text", text: "urgente", includes: true, tag: "p" },
    { n: 3, label: "Mis pendientes, autorizadas, rechazadas y urgentes", find: "text", text: "Mis Pendientes", tag: "p" },
    { n: 4, label: "Tasa de resolución personal", find: "text", text: "Tasa de resolución", tag: "p" },
    { n: 5, label: "Pendientes asignadas a este médico (clic para atender)", find: "text", text: "Pendientes asignadas a mí", tag: "h3" },
    { n: 6, label: "Recetas sin médico: cualquier doctor puede atenderlas", find: "text", text: "Sin médico asignado", tag: "h3" },
  ], { noScroll: true });

  await page.evaluate(() => {
    const els = [...document.querySelectorAll("h3")].filter((h) => h.textContent.trim() === "Historial reciente (últimas 10)");
    if (els[0]) els[0].scrollIntoView({ block: "start" });
  });
  await sleep(500);
  await annotatedShot(page, "27-mi-panel-historial.png", [
    { n: 1, label: "Historial reciente de decisiones del médico", find: "text", text: "Historial reciente (últimas 10)", tag: "h3" },
    { n: 2, label: "Tarjeta de receta autorizada (verde)", find: "text", text: "Roberto Núñez Vera", tag: "p" },
    { n: 3, label: "Tarjeta de receta rechazada", find: "text", text: "Carmen Gloria Rojas Vidal", tag: "p" },
  ], { noScroll: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);

  // Abrir una pendiente asignada
  const card = await page.evaluateHandle(() => {
    const heads = [...document.querySelectorAll("h3")].filter((h) => h.textContent.trim().includes("Pendientes asignadas a mí"));
    if (!heads[0]) return null;
    const section = heads[0].closest("div.space-y-3");
    const card = section ? section.querySelector("div.cursor-pointer, div.group") : null;
    return card;
  });
  if (card.asElement()) {
    await card.asElement().click();
    await waitText(page, "Autorizar / Rechazar Receta", 10000);
    await sleep(700);
    await annotatedShot(page, "28-autorizar-1.png", [
      { n: 1, label: "Título de la ventana de decisión médica", find: "text", text: "Autorizar / Rechazar Receta", tag: "h2" },
      { n: 2, label: "Datos del paciente (solo lectura para el médico)", find: "text", text: "Datos del paciente (solo lectura)", tag: "p" },
      { n: 3, label: "Medicamento: el médico elige del inventario", find: "css", sel: 'input[placeholder="Buscar en el inventario..."]' },
      { n: 4, label: "Cantidad de unidades a despachar", find: "text", text: "Cant. (Unid.)", tag: "label" },
      { n: 5, label: "Asistente de cálculo de dosis", find: "text", text: "Mostrar asistente de cálculo", includes: true, tag: "button" },
      { n: 6, label: "Nota dejada por el funcionario (solo lectura)", find: "text", text: "Nota", tag: "label" },
    ], { noScroll: true });

    // Asistente de cálculo
    await clickByText(page, "Mostrar asistente de cálculo");
    await sleep(500);
    await annotatedShot(page, "29-asistente-calculo.png", [
      { n: 1, label: "Dosis por toma", find: "text", text: "Dosis (u.)", tag: "label" },
      { n: 2, label: "Cada cuántas horas", find: "text", text: "Horas", tag: "label" },
      { n: 3, label: "Por cuántos días", find: "text", text: "Días", tag: "label" },
      { n: 4, label: "Calcula solo la cantidad total a despachar", find: "css", sel: 'input[type="number"]' },
    ], { noScroll: true });

    // Botones de decisión
    await annotatedShot(page, "30-autorizar-2.png", [
      { n: 1, label: "Decisión: Pendiente / Autorizar / Rechazar", find: "text", text: "Autorizar", tag: "button" },
      { n: 2, label: "Botón Rechazar", find: "text", text: "Rechazar", tag: "button" },
      { n: 3, label: "Confirmar Decisión (guarda)", find: "text", text: "Confirmar Decisión", tag: "button" },
      { n: 4, label: "Cancelar", find: "text", text: "Cancelar", tag: "button" },
    ], { noScroll: true });

    // Seleccionar Autorizar → aparece auto-renovación
    await clickByText(page, "Autorizar", "button");
    await sleep(500);
    await page.evaluate(() => {
      const el = document.querySelector("form#receta-form")?.parentElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
    await sleep(400);
    await annotatedShot(page, "31-autorizar-renovacion.png", [
      { n: 1, label: "Auto-renovación: meses de validez de la receta", find: "text", text: "Auto-Renovación", tag: "p" },
      { n: 2, label: "Selector de meses (1 a 6)", find: "text", text: "Sin renovación automática", tag: "option" },
    ], { noScroll: true });

    // Seleccionar Rechazar → motivo obligatorio
    await clickByText(page, "Rechazar", "button");
    await sleep(500);
    await page.evaluate(() => {
      const el = document.querySelector("form#receta-form")?.parentElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
    await sleep(400);
    await annotatedShot(page, "32-rechazar.png", [
      { n: 1, label: "Motivo del rechazo (obligatorio)", find: "text", text: "Motivo del Rechazo", includes: true, tag: "p" },
      { n: 2, label: "Campo para escribir el motivo", find: "css", sel: 'textarea[placeholder*="Indique el motivo"]' },
    ], { noScroll: true });
    await page.evaluate(() => {
      const el = document.querySelector("form#receta-form")?.parentElement;
      if (el) el.scrollTop = 0;
    });
    await sleep(300);
    await clickByText(page, "Cancelar");
    await sleep(500);
  }

  // Vista médico de la lista Ctrl A (candado en recetas de otros médicos)
  await clickByText(page, "Ctrl A");
  await sleep(700);
  const rowAnaMed = await hoverRow(page, "Ana María Castro Soto");
  await shotEl(page, rowAnaMed, "33-candado-medico.png");
  await page.mouse.move(700, 60);
  await sleep(300);

    await logout(page);
    await page.close();
  } catch (e) {
    log("❌ sección médico falló:", e.message.split("\n")[0]);
    try { await page.close(); } catch {}
  }

  // ── 6) FUNCIONARIO ─────────────────────────────────────────
  try {
    page = await setupPage(browser);
    await gotoApp(page);
    await waitText(page, "Ingresar al Sistema", 120000);
    await doLogin(page, "misoto@cesfamrodelillo.cl", "demo123");
    await waitText(page, "Ctrl A", 30000);
    await sleep(800);
  await annotatedShot(page, "34-funcionario.png", [
    { n: 1, label: "Insignia Funcionario en la barra superior", find: "text", text: "📋 Funcionario", tag: "span" },
    { n: 2, label: "Solo pestañas de recetas (sin Inventario ni Estadísticas)", find: "text", text: "Crón CECOSF", tag: "button" },
    { n: 3, label: "Botón Nueva Solicitud para ingresar recetas", find: "text", text: "Nueva Solicitud", tag: "button" },
  ], { noScroll: true });

  await clickByText(page, "Nueva Solicitud");
  await waitText(page, "Nueva Solicitud", 10000);
  await sleep(700);
  await page.evaluate(() => {
    const el = document.querySelector("form#receta-form")?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  });
  await sleep(400);
  await annotatedShot(page, "35-funcionario-modal.png", [
    { n: 1, label: "El estado queda fijo en Pendiente", find: "text", text: "Solo un médico puede autorizar", tag: "span" },
    { n: 2, label: "El funcionario asigna el médico tratante", find: "text", text: "Médico Asignado / Tratante", tag: "label" },
    { n: 3, label: "Guardar Registro", find: "text", text: "Guardar Registro", tag: "button" },
  ], { noScroll: true });
  await page.evaluate(() => {
    const el = document.querySelector("form#receta-form")?.parentElement;
    if (el) el.scrollTop = 0;
  });
  await sleep(300);
  await clickByText(page, "Cancelar");
  await sleep(300);
  await logout(page);
  await page.close();
  } catch (e) {
    log("❌ sección funcionario falló:", e.message.split("\n")[0]);
    try { await page.close(); } catch {}
  }

  // Resumen de peticiones de firebase detectadas
  log("\n=== Peticiones con 'firebase' en la URL (primeras 10) ===");
  for (const u of page.__fbRequests.slice(0, 10)) log("  ", u);

  fs.writeFileSync(path.join(HERE, "manifest.json"), JSON.stringify(manifest, null, 2));
  log("\n✅ Capturas terminadas. Manifest guardado.");
  try { await browser.close(); } catch {}
  try { chromeProc.kill(); } catch {}
}

async function shotEl(page, handle, file) {
  await sleep(150);
  await handle.screenshot({ path: path.join(SCREENS, file) });
  log("📸", file);
}

main().catch((e) => {
  console.error("❌ ERROR:", e);
  process.exit(1);
});
