// ============================================================
// MOCK de "firebase/auth" — SOLO para las capturas de la guía.
// Simula el inicio de sesión dentro del navegador headless.
// ============================================================

// Mapa de correos de demostración → usuario simulado
const EMAIL_MAP = {
  "jherrera@cesfamrodelillo.cl": "u-quimico",
  "crojas@cesfamrodelillo.cl": "u-medico1",
  "tfuentes@cesfamrodelillo.cl": "u-medico2",
  "misoto@cesfamrodelillo.cl": "u-func1",
  "paravena@cesfamrodelillo.cl": "u-otro",
};
const DEMO_PASSWORD = "demo123";

let currentUser = null;
const listeners = [];

function notify(u) {
  for (const cb of [...listeners]) {
    try { cb(u); } catch (e) { /* ignore */ }
  }
}

export function getAuth(app) {
  return { app, name: "[DEFAULT]" };
}

export function onAuthStateChanged(auth, cb) {
  listeners.push(cb);
  // Emula el chequeo inicial de sesión (sin sesión guardada)
  setTimeout(() => cb(currentUser), 0);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export async function signInWithEmailAndPassword(auth, email, pass) {
  const key = String(email || "").trim().toLowerCase();
  const uid = EMAIL_MAP[key];
  if (!uid || pass !== DEMO_PASSWORD) {
    const err = new Error("Firebase: Error (auth/invalid-credential).");
    err.code = "auth/invalid-credential";
    err.name = "FirebaseError";
    throw err;
  }
  currentUser = {
    uid,
    email: String(email).trim(),
    emailVerified: true,
    displayName: null,
    metadata: {},
    refreshToken: "mock-token",
    providerData: [],
  };
  notify(currentUser);
  return { user: currentUser };
}

export async function signOut(auth) {
  currentUser = null;
  notify(null);
}

export async function sendPasswordResetEmail() {
  return Promise.resolve();
}
