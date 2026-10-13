import { useEffect, useState } from "react";
import { X, Plus, Edit2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { obtenerAuditoria } from "../lib/auditoria";
import { decryptAuditoriaValue } from "../lib/crypto";
import type { AuditoriaEntry } from "../types";

function formatFecha(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ACCION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  CREACION:              { label: "Creación",             icon: Plus,          color: "text-green-600",  bg: "bg-green-50 border-green-200" },
  MODIFICACION:          { label: "Modificación",         icon: Edit2,         color: "text-brand-blue",  bg: "bg-brand-blue/10 border-brand-blue/20" },
  ENVIADA_PAPELERA:      { label: "Enviada a papelera",   icon: Trash2,        color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  RESTAURACION:          { label: "Restaurada",           icon: RefreshCw,     color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  ELIMINACION_DEFINITIVA:{ label: "Eliminación definitiva",icon: AlertTriangle, color: "text-red-700",   bg: "bg-red-100 border-red-300" },
};

const CAMPO_LABELS: Record<string, string> = {
  nombrePaciente: "Nombre paciente",
  rut:            "RUT",
  medicamento:    "Medicamento",
  items:          "Medicamentos (lista)",
  medicamentos_agregados: "➕ Fármaco(s) agregado(s)",
  medicamentos_eliminados: "➖ Fármaco(s) retirado(s)",
  cantidad:       "Cantidad",
  nota:           "Nota",
  estado:         "Estado",
  medicoReceta:   "Médico tratante",
  medicoUid:      "UID médico",
  motivoRechazo:  "Motivo rechazo",
  autoRenovacion: "Auto-renovación (meses)",
  fechaLimite:    "Fecha límite",
  fechaReceta:    "Fecha receta",
  motivo:         "Motivo papelera",
  codigoMedicamento: "Código medicamento",
};

function limpiarValorAuditoria(val: string | null): string | null {
  if (!val) return null;
  if (val.includes("[object Object]")) {
    const count = (val.match(/\[object Object\]/g) || []).length;
    return `📋 Lista previa (${count} medicamento${count > 1 ? "s" : ""})`;
  }
  return val;
}

export function AuditoriaDrawer({
  recetaId,
  collectionName,
  paciente,
  onClose,
}: {
  recetaId: string;
  collectionName: string;
  paciente: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<AuditoriaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    obtenerAuditoria(collectionName, recetaId)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [recetaId, collectionName]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-[#DDE6F5] z-[110] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#DDE6F5] bg-[#F8FAFF] flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-[#0F1B35]">Historial de Auditoría</h2>
            <p className="text-xs text-[#5D7299] mt-0.5 truncate max-w-[280px]">{paciente}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#EFF3FB] rounded-xl transition-colors text-[#5D7299] hover:text-[#0F1B35]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-center text-[#5D7299] text-sm py-16">
              No hay registros de auditoría aún.
            </div>
          )}
          {!loading && entries.length > 0 && (
            <div className="relative">
              {/* Línea vertical */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-[#EEF3FC]" />

              <div className="space-y-5">
                {[...entries].reverse().map((entry, i) => {
                  const cfg = ACCION_CONFIG[entry.accion] ?? {
                    label: entry.accion, icon: Edit2, color: "text-[#3D5278]", bg: "bg-[#EFF3FB] border-[#DDE6F5]",
                  };
                  const Icon = cfg.icon;

                  return (
                    <div key={entry.id ?? i} className="flex gap-4 relative">
                      {/* Dot */}
                      <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[11px] text-[#8FA3C4] whitespace-nowrap flex-shrink-0">
                            {formatFecha(entry.fecha)}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-[#0F1B35] mt-0.5">
                          {entry.usuarioNombre}
                        </p>
                        <p className="text-xs text-[#5D7299]">{entry.usuarioEmail}</p>

                        {/* Cambios */}
                        {entry.cambios && entry.cambios.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {entry.cambios.map((c, ci) => {
                              const label = CAMPO_LABELS[c.campo] ?? c.campo;
                              const rawAntes = c.antes ? String(decryptAuditoriaValue(c.antes)) : null;
                              const rawDespues = c.despues ? String(decryptAuditoriaValue(c.despues)) : null;
                              const antes = limpiarValorAuditoria(rawAntes);
                              const despues = limpiarValorAuditoria(rawDespues);

                              // ── CASO ESPECIAL: Medicamento agregado por el médico ──
                              if (c.campo === "medicamentos_agregados" && despues) {
                                const items = despues.split(" | ");
                                return (
                                  <div key={ci} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-2 shadow-xs">
                                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px] uppercase tracking-wide">
                                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">+</span>
                                      <span>Fármaco(s) agregado(s)</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {items.map((item, idx) => (
                                        <div key={idx} className="bg-white border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 shadow-2xs">
                                          <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                                            💊 {item}
                                          </span>
                                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                            Nuevo
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }

                              // ── CASO ESPECIAL: Medicamento retirado ──
                              if (c.campo === "medicamentos_eliminados" && antes) {
                                const items = antes.split(" | ");
                                return (
                                  <div key={ci} className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-2 shadow-xs">
                                    <div className="flex items-center gap-1.5 text-red-800 font-bold text-[11px] uppercase tracking-wide">
                                      <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black">-</span>
                                      <span>Fármaco(s) retirado(s)</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {items.map((item, idx) => (
                                        <div key={idx} className="bg-white border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 shadow-2xs line-through text-red-900">
                                          <span className="font-semibold flex items-center gap-1.5">
                                            💊 {item}
                                          </span>
                                          <span className="text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full no-underline flex-shrink-0">
                                            Retirado
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }

                              // Valores largos (listas de medicamentos, notas, etc.)
                              const esLargo = (antes && antes.length > 60) || (despues && despues.length > 60);
                              return (
                                <div key={ci} className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-lg px-3 py-2 text-xs space-y-1.5">
                                  <span className="text-[#5D7299] font-semibold uppercase tracking-wider text-[10px]">
                                    {label}
                                  </span>
                                  {esLargo ? (
                                    // Renderizado vertical para valores largos
                                    <div className="space-y-1">
                                      {antes && (
                                        <div>
                                          <span className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Antes</span>
                                          <p className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-2 py-1.5 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                            {antes}
                                          </p>
                                        </div>
                                      )}
                                      {despues && (
                                        <div>
                                          <span className="text-[10px] text-green-600 font-bold uppercase tracking-wide">Después</span>
                                          <p className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-2 py-1.5 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                            {despues}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    // Renderizado horizontal para valores cortos
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {antes && (
                                        <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-lg line-through">
                                          {antes}
                                        </span>
                                      )}
                                      {antes && despues && <span className="text-[#8FA3C4] font-bold">→</span>}
                                      {despues && (
                                        <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-lg font-semibold">
                                          {despues}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Motivo (para papelera) */}
                        {(entry as any).motivo && (
                          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                            Motivo: {(entry as any).motivo}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
