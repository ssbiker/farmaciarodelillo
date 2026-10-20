/**
 * Base de conocimiento oficial y actualizada para el Asistente Experto Interno.
 * Integra las 45 páginas de la guía de usuario del CESFAM Rodelillo
 * junto con todas las funcionalidades recientes del código.
 */

export interface ArticuloConocimiento {
  id: string;
  titulo: string;
  categoria: "medico" | "funcionario" | "admin" | "alertas" | "recetas" | "inventario" | "seguridad" | "errores";
  rolesRelevantes: ("medico" | "funcionario" | "admin" | "todos")[];
  palabrasClave: string[];
  resumen: string;
  pasos?: string[];
  detallesImportantes?: string[];
  preguntasFrecuentesRelacionadas?: string[];
}

export const CONOCIMIENTO_SISTEMA: ArticuloConocimiento[] = [
  // ─── ROLES Y ACCESOS ──────────────────────────────────────────
  {
    id: "roles-sistema",
    titulo: "¿Qué funciones tiene cada rol en el sistema?",
    categoria: "seguridad",
    rolesRelevantes: ["todos"],
    palabrasClave: ["rol", "roles", "permisos", "medico", "funcionario", "quimico", "admin", "superadmin", "tens", "tecnico", "que puedo hacer"],
    resumen: "El sistema del CESFAM Rodelillo cuenta con perfiles diferenciados para garantizar la separación de funciones y la seguridad en la prescripción:",
    pasos: [
      "🩺 Médico: Accede a 'Mi Panel', autoriza o rechaza recetas (totales o parciales), calcula dosis con el asistente y define auto-renovaciones.",
      "📋 Funcionario: Ingresa nuevas solicitudes de pacientes, puede usar el botón '✓ Solicitud Receta' (sin medicamento específico) y navega por las carteras.",
      "🧪 Químico Farmacéutico / Admin: Administra stock e inventario Excel, revisa estadísticas globales, gestiona papelera y configura tiempos de alerta.",
      "🛡️ Super Administrador: Posee permisos correctivos especiales para auditoría y edición directa de solicitudes en casos excepcionales.",
    ],
    detallesImportantes: [
      "Un usuario puede tener múltiples roles asignados simultáneamente (ej: un Químico con permiso de Médico y Funcionario verá todas las pestañas).",
      "Las insignias en la barra superior (🩺 o 📋) confirman qué permisos tienes activos."
    ]
  },
  {
    id: "error-credenciales-acceso-denegado",
    titulo: "¿Qué hacer si dice 'Credenciales incorrectas' o 'Acceso Denegado'?",
    categoria: "errores",
    rolesRelevantes: ["todos"],
    palabrasClave: ["credenciales incorrectas", "acceso denegado", "error login", "no puedo entrar", "clave", "contraseña", "correo", "login", "permiso"],
    resumen: "Existen dos tipos de errores comunes al iniciar sesión:",
    pasos: [
      "1. 'Credenciales incorrectas': El correo institucional o la contraseña están mal escritos. Verifica mayúsculas y espacios innecesarios.",
      "2. 'Acceso Denegado': Tu cuenta existe pero no tiene activado el acceso al módulo de Farmacia (botón de escudo) o tu perfil no está creado en la base de datos.",
      "3. Solución: Contacta al encargado de informática del CESFAM o escribe a difusionrodelillo@cmvalparaiso.cl para revisar tu acceso o restablecer contraseña."
    ],
    detallesImportantes: [
      "El sistema no cambia contraseñas automáticamente ni borra cuentas por inactividad."
    ]
  },

  // ─── MÉDICOS: MI PANEL Y AUTORIZACIÓN ─────────────────────────
  {
    id: "medico-autorizar-receta",
    titulo: "¿Cómo autorizar una receta médica en Mi Panel?",
    categoria: "medico",
    rolesRelevantes: ["medico", "admin"],
    palabrasClave: ["autorizar", "aprobar", "mi panel", "medico", "como autorizo", "receta pendiente", "completar", "despachar"],
    resumen: "Para autorizar una receta asignada o general desde tu panel médico:",
    pasos: [
      "1. Ingresa a la pestaña 'Mi Panel' en la barra superior.",
      "2. En la sección 'Pendientes asignadas a mí' o 'Sin médico asignado', haz clic en la tarjeta del paciente.",
      "3. Se abrirá la ventana de decisión médica. Los datos del paciente (Nombre y RUT) son de solo lectura para seguridad.",
      "4. Si la receta venía como 'Solicitud de Receta' (s/med), selecciona el fármaco exacto del inventario y define las unidades.",
      "5. Si necesitas calcular la cantidad total, usa el botón del 'Asistente de cálculo' (dosis por toma × horas × días).",
      "6. Selecciona el botón verde 'Autorizar'. Opcionalmente elige la Auto-Renovación (1 a 6 meses).",
      "7. Haz clic en 'Confirmar Decisión'. La receta pasará a 'Completada' y el stock se descontará automáticamente."
    ],
    detallesImportantes: [
      "Si la receta ya está asignada a otro médico con candado 🔒, solo ese médico o un administrador pueden autorizarla.",
      "El stock se descuenta en tiempo real. Si no hay stock disponible, el sistema lo indicará en color rojo."
    ]
  },
  {
    id: "medico-rechazar-receta",
    titulo: "¿Cómo rechazar una receta y qué pasa con el stock?",
    categoria: "medico",
    rolesRelevantes: ["medico", "admin"],
    palabrasClave: ["rechazar", "rechazo", "motivo rechazo", "negar", "devolver stock", "error receta"],
    resumen: "Si una solicitud no corresponde clínicamente o tiene errores:",
    pasos: [
      "1. Abre la receta desde 'Mi Panel' o la lista del sector correspondiente.",
      "2. Haz clic en el botón rojo 'Rechazar'.",
      "3. Es OBLIGATORIO escribir el 'Motivo del Rechazo' en el campo de texto (ej: 'Dosis inadecuada', 'Requiere control médico presencial', 'Medicamento duplicado').",
      "4. Haz clic en 'Confirmar Decisión'."
    ],
    detallesImportantes: [
      "El motivo queda registrado en el historial de auditoría y visible para los funcionarios para que puedan informar al paciente.",
      "Tranquilidad con el stock: Si la receta ya había descontado unidades previamente, el sistema las devuelve de forma automática e íntegra al inventario."
    ]
  },
  {
    id: "autorizacion-parcial-multi-medicamento",
    titulo: "¿Qué es la 'Autorización Parcial' y cómo funciona con múltiples medicamentos?",
    categoria: "medico",
    rolesRelevantes: ["medico", "funcionario", "admin"],
    palabrasClave: ["parcial", "autorizacion parcial", "multi medicamento", "varios medicamentos", "rechazo individual", "items"],
    resumen: "El sistema permite recetas con múltiples fármacos independientes (`items`). Un médico puede autorizar unos y rechazar otros dentro de la misma solicitud:",
    pasos: [
      "1. En la ventana de decisión médica, verás la lista de cada uno de los medicamentos de la receta.",
      "2. Si un fármaco en particular no procede, puedes marcarlo como 'Rechazado' individualmente e indicar su motivo clínico específico.",
      "3. Los demás medicamentos válidos se mantienen autorizados con su cantidad y auto-renovación.",
      "4. Al guardar, la receta queda en estado 'Completada' con el badge ámbar 'Parcial (X de Y autorizados)'.",
      "5. En el Ticket impreso, los fármacos aprobados se listan normalmente y el rechazado aparece tachado en rojo con su motivo."
    ],
    detallesImportantes: [
      "Esto evita rechazar toda la receta cuando solo un fármaco tenía objeción, permitiendo despachar los medicamentos que el paciente sí necesita urgentemente."
    ]
  },
  {
    id: "vincular-receta-existente",
    titulo: "¿Cómo funciona la detección de recetas vigentes y la opción 'Vincular'?",
    categoria: "recetas",
    rolesRelevantes: ["medico", "funcionario", "admin"],
    palabrasClave: ["vincular", "receta vigente", "duplicado", "duplicada", "aviso rut", "misma receta", "agregar farmaco"],
    resumen: "Al ingresar el RUT de un paciente, el sistema revisa si tiene recetas activas en curso para evitar prescripciones duplicadas:",
    pasos: [
      "1. Si el paciente ya tiene una receta vigente en el MISMO programa (ej: Crónica), aparece un banner amarillo de advertencia.",
      "2. En vista médica, el doctor verá el botón 'Vincular a Receta Existente'.",
      "3. Al hacer clic en Vincular, se cargan los medicamentos previos de esa receta y se añade un nuevo espacio para agregar el nuevo fármaco.",
      "4. Así, en lugar de generar dos recetas separadas para el mismo paciente, quedan unificadas en un solo registro con trazabilidad limpia."
    ],
    detallesImportantes: [
      "Si el paciente tiene recetas activas en OTROS programas (ej: es Crónico pero se le está ingresando una Maternal o ERA), el sistema solo emite un aviso informativo sin bloquear la creación."
    ]
  },
  {
    id: "asistente-calculo-dosis",
    titulo: "¿Cómo usar el Asistente de Cálculo de Dosis?",
    categoria: "medico",
    rolesRelevantes: ["medico"],
    palabrasClave: ["asistente calculo", "dosis", "calcular cantidad", "horas", "dias", "comprimidos", "cuantas unidades"],
    resumen: "Para evitar errores matemáticos al calcular la cantidad de comprimidos o unidades a despachar:",
    pasos: [
      "1. En el modal médico, abre la herramienta 'Asistente de cálculo'.",
      "2. Ingresa la 'Dosis por toma' (ej: 1 comprimido).",
      "3. Ingresa 'Cada cuántas horas' (ej: cada 8 horas = 3 tomas al día; cada 12 horas = 2 tomas; cada 24 horas = 1 toma).",
      "4. Ingresa 'Por cuántos días' (ej: 30 días para un mes regular).",
      "5. El sistema calcula automáticamente el total (ej: 1 cada 8h × 30 días = 90 comprimidos) y rellena la casilla de cantidad."
    ],
    detallesImportantes: [
      "La cantidad final siempre puede ser ajustada manualmente por el médico si se requiere un margen adicional."
    ]
  },

  // ─── FUNCIONARIOS: INGRESO DE SOLICITUDES ───────────────────────
  {
    id: "funcionario-nueva-solicitud",
    titulo: "¿Cómo ingresar una nueva solicitud de receta?",
    categoria: "funcionario",
    rolesRelevantes: ["funcionario", "admin"],
    palabrasClave: ["nueva solicitud", "ingresar receta", "crear receta", "funcionario", "formulario", "como ingreso", "rut"],
    resumen: "Para registrar la solicitud de un paciente:",
    pasos: [
      "1. Selecciona la pestaña del tipo y sector correspondiente (ej: Crónicas A, Controladas B, Maternales CECOSF o Respiratorias A).",
      "2. Presiona el botón azul 'Nueva Solicitud' ubicado sobre la tabla a la derecha.",
      "3. Escribe el Nombre completo del paciente.",
      "4. Escribe el RUT (formato 12345678-9, el sistema lo formatea y valida automáticamente con Módulo 11).",
      "5. En Medicamento Solicitado, puedes buscar en el inventario O activar el botón '✓ Solicitud Receta' si no sabes el fármaco exacto.",
      "6. Define opcionalmente la 'Fecha Límite de Atención' si la entrega tiene un plazo perentorio.",
      "7. Puedes asignar un médico tratante específico o dejarlo 'Sin asignar' para que cualquier doctor del sector lo tome.",
      "8. Haz clic en 'Guardar Registro'. Quedará en estado 'Pendiente' visible para los médicos."
    ],
    detallesImportantes: [
      "Los funcionarios NO pueden autorizar ni rechazar recetas; el estado queda fijo en 'Pendiente' para garantizar la separación de roles.",
      "Si el RUT es inválido, el sistema avisará y no permitirá guardar hasta corregirlo."
    ]
  },
  {
    id: "solicitud-receta-generica",
    titulo: "¿Qué es el botón '✓ Solicitud Receta' (Solicitud Genérica)?",
    categoria: "funcionario",
    rolesRelevantes: ["funcionario", "medico", "admin"],
    palabrasClave: ["solicitud receta", "sin medicamento", "generica", "no se el medicamento", "solicitud_receta", "toggle"],
    resumen: "Es una función moderna diseñada para cuando el funcionario recibe al paciente pero no conoce el fármaco exacto:",
    pasos: [
      "1. En el formulario de Nueva Solicitud, haz clic en el botón superior derecho '⚕ Solicitud Receta'.",
      "2. El botón cambiará a verde/ámbar '✓ Solicitud Receta' y el buscador de inventario se reemplazará por una tarjeta informativa.",
      "3. Permite guardar la solicitud indicando en la Nota la situación del paciente (ej: 'Paciente viene por control crónico pendiente').",
      "4. Cuando el médico abra la solicitud en 'Mi Panel', verá la etiqueta '📋 Solicitud s/med' y el doctor seleccionará el fármaco exacto y la dosis requerida."
    ],
    detallesImportantes: [
      "Ahorra tiempo a los funcionarios en ventanilla y evita que elijan por error una presentación o concentración incorrecta."
    ]
  },
  {
    id: "programas-maternal-respiratorio",
    titulo: "¿Cómo funcionan las pestañas Maternales y Respiratorias (ERA)?",
    categoria: "recetas",
    rolesRelevantes: ["todos"],
    palabrasClave: ["maternal", "maternales", "respiratorio", "respiratorias", "era", "embarazo", "inhalador", "salbutamol", "asma", "epoc"],
    resumen: "Además de Crónicas y Controladas, el sistema cuenta con carteras dedicadas para programas especiales de salud pública:",
    pasos: [
      "🤰 Maternales: Recetas para pacientes gestantes o puerperio (Sector A, B, CECOSF). Tienen distintivo morado.",
      "🫁 Respiratorias (ERA): Pacientes en programa de enfermedades respiratorias, asma, EPOC o terapia inhalatoria (Sector A, B, CECOSF). Distintivo verde azulado / teal.",
      "Ambos programas tienen las mismas capacidades de alerta por fecha límite, multi-fármaco y trazabilidad de inventario."
    ],
    detallesImportantes: [
      "Cada programa mantiene separados sus contadores de pendientes y urgentes para no mezclar las metas del centro de salud."
    ]
  },

  // ─── TICKETS E IMPRESIÓN ──────────────────────────────────────
  {
    id: "imprimir-ticket-receta",
    titulo: "¿Cómo y cuándo se puede imprimir el ticket de receta?",
    categoria: "recetas",
    rolesRelevantes: ["todos"],
    palabrasClave: ["imprimir", "ticket", "impresora", "comprobante", "papel", "entregar al paciente", "firma"],
    resumen: "El ticket es el documento comprobante que se entrega al paciente para retirar en el mesón de farmacia:",
    pasos: [
      "1. La receta DEBE estar en estado 'Completada' (autorizada por un médico). No se pueden imprimir recetas pendientes o rechazadas.",
      "2. En la tabla del sector, pasa el cursor sobre la fila del paciente y presiona el botón azul de la 'Impresora' (o ábrelo desde la vista de detalle).",
      "3. Se abrirá la ventana con el formato del ticket con los datos del paciente, sector, fármacos autorizados y firma del médico.",
      "4. Presiona el botón 'Imprimir' y selecciona tu impresora conectada."
    ],
    detallesImportantes: [
      "Si la receta tuvo 'Autorización Parcial', los medicamentos aprobados se imprimen claramente y los rechazados salen tachados con su motivo médico.",
      "El RUT se imprime en formato estándar AVIS (12345678-9)."
    ]
  },

  // ─── ALERTAS Y TIEMPOS ────────────────────────────────────────
  {
    id: "sistema-alertas-colores",
    titulo: "¿Qué significan las alertas roja, amarilla y verde?",
    categoria: "alertas",
    rolesRelevantes: ["todos"],
    palabrasClave: ["alerta roja", "alerta amarilla", "colores", "vencida", "urgente", "contador rojo", "dias activa", "plazo"],
    resumen: "El sistema clasifica las recetas según su urgencia para priorizar la atención diaria:",
    pasos: [
      "🔴 Alerta Roja / Vencida: Superó la 'Fecha Límite' o lleva más días activa que los permitidos en la configuración (por defecto 5 días). Requiere atención médica inmediata. Las pestañas muestran un contador numérico rojo pulsante.",
      "🟡 Alerta Amarilla: Está próxima a vencer su fecha límite o lleva varios días activa (por defecto 3 días). Requiere seguimiento antes de volverse crítica.",
      "🟢 Alerta Verde / Normal: Receta ingresada dentro del plazo estándar, o bien receta 'Completada' debidamente autorizada."
    ],
    detallesImportantes: [
      "Los administradores pueden personalizar la cantidad de días para alerta amarilla y roja desde el panel de Administración (⚙)."
    ]
  },

  // ─── INVENTARIO Y STOCK ───────────────────────────────────────
  {
    id: "inventario-subir-excel",
    titulo: "¿Cómo funciona el inventario y cómo subir la planilla Excel (Stock Master)?",
    categoria: "inventario",
    rolesRelevantes: ["admin"],
    palabrasClave: ["inventario", "stock", "excel", "subir excel", "stock master", "planilla", "quimico", "actualizar stock"],
    resumen: "La pestaña 'Inventario (Stock)' centraliza las existencias de todos los medicamentos del CESFAM:",
    pasos: [
      "1. Ingresa a la pestaña 'Inventario (Stock)' (exclusiva para administradores y químicos).",
      "2. Presiona el botón 'Subir Excel (Stock Master)' y carga el archivo `.xlsx`, `.xls` o `.csv` oficial de farmacia.",
      "3. El sistema detecta dinámicamente las columnas de Código, Nombre del medicamento y Unidades de Stock.",
      "4. Se mostrará una 'Vista Previa' con el total de ítems detectados para verificar los números.",
      "5. Si todo coincide, presiona 'Confirmar y Subir Stock'.",
      "6. Aparecerá el mensaje 'Inventario sincronizado exitosamente'."
    ],
    detallesImportantes: [
      "¡Atención!: Al confirmar, la planilla Excel REEMPLAZA el stock actual del sistema. Se recomienda cargarla al inicio de la jornada o en cortes oficiales de inventario.",
      "Colores de stock en tabla: Verde = stock suficiente; Amarillo = bajo (10 unidades o menos); Rojo = agotado (0 unidades)."
    ]
  },

  // ─── AUDITORÍA Y PAPELERA ─────────────────────────────────────
  {
    id: "auditoria-trazabilidad",
    titulo: "¿Cómo ver quién modificó una receta (Historial de Auditoría)?",
    categoria: "seguridad",
    rolesRelevantes: ["todos"],
    palabrasClave: ["auditoria", "historial", "quien cambio", "quien autorizo", "reloj", "trazabilidad", "cuando se creo", "modificacion"],
    resumen: "Cada receta tiene un registro inalterable de auditoría para trazabilidad médica y legal de fármacos controlados:",
    pasos: [
      "1. Pasa el cursor sobre la fila del paciente y presiona el icono de Reloj morado (o botón de historial).",
      "2. Se desplegará el panel lateral 'Historial de Auditoría'.",
      "3. Muestra en orden cronológico: Creación, Modificación, Fármacos agregados (➕), Fármacos retirados (➖), Envío a papelera o Restauración.",
      "4. Cada entrada indica el nombre del funcionario/médico, correo, fecha, hora y el valor anterior versus el valor nuevo."
    ],
    detallesImportantes: [
      "El historial no se puede borrar ni alterar por ningún usuario, garantizando total transparencia."
    ]
  },
  {
    id: "papelera-recetas-restaurar",
    titulo: "¿Cómo enviar una receta a la papelera y cómo restaurarla?",
    categoria: "recetas",
    rolesRelevantes: ["admin"],
    palabrasClave: ["papelera", "borrar receta", "eliminar", "restaurar", "recuperar", "eliminar definitivo", "motivo eliminacion"],
    resumen: "Para evitar pérdidas accidentales, las recetas eliminadas van primero a una Papelera segura (soft-delete):",
    pasos: [
      "1. Para enviar a papelera: Presiona el icono de papelera en la fila de la receta. Es OBLIGATORIO ingresar el 'Motivo' (ej: 'Solicitud duplicada por error').",
      "2. Para revisar o restaurar: El administrador abre la 'Papelera' desde las pestañas o desde la rueda de Configuración (⚙).",
      "3. Cada tarjeta en la papelera muestra quién la eliminó, la fecha y el motivo.",
      "4. Botón 'Restaurar' (verde): Devuelve la receta a su estado original exactamente en el sector que estaba.",
      "5. Botón 'Eliminar definitivo' (rojo): Borra el registro de forma permanente e irreversible (requiere doble confirmación)."
    ],
    detallesImportantes: [
      "Solo los administradores pueden ver la papelera y ejecutar restauraciones o eliminaciones definitivas."
    ]
  },

  // ─── CONSULTAS DE ESTADO Y BÚSQUEDA ──────────────────────────
  {
    id: "estado-receta-rechazada",
    titulo: "¿Cómo saber si una receta fue rechazada y qué significa?",
    categoria: "recetas",
    rolesRelevantes: ["todos"],
    palabrasClave: [
      "como saber si esta rechazada",
      "receta rechazada",
      "saber si la rechazaron",
      "fue rechazada",
      "estado rechazado",
      "rechazo",
      "motivo de rechazo",
      "por que fue rechazada",
      "como veo si la rechazaron",
      "rechazada",
      "rechazado"
    ],
    resumen: "Cuando una receta pasa a estado Rechazado, significa que el médico evaluó la solicitud y determinó que no procede autorizarla:",
    pasos: [
      "1. Columna Estado: En la tabla de la cartera, la fila muestra el badge gris 'Rechazado'.",
      "2. Motivo del Rechazo: Al hacer clic en la receta o pasar el cursor, verás el motivo redactado por el médico (ej: 'Requiere control presencial', 'Dosis inadecuada').",
      "3. Impresión inhabilitada: Las recetas rechazadas no se pueden imprimir (el botón de impresora permanece bloqueado).",
      "4. Devolución de Stock: Si la solicitud había reservado o descontado stock, el sistema lo reintegra automáticamente al inventario sin pérdidas.",
      "5. En el mesón: El funcionario puede consultar el motivo exacto para orientar al paciente sobre los pasos a seguir (ej: solicitar hora médica)."
    ],
    detallesImportantes: [
      "El motivo del rechazo queda registrado en el Historial de Auditoría con fecha, hora y firma del médico."
    ]
  },
  {
    id: "estado-receta-pendiente",
    titulo: "¿Qué significa que una receta esté en estado 'Pendiente' y quién la atiende?",
    categoria: "recetas",
    rolesRelevantes: ["todos"],
    palabrasClave: [
      "receta pendiente",
      "estado pendiente",
      "como saber si esta pendiente",
      "por que sigue pendiente",
      "esperando medico",
      "sin revisar",
      "pendiente",
      "no la han visto"
    ],
    resumen: "El estado Pendiente (badge azul) indica que la solicitud fue ingresada exitosamente pero aún no ha sido resuelta por un facultativo:",
    pasos: [
      "1. Columna Estado: Muestra el badge azul 'Pendiente'.",
      "2. Alertas de color: Si la receta lleva varios días sin atención, cambiará automáticamente a Alerta Amarilla o Alerta Roja.",
      "3. Quién la resuelve: Si dice 'Sin médico asignado', cualquier médico del sector puede abrirla en 'Mi Panel'. Si tiene candado 🔒, solo el médico asignado o el administrador.",
      "4. Filtro rápido: Puedes seleccionar el filtro 'Pendientes' arriba de la tabla para ver únicamente las recetas que esperan revisión médica."
    ],
    detallesImportantes: [
      "Los funcionarios pueden ver el estado pero no pueden autorizar; la autorización es un acto exclusivamente médico."
    ]
  },
  {
    id: "auto-renovacion-meses",
    titulo: "¿Cómo funciona la Auto-Renovación de recetas y el descuento mensual de stock?",
    categoria: "recetas",
    rolesRelevantes: ["medico", "admin", "funcionario"],
    palabrasClave: [
      "auto renovacion",
      "renovacion automatica",
      "renovar receta",
      "meses renovacion",
      "ciclo",
      "descuento mensual",
      "cronicos renovacion",
      "mes siguiente"
    ],
    resumen: "La Auto-Renovación permite dispensar tratamientos crónicos estables por varios meses sin que el paciente requiera una nueva receta cada mes:",
    pasos: [
      "1. Configuración médica: Al autorizar una receta en 'Mi Panel', el médico puede seleccionar entre 1 y 6 meses de auto-renovación.",
      "2. Descuento automático: El sistema descuenta las unidades correspondientes al inicio de cada mes de forma automática.",
      "3. Trazabilidad: Cada ciclo queda asentado en el historial de la receta.",
      "4. Fin del ciclo: Cumplido el período autorizado, la receta expira o vuelve a estado de revisión médica para control clínico."
    ],
    detallesImportantes: [
      "Asegura la adherencia al tratamiento de pacientes crónicos (hipertensos, diabéticos) descongestionando las ventanillas de solicitud."
    ]
  },
  {
    id: "estado-receta-completada",
    titulo: "¿Cómo saber si una receta está completada o autorizada?",
    categoria: "recetas",
    rolesRelevantes: ["todos"],
    palabrasClave: [
      "como saber si esta completada",
      "receta completada",
      "saber si se autorizo",
      "como saber si esta lista",
      "estado de una receta",
      "ver estado receta",
      "como se si la autorizaron",
      "donde veo si ya esta lista",
      "completada",
      "completado",
      "autorizada"
    ],
    resumen: "Para verificar si una receta ya fue autorizada por el médico y está lista para despacho:",
    pasos: [
      "1. Columna Estado: En la tabla de la cartera, el badge verde indicará 'Completado'.",
      "2. Botón de Impresora: Al pasar el cursor sobre la fila del paciente, si el botón azul de la impresora está activo, la receta ya está completada.",
      "3. Filtro rápido: Arriba de la tabla, cambia el filtro a 'Completadas' o escribe el RUT en el buscador.",
      "4. En 'Mi Panel' (médicos): En la sección 'Historial reciente' se listan las autorizadas en color verde."
    ],
    detallesImportantes: [
      "Si tiene badge ámbar 'Parcial', significa que fue aprobada parcialmente (algunos medicamentos autorizados y otros rechazados)."
    ]
  },
  {
    id: "buscar-filtrar-receta-desaparecida",
    titulo: "¿Qué hacer si no encuentro una receta o desapareció?",
    categoria: "recetas",
    rolesRelevantes: ["todos"],
    palabrasClave: [
      "no encuentro una receta",
      "receta desaparecida",
      "donde esta la receta",
      "no la veo",
      "no aparece en la lista",
      "buscar por rut"
    ],
    resumen: "Si no encuentras una receta ingresada previamente:",
    pasos: [
      "1. Revisa la pestaña correcta: Verifica si es Controlada, Crónica, Maternal o Respiratoria (ERA) y el sector (A, B o CECOSF).",
      "2. Revisa el filtro de estado: Asegúrate de que el filtro esté en 'Todos los estados' (no solo Pendientes).",
      "3. Usa el buscador: Digita el RUT o apellido del paciente en la barra de búsqueda.",
      "4. Papelera: Si fue eliminada por error, el administrador puede buscarla en la Papelera y restaurarla."
    ],
    detallesImportantes: [
      "Las recetas nunca se borran solas; todas las eliminaciones van a la Papelera con motivo y quedan en auditoría."
    ]
  },

  // ─── SEGURIDAD, CIFRADO Y PORTAL PACIENTE ─────────────────────
  {
    id: "seguridad-cifrado-portal-paciente",
    titulo: "¿Cómo protege el sistema los datos de los pacientes y qué es el Portal Paciente?",
    categoria: "seguridad",
    rolesRelevantes: ["todos"],
    palabrasClave: ["seguridad", "cifrado", "datos personales", "portal paciente", "aes", "privacidad", "rut cifrado", "ley de deberes y derechos"],
    resumen: "El sistema aplica estrictos estándares de privacidad conforme a la normativa de salud:",
    pasos: [
      "1. Cifrado AES-256 en cliente: El Nombre y RUT del paciente se cifran en el navegador antes de transmitirse a la nube, protegiendo los datos sensibles contra accesos no autorizados.",
      "2. Portal Paciente (`portal-paciente`): Es una web donde los usuarios del CESFAM pueden consultar el estado de su receta digitando su RUT.",
      "3. Hash Salted SHA-256: Para que el paciente consulte sin exponer su identidad, el sistema genera un identificador hash irreversible (`cesfamrod-2026-recetas + RUT`). La colección pública no almacena nombres ni diagnósticos.",
      "4. Cierre de Sesión: Recuerda SIEMPRE presionar el botón de salida (🚪) en la barra superior al terminar tu turno, especialmente en computadores compartidos de boxes y mesones."
    ],
    detallesImportantes: [
      "Nunca compartas tu clave de acceso con otros funcionarios; todas las acciones quedan firmadas a tu nombre en el historial de auditoría."
    ]
  }
];

/**
 * Filtro estricto de seguridad: Rechaza consultas no relacionadas con el sistema.
 */
export function verificarSeguridadYContexto(consulta: string): { permitido: boolean; motivo?: string } {
  const q = consulta.toLowerCase().trim();

  // 1. Detección de consultas clínicas / diagnósticos médicos
  const patronesMedicos = [
    /\b(diagnostico|sintoma|sintomas|dolor|enfermedad|tratamiento medico|que tomar|que recetar|dosis recomendada para cura|remedio para el dolor|me duele|infeccion|presion alta|gripe)\b/i,
  ];

  for (const patron of patronesMedicos) {
    if (patron.test(q)) {
      return {
        permitido: false,
        motivo: "Por seguridad clínica y normativa sanitaria, este asistente NO realiza diagnósticos médicos ni recomendaciones farmacológicas para pacientes. Mi única función es ayudarte a usar y operar el Sistema de Recetas de Farmacia del CESFAM Rodelillo."
      };
    }
  }

  // 2. Detección de consultas ajenas a la plataforma
  const patronesAjenos = [
    /\b(chiste|poema|cancion|clima|futbol|politica|noticias|receta de cocina|cuentame un|quien gano)\b/i,
  ];

  for (const patron of patronesAjenos) {
    if (patron.test(q)) {
      return {
        permitido: false,
        motivo: "Soy un asistente exclusivo para la operación y soporte del Sistema de Recetas de Farmacia del CESFAM Rodelillo. Por favor hazme preguntas sobre el uso de la plataforma, roles, recetas, alertas o inventario."
      };
    }
  }

  return { permitido: true };
}
