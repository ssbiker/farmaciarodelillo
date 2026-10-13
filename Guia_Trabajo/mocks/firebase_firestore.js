// ============================================================
// MOCK de "firebase/firestore" — SOLO para las capturas de la guía.
// Este archivo reemplaza al módulo real únicamente dentro del
// navegador headless de captura. No forma parte del proyecto.
// ============================================================

const nowMs = Date.now();
const dayMs = 86400000;

function dAgo(days, hours = 0) {
  return new Date(nowMs - days * dayMs - hours * 3600000);
}
function dAhead(days) {
  return new Date(nowMs + days * dayMs);
}

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this.seconds * 1000 + (this.nanoseconds || 0) / 1e6);
  }
  toMillis() {
    return this.seconds * 1000 + Math.floor((this.nanoseconds || 0) / 1e6);
  }
  isEqual(o) {
    return !!o && this.seconds === o.seconds && this.nanoseconds === o.nanoseconds;
  }
  toString() {
    return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`;
  }
  static now() {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromDate(d) {
    const ms = d.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromMillis(ms) {
    return Timestamp.fromDate(new Date(ms));
  }
}

const ts = (d) => Timestamp.fromDate(d);

// ── Base de datos en memoria (se reinicia con cada recarga de página) ──
const db = {
  users: {
    "u-quimico": { data: { name: "Josefa Herrera Morales", email: "jherrera@cesfamrodelillo.cl", role: "admin", inFarmaciaTeam: true, isMedico: true, isFuncionario: true } },
    "u-medico1": { data: { name: "Camila Rojas Fuentes", email: "crojas@cesfamrodelillo.cl", role: "medico" } },
    "u-medico2": { data: { name: "Tomás Fuentes Ríos", email: "tfuentes@cesfamrodelillo.cl", role: "medico" } },
    "u-func1": { data: { name: "María Ignacia Soto Díaz", email: "misoto@cesfamrodelillo.cl", role: "funcionario", inFarmaciaTeam: true } },
    "u-otro": { data: { name: "Pedro Aravena Carrasco", email: "paravena@cesfamrodelillo.cl", role: "tens" } },
  },
  farmacia_config: {
    settings: { data: { diasAlertaRoja: 5, diasAlertaAmarilla: 3 } },
  },
  inventario: {
    "ALO-001": { data: { codigo: "ALO-001", nombre: "Alprazolam 1mg", stock: 45, actualizadoEn: ts(dAgo(1)) } },
    "CLO-001": { data: { codigo: "CLO-001", nombre: "Clonazepam 0.5mg", stock: 60, actualizadoEn: ts(dAgo(1)) } },
    "CLO-002": { data: { codigo: "CLO-002", nombre: "Clonazepam 2mg", stock: 42, actualizadoEn: ts(dAgo(1)) } },
    "DIA-001": { data: { codigo: "DIA-001", nombre: "Diazepam 10mg", stock: 8, actualizadoEn: ts(dAgo(1)) } },
    "FEN-001": { data: { codigo: "FEN-001", nombre: "Fenobarbital 100mg", stock: 25, actualizadoEn: ts(dAgo(1)) } },
    "LOR-001": { data: { codigo: "LOR-001", nombre: "Lorazepam 2mg", stock: 3, actualizadoEn: ts(dAgo(1)) } },
    "TRA-001": { data: { codigo: "TRA-001", nombre: "Tramadol 50mg", stock: 5, actualizadoEn: ts(dAgo(1)) } },
    "CAR-001": { data: { codigo: "CAR-001", nombre: "Carbamazepina 200mg", stock: 18, actualizadoEn: ts(dAgo(1)) } },
    "LOS-001": { data: { codigo: "LOS-001", nombre: "Losartán 50mg", stock: 120, actualizadoEn: ts(dAgo(1)) } },
    "MET-001": { data: { codigo: "MET-001", nombre: "Metformina 850mg", stock: 0, actualizadoEn: ts(dAgo(1)) } },
    "LEV-001": { data: { codigo: "LEV-001", nombre: "Levotiroxina 100mcg", stock: 90, actualizadoEn: ts(dAgo(1)) } },
    "ATO-001": { data: { codigo: "ATO-001", nombre: "Atorvastatina 20mg", stock: 75, actualizadoEn: ts(dAgo(1)) } },
    "SER-001": { data: { codigo: "SER-001", nombre: "Sertralina 50mg", stock: 35, actualizadoEn: ts(dAgo(1)) } },
    "SAL-001": { data: { codigo: "SAL-001", nombre: "Salbutamol Inhalador", stock: 40, actualizadoEn: ts(dAgo(1)) } },
    "INS-001": { data: { codigo: "INS-001", nombre: "Insulina NPH (Frasco)", stock: 22, actualizadoEn: ts(dAgo(1)) } },
  },
  recetas_controladas: {},
  recetas_cronicas: {},
};

// ── Recetas de ejemplo ──
const ctrl = [
  { id: "c1", sector: "A", tipo: "controlado", estado: "pendiente", nombrePaciente: "Juan Pérez González", rut: "12.345.678-9", fechaSolicitud: ts(dAgo(8)), fechaLimite: null, medicamento: "Clonazepam 2mg", codigoMedicamento: "CLO-002", cantidad: 30, nota: "Paciente con indicación de neurólogo. Retirar en sector A.", medicoReceta: "Dra. Camila Rojas Fuentes", medicoUid: "u-medico1", creadoPor: "u-func1", creadoEn: ts(dAgo(8)), actualizadoEn: ts(dAgo(8)), eliminada: false },
  { id: "c2", sector: "A", tipo: "controlado", estado: "pendiente", nombrePaciente: "Ana María Castro Soto", rut: "18.765.432-K", fechaSolicitud: ts(dAgo(1)), fechaLimite: ts(dAhead(2)), medicamento: "Diazepam 10mg", codigoMedicamento: "DIA-001", cantidad: 20, nota: "", medicoReceta: "Dr. Tomás Fuentes Ríos", medicoUid: "u-medico2", creadoPor: "u-func1", creadoEn: ts(dAgo(1)), actualizadoEn: ts(dAgo(1)), eliminada: false },
  { id: "c3", sector: "A", tipo: "controlado", estado: "completado", nombrePaciente: "Roberto Núñez Vera", rut: "9.876.543-2", fechaSolicitud: ts(dAgo(15)), fechaLimite: null, medicamento: "Tramadol 50mg", codigoMedicamento: "TRA-001", cantidad: 30, nota: "Tomar con alimentos.", medicoReceta: "Dra. Camila Rojas Fuentes", medicoUid: "u-medico1", fechaReceta: ts(dAgo(3)), creadoPor: "u-func1", creadoEn: ts(dAgo(15)), actualizadoEn: ts(dAgo(3)), eliminada: false, autoRenovacion: 3, mesesDescontados: 1 },
  { id: "c4", sector: "B", tipo: "controlado", estado: "rechazado", nombrePaciente: "Carmen Gloria Rojas Vidal", rut: "15.234.567-1", fechaSolicitud: ts(dAgo(6)), fechaLimite: null, medicamento: "Alprazolam 1mg", codigoMedicamento: "ALO-001", cantidad: 28, nota: "", medicoReceta: "Dra. Camila Rojas Fuentes", medicoUid: "u-medico1", creadoPor: "u-func1", creadoEn: ts(dAgo(6)), actualizadoEn: ts(dAgo(2)), eliminada: false, motivoRechazo: "Falta respaldo de la indicación médica. Se solicitó nueva orden." },
  { id: "c5", sector: "B", tipo: "controlado", estado: "pendiente", nombrePaciente: "Luis Alberto Morales Pino", rut: "7.654.321-0", fechaSolicitud: ts(dAgo(4)), fechaLimite: ts(dAgo(1)), medicamento: "Lorazepam 2mg", codigoMedicamento: "LOR-001", cantidad: 14, nota: "Frasco de 14 unidades.", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(4)), actualizadoEn: ts(dAgo(4)), eliminada: false },
  { id: "c6", sector: "B", tipo: "controlado", estado: "completado", nombrePaciente: "María José Contreras Díaz", rut: "21.987.654-3", fechaSolicitud: ts(dAgo(12)), fechaLimite: null, medicamento: "Clonazepam 0.5mg", codigoMedicamento: "CLO-001", cantidad: 30, nota: "", medicoReceta: "Dr. Tomás Fuentes Ríos", medicoUid: "u-medico2", fechaReceta: ts(dAgo(5)), creadoPor: "u-func1", creadoEn: ts(dAgo(12)), actualizadoEn: ts(dAgo(5)), eliminada: false },
  { id: "c7", sector: "CECOSF", tipo: "controlado", estado: "pendiente", nombrePaciente: "Pedro Ignacio Fuentes Ríos", rut: "13.456.789-4", fechaSolicitud: ts(dAgo(1)), fechaLimite: null, medicamento: "Fenobarbital 100mg", codigoMedicamento: "FEN-001", cantidad: 30, nota: "", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(1)), actualizadoEn: ts(dAgo(1)), eliminada: false },
  { id: "c8", sector: "CECOSF", tipo: "controlado", estado: "completado", nombrePaciente: "Sofía Alejandra Vera Muñoz", rut: "19.876.543-8", fechaSolicitud: ts(dAgo(10)), fechaLimite: null, medicamento: "Carbamazepina 200mg", codigoMedicamento: "CAR-001", cantidad: 60, nota: "", medicoReceta: "Dr. Tomás Fuentes Ríos", medicoUid: "u-medico2", fechaReceta: ts(dAgo(4)), creadoPor: "u-func1", creadoEn: ts(dAgo(10)), actualizadoEn: ts(dAgo(4)), eliminada: false },
  { id: "d1", sector: "A", tipo: "controlado", estado: "pendiente", nombrePaciente: "Mauricio Andrés Tapia", rut: "13.987.654-0", fechaSolicitud: ts(dAgo(3)), fechaLimite: null, medicamento: "Lorazepam 1mg", codigoMedicamento: "", cantidad: 0, nota: "", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(3)), actualizadoEn: ts(dAgo(2)), eliminada: true, eliminadaPor: "Josefa Herrera Morales (jherrera@cesfamrodelillo.cl)", eliminadaEn: ts(dAgo(2)), motivoEliminacion: "Receta duplicada" },
];
const cron = [
  { id: "k1", sector: "A", tipo: "cronico", estado: "pendiente", nombrePaciente: "Margarita del Carmen León", rut: "8.765.432-1", fechaSolicitud: ts(dAgo(7)), fechaLimite: null, medicamento: "Losartán 50mg", codigoMedicamento: "LOS-001", cantidad: 60, nota: "Control con enfermera programado.", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(7)), actualizadoEn: ts(dAgo(7)), eliminada: false },
  { id: "k2", sector: "A", tipo: "cronico", estado: "pendiente", nombrePaciente: "Hernán Salinas Godoy", rut: "14.567.890-5", fechaSolicitud: ts(dAgo(1)), fechaLimite: ts(dAhead(4)), medicamento: "Metformina 850mg", codigoMedicamento: "MET-001", cantidad: 60, nota: "", medicoReceta: "Dra. Camila Rojas Fuentes", medicoUid: "u-medico1", creadoPor: "u-func1", creadoEn: ts(dAgo(1)), actualizadoEn: ts(dAgo(1)), eliminada: false },
  { id: "k3", sector: "A", tipo: "cronico", estado: "completado", nombrePaciente: "Elisa Belén Navarro Pozo", rut: "11.234.567-6", fechaSolicitud: ts(dAgo(16)), fechaLimite: null, medicamento: "Levotiroxina 100mcg", codigoMedicamento: "LEV-001", cantidad: 60, nota: "Tomar en ayunas.", medicoReceta: "Dra. Camila Rojas Fuentes", medicoUid: "u-medico1", fechaReceta: ts(dAgo(3)), creadoPor: "u-func1", creadoEn: ts(dAgo(16)), actualizadoEn: ts(dAgo(3)), eliminada: false, autoRenovacion: 6, mesesDescontados: 1 },
  { id: "k4", sector: "B", tipo: "cronico", estado: "pendiente", nombrePaciente: "Jorge Andrés Silva Rojas", rut: "16.789.012-7", fechaSolicitud: ts(dAgo(2)), fechaLimite: ts(dAhead(1)), medicamento: "Atorvastatina 20mg", codigoMedicamento: "ATO-001", cantidad: 30, nota: "", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(2)), actualizadoEn: ts(dAgo(2)), eliminada: false },
  { id: "k5", sector: "B", tipo: "cronico", estado: "rechazado", nombrePaciente: "Patricia Alejandra Muñoz", rut: "20.123.456-8", fechaSolicitud: ts(dAgo(5)), fechaLimite: null, medicamento: "Sertralina 50mg", codigoMedicamento: "SER-001", cantidad: 30, nota: "", medicoReceta: "Dr. Tomás Fuentes Ríos", medicoUid: "u-medico2", creadoPor: "u-func1", creadoEn: ts(dAgo(5)), actualizadoEn: ts(dAgo(4)), eliminada: false, motivoRechazo: "Posología incompleta en la receta original." },
  { id: "k6", sector: "CECOSF", tipo: "cronico", estado: "completado", nombrePaciente: "Ricardo Emilio Paredes", rut: "10.987.654-3", fechaSolicitud: ts(dAgo(9)), fechaLimite: null, medicamento: "Salbutamol Inhalador", codigoMedicamento: "SAL-001", cantidad: 1, nota: "", medicoReceta: "Dr. Tomás Fuentes Ríos", medicoUid: "u-medico2", fechaReceta: ts(dAgo(2)), creadoPor: "u-func1", creadoEn: ts(dAgo(9)), actualizadoEn: ts(dAgo(2)), eliminada: false },
  { id: "k7", sector: "CECOSF", tipo: "cronico", estado: "pendiente", nombrePaciente: "Gloria Estela Campos", rut: "17.456.789-K", fechaSolicitud: ts(dAgo(0, 12)), fechaLimite: null, medicamento: "Insulina NPH (Frasco)", codigoMedicamento: "INS-001", cantidad: 2, nota: "", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(0, 12)), actualizadoEn: ts(dAgo(0, 12)), eliminada: false },
  { id: "d2", sector: "B", tipo: "cronico", estado: "pendiente", nombrePaciente: "Rosa Amelia Fuentealba", rut: "22.333.444-5", fechaSolicitud: ts(dAgo(2)), fechaLimite: null, medicamento: "Losartán 50mg", codigoMedicamento: "LOS-001", cantidad: 30, nota: "", medicoReceta: "", medicoUid: "", creadoPor: "u-func1", creadoEn: ts(dAgo(2)), actualizadoEn: ts(dAgo(1)), eliminada: true, eliminadaPor: "Josefa Herrera Morales (jherrera@cesfamrodelillo.cl)", eliminadaEn: ts(dAgo(1)), motivoEliminacion: "Error de digitación en el RUT" },
];

for (const r of ctrl) db.recetas_controladas[r.id] = { data: { ...r }, subs: {} };
for (const r of cron) db.recetas_cronicas[r.id] = { data: { ...r }, subs: {} };

// Auditoría de la receta c1
db.recetas_controladas["c1"].subs.auditoria = [
  { id: "a1", data: { accion: "CREACION", usuarioId: "u-func1", usuarioEmail: "misoto@cesfamrodelillo.cl", usuarioNombre: "María Ignacia Soto Díaz", fecha: ts(dAgo(8)) } },
  { id: "a2", data: { accion: "MODIFICACION", usuarioId: "u-quimico", usuarioEmail: "jherrera@cesfamrodelillo.cl", usuarioNombre: "Josefa Herrera Morales", fecha: ts(dAgo(6)), cambios: [ { campo: "nota", antes: "", despues: "Paciente con indicación de neurólogo." }, { campo: "medicamento", antes: "Alprazolam 1mg", despues: "Clonazepam 2mg" } ] } },
  { id: "a3", data: { accion: "MODIFICACION", usuarioId: "u-quimico", usuarioEmail: "jherrera@cesfamrodelillo.cl", usuarioNombre: "Josefa Herrera Morales", fecha: ts(dAgo(3)), cambios: [ { campo: "medicoReceta", antes: "", despues: "Dra. Camila Rojas Fuentes" } ] } },
];

// ── Utilidades internas ────────────────────────────────────────
// Clone profundo que además revive las instancias de Timestamp
// (structuredClone las convertiría en objetos planos sin toDate()).
function clone(x) {
  if (x == null) return x;
  if (x instanceof Timestamp) return new Timestamp(x.seconds, x.nanoseconds);
  if (Array.isArray(x)) return x.map(clone);
  if (typeof x === "object") {
    const keys = Object.keys(x);
    if (typeof x.seconds === "number" && typeof x.nanoseconds === "number" && keys.length <= 2) {
      return new Timestamp(x.seconds, x.nanoseconds);
    }
    const out = {};
    for (const k of keys) out[k] = clone(x[k]);
    return out;
  }
  return x;
}
function resolveCol(pathArr) {
  // path: ['users'] o ['recetas_controladas','c1','auditoria']
  let cur = db;
  for (let i = 0; i < pathArr.length; i += 2) {
    const colName = pathArr[i];
    const docId = pathArr[i + 1];
    if (!cur[colName]) cur[colName] = {};
    if (docId === undefined) return cur[colName];
    if (!cur[colName][docId]) cur[colName][docId] = { data: {}, subs: {} };
    cur = cur[colName][docId].subs;
  }
  return cur;
}
function resolveDoc(pathArr) {
  // path: ['users','u1'] o ['recetas_controladas','c1','auditoria','a1']
  let cur = db;
  for (let i = 0; i < pathArr.length - 1; i += 2) {
    const colName = pathArr[i];
    const docId = pathArr[i + 1];
    if (!cur[colName]) cur[colName] = {};
    if (!cur[colName][docId]) cur[colName][docId] = { data: {}, subs: {} };
    cur = cur[colName][docId].subs;
  }
  const lastCol = pathArr[pathArr.length - 2];
  const lastId = pathArr[pathArr.length - 1];
  if (!cur[lastCol]) cur[lastCol] = {};
  return cur[lastCol][lastId];
}

function getFieldVal(data, field) {
  const v = data[field];
  if (v && typeof v === "object" && typeof v.toMillis === "function") return v.toMillis();
  return v;
}

function makeDocSnap(colName, id) {
  const col = resolveCol([colName]);
  const entry = col[id];
  const exists = !!entry;
  return {
    id,
    exists: () => exists,
    data: () => (exists ? clone(entry.data) : undefined),
    get: (field) => (exists ? getFieldVal(entry.data, field) : undefined),
    ref: { type: "doc", path: [colName, id] },
  };
}

function makeCollectionSnap(colName, constraints, docPathPrefix = []) {
  const col = resolveCol([...docPathPrefix, colName]);
  let docs = Object.keys(col).map((id) => ({ id, data: clone(col[id].data) }));
  for (const c of constraints) {
    if (c.type === "where") {
      docs = docs.filter((d) => {
        const v = getFieldVal(d.data, c.field);
        if (c.op === "==") return v === c.value;
        if (c.op === "!=") return v !== c.value;
        return true;
      });
    }
  }
  for (const c of constraints) {
    if (c.type === "orderBy") {
      const dir = c.dir === "desc" ? -1 : 1;
      docs.sort((a, b) => {
        const va = getFieldVal(a.data, c.field);
        const vb = getFieldVal(b.data, c.field);
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return 0;
      });
    }
  }
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((d) => ({
      id: d.id,
      exists: true,
      data: () => clone(d.data),
    })),
    forEach: (fn) => docs.forEach((d) => fn({ id: d.id, data: () => clone(d.data) })),
  };
}

// ── Listeners (para que la UI se actualice en vivo) ────────────
const listeners = [];
function notifyAll() {
  for (const l of listeners) {
    try {
      const snap = l.kind === "doc" ? makeDocSnap(l.path[0], l.path[1]) : makeCollectionSnap(l.path[l.path.length - 1], l.constraints, l.path.slice(0, -1));
      l.cb(snap);
    } catch (e) {
      console.error("[mock-firestore] listener error", e);
    }
  }
}

function genId() {
  return "doc-" + Math.random().toString(36).slice(2, 10);
}

function applyFields(data, fields) {
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (v && typeof v === "object" && v.__op === "inc") {
      data[k] = (typeof data[k] === "number" ? data[k] : 0) + v.n;
    } else if (v && typeof v === "object" && v.__op === "delete") {
      delete data[k];
    } else {
      data[k] = clone(v);
    }
  }
}

// ── API pública (misma forma que firebase/firestore) ───────────
export function getFirestore(app) {
  return { app };
}

export function collection(dbRef, ...pathSegments) {
  return { type: "collection", path: pathSegments };
}

export function doc(dbRef, ...pathSegments) {
  return { type: "doc", path: pathSegments };
}

export function query(colRef, ...constraints) {
  return { type: "query", path: colRef.path, constraints };
}

export function orderBy(field, dir = "asc") {
  return { type: "orderBy", field, dir };
}

export function where(field, op, value) {
  return { type: "where", field, op, value };
}

export function limit(n) {
  return { type: "limit", n };
}

export function getDoc(docRef) {
  return Promise.resolve(makeDocSnap(docRef.path[0], docRef.path[1]));
}

export function getDocs(qRef) {
  const colName = qRef.path[qRef.path.length - 1];
  const prefix = qRef.path.slice(0, -1);
  return Promise.resolve(makeCollectionSnap(colName, qRef.constraints || [], prefix));
}

export function onSnapshot(qRef, cb, errCb) {
  const l = {
    kind: qRef.type === "doc" ? "doc" : "query",
    path: qRef.path,
    constraints: qRef.constraints || [],
    cb,
    errCb,
  };
  listeners.push(l);
  setTimeout(() => {
    const snap = l.kind === "doc" ? makeDocSnap(l.path[0], l.path[1]) : makeCollectionSnap(l.path[l.path.length - 1], l.constraints, l.path.slice(0, -1));
    cb(snap);
  }, 0);
  return () => {
    const i = listeners.indexOf(l);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export async function addDoc(colRef, data) {
  const colName = colRef.path[colRef.path.length - 1];
  const prefix = colRef.path.slice(0, -1);
  const id = genId();
  const col = resolveCol([...prefix, colName]);
  col[id] = { data: clone(data), subs: {} };
  notifyAll();
  return { id, path: [...colRef.path, id] };
}

export async function updateDoc(docRef, fields) {
  const entry = resolveDoc(docRef.path);
  if (entry) {
    applyFields(entry.data, fields);
    notifyAll();
  }
}

export async function setDoc(docRef, data, options) {
  const entry = resolveDoc(docRef.path);
  if (entry) {
    if (options && options.merge) {
      applyFields(entry.data, data);
    } else {
      entry.data = clone(data);
      entry.subs = {};
    }
    notifyAll();
  }
}

export async function deleteDoc(docRef) {
  const entry = resolveDoc(docRef.path);
  if (entry) {
    const col = resolveCol(docRef.path.slice(0, -1));
    delete col[docRef.path[docRef.path.length - 1]];
    notifyAll();
  }
}

export function writeBatch(dbRef) {
  const ops = [];
  return {
    set(docRef, data, options) {
      ops.push({ type: "set", ref: docRef, data, options });
      return this;
    },
    update(docRef, fields) {
      ops.push({ type: "update", ref: docRef, fields });
      return this;
    },
    delete(docRef) {
      ops.push({ type: "delete", ref: docRef });
      return this;
    },
    async commit() {
      for (const op of ops) {
        if (op.type === "set") await setDoc(op.ref, op.data, op.options);
        else if (op.type === "update") await updateDoc(op.ref, op.fields);
        else if (op.type === "delete") await deleteDoc(op.ref);
      }
    },
  };
}

export async function runTransaction(dbRef, fn) {
  const staged = [];
  const tx = {
    get(docRef) {
      const entry = resolveDoc(docRef.path);
      if (entry) {
        return Promise.resolve({ exists: () => true, data: () => clone(entry.data), id: docRef.path[docRef.path.length - 1] });
      }
      return Promise.resolve({ exists: () => false, data: () => undefined, id: docRef.path[docRef.path.length - 1] });
    },
    update(docRef, fields) {
      staged.push({ ref: docRef, fields });
    },
    set(docRef, data) {
      staged.push({ ref: docRef, set: data });
    },
  };
  await fn(tx);
  for (const s of staged) {
    if (s.set) await setDoc(s.ref, s.set);
    else await updateDoc(s.ref, s.fields);
  }
}

export function increment(n) {
  return { __op: "inc", n };
}

export function serverTimestamp() {
  return Timestamp.now();
}
