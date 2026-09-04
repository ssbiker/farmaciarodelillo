import { useEffect, useState } from "react";
import { X, Plus, Edit2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { obtenerAuditoria } from "../lib/auditoria";
import type { AuditoriaEntry } from "../types";

function formatFecha(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ACCION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  CREACION:              { label: "Creación",             icon: Plus,          color: "text-green-400",  bg: "bg-green-500/15 border-green-500/25" },
  MODIFICACION:          { label: "Modificación",         icon: Edit2,         color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/25" },
  ENVIADA_PAPELERA:      { label: "Enviada a papelera",   icon: Trash2,        color: "text-red-400",    bg: "bg-red-500/15 border-red-500/25" },
  RESTAURACION:          { label: "Restaurada",           icon: RefreshCw,     color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/25" },
  ELIMINACION_DEFINITIVA:{ label: "Eliminación definitiva",icon: AlertTriangle, color: "text-red-500",   bg: "bg-red-900/30 border-red-500/30" },
};

const CAMPO_LABELS: Record<string, string> = {
  nombrePaciente: "Nombre paciente",
  rut:            "RUT",
  medicamento:    "Medicamento",
  nota:           "Nota",
  estado:         "Estado",
  medicoReceta:   "Médico",
};

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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0F0F1E] border-l border-white/10 z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.03] flex-shrink-0">
          <div>
            <h2 className="text-lg font-black">Historial de Auditoría</h2>
            <p className="text-xs text-white/40 mt-0.5 truncate max-w-[280px]">{paciente}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-center text-white/30 text-sm py-16">
              No hay registros de auditoría aún.
            </div>
          )}
          {!loading && entries.length > 0 && (
            <div className="relative">
              {/* Línea vertical */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

              <div className="space-y-5">
                {[...entries].reverse().map((entry, i) => {
                  const cfg = ACCION_CONFIG[entry.accion] ?? {
                    label: entry.accion, icon: Edit2, color: "text-white/50", bg: "bg-white/5 border-white/10",
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
                          <span className="text-[10px] text-white/30 whitespace-nowrap flex-shrink-0">
                            {formatFecha(entry.fecha)}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-white/80 mt-0.5">
                          {entry.usuarioNombre}
                        </p>
                        <p className="text-xs text-white/35">{entry.usuarioEmail}</p>

                        {/* Cambios */}
                        {entry.cambios && entry.cambios.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {entry.cambios.map((c, ci) => (
                              <div key={ci} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs">
                                <span className="text-white/50 font-medium">
                                  {CAMPO_LABELS[c.campo] ?? c.campo}:
                                </span>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {c.antes && (
                                    <span className="bg-red-500/15 text-red-400 px-2 py-0.5 rounded line-through max-w-[120px] truncate">
                                      {c.antes}
                                    </span>
                                  )}
                                  <span className="text-white/30">→</span>
                                  {c.despues && (
                                    <span className="bg-green-500/15 text-green-400 px-2 py-0.5 rounded max-w-[120px] truncate">
                                      {c.despues}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Motivo (para papelera) */}
                        {(entry as any).motivo && (
                          <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
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
