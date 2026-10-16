import { db } from "./firebase";
import { doc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import type { EstadoReceta, TipoReceta, Sector } from "../types";

/**
 * Salt fijo específico del sistema.
 * Hace que las tablas rainbow genéricas de RUTs chilenos sean inútiles.
 * NO es un secreto criptográfico — es un prefijo de dominio conocido por el sistema.
 */
const RUT_SALT = "cesfamrod-2026-recetas";

/**
 * Normaliza un RUT chileno eliminando puntos, guión y espacios,
 * y convirtiendo a mayúsculas. Ej: "12.345.678-9" → "123456789"
 */
function normalizarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/gi, "").toUpperCase();
}

/**
 * Calcula el hash SHA-256 de (salt + rutNormalizado).
 * Usa la Web Crypto API nativa del browser — sin dependencias externas.
 * El resultado es un hex string de 64 caracteres.
 *
 * Este hash es unidireccional: imposible revertir al RUT original.
 * Se usa como clave de búsqueda en la colección pública.
 */
export async function hashRut(rut: string): Promise<string> {
  const rutNorm = normalizarRut(rut);
  const input = RUT_SALT + rutNorm;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Datos que se almacenan en la colección pública `recetas_publicas`.
 * Ningún campo contiene datos sensibles del paciente.
 */
export interface RecetaPublicaData {
  rutHash: string;
  estado: EstadoReceta;
  tipo: TipoReceta;
  sector: Sector;
  fechaSolicitud: Timestamp;
  autoRenovacion: number;
  mesesDescontados: number;
  eliminada: boolean;
}

/**
 * Crea o actualiza el documento espejo en `recetas_publicas`.
 * Debe llamarse cada vez que se crea o actualiza una receta interna.
 *
 * @param recetaId    - El mismo ID del documento en recetas_controladas/etc.
 * @param rutSinCifrar - El RUT del paciente en texto plano (ya descifrado en el modal).
 * @param estado      - Estado actual de la receta.
 * @param tipo        - Tipo de receta.
 * @param sector      - Sector del paciente.
 * @param fechaSolicitud - Timestamp de solicitud.
 * @param autoRenovacion - Meses de renovación (0 = entrega única).
 * @param mesesDescontados - Meses ya procesados.
 * @param eliminada   - Si la receta está en papelera.
 */
export async function sincronizarRecetaPublica(
  recetaId: string,
  rutSinCifrar: string,
  estado: EstadoReceta,
  tipo: TipoReceta,
  sector: Sector,
  fechaSolicitud: Timestamp,
  autoRenovacion: number,
  mesesDescontados: number,
  eliminada = false
): Promise<void> {
  try {
    if (!rutSinCifrar || normalizarRut(rutSinCifrar).length < 2) return;

    const rutHash = await hashRut(rutSinCifrar);
    const data: RecetaPublicaData = {
      rutHash,
      estado,
      tipo,
      sector,
      fechaSolicitud,
      autoRenovacion: autoRenovacion ?? 0,
      mesesDescontados: mesesDescontados ?? 0,
      eliminada,
    };

    await setDoc(doc(db, "recetas_publicas", recetaId), data, { merge: true });
  } catch (err) {
    // Error silencioso: no bloquea el flujo principal de la farmacia
    console.error("[recetaPublica] Error al sincronizar:", err);
  }
}

/**
 * Marca la receta pública como eliminada cuando se elimina definitivamente
 * desde la papelera. Mantiene el documento para evitar inconsistencias
 * si el paciente consulta justo en ese momento.
 */
export async function eliminarRecetaPublica(recetaId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "recetas_publicas", recetaId), {
      eliminada: true,
    });
  } catch (err) {
    console.error("[recetaPublica] Error al marcar como eliminada:", err);
  }
}
