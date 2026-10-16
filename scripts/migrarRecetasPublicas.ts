/**
 * SCRIPT DE MIGRACIÓN — Ejecutar UNA SOLA VEZ
 * =============================================
 * Puebla la colección `recetas_publicas` con todas las recetas
 * existentes en el sistema interno de farmacia.
 *
 * Uso:
 *   npx tsx scripts/migrarRecetasPublicas.ts
 *
 * Requiere:
 *   npm install -D tsx
 *   Tener VITE_CIPHER_KEY en .env.local
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import CryptoJS from "crypto-js";
import { readFileSync } from "fs";
import { createHash } from "crypto";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Lee el .env.local para obtener la CIPHER_KEY
const envContent = readFileSync(".env.local", "utf-8");
const envMatch = envContent.match(/VITE_CIPHER_KEY=(.+)/);
const CIPHER_KEY = envMatch?.[1]?.trim() ?? "";
if (!CIPHER_KEY) throw new Error("VITE_CIPHER_KEY no encontrada en .env.local");

// IMPORTANTE: Descarga tu Service Account desde Firebase Console:
// Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
// Guárdala como scripts/serviceAccount.json (NO la subas a Git)
let serviceAccount: ServiceAccount;
try {
  serviceAccount = JSON.parse(
    readFileSync("scripts/serviceAccount.json", "utf-8")
  ) as ServiceAccount;
} catch {
  console.error(
    "❌ No encontré scripts/serviceAccount.json\n" +
    "   Descárgalo desde Firebase Console → Configuración → Cuentas de servicio\n" +
    "   y guárdalo como scripts/serviceAccount.json"
  );
  process.exit(1);
}

// ─── INICIALIZAR FIREBASE ADMIN ───────────────────────────────────────────────

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const RUT_SALT = "cesfamrod-2026-recetas"; // Debe coincidir con recetaPublica.ts
const ENC_PREFIX = "ENC:";
const COLECCIONES = [
  "recetas_controladas",
  "recetas_cronicas",
  "recetas_maternales",
  "recetas_respiratorias",
] as const;

// ─── FUNCIONES ────────────────────────────────────────────────────────────────

function decrypt(text: string): string {
  if (!text) return text;
  if (!text.startsWith(ENC_PREFIX)) return text; // Texto plano antiguo
  try {
    const cipherText = text.slice(ENC_PREFIX.length);
    const bytes = CryptoJS.AES.decrypt(cipherText, CIPHER_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || text;
  } catch {
    return text;
  }
}

function normalizarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/gi, "").toUpperCase();
}

function hashRutSync(rut: string): string {
  const rutNorm = normalizarRut(rut);
  const input = RUT_SALT + rutNorm;
  return createHash("sha256").update(input, "utf-8").digest("hex");
}

// ─── MIGRACIÓN ────────────────────────────────────────────────────────────────

async function migrar() {
  let total = 0;
  let migradas = 0;
  let omitidas = 0;
  let errores = 0;

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 400; // Firestore permite 500 por batch

  async function flushBatch() {
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✓ Batch de ${batchCount} documentos guardado`);
      batchCount = 0;
    }
  }

  for (const coleccion of COLECCIONES) {
    console.log(`\n📂 Procesando: ${coleccion}`);
    const snapshot = await db.collection(coleccion).get();
    console.log(`   ${snapshot.size} documentos encontrados`);

    for (const docSnap of snapshot.docs) {
      total++;
      const data = docSnap.data();

      // Saltar recetas sin RUT
      if (!data.rut) {
        console.warn(`   ⚠️  ${docSnap.id}: sin campo rut — omitida`);
        omitidas++;
        continue;
      }

      // Saltar recetas eliminadas definitivamente (sin fecha de eliminación)
      if (data.eliminada === true && !data.fechaSolicitud) {
        omitidas++;
        continue;
      }

      try {
        const rutDescifrado = decrypt(data.rut as string);
        const rutHash = hashRutSync(rutDescifrado);

        // Determinar tipo
        const tipoRaw = data.tipo as string;
        const tipo =
          tipoRaw === "controlado" ? "controlado" :
          tipoRaw === "maternal" ? "maternal" :
          tipoRaw === "respiratorio" ? "respiratorio" :
          "cronico";

        // Determinar sector
        const sector = (data.sector as string) ?? "A";

        const publicData = {
          rutHash,
          estado: (data.estado as string) ?? "pendiente",
          tipo,
          sector,
          fechaSolicitud: data.fechaSolicitud as Timestamp ?? Timestamp.now(),
          autoRenovacion: (data.autoRenovacion as number) ?? 0,
          mesesDescontados: (data.mesesDescontados as number) ?? 0,
          eliminada: (data.eliminada as boolean) ?? false,
        };

        const ref = db.collection("recetas_publicas").doc(docSnap.id);
        batch.set(ref, publicData, { merge: true });
        batchCount++;
        migradas++;

        if (batchCount >= MAX_BATCH) {
          await flushBatch();
        }
      } catch (err) {
        console.error(`   ❌ ${docSnap.id}: error — ${err}`);
        errores++;
      }
    }
  }

  // Guardar lo que queda
  await flushBatch();

  console.log("\n" + "═".repeat(50));
  console.log(`✅ MIGRACIÓN COMPLETA`);
  console.log(`   Total procesadas:  ${total}`);
  console.log(`   Migradas:          ${migradas}`);
  console.log(`   Omitidas:          ${omitidas}`);
  console.log(`   Con errores:       ${errores}`);
  console.log("═".repeat(50));
}

migrar().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
