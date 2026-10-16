import { useMemo } from "react";
import type { Receta, FarmaciaUser, FarmaciaConfig } from "../types";
import { getItemsDeReceta, isRecetaVigente } from "../lib/recetaHelpers";
import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  Stethoscope, Users, Pill, TrendingUp, Activity, Baby, Wind,
  RefreshCw, Archive, Zap
} from "lucide-react";

function daysSince(ts: any): number {
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
}
function daysToDeadline(ts: any): number {
  return Math.ceil((ts.toDate().getTime() - Date.now()) / 86400000);
}
function isVencida(r: Receta, config: FarmaciaConfig): boolean {
  if (r.estado !== "pendiente" || r.eliminada) return false;
  if (r.fechaLimite) return daysToDeadline(r.fechaLimite) < 0;
  return daysSince(r.fechaSolicitud) >= config.diasAlertaRoja;
}
function formatDate(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-[#EEF3FC] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EstadisticasAdmin({
  todasRecetas,
  medicos,
  config,
}: {
  todasRecetas: Receta[];
  medicos: FarmaciaUser[];
  config: FarmaciaConfig;
}) {
  const activas = todasRecetas.filter((r) => !r.eliminada);

  // ── Totales globales ────────────────────────────────────────────────────────
  const totalGlobal = activas.length;
  const pendientesGlobal = activas.filter((r) => r.estado === "pendiente").length;
  const completadasGlobal = activas.filter((r) => r.estado === "completado").length;
  const rechazadasGlobal = activas.filter((r) => r.estado === "rechazado").length;
  const vencidasGlobal = activas.filter((r) => isVencida(r, config)).length;
  const sinAsignarGlobal = activas.filter((r) => r.estado === "pendiente" && (!r.medicoUid || r.medicoUid === "")).length;
  const pctResolucion = totalGlobal > 0 ? Math.round((completadasGlobal / totalGlobal) * 100) : 0;

  // ── Estadísticas de ciclos de renovación ────────────────────────────────────
  const recetasCompletadas = activas.filter((r) => r.estado === "completado");

  // Expiradas: completadas que ya no tienen vigencia
  const expiradas = recetasCompletadas.filter((r) => !isRecetaVigente(r));

  // Vigentes con renovación: completadas vigentes que tienen autoRenovacion > 0 en algún ítem
  const conRenovacionVigente = recetasCompletadas.filter((r) => {
    if (!isRecetaVigente(r)) return false;
    const items = getItemsDeReceta(r);
    return items.some((it) => (it.autoRenovacion ?? 0) > 0);
  });

  // Vigentes sin renovación (entrega única < 30 días)
  const entregaUnicaVigente = recetasCompletadas.filter((r) => {
    if (!isRecetaVigente(r)) return false;
    const items = getItemsDeReceta(r);
    return items.every((it) => (it.autoRenovacion ?? 0) === 0);
  });

  // Para renovación activa: calcular progreso por receta
  const renovacionDetalle = useMemo(() => {
    return conRenovacionVigente.map((r) => {
      const items = getItemsDeReceta(r);
      const maxRenovacion = Math.max(...items.map((it) => it.autoRenovacion ?? 0));
      const fecha = r.fechaReceta ?? r.fechaSolicitud;
      let elapsedMonths = 0;
      if (fecha && typeof fecha.toDate === "function") {
        const start = fecha.toDate();
        const today = new Date();
        elapsedMonths = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
        if (today.getDate() < start.getDate()) elapsedMonths--;
        elapsedMonths = Math.max(0, elapsedMonths);
      }
      const mesActual = Math.max(1, elapsedMonths + 1);
      return { r, mesActual, maxRenovacion, pct: Math.round((mesActual / maxRenovacion) * 100) };
    }).sort((a, b) => b.pct - a.pct); // más avanzados primero
  }, [conRenovacionVigente]);

  // Expiradas por tipo (para el desglose)
  const expiradasPorTipo = useMemo(() => [
    { label: "Controladas", tipo: "controlado", color: "text-brand-purple", bg: "bg-brand-purple/10", border: "border-brand-purple/20" },
    { label: "Crónicas", tipo: "cronico", color: "text-brand-blue", bg: "bg-brand-blue/10", border: "border-brand-blue/20" },
    { label: "Maternal", tipo: "maternal", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-200" },
    { label: "Respiratorio", tipo: "respiratorio", color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
  ].map(({ label, tipo, color, bg, border }) => ({
    label, color, bg, border,
    count: expiradas.filter((r) => r.tipo === tipo).length,
  })).filter((t) => t.count > 0), [expiradas]);


  // ── Por tipo/sector ─────────────────────────────────────────────────────────
  const porTipo = useMemo(() => [
    { label: "Controladas A", tipo: "controlado", sector: "A", color: "text-brand-purple", icon: Pill },
    { label: "Controladas B", tipo: "controlado", sector: "B", color: "text-brand-purple", icon: Pill },
    { label: "Controladas CECOSF", tipo: "controlado", sector: "CECOSF", color: "text-brand-purple", icon: Pill },
    { label: "Crónicas A", tipo: "cronico", sector: "A", color: "text-brand-blue", icon: Stethoscope },
    { label: "Crónicas B", tipo: "cronico", sector: "B", color: "text-brand-blue", icon: Stethoscope },
    { label: "Crónicas CECOSF", tipo: "cronico", sector: "CECOSF", color: "text-brand-blue", icon: Stethoscope },
    { label: "Maternal A", tipo: "maternal", sector: "A", color: "text-purple-600", icon: Baby },
    { label: "Maternal B", tipo: "maternal", sector: "B", color: "text-purple-600", icon: Baby },
    { label: "Maternal CECOSF", tipo: "maternal", sector: "CECOSF", color: "text-purple-600", icon: Baby },
    { label: "Respiratorio A", tipo: "respiratorio", sector: "A", color: "text-teal-600", icon: Wind },
    { label: "Respiratorio B", tipo: "respiratorio", sector: "B", color: "text-teal-600", icon: Wind },
    { label: "Respiratorio CECOSF", tipo: "respiratorio", sector: "CECOSF", color: "text-teal-600", icon: Wind },
  ].map(({ label, tipo, sector, color, icon }) => {
    const rs = activas.filter((r) => r.tipo === tipo && r.sector === sector);
    return {
      label, color, icon,
      total: rs.length,
      pendientes: rs.filter((r) => r.estado === "pendiente").length,
      completadas: rs.filter((r) => r.estado === "completado").length,
      vencidas: rs.filter((r) => isVencida(r, config)).length,
    };
  }), [activas]);

  // ── Por médico ──────────────────────────────────────────────────────────────
  const porMedico = useMemo(() => {
    // Médicos registrados + médicos que aparecen en recetas pero no tienen perfil
    const medicoIds = new Set(medicos.map((m) => m.id));
    const medicosDesdRecetas: FarmaciaUser[] = activas
      .filter((r) => r.medicoUid && !medicoIds.has(r.medicoUid))
      .reduce<FarmaciaUser[]>((acc, r) => {
        if (!acc.find((m) => m.id === r.medicoUid)) {
          acc.push({ id: r.medicoUid!, name: r.medicoReceta || "Médico desconocido", email: "" });
        }
        return acc;
      }, []);

    return [...medicos, ...medicosDesdRecetas].map((medico) => {
      const rs = activas.filter(
        (r) => r.medicoUid === medico.id || (!r.medicoUid && r.medicoReceta === medico.name)
      );
      const pendientes = rs.filter((r) => r.estado === "pendiente");
      const completadas = rs.filter((r) => r.estado === "completado");
      const rechazadas = rs.filter((r) => r.estado === "rechazado");
      const vencidas = rs.filter((r) => isVencida(r, config));
      const pct = rs.length > 0 ? Math.round((completadas.length / rs.length) * 100) : 0;
      return { medico, total: rs.length, pendientes, completadas, rechazadas, vencidas, pct };
    }).sort((a, b) => b.vencidas.length - a.vencidas.length || b.pendientes.length - a.pendientes.length);
  }, [medicos, activas]);

  // ── Recetas urgentes globales ───────────────────────────────────────────────
  const urgentes = activas
    .filter((r) => isVencida(r, config))
    .sort((a, b) => {
      const aD = a.fechaLimite ? daysToDeadline(a.fechaLimite) : -daysSince(a.fechaSolicitud);
      const bD = b.fechaLimite ? daysToDeadline(b.fechaLimite) : -daysSince(b.fechaSolicitud);
      return aD - bD;
    })
    .slice(0, 8);

  // ── Top Medicamentos ────────────────────────────────────────────────────────
  const topMedicamentos = useMemo(() => {
    const medsMap = new Map<string, { totalUnidades: number, countRecetas: number, medicos: Record<string, number> }>();
    
    activas.forEach(r => {
      if (r.estado === "completado") {
        const items = getItemsDeReceta(r);
        items.forEach(it => {
          if (it.medicamento && it.medicamento !== "SOLICITUD_RECETA" && it.cantidad > 0) {
            const nombre = it.medicamento.trim().toUpperCase();
            if (!medsMap.has(nombre)) {
              medsMap.set(nombre, { totalUnidades: 0, countRecetas: 0, medicos: {} });
            }
            const data = medsMap.get(nombre)!;
            data.totalUnidades += Number(it.cantidad) || 0;
            data.countRecetas += 1;
            const medicoName = r.medicoReceta || "Desconocido";
            data.medicos[medicoName] = (data.medicos[medicoName] || 0) + 1;
          }
        });
      }
    });

    return Array.from(medsMap.entries())
      .map(([nombre, data]) => {
        const topMedico = Object.entries(data.medicos).sort((a, b) => b[1] - a[1])[0];
        return {
          nombre,
          totalUnidades: data.totalUnidades,
          countRecetas: data.countRecetas,
          medicoFrecuente: topMedico ? topMedico[0] : "—",
          medicoRecetas: topMedico ? topMedico[1] : 0
        };
      })
      .sort((a, b) => b.totalUnidades - a.totalUnidades)
      .slice(0, 10);
  }, [activas]);

  const kpiCards = [
    { label: "Total recetas", value: totalGlobal, sub: "todas las secciones", color: "text-[#0F1B35]", bg: "bg-[#F8FAFF] border-[#DDE6F5]", icon: Activity },
    { label: "Pendientes", value: pendientesGlobal, sub: `${sinAsignarGlobal} sin asignar`, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: Clock },
    { label: "Completadas", value: completadasGlobal, sub: `${pctResolucion}% resolución`, color: "text-green-700", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
    { label: "Rechazadas", value: rechazadasGlobal, sub: "en total", color: "text-[#3D5278]", bg: "bg-[#F8FAFF] border-[#DDE6F5]", icon: XCircle },
    { label: "Urgentes 🔴", value: vencidasGlobal, sub: "tiempo vencido", color: "text-red-600", bg: vencidasGlobal > 0 ? "bg-red-50 border-red-200" : "bg-[#F8FAFF] border-[#DDE6F5]", icon: AlertCircle },
    { label: "Médicos", value: medicos.length, sub: "activos en sistema", color: "text-brand-blue", bg: "bg-brand-blue/5 border-brand-blue/15", icon: Users },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="bg-brand-purple/20 p-3 rounded-2xl border border-brand-purple/25 flex-shrink-0">
          <TrendingUp className="w-6 h-6 text-brand-purple" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#0F1B35]">Estadísticas Generales</h2>
          <p className="text-[#5D7299] text-sm mt-0.5">Resumen completo de todos los médicos y recetas del sistema</p>
        </div>
      </div>

      {/* Alerta urgentes */}
      {vencidasGlobal > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
          <div>
            <p className="font-bold text-red-700 text-sm">{vencidasGlobal} receta{vencidasGlobal > 1 ? "s" : ""} con tiempo vencido en el sistema</p>
            <p className="text-xs text-red-500">Requieren atención médica inmediata.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(({ label, value, sub, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border px-4 py-4 ${bg}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className={`w-3 h-3 ${color}`} />
              <p className="text-[11px] text-[#5D7299] uppercase tracking-wide font-semibold leading-tight">{label}</p>
            </div>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-[11px] text-[#8FA3C4] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Barra de resolución global */}
      <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#5D7299] uppercase tracking-wide">Tasa de resolución global</p>
          <p className="text-sm font-black text-[#0F1B35]">{pctResolucion}%</p>
        </div>
        <div className="h-2.5 bg-[#EEF3FC] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-brand-purple via-brand-blue to-green-500"
            style={{ width: `${pctResolucion}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-[#8FA3C4]">
          <span>{completadasGlobal} completadas</span>
          <span>{pendientesGlobal} pendientes</span>
          <span>{rechazadasGlobal} rechazadas</span>
        </div>
      </div>

      {/* Grid: por sección + urgentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Por tipo/sector */}
        <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-[#5D7299] uppercase tracking-wide">Por tipo y sector</p>
          {porTipo.map(({ label, total, pendientes, completadas, vencidas, color, icon: Icon }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-xs font-semibold text-[#0F1B35]">{label}</span>
                  {vencidas > 0 && (
                    <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">{vencidas} urgente{vencidas > 1 ? "s" : ""}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-yellow-700">{pendientes}⏳</span>
                  <span className="text-green-700">{completadas}✅</span>
                  <span className="text-[#5D7299] font-semibold">{total} total</span>
                </div>
              </div>
              <MiniBar
                value={completadas}
                max={total}
                color={completadas / (total || 1) >= 0.7 ? "bg-green-500" : completadas / (total || 1) >= 0.4 ? "bg-yellow-500" : "bg-brand-purple"}
              />
            </div>
          ))}
        </div>

        {/* Recetas más urgentes */}
        <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold text-[#5D7299] uppercase tracking-wide">
            {urgentes.length > 0 ? "Recetas más urgentes" : "Sin recetas urgentes"}
          </p>
          {urgentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-500/40" />
              <p className="text-sm text-[#5D7299]">¡Todo en tiempo!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {urgentes.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0F1B35] truncate">{r.nombrePaciente}</p>
                    <p className="text-[11px] text-brand-purple font-medium truncate">{r.medicamento}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-[#5D7299]">
                        {r.tipo === "controlado" ? "💊" : r.tipo === "maternal" ? "🤰" : r.tipo === "respiratorio" ? "🫁" : "📋"} {r.sector}
                      </span>
                      {r.medicoReceta
                        ? <span className="text-[11px] text-brand-blue">Dr(a). {r.medicoReceta}</span>
                        : <span className="text-[11px] text-[#8FA3C4] italic">Sin asignar</span>
                      }
                      <span className="text-[11px] text-red-600 font-bold">
                        {r.fechaLimite
                          ? `Venció hace ${Math.abs(daysToDeadline(r.fechaLimite))}d`
                          : `${daysSince(r.fechaSolicitud)}d activa`}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#8FA3C4] flex-shrink-0">{formatDate(r.fechaSolicitud)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de médicos */}
      <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-blue" />
          <p className="text-xs font-bold text-[#5D7299] uppercase tracking-wide">Actividad por médico</p>
        </div>

        {porMedico.length === 0 ? (
          <p className="text-sm text-[#5D7299] text-center py-6">No hay médicos registrados con recetas aún.</p>
        ) : (
          <div className="space-y-3">
            {porMedico.map(({ medico, total, pendientes, completadas, rechazadas, vencidas, pct }) => (
              <div key={medico.id} className={`p-4 rounded-2xl border transition-colors ${
                vencidas.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-[#DDE6F5]"
              }`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-sm font-black flex-shrink-0">
                    {(medico.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-[#0F1B35]">Dr(a). {medico.name}</p>
                      {vencidas.length > 0 && (
                        <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                          {vencidas.length} urgente{vencidas.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Stats en fila */}
                    <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                      <span className="flex items-center gap-1 text-yellow-700">
                        <Clock className="w-3 h-3" /> {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> {completadas.length} autorizada{completadas.length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1 text-[#5D7299]">
                        <XCircle className="w-3 h-3" /> {rechazadas.length} rechazada{rechazadas.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[#8FA3C4] ml-auto">{total} total</span>
                    </div>

                    {/* Barra de progreso del médico */}
                    {total > 0 && (
                      <div className="mt-2.5 space-y-1">
                        <div className="h-1.5 bg-[#EEF3FC] rounded-full overflow-hidden flex gap-0.5">
                          <div
                            className="h-full bg-green-500 rounded-l-full transition-all duration-500"
                            style={{ width: `${(completadas.length / total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-[#DDE6F5] transition-all duration-500"
                            style={{ width: `${(pendientes.length / total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-[#EEF3FC] rounded-r-full transition-all duration-500"
                            style={{ width: `${(rechazadas.length / total) * 100}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#8FA3C4]">{pct}% resueltas</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ciclos de Renovación ─────────────────────────────────────────────── */}
      <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-brand-blue" />
          <p className="text-xs font-bold text-[#5D7299] uppercase tracking-wide">Estado de Ciclos de Renovación</p>
        </div>

        {/* 3 KPIs de ciclo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Expiradas */}
          <div className={`rounded-2xl border px-4 py-4 ${expiradas.length > 0 ? "bg-slate-100 border-slate-300" : "bg-[#F8FAFF] border-[#DDE6F5]"}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <Archive className={`w-3.5 h-3.5 ${expiradas.length > 0 ? "text-slate-500" : "text-[#8FA3C4]"}`} />
              <p className="text-[11px] text-[#5D7299] uppercase tracking-wide font-semibold leading-tight">Sin Vigencia</p>
            </div>
            <p className={`text-3xl font-black ${expiradas.length > 0 ? "text-slate-600" : "text-[#8FA3C4]"}`}>{expiradas.length}</p>
            <p className="text-[11px] text-[#8FA3C4] mt-1">ciclos completados o entrega única expirada</p>
            {/* Desglose por tipo */}
            {expiradasPorTipo.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {expiradasPorTipo.map((t) => (
                  <span key={t.label} className={`text-[10px] font-bold ${t.bg} ${t.color} border ${t.border} rounded-full px-2 py-0.5`}>
                    {t.label}: {t.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* En renovación activa */}
          <div className={`rounded-2xl border px-4 py-4 ${conRenovacionVigente.length > 0 ? "bg-green-50 border-green-200" : "bg-[#F8FAFF] border-[#DDE6F5]"}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <RefreshCw className={`w-3.5 h-3.5 ${conRenovacionVigente.length > 0 ? "text-green-600" : "text-[#8FA3C4]"}`} />
              <p className="text-[11px] text-[#5D7299] uppercase tracking-wide font-semibold leading-tight">En Renovación Activa</p>
            </div>
            <p className={`text-3xl font-black ${conRenovacionVigente.length > 0 ? "text-green-700" : "text-[#8FA3C4]"}`}>{conRenovacionVigente.length}</p>
            <p className="text-[11px] text-[#8FA3C4] mt-1">recetas completando ciclo mes a mes</p>
          </div>

          {/* Entrega única vigente */}
          <div className={`rounded-2xl border px-4 py-4 ${entregaUnicaVigente.length > 0 ? "bg-blue-50 border-blue-200" : "bg-[#F8FAFF] border-[#DDE6F5]"}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className={`w-3.5 h-3.5 ${entregaUnicaVigente.length > 0 ? "text-brand-blue" : "text-[#8FA3C4]"}`} />
              <p className="text-[11px] text-[#5D7299] uppercase tracking-wide font-semibold leading-tight">Entrega Única Vigente</p>
            </div>
            <p className={`text-3xl font-black ${entregaUnicaVigente.length > 0 ? "text-brand-blue" : "text-[#8FA3C4]"}`}>{entregaUnicaVigente.length}</p>
            <p className="text-[11px] text-[#8FA3C4] mt-1">sin renovación, despachadas hace menos de 30 días</p>
          </div>
        </div>

        {/* Detalle: recetas en renovación activa con barra de progreso */}
        {renovacionDetalle.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#5D7299] uppercase tracking-widest">Progreso por receta en renovación</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {renovacionDetalle.map(({ r, mesActual, maxRenovacion, pct }) => (
                <div key={r.id} className="bg-white border border-[#DDE6F5] rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F1B35] truncate">{r.nombrePaciente}</p>
                      <p className="text-[11px] text-[#5D7299]">
                        {r.tipo === "controlado" ? "💊" : r.tipo === "maternal" ? "🤰" : r.tipo === "respiratorio" ? "🫁" : "📋"}
                        {" "}{r.medicoReceta ? `Dr(a). ${r.medicoReceta}` : "Sin médico"}
                        {" · "}Sector {r.sector}
                      </p>
                    </div>
                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
                      pct >= 80 ? "bg-orange-50 text-orange-600 border border-orange-200"
                      : pct >= 50 ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                    }`}>
                      Mes {mesActual}/{maxRenovacion}
                    </span>
                  </div>
                  {/* Barra de progreso del ciclo */}
                  <div className="space-y-0.5">
                    <div className="h-2 bg-[#EEF3FC] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 80 ? "bg-orange-400"
                          : pct >= 50 ? "bg-yellow-400"
                          : "bg-green-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8FA3C4]">
                      <span>Inicio</span>
                      <span className="font-semibold">{pct}% del ciclo</span>
                      <span>{maxRenovacion} meses total</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vacío: sin datos de renovación */}
        {recetasCompletadas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <RefreshCw className="w-8 h-8 text-[#DDE6F5]" />
            <p className="text-sm text-[#8FA3C4]">Aún no hay recetas completadas para analizar ciclos.</p>
          </div>
        )}
      </div>

      {/* Top Medicamentos */}
      <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-brand-purple" />
          <p className="text-xs font-bold text-[#5D7299] uppercase tracking-wide">Top Medicamentos Entregados</p>
        </div>

        {topMedicamentos.length === 0 ? (
          <p className="text-sm text-[#5D7299] text-center py-6">No hay datos de medicamentos entregados aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDE6F5] text-[11px] uppercase tracking-wide text-[#5D7299]">
                  <th className="pb-3 px-2 font-bold">Medicamento</th>
                  <th className="pb-3 px-2 font-bold text-center">Unidades Total</th>
                  <th className="pb-3 px-2 font-bold text-center">Cant. Recetas</th>
                  <th className="pb-3 px-2 font-bold text-right">Médico Principal</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {topMedicamentos.map((med, idx) => (
                  <tr key={med.nombre} className="border-b border-[#EEF3FC] last:border-0 hover:bg-white transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#8FA3C4] font-bold text-xs w-4">{idx + 1}.</span>
                        <span className="font-semibold text-brand-indigo">{med.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center font-black text-[#0F1B35]">{med.totalUnidades}</td>
                    <td className="py-3 px-2 text-center text-[#5D7299] font-medium">{med.countRecetas}</td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-brand-blue text-xs">Dr(a). {med.medicoFrecuente}</span>
                        <span className="text-[11px] text-[#8FA3C4]">{med.medicoRecetas} recetas</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
