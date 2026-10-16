import { CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import type { RecetaPublica } from "../lib/recetasPublicas";
import { labelTipo, emojiTipo, getInfoRenovacion } from "../lib/recetasPublicas";

interface Props { receta: RecetaPublica; }

export function RecetaCard({ receta }: Props) {
  const renovacion = getInfoRenovacion(receta);

  const fecha = receta.fechaSolicitud?.toDate?.();
  const fechaStr = fecha
    ? fecha.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  const fechaProximoMes = (() => {
    if (!renovacion.esRenovable || renovacion.completado || !fecha) return null;
    const next = new Date(fecha);
    next.setMonth(next.getMonth() + renovacion.mesActual);
    return next.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  })();

  const config = {
    completado: {
      icon:        <CheckCircle2 className="w-5 h-5" />,
      iconColor:   "text-emerald-600",
      iconBg:      "bg-emerald-50",
      cardClass:   "green",
      titulo:      "Receta lista para retiro",
      tituloColor: "text-emerald-700",
      badgeBg:     "bg-emerald-50",
      badgeBorder: "border-emerald-200",
      badgeText:   "text-emerald-700",
      badgeLabel:  "Completada",
      mensaje:     "Puedes retirar tu medicamento en la farmacia del CESFAM Rodelillo.",
    },
    pendiente: {
      icon:        <Clock className="w-5 h-5" />,
      iconColor:   "text-amber-600",
      iconBg:      "bg-amber-50",
      cardClass:   "amber",
      titulo:      "Receta en proceso",
      tituloColor: "text-amber-700",
      badgeBg:     "bg-amber-50",
      badgeBorder: "border-amber-200",
      badgeText:   "text-amber-700",
      badgeLabel:  "En proceso",
      mensaje:     "Tu receta está siendo revisada. Vuelve a consultar pronto.",
    },
    rechazado: {
      icon:        <AlertTriangle className="w-5 h-5" />,
      iconColor:   "text-orange-600",
      iconBg:      "bg-orange-50",
      cardClass:   "orange",
      titulo:      "Requiere atención",
      tituloColor: "text-orange-700",
      badgeBg:     "bg-orange-50",
      badgeBorder: "border-orange-200",
      badgeText:   "text-orange-700",
      badgeLabel:  "Requiere atención",
      mensaje:     "Comunícate con tu médico tratante o acércate a la farmacia.",
    },
  }[receta.estado] ?? {
    icon:        <Clock className="w-5 h-5" />,
    iconColor:   "text-slate-400",
    iconBg:      "bg-slate-50",
    cardClass:   "",
    titulo:      "Estado desconocido",
    tituloColor: "text-slate-500",
    badgeBg:     "bg-slate-50",
    badgeBorder: "border-slate-200",
    badgeText:   "text-slate-500",
    badgeLabel:  "—",
    mensaje:     "Consulta directamente en la farmacia.",
  };

  const progresoPct = renovacion.esRenovable && renovacion.totalMeses > 0
    ? Math.round((renovacion.mesActual / renovacion.totalMeses) * 100)
    : 0;

  return (
    <div className={`result-card ${config.cardClass} rounded-2xl p-5 space-y-4`}>

      {/* Cabecera */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.iconColor} ${config.iconBg}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{emojiTipo(receta.tipo)}</span>
            <span className={`text-[15px] font-bold ${config.tituloColor} leading-tight`}>
              {config.titulo}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}>
              {config.badgeLabel}
            </span>
            <span className="text-[11px] text-slate-400">
              Receta {labelTipo(receta.tipo)} · Sector {receta.sector}
            </span>
          </div>
        </div>
      </div>

      <div className="glass-divider" />

      {/* Fecha */}
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">
          Solicitada el
        </p>
        <p className="text-[14px] font-semibold text-slate-700">{fechaStr}</p>
      </div>

      {/* Renovación */}
      {renovacion.esRenovable && (
        <>
          <div className="glass-divider" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Receta Renovable
                </p>
              </div>
              {!renovacion.completado
                ? <span className="text-[11px] font-bold text-slate-600">Mes {renovacion.mesActual} / {renovacion.totalMeses}</span>
                : <span className="text-[11px] text-slate-400">Ciclo completo</span>
              }
            </div>

            <div className="reno-bar">
              <div className="reno-fill" style={{ width: `${progresoPct}%` }} />
            </div>

            {!renovacion.completado && fechaProximoMes && (
              <p className="text-[11px] text-slate-400">
                Próximo retiro estimado: {fechaProximoMes}
              </p>
            )}
            {renovacion.completado && (
              <p className="text-[11px] text-slate-400">
                🏁 Ciclo de {renovacion.totalMeses} {renovacion.totalMeses === 1 ? "mes" : "meses"} finalizado
              </p>
            )}
          </div>
        </>
      )}

      <div className="glass-divider" />
      <p className="text-[13px] text-slate-500 leading-relaxed">{config.mensaje}</p>
    </div>
  );
}
