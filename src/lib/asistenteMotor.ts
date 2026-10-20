/**
 * Motor de Inteligencia y Procesamiento de Lenguaje Natural para el Asistente Experto.
 * Comprensión de contexto, situaciones clínicas y administrativas del CESFAM Rodelillo.
 * 100% en cliente, sin APIs externas obligatorias, seguro y adaptado a la terminología real de salud.
 *
 * v2.0 — Motor basado en tabla de intenciones semánticas (intent-table NLP).
 *         Reemplaza el frágil sistema de if-else por detección comprehensiva y ponderada.
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

// ─── UTILIDADES DE NORMALIZACIÓN ─────────────────────────────────────────────

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
  if (palabra.startsWith("pendient")) return "pendient";
  if (palabra.startsWith("complet") || palabra.startsWith("terminad")) return "complet";
  if (palabra.startsWith("renov")) return "renov";
  if (palabra.startsWith("portal") || palabra.startsWith("pacient")) return "portal";
  return palabra.slice(0, Math.min(palabra.length, 6));
}

const STOP_WORDS = new Set([
  "como", "para", "con", "que", "una", "uno", "los", "las", "del", "por", "sobre",
  "este", "esta", "estos", "estas", "hago", "hacer",
  "puedo", "puede", "tengo", "tiene", "debo", "debe", "cual", "cuales", "donde",
  "el", "la", "lo", "un", "unos", "unas", "al",
  "y", "e", "o", "u", "a", "en", "de", "se", "si", "no", "es", "son", "su", "sus",
  "me", "te", "le", "nos", "les", "mi", "mis", "tu", "tus", "ya", "ni",
]);

// ─── SALUDO CONTEXTUAL ────────────────────────────────────────────────────────

/**
 * Saludo contextual profesional y respetuoso (sin la palabra 'colega').
 */
function generarSaludo(rolUsuario?: string, nombreUsuario?: string): string {
  const nombreLimpio = (nombreUsuario || "").trim().split(" ")[0];
  if (rolUsuario === "medico") {
    return nombreLimpio ? `Estimado/a Dr./Dra. ${nombreLimpio}:` : "Estimado/a Doctor/a:";
  }
  if (nombreLimpio) {
    return `Hola ${nombreLimpio}:`;
  }
  return "";
}

function conEncabezado(saludo: string, cuerpo: string): string {
  return saludo ? `${saludo}\n\n${cuerpo}` : cuerpo;
}

// ─── TABLA DE INTENCIONES ─────────────────────────────────────────────────────

interface TablaIntencion {
  id: string;
  senales: Array<string | ((q: string) => boolean)>;
  umbral?: number;
  responder: (query: string, saludo: string, rol?: string) => string;
}

const TABLA_INTENCIONES: TablaIntencion[] = [
  // ──────────────────────────────────────────────────────────────
  // GRUPO A: ESTADOS DE RECETA (el más crítico)
  // ──────────────────────────────────────────────────────────────

  {
    id: "estado-receta-rechazada",
    senales: [
      "rechazad", "rechazada", "rechazado", "rechazo", "fue rechazada",
      "esta rechazada", "saber si fue rechazada", "saber si esta rechazada",
      "como saber si la rechazaron", "como se si esta rechazada",
      "que significa rechazada", "que pasa si la rechazan", "receta rechazada",
      "receta con rechazo", "estado rechazado", "por que fue rechazada",
      "como veo si rechazo", "la rechazaron",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Cuando una receta está en estado **Rechazado** (badge gris), significa que el médico la revisó y no pudo autorizarla.\n\n` +
        `**¿Cómo identificarlo?**\n` +
        `1. En la tabla de la cartera, la fila mostrará el badge gris **'Rechazado'** en la columna Estado.\n` +
        `2. Al abrir la receta (o pasar el cursor), verás el campo **'Motivo del Rechazo'** redactado por el médico (ej: "Dosis inadecuada", "Requiere control presencial").\n` +
        `3. El botón de impresión estará inhabilitado — las recetas rechazadas **no se pueden imprimir**.\n\n` +
        `**¿Qué pasa con el stock?**\n` +
        `El sistema devuelve automáticamente las unidades al inventario si ya habían sido descontadas. No hay pérdida de stock.\n\n` +
        `💡 El motivo queda registrado en el historial de auditoría y el funcionario puede informarlo al paciente para que solicite un nuevo control o corrección.`
      ),
  },

  {
    id: "estado-receta-pendiente",
    senales: [
      "pendient", "pendiente", "esta pendiente", "saber si sigue pendiente",
      "como saber si esta pendiente", "que significa pendiente",
      "estado pendiente", "receta pendiente", "aun pendiente",
      "sin revisar", "no la han revisado", "no la revisaron", "esperando medico",
      "cuando la van a revisar", "todavia no la ven",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Una receta en estado **Pendiente** (badge azul/gris) significa que aún no ha sido revisada ni resuelta por un médico.\n\n` +
        `**¿Cómo identificarlo?**\n` +
        `1. En la columna Estado de la tabla, verás el badge azul **'Pendiente'**.\n` +
        `2. La alerta de color en la fila también cambia según cuánto tiempo lleva activa: Verde → Amarillo → Rojo según los días transcurridos.\n\n` +
        `**¿Quién la resuelve?**\n` +
        `• Si la receta NO tiene candado 🔒: cualquier médico del sector puede abrirla y autorizarla desde *'Mi Panel'*.\n` +
        `• Si tiene candado 🔒: solo el médico asignado (o un administrador que reasigne) puede resolverla.\n\n` +
        `💡 Un funcionario puede usar el buscador de RUT para verificar rápidamente si el estado cambió sin necesidad de hacer scroll en la tabla.`
      ),
  },

  {
    id: "estado-receta-completada",
    senales: [
      "completad", "completada", "completado", "receta completada",
      "esta completada", "fue autorizada", "ya la autorizaron",
      "saber si fue autorizada", "saber si esta lista",
      "como saber si se autorizo", "estado completado", "ya esta lista",
      "lista para entregar", "ya se puede imprimir", "lista para retiro",
      "cuando esta lista", "como saber si ya la aprobaron",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Para saber si una receta ya está **Completada (autorizada)**:\n\n` +
        `1. **Columna Estado:** En la tabla del sector, busca al paciente. Si el badge está en verde **'Completado'**, el médico ya la autorizó.\n` +
        `2. **Botón de Impresora 🖨️:** Pasa el cursor sobre la fila; si el botón azul de la impresora está activo, está completada y lista para imprimir.\n` +
        `3. **Filtro de Estado:** Arriba de la tabla, cambia el filtro a **'Completadas'** o escribe el RUT en el buscador.\n` +
        `4. **Si eres médico:** En *'Mi Panel'*, en la sección *'Historial reciente'* aparecerán las tarjetas en verde.\n\n` +
        `💡 Si el badge es ámbar **'Parcial'**, la receta fue aprobada con algunos medicamentos autorizados y otros rechazados.`
      ),
  },

  {
    id: "estado-receta-vencida",
    senales: [
      "receta vencida", "esta vencida", "vencida", "vencido", "vencidas", "recetas vencidas",
      "que es una receta vencida", "por que esta vencida", "cuando se considera vencida",
      "ya vencio", "plazo vencido", "paso la fecha", "paso el plazo", "supero la fecha",
      "fecha limite paso", "cuanto tiempo tiene", "en cuantos dias vence", "cuando vence",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Una receta se considera **Vencida** cuando superó su fecha límite de atención o acumula más días activa de los configurados (por defecto 5 días).\n\n` +
        `**Señales visuales:**\n` +
        `• 🔴 La fila se marca con **Alerta Roja** en la tabla.\n` +
        `• Las pestañas del programa muestran un **contador rojo pulsante** con el número de recetas en estado crítico.\n\n` +
        `**¿Qué hacer?**\n` +
        `1. El médico debe revisarla a la brevedad desde *'Mi Panel'* o la lista del sector.\n` +
        `2. Si es urgente y el médico asignado no está disponible, el administrador puede reasignarla a otro médico disponible.\n` +
        `3. El administrador puede ajustar los umbrales de días para alerta desde el panel de Configuración (⚙).`
      ),
  },

  {
    id: "estado-receta-parcial",
    senales: [
      "parcial", "autorizacion parcial", "estado parcial", "algunos si y otros no",
      "autorizo algunos", "rechazo algunos", "aprobaron algunos medicamentos",
      "no autorizaron todos", "solo algunos farmacos", "badge ambar",
    ],
    responder: (_q, saludo, rol) =>
      conEncabezado(
        saludo,
        `El estado **Parcial** (badge ámbar) indica que el médico revisó la receta con múltiples medicamentos y:\n\n` +
        `• Autorizó **al menos uno** de los fármacos.\n` +
        `• Rechazó **al menos uno** indicando su motivo clínico específico.\n\n` +
        `${rol === "medico"
          ? `**Para un médico:** En la ventana de decisión médica verás cada fármaco de la receta de forma independiente. Marca como 'Rechazado' solo el que no corresponde, escribe el motivo, y deja los demás en 'Autorizado'.\n\n`
          : `**Para un funcionario:** La receta queda como Completada/Parcial y el ticket de impresión listará los fármacos aprobados en verde y el rechazado tachado en rojo con el motivo.\n\n`
        }` +
        `💡 Esto permite despachar los medicamentos que el paciente sí necesita sin necesidad de rechazar toda la solicitud.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO B: CANDADO Y ASIGNACIÓN
  // ──────────────────────────────────────────────────────────────

  {
    id: "candado-asignacion",
    senales: [
      "candado", "bloqueada", "no puedo autorizar",
      (q) => q.includes("otro") && (q.includes("medico") || q.includes("doctor")),
      "asignada a otro", "receta de otro medico", "la receta es de otro",
      "no me deja abrir", "sin permiso para autorizar",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El candado 🔒 en una receta significa que fue **asignada nominalmente a un médico específico**. Solo ese médico (o un administrador) tiene permisos para abrirla y autorizarla.\n\n` +
        `**¿Qué puedo hacer?**\n` +
        `1. Si el médico asignado está disponible: pídele que ingrese a *'Mi Panel'* y la atienda desde allí.\n` +
        `2. Si no está de turno o hay urgencia: solicita al **químico farmacéutico o administrador** que reasigne la receta a tu nombre desde la administración.\n` +
        `3. Las recetas **sin candado** (sin médico asignado) están disponibles para cualquier médico del sector.\n\n` +
        `💡 Esta protección existe para garantizar la responsabilidad clínica y la trazabilidad de la prescripción.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO C: SOLICITUD GENÉRICA / SIN MEDICAMENTO
  // ──────────────────────────────────────────────────────────────

  {
    id: "solicitud-generica-sin-med",
    senales: [
      "solicitud generica", "solicitud receta", "sin medicamento",
      "no se el medicamento", "paciente no sabe", "sin remedio especifico",
      "no tiene receta especifica", "solicitud s med", "boton solicitud",
      (q) => q.includes("medicamento") && (q.includes("no se") || q.includes("desconoce") || q.includes("sin") || q.includes("no sabe")),
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Si en ventanilla atiendes a un paciente y no conoces el medicamento exacto, usa la **Solicitud Genérica**:\n\n` +
        `1. En el formulario de *Nueva Solicitud*, haz clic en **'⚕ Solicitud Receta'** (botón superior derecho).\n` +
        `2. El botón cambiará a **'✓ Solicitud Receta'** y el buscador de inventario se ocultará.\n` +
        `3. Puedes escribir una nota descriptiva en el campo de texto (ej: *"Paciente viene a control, solicita renovación de tratamiento crónico"*).\n` +
        `4. Al guardar, la receta aparece en el panel del médico con el distintivo **'📋 Solicitud s/med'**. El médico tratante elegirá el fármaco, presentación y unidades al autorizar.\n\n` +
        `💡 Esto evita que el funcionario seleccione por error una concentración o presentación incorrecta.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO D: AUTORIZACIÓN PARCIAL / MÚLTIPLES FÁRMACOS
  // ──────────────────────────────────────────────────────────────

  {
    id: "autorizacion-parcial",
    senales: [
      "autorizar algunos", "rechazar solo uno", "rechazar un medicamento",
      "multiples farmacos", "varios farmacos", "dos medicamentos", "tres medicamentos",
      "receta con varios", "un farmaco si y el otro no",
      (q) => q.includes("medicament") && (q.includes("uno") || q.includes("solo") || q.includes("varios")),
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El sistema soporta **Autorización Parcial** en recetas con múltiples fármacos:\n\n` +
        `1. En la ventana de decisión médica verás la lista de cada medicamento de forma independiente.\n` +
        `2. Marca como **'Rechazado'** solo el fármaco que no corresponde e ingresa el motivo clínico obligatorio.\n` +
        `3. Los demás medicamentos permanecen **'Autorizados'** con su cantidad y auto-renovación.\n` +
        `4. Al confirmar, la receta queda en **'Completada'** con el badge ámbar **'Parcial (X de Y autorizados)'**.\n` +
        `5. El Ticket impreso muestra los fármacos aprobados normalmente y el rechazado tachado en rojo con su motivo.\n\n` +
        `💡 Esto permite despachar los medicamentos válidos sin tener que rechazar toda la solicitud del paciente.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO E: IMPRESIÓN DE TICKET
  // ──────────────────────────────────────────────────────────────

  {
    id: "impresion-ticket",
    senales: [
      "imprimir", "ticket", "no puedo imprimir", "no sale la impresora",
      "comprobante", "imprimir receta", "imprimir ticket", "como imprimo",
      "boton impresora", "cuando puedo imprimir", "no imprime",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Sobre la impresión del comprobante de receta:\n\n` +
        `1. **Requisito:** El botón de la impresora (azul 🖨️) **solo está disponible en recetas con estado 'Completado'**. No se pueden imprimir recetas Pendientes, Rechazadas ni Vencidas.\n` +
        `2. **Cómo imprimir:** En la tabla del sector, pasa el cursor sobre la fila del paciente y presiona el botón azul de impresora.\n` +
        `3. Se abrirá la vista previa con los datos del paciente, sector, fármacos autorizados y firma del médico.\n` +
        `4. En recetas con **Autorización Parcial**, los medicamentos no autorizados salen tachados en rojo con su motivo.\n\n` +
        `💡 El RUT se imprime en formato estándar AVIS/Rayen (12345678-9).`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO F: ALERTAS DE COLORES
  // ──────────────────────────────────────────────────────────────

  {
    id: "alertas-colores",
    senales: [
      "alerta roja", "color rojo", "rojo", "alerta amarilla", "amarilla",
      "color verde", "que significa el color", "que significa la alerta",
      "contador rojo", "pestana roja", "por que sale rojo", "urgente",
      "que es la alerta", "colores de la tabla",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Los colores del tablero indican el nivel de urgencia de cada receta:\n\n` +
        `• 🔴 **Rojo / Vencida:** La receta ya superó la fecha límite o lleva más días activa de los permitidos (por defecto 5 días). Requiere atención médica **inmediata**. Las pestañas muestran un contador numérico rojo pulsante.\n` +
        `• 🟡 **Amarillo / Por vencer:** Está a 3 días o menos de su fecha límite. Conviene revisarla antes de que entre en zona crítica.\n` +
        `• 🟢 **Verde / Normal:** Ingresada dentro del plazo estándar o ya autorizada (Completada).\n\n` +
        `💡 El administrador puede personalizar los umbrales de días para alerta desde el panel de Configuración (⚙).`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO G: BUSCAR / RECETA DESAPARECIDA
  // ──────────────────────────────────────────────────────────────

  {
    id: "receta-no-encontrada",
    senales: [
      "no encuentro", "no aparece", "se borro", "desaparecio",
      "donde esta la receta", "no la veo", "no esta en la lista",
      "busco la receta", "no encuentro al paciente",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Si no encuentras una receta ingresada:\n\n` +
        `1. **Verifica la pestaña:** Asegúrate de estar en el programa correcto (Controladas, Crónicas, Maternales o ERA) y en el sector correcto (A, B o CECOSF).\n` +
        `2. **Revisa los filtros:** Comprueba que el filtro de estado esté en **'Todos los estados'** (no solo Pendientes).\n` +
        `3. **Usa el buscador:** Escribe el RUT (formato 12345678-9) o el apellido del paciente en la barra de búsqueda.\n` +
        `4. **Papelera:** Si fue eliminada por error, el administrador puede entrar a la Papelera y presionar **'Restaurar'**.\n\n` +
        `💡 Las recetas nunca desaparecen solas; todas las eliminaciones van a la Papelera con motivo registrado.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO H: HISTORIAL DE AUDITORÍA
  // ──────────────────────────────────────────────────────────────

  {
    id: "auditoria-historial",
    senales: [
      "auditoria", "historial", "quien cambio", "quien autorizo",
      "quién modifico", "quien la creo", "trazabilidad", "log", "reloj morado",
      "cuando se creo", "modificaciones de la receta",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Cada receta tiene un **registro inalterable de auditoría** para trazabilidad médica y legal:\n\n` +
        `1. Pasa el cursor sobre la fila del paciente y presiona el **icono de Reloj morado** (o botón de historial).\n` +
        `2. Se desplegará el panel **'Historial de Auditoría'** con entradas cronológicas.\n` +
        `3. Cada entrada muestra: nombre del funcionario/médico, correo, fecha, hora y el cambio realizado (valor anterior → valor nuevo).\n` +
        `4. Incluye creación, modificaciones, fármacos agregados (➕) o retirados (➖), envío a papelera y restauraciones.\n\n` +
        `💡 El historial **no puede ser borrado ni alterado** por ningún usuario, garantizando total transparencia.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO I: PAPELERA Y RESTAURACIÓN
  // ──────────────────────────────────────────────────────────────

  {
    id: "papelera-restaurar",
    senales: [
      "papelera", "restaurar", "eliminar receta", "borrar receta",
      "se elimino por error", "recuperar receta", "eliminar definitivo",
      "receta eliminada", "motivo de eliminacion",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Las recetas eliminadas no se borran permanentemente de inmediato — van a una **Papelera segura** (soft-delete):\n\n` +
        `**Para enviar a papelera:**\n` +
        `1. Presiona el icono de papelera en la fila. Se pedirá un **Motivo obligatorio** (ej: "Solicitud duplicada por error").\n\n` +
        `**Para restaurar:**\n` +
        `2. El administrador abre la Papelera (desde la rueda ⚙ o las pestañas de administración).\n` +
        `3. Cada tarjeta muestra quién la eliminó, cuándo y el motivo.\n` +
        `4. Presiona **'Restaurar'** (verde): la receta vuelve a su estado original en el sector exacto.\n` +
        `5. **'Eliminar definitivo'** (rojo): borra permanente e irreversiblemente (requiere doble confirmación).\n\n` +
        `⚠️ Solo los administradores pueden ver la papelera y ejecutar estas acciones.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO J: INVENTARIO / STOCK / EXCEL
  // ──────────────────────────────────────────────────────────────

  {
    id: "inventario-stock",
    senales: [
      "stock", "inventario", "excel", "subir excel", "stock master",
      "medicamento agotado", "sin stock", "stock en rojo", "stock bajo",
      "actualizar inventario", "planilla stock",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Sobre el inventario y stock de medicamentos:\n\n` +
        `**Colores de stock en la tabla:**\n` +
        `• 🟢 Verde: Stock suficiente.\n` +
        `• 🟡 Amarillo: Stock bajo (10 unidades o menos).\n` +
        `• 🔴 Rojo: Agotado (0 unidades).\n\n` +
        `**Para actualizar el inventario (solo Químico/Admin):**\n` +
        `1. Ingresa a la pestaña *'Inventario (Stock)'*.\n` +
        `2. Haz clic en **'Subir Excel (Stock Master)'** y carga la planilla oficial (.xlsx, .xls o .csv).\n` +
        `3. Verifica la vista previa con el total de ítems detectados.\n` +
        `4. Presiona **'Confirmar y Subir Stock'**.\n\n` +
        `⚠️ Al confirmar, la planilla **reemplaza** el stock actual del sistema. Se recomienda cargarla al inicio de la jornada o en cortes oficiales de inventario.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO K: AUTO-RENOVACIÓN
  // ──────────────────────────────────────────────────────────────

  {
    id: "auto-renovacion",
    senales: [
      "renovacion", "auto renovacion", "renovacion automatica",
      "se renueva sola", "cuantos meses", "mes siguiente", "ciclo de renovacion",
      "renovar receta", "medicamento mensual", "se descuenta cada mes",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El sistema permite configurar **Auto-Renovación** al momento de autorizar una receta crónica:\n\n` +
        `1. En la ventana de decisión médica, el médico puede seleccionar la **cantidad de meses** (1 a 6 meses).\n` +
        `2. Una vez activada, el sistema descuenta automáticamente del stock las unidades correspondientes **al inicio de cada mes** por la cantidad de ciclos configurados.\n` +
        `3. No es necesario que el paciente vuelva cada mes — el sistema gestiona los ciclos de entrega automáticamente.\n` +
        `4. Al vencer el ciclo, la receta regresa a estado Pendiente para que el médico evalúe si corresponde renovar el tratamiento.\n\n` +
        `💡 Ideal para tratamientos crónicos estables (hipertensión, diabetes, etc.) que no requieren control médico mensual.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO L: PORTAL PACIENTE
  // ──────────────────────────────────────────────────────────────

  {
    id: "portal-paciente",
    senales: [
      "portal", "portal paciente", "el paciente busca su receta",
      "el paciente quiere ver", "como busca el paciente", "consulta paciente",
      "el paciente puede ver", "donde el paciente ve", "paciente consulta estado",
      "aplicacion para pacientes", "web para pacientes",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El sistema cuenta con un **Portal Paciente** (aplicación web separada) donde los usuarios pueden consultar el estado de su receta sin necesidad de contactar a la farmacia:\n\n` +
        `1. El paciente ingresa al Portal Paciente con su **RUT** (formato 12345678-9).\n` +
        `2. El sistema busca el estado de su receta usando un **hash SHA-256 salted** del RUT — el paciente consulta sin exponer su identidad en la nube.\n` +
        `3. La colección pública **no almacena nombres ni diagnósticos** — solo el estado (Pendiente, Completada, Rechazada) y datos de retiro.\n\n` +
        `💡 Esto reduce consultas presenciales o telefónicas a la farmacia para saber si la receta ya está lista.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO M: VINCULAR RECETA EXISTENTE / DUPLICADOS
  // ──────────────────────────────────────────────────────────────

  {
    id: "vincular-duplicados",
    senales: [
      "vincular", "receta vigente", "duplicada", "ya tiene receta", "misma receta",
      "aviso rut", "paciente tiene receta activa", "banner amarillo",
      "agregar farmaco a receta existente",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El sistema tiene un **motor de prevención de duplicidad** por RUT:\n\n` +
        `• **Si el paciente ya tiene una receta activa en el MISMO programa** (ej: Crónicas): aparecerá un banner amarillo de advertencia. En vista médica, el médico verá el botón **'Vincular a Receta Existente'**. Al presionarlo, el nuevo fármaco se añade a la receta previa en lugar de crear un duplicado.\n\n` +
        `• **Si la receta activa es de OTRO programa** (ej: Crónico con una nueva Maternal): el sistema muestra un aviso informativo pero permite crear la solicitud independiente sin bloquear.\n\n` +
        `💡 Esto asegura que no se dupliquen entregas de stock ni se emitan tickets paralelos para el mismo paciente.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO N: ASISTENTE DE CÁLCULO DE DOSIS
  // ──────────────────────────────────────────────────────────────

  {
    id: "calculo-dosis",
    senales: [
      "calcular dosis", "calcular cantidad", "asistente de calculo",
      "cada 8 horas", "cada 12 horas", "cada 24 horas", "cuantas unidades",
      "cuantos comprimidos", "calculo de farmacos", "cuantas cajas",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Para calcular la cantidad de unidades a despachar sin errores matemáticos:\n\n` +
        `1. En el modal médico, haz clic en **'Asistente de cálculo'**.\n` +
        `2. Ingresa la **dosis por toma** (ej: 1 comprimido).\n` +
        `3. Selecciona la **frecuencia en horas** (ej: cada 8 horas = 3 tomas/día; cada 12h = 2 tomas; cada 24h = 1 toma).\n` +
        `4. Indica el **periodo en días** (ej: 30 días para un mes regular).\n` +
        `5. El sistema multiplica automáticamente (ej: 1 × 3 tomas/día × 30 días = **90 unidades**) y rellena la casilla de cantidad.\n\n` +
        `💡 El médico siempre puede ajustar el total manualmente si necesita un margen adicional.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO O: INGRESAR NUEVA SOLICITUD
  // ──────────────────────────────────────────────────────────────

  {
    id: "nueva-solicitud",
    senales: [
      "nueva solicitud", "ingresar receta", "crear receta", "agregar receta",
      "como ingreso", "como ingreso una receta", "como creo una receta",
      "boton nueva solicitud", "formulario de solicitud",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Para registrar una nueva solicitud de receta:\n\n` +
        `1. Selecciona la **pestaña correcta** según el programa y sector (ej: Crónicas A, Controladas B, Maternales CECOSF, Respiratorias A).\n` +
        `2. Presiona el botón azul **'Nueva Solicitud'** sobre la tabla (derecha).\n` +
        `3. Escribe el **Nombre completo** del paciente y el **RUT** (formato 12345678-9 — el sistema valida con Módulo 11 automáticamente).\n` +
        `4. En *Medicamento Solicitado*, busca en el inventario O activa **'✓ Solicitud Receta'** si no sabes el fármaco exacto.\n` +
        `5. Define opcionalmente la **Fecha Límite** si hay un plazo perentorio.\n` +
        `6. Asigna un médico tratante o déjalo *'Sin asignar'* para que cualquier médico del sector lo tome.\n` +
        `7. Haz clic en **'Guardar Registro'**. Quedará en estado **'Pendiente'** y visible para los médicos.\n\n` +
        `⚠️ Los funcionarios no pueden autorizar recetas — eso es exclusivo del rol médico.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO P: ROLES Y PERMISOS
  // ──────────────────────────────────────────────────────────────

  {
    id: "roles-permisos",
    senales: [
      "roles", "permisos", "que puedo hacer", "que puede hacer un medico",
      "diferencia entre roles", "funcionario vs medico", "quimico farmaceutico",
      "super admin", "superadmin", "admin", "que puede cada uno",
      "permisos del sistema", "insignias",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El sistema diferencia cuatro perfiles de acceso:\n\n` +
        `🩺 **Médico:** Accede a *'Mi Panel'*, autoriza o rechaza recetas (totales o parciales), calcula dosis con el asistente de cálculo y define auto-renovaciones.\n\n` +
        `📋 **Funcionario:** Ingresa nuevas solicitudes de pacientes, puede usar *'✓ Solicitud Receta'* (sin medicamento específico) y navega las carteras del sector.\n\n` +
        `🧪 **Químico / Admin:** Administra el inventario (Excel), revisa estadísticas globales, gestiona la papelera y configura los tiempos de alerta.\n\n` +
        `🛡️ **Super Administrador:** Permisos correctivos especiales para auditoría y edición directa en casos excepcionales.\n\n` +
        `💡 Un usuario puede tener múltiples roles activos simultáneamente. Las insignias (🩺 o 📋) en la barra superior confirman tus permisos activos.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO Q: SEGURIDAD / CIFRADO / PRIVACIDAD
  // ──────────────────────────────────────────────────────────────

  {
    id: "seguridad-datos",
    senales: [
      "seguridad", "cifrado", "privacidad", "datos personales",
      "aes", "rut cifrado", "encriptado", "proteccion de datos", "ley de salud",
      "donde se guardan los datos",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `El sistema aplica estrictos estándares de privacidad:\n\n` +
        `• **Cifrado AES-256 en cliente:** El Nombre y RUT del paciente se cifran en el navegador *antes* de transmitirse a la nube. Nunca viajan en texto plano.\n` +
        `• **Hash SHA-256 salted:** Para las consultas del Portal Paciente, el RUT se convierte en un identificador hash irreversible. La colección pública no almacena nombres ni diagnósticos.\n` +
        `• **Cierre de sesión:** Siempre presiona el botón de salida 🚪 al terminar el turno, especialmente en computadores compartidos de boxes y mesones.\n\n` +
        `💡 Todas las acciones quedan firmadas a tu nombre en el historial de auditoría — nunca compartas tu clave de acceso.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO R: PROBLEMAS DE ACCESO / LOGIN
  // ──────────────────────────────────────────────────────────────

  {
    id: "problemas-acceso-login",
    senales: [
      "no puedo entrar", "credenciales incorrectas", "acceso denegado",
      "error login", "clave incorrecta", "contrasena", "no me deja entrar",
      "no reconoce mi usuario", "no tengo acceso",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Existen dos tipos de errores comunes al iniciar sesión:\n\n` +
        `1. **'Credenciales incorrectas':** El correo institucional o la contraseña están mal escritos. Verifica mayúsculas, espacios innecesarios y que estés usando el correo corporativo.\n` +
        `2. **'Acceso Denegado':** Tu cuenta existe pero no tiene activado el acceso al módulo de Farmacia o tu perfil no está creado en la base de datos.\n\n` +
        `**¿Qué hacer?**\n` +
        `Contacta al encargado de informática del CESFAM o escribe a **difusionrodelillo@cmvalparaiso.cl** para que revisen tu acceso o restablezcan tu contraseña.\n\n` +
        `💡 El sistema no borra cuentas por inactividad ni cambia contraseñas automáticamente.`
      ),
  },

  // ──────────────────────────────────────────────────────────────
  // GRUPO S: PROGRAMAS ESPECIALES (MATERNALES / ERA)
  // ──────────────────────────────────────────────────────────────

  {
    id: "programas-especiales",
    senales: [
      "maternal", "maternales", "respiratorio", "respiratorias", "era",
      "embarazo", "gestante", "inhalador", "salbutamol", "asma", "epoc",
      "programa maternal", "programa respiratorio",
    ],
    responder: (_q, saludo) =>
      conEncabezado(
        saludo,
        `Además de Crónicas y Controladas, el sistema tiene carteras para programas especiales:\n\n` +
        `🤰 **Maternales:** Recetas para pacientes gestantes o en puerperio. Disponible en sectores A, B y CECOSF. Tienen distintivo morado.\n\n` +
        `🫁 **Respiratorias (ERA):** Pacientes en programa de enfermedades respiratorias, asma, EPOC o terapia inhalatoria. Disponible en sectores A, B y CECOSF. Distintivo verde azulado (teal).\n\n` +
        `Ambos programas tienen las mismas capacidades que las demás carteras:\n` +
        `• Alertas de colores por fecha límite\n` +
        `• Soporte multi-fármaco\n` +
        `• Historial de auditoría completo\n` +
        `• Trazabilidad de inventario\n\n` +
        `💡 Cada programa mantiene sus contadores de pendientes y urgentes separados para no mezclar metas del centro de salud.`
      ),
  },
];

// ─── MOTOR DE INTENCIONES ─────────────────────────────────────────────────────

/**
 * Busca la mejor intención en la tabla según las señales que activa la consulta.
 * Retorna la respuesta del handler si hay match, o null si ninguno aplica.
 */
function detectarIntencion(
  queryNorm: string,
  rolUsuario?: string,
  nombreUsuario?: string
): string | null {
  const saludo = generarSaludo(rolUsuario, nombreUsuario);

  let mejorMatch: { intencion: TablaIntencion; score: number } | null = null;

  for (const intencion of TABLA_INTENCIONES) {
    const umbral = intencion.umbral ?? 1;
    let score = 0;
    let hits = 0;

    for (const senal of intencion.senales) {
      if (typeof senal === "function") {
        if (senal(queryNorm)) {
          hits++;
          score += 15;
        }
      } else {
        const senalNorm = normalizarTexto(senal);
        if (queryNorm.includes(senalNorm)) {
          hits++;
          // Frases de varias palabras pesan mucho más que palabras sueltas
          const esFrase = senalNorm.includes(" ");
          score += esFrase ? 25 : 8;
        }
      }
    }

    if (hits >= umbral && score > 0) {
      if (!mejorMatch || score > mejorMatch.score) {
        mejorMatch = { intencion, score };
      }
    }
  }

  if (mejorMatch) {
    return mejorMatch.intencion.responder(queryNorm, saludo, rolUsuario);
  }

  return null;
}

// ─── CONSULTA GEMINI ──────────────────────────────────────────────────────────

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
1. NUNCA uses la palabra 'colega'. Trata con respeto profesional: si es médico, dirígete como 'Doctor/a' o 'Dr./Dra.'. Si es funcionario, dirígete por su nombre o como 'funcionario/a'.
2. SOLO respondes sobre el software de recetas del CESFAM Rodelillo.
3. Si el usuario pide un diagnóstico clínico o recomendaciones de fármacos para enfermedades personales, RECHAZA indicando que por seguridad sanitaria no realizas recomendaciones clínicas.
4. Responde de forma clara, directa y estructurada (1, 2, 3). No uses la palabra 'colega'.
5. Las respuestas deben ser concisas y prácticas. Evita saludos largos o saludos robóticos genéricos.

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

// ─── MODO LOCAL CONVERSACIONAL ────────────────────────────────────────────────

/**
 * Modo Conversacional Local Inteligente: Razona situaciones clínicas y operativas del CESFAM
 * en lenguaje natural humano sin requerir internet ni APIs externas.
 * v2.0 — Motor basado en tabla de intenciones semánticas.
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
      texto: conEncabezado(
        saludo,
        "Por favor cuéntame qué duda tienes sobre el sistema de recetas (por ejemplo: cómo autorizar recetas, qué hacer con recetas que tienen candado o cómo ingresar pacientes en ventanilla)."
      ),
      tipo: "sin_resultados",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  // ── PASO 1: Evaluar PRIMERO la consulta ACTUAL sin contaminar con historial ──
  const respuestaDirecta = detectarIntencion(queryNorm, rolUsuario, nombreUsuario);
  if (respuestaDirecta) {
    return {
      texto: respuestaDirecta,
      tipo: "exito",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  // ── PASO 2: Solo si la consulta actual es breve/ambigua o no dio match, recurrir a historial ──
  let respuestaConHistorial: string | null = null;
  let queryParaFallback = queryNorm;

  if (historial && historial.length > 0) {
    const ultimoMensajeUsuario = historial
      .filter((h) => h.remitente === "usuario")
      .slice(-1)
      .map((h) => normalizarTexto(h.texto))
      .join(" ");

    const pareceContinuacion =
      queryNorm.length < 30 ||
      queryNorm.startsWith("y ") ||
      queryNorm.startsWith("pero ") ||
      queryNorm.startsWith("entonces ") ||
      queryNorm.startsWith("como ") ||
      queryNorm.startsWith("donde ") ||
      queryNorm.startsWith("quien ");

    if (pareceContinuacion && ultimoMensajeUsuario) {
      queryParaFallback = `${ultimoMensajeUsuario} ${queryNorm}`;
      respuestaConHistorial = detectarIntencion(queryParaFallback, rolUsuario, nombreUsuario);
    }
  }

  if (respuestaConHistorial) {
    return {
      texto: respuestaConHistorial,
      tipo: "exito",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  // ── PASO 3: Scoring semántico ponderado como fallback ────────────────────
  const palabras = queryParaFallback.split(" ").filter((w) => w.length >= 3);
  const terminosClave = palabras.filter((w) => !STOP_WORDS.has(w));
  const raicesUsuario = terminosClave.map(obtenerRaiz);

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
      texto: conEncabezado(
        saludo,
        "No tengo un procedimiento registrado para esa consulta específica. Te sugiero preguntar sobre: autorizaciones en *Mi Panel*, ingreso de solicitudes, alertas de colores, gestión de stock, historial de auditoría o papelera."
      ),
      tipo: "sin_resultados",
      fuente: "motor_local",
      sugerencias: obtenerSugerenciasPorRol(rolUsuario),
    };
  }

  const art = resultados[0];
  const saludo = generarSaludo(rolUsuario, nombreUsuario);
  let respuestaHumana = `${art.resumen}\n\n`;

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
    texto: conEncabezado(saludo, respuestaHumana.trim()),
    tipo: "exito",
    fuente: "motor_local",
    articulosRelacionados: resultados.slice(0, 2),
    sugerencias: obtenerSugerenciasPorRol(rolUsuario),
  };
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

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

// ─── SUGERENCIAS POR ROL ──────────────────────────────────────────────────────

/**
 * Preguntas sugeridas por rol.
 */
export function obtenerSugerenciasPorRol(
  rol?: "medico" | "funcionario" | "admin"
): string[] {
  if (rol === "medico") {
    return [
      "¿Cómo autorizo una receta médica en Mi Panel?",
      "¿Qué es la 'Autorización Parcial' y cómo funciona?",
      "¿Por qué una receta me sale con candado 🔒?",
      "¿Cómo funciona la 'Vincular a Receta Existente'?",
      "¿Cómo saber si una receta fue rechazada?",
    ];
  }
  if (rol === "funcionario") {
    return [
      "¿Cómo saber si una receta está rechazada o completada?",
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
    "¿Cómo funciona el Portal Paciente?",
  ];
}
