/**
 * Motor semántico y procesador de consultas para el Asistente Experto.
 * 100% en cliente, sin APIs externas, ultra rápido y adaptado a la terminología del CESFAM.
 */

import {
  CONOCIMIENTO_SISTEMA,
  verificarSeguridadYContexto,
  type ArticuloConocimiento,
} from "./conocimientoRecetas";

export interface ResultadoConsulta {
  tipo: "exito" | "seguridad" | "sin_resultados";
  mensaje?: string;
  articulos: ArticuloConocimiento[];
  sugerencias?: string[];
}

/**
 * Normaliza una cadena eliminando tildes, signos de puntuación y espacios redundantes.
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,:;()[\]{}"'\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Obtiene la raíz básica de una palabra en español para coincidencia morfológica.
 */
function obtenerRaiz(palabra: string): string {
  if (palabra.length <= 4) return palabra;
  if (palabra.startsWith("autoriz") || palabra.startsWith("aprob")) return "autoriz";
  if (palabra.startsWith("rechaz") || palabra.startsWith("deneg")) return "rechaz";
  if (palabra.startsWith("ingres") || palabra.startsWith("crea") || palabra.startsWith("registr")) return "ingres";
  if (palabra.startsWith("vincul") || palabra.startsWith("duplic")) return "vincul";
  if (palabra.startsWith("imprim") || palabra.startsWith("ticket")) return "imprim";
  if (palabra.startsWith("borr") || palabra.startsWith("elimin") || palabra.startsWith("papeler")) return "papeler";
  if (palabra.startsWith("venc") || palabra.startsWith("urgent") || palabra.startsWith("roja")) return "vencid";
  if (palabra.startsWith("inventar") || palabra.startsWith("stock") || palabra.startsWith("excel")) return "inventari";
  if (palabra.startsWith("matern") || palabra.startsWith("gestan")) return "matern";
  if (palabra.startsWith("respirat") || palabra.startsWith("asma") || palabra.startsWith("inhalad") || palabra.startsWith("era")) return "respirat";
  if (palabra.startsWith("dosis") || palabra.startsWith("calcul")) return "calcul";
  if (palabra.startsWith("auditor") || palabra.startsWith("histori") || palabra.startsWith("trazab")) return "auditor";
  return palabra.slice(0, Math.min(palabra.length, 6));
}

/**
 * Diccionario de sinónimos y variantes terminológicas.
 */
const SINONIMOS: Record<string, string[]> = {
  autoriz: ["aprobar", "firmar", "validar", "completar", "despachar", "autorizar", "autorizo", "autorizacion"],
  rechaz: ["negar", "denegar", "anular", "cancelar", "objetar", "rechazo", "rechazar"],
  ingres: ["ingresar", "ingreso", "nueva solicitud", "crear", "formulario", "registrar"],
  medicamento: ["farmaco", "remedio", "droga", "pastilla", "comprimido", "inhalador", "jarabe"],
  vencid: ["urgente", "roja", "atrasada", "demorada", "plazo cumplido", "expirada", "vencida"],
  amarill: ["pronta", "vencer", "amarilla", "tiempo", "aviso"],
  vincul: ["repetida", "duplicada", "doble", "vigente", "misma", "anexar", "vincular"],
  papeler: ["basura", "borrada", "eliminada", "restaurar", "recuperar", "papelera"],
  auditor: ["historial", "reloj", "quien fue", "quien cambio", "trazabilidad", "registro", "auditoria"],
  inventari: ["planilla", "stock master", "archivo", "subir", "cargar", "inventario", "stock", "excel"],
  imprim: ["ticket", "impresora", "papel", "comprobante", "hoja", "imprimir", "impresion"],
  matern: ["embarazo", "gestante", "puerpera", "matrona", "maternal", "maternales"],
  respirat: ["era", "asma", "epoc", "salbutamol", "inhalador", "bronquial", "respiratorio", "respiratorias"],
  acceso: ["login", "entrar", "clave", "password", "denegado", "credenciales", "acceso"],
  calcul: ["dosis", "calcular", "horas", "dias", "asistente", "comprimidos"],
};

// Palabras muy comunes que no aportan diferenciación
const STOP_WORDS = new Set(["como", "para", "con", "que", "una", "uno", "los", "las", "del", "por", "sobre", "este", "esta", "receta", "recetas", "sistema"]);

/**
 * Procesa la consulta del usuario en lenguaje natural.
 */
export function consultarAsistente(
  consulta: string,
  rolUsuario?: "medico" | "funcionario" | "admin"
): ResultadoConsulta {
  // 1. Verificación estricta de seguridad clínica y pertinencia
  const chequeoSeguridad = verificarSeguridadYContexto(consulta);
  if (!chequeoSeguridad.permitido) {
    return {
      tipo: "seguridad",
      mensaje: chequeoSeguridad.motivo,
      articulos: [],
      sugerencias: [
        "¿Cómo autorizo una receta?",
        "¿Cómo ingresar una nueva solicitud?",
        "¿Qué significa la alerta roja?",
      ],
    };
  }

  const queryNorm = normalizarTexto(consulta);
  if (!queryNorm || queryNorm.length < 2) {
    return {
      tipo: "sin_resultados",
      articulos: [],
      mensaje: "Por favor escribe una consulta sobre el uso del sistema (ej: 'cómo autorizo', 'alerta roja', 'solicitud genérica').",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  const palabras = queryNorm.split(" ").filter((w) => w.length >= 2);
  const terminosClave = palabras.filter((w) => !STOP_WORDS.has(w));
  const raicesUsuario = terminosClave.map(obtenerRaiz);

  // 2. Calcular puntaje de coincidencia para cada artículo
  const puntuados = CONOCIMIENTO_SISTEMA.map((art) => {
    let score = 0;
    const tituloNorm = normalizarTexto(art.titulo);
    const resumenNorm = normalizarTexto(art.resumen);
    const keywordsNorm = art.palabrasClave.map((k) => normalizarTexto(k));
    const raicesArticulo = keywordsNorm.map(obtenerRaiz);

    // A) Frase completa
    if (queryNorm.length > 5 && tituloNorm.includes(queryNorm)) score += 60;
    if (queryNorm.length > 5 && resumenNorm.includes(queryNorm)) score += 30;

    // B) Coincidencia de raíces de intención
    for (const raiz of raicesUsuario) {
      if (obtenerRaiz(tituloNorm).includes(raiz) || tituloNorm.includes(raiz)) {
        score += 35;
      }
      if (raicesArticulo.some((r) => r.includes(raiz) || raiz.includes(r))) {
        score += 30;
      }
      if (resumenNorm.includes(raiz)) {
        score += 15;
      }

      // Chequeo de sinónimos
      for (const [clave, lista] of Object.entries(SINONIMOS)) {
        if (clave === raiz || lista.some((s) => s.includes(raiz) || raiz.includes(s))) {
          if (art.palabrasClave.some((k) => lista.includes(normalizarTexto(k)))) {
            score += 25;
          }
        }
      }
    }

    // C) Boost por rol
    if (rolUsuario) {
      if (art.rolesRelevantes.includes(rolUsuario)) {
        score += 12;
      } else if (!art.rolesRelevantes.includes("todos")) {
        score -= 8;
      }
    }

    return { articulo: art, score };
  });

  const resultados = puntuados
    .filter((item) => item.score >= 15)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.articulo);

  if (resultados.length === 0) {
    return {
      tipo: "sin_resultados",
      articulos: [],
      mensaje: "No encontré una respuesta exacta para esa búsqueda. Intenta con palabras clave como 'autorizar', 'rechazar', 'solicitud genérica', 'alerta roja' o 'inventario'.",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  const articulosPrincipales = resultados.slice(0, 2);
  const sugerenciasRelacionadas = Array.from(
    new Set(articulosPrincipales.flatMap((a) => a.preguntasFrecuentesRelacionadas || []))
  ).slice(0, 3);

  return {
    tipo: "exito",
    articulos: articulosPrincipales,
    sugerencias: sugerenciasRelacionadas.length > 0 ? sugerenciasRelacionadas : obtenerSugerenciasPorRol(rolUsuario),
  };
}

/**
 * Genera preguntas rápidas sugeridas según el rol del usuario actual.
 */
export function obtenerSugerenciasPorRol(
  rol?: "medico" | "funcionario" | "admin"
): string[] {
  if (rol === "medico") {
    return [
      "¿Cómo autorizo una receta médica en Mi Panel?",
      "¿Qué es la 'Autorización Parcial' y cómo funciona con múltiples medicamentos?",
      "¿Cómo funciona la detección de recetas vigentes y la opción 'Vincular'?",
      "¿Cómo usar el Asistente de Cálculo de Dosis?",
    ];
  }
  if (rol === "funcionario") {
    return [
      "¿Cómo ingresar una nueva solicitud de receta?",
      "¿Qué es el botón '✓ Solicitud Receta' (Solicitud Genérica)?",
      "¿Cómo funcionan las pestañas Maternales y Respiratorias (ERA)?",
      "¿Cómo y cuándo se puede imprimir el ticket de receta?",
    ];
  }
  return [
    "¿Qué funciones tiene cada rol en el sistema?",
    "¿Qué significan las alertas roja, amarilla y verde?",
    "¿Cómo subir el Excel de Inventario (Stock Master)?",
    "¿Cómo restaurar una receta desde la papelera?",
  ];
}
