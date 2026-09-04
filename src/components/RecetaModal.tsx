import { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from "firebase/firestore";
import { registrarAccion, detectarCambios } from "../lib/auditoria";
import type { Receta, FarmaciaUser } from "../types";

export function RecetaModal({
  isOpen,
  onClose,
  receta,
  medicos,
  tipo,
  sector,
  farmaciaUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  receta: Receta | null;
  medicos: FarmaciaUser[];
  tipo: "controladas" | "cronicas";
  sector: "A" | "B";
  farmaciaUser: FarmaciaUser;
}) {
  const [form, setForm] = useState({
    nombrePaciente: "",
    rut: "",
    medicamento: "",
    nota: "",
    estado: "pendiente" as "pendiente" | "completado" | "rechazado",
    medicoReceta: "",
    medicoUid: "",
    fechaLimite: "",   // string YYYY-MM-DD para el input date
  });
  const [loading, setLoading] = useState(false);

  // Convierte Timestamp a string YYYY-MM-DD para el input
  const tsToDateStr = (ts: any): string => {
    if (!ts) return "";
    try { return ts.toDate().toISOString().split("T")[0]; } catch { return ""; }
  };

  useEffect(() => {
    if (receta) {
      setForm({
        nombrePaciente: receta.nombrePaciente,
        rut: receta.rut,
        medicamento: receta.medicamento,
        nota: receta.nota,
        estado: receta.estado,
        medicoReceta: receta.medicoReceta || "",
        medicoUid: receta.medicoUid || "",
        fechaLimite: tsToDateStr(receta.fechaLimite),
      });
    } else {
      setForm({ nombrePaciente: "", rut: "", medicamento: "", nota: "", estado: "pendiente", medicoReceta: "", medicoUid: "", fechaLimite: "" });
    }
  }, [receta, isOpen]);

  if (!isOpen) return null;

  const collectionName = tipo === "controladas" ? "recetas_controladas" : "recetas_cronicas";

  const formatRut = (raw: string) => {
    const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length <= 1) return clean;
    const dv = clean.slice(-1);
    const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${body}-${dv}`;
  };

  const handleMedicoChange = (uid: string) => {
    const medico = medicos.find((m) => m.id === uid);
    setForm({ ...form, medicoUid: uid, medicoReceta: medico ? medico.name : "" });
  };

  // Convierte string YYYY-MM-DD a Timestamp (a las 23:59 hora local)
  const dateStrToTs = (str: string): import("firebase/firestore").Timestamp | null => {
    if (!str) return null;
    const d = new Date(str + "T23:59:00");
    return Timestamp.fromDate(d);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const now = Timestamp.now();
      const payload: Partial<Receta> = {
        nombrePaciente: form.nombrePaciente,
        rut: form.rut,
        medicamento: form.medicamento,
        nota: form.nota,
        estado: form.estado,
        medicoReceta: form.medicoReceta,
        medicoUid: form.medicoUid,
        actualizadoEn: now,
        fechaReceta: form.estado === "completado" ? (receta?.fechaReceta ?? now) : null,
        fechaLimite: dateStrToTs(form.fechaLimite),
      };

      if (receta) {
        const snapAntes = await getDoc(doc(db, collectionName, receta.id));
        const dataAntes = snapAntes.data() as Record<string, unknown>;
        await updateDoc(doc(db, collectionName, receta.id), payload);
        const cambios = detectarCambios(
          dataAntes,
          payload as Record<string, unknown>,
          ["nombrePaciente", "rut", "medicamento", "nota", "estado", "medicoReceta", "fechaLimite"]
        );
        await registrarAccion(collectionName, receta.id, "MODIFICACION", farmaciaUser, cambios);
      } else {
        const docRef = await addDoc(collection(db, collectionName), {
          ...payload,
          sector,
          tipo: tipo === "controladas" ? "controlado" : "cronico",
          fechaSolicitud: now,
          creadoPor: farmaciaUser.id,
          creadoEn: now,
          eliminada: false,
        } as Omit<Receta, "id">);
        await registrarAccion(collectionName, docRef.id, "CREACION", farmaciaUser);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-brand-purple outline-none transition-colors text-sm";
  const labelClass = "block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#12122A] border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
          <div>
            <h2 className="text-xl font-black">{receta ? "Editar Solicitud" : "Nueva Solicitud"}</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {tipo === "controladas" ? "💊 Controlada" : "📋 Crónica"} — Sector {sector}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre del Paciente</label>
              <input required type="text" placeholder="Juan Pérez González" value={form.nombrePaciente}
                onChange={(e) => setForm({ ...form, nombrePaciente: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>RUT</label>
              <input required type="text" placeholder="12.345.678-9" value={form.rut} maxLength={12}
                onChange={(e) => setForm({ ...form, rut: formatRut(e.target.value) })} className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Medicamento Solicitado</label>
            <input required type="text" placeholder="Ej: Clonazepam 2mg" value={form.medicamento}
              onChange={(e) => setForm({ ...form, medicamento: e.target.value })}
              className={`${inputClass} text-brand-purple font-semibold placeholder-brand-purple/30 focus:border-brand-purple border-brand-purple/20`} />
          </div>
          <div>
            <label className={labelClass}>Nota Adicional (Opcional)</label>
            <textarea rows={3} placeholder="Detalles o instrucciones especiales..." value={form.nota}
              onChange={(e) => setForm({ ...form, nota: e.target.value })} className={`${inputClass} resize-none`} />
          </div>

          {/* ── Fecha límite ── */}
          <div className="bg-orange-500/[0.06] border border-orange-500/20 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Fecha Límite de Atención</p>
              {form.fechaLimite && (
                <button type="button" onClick={() => setForm({ ...form, fechaLimite: "" })}
                  className="text-[10px] text-white/30 hover:text-red-400 transition-colors">
                  ✕ quitar
                </button>
              )}
            </div>
            <p className="text-xs text-white/40">
              Fecha máxima en que esta receta debe ser atendida. Controla cuándo saltan las alertas amarilla y roja.
            </p>
            <input
              type="date"
              value={form.fechaLimite}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
              className={`${inputClass} ${form.fechaLimite ? "text-orange-300 border-orange-500/30 focus:border-orange-400" : "text-white/40"}`}
            />
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-brand-purple uppercase tracking-widest">Estado de la Solicitud</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Estado</label>
                <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as any })}
                  className={`${inputClass} appearance-none`}>
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="completado">✅ Recetado / Completado</option>
                  <option value="rechazado">❌ Rechazado</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Médico Asignado / Tratante
                  {medicos.length === 0 && (
                    <span className="ml-1 text-yellow-400" title="No hay médicos con rol 'medico' en el sistema">
                      <AlertCircle className="inline w-3 h-3" />
                    </span>
                  )}
                </label>
                <select required={form.estado === "completado"} value={form.medicoUid}
                  onChange={(e) => handleMedicoChange(e.target.value)}
                  className={`${inputClass} appearance-none ${form.estado === "completado" ? "text-green-400 border-green-500/20 focus:border-green-500" : ""}`}>
                  <option value="">{form.estado === "pendiente" ? "Sin asignar (Opcional)" : "Seleccione un médico..."}</option>
                  {medicos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {medicos.length === 0 && (
                  <p className="text-xs text-yellow-400/70 mt-1">
                    Ve a Administración y asigna <code className="bg-white/10 px-1 rounded">role: "medico"</code> a los médicos del CESFAM.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-brand-purple hover:bg-brand-purple-dark text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
              <Save className="w-4 h-4" />
              {loading ? "Guardando..." : "Guardar Registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
