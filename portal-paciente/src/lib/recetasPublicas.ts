import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export interface RecetaPublica {
  id: string;
  rutHash: string;
  estado: "pendiente" | "completado" | "rechazado";
  tipo: "controlado" | "cronico" | "maternal" | "respiratorio";
  sector: "A" | "B" | "CECOSF";
  fechaSolicitud: Timestamp;
  autoRenovacion: number;
  mesesDescontados: number;
  eliminada: boolean;
}

/**
 * Consulta las recetas públicas de un paciente por su hash de RUT.
 * Solo retorna recetas no eliminadas.
 *
 * Esta función accede ÚNICAMENTE a la colección `recetas_publicas`.
 * Ningún dato sensible (nombre, medicamento, médico, stock) está
 * disponible en esta colección ni en esta función.
 */
export async function consultarRecetasPorHash(
  rutHash: string
): Promise<RecetaPublica[]> {
  const q = query(
    collection(db, "recetas_publicas"),
    where("rutHash", "==", rutHash),
    where("eliminada", "==", false)
  );

  const snapshot = await getDocs(q);
  const recetas: RecetaPublica[] = [];

  snapshot.forEach((doc) => {
    recetas.push({ id: doc.id, ...(doc.data() as Omit<RecetaPublica, "id">) });
  });

  // Ordenar por fecha de solicitud, más reciente primero
  return recetas.sort((a, b) => {
    const fa = a.fechaSolicitud?.toMillis?.() ?? 0;
    const fb = b.fechaSolicitud?.toMillis?.() ?? 0;
    return fb - fa;
  });
}

/** Retorna el label amigable del tipo de receta */
export function labelTipo(tipo: RecetaPublica["tipo"]): string {
  const labels = {
    controlado: "Controlada",
    cronico: "Crónica",
    maternal: "Maternal",
    respiratorio: "Respiratoria",
  };
  return labels[tipo] ?? tipo;
}

/** Retorna el emoji del tipo de receta */
export function emojiTipo(tipo: RecetaPublica["tipo"]): string {
  const emojis = {
    controlado: "💊",
    cronico: "🩺",
    maternal: "🤰",
    respiratorio: "🫁",
  };
  return emojis[tipo] ?? "📋";
}

/**
 * Calcula el estado de renovación de una receta para mostrar al paciente.
 * Usa la misma lógica que getEstadoItemRenovacion del sistema interno.
 */
export function getInfoRenovacion(receta: RecetaPublica): {
  esRenovable: boolean;
  mesActual: number;
  totalMeses: number;
  completado: boolean;
} {
  const auto = receta.autoRenovacion ?? 0;
  if (!auto || auto <= 0) {
    return { esRenovable: false, mesActual: 0, totalMeses: 0, completado: false };
  }

  const start = receta.fechaSolicitud?.toDate?.() ?? new Date();
  const today = new Date();
  let elapsed =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) elapsed--;
  elapsed = Math.max(0, elapsed);

  const mesActual = Math.min(Math.max(1, elapsed + 1), auto);
  const completado = mesActual >= auto;

  return {
    esRenovable: true,
    mesActual,
    totalMeses: auto,
    completado,
  };
}
