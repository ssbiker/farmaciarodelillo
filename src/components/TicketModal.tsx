import { X, Printer } from "lucide-react";
import type { Receta } from "../types";
import { getItemsDeReceta, formatRut, esAutorizacionParcial, esPackCronicos } from "../lib/recetaHelpers";

export function TicketModal({ receta, onClose }: { receta: Receta; onClose: () => void }) {
  const formatDate = (ts: any) => {
    if (!ts) return "—";
    return ts.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#DDE6F5] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] my-auto">
        
        {/* Header - FIJO en la parte superior */}
        <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-[#DDE6F5] bg-[#F8FAFF] print:hidden">
          <h2 className="text-base font-bold flex items-center gap-2 text-[#0F1B35]">
            <Printer className="w-4 h-4 text-brand-blue" />
            Ticket de Receta
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/20 transition-colors"
              title="Imprimir ticket"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#EFF3FB] rounded-full transition-colors text-[#5D7299] hover:text-[#0F1B35]"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Ticket Content - SCROLLABLE si el contenido excede el alto de la pantalla */}
        <div className="flex-1 overflow-y-auto">
          <div id="ticket-content" className="p-6 space-y-4">
            
            {/* Header del Ticket */}
            <div className="text-center border-b border-dashed border-[#DDE6F5] pb-4">
              <p className="text-[11px] font-bold text-[#5D7299] uppercase tracking-widest">CESFAM Rodelillo</p>
              <h3 className="text-xl font-black text-[#0F1B35] mt-0.5">
                Receta {receta.tipo === "controlado" ? "Controlada" : receta.tipo === "maternal" ? "Maternal" : receta.tipo === "respiratorio" ? "Respiratorio" : "Crónica"}
              </h3>
              <div className={`inline-flex items-center gap-2 mt-2 px-3 py-0.5 rounded-full text-xs font-semibold border ${
                receta.tipo === "controlado" 
                  ? "bg-red-50 text-red-600 border-red-200" 
                  : receta.tipo === "maternal"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : receta.tipo === "respiratorio"
                  ? "bg-teal-50 text-teal-700 border-teal-200"
                  : "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
              }`}>
                Sector {receta.sector}
              </div>
            </div>

            {/* Datos del Paciente */}
            <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-4 space-y-3">
              <h4 className="text-[10px] font-bold text-[#5D7299] uppercase tracking-widest">Datos del Paciente</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-[#5D7299] mb-0.5">Nombre Completo</p>
                  <p className="font-bold text-base leading-tight text-[#0F1B35]">{receta.nombrePaciente}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#5D7299] mb-0.5">RUT</p>
                  <p className="font-mono font-bold text-base text-[#0F1B35]">{formatRut(receta.rut)}</p>
                </div>
              </div>
            </div>

            {/* Datos de la Receta / Medicamentos */}
            <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-2xl p-4 space-y-3">
              <h4 className="text-[10px] font-bold text-brand-purple/80 uppercase tracking-widest">Medicamentos</h4>
              <div className="space-y-2">
                {getItemsDeReceta(receta).map((it, idx) => {
                  const isRechazado = it.estadoItem === "rechazado";
                  const isPack = esPackCronicos(it);
                  return (
                    <div 
                      key={idx} 
                      className={`flex justify-between items-center p-2.5 rounded-xl border ${
                        isRechazado 
                          ? "bg-red-50/70 border-red-200" 
                          : isPack
                          ? "bg-emerald-50/80 border-emerald-300 shadow-sm"
                          : "bg-white/80 border-brand-purple/20"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <span className={`font-bold text-sm block ${isRechazado ? "text-red-700 line-through" : isPack ? "text-emerald-950 font-black" : "text-[#0F1B35]"}`}>
                          {isPack ? "📦 Pack Crónicos (Tratamiento AVIS)" : it.medicamento === "SOLICITUD_RECETA" ? "Solicitud sin med. asignado" : it.medicamento}
                        </span>
                        {isPack ? (
                          <span className="text-[11px] font-semibold text-emerald-800 block mt-0.5">
                            Despacho multifármaco según indicación activa en Ficha Clínica AVIS
                          </span>
                        ) : isRechazado ? (
                          <span className="text-[11px] font-semibold text-red-600 block mt-0.5">
                            ❌ NO DESPACHAR — Rechazado: {it.motivoRechazoItem || "No pertinente"}
                          </span>
                        ) : null}
                      </div>
                      {isRechazado ? (
                        <span className="font-extrabold text-[10px] text-red-700 bg-red-100 px-2 py-0.5 rounded-lg border border-red-300 flex-shrink-0">
                          Rechazado
                        </span>
                      ) : isPack ? (
                        <span className="font-extrabold text-xs text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300 flex-shrink-0">
                          Pack AVIS
                        </span>
                      ) : it.cantidad > 0 ? (
                        <span className="font-extrabold text-xs text-brand-blue bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 flex-shrink-0">
                          Cant: {it.cantidad}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-[11px] text-[#5D7299] mb-0.5">Médico Tratante</p>
                  <p className="font-semibold text-sm text-[#0F1B35]">{receta.medicoReceta || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#5D7299] mb-0.5">Fecha de Receta</p>
                  <p className="font-semibold text-sm text-[#0F1B35]">{formatDate(receta.fechaReceta)}</p>
                </div>
              </div>
            </div>

            {/* Fechas y Estado */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[#F8FAFF] rounded-xl p-3 border border-[#DDE6F5]">
                <p className="text-[11px] text-[#5D7299] mb-0.5">Fecha de Solicitud</p>
                <p className="font-semibold text-xs text-[#0F1B35]">{formatDate(receta.fechaSolicitud)}</p>
              </div>
              <div className="bg-[#F8FAFF] rounded-xl p-3 border border-[#DDE6F5]">
                <p className="text-[11px] text-[#5D7299] mb-0.5">Estado Final</p>
                <p className={`font-semibold text-xs capitalize ${esAutorizacionParcial(receta) ? "text-amber-700 font-bold" : "text-green-700"}`}>
                  {esAutorizacionParcial(receta) ? "Autorizada (Parcial)" : receta.estado}
                </p>
              </div>
            </div>

            {/* Nota */}
            {receta.nota && (
              <div className="bg-[#F8FAFF] rounded-xl p-3 border border-[#DDE6F5]">
                <p className="text-[11px] text-[#5D7299] mb-0.5">Nota</p>
                <p className="text-xs text-[#3D5278]">{receta.nota}</p>
              </div>
            )}

            {/* Firma Area */}
            <div className="pt-3 border-t border-dashed border-[#DDE6F5] flex justify-between items-end">
              <div className="text-center">
                <div className="w-36 border-b border-[#C4D4EE] mb-1.5"></div>
                <p className="text-[11px] text-[#5D7299]">Firma Médico</p>
              </div>
              <p className="text-[11px] text-[#8FA3C4]">
                {new Date().toLocaleDateString("es-CL")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions - FIJO SIEMPRE VISIBLE */}
        <div className="flex-shrink-0 flex gap-3 px-6 py-4 border-t border-[#DDE6F5] bg-[#F8FAFF] print:hidden rounded-b-3xl">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-[#3D5278] hover:bg-[#EFF3FB] border border-[#DDE6F5] transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-brand-blue hover:bg-brand-blue-dark text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-blue transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" />
            Imprimir Receta
          </button>
        </div>

      </div>
    </div>
  );
}
