import CryptoJS from "crypto-js";

// Prefijo que distingue valores cifrados de texto plano (recetas antiguas sin cifrar)
const ENC_PREFIX = "ENC:";

function getKey(): string {
  const key = import.meta.env.VITE_CIPHER_KEY;
  if (!key) {
    console.error("[Cifrado] VITE_CIPHER_KEY no configurado. Los datos no estarán cifrados.");
    return "";
  }
  return key;
}

/**
 * Cifra un texto con AES-256.
 * - Si ya está cifrado (prefijo ENC:), lo devuelve sin re-cifrar.
 * - Si no hay llave, devuelve el texto original (modo emergencia, sin perder datos).
 */
export function encrypt(text: string): string {
  if (!text) return text;
  if (text.startsWith(ENC_PREFIX)) return text; // Idempotente: evita doble cifrado
  const key = getKey();
  if (!key) return text;
  try {
    return ENC_PREFIX + CryptoJS.AES.encrypt(text, key).toString();
  } catch (err) {
    console.error("[Cifrado] Error al cifrar:", err);
    return text; // Ante error, NO perdemos el dato
  }
}

/**
 * Descifra un texto.
 * - Si empieza con ENC: → descifra con la llave.
 * - Si NO empieza con ENC: → es texto plano (receta antigua), se devuelve tal cual.
 * Esto garantiza compatibilidad total hacia atrás.
 */
export function decrypt(text: string): string {
  if (!text) return text;
  if (!text.startsWith(ENC_PREFIX)) return text; // Texto plano antiguo, sin tocar
  const key = getKey();
  if (!key) return text;
  try {
    const cipherText = text.slice(ENC_PREFIX.length);
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) {
      // Esto ocurre solo si la llave cambió o el dato está corrupto
      console.error("[Cifrado] Fallo al descifrar: llave incorrecta o dato corrupto.");
      return "[Dato cifrado - verificar llave]";
    }
    return result;
  } catch (err) {
    console.error("[Cifrado] Error al descifrar:", err);
    return "[Error al descifrar]";
  }
}

/**
 * Aplica cifrado a los campos sensibles de una receta ANTES de guardar en Firestore.
 * Solo afecta: nombrePaciente y rut.
 */
export function encryptRecetaFields<T extends { nombrePaciente?: string; rut?: string }>(data: T): T {
  return {
    ...data,
    nombrePaciente: data.nombrePaciente !== undefined ? encrypt(data.nombrePaciente) : data.nombrePaciente,
    rut: data.rut !== undefined ? encrypt(data.rut) : data.rut,
  };
}

/**
 * Aplica descifrado a los campos sensibles de una receta DESPUÉS de leer de Firestore.
 * Compatible con registros antiguos en texto plano.
 */
export function decryptRecetaFields<T extends { nombrePaciente?: string; rut?: string }>(data: T): T {
  return {
    ...data,
    nombrePaciente: data.nombrePaciente !== undefined ? decrypt(data.nombrePaciente) : data.nombrePaciente,
    rut: data.rut !== undefined ? decrypt(data.rut) : data.rut,
  };
}

/**
 * Descifra un valor individual de cambio en los registros de auditoría.
 * Si el valor es una cadena cifrada (ENC:...), la descifra. Si no, la devuelve tal cual.
 */
export function decryptAuditoriaValue(value: unknown): unknown {
  if (typeof value === "string") return decrypt(value);
  return value;
}
