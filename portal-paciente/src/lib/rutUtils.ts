/**
 * Salt fijo específico del sistema CESFAM Rodelillo.
 * Debe ser IDÉNTICO al definido en src/lib/recetaPublica.ts del sistema interno.
 * Hace que las rainbow tables genéricas de RUTs chilenos sean inútiles.
 */
const RUT_SALT = "cesfamrod-2026-recetas";

/**
 * Normaliza un RUT chileno: elimina puntos, guión, espacios
 * y convierte a mayúsculas. Ej: "12.345.678-9" → "123456789"
 */
export function normalizarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/gi, "").toUpperCase();
}

/**
 * Valida el dígito verificador de un RUT chileno.
 * Retorna true si el RUT es válido.
 */
export function validarRut(rut: string): boolean {
  const clean = normalizarRut(rut);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = 11 - (sum % 11);
  const finalDv =
    expected === 11 ? "0" : expected === 10 ? "K" : expected.toString();
  return dv === finalDv;
}

/**
 * Formatea un RUT con puntos y guión para mostrar en pantalla.
 * Ej: "123456789" → "12.345.678-9"
 */
export function formatRut(raw: string): string {
  const clean = normalizarRut(raw);
  if (clean.length <= 1) return clean;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${dv}`;
}

/**
 * Calcula el hash SHA-256 del RUT para búsqueda en la colección pública.
 * Usa Web Crypto API nativa — sin dependencias externas.
 *
 * IMPORTANTE: Este hash debe ser IDÉNTICO al generado en el sistema interno
 * (src/lib/recetaPublica.ts). Mismo salt, misma normalización.
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
