import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AccionAuditoria, AuditoriaEntry, CambioAuditoria, FarmaciaUser } from "../types";

/**
 * Registra una entrada en la subcolección `auditoria` de una receta.
 */
export async function registrarAccion(
  collectionName: string,
  recetaId: string,
  accion: AccionAuditoria,
  usuario: FarmaciaUser,
  cambios?: CambioAuditoria[]
): Promise<void> {
  try {
    const ref = collection(db, collectionName, recetaId, "auditoria");
    const entry: Omit<AuditoriaEntry, "id"> = {
      accion,
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      usuarioNombre: usuario.name || usuario.email,
      fecha: Timestamp.now(),
      ...(cambios && cambios.length > 0 ? { cambios } : {}),
    };
    await addDoc(ref, entry);
  } catch (err) {
    console.error("[auditoria] Error al registrar acción:", err);
  }
}

/**
 * Registra la eliminación definitiva en la colección raíz `papelera_auditoria`.
 */
export async function registrarEliminacionDefinitiva(
  collectionName: string,
  recetaId: string,
  paciente: string,
  medicamento: string,
  usuario: FarmaciaUser
): Promise<void> {
  try {
    await addDoc(collection(db, "papelera_auditoria"), {
      accion: "ELIMINACION_DEFINITIVA",
      recetaId,
      coleccion: collectionName,
      paciente,
      medicamento,
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      usuarioNombre: usuario.name || usuario.email,
      fecha: Timestamp.now(),
    });
  } catch (err) {
    console.error("[auditoria] Error al registrar eliminación definitiva:", err);
  }
}

/**
 * Obtiene el historial de auditoría de una receta ordenado por fecha ascendente.
 */
export async function obtenerAuditoria(
  collectionName: string,
  recetaId: string
): Promise<AuditoriaEntry[]> {
  const q = query(
    collection(db, collectionName, recetaId, "auditoria"),
    orderBy("fecha", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditoriaEntry));
}

/**
 * Serializa un valor de cualquier tipo a un string legible para auditoría.
 * - Arrays de ItemReceta → lista de medicamentos legible
 * - Timestamps → fecha en español
 * - null/undefined → ""
 * - Objetos genéricos → JSON compacto
 * - Primitivos → toString()
 */
function serializarValor(val: unknown): string {
  if (val === null || val === undefined) return "";

  // Array — puede ser ItemReceta[]
  if (Array.isArray(val)) {
    if (val.length === 0) return "(sin items)";
    // Si son objetos con propiedad "medicamento" o "codigoMedicamento" → ItemReceta[]
    if (val[0] && typeof val[0] === "object" && ("medicamento" in (val[0] as object) || "codigoMedicamento" in (val[0] as object))) {
      return (val as Array<{ medicamento?: string; cantidad?: number; autoRenovacion?: number }>)
        .map((it, i) => {
          const med = it.medicamento === "SOLICITUD_RECETA" ? "Solicitud pendiente" : (it.medicamento || "Sin especificar");
          const cant = it.cantidad ? ` ×${it.cantidad}` : "";
          const reno = it.autoRenovacion && it.autoRenovacion > 0 ? ` (${it.autoRenovacion}m)` : "";
          return `${i + 1}. ${med}${cant}${reno}`;
        })
        .join(" | ");
    }
    // Array genérico
    return val.map(v => serializarValor(v)).join(", ");
  }

  // Timestamp de Firebase
  if (typeof val === "object" && "toDate" in (val as object) && typeof (val as any).toDate === "function") {
    try {
      return (val as any).toDate().toLocaleDateString("es-CL", {
        day: "2-digit", month: "short", year: "numeric"
      });
    } catch { return String(val); }
  }

  // Objeto genérico
  if (typeof val === "object") {
    try { return JSON.stringify(val); } catch { return "[objeto]"; }
  }

  return String(val);
}

/**
 * Compara dos snapshots de receta y devuelve los campos que cambiaron.
 */
export function detectarCambios(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: string[]
): CambioAuditoria[] {
  const cambios: CambioAuditoria[] = [];
  for (const campo of campos) {
    const valAntes = serializarValor(antes[campo]);
    const valDespues = serializarValor(despues[campo]);
    if (valAntes !== valDespues) {
      cambios.push({ campo, antes: valAntes || null, despues: valDespues || null });
    }
  }
  return cambios;
}
