// ============================================================
// MOCK de "firebase/app" — SOLO para las capturas de la guía.
// ============================================================

let apps = [];

export function initializeApp(options, name) {
  const app = { name: name || "[DEFAULT]", options };
  apps.push(app);
  return app;
}

export function getApps() {
  return apps;
}

export function getApp(name) {
  return apps.find((a) => a.name === (name || "[DEFAULT]")) || null;
}

export function deleteApp(app) {
  apps = apps.filter((a) => a !== app);
  return Promise.resolve();
}
