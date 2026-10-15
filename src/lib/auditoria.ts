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
 * Incluye fallback automático entre recetas_controladas y recetas_cronicas por si la receta
 * fue consultada con la colección alternativa.
 */
export async function obtenerAuditoria(
  collectionName: string,
  recetaId: string
): Promise<AuditoriaEntry[]> {
  try {
    const q = query(
      collection(db, collectionName, recetaId, "auditoria"),
      orderBy("fecha", "asc")
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditoriaEntry));
    }
  } catch (err) {
    console.warn(`[auditoria] No se encontró auditoría en ${collectionName}/${recetaId}:`, err);
  }

  // Fallback: Probar en las otras colecciones (recetas_controladas, recetas_cronicas, recetas_maternales)
  const ALL_COLS = ["recetas_controladas", "recetas_cronicas", "recetas_maternales"];
  const otrasColecciones = ALL_COLS.filter((c) => c !== collectionName && c !== (collectionName === "controladas" ? "recetas_controladas" : collectionName === "maternales" ? "recetas_maternales" : "recetas_cronicas"));

  for (const otraColeccion of otrasColecciones) {
    try {
      const qOtra = query(
        collection(db, otraColeccion, recetaId, "auditoria"),
        orderBy("fecha", "asc")
      );
      const snapOtra = await getDocs(qOtra);
      if (!snapOtra.empty) {
        return snapOtra.docs.map((d) => ({ id: d.id, ...d.data() } as AuditoriaEntry));
      }
    } catch (err) {
      console.warn(`[auditoria] Error en fallback de auditoría para ${otraColeccion}:`, err);
    }
  }

  return [];
}

interface ItemComparable {
  medicamento: string;
  codigoMedicamento?: string;
  cantidad?: number;
  autoRenovacion?: number;
}

/**
 * Extrae y normaliza la lista de ítems de una receta, ya sea desde items[]
 * o desde los campos planos heredados (medicamento, cantidad, etc.).
 */
function normalizarItems(data: Record<string, unknown> | undefined): ItemComparable[] {
  if (!data) return [];
  if (Array.isArray(data.items) && data.items.length > 0) {
    return (data.items as any[])
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
      .map((it) => ({
        medicamento: String(it.medicamento || ""),
        codigoMedicamento: String(it.codigoMedicamento || ""),
        cantidad: Number(it.cantidad || 0),
        autoRenovacion: Number(it.autoRenovacion || 0),
      }))
      .filter((it) => it.medicamento && it.medicamento !== "SOLICITUD_RECETA");
  }

  if (data.medicamento && data.medicamento !== "SOLICITUD_RECETA") {
    return [{
      medicamento: String(data.medicamento),
      codigoMedicamento: String(data.codigoMedicamento || ""),
      cantidad: Number(data.cantidad || 0),
      autoRenovacion: Number(data.autoRenovacion || 0),
    }];
  }

  return [];
}

/**
 * Serializa un valor de cualquier tipo a un string legible para auditoría.
 * - Arrays de ItemReceta → lista de medicamentos legible
 * - Timestamps → fecha en español
 * - null/undefined → ""
 * - Objetos genéricos → JSON compacto
 * - Primitivos → toString()
 */
export function serializarValor(val: unknown): string {
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
 * Detecta de forma especializada la adición y eliminación de fármacos
 * para que en la auditoría sea inmediatamente visible qué agregó el médico.
 */
export function detectarCambios(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: string[]
): CambioAuditoria[] {
  const cambios: CambioAuditoria[] = [];

  // 1. Análisis detallado de ítems de medicamentos
  const itemsAntes = normalizarItems(antes);
  const itemsDespues = normalizarItems(despues);

  const agregados: ItemComparable[] = [];
  itemsDespues.forEach((dItem, idx) => {
    // Si es un nuevo ítem agregado más allá de los que existían antes
    if (idx >= itemsAntes.length) {
      agregados.push(dItem);
      return;
    }
    // Si en esta posición antes no estaba este fármaco
    const coincide = itemsAntes.some((aItem) => {
      if (aItem.codigoMedicamento && dItem.codigoMedicamento) {
        return aItem.codigoMedicamento === dItem.codigoMedicamento;
      }
      return aItem.medicamento.trim().toLowerCase() === dItem.medicamento.trim().toLowerCase();
    });
    if (!coincide) {
      agregados.push(dItem);
    }
  });

  const eliminados: ItemComparable[] = [];
  itemsAntes.forEach((aItem) => {
    const sigueEstando = itemsDespues.some((dItem) => {
      if (aItem.codigoMedicamento && dItem.codigoMedicamento) {
        return aItem.codigoMedicamento === dItem.codigoMedicamento;
      }
      return aItem.medicamento.trim().toLowerCase() === dItem.medicamento.trim().toLowerCase();
    });
    if (!sigueEstando) {
      eliminados.push(aItem);
    }
  });

  if (agregados.length > 0) {
    cambios.push({
      campo: "medicamentos_agregados",
      antes: null,
      despues: agregados.map((it) => {
        const cant = it.cantidad ? ` ×${it.cantidad}` : "";
        const reno = it.autoRenovacion && it.autoRenovacion > 0 ? ` (${it.autoRenovacion} meses)` : "";
        return `${it.medicamento}${cant}${reno}`;
      }).join(" | "),
    });
  }

  if (eliminados.length > 0) {
    cambios.push({
      campo: "medicamentos_eliminados",
      antes: eliminados.map((it) => {
        const cant = it.cantidad ? ` ×${it.cantidad}` : "";
        return `${it.medicamento}${cant}`;
      }).join(" | "),
      despues: null,
    });
  }

  // Si no hubo altas ni bajas, pero la lista de items cambió (ej: cambiaron cantidades o renovaciones)
  if (agregados.length === 0 && eliminados.length === 0 && campos.includes("items")) {
    const valAntesItems = serializarValor(antes.items ?? (itemsAntes.length > 0 ? itemsAntes : undefined));
    const valDespuesItems = serializarValor(despues.items ?? (itemsDespues.length > 0 ? itemsDespues : undefined));
    if (valAntesItems !== valDespuesItems) {
      cambios.push({ campo: "items", antes: valAntesItems || null, despues: valDespuesItems || null });
    }
  }

  // 2. Comparación de los demás campos solicitados
  for (const campo of campos) {
    if (campo === "items") continue; // Ya gestionado arriba

    // Si ya se registraron medicamentos_agregados o eliminados, evitar redundancia con 'medicamento' plano
    if ((agregados.length > 0 || eliminados.length > 0) && (campo === "medicamento" || campo === "cantidad")) {
      continue;
    }

    const valAntes = serializarValor(antes[campo]);
    const valDespues = serializarValor(despues[campo]);
    if (valAntes !== valDespues) {
      cambios.push({ campo, antes: valAntes || null, despues: valDespues || null });
    }
  }

  return cambios;
}
