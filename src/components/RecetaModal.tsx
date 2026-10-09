import { useState, useEffect, useRef } from "react";
import { X, Save, AlertCircle, CheckCircle2, XCircle, Lock, Clock, Calendar } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from "firebase/firestore";
import { registrarAccion, detectarCambios } from "../lib/auditoria";
import { encryptRecetaFields } from "../lib/crypto";
import type { Receta, FarmaciaUser } from "../types";
import { MEDICAMENTOS_COMUNES } from "../lib/medicamentos";

export function RecetaModal({
  isOpen,
  onClose,
  receta,
  medicos,
  tipo,
  sector,
  farmaciaUser,
  soloAutorizacion = false,
  puedeEditarDatos = true,
  puedeAutorizar = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  receta: Receta | null;
  medicos: FarmaciaUser[];
  tipo: "controladas" | "cronicas";
  sector: "A" | "B" | "CECOSF";
  farmaciaUser: FarmaciaUser;
  /** Si true: el usuario solo puede cambiar el estado (médico sin permisos de edición de datos) */
  soloAutorizacion?: boolean;
  /** Si false: campos de datos del paciente deshabilitados */
  puedeEditarDatos?: boolean;
  /** Si false: el estado queda fijo en "pendiente" — para funcionarios que solo ingresan recetas */
  puedeAutorizar?: boolean;
}) {
  const [form, setForm] = useState({
    nombrePaciente: "",
    rut: "",
    medicamento: "",
    codigoMedicamento: "",
    cantidad: "", // String for input, parsed to number on submit
    nota: "",
    estado: "pendiente" as "pendiente" | "completado" | "rechazado",
    medicoReceta: "",
    medicoUid: "",
    fechaLimite: "",
    autoRenovacion: 0,
    motivoRechazo: "",
  });
  const [loading, setLoading] = useState(false);
  const [inventario, setInventario] = useState<import("../types").MedicamentoInventario[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const tsToDateStr = (ts: any): string => {
    if (!ts) return "";
    try { return ts.toDate().toISOString().split("T")[0]; } catch { return ""; }
  };

  useEffect(() => {
    const unsub = import("firebase/firestore").then(({ onSnapshot, query, collection, orderBy }) => {
      const q = query(collection(db, "inventario"), orderBy("nombre"));
      return onSnapshot(q, (snapshot) => {
        const data: import("../types").MedicamentoInventario[] = [];
        snapshot.forEach(doc => data.push(doc.data() as import("../types").MedicamentoInventario));
        setInventario(data);
      });
    });
    return () => { unsub.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (receta) {
      setForm({
        nombrePaciente: receta.nombrePaciente,
        rut: receta.rut,
        medicamento: receta.medicamento,
        codigoMedicamento: receta.codigoMedicamento || "",
        cantidad: receta.cantidad ? receta.cantidad.toString() : "",
        nota: receta.nota,
        estado: receta.estado,
        medicoReceta: receta.medicoReceta || "",
        medicoUid: receta.medicoUid || "",
        fechaLimite: tsToDateStr(receta.fechaLimite),
        autoRenovacion: receta.autoRenovacion ?? 0,
        motivoRechazo: receta.motivoRechazo || "",
      });
    } else {
      setForm({ nombrePaciente: "", rut: "", medicamento: "", codigoMedicamento: "", cantidad: "", nota: "", estado: "pendiente", medicoReceta: "", medicoUid: "", fechaLimite: "", autoRenovacion: 0, motivoRechazo: "" });
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

  const validarRut = (rut: string) => {
    const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length < 2) return false;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const expectedDv = 11 - (sum % 11);
    const finalDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
    return dv === finalDv;
  };

  const handleMedicoChange = (uid: string) => {
    const medico = medicos.find((m) => m.id === uid);
    setForm({ ...form, medicoUid: uid, medicoReceta: medico ? medico.name : "" });
  };

  const dateStrToTs = (str: string): import("firebase/firestore").Timestamp | null => {
    if (!str) return null;
    const d = new Date(str + "T23:59:00");
    return Timestamp.fromDate(d);
  };

  // Asistente de Cálculo Matemático
  const [showCalc, setShowCalc] = useState(false);
  const [calcDosis, setCalcDosis] = useState("1");
  const [calcHoras, setCalcHoras] = useState("8");
  const [calcDias, setCalcDias] = useState("30");

  const runCalculadora = (d: string, h: string, days: string) => {
    const dosis = parseFloat(d) || 0;
    const horas = parseFloat(h) || 24;
    const dias = parseFloat(days) || 0;
    const tomas = 24 / (horas > 0 ? horas : 24);
    const total = Math.ceil(tomas * dosis * dias);
    setForm(f => ({ ...f, cantidad: total > 0 ? total.toString() : "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soloAutorizacion && !validarRut(form.rut)) {
      alert("El RUT ingresado no es válido. Por favor, corríjalo antes de guardar.");
      return;
    }
    setLoading(true);
    try {
      const now = Timestamp.now();

      if (soloAutorizacion && receta) {
        // ── Modo médico: solo actualiza estado y registra quién autorizó ──────
        const snapAntes = await getDoc(doc(db, collectionName, receta.id));
        const dataAntes = snapAntes.data() as Record<string, unknown>;
        const payload = {
          estado: form.estado,
          medicamento: form.medicamento,
          codigoMedicamento: form.codigoMedicamento,
          cantidad: form.cantidad ? Number(form.cantidad) : 0,
          actualizadoEn: now,
          medicoReceta: form.estado !== "pendiente"
            ? (receta.medicoReceta || farmaciaUser.name)
            : receta.medicoReceta,
          medicoUid: form.estado !== "pendiente"
            ? (receta.medicoUid || farmaciaUser.id)
            : receta.medicoUid,
          fechaReceta: form.estado === "completado" ? (receta.fechaReceta ?? now) : null,
          autoRenovacion: form.estado === "rechazado" ? 0 : (form.autoRenovacion ?? 0),
          motivoRechazo: form.estado === "rechazado" ? (form.motivoRechazo || "") : "",
        };
        const payloadCifrado = encryptRecetaFields(payload as any);
        await updateDoc(doc(db, collectionName, receta.id), payloadCifrado);
        const cambios = detectarCambios(
          dataAntes,
          payloadCifrado as Record<string, unknown>,
          ["estado", "medicoReceta", "autoRenovacion", "motivoRechazo", "medicamento", "cantidad"]
        );
        await registrarAccion(collectionName, receta.id, "MODIFICACION", farmaciaUser, cambios);

        // ── Lógica de stock para médico autorizando ──────────────────────────
        import("firebase/firestore").then(({ increment, updateDoc: uDoc, doc: fDoc }) => {
          const oldCantidad = (dataAntes.cantidad as number) || 0;
          const oldCodigo = (dataAntes.codigoMedicamento as string) || "";
          const newCantidad = payload.cantidad || 0;
          const newCodigo = payload.codigoMedicamento || "";
          const firstPrescription = !dataAntes.mesesDescontados || dataAntes.mesesDescontados === 0;

          if (payload.estado === "rechazado") {
            // Receta RECHAZADA → devolver stock si ya había sido descontado
            if (oldCodigo && oldCantidad > 0 && !firstPrescription) {
              uDoc(fDoc(db, "inventario", oldCodigo), { stock: increment(oldCantidad) }).catch(console.error);
            }
            // Marcar como 0 meses descontados (sin stock comprometido)
            updateDoc(doc(db, collectionName, receta.id), { mesesDescontados: 0 }).catch(console.error);

          } else if (firstPrescription && newCodigo && newCantidad > 0) {
            // PRIMERA VEZ que el médico asigna medicamento → descontar y marcar mes 1
            uDoc(fDoc(db, "inventario", newCodigo), { stock: increment(-newCantidad) }).catch(console.error);
            updateDoc(doc(db, collectionName, receta.id), { mesesDescontados: 1 }).catch(console.error);

          } else if (!firstPrescription) {
            // Ya tenía stock descontado → ajustar diferencia si cambió código o cantidad
            const codigoChanged = oldCodigo !== newCodigo;
            const cantidadChanged = oldCantidad !== newCantidad;

            if (codigoChanged || cantidadChanged) {
              // Devolver el stock del medicamento anterior
              if (oldCodigo && oldCantidad > 0) {
                uDoc(fDoc(db, "inventario", oldCodigo), { stock: increment(oldCantidad) }).catch(console.error);
              }
              // Descontar el nuevo medicamento
              if (newCodigo && newCantidad > 0) {
                uDoc(fDoc(db, "inventario", newCodigo), { stock: increment(-newCantidad) }).catch(console.error);
              }
            }
          }
        });
      } else {
        const payload: Partial<Receta> = {
          nombrePaciente: form.nombrePaciente,
          rut: form.rut,
          medicamento: form.medicamento,
          codigoMedicamento: form.codigoMedicamento,
          cantidad: form.cantidad ? Number(form.cantidad) : 0,
          nota: form.nota,
          estado: form.estado,
          medicoReceta: form.medicoReceta,
          medicoUid: form.medicoUid,
          actualizadoEn: now,
          fechaReceta: form.estado === "completado" ? (receta?.fechaReceta ?? now) : null,
          fechaLimite: dateStrToTs(form.fechaLimite),
          autoRenovacion: form.estado === "rechazado" ? 0 : (form.autoRenovacion ?? 0),
          motivoRechazo: form.estado === "rechazado" ? (form.motivoRechazo || "") : "",
        };

        if (receta) {
          const snapAntes = await getDoc(doc(db, collectionName, receta.id));
          const dataAntes = snapAntes.data() as Record<string, unknown>;
          const payloadCifrado = encryptRecetaFields(payload);
          await updateDoc(doc(db, collectionName, receta.id), payloadCifrado);
          const cambios = detectarCambios(
            dataAntes,
            payloadCifrado as Record<string, unknown>,
            ["nombrePaciente", "rut", "medicamento", "nota", "estado", "medicoReceta", "fechaLimite", "autoRenovacion", "motivoRechazo", "cantidad"]
          );
          await registrarAccion(collectionName, receta.id, "MODIFICACION", farmaciaUser, cambios);
          
          // Lógica de stock si se rechaza una receta que ya había descontado
          // O si cambia la cantidad (simplificado: si se rechaza, devolvemos el stock; si cambia cantidad, ajustamos)
          // Para no complicarlo mucho y evitar bugs, solo devolvemos si pasa a "rechazado" y antes no lo estaba.
          if (payload.estado === "rechazado" && dataAntes.estado !== "rechazado" && payload.codigoMedicamento && payload.cantidad) {
            import("firebase/firestore").then(({ increment }) => {
              updateDoc(doc(db, "inventario", payload.codigoMedicamento as string), {
                stock: increment(payload.cantidad as number)
              }).catch(e => console.error("Error devolviendo stock:", e));
            });
          }
          // Si era rechazado y ahora vuelve a pendiente/completado, volvemos a descontar
          if (dataAntes.estado === "rechazado" && payload.estado !== "rechazado" && payload.codigoMedicamento && payload.cantidad) {
            import("firebase/firestore").then(({ increment }) => {
              updateDoc(doc(db, "inventario", payload.codigoMedicamento as string), {
                stock: increment(-(payload.cantidad as number))
              }).catch(e => console.error("Error descontando stock devuelto:", e));
            });
          }
          // Si cambió la cantidad o el medicamento, y la receta NO está rechazada
          if (payload.estado !== "rechazado" && dataAntes.estado !== "rechazado") {
            const oldCantidad = (dataAntes.cantidad as number) || 0;
            const oldCodigo = dataAntes.codigoMedicamento as string;
            if (oldCodigo !== payload.codigoMedicamento || oldCantidad !== payload.cantidad) {
              import("firebase/firestore").then(({ increment }) => {
                if (oldCodigo && oldCantidad > 0) {
                  updateDoc(doc(db, "inventario", oldCodigo), { stock: increment(oldCantidad) }).catch(e => console.error(e));
                }
                if (payload.codigoMedicamento && payload.cantidad > 0) {
                  updateDoc(doc(db, "inventario", payload.codigoMedicamento as string), { stock: increment(-(payload.cantidad as number)) }).catch(e => console.error(e));
                }
              });
            }
          }

        } else {
          // Auto-asignar médico si quien crea es un médico
          if (!payload.medicoUid && (farmaciaUser.role === 'medico' || farmaciaUser.isMedico)) {
            payload.medicoUid = farmaciaUser.id;
            payload.medicoReceta = farmaciaUser.name;
            (payload as any).creadoPorMedico = true;
          }
          const payloadCifrado = encryptRecetaFields(payload);
          const docRef = await addDoc(collection(db, collectionName), {
            ...payloadCifrado,
            sector,
            tipo: tipo === "controladas" ? "controlado" : "cronico",
            fechaSolicitud: now,
            creadoPor: farmaciaUser.id,
            creadoEn: now,
            eliminada: false,
            mesesDescontados: 0, // El médico aún no ha recetado — se descuenta al autorizar
          } as Omit<Receta, "id">);
          await registrarAccion(collectionName, docRef.id, "CREACION", farmaciaUser);
          // ⚠️ NO se descuenta stock aquí — el funcionario no puede recetar.
          //    El descuento ocurre cuando el médico autoriza y selecciona medicamento + cantidad.
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white border border-[#DDE6F5] rounded-xl px-4 py-3 text-[#0F1B35] placeholder-[#A8BDD8] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 outline-none transition-all text-sm";
  const inputDisabledClass = "w-full bg-[#F0F4FF] border border-[#EEF3FC] rounded-xl px-4 py-3 text-[#7B90B5] text-sm cursor-not-allowed select-none";
  const labelClass = "block text-xs font-semibold text-[#3D5278] mb-1.5 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 bg-[#0F1B35]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Wrapper: altura limitada, flex-col, SIN overflow-hidden para no bloquear scroll interno */}
      <div className="glass-modal w-full max-w-2xl flex flex-col rounded-3xl border border-[#C4D4EE]/50" style={{maxHeight: "min(90vh, 700px)"}}>

        {/* ── Header Fijo (no hace scroll) ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#DDE6F5] bg-[#F8FAFF] rounded-t-3xl">
          <div>
            <h2 className="text-xl font-black text-[#0F1B35]">
              {soloAutorizacion ? "Autorizar / Rechazar Receta" : receta ? "Editar Solicitud" : "Nueva Solicitud"}
            </h2>
            <p className="text-xs text-[#7B90B5] mt-0.5">
              {tipo === "controladas" ? "💊 Controlada" : "📋 Crónica"} — Sector {sector}
              {soloAutorizacion && (
                <span className="ml-2 text-brand-blue">🩺 Vista de médico</span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-[#EFF3FB] rounded-xl transition-colors text-[#7B90B5] hover:text-[#0F1B35]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Zona scrollable (crece y encoge) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <form id="receta-form" onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Datos del paciente ── */}
          {soloAutorizacion && receta ? (
            // Médico: ver datos en modo lectura solamente
            <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3.5 h-3.5 text-[#A8BDD8]" />
                <p className="text-xs font-bold text-[#7B90B5] uppercase tracking-widest">Datos del paciente (solo lectura)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Paciente</label>
                  <div className={inputDisabledClass}>{receta.nombrePaciente}</div>
                </div>
                <div>
                  <label className={labelClass}>RUT</label>
                  <div className={`${inputDisabledClass} font-mono`}>{receta.rut}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4 mt-3">
                <div className="relative" ref={comboboxRef}>
                  <label className={labelClass}>Medicamento</label>
                  <input
                    required
                    type="text"
                    placeholder="Buscar en el inventario..."
                    value={form.medicamento}
                    onChange={(e) => {
                      setForm({ ...form, medicamento: e.target.value, codigoMedicamento: "" });
                      setIsComboboxOpen(true);
                    }}
                    onFocus={() => setIsComboboxOpen(true)}
                    className={`${inputClass} text-brand-purple font-semibold placeholder-brand-purple/30 focus:border-brand-purple border-brand-purple/30`}
                  />
                  {isComboboxOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-[#DDE6F5] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {inventario
                        .filter(item => item.nombre.toLowerCase().includes(form.medicamento.toLowerCase()) || item.codigo.includes(form.medicamento))
                        .slice(0, 50)
                        .map((item) => (
                          <div
                            key={item.codigo}
                            className="px-4 py-2 hover:bg-[#F0F4FF] cursor-pointer flex justify-between items-center border-b border-[#EEF3FC] last:border-0"
                            onClick={() => {
                              setForm({ ...form, medicamento: item.nombre, codigoMedicamento: item.codigo });
                              setIsComboboxOpen(false);
                            }}
                          >
                            <span className="text-sm font-semibold text-[#0F1B35]">{item.nombre}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                              Stock: {item.stock}
                            </span>
                          </div>
                      ))}
                      {inventario.length === 0 && (
                        <div className="px-4 py-3 text-sm text-[#7B90B5] italic">No hay inventario cargado.</div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass} title="Cantidad total a despachar">Cant. (Unid.)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Ej: 30"
                    value={form.cantidad}
                    onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                    className={`${inputClass} text-center font-bold`}
                  />
                </div>
              </div>
              
              {/* Asistente Matemático */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowCalc(!showCalc)}
                  className="text-[11px] text-brand-blue font-bold flex items-center gap-1 hover:underline outline-none"
                >
                  {showCalc ? "Ocultar asistente de cálculo" : "✦ Mostrar asistente de cálculo"}
                </button>
                {showCalc && (
                  <div className="mt-2 bg-brand-blue/5 border border-brand-blue/15 rounded-xl p-3 flex gap-3 items-end">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-brand-blue mb-1">Dosis (u.)</label>
                      <input type="number" min="0" step="0.5" value={calcDosis} 
                        onChange={(e) => { setCalcDosis(e.target.value); runCalculadora(e.target.value, calcHoras, calcDias); }} 
                        className="w-14 bg-white border border-brand-blue/20 rounded-lg px-2 py-1.5 text-sm text-center focus:border-brand-blue outline-none" />
                    </div>
                    <div className="pb-1.5 text-[#7B90B5] text-xs font-bold">cada</div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-brand-blue mb-1">Horas</label>
                      <input type="number" min="1" value={calcHoras} 
                        onChange={(e) => { setCalcHoras(e.target.value); runCalculadora(calcDosis, e.target.value, calcDias); }} 
                        className="w-14 bg-white border border-brand-blue/20 rounded-lg px-2 py-1.5 text-sm text-center focus:border-brand-blue outline-none" />
                    </div>
                    <div className="pb-1.5 text-[#7B90B5] text-xs font-bold">por</div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-brand-blue mb-1">Días</label>
                      <input type="number" min="1" value={calcDias} 
                        onChange={(e) => { setCalcDias(e.target.value); runCalculadora(calcDosis, calcHoras, e.target.value); }} 
                        className="w-14 bg-white border border-brand-blue/20 rounded-lg px-2 py-1.5 text-sm text-center focus:border-brand-blue outline-none" />
                    </div>
                  </div>
                )}
              </div>

              {receta.nota && (
                <div>
                  <label className={labelClass}>Nota</label>
                  <div className={`${inputDisabledClass} whitespace-pre-wrap`}>{receta.nota}</div>
                </div>
              )}
            </div>
          ) : (
            // Funcionario / Admin: editar datos completos
            <>
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
              <div className="relative" ref={comboboxRef}>
                <label className={labelClass}>Medicamento Solicitado</label>
                <input
                  required
                  type="text"
                  placeholder="Buscar en el inventario..."
                  value={form.medicamento}
                  onChange={(e) => {
                    setForm({ ...form, medicamento: e.target.value, codigoMedicamento: "" });
                    setIsComboboxOpen(true);
                  }}
                  onFocus={() => setIsComboboxOpen(true)}
                  className={`${inputClass} text-brand-purple font-semibold placeholder-brand-purple/30 focus:border-brand-purple border-brand-purple/30`}
                />
                {isComboboxOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#DDE6F5] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {inventario
                      .filter(item => item.nombre.toLowerCase().includes(form.medicamento.toLowerCase()) || item.codigo.includes(form.medicamento))
                      .slice(0, 50)
                      .map((item) => (
                        <div
                          key={item.codigo}
                          className="px-4 py-2 hover:bg-[#F0F4FF] cursor-pointer flex justify-between items-center border-b border-[#EEF3FC] last:border-0"
                          onClick={() => {
                            setForm({ ...form, medicamento: item.nombre, codigoMedicamento: item.codigo });
                            setIsComboboxOpen(false);
                          }}
                        >
                          <span className="text-sm font-semibold text-[#0F1B35]">{item.nombre}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                            Stock: {item.stock}
                          </span>
                        </div>
                    ))}
                    {inventario.length === 0 && (
                      <div className="px-4 py-3 text-sm text-[#7B90B5] italic">No hay inventario cargado.</div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-[#A8BDD8] mt-1">El médico definirá la cantidad exacta al autorizar la receta.</p>
              </div>
              <div>
                <label className={labelClass}>Nota Adicional (Opcional)</label>
                <textarea rows={3} placeholder="Detalles o instrucciones especiales..." value={form.nota}
                  onChange={(e) => setForm({ ...form, nota: e.target.value })} className={`${inputClass} resize-none`} />
              </div>

              {/* ── Fecha límite ── */}
              {/* ── Fecha límite ── */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Fecha Límite de Atención</p>
                  {form.fechaLimite && (
                    <button type="button" onClick={() => setForm({ ...form, fechaLimite: "" })}
                      className="text-[10px] text-[#A8BDD8] hover:text-red-500 transition-colors ml-auto">
                      ✕ quitar
                    </button>
                  )}
                </div>
                <p className="text-xs text-amber-600/70">
                  Fecha máxima en que esta receta debe ser atendida. Controla cuándo saltan las alertas amarilla y roja.
                </p>
                <input
                  required
                  type="date"
                  value={form.fechaLimite}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
                  className={`w-full bg-white border rounded-xl px-4 py-3 text-sm outline-none transition-all cursor-pointer
                    ${form.fechaLimite
                      ? "border-amber-300 text-amber-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      : "border-[#DDE6F5] text-[#3D5278] focus:border-amber-300 focus:ring-2 focus:ring-amber-50"
                    }`}
                />
                {form.fechaLimite && (
                  <p className="text-xs font-semibold text-amber-700">
                    ✓ {form.fechaLimite.split("-").reverse().join("/")}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Estado y médico ── */}
          <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-brand-purple uppercase tracking-widest">
              {soloAutorizacion ? "🩺 Decisión Médica" : "Estado de la Solicitud"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Estado</label>
                {soloAutorizacion ? (
                  <div className="flex gap-2">
                    {(["pendiente", "completado", "rechazado"] as const).map((est) => {
                      const icons = { pendiente: null, completado: CheckCircle2, rechazado: XCircle };
                      const activeColors = {
                        pendiente: "border-amber-300 bg-amber-50 text-amber-700 shadow-sm",
                        completado: "border-green-400 bg-green-50 text-green-700 shadow-sm",
                        rechazado: "border-red-300 bg-red-50 text-red-600 shadow-sm",
                      };
                      const labels = { pendiente: "Pendiente", completado: "Autorizar", rechazado: "Rechazar" };
                      const Icon = icons[est];
                      return (
                        <button
                          key={est}
                          type="button"
                          onClick={() => setForm({ ...form, estado: est })}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            form.estado === est
                              ? activeColors[est]
                              : "border-[#DDE6F5] bg-white text-[#7B90B5] hover:border-[#C4D4EE] hover:bg-[#F5F8FF]"
                          }`}
                        >
                          {Icon && <Icon className="w-3.5 h-3.5" />}
                          {labels[est]}
                        </button>
                      );
                    })}
                  </div>
                ) : puedeAutorizar ? (
                  <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as any })}
                    className={`${inputClass} appearance-none`}>
                    <option value="pendiente">⏳ Pendiente</option>
                    <option value="completado">✅ Recetado / Completado</option>
                    <option value="rechazado">❌ Rechazado</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-amber-700">Pendiente</span>
                    <span className="text-xs text-[#7B90B5] ml-auto">Solo un médico puede autorizar</span>
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  Médico Asignado / Tratante
                  {medicos.length === 0 && (
                    <span className="ml-1 text-amber-500" title="No hay médicos con rol 'medico' en el sistema">
                      <AlertCircle className="inline w-3 h-3" />
                    </span>
                  )}
                </label>
                {puedeEditarDatos ? (
                  <select required={form.estado === "completado"} value={form.medicoUid}
                    onChange={(e) => handleMedicoChange(e.target.value)}
                    className={`${inputClass} appearance-none ${form.estado === "completado" ? "text-green-700 border-green-300 focus:border-green-500" : ""}`}>
                    <option value="">{form.estado === "pendiente" ? "Sin asignar (Opcional)" : "Seleccione un médico..."}</option>
                    {medicos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ) : (
                  <div className={inputDisabledClass}>
                    {form.medicoReceta || <span className="italic">Sin asignar</span>}
                  </div>
                )}
                {medicos.length === 0 && puedeEditarDatos && (
                  <p className="text-xs text-amber-600/80 mt-1">
                    Ve a Administración y asigna <code className="bg-amber-100 px-1 rounded">role: "medico"</code> a los médicos del CESFAM.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Auto-renovación / Duración — Visible si está completado o rechazado (para deshabilitarlo), si se crea nueva, o si ya tiene duración. */}
          {(form.estado === "completado" || form.estado === "rechazado" || (!receta && puedeEditarDatos) || (!receta && (farmaciaUser.role === 'medico' || farmaciaUser.isMedico)) || (form.autoRenovacion && form.autoRenovacion > 0)) && (
            <div className={`${form.estado === "completado" ? "bg-green-50 border-green-200" : form.estado === "rechazado" ? "bg-slate-50 border-slate-200 opacity-60" : "bg-blue-50 border-brand-blue/20"} border rounded-xl p-4 space-y-2 transition-all`}>
              <p className={`text-xs font-bold ${form.estado === "completado" ? "text-green-700" : form.estado === "rechazado" ? "text-slate-500" : "text-brand-blue"} uppercase tracking-widest`}>
                {form.estado === "completado" || form.estado === "rechazado" ? "Auto-Renovación" : "Duración de la Receta"}
              </p>
              <p className={`text-xs ${form.estado === "completado" ? "text-green-600/70" : form.estado === "rechazado" ? "text-slate-400" : "text-brand-blue/60"}`}>
                {form.estado === "rechazado" ? "La auto-renovación ha sido deshabilitada." : "¿Por cuántos meses es válida esta receta?"}
              </p>
              <select
                value={form.estado === "rechazado" ? 0 : (form.autoRenovacion ?? 0)}
                onChange={(e) => setForm({ ...form, autoRenovacion: Number(e.target.value) })}
                disabled={form.estado === "rechazado" || (!puedeEditarDatos && !soloAutorizacion && !(!receta && (farmaciaUser.role === 'medico' || farmaciaUser.isMedico)))}
                className={`w-full bg-white border ${form.estado === "completado" ? "border-green-200 text-green-800 focus:border-green-400" : form.estado === "rechazado" ? "border-slate-200 text-slate-500 cursor-not-allowed" : "border-brand-blue/20 text-brand-blue focus:border-brand-blue"} rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-all disabled:opacity-50`}
              >
                <option value={0}>Sin renovación automática</option>
                <option value={1}>1 mes</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
                <option value={4}>4 meses</option>
                <option value={5}>5 meses</option>
                <option value={6}>6 meses</option>
              </select>
            </div>
          )}

          {/* Motivo de rechazo — solo cuando se rechaza */}
          {form.estado === "rechazado" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Motivo del Rechazo *</p>
              <textarea
                required
                disabled={!puedeEditarDatos && !soloAutorizacion}
                rows={3}
                placeholder="Indique el motivo por el que se rechaza esta receta..."
                value={form.motivoRechazo ?? ""}
                onChange={(e) => setForm({ ...form, motivoRechazo: e.target.value })}
                className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 placeholder-red-300 outline-none focus:border-red-400 resize-none transition-all disabled:opacity-50"
              />
            </div>
          )}

          </form>
        </div>

        {/* ── Footer Fijo (siempre visible) ── */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 bg-[#F8FAFF] border-t border-[#DDE6F5] rounded-b-3xl">
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-[#3D5278] hover:bg-[#EFF3FB] border border-[#DDE6F5] transition-colors">
            Cancelar
          </button>
          <button type="submit" form="receta-form" disabled={loading}
            className={`flex items-center gap-2 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm ${
              soloAutorizacion
                ? "bg-brand-blue hover:bg-brand-blue-dark shadow-blue"
                : "bg-brand-purple hover:bg-brand-purple-dark shadow-purple"
            }`}>
            <Save className="w-4 h-4" />
            {loading ? "Guardando..." : soloAutorizacion ? "Confirmar Decisión" : "Guardar Registro"}
          </button>
        </div>

      </div>
    </div>
  );
}
