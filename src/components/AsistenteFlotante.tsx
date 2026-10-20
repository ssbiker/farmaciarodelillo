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
  Key,
  ExternalLink,
  Bot,
  User,
  Loader2,
} from "lucide-react";
import {
  procesarPreguntaAsistente,
  obtenerSugerenciasPorRol,
  type MensajeIA,
} from "../lib/asistenteMotor";
import { CONOCIMIENTO_SISTEMA, type ArticuloConocimiento } from "../lib/conocimientoRecetas";
import type { FarmaciaUser } from "../types";

interface ChatItem {
  id: string;
  remitente: "usuario" | "asistente";
  texto: string;
  fuente?: "gemini_ia" | "motor_local";
  tipo?: "exito" | "seguridad" | "sin_resultados" | "error";
  articulosRelacionados?: ArticuloConocimiento[];
  sugerencias?: string[];
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
  const [inputTexto, setInputTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [categoriaTab, setCategoriaTab] = useState<"chat" | "medico" | "funcionario" | "temas">("chat");
  const [mensajes, setMensajes] = useState<ChatItem[]>([]);
  const [modalKeyOpen, setModalKeyOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [tieneApiKey, setTieneApiKey] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rolDetectado: "medico" | "funcionario" | "admin" = isAdmin
    ? "admin"
    : isMedico
    ? "medico"
    : isFuncionario
    ? "funcionario"
    : "admin";

  // Verificar si hay API Key de Gemini configurada
  useEffect(() => {
    const savedKey = localStorage.getItem("cesfam_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
    if (savedKey && savedKey.trim().length > 10) {
      setTieneApiKey(true);
      setApiKeyInput(savedKey);
    } else {
      setTieneApiKey(false);
    }
  }, []);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (mensajes.length === 0) {
      const nombreUsuario = farmaciaUser?.name || "Colega";
      setMensajes([
        {
          id: "bienvenida",
          remitente: "asistente",
          texto: `¡Hola ${nombreUsuario}! Soy el Asistente Virtual del Sistema de Recetas de Farmacia (CESFAM Rodelillo).\n\nPuedes preguntarme en lenguaje natural lo que necesites sobre el sistema: cómo autorizar recetas, qué hacer con las alertas rojas, cómo usar el botón "Solicitud Receta" sin medicamento, o cómo funcionan las carteras Maternales y ERA.`,
          sugerencias: obtenerSugerenciasPorRol(rolDetectado),
        },
      ]);
    }
  }, [farmaciaUser, rolDetectado]);

  // Auto-scroll suave
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
      const savedKey = localStorage.getItem("cesfam_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
      const res: MensajeIA = await procesarPreguntaAsistente(texto, rolDetectado, savedKey || undefined);

      setMensajes((prev) => [
        ...prev,
        {
          id: idAsistente,
          remitente: "asistente",
          texto: res.texto,
          fuente: res.fuente,
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
          texto: "Hubo una interrupción en el procesamiento. Por favor intenta reformular tu pregunta.",
          tipo: "error",
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  const guardarApiKey = () => {
    if (apiKeyInput.trim().length > 10) {
      localStorage.setItem("cesfam_gemini_api_key", apiKeyInput.trim());
      setTieneApiKey(true);
      setModalKeyOpen(false);
      setMensajes((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          remitente: "asistente",
          texto: "✨ ¡Excelente! La IA Conversacional de Google Gemini ha sido activada con éxito. Ahora responderé tus preguntas con lenguaje natural avanzado.",
        },
      ]);
    } else {
      localStorage.removeItem("cesfam_gemini_api_key");
      setTieneApiKey(false);
      setModalKeyOpen(false);
    }
  };

  const limpiarChat = () => {
    setMensajes([
      {
        id: Date.now().toString(),
        remitente: "asistente",
        texto: "Conversación reiniciada. ¿En qué procedimiento del sistema te puedo orientar?",
        sugerencias: obtenerSugerenciasPorRol(rolDetectado),
      },
    ]);
  };

  // Renderizar a través de createPortal para montarse directamente sobre document.body
  // Esto elimina cualquier problema de scroll, transform o overflow de contenedores padres
  return createPortal(
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999, pointerEvents: "auto" }}>
      {/* ── BOTÓN FLOTANTE PERMANENTE ── */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
          }}
          className="flex items-center gap-3 px-5 py-3.5 rounded-full header-gradient text-white shadow-[0_12px_36px_rgba(26,85,204,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/40 ring-4 ring-brand-blue/20 group cursor-pointer"
          title="Abrir Asistente Virtual del Sistema"
        >
          <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center border border-white/40 group-hover:bg-white/35 transition-colors">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-black tracking-wide leading-none">Ayuda Sistema</p>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[10px] text-white/90 leading-none mt-1 font-semibold">
              {tieneApiKey ? "IA Gemini Activa" : "Asistente CESFAM"}
            </p>
          </div>
        </button>
      )}

      {/* ── VENTANA DE CHAT FLOTANTE ── */}
      {abierto && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
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
                  <button
                    onClick={() => setModalKeyOpen(true)}
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                      tieneApiKey
                        ? "bg-emerald-400 text-emerald-950 shadow-sm"
                        : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                    }`}
                    title="Configurar IA"
                  >
                    <Key className="w-2.5 h-2.5" />
                    {tieneApiKey ? "IA Gemini ON" : "Conectar IA Gratis"}
                  </button>
                </div>
                <p className="text-[11px] text-white/85 mt-1 leading-none font-medium">
                  CESFAM Rodelillo · Soporte en Lenguaje Natural
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={limpiarChat}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
                title="Reiniciar chat"
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

          {/* Modal / Panel de Configuración de API Key Gratuita */}
          {modalKeyOpen && (
            <div className="p-4 bg-blue-50 border-b border-blue-200 text-xs text-[#0F1B35] space-y-3 animate-in slide-in-from-top-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 font-bold text-brand-blue">
                  <Sparkles className="w-4 h-4 text-brand-blue" />
                  Activar IA de Lenguaje Natural (Google Gemini Free Tier)
                </div>
                <button onClick={() => setModalKeyOpen(false)} className="text-[#5D7299] hover:text-[#0F1B35]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[#5D7299] leading-relaxed text-[11px]">
                Google ofrece una clave de API <b>100% gratuita</b> para Gemini Flash (hasta 1.500 consultas diarias sin costo ni tarjeta de crédito).
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Pega aquí tu Gemini API Key (AIzaSy...)"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-white border border-[#DDE6F5] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-blue"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-brand-blue hover:underline font-bold flex items-center gap-1"
                  >
                    Obtener clave gratis en Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={guardarApiKey}
                    className="bg-brand-blue text-white px-4 py-1.5 rounded-xl font-bold hover:bg-brand-blue-dark transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Selector de pestañas rápidas */}
          <div className="flex items-center gap-1 p-2 bg-[#F8FAFF] border-b border-[#DDE6F5] text-xs font-semibold overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setCategoriaTab("chat")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
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
              onClick={() => setCategoriaTab("temas")}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                categoriaTab === "temas"
                  ? "bg-white text-brand-purple shadow-sm border border-brand-purple/20 font-bold"
                  : "text-[#5D7299] hover:bg-white/60"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Temas ({CONOCIMIENTO_SISTEMA.length})
            </button>
          </div>

          {/* Área de mensajes con scroll */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFF]/60">
            {categoriaTab === "temas" ? (
              /* Directorio de temas */
              <div className="space-y-2">
                <p className="text-xs text-[#5D7299] px-1 font-medium">Temas disponibles en la base de conocimiento:</p>
                {CONOCIMIENTO_SISTEMA.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => handleEnviar(art.titulo)}
                    className="w-full text-left p-3 rounded-2xl bg-white border border-[#DDE6F5] hover:border-brand-blue hover:shadow-sm transition-all text-xs font-bold text-[#0F1B35] flex items-center justify-between"
                  >
                    <span>{art.titulo}</span>
                    <span className="text-[10px] text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full font-bold">
                      {art.categoria}
                    </span>
                  </button>
                ))}
              </div>
            ) : categoriaTab === "medico" ? (
              /* Atajos Médicos */
              <div className="space-y-2">
                <p className="text-xs font-bold text-brand-blue px-1">Preguntas habituales para Médicos:</p>
                {[
                  "¿Cómo autorizo una receta médica en Mi Panel?",
                  "¿Cómo rechazar una receta y qué pasa con el stock?",
                  "¿Qué es la 'Autorización Parcial' y cómo funciona con múltiples medicamentos?",
                  "¿Cómo funciona la detección de recetas vigentes y la opción 'Vincular'?",
                  "¿Cómo uso el Asistente de Cálculo de Dosis?",
                ].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleEnviar(p)}
                    className="w-full text-left p-2.5 rounded-xl bg-white border border-[#DDE6F5] hover:border-brand-blue text-xs font-semibold text-[#0F1B35] transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : categoriaTab === "funcionario" ? (
              /* Atajos Funcionarios */
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-700 px-1">Preguntas habituales para Funcionarios:</p>
                {[
                  "¿Cómo ingresar una nueva solicitud de receta?",
                  "¿Qué es el botón '✓ Solicitud Receta' (Solicitud Genérica)?",
                  "¿Cómo funcionan las pestañas Maternales y Respiratorias (ERA)?",
                  "¿Cómo y cuándo se puede imprimir el ticket de receta?",
                  "¿Qué significan las alertas roja, amarilla y verde?",
                ].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleEnviar(p)}
                    className="w-full text-left p-2.5 rounded-xl bg-white border border-[#DDE6F5] hover:border-amber-400 text-xs font-semibold text-[#0F1B35] transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              /* Flujo del Chat */
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
                        {/* Mensaje de respuesta */}
                        <div
                          className={`p-4 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                            m.tipo === "seguridad"
                              ? "bg-amber-50 border border-amber-300 text-amber-900"
                              : "bg-white border border-[#DDE6F5] text-[#0F1B35]"
                          }`}
                        >
                          {m.tipo === "seguridad" && (
                            <div className="flex items-center gap-1.5 font-black text-amber-800 mb-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Límite de Seguridad del Sistema
                            </div>
                          )}
                          <div className="font-normal leading-relaxed">{m.texto}</div>

                          {m.fuente && (
                            <div className="mt-3 pt-2 border-t border-[#EEF3FC] flex items-center justify-between text-[10px] text-[#8FA3C4]">
                              <span>
                                {m.fuente === "gemini_ia" ? "✨ Generado con Google Gemini AI" : "🤖 Generado con Motor Local"}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" /> $0 Costo
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Sugerencias de seguimiento */}
                        {m.sugerencias && m.sugerencias.length > 0 && (
                          <div className="pt-1 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B90B5]">Preguntas sugeridas:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {m.sugerencias.map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  onClick={() => handleEnviar(sug)}
                                  className="text-[11px] bg-white border border-[#DDE6F5] hover:border-brand-blue text-[#0F1B35] px-2.5 py-1 rounded-full font-medium transition-all text-left shadow-2xs hover:shadow-xs"
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

            {/* Indicador de carga conversacional */}
            {cargando && (
              <div className="flex items-center gap-2 text-xs text-[#5D7299] bg-white p-3 rounded-2xl border border-[#DDE6F5] w-fit shadow-sm">
                <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                <span>Generando respuesta en lenguaje natural...</span>
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
              placeholder="Hazme cualquier pregunta sobre el sistema..."
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
