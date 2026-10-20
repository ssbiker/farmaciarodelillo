/**
 * Motor de Inteligencia y Procesamiento de Lenguaje Natural para el Asistente Experto.
 * Soporta dos modos:
 * 1. Modo IA Gemini Flash (Free Tier $0 de Google): Generación conversacional 100% fluida en lenguaje natural.
 * 2. Modo Local Conversacional: Síntesis dinámica de respuestas en lenguaje natural sin internet ni APIs.
 */

import {
  CONOCIMIENTO_SISTEMA,
  verificarSeguridadYContexto,
  type ArticuloConocimiento,
} from "./conocimientoRecetas";

export interface MensajeIA {
  texto: string;
  tipo: "exito" | "seguridad" | "sin_resultados" | "error";
  fuente: "gemini_ia" | "motor_local";
  articulosRelacionados?: ArticuloConocimiento[];
  sugerencias?: string[];
}

/**
 * Normaliza una cadena eliminando tildes, signos de puntuación y espacios redundantes.
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Obtiene la raíz de una palabra para coincidencia semántica en español.
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

const STOP_WORDS = new Set([
  "como", "para", "con", "que", "una", "uno", "los", "las", "del", "por", "sobre",
  "este", "esta", "estos", "estas", "receta", "recetas", "sistema", "hago", "hacer",
  "puedo", "puede", "tengo", "tiene", "debo", "debe", "cual", "cuales", "donde",
  "el", "la", "lo", "un", "unos", "unas", "al",
  "y", "e", "o", "u", "a", "en", "de", "se", "si", "no", "es", "son", "su", "sus",
  "me", "te", "le", "nos", "les", "mi", "mis", "tu", "tus", "ya", "ni"
]);

/**
 * Construye el System Prompt completo para alimentar a la IA de Gemini con todo el conocimiento.
 */
function construirSystemPrompt(rolUsuario?: string): string {
  const articulosTexto = CONOCIMIENTO_SISTEMA.map((a) => {
    return `### TEMA: ${a.titulo} (Categoría: ${a.categoria})\nResumen: ${a.resumen}\nPasos:\n${(a.pasos || []).map((p) => `- ${p}`).join("\n")}\nDetalles clave:\n${(a.detallesImportantes || []).map((d) => `* ${d}`).join("\n")}`;
  }).join("\n\n");

  return `Eres el Asistente Experto y Colega Virtual del Sistema de Recetas de Farmacia del CESFAM Rodelillo.
Tu función es guiar a médicos, funcionarios y químicos farmacéuticos sobre cómo utilizar la plataforma web de recetas médicas.
El usuario actual tiene el rol: ${rolUsuario || "personal del CESFAM"}.

REGLAS ESTRICTAS DE SEGURIDAD:
1. SOLO respondes sobre el funcionamiento del software de recetas del CESFAM Rodelillo.
2. Si el usuario te pide un diagnóstico médico, indicación de fármacos para curar una enfermedad personal, síntomas o qué remedio tomar: RECHAZA respetuosamente la consulta explicando que por normativa sanitaria no realizas recomendaciones clínicas ni diagnósticos médicos.
3. Si el usuario te hace preguntas ajenas a la plataforma (chistes, política, clima, etc.): recuerda amablemente que eres un asistente de soporte operativo de la web de recetas.
4. Habla con tono empático, claro, profesional, en español chileno respetuoso de salud pública (ej: boxes, sectores A y B, CECOSF, funcionarios, carteras, AVIS/Rayen).
5. Sé directo y sintetiza las respuestas con pasos claros (1, 2, 3), evitando rodeos innecesarios.

CONOCIMIENTO ACTUALIZADO DEL SISTEMA (Manual Oficial + Novedades del Código):
${articulosTexto}

NOVEDADES IMPORTANTES DEL CÓDIGO QUE DEBES CONOCER:
- Hay 4 tipos de recetas: Controladas (rojo/púrpura), Crónicas (azul), Maternales (morado) y Respiratorias/ERA (teal).
- Botón '✓ Solicitud Receta' (SOLICITUD_RECETA): los funcionarios pueden crear la solicitud sin saber el fármaco, y el médico lo define al autorizar.
- Multi-medicamento: una receta puede tener varios fármacos (items[]).
- Autorización Parcial: el médico puede autorizar unos fármacos y rechazar otros con motivo clínico individual.
- Vincular a Receta Existente: si el paciente ya tiene receta vigente en el mismo programa, el médico puede anexar el fármaco para no duplicar recetas.
- Formato RUT sin puntos para AVIS: 12345678-9.
- Cifrado AES-256 en cliente de nombres y RUTs, y portal paciente con SHA-256 salted hash.`;
}

/**
 * Consulta a la IA de Google Gemini (Free Tier) directamente desde el navegador del usuario.
 */
export async function consultarGeminiIA(
  consulta: string,
  apiKey: string,
  rolUsuario?: "medico" | "funcionario" | "admin"
): Promise<MensajeIA> {
  const chequeoSeguridad = verificarSeguridadYContexto(consulta);
  if (!chequeoSeguridad.permitido) {
    return {
      texto: chequeoSeguridad.motivo!,
      tipo: "seguridad",
      fuente: "gemini_ia",
      sugerencias: [
        "¿Cómo autorizo una receta?",
        "¿Cómo ingresar una nueva solicitud?",
        "¿Qué significa la alerta roja?",
      ],
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: consulta }],
          },
        ],
        systemInstruction: {
          parts: [{ text: construirSystemPrompt(rolUsuario) }],
        },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn("[Gemini API Error]", errData);
      // Si la clave es inválida o falla, usar fallback local fluido
      return consultarModoConversacionalLocal(consulta, rolUsuario);
    }

    const data = await response.json();
    const textoRespuesta =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude generar una respuesta en este momento. Por favor reformula tu consulta.";

    return {
      texto: textoRespuesta,
      tipo: "exito",
      fuente: "gemini_ia",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  } catch (error) {
    console.error("[Gemini Connection Error]", error);
    return consultarModoConversacionalLocal(consulta, rolUsuario);
  }
}

/**
 * Modo Conversacional Local: Sintetiza una respuesta humana, amigable y explicada en lenguaje natural
 * sin necesidad de internet ni APIs externas.
 */
export function consultarModoConversacionalLocal(
  consulta: string,
  rolUsuario?: "medico" | "funcionario" | "admin"
): MensajeIA {
  const chequeoSeguridad = verificarSeguridadYContexto(consulta);
  if (!chequeoSeguridad.permitido) {
    return {
      texto: chequeoSeguridad.motivo!,
      tipo: "seguridad",
      fuente: "motor_local",
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
      texto: "¡Hola! Por favor cuéntame qué necesitas saber sobre el sistema de recetas del CESFAM (por ejemplo: cómo autorizar recetas, qué hacer con las alertas rojas o cómo ingresar un paciente).",
      tipo: "sin_resultados",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  const palabras = queryNorm.split(" ").filter((w) => w.length >= 2);
  const terminosClave = palabras.filter((w) => !STOP_WORDS.has(w));
  const raicesUsuario = terminosClave.map(obtenerRaiz);

  // Puntuación semántica
  const puntuados = CONOCIMIENTO_SISTEMA.map((art) => {
    let score = 0;
    const tituloNorm = normalizarTexto(art.titulo);
    const resumenNorm = normalizarTexto(art.resumen);
    const keywordsNorm = art.palabrasClave.map((k) => normalizarTexto(k));
    const raicesArticulo = keywordsNorm.map(obtenerRaiz);

    if (queryNorm.length > 5 && tituloNorm.includes(queryNorm)) score += 60;
    if (queryNorm.length > 5 && resumenNorm.includes(queryNorm)) score += 30;

    // Coincidencia exacta de frase o palabras clave compuestas (ej: "no se el medicamento", "solicitud generica")
    for (const kw of keywordsNorm) {
      if (kw.length >= 4 && (queryNorm.includes(kw) || kw.includes(queryNorm))) {
        score += 80;
      }
    }

    for (const raiz of raicesUsuario) {
      if (obtenerRaiz(tituloNorm).includes(raiz) || tituloNorm.includes(raiz)) score += 35;
      if (raicesArticulo.some((r) => r.includes(raiz) || raiz.includes(r))) score += 30;
      if (resumenNorm.includes(raiz)) score += 15;

      for (const [clave, lista] of Object.entries(SINONIMOS)) {
        if (clave === raiz || lista.some((s) => s.includes(raiz) || raiz.includes(s))) {
          if (art.palabrasClave.some((k) => lista.includes(normalizarTexto(k)))) {
            score += 25;
          }
        }
      }
    }

    if (rolUsuario) {
      if (art.rolesRelevantes.includes(rolUsuario)) score += 12;
      else if (!art.rolesRelevantes.includes("todos")) score -= 8;
    }

    return { articulo: art, score };
  });

  const resultados = puntuados
    .filter((item) => item.score >= 15)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.articulo);

  if (resultados.length === 0) {
    return {
      texto: "No tengo registrado un procedimiento exacto para esa consulta. Te recomiendo revisar si tu duda se relaciona con autorizaciones médicas, ingreso de solicitudes, alertas de plazos o inventario.",
      tipo: "sin_resultados",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  const art = resultados[0];
  
  // Construcción de respuesta fluida en lenguaje natural humano
  const saludo = rolUsuario === "medico" ? "Hola doctor/a." : rolUsuario === "funcionario" ? "Hola." : "Hola estimado/a colega.";
  let respuestaHumana = `${saludo} Con gusto te oriento con respecto a tu consulta:\n\n`;
  respuestaHumana += `${art.resumen}\n\n`;

  if (art.pasos && art.pasos.length > 0) {
    respuestaHumana += `**El procedimiento paso a paso es:**\n`;
    art.pasos.forEach((p, idx) => {
      // Limpiar prefijo 1., 2. si ya viene en el texto
      const pasoLimpio = p.replace(/^\d+\.\s*/, "");
      respuestaHumana += `${idx + 1}. ${pasoLimpio}\n`;
    });
    respuestaHumana += `\n`;
  }

  if (art.detallesImportantes && art.detallesImportantes.length > 0) {
    respuestaHumana += `💡 **Detalle importante a tener en cuenta:**\n`;
    art.detallesImportantes.forEach((d) => {
      respuestaHumana += `• ${d}\n`;
    });
  }

  return {
    texto: respuestaHumana,
    tipo: "exito",
    fuente: "motor_local",
    articulosRelacionados: resultados.slice(0, 2),
    sugerencias: obtenerSugerenciasPorRol(rolUsuario),
  };
}

/**
 * Función principal que decide si llamar a Gemini o al motor conversacional local.
 */
export async function procesarPreguntaAsistente(
  consulta: string,
  rolUsuario?: "medico" | "funcionario" | "admin",
  apiKeyPersonal?: string
): Promise<MensajeIA> {
  // 1. Revisar si hay API key en variable de entorno o en localStorage
  const apiKey =
    apiKeyPersonal ||
    (typeof window !== "undefined" ? localStorage.getItem("cesfam_gemini_api_key") : null) ||
    (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : undefined);

  if (apiKey && apiKey.trim().length > 10) {
    return await consultarGeminiIA(consulta, apiKey.trim(), rolUsuario);
  }

  // 2. Si no hay API key, utilizar el motor conversacional local estructurado
  return consultarModoConversacionalLocal(consulta, rolUsuario);
}

/**
 * Preguntas sugeridas por rol.
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
