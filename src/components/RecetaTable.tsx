import { useState } from "react";
import type { Receta, FarmaciaConfig, FarmaciaUser } from "../types";
import { CheckCircle2, XCircle, Clock, Trash2, Edit, Printer, Plus, ChevronDown, ChevronRight, History } from "lucide-react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RecetaModal } from "./RecetaModal";
import { TicketModal } from "./TicketModal";
import { AuditoriaDrawer } from "./AuditoriaDrawer";
import { getItemsDeReceta, getEstadoItemRenovacion } from "../lib/recetaHelpers";

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
  const [auditoriaReceta, setAuditoriaReceta] = useState<Receta | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => setExpandedRows(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
    
    const collectionName = activeTab.includes("controladas")
      ? "recetas_controladas"
      : activeTab.startsWith("maternales")
      ? "recetas_maternales"
      : activeTab.startsWith("respiratorias")
      ? "recetas_respiratorias"
      : "recetas_cronicas";
    await deleteDoc(doc(db, collectionName, receta.id));
  };

  const openCreateModal = () => {
    setEditingReceta(null);
    setIsModalOpen(true);
  };

  const filteredRecetas = recetas.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.nombrePaciente.toLowerCase().includes(q) ||
      r.rut.includes(search) ||
      getItemsDeReceta(r).some(it => it.medicamento.toLowerCase().includes(q) && it.medicamento !== "SOLICITUD_RECETA");
    const matchesEstado = filterEstado === "all" || r.estado === filterEstado;
    return matchesSearch && matchesEstado;
  });

  const tipo = activeTab.startsWith("controladas")
    ? "controladas"
    : activeTab.startsWith("maternales")
    ? "maternales"
    : activeTab.startsWith("respiratorias")
    ? "respiratorias"
    : "cronicas";
  const sector = activeTab.includes("CECOSF") ? "CECOSF" : activeTab.split("_")[1];

  return (
    <div className="space-y-6">
      
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-4 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar por paciente, RUT o medicamento..."
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
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F0F4FF] border-b border-[#DDE6F5] text-[#5D7299]">
            <tr>
              <th className="px-6 py-4 font-medium whitespace-nowrap">Estado</th>
              <th className="px-6 py-4 font-medium whitespace-nowrap">Paciente</th>
              <th className="px-6 py-4 font-medium whitespace-nowrap">RUT</th>
              <th className="px-6 py-4 font-medium">Medicamento(s)</th>
              <th className="px-6 py-4 font-medium whitespace-nowrap">Tiempo</th>
              <th className="px-6 py-4 font-medium text-right whitespace-nowrap">Acciones</th>
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
              filteredRecetas.map((receta) => {
                const items = getItemsDeReceta(receta);
                const isMulti = items.length > 1;
                const firstItem = items[0] || { medicamento: receta.medicamento, cantidad: receta.cantidad, autoRenovacion: 0, mesesDescontados: 0 };
                const isExpanded = expandedRows.has(receta.id);

                return (
                  <tr key={receta.id} className="hover:bg-[#F5F8FF] transition-colors group align-top">
                    {/* Estado */}
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${getAlertColor(receta)}`}>
                        {receta.estado === 'pendiente' && <Clock className="w-3.5 h-3.5" />}
                        {receta.estado === 'completado' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {receta.estado === 'rechazado' && <XCircle className="w-3.5 h-3.5" />}
                        <span className="capitalize">{receta.estado}</span>
                      </div>
                    </td>

                    {/* Paciente */}
                    <td className="px-6 py-4 font-medium text-[#0F1B35] whitespace-nowrap">{receta.nombrePaciente}</td>

                    {/* RUT */}
                    <td className="px-6 py-4 text-[#3D5278] font-mono text-xs whitespace-nowrap">{receta.rut}</td>

                    {/* Medicamentos — columna expandible */}
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex flex-col gap-1 items-start">
                        {/* Primer medicamento + badge renovación */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {firstItem.medicamento === "SOLICITUD_RECETA" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                              📋 Pendiente médico
                            </span>
                          ) : (
                            <span className="font-semibold text-brand-indigo text-sm">
                              {firstItem.medicamento}
                            </span>
                          )}
                          {(firstItem.cantidad ?? 0) > 0 && (
                            <span className="text-[11px] font-bold text-[#5D7299] bg-[#F0F4FF] px-1.5 py-0.5 rounded border border-[#DDE6F5]">
                              ×{firstItem.cantidad}
                            </span>
                          )}
                          {/* Badge de renovación del primer item */}
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
                            💊 {isExpanded ? "Ocultar" : `+${items.length - 1} medicamento${items.length > 2 ? "s" : ""} más`}
                          </button>
                        )}

                        {/* Panel expandido */}
                        {isMulti && isExpanded && (
                          <div className="mt-2 w-full space-y-1.5 bg-[#F8FAFF] border border-[#DDE6F5] rounded-xl p-3 shadow-sm">
                            <p className="text-[10px] font-bold text-[#5D7299] uppercase tracking-widest mb-2">Todos los medicamentos</p>
                            {items.map((it, idx) => {
                              const est = receta.estado === "completado" && it.medicamento !== "SOLICITUD_RECETA"
                                ? getEstadoItemRenovacion(it, receta.fechaSolicitud)
                                : null;
                              return (
                                <div key={idx} className="flex items-start gap-2 bg-white rounded-lg border border-[#DDE6F5] px-3 py-2">
                                  <span className="text-[11px] font-bold text-[#5D7299] min-w-[18px] mt-0.5">{idx + 1}.</span>
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
                    </td>

                    {/* Tiempo */}
                    <td className="px-6 py-4 text-[#5D7299] whitespace-nowrap">
                      {getDaysPassed(receta)} días
                    </td>

                    {/* Acciones */}
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
                        <button
                          onClick={() => setAuditoriaReceta(receta)}
                          className="p-1.5 text-[#5D7299] hover:text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
                          title="Historial de cambios"
                        >
                          <History className="w-4 h-4" />
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
                );
              })
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
          tipo={tipo as "controladas" | "cronicas" | "maternales" | "respiratorias"}
          sector={sector as "A" | "B" | "CECOSF"}
          farmaciaUser={farmaciaUser}
          todasRecetas={recetas}
        />
      )}

      {ticketReceta && (
        <TicketModal 
          receta={ticketReceta}
          onClose={() => setTicketReceta(null)}
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
