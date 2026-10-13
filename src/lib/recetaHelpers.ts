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

