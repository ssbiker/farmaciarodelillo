import { useState } from "react";
import type { Receta, FarmaciaUser, FarmaciaConfig } from "../types";
import { CheckCircle2, Clock, XCircle, AlertCircle, Stethoscope, Pill, ArrowRight, Plus, History, Baby, Wind } from "lucide-react";
import { RecetaModal } from "./RecetaModal";
import { AuditoriaDrawer } from "./AuditoriaDrawer";
import { getItemsDeReceta } from "../lib/recetaHelpers";

function formatDate(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function daysToDeadline(ts: any): number {
  return Math.ceil((ts.toDate().getTime() - Date.now()) / 86400000);
}

function daysSince(ts: any): number {
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
}

function UrgenciaBadge({ receta, config }: { receta: Receta; config: FarmaciaConfig }) {
  if (receta.estado !== "pendiente") return null;
  if (receta.fechaLimite) {
    const left = daysToDeadline(receta.fechaLimite);
    if (left < 0)
      return <span className="text-[11px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">Vencida {Math.abs(left)}d</span>;
    if (left <= config.diasAlertaAmarilla)
      return <span className="text-[11px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">{left}d restantes</span>;
    return <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{left}d restantes</span>;
  }
  const days = daysSince(receta.fechaSolicitud);
  if (days >= config.diasAlertaRoja)
    return <span className="text-[11px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">{days}d activa</span>;
  if (days >= config.diasAlertaAmarilla)
    return <span className="text-[11px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">{days}d activa</span>;
  return <span className="text-[11px] text-[#3D5278] bg-[#EFF3FB] border border-[#DDE6F5] px-2 py-0.5 rounded-full">{days}d activa</span>;
}

function RecetaCard({ receta, config, onAction, onAuditoria }: { receta: Receta; config: FarmaciaConfig; onAction?: () => void; onAuditoria?: () => void }) {
  const tipoBadge = receta.tipo === "controlado"
    ? <span className="flex items-center gap-0.5 text-[11px] text-brand-purple bg-brand-purple/10 px-1.5 py-0.5 rounded-full"><Pill className="w-2.5 h-2.5" /> Controlada</span>
    : receta.tipo === "maternal"
    ? <span className="flex items-center gap-0.5 text-[11px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full"><Baby className="w-2.5 h-2.5" /> Maternal</span>
    : receta.tipo === "respiratorio"
    ? <span className="flex items-center gap-0.5 text-[11px] text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full"><Wind className="w-2.5 h-2.5" /> Respiratorio</span>
    : <span className="flex items-center gap-0.5 text-[11px] text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded-full"><Stethoscope className="w-2.5 h-2.5" /> Crónica</span>;

  return (
    <div 
      onClick={onAction}
      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
      receta.estado === "pendiente"
        ? `bg-white border-[#DDE6F5] hover:bg-[#F8FAFF] ${onAction ? 'cursor-pointer hover:shadow-md hover:border-brand-blue/30 group' : ''}`
        : receta.estado === "completado"
          ? "bg-green-50 border-green-200"
          : "bg-[#F8FAFF] border-[#EEF3FC]"
    }`}>
      <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 transition-colors ${
        receta.estado === "completado" ? "bg-green-500/20" :
        receta.estado === "rechazado" ? "bg-[#EFF3FB]" : "bg-yellow-500/15"
      } ${onAction ? 'group-hover:bg-brand-blue/10' : ''}`}>
        {receta.estado === "completado"
          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
          : receta.estado === "rechazado"
            ? <XCircle className="w-4 h-4 text-[#5D7299]" />
            : <Clock className={`w-4 h-4 text-yellow-600 ${onAction ? 'group-hover:text-brand-blue' : ''}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-semibold text-sm truncate transition-colors ${onAction ? 'text-[#0F1B35] group-hover:text-brand-blue' : 'text-[#0F1B35]'}`}>{receta.nombrePaciente}</p>
          <span className="font-mono text-[11px] text-[#5D7299] whitespace-nowrap">{receta.rut}</span>
        </div>
        {(() => {
          const items = getItemsDeReceta(receta);
          const first = items[0] || { medicamento: receta.medicamento, cantidad: receta.cantidad };
          const extra = items.length - 1;
          const itemsTooltip = items.map((it, idx) => `${idx + 1}. ${it.medicamento === "SOLICITUD_RECETA" ? "Solicitud s/med" : it.medicamento}${it.cantidad ? ` ×${it.cantidad}` : ""}`).join("\n");

          return (
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {first.medicamento === "SOLICITUD_RECETA" ? (
                <span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  📋 Solicitud s/med
                </span>
              ) : (
                <span className="text-xs text-brand-indigo font-bold">{first.medicamento}</span>
              )}
              {first.cantidad ? (
                <span className="text-[10px] font-bold text-[#5D7299] bg-[#F0F4FF] px-1.5 py-0.2 rounded border border-[#DDE6F5]">
                  ×{first.cantidad}
                </span>
              ) : null}
              {extra > 0 && (
                <span title={itemsTooltip} className="text-[10px] font-bold bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-1.5 py-0.2 cursor-help">
                  +{extra} más
                </span>
              )}
            </div>
          );
        })()}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {tipoBadge}
          <span className="text-[11px] text-[#5D7299]">Sec. {receta.sector}</span>
          <UrgenciaBadge receta={receta} config={config} />
          {receta.estado === "completado" && receta.fechaReceta && (
            <span className="text-[11px] text-green-700">Autorizada {formatDate(receta.fechaReceta)}</span>
          )}
          {receta.estado === "rechazado" && (
            <span className="text-[11px] text-[#5D7299]">Rechazada {formatDate(receta.actualizadoEn)}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between self-stretch gap-1">
        <div className="text-[11px] text-[#8FA3C4] whitespace-nowrap">{formatDate(receta.fechaSolicitud)}</div>
        <div className="flex items-center gap-1 mt-auto">
          {onAuditoria && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAuditoria(); }}
              className="p-1.5 hover:bg-brand-purple/10 rounded-lg transition-colors text-[#8FA3C4] hover:text-brand-purple"
              title="Ver historial de auditoría"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {onAction && (
            <div className="bg-brand-blue/10 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-3.5 h-3.5 text-brand-blue" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VistaMedico({
  farmaciaUser,
  todasRecetas,
  config,
  medicos,
  isAdmin,
  isMedico: _isMedico,
  isFuncionario,
}: {
  farmaciaUser: FarmaciaUser;
  todasRecetas: Receta[];
  config: FarmaciaConfig;
  medicos: FarmaciaUser[];
  isAdmin: boolean;
  isMedico: boolean;
  isFuncionario: boolean;
}) {
  const [selectedReceta, setSelectedReceta] = useState<Receta | null>(null);
  const [crearRecetaOpen, setCrearRecetaOpen] = useState(false);
  const [auditoriaReceta, setAuditoriaReceta] = useState<Receta | null>(null);

  // Recetas donde este médico está asignado O que él autorizó/rechazó
  const misRecetas = todasRecetas.filter(
    (r) => !r.eliminada && (r.medicoUid === farmaciaUser.id || r.medicoReceta === farmaciaUser.name)
  );

  const pendientes = misRecetas.filter((r) => r.estado === "pendiente");
  const autorizadas = misRecetas.filter((r) => r.estado === "completado");
  const rechazadas = misRecetas.filter((r) => r.estado === "rechazado");

  // Recetas sin médico asignado que cualquier médico puede atender
  const sinAsignar = todasRecetas.filter(
    (r) => !r.eliminada && r.estado === "pendiente" && (!r.medicoUid || r.medicoUid === "")
  );

  const total = misRecetas.length;
  const pctCompletadas = total > 0 ? Math.round((autorizadas.length / total) * 100) : 0;

  // Urgentes: pendientes vencidas o en zona roja
  const urgentes = pendientes.filter((r) => {
    if (r.fechaLimite) return daysToDeadline(r.fechaLimite) < 0;
    return daysSince(r.fechaSolicitud) >= config.diasAlertaRoja;
  });

  const stats = [
    { label: "Mis Pendientes", value: pendientes.length, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: Clock },
    { label: "Autorizadas", value: autorizadas.length, color: "text-green-700", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
    { label: "Rechazadas", value: rechazadas.length, color: "text-[#3D5278]", bg: "bg-[#F8FAFF] border-[#DDE6F5]", icon: XCircle },
    { label: "Urgentes 🔴", value: urgentes.length, color: "text-red-600", bg: urgentes.length > 0 ? "bg-red-50 border-red-200" : "bg-[#F8FAFF] border-[#DDE6F5]", icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-brand-blue/10 p-3 rounded-2xl border border-brand-blue/20 flex-shrink-0">
            <Stethoscope className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#0F1B35]">Mi Panel</h2>
            <p className="text-[#5D7299] text-sm mt-0.5">Dr(a). {farmaciaUser.name} — Resumen personal de recetas</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCrearRecetaOpen(true)}
          className="flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:scale-[1.02] flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Receta Médica
        </button>
      </div>

      {/* Alerta urgentes */}
      {urgentes.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
          <div>
            <p className="font-bold text-red-700 text-sm">
              {urgentes.length} receta{urgentes.length > 1 ? "s" : ""} urgente{urgentes.length > 1 ? "s" : ""} esperando tu autorización
            </p>
            <p className="text-xs text-red-500">Revisalas a continuación.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border px-4 py-4 ${bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <p className="text-[11px] text-[#5D7299] uppercase tracking-wide font-semibold">{label}</p>
            </div>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progreso */}
      {total > 0 && (
        <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#5D7299] uppercase tracking-wide">Tasa de resolución</p>
            <p className="text-sm font-black text-[#0F1B35]">{pctCompletadas}%</p>
          </div>
          <div className="h-2 bg-[#EEF3FC] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-purple to-brand-blue rounded-full transition-all duration-700"
              style={{ width: `${pctCompletadas}%` }}
            />
          </div>
          <p className="text-xs text-[#8FA3C4] mt-2">{autorizadas.length} de {total} recetas resueltas</p>
        </div>
      )}

      {/* Dos columnas: Mis pendientes | Sin asignar (puede atender) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Mis pendientes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <h3 className="font-bold text-sm text-[#0F1B35]">Pendientes asignadas a mí</h3>
            {pendientes.length > 0 && (
              <span className="ml-auto text-[11px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-bold">{pendientes.length}</span>
            )}
          </div>
          {pendientes.length === 0 ? (
            <div className="rounded-2xl border border-[#EEF3FC] bg-[#F8FAFF] p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500/40 mx-auto mb-2" />
              <p className="text-sm text-[#5D7299]">Sin pendientes. ¡Todo al día!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {pendientes
                .sort((a, b) => {
                  // Ordenar: urgentes primero
                  const aUrgente = a.fechaLimite ? daysToDeadline(a.fechaLimite) : (config.diasAlertaRoja - daysSince(a.fechaSolicitud));
                  const bUrgente = b.fechaLimite ? daysToDeadline(b.fechaLimite) : (config.diasAlertaRoja - daysSince(b.fechaSolicitud));
                  return aUrgente - bUrgente;
                })
                .map((r) => <RecetaCard key={r.id} receta={r} config={config} onAction={() => setSelectedReceta(r)} onAuditoria={() => setAuditoriaReceta(r)} />)
              }
            </div>
          )}
        </div>

        {/* Sin asignar — puede atender cualquier médico */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-purple" />
            <h3 className="font-bold text-sm text-[#0F1B35]">Sin médico asignado</h3>
            <span className="text-xs text-[#5D7299] font-normal">(cualquier médico puede atender)</span>
            {sinAsignar.length > 0 && (
              <span className="ml-auto text-[11px] bg-brand-purple/10 text-brand-purple border border-brand-purple/20 px-2 py-0.5 rounded-full font-bold">{sinAsignar.length}</span>
            )}
          </div>
          {sinAsignar.length === 0 ? (
            <div className="rounded-2xl border border-[#EEF3FC] bg-[#F8FAFF] p-8 text-center">
              <p className="text-sm text-[#5D7299]">No hay recetas sin médico asignado.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {sinAsignar
                .sort((a, b) => {
                  const aUrgente = a.fechaLimite ? daysToDeadline(a.fechaLimite) : (config.diasAlertaRoja - daysSince(a.fechaSolicitud));
                  const bUrgente = b.fechaLimite ? daysToDeadline(b.fechaLimite) : (config.diasAlertaRoja - daysSince(b.fechaSolicitud));
                  return aUrgente - bUrgente;
                })
                .map((r) => <RecetaCard key={r.id} receta={r} config={config} onAction={() => setSelectedReceta(r)} onAuditoria={() => setAuditoriaReceta(r)} />)
              }
            </div>
          )}
        </div>
      </div>

      {/* Historial reciente */}
      {(autorizadas.length > 0 || rechazadas.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="font-bold text-sm text-[#0F1B35]">Historial reciente (últimas 10)</h3>
          </div>
          <div className="space-y-2">
            {[...autorizadas, ...rechazadas]
              .sort((a, b) => (b.actualizadoEn?.toDate?.() ?? 0) as any - ((a.actualizadoEn?.toDate?.() ?? 0) as any))
              .slice(0, 10)
              .map((r) => <RecetaCard key={r.id} receta={r} config={config} onAuditoria={() => setAuditoriaReceta(r)} />)
            }
          </div>
        </div>
      )}

      {selectedReceta && (
        <RecetaModal
          isOpen={true}
          onClose={() => setSelectedReceta(null)}
          receta={selectedReceta}
          medicos={medicos}
          tipo={selectedReceta.tipo === "controlado" ? "controladas" : selectedReceta.tipo === "maternal" ? "maternales" : selectedReceta.tipo === "respiratorio" ? "respiratorias" : "cronicas"}
          sector={(selectedReceta.sector || "A") as "A" | "B" | "CECOSF"}
          farmaciaUser={farmaciaUser}
          soloAutorizacion={true}
          puedeEditarDatos={isAdmin || isFuncionario}
          puedeAutorizar={true}
          todasRecetas={todasRecetas}
        />
      )}

      {crearRecetaOpen && (
        <RecetaModal
          isOpen={true}
          onClose={() => setCrearRecetaOpen(false)}
          receta={null}
          medicos={medicos}
          tipo="cronicas"
          sector="A"
          farmaciaUser={farmaciaUser}
          soloAutorizacion={true}
          puedeEditarDatos={true}
          puedeAutorizar={true}
          todasRecetas={todasRecetas}
        />
      )}

      {auditoriaReceta && (
        <AuditoriaDrawer
          recetaId={auditoriaReceta.id}
          collectionName={auditoriaReceta.tipo === "controlado" ? "recetas_controladas" : auditoriaReceta.tipo === "maternal" ? "recetas_maternales" : auditoriaReceta.tipo === "respiratorio" ? "recetas_respiratorias" : "recetas_cronicas"}
          paciente={auditoriaReceta.nombrePaciente}
          onClose={() => setAuditoriaReceta(null)}
        />
      )}
    </div>
  );
}
