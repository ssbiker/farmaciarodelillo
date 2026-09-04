import { X, Printer } from "lucide-react";
import type { Receta } from "../types";

export function TicketModal({ receta, onClose }: { receta: Receta; onClose: () => void }) {
  const formatDate = (ts: any) => {
    if (!ts) return "—";
    return ts.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1A2E] border border-white/10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - solo visible en pantalla */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 print:hidden">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Printer className="w-5 h-5 text-brand-purple" />
            Ticket de Receta
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Content */}
        <div id="ticket-content" className="p-8 space-y-6">
          
          {/* Header del Ticket */}
          <div className="text-center border-b border-dashed border-white/20 pb-6">
            <p className="text-xs text-white/50 mb-1 uppercase tracking-widest">CESFAM Rodelillo</p>
            <h3 className="text-2xl font-black">
              Receta {receta.tipo === "controlado" ? "Controlada" : "Crónica"}
            </h3>
            <div className={`inline-flex items-center gap-2 mt-2 px-4 py-1 rounded-full text-sm font-semibold border ${
              receta.tipo === "controlado" 
                ? "bg-red-500/20 text-red-300 border-red-500/30" 
                : "bg-blue-500/20 text-blue-300 border-blue-500/30"
            }`}>
              Sector {receta.sector}
            </div>
          </div>

          {/* Datos del Paciente */}
          <div className="bg-black/20 border border-white/10 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest">Datos del Paciente</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1">Nombre Completo</p>
                <p className="font-bold text-lg leading-tight">{receta.nombrePaciente}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">RUT</p>
                <p className="font-mono font-bold text-lg">{receta.rut}</p>
              </div>
            </div>
          </div>

          {/* Datos de la Receta */}
          <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-brand-purple/80 uppercase tracking-widest">Datos de la Receta</h4>
            <div>
              <p className="text-xs text-white/50 mb-1">Medicamento</p>
              <p className="font-bold text-xl text-brand-purple">{receta.medicamento}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1">Médico Tratante</p>
                <p className="font-semibold">{receta.medicoReceta || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Fecha de Receta</p>
                <p className="font-semibold">{formatDate(receta.fechaReceta)}</p>
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/50 mb-1">Fecha de Solicitud</p>
              <p className="font-semibold text-sm">{formatDate(receta.fechaSolicitud)}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/50 mb-1">Estado Final</p>
              <p className="font-semibold text-sm text-green-400 capitalize">{receta.estado}</p>
            </div>
          </div>

          {/* Nota */}
          {receta.nota && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/50 mb-1">Nota</p>
              <p className="text-sm text-white/80">{receta.nota}</p>
            </div>
          )}

          {/* Firma Area */}
          <div className="pt-4 border-t border-dashed border-white/10 flex justify-between items-end">
            <div className="text-center">
              <div className="w-40 border-b border-white/30 mb-2"></div>
              <p className="text-xs text-white/40">Firma Médico</p>
            </div>
            <p className="text-xs text-white/30">
              {new Date().toLocaleDateString("es-CL")}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-5 border-t border-white/10 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-medium text-white/70 hover:bg-white/10 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-brand-purple hover:bg-brand-purple-dark text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
