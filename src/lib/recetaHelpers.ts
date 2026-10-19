import type { Receta, ItemReceta } from "../types";

/**
 * Devuelve siempre un array de ItemReceta normalizado,
 * independientemente de si la receta usa el modelo nuevo (items[])
 * o el modelo legado (campos planos medicamento/codigoMedicamento/cantidad).
 *
 * Permite que todo el código nuevo trabaje con el mismo formato
 * sin necesidad de migrar recetas históricas en Firestore.
 */
export function getItemsDeReceta(receta: Receta): ItemReceta[] {
  if (receta.items && receta.items.length > 0) {
    return receta.items;
  }
  // Retrocompatibilidad: construir un ítem virtual desde los campos planos
  return [
    {
      medicamento: receta.medicamento ?? "",
      codigoMedicamento: receta.codigoMedicamento ?? "",
      cantidad: receta.cantidad ?? 0,
      autoRenovacion: receta.autoRenovacion ?? 0,
      mesesDescontados: receta.mesesDescontados ?? 0,
    },
  ];
}

/**
 * Devuelve el nombre visible del primer medicamento de la receta.
 * Útil para mostrar en columnas o resúmenes.
 */
export function getPrimerMedicamento(receta: Receta): string {
  return getItemsDeReceta(receta)[0]?.medicamento ?? "";
}

/**
 * Indica si la receta tiene múltiples medicamentos asignados.
 */
export function esMultiMedicamento(receta: Receta): boolean {
  return (receta.items ?? []).length > 1;
}

/**
 * Cuenta cuántos medicamentos adicionales tiene la receta (más allá del primero).
 */
export function contarMedsExtra(receta: Receta): number {
  const items = getItemsDeReceta(receta);
  return Math.max(0, items.length - 1);
}

/**
 * Crea un ítem de medicamento vacío con valores por defecto.
 * Útil cuando el médico agrega un nuevo ítem al formulario.
 */
export function nuevoItemVacio(): ItemReceta {
  return {
    medicamento: "",
    codigoMedicamento: "",
    cantidad: 0,
    autoRenovacion: 0,
    mesesDescontados: 0,
  };
}

/**
 * Calcula el estado visual de renovación para un ítem de receta.
 * Devuelve texto, color de bg, border y text para un badge.
 */
export function getEstadoItemRenovacion(
  item: ItemReceta,
  fechaSolicitud: any  // Timestamp de Firebase
): { label: string; bg: string; border: string; text: string } {
  if (!fechaSolicitud || typeof fechaSolicitud.toDate !== "function") {
    return { label: "⚡ Entrega única", bg: "bg-[#EFF3FB]", border: "border-[#DDE6F5]", text: "text-[#3D5278]" };
  }
  const start = fechaSolicitud.toDate();
  const today = new Date();
  let elapsedMonths = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) elapsedMonths--;
  elapsedMonths = Math.max(0, elapsedMonths);

  if (!item.autoRenovacion || item.autoRenovacion <= 0) {
    // Sin renovación: es entrega única
    if (elapsedMonths >= 1) {
      return { label: "🏁 Despacho único completado", bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-500" };
    }
    return { label: "⚡ Entrega única", bg: "bg-[#EFF3FB]", border: "border-[#DDE6F5]", text: "text-[#3D5278]" };
  }

  const currentMonth = Math.max(1, elapsedMonths + 1);
  if (currentMonth > item.autoRenovacion) {
    return { label: `🏁 Completado (${item.autoRenovacion} meses)`, bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-500" };
  }
  return { label: `🔄 Mes ${currentMonth} de ${item.autoRenovacion}`, bg: "bg-green-50", border: "border-green-200", text: "text-green-700" };
}


/**
 * Determina si una receta COMPLETADA sigue vigente (activa) o ya expiro.
 *
 * Reglas:
 * - Receta pendiente/rechazada - siempre "vigente" a efectos de advertencia de RUT
 * - Receta eliminada - nunca vigente
 * - Receta completada sin renovacion (autoRenovacion=0 en todos sus items):
 *     vigente si pasaron < 30 dias desde la fecha de solicitud / autorizacion
 * - Receta completada con renovacion (al menos un item tiene autoRenovacion>0):
 *     vigente si currentMonth <= maxAutoRenovacion en cualquier item
 *
 * Permite que el banner de "paciente con recetas activas" solo cuente
 * las recetas que aun tienen ciclo de vida en curso.
 */
export function isRecetaVigente(receta: Receta): boolean {
  if (receta.eliminada) return false;

  // Recetas pendientes o rechazadas siempre cuentan como vigentes para el aviso
  if (receta.estado !== "completado") return true;

  const fecha = receta.fechaReceta ?? receta.fechaSolicitud;
  if (!fecha || typeof fecha.toDate !== "function") {
    // Sin fecha fiable: asumimos vigente para no perder datos
    return true;
  }

  const start = fecha.toDate();
  const today = new Date();
  let elapsedMonths =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) elapsedMonths--;
  elapsedMonths = Math.max(0, elapsedMonths);

  const items = getItemsDeReceta(receta);
  const maxRenovacion = Math.max(...items.map((it) => it.autoRenovacion ?? 0));

  if (maxRenovacion <= 0) {
    // Entrega unica: vigente solo durante los primeros 30 dias
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysDiff = Math.round((todayDay.getTime() - startDay.getTime()) / 86400000);
    return daysDiff < 30;
  }

  // Con renovacion: vigente si aun no terminaron todos los meses
  const currentMonth = Math.max(1, elapsedMonths + 1);
  return currentMonth <= maxRenovacion;
}

/**
 * Formatea un RUT chileno sin puntos y con guión (ej: 12345678-9).
 * Formato preferido por el personal médico para compatibilidad con AVIS.
 * Limpia puntos, espacios y caracteres extraños, manteniendo el dígito verificador separado por guion.
 */
export function formatRut(raw: string | undefined | null): string {
  if (!raw) return "";
  const clean = String(raw).replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length <= 1) return clean;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  return `${body}-${dv}`;
}

/**
 * Valida un RUT chileno mediante el algoritmo estándar de módulo 11.
 */
export function validarRut(rut: string | undefined | null): boolean {
  if (!rut) return false;
  const clean = String(rut).replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedDv = 11 - (sum % 11);
  const finalDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
  return dv === finalDv;
}

