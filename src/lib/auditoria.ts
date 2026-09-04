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
 * Compara dos snapshots de receta y devuelve los campos que cambiaron.
 */
export function detectarCambios(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: string[]
): CambioAuditoria[] {
  const cambios: CambioAuditoria[] = [];
  for (const campo of campos) {
    const valAntes = String(antes[campo] ?? "");
    const valDespues = String(despues[campo] ?? "");
    if (valAntes !== valDespues) {
      cambios.push({ campo, antes: valAntes || null, despues: valDespues || null });
    }
  }
  return cambios;
}
