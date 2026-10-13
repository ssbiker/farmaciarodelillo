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
      <div className="bg-white border border-[#DDE6F5] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - solo visible en pantalla */}
        <div className="flex justify-between items-center p-5 border-b border-[#DDE6F5] print:hidden">
          <h2 className="text-lg font-bold flex items-center gap-2 text-[#0F1B35]">
            <Printer className="w-5 h-5 text-brand-blue" />
            Ticket de Receta
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[#EFF3FB] rounded-full transition-colors text-[#5D7299] hover:text-[#0F1B35]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Content */}
        <div id="ticket-content" className="p-8 space-y-6">
          
          {/* Header del Ticket */}
          <div className="text-center border-b border-dashed border-[#DDE6F5] pb-6">
            <p className="text-xs text-[#5D7299] mb-1 uppercase tracking-widest">CESFAM Rodelillo</p>
            <h3 className="text-2xl font-black text-[#0F1B35]">
              Receta {receta.tipo === "controlado" ? "Controlada" : "Crónica"}
            </h3>
            <div className={`inline-flex items-center gap-2 mt-2 px-4 py-1 rounded-full text-sm font-semibold border ${
              receta.tipo === "controlado" 
                ? "bg-red-50 text-red-600 border-red-200" 
                : "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
            }`}>
              Sector {receta.sector}
            </div>
          </div>

          {/* Datos del Paciente */}
          <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-[#5D7299] uppercase tracking-widest">Datos del Paciente</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#5D7299] mb-1">Nombre Completo</p>
                <p className="font-bold text-lg leading-tight text-[#0F1B35]">{receta.nombrePaciente}</p>
              </div>
              <div>
                <p className="text-xs text-[#5D7299] mb-1">RUT</p>
                <p className="font-mono font-bold text-lg text-[#0F1B35]">{receta.rut}</p>
              </div>
            </div>
          </div>

          {/* Datos de la Receta */}
          <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-brand-purple/80 uppercase tracking-widest">Datos de la Receta</h4>
            <div>
              <p className="text-xs text-[#5D7299] mb-1">Medicamento</p>
              <p className="font-bold text-xl text-brand-purple">{receta.medicamento}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#5D7299] mb-1">Médico Tratante</p>
                <p className="font-semibold text-[#0F1B35]">{receta.medicoReceta || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[#5D7299] mb-1">Fecha de Receta</p>
                <p className="font-semibold text-[#0F1B35]">{formatDate(receta.fechaReceta)}</p>
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[#DDE6F5]">
              <p className="text-xs text-[#5D7299] mb-1">Fecha de Solicitud</p>
              <p className="font-semibold text-sm text-[#0F1B35]">{formatDate(receta.fechaSolicitud)}</p>
            </div>
            <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[#DDE6F5]">
              <p className="text-xs text-[#5D7299] mb-1">Estado Final</p>
              <p className="font-semibold text-sm text-green-700 capitalize">{receta.estado}</p>
            </div>
          </div>

          {/* Nota */}
          {receta.nota && (
            <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[#DDE6F5]">
              <p className="text-xs text-[#5D7299] mb-1">Nota</p>
              <p className="text-sm text-[#3D5278]">{receta.nota}</p>
            </div>
          )}

          {/* Firma Area */}
          <div className="pt-4 border-t border-dashed border-[#DDE6F5] flex justify-between items-end">
            <div className="text-center">
              <div className="w-40 border-b border-[#C4D4EE] mb-2"></div>
              <p className="text-xs text-[#5D7299]">Firma Médico</p>
            </div>
            <p className="text-xs text-[#8FA3C4]">
              {new Date().toLocaleDateString("es-CL")}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-5 border-t border-[#DDE6F5] print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-medium text-[#3D5278] hover:bg-[#EFF3FB] transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-brand-blue hover:bg-brand-blue-dark text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
