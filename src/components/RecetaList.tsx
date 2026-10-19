import { useState } from "react";
import type { Receta, FarmaciaConfig, FarmaciaUser } from "../types";
import {
  Clock, CheckCircle2, XCircle, Trash2, Edit, Printer,
  Plus, Search, AlertCircle, ChevronDown, ChevronRight, History,
} from "lucide-react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { registrarAccion } from "../lib/auditoria";
import { RecetaModal } from "./RecetaModal";
import { TicketModal } from "./TicketModal";
import { AuditoriaDrawer } from "./AuditoriaDrawer";
import { RutBadge } from "./RutBadge";
import { getItemsDeReceta, getEstadoItemRenovacion, isRecetaVigente } from "../lib/recetaHelpers";

function daysSince(ts: any): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = ts.toDate();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today.getTime() - target.getTime()) / 86400000);
}

function daysToDeadline(ts: any): number {
  // Positivo = días restantes, negativo = días vencida
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = ts.toDate();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function EstadoBadge({ estado, sinVigencia }: { estado: string; sinVigencia?: boolean }) {
  if (estado === "completado" && sinVigencia)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
        <XCircle className="w-3.5 h-3.5" /> Sin vigencia
      </span>
    );
  if (estado === "completado")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
        <CheckCircle2 className="w-3.5 h-3.5" /> Completado
      </span>
    );
  if (estado === "rechazado")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
        <XCircle className="w-3.5 h-3.5" /> Rechazado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
      <Clock className="w-3.5 h-3.5" /> Pendiente
    </span>
  );
}

function TiempoBadge({ receta, config }: { receta: Receta; config: FarmaciaConfig }) {
  if (receta.estado !== "pendiente") return <span className="text-[#5D7299] text-xs">—</span>;

  // ── Modo fecha límite ──
  if (receta.fechaLimite) {
    const left = daysToDeadline(receta.fechaLimite);
    if (left < 0) {
      // Vencida
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-600/20 text-red-500 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse">
          <AlertCircle className="w-3 h-3" /> Vencida {Math.abs(left)}d
        </span>
      );
    }
    if (left <= config.diasAlertaAmarilla) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
          <Clock className="w-3 h-3" /> {left}d restantes
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <Clock className="w-3 h-3" /> {left}d restantes
      </span>
    );
  }

  // ── Modo días activa (fallback sin fecha límite) ──
  const days = daysSince(receta.fechaSolicitud);
  if (days >= config.diasAlertaRoja)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-600/20 text-red-500 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse">
        <AlertCircle className="w-3 h-3" /> {days}d activa
      </span>
    );
  if (days >= config.diasAlertaAmarilla)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
        <Clock className="w-3 h-3" /> {days}d activa
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EFF3FB] text-[#3D5278] border border-[#DDE6F5]">
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
      <div className="relative bg-white border border-[#DDE6F5] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="font-black text-lg mb-1 text-[#0F1B35]">Enviar a Papelera</h3>
        <p className="text-xs text-[#3D5278] mb-4">
          Receta de <strong className="text-[#0F1B35]">{receta.nombrePaciente}</strong>. Se guardará quién realizó esta acción.
        </p>
        <label className="block text-xs font-semibold text-[#3D5278] uppercase tracking-wide mb-1.5">
          Motivo (obligatorio)
        </label>
        <textarea
          rows={3}
          placeholder="Ej: Receta duplicada, error de carga..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full bg-white border border-[#DDE6F5] rounded-xl px-4 py-3 text-[#0F1B35] placeholder-[#8FA3C4] focus:border-brand-blue outline-none transition-colors text-sm resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#3D5278] hover:bg-[#EFF3FB] transition-colors">
            Cancelar
          </button>
          <button
            disabled={!motivo.trim()}
            onClick={() => onConfirm(motivo.trim())}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40">
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
  isMedico,
  isFuncionario,
  farmaciaUser,
  activeTab,
  todasRecetas,
}: {
  recetas: Receta[];
  config: FarmaciaConfig;
  medicos: FarmaciaUser[];
  isAdmin: boolean;
  isMedico: boolean;
  isFuncionario: boolean;
  farmaciaUser: FarmaciaUser;
  activeTab: string;
  todasRecetas?: Receta[];
}) {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Receta | null>(null);
  const [ticketReceta, setTicketReceta] = useState<Receta | null>(null);
  const [papeleraReceta, setPapeleraReceta] = useState<Receta | null>(null);
  const [auditoriaReceta, setAuditoriaReceta] = useState<Receta | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) => setExpandedRows(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const tipo = activeTab.startsWith("controladas") ? "controladas"
             : activeTab.startsWith("maternales") ? "maternales"
             : activeTab.startsWith("respiratorias") ? "respiratorias"
             : "cronicas";
  const sector = activeTab.includes("CECOSF") ? "CECOSF" : activeTab.split("_")[1];
  const collectionName = tipo === "controladas" ? "recetas_controladas"
                       : tipo === "maternales" ? "recetas_maternales"
                       : tipo === "respiratorias" ? "recetas_respiratorias"
                       : "recetas_cronicas";

  // ── Permisos granulares ──────────────────────────────────────────────────────
  // Super Admin: ssanchez@cmvalparaiso.cl puede editar cualquier receta (incluso completada) para corregir cantidades/medicamentos
  const isSuperAdmin = Boolean(farmaciaUser?.email?.toLowerCase() === "ssanchez@cmvalparaiso.cl" || farmaciaUser?.role === "superadmin");
  // Puede crear recetas: admin/quimico, funcionario (NO médico puro)
  const puedeCrear = isAdmin || isFuncionario || isMedico;
  // Puede editar datos del paciente/medicamento: admin/quimico, funcionario
  const puedeEditarDatos = isAdmin || isFuncionario;

  /** Puede cambiar el estado (autorizar/rechazar) de una receta concreta */
  const puedeCambiarEstado = (r: Receta): boolean => {
    if (isAdmin) return true;
    if (!isMedico) return false;
    // Si la receta tiene médico asignado, solo ese médico puede cambiar estado
    if (r.medicoUid && r.medicoUid !== "") {
      return r.medicoUid === farmaciaUser.id;
    }
    // Sin médico asignado → cualquier médico puede
    return true;
  };

  // Filtrar recetas: excluir eliminadas de la vista principal
  const visibles = recetas.filter((r) => !r.eliminada);

  const filtered = visibles.filter((r) => {
    const q = search.toLowerCase();
    const cleanSearch = search.replace(/[^0-9kK]/gi, "").toUpperCase();
    const cleanRut = (r.rut || "").replace(/[^0-9kK]/gi, "").toUpperCase();
    const matchNombre = r.nombrePaciente.toLowerCase().includes(q);
    const matchRut = r.rut.includes(search) || (cleanSearch.length >= 2 && cleanRut.includes(cleanSearch));
    // Buscar en todos los medicamentos (multi-ítem o plano)
    const matchMed = getItemsDeReceta(r).some(it =>
      it.medicamento.toLowerCase().includes(q) && it.medicamento !== "SOLICITUD_RECETA"
    );
    const matchSearch = matchNombre || matchRut || matchMed;
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
          { label: "Total", value: total, color: "text-[#0F1B35]", bg: "bg-[#F8FAFF] border-[#DDE6F5]" },
          { label: "Pendientes", value: pendientes, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
          { label: "Vencidas 🔴", value: vencidas, color: "text-red-600", bg: vencidas > 0 ? "bg-red-50 border-red-200" : "bg-[#F8FAFF] border-[#DDE6F5]" },
          { label: "Completadas", value: completadas, color: "text-green-700", bg: "bg-green-50 border-green-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border px-4 py-3 ${s.bg}`}>
            <p className="text-[11px] text-[#5D7299] uppercase tracking-wide font-semibold">{s.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8FA3C4] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Buscar por nombre, RUT o medicamento..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#DDE6F5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F1B35] placeholder-[#8FA3C4] focus:border-brand-blue outline-none transition-colors" />
        </div>
        <div className="relative">
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
            className="appearance-none bg-white border border-[#DDE6F5] rounded-xl pl-4 pr-9 py-2.5 text-sm text-[#0F1B35] focus:border-brand-blue outline-none transition-colors">
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="completado">Completados</option>
            <option value="rechazado">Rechazados</option>
          </select>
          <ChevronDown className="w-4 h-4 text-[#5D7299] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {puedeCrear && (
          <button onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:scale-[1.02]">
            <Plus className="w-4 h-4" /> Nueva Solicitud
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-[#DDE6F5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F0F4FF] border-b border-[#DDE6F5] text-[#5D7299] text-xs uppercase tracking-wide font-semibold">
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
            <tbody className="divide-y divide-[#EEF3FC]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[#5D7299]">
                    No hay registros que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
              {filtered.map((receta) => {
                const isCritical = isVencida(receta);
                const isWarning = !isCritical && isWarningZone(receta);
                // Receta completada cuyo ciclo ya terminó (entrega única > 30d o renovación agotada)
                const sinVigencia = receta.estado === "completado" && !isRecetaVigente(receta);

                return (
                  <tr key={receta.id}
                    className={`group transition-colors ${
                      sinVigencia
                        ? "bg-slate-50 opacity-70 hover:opacity-100 hover:bg-slate-100/60"
                        : isCritical
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : isWarning
                        ? "bg-yellow-500/5 hover:bg-yellow-500/10"
                        : "hover:bg-[#F5F8FF]"
                    }`}>
                    <td className="px-5 py-4 relative">
                      {isCritical && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />}
                      {isWarning && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-500" />}
                      {sinVigencia && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-300" />}
                      <EstadoBadge estado={receta.estado} sinVigencia={sinVigencia} />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${sinVigencia ? "text-slate-400" : "text-[#0F1B35]"}`}>{receta.nombrePaciente}</span>
                    </td>
                    <td className="px-5 py-4">
                      <RutBadge rut={receta.rut} className="text-[#3D5278]" />
                    </td>
                    <td className="px-5 py-4">
                      {(() => {
                        const items = getItemsDeReceta(receta);
                        const isMulti = items.length > 1;
                        const firstItem = items[0] || { medicamento: receta.medicamento, cantidad: receta.cantidad, autoRenovacion: 0, mesesDescontados: 0 };
                        const isExpanded = expandedRows.has(receta.id);

                        return (
                          <div className="flex flex-col gap-1 items-start">
                            {/* Primera línea: nombre del primer medicamento */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {firstItem.medicamento === "SOLICITUD_RECETA" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                                  📋 Pendiente médico
                                </span>
                              ) : (
                                <span className="font-semibold text-brand-indigo">
                                  {firstItem.medicamento}
                                </span>
                              )}
                              {firstItem.cantidad ? (
                                <span className="text-[11px] font-bold text-[#5D7299] bg-[#F0F4FF] px-1.5 py-0.5 rounded border border-[#DDE6F5]">
                                  ×{firstItem.cantidad}
                                </span>
                              ) : null}
                              {/* Badge de estado del PRIMER ítem */}
                              {receta.estado === "completado" && firstItem.medicamento !== "SOLICITUD_RECETA" && (() => {
                                const est = getEstadoItemRenovacion(firstItem as any, receta.fechaSolicitud);
                                return (
                                  <span className={`text-[10px] font-bold ${est.bg} ${est.text} border ${est.border} rounded-full px-1.5 py-0.5`}>
                                    {est.label}
                                  </span>
                                );
                              })()}
                            </div>

                            {/* Botón expandir si hay más medicamentos */}
                            {isMulti && (
                              <button
                                type="button"
                                onClick={() => toggleRow(receta.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-2 py-0.5 shadow-sm hover:bg-brand-blue/20 transition-colors"
                              >
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                💊 {isExpanded ? "Ocultar" : `+${items.length - 1} medicamento${items.length > 2 ? 's' : ''} más`}
                              </button>
                            )}

                            {/* Panel expandido: lista completa de medicamentos */}
                            {isMulti && isExpanded && (
                              <div className="mt-2 w-full space-y-1.5 bg-[#F8FAFF] border border-[#DDE6F5] rounded-xl p-3 shadow-sm">
                                <p className="text-[10px] font-bold text-[#5D7299] uppercase tracking-widest mb-2">Todos los medicamentos</p>
                                {items.map((it, idx) => {
                                  const est = receta.estado === "completado" && it.medicamento !== "SOLICITUD_RECETA"
                                    ? getEstadoItemRenovacion(it, receta.fechaSolicitud)
                                    : null;
                                  return (
                                    <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-[#DDE6F5] px-3 py-2">
                                      <span className="text-[11px] font-bold text-[#5D7299] min-w-[16px]">{idx + 1}.</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold text-brand-indigo block leading-tight">
                                          {it.medicamento === "SOLICITUD_RECETA" ? "📋 Pendiente médico" : it.medicamento}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          {it.cantidad > 0 && (
                                            <span className="text-[10px] font-bold text-[#5D7299] bg-[#F0F4FF] px-1.5 py-0.5 rounded border border-[#DDE6F5]">
                                              ×{it.cantidad} unidades
                                            </span>
                                          )}
                                          {est && (
                                            <span className={`text-[10px] font-bold ${est.bg} ${est.text} border ${est.border} rounded-full px-1.5 py-0.5`}>
                                              {est.label}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-[#5D7299] text-xs whitespace-nowrap">
                      {formatDate(receta.fechaSolicitud)}
                    </td>
                    <td className="px-5 py-4">
                      <TiempoBadge receta={receta} config={config} />
                    </td>
                    <td className="px-5 py-4">
                      {receta.estado === "completado" ? (
                        <div>
                          <p className="text-green-700 font-semibold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3"/> {receta.medicoReceta || "—"}
                          </p>
                          <p className="text-[#5D7299] text-[11px] mt-0.5">{formatDate(receta.fechaReceta)}</p>
                        </div>
                      ) : receta.medicoReceta ? (
                        <div>
                          <p className="text-brand-blue font-semibold text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3"/> {receta.medicoReceta}
                          </p>
                          <p className="text-[#5D7299] text-[11px] mt-0.5">Asignado (Pendiente)</p>
                        </div>
                      ) : receta.estado === "rechazado" ? (
                        <div>
                          <p className="text-red-600 font-semibold text-xs">❌ Rechazado</p>
                          {receta.motivoRechazo && <p className="text-red-400 text-[11px] mt-0.5 italic line-clamp-2">{receta.motivoRechazo}</p>}
                        </div>
                      ) : (
                        <span className="text-[#8FA3C4] text-xs">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-[180px]">
                      {receta.nota ? (
                        <p className="text-[#3D5278] text-xs line-clamp-2 leading-relaxed">{receta.nota}</p>
                      ) : (
                        <span className="text-[#8FA3C4] text-xs">—</span>
                      )}
                      {receta.estado === "rechazado" && receta.motivoRechazo && (
                        <p className="text-red-500 text-xs mt-1 italic">❌ {receta.motivoRechazo}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Historial */}
                        <button onClick={() => setAuditoriaReceta(receta)}
                          className="p-1.5 text-[#5D7299] hover:text-purple-500 hover:bg-purple-500/10 rounded-lg transition-colors"
                          title="Ver historial de cambios">
                          <History className="w-4 h-4" />
                        </button>
                        {/* Imprimir ticket */}
                        {receta.estado === "completado" && (
                          <button onClick={() => setTicketReceta(receta)}
                            className="p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                            title="Ver e Imprimir Ticket">
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {/* Editar datos (funcionario/admin) o Autorizar (médico con permiso) o Super Admin */}
                        {(puedeEditarDatos || puedeCambiarEstado(receta) || isSuperAdmin) && (
                          <button onClick={() => openEdit(receta)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSuperAdmin
                                ? "text-purple-600 hover:text-purple-800 hover:bg-purple-100/70"
                                : puedeCambiarEstado(receta) && !puedeEditarDatos
                                ? "text-brand-blue hover:text-brand-blue-dark hover:bg-brand-blue/10"
                                : "text-[#5D7299] hover:text-brand-blue hover:bg-brand-blue/10"
                            }`}
                            title={
                              isSuperAdmin
                                ? "🛡️ Super Admin: Editar receta y corregir cantidades/medicamentos"
                                : puedeCambiarEstado(receta) && !puedeEditarDatos
                                ? "Autorizar / Rechazar"
                                : "Editar"
                            }>
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {/* Médico sin permiso para esta receta: mostrar candado */}
                        {isMedico && !isAdmin && !puedeCambiarEstado(receta) && (
                          <span
                            className="p-1.5 text-[#C4D4EE] rounded-lg cursor-not-allowed"
                            title="Solo el médico asignado puede autorizar esta receta">
                            🔒
                          </span>
                        )}
                        {/* Papelera — solo admin */}
                        {isAdmin && (
                          <button onClick={() => setPapeleraReceta(receta)}
                            className="p-1.5 text-[#5D7299] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
          tipo={tipo as "controladas" | "cronicas" | "maternales" | "respiratorias"}
          sector={sector as "A" | "B" | "CECOSF"}
          farmaciaUser={farmaciaUser}
          soloAutorizacion={Boolean(editing && (isMedico || isAdmin) && !isSuperAdmin)}
          puedeEditarDatos={puedeEditarDatos || isSuperAdmin}
          puedeAutorizar={isAdmin || isMedico || isSuperAdmin}
          todasRecetas={todasRecetas ?? recetas}
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
