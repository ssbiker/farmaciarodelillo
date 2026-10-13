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
