import { useState } from "react";
import type { Receta, FarmaciaConfig, FarmaciaUser } from "../types";
import {
  Clock, CheckCircle2, XCircle, Trash2, Edit, Printer,
  Plus, Search, AlertCircle, ChevronDown, History,
} from "lucide-react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { registrarAccion } from "../lib/auditoria";
import { RecetaModal } from "./RecetaModal";
import { TicketModal } from "./TicketModal";
import { AuditoriaDrawer } from "./AuditoriaDrawer";

function daysSince(ts: any): number {
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
}

function daysToDeadline(ts: any): number {
  // Positivo = días restantes, negativo = días vencida
  return Math.ceil((ts.toDate().getTime() - Date.now()) / 86400000);
}

function formatDate(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "completado")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/25">
        <CheckCircle2 className="w-3.5 h-3.5" /> Completado
      </span>
    );
  if (estado === "rechazado")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/50 border border-white/10">
        <XCircle className="w-3.5 h-3.5" /> Rechazado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/25">
      <Clock className="w-3.5 h-3.5" /> Pendiente
    </span>
  );
}

function TiempoBadge({ receta, config }: { receta: Receta; config: FarmaciaConfig }) {
  if (receta.estado !== "pendiente") return <span className="text-white/30 text-xs">—</span>;

  // ── Modo fecha límite ──
  if (receta.fechaLimite) {
    const left = daysToDeadline(receta.fechaLimite);
    if (left < 0) {
      // Vencida
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-600/20 text-red-400 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse">
          <AlertCircle className="w-3 h-3" /> Vencida {Math.abs(left)}d
        </span>
      );
    }
    if (left <= config.diasAlertaAmarilla) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/25">
          <Clock className="w-3 h-3" /> {left}d restantes
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <Clock className="w-3 h-3" /> {left}d restantes
      </span>
    );
  }

  // ── Modo días activa (fallback sin fecha límite) ──
  const days = daysSince(receta.fechaSolicitud);
  if (days >= config.diasAlertaRoja)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-600/20 text-red-400 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse">
        <AlertCircle className="w-3 h-3" /> {days}d activa
      </span>
    );
  if (days >= config.diasAlertaAmarilla)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/25">
        <Clock className="w-3 h-3" /> {days}d activa
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/10">
      <Clock className="w-3 h-3" /> {days}d activa
    </span>
  );
}

// ── Modal de confirmación para enviar a papelera ──
function ConfirmPapeleraModal({
  receta,
  onConfirm,
  onCancel,
}: {
  receta: Receta;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onCancel} />
      <div className="relative bg-[#12122A] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="font-black text-lg mb-1">Enviar a Papelera</h3>
        <p className="text-xs text-white/50 mb-4">
          Receta de <strong className="text-white">{receta.nombrePaciente}</strong>. Se guardará quién realizó esta acción.
        </p>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
          Motivo (obligatorio)
        </label>
        <textarea
          rows={3}
          placeholder="Ej: Receta duplicada, error de carga..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-brand-purple outline-none transition-colors text-sm resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-colors">
            Cancelar
          </button>
          <button
            disabled={!motivo.trim()}
            onClick={() => onConfirm(motivo.trim())}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40">
            <Trash2 className="w-4 h-4" /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecetaList({
  recetas,
  config,
  medicos,
  isAdmin,
  farmaciaUser,
  activeTab,
}: {
  recetas: Receta[];
  config: FarmaciaConfig;
  medicos: FarmaciaUser[];
  isAdmin: boolean;
  farmaciaUser: FarmaciaUser;
  activeTab: string;
}) {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Receta | null>(null);
  const [ticketReceta, setTicketReceta] = useState<Receta | null>(null);
  const [papeleraReceta, setPapeleraReceta] = useState<Receta | null>(null);
  const [auditoriaReceta, setAuditoriaReceta] = useState<Receta | null>(null);

  const [tipo, sector] = activeTab.split("_");
  const collectionName = tipo === "controladas" ? "recetas_controladas" : "recetas_cronicas";

  // Filtrar recetas: excluir eliminadas de la vista principal
  const visibles = recetas.filter((r) => !r.eliminada);

  const filtered = visibles.filter((r) => {
    const matchSearch =
      r.nombrePaciente.toLowerCase().includes(search.toLowerCase()) ||
      r.rut.includes(search) ||
      r.medicamento.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === "all" || r.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  const total = visibles.length;
  const pendientes = visibles.filter((r) => r.estado === "pendiente").length;

  // Una receta está "vencida" si:
  // - tiene fechaLimite y ya pasó (daysToDeadline < 0)
  // - NO tiene fechaLimite y lleva >= diasAlertaRoja días activa
  const isVencida = (r: Receta): boolean => {
    if (r.estado !== "pendiente") return false;
    if (r.fechaLimite) return daysToDeadline(r.fechaLimite) < 0;
    return daysSince(r.fechaSolicitud) >= config.diasAlertaRoja;
  };
  const isWarningZone = (r: Receta): boolean => {
    if (r.estado !== "pendiente") return false;
    if (r.fechaLimite) {
      const left = daysToDeadline(r.fechaLimite);
      return left >= 0 && left <= config.diasAlertaAmarilla;
    }
    const d = daysSince(r.fechaSolicitud);
    return d >= config.diasAlertaAmarilla && d < config.diasAlertaRoja;
  };

  const vencidas = visibles.filter(isVencida).length;
  const completadas = visibles.filter((r) => r.estado === "completado").length;

  const handleSendToPapelera = async (receta: Receta, motivo: string) => {
    setPapeleraReceta(null);
    await updateDoc(doc(db, collectionName, receta.id), {
      eliminada: true,
      eliminadaPor: farmaciaUser.name + " (" + farmaciaUser.email + ")",
      eliminadaEn: Timestamp.now(),
      motivoEliminacion: motivo,
      actualizadoEn: Timestamp.now(),
    });
    await registrarAccion(collectionName, receta.id, "ENVIADA_PAPELERA", farmaciaUser, [
      { campo: "motivo", antes: null, despues: motivo },
    ]);
  };

  const openEdit = (r: Receta) => { setEditing(r); setModalOpen(true); };
  const openCreate = () => { setEditing(null); setModalOpen(true); };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: total, color: "text-white", bg: "bg-white/5 border-white/10" },
          { label: "Pendientes", value: pendientes, color: "text-yellow-400", bg: "bg-yellow-500/5 border-yellow-500/15" },
          { label: "Vencidas 🔴", value: vencidas, color: "text-red-400", bg: vencidas > 0 ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/10" },
          { label: "Completadas", value: completadas, color: "text-green-400", bg: "bg-green-500/5 border-green-500/15" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border px-4 py-3 ${s.bg}`}>
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">{s.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Buscar por nombre, RUT o medicamento..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-brand-purple outline-none transition-colors" />
        </div>
        <div className="relative">
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
            className="appearance-none bg-black/20 border border-white/10 rounded-xl pl-4 pr-9 py-2.5 text-sm focus:border-brand-purple outline-none transition-colors">
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="completado">Completados</option>
            <option value="rechazado">Rechazados</option>
          </select>
          <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button onClick={openCreate}
          className="flex items-center justify-center gap-2 bg-brand-purple hover:bg-brand-purple-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:scale-[1.02]">
          <Plus className="w-4 h-4" /> Nueva Solicitud
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] border-b border-white/10 text-white/50 text-xs uppercase tracking-wider font-semibold">
                <th className="px-5 py-3.5 text-left">Estado</th>
                <th className="px-5 py-3.5 text-left">Paciente</th>
                <th className="px-5 py-3.5 text-left">RUT</th>
                <th className="px-5 py-3.5 text-left">Medicamento</th>
                <th className="px-5 py-3.5 text-left">Solicitud</th>
                <th className="px-5 py-3.5 text-left">Plazo / Tiempo</th>
                <th className="px-5 py-3.5 text-left">Médico / Receta</th>
                <th className="px-5 py-3.5 text-left">Nota</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-white/30">
                    No hay registros que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
              {filtered.map((receta) => {
                const isCritical = isVencida(receta);
                const isWarning = !isCritical && isWarningZone(receta);

                return (
                  <tr key={receta.id}
                    className={`group transition-colors ${isCritical ? "bg-red-500/5 hover:bg-red-500/10" : isWarning ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-white/[0.03]"}`}>
                    <td className="px-5 py-4 relative">
                      {isCritical && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />}
                      {isWarning && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-500" />}
                      <EstadoBadge estado={receta.estado} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-white">{receta.nombrePaciente}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-white/60 text-xs">{receta.rut}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-brand-purple">{receta.medicamento}</span>
                    </td>
                    <td className="px-5 py-4 text-white/50 text-xs whitespace-nowrap">
                      {formatDate(receta.fechaSolicitud)}
                    </td>
                    <td className="px-5 py-4">
                      <TiempoBadge receta={receta} config={config} />
                    </td>
                    <td className="px-5 py-4">
                      {receta.estado === "completado" ? (
                        <div>
                          <p className="text-green-400 font-semibold text-xs">{receta.medicoReceta || "—"}</p>
                          <p className="text-white/40 text-[10px] mt-0.5">{formatDate(receta.fechaReceta)}</p>
                        </div>
                      ) : (
                        <span className="text-white/25 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-[180px]">
                      {receta.nota ? (
                        <p className="text-white/50 text-xs line-clamp-2 leading-relaxed">{receta.nota}</p>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Historial */}
                        <button onClick={() => setAuditoriaReceta(receta)}
                          className="p-1.5 text-white/30 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                          title="Ver historial de cambios">
                          <History className="w-4 h-4" />
                        </button>
                        {/* Imprimir ticket */}
                        {receta.estado === "completado" && (
                          <button onClick={() => setTicketReceta(receta)}
                            className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Ver e Imprimir Ticket">
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {/* Editar */}
                        <button onClick={() => openEdit(receta)}
                          className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        {/* Papelera — solo admin */}
                        {isAdmin && (
                          <button onClick={() => setPapeleraReceta(receta)}
                            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Enviar a papelera">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {modalOpen && (
        <RecetaModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          receta={editing}
          medicos={medicos}
          tipo={tipo as "controladas" | "cronicas"}
          sector={sector as "A" | "B"}
          farmaciaUser={farmaciaUser}
        />
      )}
      {ticketReceta && (
        <TicketModal receta={ticketReceta} onClose={() => setTicketReceta(null)} />
      )}
      {papeleraReceta && (
        <ConfirmPapeleraModal
          receta={papeleraReceta}
          onConfirm={(motivo) => handleSendToPapelera(papeleraReceta, motivo)}
          onCancel={() => setPapeleraReceta(null)}
        />
      )}
      {auditoriaReceta && (
        <AuditoriaDrawer
          recetaId={auditoriaReceta.id}
          collectionName={collectionName}
          paciente={auditoriaReceta.nombrePaciente}
          onClose={() => setAuditoriaReceta(null)}
        />
      )}
    </div>
  );
}
