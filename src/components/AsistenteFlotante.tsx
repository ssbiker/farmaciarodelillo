import { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Info,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import {
  consultarAsistente,
  obtenerSugerenciasPorRol,
  type ResultadoConsulta,
} from "../lib/asistenteMotor";
import { CONOCIMIENTO_SISTEMA, type ArticuloConocimiento } from "../lib/conocimientoRecetas";
import type { FarmaciaUser } from "../types";

interface MensajeChat {
  id: string;
  remitente: "usuario" | "asistente";
  texto?: string;
  resultado?: ResultadoConsulta;
  articuloDirecto?: ArticuloConocimiento;
}

export function AsistenteFlotante({
  farmaciaUser,
  isMedico,
  isFuncionario,
  isAdmin,
}: {
  farmaciaUser: FarmaciaUser;
  isMedico: boolean;
  isFuncionario: boolean;
  isAdmin: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [inputTexto, setInputTexto] = useState("");
  const [categoriaTab, setCategoriaTab] = useState<"sugerencias" | "medico" | "funcionario" | "admin" | "indice">("sugerencias");
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rolDetectado: "medico" | "funcionario" | "admin" = isAdmin
    ? "admin"
    : isMedico
    ? "medico"
    : isFuncionario
    ? "funcionario"
    : "admin";

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (mensajes.length === 0) {
      setMensajes([
        {
          id: "bienvenida",
          remitente: "asistente",
          texto: `¡Hola ${farmaciaUser.name || "Colega"}! Soy tu Asistente Interno del Sistema de Recetas de Farmacia. Respondo cualquier duda sobre el uso del sistema, cómo autorizar, ingresar recetas, carteras (Maternales/ERA/Crónicas/Controladas), alertas de color y stock.`,
        },
      ]);
    }
  }, [farmaciaUser]);

  // Auto-scroll al final del chat al enviar/recibir mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, abierto]);

  const handleEnviar = (consulta?: string) => {
    const texto = (consulta || inputTexto).trim();
    if (!texto) return;

    const nuevoId = Date.now().toString();
    const mensajeUsuario: MensajeChat = {
      id: nuevoId + "-u",
      remitente: "usuario",
      texto,
    };

    const resultado = consultarAsistente(texto, rolDetectado);
    const mensajeAsistente: MensajeChat = {
      id: nuevoId + "-a",
      remitente: "asistente",
      resultado,
    };

    setMensajes((prev) => [...prev, mensajeUsuario, mensajeAsistente]);
    setInputTexto("");
  };

  const handleVerArticulo = (art: ArticuloConocimiento) => {
    const nuevoId = Date.now().toString();
    const mensajeUsuario: MensajeChat = {
      id: nuevoId + "-u",
      remitente: "usuario",
      texto: art.titulo,
    };
    const mensajeAsistente: MensajeChat = {
      id: nuevoId + "-a",
      remitente: "asistente",
      articuloDirecto: art,
    };
    setMensajes((prev) => [...prev, mensajeUsuario, mensajeAsistente]);
    setCategoriaTab("sugerencias");
  };

  const limpiarChat = () => {
    setMensajes([
      {
        id: Date.now().toString(),
        remitente: "asistente",
        texto: `Chat reiniciado. ¿Qué consulta tienes sobre el sistema de recetas?`,
      },
    ]);
  };

  const sugerenciasActuales = obtenerSugerenciasPorRol(rolDetectado);

  return (
    <>
      {/* ── BOTÓN FLOTANTE LANZADOR ── */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full header-gradient text-white shadow-[0_8px_24px_rgba(26,85,204,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 border border-white/30 group"
          title="Abrir Asistente del Sistema"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-colors">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="text-left">
            <p className="text-xs font-black leading-none tracking-wide">Ayuda Sistema</p>
            <p className="text-[10px] text-white/80 leading-none mt-0.5">Asistente Rodelillo</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
        </button>
      )}

      {/* ── VENTANA DEL ASISTENTE ── */}
      {abierto && (
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[600px] max-h-[85vh] bg-white border border-[#DDE6F5] rounded-3xl shadow-[0_12px_40px_rgba(15,27,53,0.18)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="header-gradient p-4 text-white flex-shrink-0 flex items-center justify-between shadow-sm relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black tracking-tight leading-none">Asistente de Recetas</h3>
                  <span className="text-[9px] font-bold bg-white/20 border border-white/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" /> $0 Interno
                  </span>
                </div>
                <p className="text-[11px] text-white/80 mt-1 leading-none font-medium">
                  CESFAM Rodelillo · Soporte Operativo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={limpiarChat}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
                title="Limpiar conversación"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAbierto(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
                title="Cerrar asistente"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Selector de Pestañas Rápidas */}
          <div className="flex items-center gap-1 p-2 bg-[#F8FAFF] border-b border-[#DDE6F5] text-xs font-semibold overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setCategoriaTab("sugerencias")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                categoriaTab === "sugerencias"
                  ? "bg-white text-brand-blue shadow-sm border border-[#DDE6F5] font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setCategoriaTab("medico")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                categoriaTab === "medico"
                  ? "bg-white text-brand-blue shadow-sm border border-[#DDE6F5] font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Médicos
            </button>
            <button
              onClick={() => setCategoriaTab("funcionario")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                categoriaTab === "funcionario"
                  ? "bg-white text-amber-700 shadow-sm border border-amber-200 font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Funcionarios
            </button>
            <button
              onClick={() => setCategoriaTab("indice")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                categoriaTab === "indice"
                  ? "bg-white text-brand-purple shadow-sm border border-brand-purple/20 font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Temas ({CONOCIMIENTO_SISTEMA.length})
            </button>
          </div>

          {/* Área de Contenido / Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFF]/50">
            {categoriaTab === "indice" ? (
              /* Vista de Directorio Completo de Temas */
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Info className="w-4 h-4 text-brand-blue" />
                  <p className="text-xs text-[#5D7299]">Selecciona cualquier tema para ver la guía paso a paso:</p>
                </div>
                {CONOCIMIENTO_SISTEMA.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => handleVerArticulo(art)}
                    className="w-full text-left p-3 rounded-2xl bg-white border border-[#DDE6F5] hover:border-brand-blue hover:shadow-sm transition-all group flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#0F1B35] group-hover:text-brand-blue transition-colors">
                        {art.titulo}
                      </p>
                      <p className="text-[11px] text-[#7B90B5] line-clamp-1 mt-0.5">{art.resumen}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A8BDD8] group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            ) : categoriaTab === "medico" ? (
              /* Preguntas específicas para médicos */
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2.5">
                  <Stethoscope className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 leading-relaxed font-medium">
                    Guía especializada para médicos: autorizaciones, dosis, multi-fármacos y vinculación.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {[
                    "¿Cómo autorizo una receta médica en Mi Panel?",
                    "¿Cómo rechazar una receta y qué pasa con el stock?",
                    "¿Qué es la 'Autorización Parcial' y cómo funciona con múltiples medicamentos?",
                    "¿Cómo funciona la detección de recetas vigentes y la opción 'Vincular'?",
                    "¿Cómo usar el Asistente de Cálculo de Dosis?",
                  ].map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCategoriaTab("sugerencias");
                        handleEnviar(p);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-white border border-[#DDE6F5] hover:border-brand-blue text-xs font-semibold text-[#0F1B35] hover:text-brand-blue transition-all flex items-center justify-between"
                    >
                      <span>{p}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#A8BDD8]" />
                    </button>
                  ))}
                </div>
              </div>
            ) : categoriaTab === "funcionario" ? (
              /* Preguntas específicas para funcionarios */
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
                  <ClipboardList className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">
                    Guía para funcionarios: ingreso ágil de solicitudes, carteras y entrega de tickets.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {[
                    "¿Cómo ingresar una nueva solicitud de receta?",
                    "¿Qué es el botón '✓ Solicitud Receta' (Solicitud Genérica)?",
                    "¿Cómo funcionan las pestañas Maternales y Respiratorias (ERA)?",
                    "¿Cómo y cuándo se puede imprimir el ticket de receta?",
                    "¿Qué significan las alertas roja, amarilla y verde?",
                  ].map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCategoriaTab("sugerencias");
                        handleEnviar(p);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-white border border-[#DDE6F5] hover:border-amber-400 text-xs font-semibold text-[#0F1B35] hover:text-amber-800 transition-all flex items-center justify-between"
                    >
                      <span>{p}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#A8BDD8]" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Flujo Conversacional Principal */
              mensajes.map((m) => (
                <div key={m.id} className="space-y-2">
                  {m.remitente === "usuario" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-brand-blue text-white p-3 rounded-2xl rounded-tr-sm text-xs font-medium shadow-sm leading-relaxed">
                        {m.texto}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-white border border-[#DDE6F5] shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5 text-brand-blue">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        {/* Mensaje de texto simple */}
                        {m.texto && (
                          <div className="bg-white border border-[#DDE6F5] p-3.5 rounded-2xl rounded-tl-sm text-xs text-[#0F1B35] leading-relaxed shadow-sm">
                            {m.texto}
                          </div>
                        )}

                        {/* Bloqueo por guardrail de seguridad */}
                        {m.resultado?.tipo === "seguridad" && (
                          <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-2xl rounded-tl-sm text-xs text-amber-900 leading-relaxed shadow-sm space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Límite de Seguridad del Sistema
                            </div>
                            <p>{m.resultado.mensaje}</p>
                          </div>
                        )}

                        {/* Sin resultados */}
                        {m.resultado?.tipo === "sin_resultados" && (
                          <div className="bg-white border border-[#DDE6F5] p-3.5 rounded-2xl rounded-tl-sm text-xs text-[#5D7299] leading-relaxed shadow-sm">
                            <p>{m.resultado.mensaje}</p>
                          </div>
                        )}

                        {/* Artículos de respuesta (resultado de búsqueda o clic directo) */}
                        {(m.resultado?.articulos || (m.articuloDirecto ? [m.articuloDirecto] : [])).map((art) => (
                          <div
                            key={art.id}
                            className="bg-white border border-[#DDE6F5] rounded-2xl p-4 shadow-sm space-y-3"
                          >
                            <div className="border-b border-[#EEF3FC] pb-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full inline-block mb-1.5">
                                {art.categoria}
                              </span>
                              <h4 className="text-xs font-black text-[#0F1B35] leading-snug">{art.titulo}</h4>
                            </div>

                            <p className="text-xs text-[#3D5278] leading-relaxed font-medium">{art.resumen}</p>

                            {/* Pasos ordenados */}
                            {art.pasos && art.pasos.length > 0 && (
                              <div className="space-y-1.5 bg-[#F8FAFF] p-3 rounded-xl border border-[#EEF3FC]">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B90B5]">Paso a paso:</p>
                                <ul className="space-y-1 text-xs text-[#0F1B35]">
                                  {art.pasos.map((paso, pIdx) => (
                                    <li key={pIdx} className="leading-snug">
                                      {paso}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Alertas o detalles importantes */}
                            {art.detallesImportantes && art.detallesImportantes.length > 0 && (
                              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl space-y-1">
                                {art.detallesImportantes.map((det, dIdx) => (
                                  <p key={dIdx} className="text-[11px] text-emerald-900 leading-snug flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>{det}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Sugerencias de seguimiento */}
                        {m.resultado?.sugerencias && m.resultado.sugerencias.length > 0 && (
                          <div className="pt-1 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B90B5]">Preguntas sugeridas:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {m.resultado.sugerencias.map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  onClick={() => handleEnviar(sug)}
                                  className="text-[11px] bg-white border border-[#DDE6F5] hover:border-brand-blue text-[#0F1B35] px-2.5 py-1 rounded-full font-medium transition-all text-left"
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Chips de Preguntas Frecuentes Rápidas (pie de chat) */}
          {categoriaTab === "sugerencias" && mensajes.length <= 2 && (
            <div className="p-2.5 bg-[#F8FAFF] border-t border-[#EEF3FC] flex-shrink-0">
              <p className="text-[10px] font-bold text-[#7B90B5] uppercase tracking-wider mb-1.5">Consultas frecuentes:</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {sugerenciasActuales.slice(0, 3).map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEnviar(s)}
                    className="text-[11px] bg-white border border-[#DDE6F5] hover:border-brand-blue text-[#3D5278] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input de Consulta */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEnviar();
            }}
            className="p-3 bg-white border-t border-[#DDE6F5] flex items-center gap-2 flex-shrink-0"
          >
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              placeholder="Escribe tu consulta sobre el sistema..."
              className="flex-1 bg-[#F8FAFF] border border-[#DDE6F5] rounded-xl px-3 py-2 text-xs text-[#0F1B35] placeholder-[#8FA3C4] focus:outline-none focus:border-brand-blue transition-colors"
            />
            <button
              type="submit"
              disabled={!inputTexto.trim()}
              className="bg-brand-blue disabled:opacity-40 text-white p-2 rounded-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0 shadow-sm"
              title="Enviar consulta"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
