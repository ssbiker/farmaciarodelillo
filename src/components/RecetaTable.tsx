import { useState } from "react";
import type { Receta, FarmaciaConfig, FarmaciaUser } from "../types";
import { CheckCircle2, XCircle, Clock, Trash2, Edit, Printer, Plus } from "lucide-react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RecetaModal } from "./RecetaModal";
import { TicketModal } from "./TicketModal";

export function RecetaTable({ 
  recetas, 
  config, 
  isAdmin, 
  farmaciaUser,
  medicos,
  activeTab 
}: { 
  recetas: Receta[], 
  config: FarmaciaConfig, 
  isAdmin: boolean,
  farmaciaUser: FarmaciaUser,
  medicos: FarmaciaUser[],
  activeTab: string 
}) {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceta, setEditingReceta] = useState<Receta | null>(null);
  
  const [ticketReceta, setTicketReceta] = useState<Receta | null>(null);

  const getAlertColor = (receta: Receta) => {
    if (receta.estado === "completado") return "bg-green-50 text-green-700 border-green-200";
    if (receta.estado === "rechazado") return "bg-slate-100 text-slate-500 border-slate-200";
    
    const now = new Date();
    const days = Math.floor((now.getTime() - receta.fechaSolicitud.toDate().getTime()) / (1000 * 3600 * 24));
    
    if (days >= config.diasAlertaRoja) return "bg-red-50 text-red-600 border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.1)]";
    if (days >= config.diasAlertaAmarilla) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-[#F8FAFF] text-[#0F1B35] border-[#DDE6F5]";
  };

  const getDaysPassed = (receta: Receta) => {
    const now = new Date();
    const end = receta.estado === "pendiente" ? now : receta.actualizadoEn.toDate();
    const days = Math.floor((end.getTime() - receta.fechaSolicitud.toDate().getTime()) / (1000 * 3600 * 24));
    return days;
  };

  const handleDelete = async (receta: Receta) => {
    if (!isAdmin && farmaciaUser.email !== "ssanchez@cmvalparaiso.cl") return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la receta de ${receta.nombrePaciente}?`)) return;
    
    const collectionName = activeTab.includes("controladas") ? "recetas_controladas" : "recetas_cronicas";
    await deleteDoc(doc(db, collectionName, receta.id));
  };

  const openCreateModal = () => {
    setEditingReceta(null);
    setIsModalOpen(true);
  };

  const filteredRecetas = recetas.filter(r => {
    const matchesSearch = r.nombrePaciente.toLowerCase().includes(search.toLowerCase()) || r.rut.includes(search);
    const matchesEstado = filterEstado === "all" || r.estado === filterEstado;
    return matchesSearch && matchesEstado;
  });

  const [tipo, sector] = activeTab.split("_"); // e.g. "controladas", "A"

  return (
    <div className="space-y-6">
      
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-4 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar por paciente o RUT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border border-[#DDE6F5] rounded-xl px-4 py-2.5 text-sm text-[#0F1B35] placeholder-[#8FA3C4] w-full md:w-64 focus:border-brand-blue outline-none transition-colors"
          />
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="bg-white border border-[#DDE6F5] rounded-xl px-4 py-2.5 text-sm text-[#0F1B35] focus:border-brand-blue outline-none transition-colors appearance-none"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="completado">Completados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </div>
        
        <button
          onClick={openCreateModal}
          className="bg-brand-blue hover:bg-brand-blue-dark text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 w-full md:w-auto justify-center shadow-lg hover:shadow-brand-blue/20"
        >
          <Plus className="w-5 h-5" />
          Nueva Solicitud
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#DDE6F5] bg-white">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#F0F4FF] border-b border-[#DDE6F5] text-[#5D7299]">
            <tr>
              <th className="px-6 py-4 font-medium">Estado</th>
              <th className="px-6 py-4 font-medium">Paciente</th>
              <th className="px-6 py-4 font-medium">RUT</th>
              <th className="px-6 py-4 font-medium">Medicamento</th>
              <th className="px-6 py-4 font-medium">Tiempo</th>
              <th className="px-6 py-4 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3FC]">
            {filteredRecetas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[#5D7299]">
                  No hay recetas que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              filteredRecetas.map((receta) => (
                <tr key={receta.id} className="hover:bg-[#F5F8FF] transition-colors group">
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getAlertColor(receta)}`}>
                      {receta.estado === 'pendiente' && <Clock className="w-3.5 h-3.5" />}
                      {receta.estado === 'completado' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {receta.estado === 'rechazado' && <XCircle className="w-3.5 h-3.5" />}
                      <span className="capitalize">{receta.estado}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-[#0F1B35]">{receta.nombrePaciente}</td>
                  <td className="px-6 py-4 text-[#3D5278] font-mono text-xs whitespace-nowrap">{receta.rut}</td>
                  <td className="px-6 py-4 text-brand-purple font-medium">{receta.medicamento}</td>
                  <td className="px-6 py-4 text-[#5D7299]">
                    {getDaysPassed(receta)} días
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      
                      {receta.estado === "completado" && (
                        <button 
                          onClick={() => setTicketReceta(receta)}
                          className="p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                          title="Ver Ticket"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button 
                        onClick={() => { setEditingReceta(receta); setIsModalOpen(true); }}
                        className="p-1.5 text-[#5D7299] hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                        title="Ver / Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      {(isAdmin || farmaciaUser.email === "ssanchez@cmvalparaiso.cl") && (
                        <button 
                          onClick={() => handleDelete(receta)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <RecetaModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          receta={editingReceta}
          medicos={medicos}
          tipo={tipo as "controladas" | "cronicas"}
          sector={sector as "A" | "B"}
          farmaciaUser={farmaciaUser}
        />
      )}

      {ticketReceta && (
        <TicketModal 
          receta={ticketReceta}
          onClose={() => setTicketReceta(null)}
        />
      )}

    </div>
  );
}
