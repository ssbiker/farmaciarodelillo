import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Bot,
  User,
  Loader2,
  Minus,
  Maximize2,
} from "lucide-react";
import {
  procesarPreguntaAsistente,
  obtenerSugerenciasPorRol,
  type MensajeIA,
  type TurnoHistorial,
} from "../lib/asistenteMotor";
import { CONOCIMIENTO_SISTEMA, type ArticuloConocimiento } from "../lib/conocimientoRecetas";
import type { FarmaciaUser } from "../types";

interface ChatItem {
  id: string;
  remitente: "usuario" | "asistente";
  texto: string;
  tipo?: "exito" | "seguridad" | "sin_resultados" | "error";
  articulosRelacionados?: ArticuloConocimiento[];
  sugerencias?: string[];
}

/**
 * Renderizador de texto para formatear negritas (**texto**) y saltos de línea cleanly.
 */
function FormatoTextoIA({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <div className="space-y-1.5 leading-relaxed">
      {lineas.map((linea, idx) => {
        if (!linea.trim()) {
          return <div key={idx} className="h-1.5" />;
        }

        const partes = linea.split(/(\*\*[^*]+\*\*)/g);

        return (
          <p key={idx} className="m-0">
            {partes.map((p, pIdx) => {
              if (p.startsWith("**") && p.endsWith("**")) {
                return (
                  <strong key={pIdx} className="font-bold text-[#0F1B35]">
                    {p.slice(2, -2)}
                  </strong>
                );
              }
              return p;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function AsistenteFlotante({
  farmaciaUser,
  isMedico = false,
  isFuncionario = false,
  isAdmin = false,
}: {
  farmaciaUser?: FarmaciaUser | null;
  isMedico?: boolean;
  isFuncionario?: boolean;
  isAdmin?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [minimizado, setMinimizado] = useState(() => {
    return localStorage.getItem("asistente_minimizado") === "true";
  });
  const [inputTexto, setInputTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [categoriaTab, setCategoriaTab] = useState<"chat" | "medico" | "funcionario" | "temas">("chat");
  const [mensajes, setMensajes] = useState<ChatItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rolDetectado: "medico" | "funcionario" | "admin" = isAdmin
    ? "admin"
    : isMedico
    ? "medico"
    : isFuncionario
    ? "funcionario"
    : "admin";

  const nombreUsuario = farmaciaUser?.name?.trim().split(" ")[0] || "";

  // Mensaje de bienvenida inicial (respetuoso y sin la palabra 'colega')
  useEffect(() => {
    if (mensajes.length === 0) {
      const saludoInicial = isMedico
        ? (nombreUsuario ? `¡Hola Dr./Dra. ${nombreUsuario}!` : "¡Hola Doctor/a!")
        : isFuncionario
        ? (nombreUsuario ? `¡Hola ${nombreUsuario}!` : "¡Hola!")
        : (nombreUsuario ? `¡Hola ${nombreUsuario}!` : "¡Hola!");

      setMensajes([
        {
          id: "bienvenida",
          remitente: "asistente",
          texto: `${saludoInicial} Soy el Asistente del Sistema de Recetas de Farmacia del CESFAM Rodelillo.\n\nPuedes consultarme con tus propias palabras cualquier duda del sistema: autorizaciones, recetas con candado 🔒, cómo saber si una receta está rechazada o completada, solicitudes sin medicamento o inventario.`,
          sugerencias: obtenerSugerenciasPorRol(rolDetectado),
        },
      ]);
    }
  }, [farmaciaUser, rolDetectado, isMedico, isFuncionario, nombreUsuario]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, abierto, cargando]);

  const handleEnviar = async (consulta?: string) => {
    const texto = (consulta || inputTexto).trim();
    if (!texto || cargando) return;

    const idUsuario = Date.now().toString() + "-u";
    const idAsistente = Date.now().toString() + "-a";

    // Preparar historial conversacional previo
    const historialPrevio: TurnoHistorial[] = mensajes.map((m) => ({
      remitente: m.remitente,
      texto: m.texto,
    }));

    setMensajes((prev) => [
      ...prev,
      {
        id: idUsuario,
        remitente: "usuario",
        texto,
      },
    ]);

    setInputTexto("");
    setCargando(true);
    setCategoriaTab("chat");

    try {
      const res: MensajeIA = await procesarPreguntaAsistente(
        texto,
        rolDetectado,
        farmaciaUser?.name,
        historialPrevio
      );

      setMensajes((prev) => [
        ...prev,
        {
          id: idAsistente,
          remitente: "asistente",
          texto: res.texto,
          tipo: res.tipo,
          articulosRelacionados: res.articulosRelacionados,
          sugerencias: res.sugerencias,
        },
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          id: idAsistente,
          remitente: "asistente",
          texto: "Hubo una interrupción breve. Por favor reformula tu consulta.",
          tipo: "error",
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  const limpiarChat = () => {
    const saludoInicial = isMedico
      ? (nombreUsuario ? `¡Hola Dr./Dra. ${nombreUsuario}!` : "¡Hola Doctor/a!")
      : isFuncionario
      ? (nombreUsuario ? `¡Hola ${nombreUsuario}!` : "¡Hola!")
      : (nombreUsuario ? `¡Hola ${nombreUsuario}!` : "¡Hola!");

    setMensajes([
      {
        id: Date.now().toString(),
        remitente: "asistente",
        texto: `${saludoInicial} Conversación reiniciada. ¿En qué procedimiento o pantalla del sistema te puedo orientar?`,
        sugerencias: obtenerSugerenciasPorRol(rolDetectado),
      },
    ]);
  };

  return createPortal(
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 40, pointerEvents: "auto" }}>
      {/* ── BOTÓN FLOTANTE: MODO COMPACTO (BURBUJA PEQUEÑA) ── */}
      {!abierto && minimizado && (
        <div className="relative group">
          <button
            onClick={() => setAbierto(true)}
            className="w-12 h-12 rounded-full header-gradient text-white shadow-[0_8px_24px_rgba(26,85,204,0.35)] hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/50 flex items-center justify-center cursor-pointer"
            title="Abrir Asistente Virtual Rodelillo"
          >
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          </button>
          {/* Botón para expandir a pastilla completa */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimizado(false);
              localStorage.setItem("asistente_minimizado", "false");
            }}
            className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white text-brand-blue border border-[#DDE6F5] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 cursor-pointer"
            title="Expandir nombre del asistente"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── BOTÓN FLOTANTE: MODO EXTENDIDO (PASTILLA) ── */}
      {!abierto && !minimizado && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAbierto(true)}
            className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full header-gradient text-white shadow-[0_10px_28px_rgba(26,85,204,0.4)] hover:scale-[1.03] active:scale-95 transition-all duration-300 border-2 border-white/40 ring-4 ring-brand-blue/15 group cursor-pointer"
            title="Abrir Asistente Virtual del Sistema"
          >
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center border border-white/40 group-hover:bg-white/35 transition-colors">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black tracking-wide leading-none">Ayuda Sistema</p>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-[10px] text-white/90 leading-none mt-1 font-semibold">
                Asistente Rodelillo
              </p>
            </div>
          </button>

          {/* Botón rápido para minimizar a burbuja circular */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimizado(true);
              localStorage.setItem("asistente_minimizado", "true");
            }}
            className="w-7 h-7 rounded-full bg-white text-[#5D7299] hover:text-[#0F1B35] shadow-md border border-[#DDE6F5] flex items-center justify-center transition-all hover:scale-110 active:scale-90 cursor-pointer"
            title="Minimizar a ícono circular pequeño"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── VENTANA DE CHAT FLOTANTE ── */}
      {abierto && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 40,
          }}
          className="w-[calc(100vw-2rem)] sm:w-[460px] h-[640px] max-h-[88vh] bg-white border border-[#DDE6F5] rounded-3xl shadow-[0_16px_50px_rgba(15,27,53,0.25)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="header-gradient p-4 text-white flex-shrink-0 flex items-center justify-between shadow-md relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-sm shadow-sm">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black tracking-tight leading-none">Asistente de Recetas</h3>
                  <span className="text-[9px] font-bold bg-white/20 border border-white/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" /> Sistema Seguro
                  </span>
                </div>
                <p className="text-[11px] text-white/85 mt-1 leading-none font-medium">
                  CESFAM Rodelillo · Soporte en Lenguaje Natural
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={limpiarChat}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white cursor-pointer"
                title="Reiniciar chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAbierto(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white cursor-pointer"
                title="Cerrar asistente"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Selector de pestañas de apoyo */}
          <div className="flex items-center gap-1 p-2 bg-[#F8FAFF] border-b border-[#DDE6F5] text-xs font-semibold overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setCategoriaTab("chat")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                categoriaTab === "chat"
                  ? "bg-white text-brand-blue shadow-sm border border-[#DDE6F5] font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Conversación
            </button>
            <button
              onClick={() => setCategoriaTab("medico")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                categoriaTab === "funcionario"
                  ? "bg-white text-amber-700 shadow-sm border border-amber-200 font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Funcionarios
            </button>
            <button
              onClick={() => setCategoriaTab("temas")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                categoriaTab === "temas"
                  ? "bg-white text-brand-purple shadow-sm border border-brand-purple/20 font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Temas ({CONOCIMIENTO_SISTEMA.length})
            </button>
          </div>

          {/* Área de mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFF]/60">
            {categoriaTab === "temas" ? (
              <div className="space-y-2">
                <p className="text-xs text-[#5D7299] px-1 font-medium">Temas disponibles en el sistema:</p>
                {CONOCIMIENTO_SISTEMA.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => handleEnviar(art.titulo)}
                    className="w-full text-left p-3 rounded-2xl bg-white border border-[#DDE6F5] hover:border-brand-blue hover:shadow-sm transition-all text-xs font-bold text-[#0F1B35] flex items-center justify-between cursor-pointer"
                  >
                    <span>{art.titulo}</span>
                    <span className="text-[10px] text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full font-bold">
                      {art.categoria}
                    </span>
                  </button>
                ))}
              </div>
            ) : categoriaTab === "medico" ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-brand-blue px-1">Preguntas habituales para Médicos:</p>
                {[
                  "¿Cómo autorizo una receta médica en Mi Panel?",
                  "¿Por qué una receta me sale con candado 🔒 y qué debo hacer?",
                  "¿Qué es la 'Autorización Parcial' y cómo funciona con múltiples medicamentos?",
                  "¿Cómo funciona la detección de recetas vigentes y la opción 'Vincular'?",
                  "¿Cómo uso el Asistente de Cálculo de Dosis?",
                ].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleEnviar(p)}
                    className="w-full text-left p-2.5 rounded-xl bg-white border border-[#DDE6F5] hover:border-brand-blue text-xs font-semibold text-[#0F1B35] transition-all cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : categoriaTab === "funcionario" ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-700 px-1">Preguntas habituales para Funcionarios:</p>
                {[
                  "¿Cómo saber si una receta está rechazada o completada?",
                  "¿Qué hago si no sé el medicamento al ingresar una solicitud?",
                  "¿Cómo ingresar recetas en Maternales o Respiratorias (ERA)?",
                  "¿Qué hago si sale advertencia de paciente con recetas vigentes?",
                  "¿Cómo y cuándo se puede imprimir el ticket de receta?",
                  "¿Qué significan las alertas roja, amarilla y verde?",
                ].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleEnviar(p)}
                    className="w-full text-left p-2.5 rounded-xl bg-white border border-[#DDE6F5] hover:border-amber-400 text-xs font-semibold text-[#0F1B35] transition-all cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              mensajes.map((m) => (
                <div key={m.id} className="space-y-2">
                  {m.remitente === "usuario" ? (
                    <div className="flex justify-end items-end gap-2">
                      <div className="max-w-[85%] bg-brand-blue text-white p-3.5 rounded-2xl rounded-br-sm text-xs font-medium shadow-sm leading-relaxed whitespace-pre-wrap">
                        {m.texto}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center flex-shrink-0 mb-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-white border border-[#DDE6F5] shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5 text-brand-blue">
                        <Bot className="w-4 h-4 text-brand-blue" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div
                          className={`p-4 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow-sm ${
                            m.tipo === "seguridad"
                              ? "bg-amber-50 border border-amber-300 text-amber-900"
                              : "bg-white border border-[#DDE6F5] text-[#0F1B35]"
                          }`}
                        >
                          {m.tipo === "seguridad" && (
                            <div className="flex items-center gap-1.5 font-black text-amber-800 mb-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Límite de Seguridad del Sistema
                            </div>
                          )}
                          <FormatoTextoIA texto={m.texto} />
                        </div>

                        {m.sugerencias && m.sugerencias.length > 0 && (
                          <div className="pt-1 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B90B5]">Preguntas sugeridas:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {m.sugerencias.map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  onClick={() => handleEnviar(sug)}
                                  className="text-[11px] bg-white border border-[#DDE6F5] hover:border-brand-blue text-[#0F1B35] px-2.5 py-1 rounded-full font-medium transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer"
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

            {cargando && (
              <div className="flex items-center gap-2 text-xs text-[#5D7299] bg-white p-3 rounded-2xl border border-[#DDE6F5] w-fit shadow-sm">
                <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                <span>Analizando situación del sistema...</span>
              </div>
            )}
          </div>

          {/* Formulario de Input */}
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
              placeholder="Escribe tu consulta o describe tu situación..."
              disabled={cargando}
              className="flex-1 bg-[#F8FAFF] border border-[#DDE6F5] rounded-xl px-3.5 py-2.5 text-xs text-[#0F1B35] placeholder-[#8FA3C4] focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 transition-all"
            />
            <button
              type="submit"
              disabled={!inputTexto.trim() || cargando}
              className="bg-brand-blue disabled:opacity-40 text-white p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0 shadow-sm cursor-pointer"
              title="Enviar consulta"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>,
    document.body
  );
}
