/**
 * Motor de Inteligencia y Procesamiento de Lenguaje Natural para el Asistente Experto.
 * Comprensión de contexto, situaciones clínicas y administrativas del CESFAM Rodelillo.
 * 100% en cliente, sin APIs externas obligatorias, seguro y adaptado a la terminología real de salud.
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

export interface TurnoHistorial {
  remitente: "usuario" | "asistente";
  texto: string;
}

/**
 * Normaliza una cadena eliminando tildes, signos de puntuación y espacios redundantes.
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
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

const STOP_WORDS = new Set([
  "como", "para", "con", "que", "una", "uno", "los", "las", "del", "por", "sobre",
  "este", "esta", "estos", "estas", "receta", "recetas", "sistema", "hago", "hacer",
  "puedo", "puede", "tengo", "tiene", "debo", "debe", "cual", "cuales", "donde",
  "el", "la", "lo", "un", "unos", "unas", "al",
  "y", "e", "o", "u", "a", "en", "de", "se", "si", "no", "es", "son", "su", "sus",
  "me", "te", "le", "nos", "les", "mi", "mis", "tu", "tus", "ya", "ni"
]);

/**
 * Saludo contextual profesional y respetuoso (sin la palabra 'colega').
 */
function generarSaludo(rolUsuario?: string, nombreUsuario?: string): string {
  const nombreLimpio = (nombreUsuario || "").trim().split(" ")[0];
  if (rolUsuario === "medico") {
    return nombreLimpio ? `Estimado/a Dr./Dra. ${nombreLimpio}:` : "Estimado/a Doctor/a:";
  }
  if (rolUsuario === "funcionario") {
    return nombreLimpio ? `Hola ${nombreLimpio}:` : "Estimado/a funcionario/a:";
  }
  return nombreLimpio ? `Hola ${nombreLimpio}:` : "Hola, gusto en saludarte:";
}

/**
 * Detector de intenciones y situaciones específicas complejas del CESFAM.
 */
function analizarSituacionEspecifica(
  queryNorm: string,
  rolUsuario?: string,
  nombreUsuario?: string
): string | null {
  const saludo = generarSaludo(rolUsuario, nombreUsuario);

  // 0. Caso: Saber si una receta está completada / autorizada / estado
  const pideSaberEstado =
    queryNorm.includes("saber") ||
    queryNorm.includes("ver") ||
    queryNorm.includes("como se") ||
    queryNorm.includes("donde veo") ||
    queryNorm.includes("identificar");
  const mencionaCompletada =
    queryNorm.includes("completad") ||
    queryNorm.includes("autorizad") ||
    queryNorm.includes("lista") ||
    queryNorm.includes("aprobada");

  if (
    (pideSaberEstado && mencionaCompletada) ||
    queryNorm.includes("receta completada") ||
    queryNorm.includes("como saber el estado") ||
    queryNorm.includes("ver estado de una receta") ||
    queryNorm.includes("como saber si fue autorizada") ||
    queryNorm.includes("esta completada")
  ) {
    return `${saludo}\n\nPara saber si una receta ya está **Completada (autorizada)**:\n\n` +
      `1. **Columna 'Estado':** En la tabla del sector, busca al paciente. Si el badge está en verde **'Completado'**, el médico ya la autorizó.\n` +
      `2. **Botón de Impresora 🖨️:** Pasa el cursor sobre la fila; si el botón azul de la impresora está habilitado, está completada y lista para imprimir el ticket de entrega.\n` +
      `3. **Filtro de Estado:** Arriba de la tabla, cambia el filtro a **'Completadas'** o escribe el RUT en el buscador para verla al instante.\n` +
      `4. **Si eres médico:** En *'Mi Panel'* revisa la sección *'Historial reciente'* (tarjetas verdes).\n\n` +
      `💡 Si el badge es ámbar **'Parcial'**, significa que se autorizó con algunos medicamentos aprobados y otros rechazados.`;
  }

  // 0.1 Caso: Receta no aparece / desaparecida / buscarla
  if (
    queryNorm.includes("no encuentro") ||
    queryNorm.includes("no aparece") ||
    queryNorm.includes("se borro") ||
    queryNorm.includes("desaparecio") ||
    queryNorm.includes("donde esta la receta")
  ) {
    return `${saludo}\n\nSi no encuentras una receta ingresada:\n\n` +
      `1. **Verifica la pestaña:** Asegúrate de estar en el programa correcto (Controladas, Crónicas, Maternales o ERA) y sector (A, B o CECOSF).\n` +
      `2. **Revisa los filtros:** Comprueba que el filtro de estado esté en **'Todos los estados'** (no solo Pendientes).\n` +
      `3. **Usa el buscador:** Escribe el RUT (formato 12345678-9) o apellido en la barra de búsqueda.\n` +
      `4. **Papelera:** Si fue eliminada por error, el administrador puede entrar a la Papelera y presionar **'Restaurar'**.`;
  }

  // 1. Caso Candado puesto / Asignada a otro médico
  if (
    queryNorm.includes("candado") ||
    queryNorm.includes("bloqueada") ||
    (queryNorm.includes("otro") && (queryNorm.includes("medico") || queryNorm.includes("doctor"))) ||
    queryNorm.includes("no puedo autorizar")
  ) {
    return `${saludo}\n\nEn el sistema, cuando una receta aparece con el icono de candado 🔒 significa que **fue asignada nominalmente a otro médico específico**.\n\n` +
      `Por normativa de responsabilidad clínica y trazabilidad:\n` +
      `1. **Solo el médico asignado** (o un administrador) tiene permisos para abrirla y autorizarla desde su panel.\n` +
      `2. **Si el médico tratante no está de turno** o necesitas atender la receta de urgencia, solicita al químico farmacéutico o administrador que reasigne la receta a tu nombre desde la administración.\n` +
      `3. Las recetas que dicen *"Sin médico asignado"* están libres y cualquier médico del sector puede tomarlas directamente.`;
  }

  // 2. Caso Solicitud Genérica / No sé o no sabe el medicamento
  const mencionaMed = queryNorm.includes("medicamento") || queryNorm.includes("remedio") || queryNorm.includes("farmaco");
  const mencionaDesconocimiento = queryNorm.includes("no se") || queryNorm.includes("no sabe") || queryNorm.includes("sin") || queryNorm.includes("desconoce") || queryNorm.includes("no tiene");
  if (
    (mencionaMed && mencionaDesconocimiento) ||
    queryNorm.includes("solicitud generica") ||
    queryNorm.includes("solicitud receta") ||
    queryNorm.includes("solicitud s/med")
  ) {
    return `${saludo}\n\nNo te preocupes si al atender al paciente en ventanilla no conoces el medicamento exacto.\n\n` +
      `Para eso existe la **Solicitud Genérica**:\n` +
      `1. En el formulario de *Nueva Solicitud*, haz clic en el botón superior derecho **'⚕ Solicitud Receta'**.\n` +
      `2. El botón cambiará a **'✓ Solicitud Receta'** y ocultará el buscador de medicamentos.\n` +
      `3. Puedes ingresar una nota explicativa en el campo de texto (ej: *"Paciente viene a control, solicita renovación de tratamiento crónico"*).\n` +
      `4. Al guardar, la receta queda visible para los doctores con el distintivo *'📋 Solicitud s/med'*. El médico tratante será quien seleccione el fármaco exacto, la presentación y las unidades al momento de autorizar.`;
  }

  // 3. Caso Autorización Parcial / Múltiples fármacos
  if (
    queryNorm.includes("parcial") ||
    queryNorm.includes("rechazar solo uno") ||
    queryNorm.includes("rechazar un medicamento") ||
    queryNorm.includes("algunos si y otros no") ||
    queryNorm.includes("multiples farmacos") ||
    queryNorm.includes("dos medicamentos")
  ) {
    return `${saludo}\n\nEl sistema permite recetas con múltiples fármacos (` + "`items`" + `) y soporta **Autorización Parcial**:\n\n` +
      `Si una receta contiene varios medicamentos y uno de ellos no corresponde o no tiene indicación clínica:\n` +
      `1. No es necesario rechazar toda la receta. En la ventana de decisión médica verás la lista de cada uno de los medicamentos.\n` +
      `2. Puedes marcar individualmente como **'Rechazado'** solo el fármaco que no procede y escribir su motivo clínico obligatorio.\n` +
      `3. Mantén los demás medicamentos válidos como **'Autorizados'** con su cantidad correspondiente.\n` +
      `4. Al confirmar, la receta pasa a estado *Completada* con el badge ámbar **'Parcial (X de Y autorizados)'**.\n` +
      `5. En el Ticket impreso saldrán normalmente los medicamentos aprobados para retiro y saldrá tachado en rojo el rechazado con su motivo clínico.`;
  }

  // 4. Caso Detección de Recetas Vigentes / Vincular
  if (
    queryNorm.includes("vincular") ||
    queryNorm.includes("receta vigente") ||
    queryNorm.includes("duplicada") ||
    queryNorm.includes("ya tiene receta") ||
    queryNorm.includes("misma receta")
  ) {
    return `${saludo}\n\nEl sistema cuenta con un motor de prevención de duplicidad por RUT:\n\n` +
      `• **Si el paciente ya tiene una receta activa en el MISMO programa (ej: Crónicas):** Aparecerá un banner amarillo de advertencia. Si eres médico, verás el botón **'Vincular a Receta Existente'**. Al presionarlo, el sistema anexará el nuevo fármaco a la receta previa en lugar de crear un duplicado innecesario.\n` +
      `• **Si la receta activa es de OTRO programa (ej: es Crónico y ahora consulta por Maternal o ERA):** El sistema muestra un aviso informativo de antecedentes, pero permite crear la solicitud independiente sin bloquear el ingreso.\n\n` +
      `💡 Esto asegura que no se dupliquen entregas de stock ni se emitan tickets paralelos para un mismo paciente.`;
  }

  // 5. Caso Impresión de Ticket
  if (
    queryNorm.includes("imprimir ticket") ||
    queryNorm.includes("no puedo imprimir") ||
    queryNorm.includes("no sale la impresora") ||
    queryNorm.includes("comprobante de receta")
  ) {
    return `${saludo}\n\nRespecto a la impresión del comprobante:\n\n` +
      `1. **Requisito indispensable:** El botón de la impresora (azul) **solo está disponible cuando la receta está en estado 'Completado'** (ya autorizada por un médico). No se pueden imprimir recetas en estado *Pendiente* ni *Rechazado*.\n` +
      `2. **Cómo imprimir:** En la tabla de la cartera, pasa el cursor sobre la fila del paciente y presiona el botón azul con icono de impresora.\n` +
      `3. Se abrirá la vista previa del ticket con los datos del paciente, sector, fármacos autorizados y espacio de firma.\n` +
      `4. Si la receta tuvo autorización parcial, el medicamento no autorizado saldrá tachado con su motivo médico para total claridad en el mesón de entrega.`;
  }

  // 6. Caso Alertas de Colores y Plazos
  if (
    queryNorm.includes("alerta roja") ||
    queryNorm.includes("por que sale rojo") ||
    queryNorm.includes("receta vencida") ||
    queryNorm.includes("alerta amarilla") ||
    queryNorm.includes("contador rojo")
  ) {
    return `${saludo}\n\nLos colores del tablero te indican la urgencia de atención de cada receta:\n\n` +
      `• 🔴 **Alerta Roja / Vencida:** La solicitud ya superó la fecha límite fijada o lleva más de 5 días activa sin resolverse (tiempo configurable por el administrador). Requiere atención médica inmediata. Además, las pestañas muestran un contador numérico rojo pulsante para indicar cuántas urgencias hay en ese sector.\n` +
      `• 🟡 **Alerta Amarilla:** La receta está a 3 días o menos de alcanzar su límite de espera. Conviene revisarla antes de que pase a zona crítica.\n` +
      `• 🟢 **Verde / Completada:** Receta debidamente revisada y autorizada por el médico tratante, lista para impresión y entrega.`;
  }

  // 7. Caso Asistente de Cálculo de Dosis
  if (
    queryNorm.includes("asistente de calculo") ||
    queryNorm.includes("calcular dosis") ||
    queryNorm.includes("cada 8 horas") ||
    queryNorm.includes("cuantas unidades despachar") ||
    queryNorm.includes("calcular cantidad")
  ) {
    return `${saludo}\n\nPara evitar errores de dosificación o cálculo manual de cajas:\n\n` +
      `1. En la ventana de decisión médica, haz clic en **'Asistente de cálculo'**.\n` +
      `2. Ingresa la dosis por toma (ej: 1 comprimido).\n` +
      `3. Selecciona la frecuencia en horas (ej: cada 8 horas = 3 veces al día; cada 12 horas = 2 veces al día).\n` +
      `4. Indica el periodo en días (ej: 30 días).\n` +
      `5. El sistema multiplica automáticamente (ej: 1 × 3 tomas/día × 30 días = 90 unidades) y completa la casilla de cantidad a despachar.`;
  }

  // 8. Caso Problemas de Stock o Inventario
  if (
    queryNorm.includes("stock en rojo") ||
    queryNorm.includes("sin stock") ||
    queryNorm.includes("medicamento agotado") ||
    queryNorm.includes("subir excel")
  ) {
    return `${saludo}\n\nSobre el stock y disponibilidad en farmacia:\n\n` +
      `• **Colores de stock:** En la lista de inventario, el verde indica stock suficiente, el amarillo stock bajo (10 unidades o menos) y el rojo stock agotado (0 unidades).\n` +
      `• **Al autorizar:** Si un medicamento no tiene stock suficiente, se debe coordinar con el químico farmacéutico o elegir un equivalente disponible.\n` +
      `• **Para reponer inventario:** El químico farmacéutico o administrador debe ir a la pestaña *'Inventario (Stock)'*, hacer clic en *'Subir Excel (Stock Master)'* y cargar la planilla oficial actualizada.`;
  }

  return null;
}

/**
 * Consulta a la IA de Google Gemini (Free Tier) si hay clave configurada en el entorno.
 */
export async function consultarGeminiIA(
  consulta: string,
  apiKey: string,
  rolUsuario?: "medico" | "funcionario" | "admin",
  nombreUsuario?: string
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

  const articulosTexto = CONOCIMIENTO_SISTEMA.map((a) => {
    return `### TEMA: ${a.titulo} (Categoría: ${a.categoria})\nResumen: ${a.resumen}\nPasos:\n${(a.pasos || []).map((p) => `- ${p}`).join("\n")}\nDetalles clave:\n${(a.detallesImportantes || []).map((d) => `* ${d}`).join("\n")}`;
  }).join("\n\n");

  const systemPrompt = `Eres el Asistente Experto del Sistema de Recetas de Farmacia del CESFAM Rodelillo.
Tu función es guiar a médicos y funcionarios sobre el funcionamiento de la web de recetas.
El usuario es: ${nombreUsuario ? nombreUsuario + " (" + rolUsuario + ")" : rolUsuario || "personal del CESFAM"}.

REGLAS DE COMUNICACIÓN Y SEGURIDAD:
1. NUNCA uses la palabra 'colega'. Trata con respeto profesional: si es médico, dirígete como 'Doctor/a' o 'Dr./Dra.'. Si es funcionario, dirígete cordialmente por su nombre o como 'funcionario/a'.
2. SOLO respondes sobre el software de recetas del CESFAM Rodelillo.
3. Si el usuario pide un diagnóstico clínico o recomendaciones de fármacos para enfermedades personales, RECHAZA indicando que por seguridad sanitaria no realizas recomendaciones clínicas.
4. Responde de forma clara, empática, directa y estructurada (1, 2, 3).

BASE DE CONOCIMIENTO:\n${articulosTexto}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: consulta }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });

    if (!response.ok) {
      return consultarModoConversacionalLocal(consulta, rolUsuario, nombreUsuario);
    }

    const data = await response.json();
    const textoRespuesta =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude procesar la consulta en este momento.";

    return {
      texto: textoRespuesta,
      tipo: "exito",
      fuente: "gemini_ia",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  } catch {
    return consultarModoConversacionalLocal(consulta, rolUsuario, nombreUsuario);
  }
}

/**
 * Modo Conversacional Local Inteligente: Razona situaciones clínicas y operativas del CESFAM
 * en lenguaje natural humano sin requerir internet ni APIs externas.
 */
export function consultarModoConversacionalLocal(
  consulta: string,
  rolUsuario?: "medico" | "funcionario" | "admin",
  nombreUsuario?: string,
  historial?: TurnoHistorial[]
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
    const saludo = generarSaludo(rolUsuario, nombreUsuario);
    return {
      texto: `${saludo} Por favor cuéntame qué duda tienes sobre el sistema de recetas (por ejemplo: cómo autorizar recetas, qué hacer con recetas que tienen candado o cómo ingresar pacientes en ventanilla).`,
      tipo: "sin_resultados",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  // 1. Análisis de situaciones específicas y casos complejos
  const respuestaSituacion = analizarSituacionEspecifica(queryNorm, rolUsuario, nombreUsuario);
  if (respuestaSituacion) {
    return {
      texto: respuestaSituacion,
      tipo: "exito",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  // 2. Consideración de contexto del historial previo de la conversación
  let queryEnriquecida = queryNorm;
  if (historial && historial.length > 0) {
    const ultimoMensajeUsuario = historial
      .filter((h) => h.remitente === "usuario")
      .slice(-2)
      .map((h) => normalizarTexto(h.texto))
      .join(" ");
    queryEnriquecida = `${ultimoMensajeUsuario} ${queryNorm}`;
  }

  const palabras = queryEnriquecida.split(" ").filter((w) => w.length >= 3);
  const terminosClave = palabras.filter((w) => !STOP_WORDS.has(w));
  const raicesUsuario = terminosClave.map(obtenerRaiz);

  // 3. Puntuación semántica ponderada
  const puntuados = CONOCIMIENTO_SISTEMA.map((art) => {
    let score = 0;
    const tituloNorm = normalizarTexto(art.titulo);
    const resumenNorm = normalizarTexto(art.resumen);
    const keywordsNorm = art.palabrasClave.map((k) => normalizarTexto(k));
    const raicesArticulo = keywordsNorm.map(obtenerRaiz);

    if (queryNorm.length > 5 && tituloNorm.includes(queryNorm)) score += 60;
    if (queryNorm.length > 5 && resumenNorm.includes(queryNorm)) score += 30;

    for (const kw of keywordsNorm) {
      if (kw.length >= 4 && (queryNorm.includes(kw) || kw.includes(queryNorm))) {
        score += 80;
      }
    }

    for (const raiz of raicesUsuario) {
      if (obtenerRaiz(tituloNorm).includes(raiz) || tituloNorm.includes(raiz)) score += 35;
      if (raicesArticulo.some((r) => r.includes(raiz) || raiz.includes(r))) score += 30;
      if (resumenNorm.includes(raiz)) score += 15;
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
    const saludo = generarSaludo(rolUsuario, nombreUsuario);
    return {
      texto: `${saludo}\n\nNo tengo un procedimiento registrado para esa consulta específica. Por favor verifica si tu duda se relaciona con autorizaciones en Mi Panel, ingreso de solicitudes, alertas de colores o gestión de stock.`,
      tipo: "sin_resultados",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  const art = resultados[0];
  const saludo = generarSaludo(rolUsuario, nombreUsuario);
  let respuestaHumana = `${saludo}\n\n${art.resumen}\n\n`;

  if (art.pasos && art.pasos.length > 0) {
    respuestaHumana += `**Pasos a seguir:**\n`;
    art.pasos.forEach((p, idx) => {
      const pasoLimpio = p.replace(/^\d+\.\s*/, "");
      respuestaHumana += `${idx + 1}. ${pasoLimpio}\n`;
    });
    respuestaHumana += `\n`;
  }

  if (art.detallesImportantes && art.detallesImportantes.length > 0) {
    respuestaHumana += `💡 **A tener en cuenta:**\n`;
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
 * Función principal que procesa la consulta con memoria de contexto e inteligencia situada.
 */
export async function procesarPreguntaAsistente(
  consulta: string,
  rolUsuario?: "medico" | "funcionario" | "admin",
  nombreUsuario?: string,
  historial?: TurnoHistorial[]
): Promise<MensajeIA> {
  const envKey =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_GEMINI_API_KEY
      : undefined;

  const apiKey =
    envKey ||
    (typeof window !== "undefined" ? localStorage.getItem("cesfam_gemini_api_key") : null);

  if (apiKey && apiKey.trim().length > 10) {
    return await consultarGeminiIA(consulta, apiKey.trim(), rolUsuario, nombreUsuario);
  }

  return consultarModoConversacionalLocal(consulta, rolUsuario, nombreUsuario, historial);
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
      "¿Por qué una receta me sale con candado 🔒?",
      "¿Cómo funciona la opción de 'Vincular a Receta Existente'?",
      "¿Cómo uso el Asistente de Cálculo de Dosis?",
    ];
  }
  if (rol === "funcionario") {
    return [
      "¿Cómo ingreso una receta con el botón '✓ Solicitud Receta'?",
      "¿Cómo ingresar recetas en Maternales o Respiratorias (ERA)?",
      "¿Qué hago si sale advertencia de paciente con recetas vigentes?",
      "¿Cómo imprimo el ticket de una receta completada?",
    ];
  }
  return [
    "¿Qué funciones tiene cada rol en el sistema?",
    "¿Qué significan las alertas roja, amarilla y verde?",
    "¿Cómo subir el Excel de Inventario (Stock Master)?",
    "¿Cómo restaurar una receta desde la papelera?",
  ];
}
