import { useState, useEffect, useRef } from "react";
import { X, Save, AlertCircle, CheckCircle2, XCircle, Lock, Clock, Calendar, Plus, Trash2 } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from "firebase/firestore";
import { registrarAccion, detectarCambios } from "../lib/auditoria";
import { encryptRecetaFields } from "../lib/crypto";
import type { Receta, FarmaciaUser, ItemReceta } from "../types";
import { getItemsDeReceta, nuevoItemVacio } from "../lib/recetaHelpers";

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
  const [esSolicitudGeneral, setEsSolicitudGeneral] = useState(false);
  // Multi-medicamento (solo en modo médico/soloAutorizacion)
  const [formItems, setFormItems] = useState<ItemReceta[]>([]);
  const [activeComboIdx, setActiveComboIdx] = useState<number | null>(null); // índice del combobox abierto
  const isDoctorUser = farmaciaUser.role === 'medico' || farmaciaUser.isMedico === true;
  const isDoctorMode = soloAutorizacion || isDoctorUser;
  const [formTipo, setFormTipo] = useState<"controladas" | "cronicas">(tipo);
  const [formSector, setFormSector] = useState<"A" | "B" | "CECOSF">(sector);
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
    setFormTipo(tipo);
    setFormSector(sector);
    if (receta) {
      const esGeneral = receta.medicamento === "SOLICITUD_RECETA";
      setEsSolicitudGeneral(esGeneral);
      // Inicializar formItems para modo médico
      setFormItems(getItemsDeReceta(receta).map(it => ({ ...it })));
      setActiveComboIdx(null);
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
      setEsSolicitudGeneral(false);
      // Si es modo médico, inicializar con al menos 1 ítem para empezar a prescribir
      setFormItems(isDoctorMode ? [nuevoItemVacio()] : []);
      setActiveComboIdx(null);
      setForm({
        nombrePaciente: "",
        rut: "",
        medicamento: "",
        codigoMedicamento: "",
        cantidad: "",
        nota: "",
        estado: isDoctorMode ? "completado" : "pendiente",
        medicoReceta: isDoctorMode ? farmaciaUser.name : "",
        medicoUid: isDoctorMode ? farmaciaUser.id : "",
        fechaLimite: "",
        autoRenovacion: 0,
        motivoRechazo: "",
      });
    }
  }, [receta, isOpen, tipo, sector]);

  if (!isOpen) return null;

  const collectionName = tipo === "controladas" ? "recetas_controladas" : "recetas_cronicas";
  const targetCollection = !receta
    ? (formTipo === "controladas" ? "recetas_controladas" : "recetas_cronicas")
    : collectionName;
  const targetSector = !receta ? formSector : sector;
  const targetTipo = !receta
    ? (formTipo === "controladas" ? "controlado" : "cronico")
    : (tipo === "controladas" ? "controlado" : "cronico");

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
  const [calcOpenIdx, setCalcOpenIdx] = useState<number | null>(null);
  const [calcDosis, setCalcDosis] = useState("1");
  const [calcHoras, setCalcHoras] = useState("8");
  const [calcDias, setCalcDias] = useState("30");

  const runCalculadora = (d: string, h: string, days: string, targetIdx: number = 0) => {
    const dosis = parseFloat(d) || 0;
    const horas = parseFloat(h) || 24;
    const dias = parseFloat(days) || 0;
    const tomas = 24 / (horas > 0 ? horas : 24);
    const total = Math.ceil(tomas * dosis * dias);

    // 1. Actualizar form.cantidad (por compatibilidad)
    setForm(f => ({ ...f, cantidad: total > 0 ? total.toString() : "" }));

    // 2. Actualizar el ítem correspondiente en formItems (modo médico)
    setFormItems(prev => {
      if (prev.length === 0) return prev;
      return prev.map((it, i) =>
        i === targetIdx ? { ...it, cantidad: total } : it
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarRut(form.rut)) {
      alert("El RUT ingresado no es válido. Por favor, corríjalo antes de guardar.");
      return;
    }
    setLoading(true);
    try {
      const now = Timestamp.now();

      if (isDoctorMode) {
        if (receta) {
          // ── Modo médico: guarda items[] + estado en receta existente ──────────────────────────────
          const snapAntes = await getDoc(doc(db, collectionName, receta.id));
          const dataAntes = snapAntes.data() as Record<string, unknown>;

          // Mantener mesesDescontados de los items que ya existían
          const itemsConMeses: ItemReceta[] = formItems.map((it) => ({
            ...it,
            // Preservar mesesDescontados si el ítem ya existía y tiene el mismo código
            mesesDescontados: it.mesesDescontados ?? 0,
          }));

          // Primer ítem para retrocompatibilidad de campos planos
          const primerItem = itemsConMeses[0] ?? nuevoItemVacio();

          const payload = {
            estado: form.estado,
            // Campos planos (retrocompatibilidad + cifrado existente)
            medicamento: primerItem.medicamento,
            codigoMedicamento: primerItem.codigoMedicamento,
            cantidad: primerItem.cantidad,
            // Array de ítems (modelo nuevo)
            items: itemsConMeses,
            actualizadoEn: now,
            medicoReceta: form.estado !== "pendiente"
              ? (receta.medicoReceta || farmaciaUser.name)
              : receta.medicoReceta,
            medicoUid: form.estado !== "pendiente"
              ? (receta.medicoUid || farmaciaUser.id)
              : receta.medicoUid,
            fechaReceta: form.estado === "completado" ? (receta.fechaReceta ?? now) : null,
            motivoRechazo: form.estado === "rechazado" ? (form.motivoRechazo || "") : "",
          };
          const payloadCifrado = encryptRecetaFields(payload as any);
          await updateDoc(doc(db, collectionName, receta.id), payloadCifrado);
          const cambios = detectarCambios(
            dataAntes,
            payloadCifrado as Record<string, unknown>,
            ["estado", "medicoReceta", "motivoRechazo", "medicamento", "cantidad", "items"]
          );
          await registrarAccion(collectionName, receta.id, "MODIFICACION", farmaciaUser, cambios);

          // ── Lógica de stock por ítem ──────────────────────────────────────────
          const { increment, updateDoc: uDoc, doc: fDoc } = await import("firebase/firestore");
          const oldItems: ItemReceta[] = Array.isArray(dataAntes.items)
            ? (dataAntes.items as ItemReceta[])
            : getItemsDeReceta(receta);

          if (payload.estado === "rechazado") {
            // Devolver stock de todos los ítems que ya se habían descontado
            oldItems.forEach(oldIt => {
              if (oldIt.codigoMedicamento && oldIt.cantidad > 0 && (oldIt.mesesDescontados ?? 0) > 0) {
                uDoc(fDoc(db, "inventario", oldIt.codigoMedicamento), {
                  stock: increment(oldIt.cantidad)
                }).catch(console.error);
              }
            });
            // Marcar mesesDescontados = 0 en todos los ítems
            const itemsReset = itemsConMeses.map(it => ({ ...it, mesesDescontados: 0, autoRenovacion: 0 }));
            await updateDoc(doc(db, collectionName, receta.id), { items: itemsReset });

          } else {
            // Para cada ítem nuevo/modificado, calcular delta de stock
            const itemsActualizados = itemsConMeses.map((newIt, idx) => {
              const oldIt = oldItems[idx];
              const firstTime = (newIt.mesesDescontados ?? 0) === 0;
              const codigoChanged = oldIt && oldIt.codigoMedicamento !== newIt.codigoMedicamento;
              const cantidadChanged = oldIt && oldIt.cantidad !== newIt.cantidad;

              if (newIt.codigoMedicamento && newIt.cantidad > 0) {
                if (firstTime) {
                  // Primera vez: descontar y marcar mes 1
                  uDoc(fDoc(db, "inventario", newIt.codigoMedicamento), {
                    stock: increment(-newIt.cantidad)
                  }).catch(console.error);
                  return { ...newIt, mesesDescontados: 1 };
                } else if (oldIt && (codigoChanged || cantidadChanged)) {
                  // Cambió: devolver anterior, descontar nuevo
                  if (oldIt.codigoMedicamento && oldIt.cantidad > 0) {
                    uDoc(fDoc(db, "inventario", oldIt.codigoMedicamento), {
                      stock: increment(oldIt.cantidad)
                    }).catch(console.error);
                  }
                  uDoc(fDoc(db, "inventario", newIt.codigoMedicamento), {
                    stock: increment(-newIt.cantidad)
                  }).catch(console.error);
                }
              }
              return newIt;
            });

            // Ítems que existían antes pero ya no están (eliminados por el médico)
            if (oldItems.length > itemsConMeses.length) {
              oldItems.slice(itemsConMeses.length).forEach(removedIt => {
                if (removedIt.codigoMedicamento && removedIt.cantidad > 0 && (removedIt.mesesDescontados ?? 0) > 0) {
                  uDoc(fDoc(db, "inventario", removedIt.codigoMedicamento), {
                    stock: increment(removedIt.cantidad)
                  }).catch(console.error);
                }
              });
            }

            // Guardar items actualizados con mesesDescontados correctos
            await updateDoc(doc(db, collectionName, receta.id), { items: itemsActualizados });
          }
        } else {
          // ── Modo médico: CREAR NUEVA RECETA CON MULTI-MEDICAMENTO ──────────────────
          const itemsValidos = formItems.filter(it => it.codigoMedicamento && it.cantidad > 0);
          if (itemsValidos.length === 0) {
            alert("Por favor agregue al menos un medicamento válido del inventario con su cantidad.");
            setLoading(false);
            return;
          }

          const itemsConMeses: ItemReceta[] = formItems.map((it) => ({
            ...it,
            mesesDescontados: (form.estado === "completado" && it.codigoMedicamento && it.cantidad > 0) ? 1 : 0,
          }));

          const primerItem = itemsConMeses[0] ?? nuevoItemVacio();

          const payload = {
            nombrePaciente: form.nombrePaciente,
            rut: form.rut,
            medicamento: primerItem.medicamento,
            codigoMedicamento: primerItem.codigoMedicamento,
            cantidad: primerItem.cantidad,
            items: itemsConMeses,
            nota: form.nota,
            estado: "completado",
            medicoReceta: farmaciaUser.name,
            medicoUid: farmaciaUser.id,
            fechaLimite: dateStrToTs(form.fechaLimite),
            autoRenovacion: primerItem.autoRenovacion ?? 0,
            motivoRechazo: "",
            sector: targetSector,
            tipo: targetTipo,
            fechaSolicitud: now,
            fechaReceta: now,
            creadoPor: farmaciaUser.id,
            creadoPorMedico: true,
            creadoEn: now,
            eliminada: false,
            mesesDescontados: 1,
          };

          const payloadCifrado = encryptRecetaFields(payload as any);
          const docRef = await addDoc(collection(db, targetCollection), payloadCifrado);
          await registrarAccion(targetCollection, docRef.id, "CREACION", farmaciaUser);

          // Descontar stock en inventario para cada medicamento prescrito
          const { increment, updateDoc: uDoc, doc: fDoc } = await import("firebase/firestore");
          for (const it of itemsConMeses) {
            if (it.codigoMedicamento && it.cantidad > 0) {
              uDoc(fDoc(db, "inventario", it.codigoMedicamento), {
                stock: increment(-it.cantidad)
              }).catch(console.error);
            }
          }
        }
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
                if (payload.codigoMedicamento && (payload.cantidad ?? 0) > 0) {
                  updateDoc(doc(db, "inventario", payload.codigoMedicamento as string), { stock: increment(-((payload.cantidad ?? 0) as number)) }).catch(e => console.error(e));
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

  const inputClass = "w-full bg-white border border-[#DDE6F5] rounded-xl px-4 py-3 text-[#0F1B35] placeholder-[#8FA3C4] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 outline-none transition-all text-sm";
  const inputDisabledClass = "w-full bg-[#F0F4FF] border border-[#EEF3FC] rounded-xl px-4 py-3 text-[#5D7299] text-sm cursor-not-allowed select-none";
  const labelClass = "block text-xs font-semibold text-[#3D5278] mb-1.5 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-[#0F1B35]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Wrapper: altura limitada, flex-col, SIN overflow-hidden para no bloquear scroll interno */}
      <div className="glass-modal w-full max-w-2xl flex flex-col rounded-3xl border border-[#C4D4EE]/50" style={{maxHeight: "min(90vh, 700px)"}}>

        {/* ── Header Fijo (no hace scroll) ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#DDE6F5] bg-[#F8FAFF] rounded-t-3xl">
          <div>
            <h2 className="text-xl font-black text-[#0F1B35]">
              {isDoctorMode && receta
                ? "Autorizar / Rechazar Receta"
                : isDoctorMode && !receta
                ? "Nueva Receta Médica"
                : receta
                ? "Editar Solicitud"
                : "Nueva Solicitud"}
            </h2>
            <p className="text-xs text-[#5D7299] mt-0.5">
              {!receta ? (
                <span>
                  {formTipo === "controladas" ? "💊 Controlada" : "🩺 Crónica"} — Sector {formSector}
                </span>
              ) : (
                <span>
                  {tipo === "controladas" ? "💊 Controlada" : "🩺 Crónica"} — Sector {sector}
                </span>
              )}
              {isDoctorMode && (
                <span className="ml-2 text-brand-blue font-semibold">🩺 Dr(a). {farmaciaUser.name}</span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-[#EFF3FB] rounded-xl transition-colors text-[#5D7299] hover:text-[#0F1B35]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Zona scrollable (crece y encoge) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <form id="receta-form" onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ── Datos del paciente ── */}
          {isDoctorMode ? (
            // Médico: datos del paciente + lista editable de ítems
            <div className="space-y-4">
              {/* Datos del paciente */}
              <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3.5 h-3.5 text-[#8FA3C4]" />
                  <p className="text-xs font-bold text-[#5D7299] uppercase tracking-widest">
                    Datos del paciente {!receta || puedeEditarDatos ? "(editable)" : "(solo lectura)"}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Paciente</label>
                    {!receta || puedeEditarDatos ? (
                      <input
                        required
                        type="text"
                        placeholder="Juan Pérez González"
                        value={form.nombrePaciente}
                        onChange={(e) => setForm({ ...form, nombrePaciente: e.target.value })}
                        className={inputClass}
                      />
                    ) : (
                      <div className={inputDisabledClass}>{receta?.nombrePaciente}</div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>RUT</label>
                    {!receta || puedeEditarDatos ? (
                      <input
                        required
                        type="text"
                        placeholder="12.345.678-9"
                        value={form.rut}
                        maxLength={12}
                        onChange={(e) => setForm({ ...form, rut: formatRut(e.target.value) })}
                        className={`${inputClass} font-mono`}
                      />
                    ) : (
                      <div className={`${inputDisabledClass} font-mono`}>{receta?.rut}</div>
                    )}
                  </div>
                </div>

                {!receta && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className={labelClass}>Tipo de Receta</label>
                      <select
                        value={formTipo}
                        onChange={(e) => setFormTipo(e.target.value as "controladas" | "cronicas")}
                        className={inputClass}
                      >
                        <option value="controladas">💊 Receta Controlada</option>
                        <option value="cronicas">🩺 Receta Crónica</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Sector</label>
                      <select
                        value={formSector}
                        onChange={(e) => setFormSector(e.target.value as "A" | "B" | "CECOSF")}
                        className={inputClass}
                      >
                        <option value="A">Sector A</option>
                        <option value="B">Sector B</option>
                        <option value="CECOSF">CECOSF</option>
                      </select>
                    </div>
                  </div>
                )}

                {receta?.nota && (
                  <div>
                    <label className={labelClass}>Nota de la Solicitud</label>
                    <div className={`${inputDisabledClass} whitespace-pre-wrap`}>{receta.nota}</div>
                  </div>
                )}

                {!receta && (
                  <div>
                    <label className={labelClass}>Indicaciones / Observaciones (opcional)</label>
                    <textarea
                      rows={2}
                      placeholder="Posología o indicaciones para el paciente..."
                      value={form.nota}
                      onChange={(e) => setForm({ ...form, nota: e.target.value })}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                )}
              </div>

              {/* Lista de medicamentos — editable por el médico */}
              <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-blue uppercase tracking-widest">💊 Medicamentos de la Receta</p>
                  <span className="text-[11px] text-[#8FA3C4]">{formItems.length} ítem{formItems.length !== 1 ? "s" : ""}</span>
                </div>

                {formItems.map((item, idx) => (
                  <div key={idx} className="bg-white border border-[#DDE6F5] rounded-xl p-3 space-y-2.5">
                    {/* Encabezado del ítem */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#5D7299] uppercase tracking-widest">
                        Medicamento {idx + 1}
                        {item.medicamento === "SOLICITUD_RECETA" && (
                          <span className="ml-2 text-amber-600 normal-case font-semibold">— Solicitud sin med.</span>
                        )}
                      </span>
                      {/* Solo mostrar quitar si hay más de 1 ítem */}
                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormItems(prev => prev.filter((_, i) => i !== idx));
                            setActiveComboIdx(null);
                          }}
                          className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Quitar
                        </button>
                      )}
                    </div>

                    {/* Aviso de solicitud genérica */}
                    {item.medicamento === "SOLICITUD_RECETA" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-sm">📋</span>
                        <p className="text-xs text-amber-700 font-semibold">Asigne un medicamento del inventario</p>
                      </div>
                    )}

                    {/* Combobox de medicamento */}
                    <div className="relative">
                      <label className={labelClass}>Medicamento</label>
                      <input
                        required={item.medicamento !== "SOLICITUD_RECETA"}
                        type="text"
                        placeholder="Buscar en el inventario..."
                        value={item.medicamento === "SOLICITUD_RECETA" ? "" : item.medicamento}
                        onChange={(e) => {
                          setFormItems(prev => prev.map((it, i) =>
                            i === idx ? { ...it, medicamento: e.target.value, codigoMedicamento: "" } : it
                          ));
                          setActiveComboIdx(idx);
                        }}
                        onFocus={() => setActiveComboIdx(idx)}
                        className={`${inputClass} text-brand-indigo font-semibold placeholder-brand-indigo/30 focus:border-brand-indigo border-brand-indigo/30`}
                      />
                      {activeComboIdx === idx && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-[#DDE6F5] rounded-xl shadow-lg max-h-52 overflow-y-auto">
                          {inventario
                            .filter(inv =>
                              inv.nombre.toLowerCase().includes(item.medicamento.toLowerCase()) ||
                              inv.codigo.includes(item.medicamento)
                            )
                            .slice(0, 50)
                            .map(inv => (
                              <div
                                key={inv.codigo}
                                className="px-4 py-2 hover:bg-[#F0F4FF] cursor-pointer flex justify-between items-center border-b border-[#EEF3FC] last:border-0"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // evitar blur antes de click
                                  setFormItems(prev => prev.map((it, i) =>
                                    i === idx ? { ...it, medicamento: inv.nombre, codigoMedicamento: inv.codigo } : it
                                  ));
                                  setActiveComboIdx(null);
                                }}
                              >
                                <span className="text-sm font-semibold text-[#0F1B35]">{inv.nombre}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${inv.stock <= 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                                  Stock: {inv.stock}
                                </span>
                              </div>
                            ))}
                          {inventario.length === 0 && (
                            <div className="px-4 py-3 text-sm text-[#5D7299] italic">No hay inventario cargado.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cantidad + Auto-renovación en fila */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass} title="Cantidad total a despachar">Cant. (Unid.)</label>
                        <input
                          required
                          type="number"
                          min="1"
                          placeholder="Ej: 30"
                          value={item.cantidad > 0 ? item.cantidad : ""}
                          onChange={(e) => setFormItems(prev => prev.map((it, i) =>
                            i === idx ? { ...it, cantidad: Number(e.target.value) } : it
                          ))}
                          className={`${inputClass} text-center font-bold`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Auto-Renovación</label>
                        <select
                          value={item.autoRenovacion ?? 0}
                          onChange={(e) => setFormItems(prev => prev.map((it, i) =>
                            i === idx ? { ...it, autoRenovacion: Number(e.target.value) } : it
                          ))}
                          className={`${inputClass} text-sm`}
                        >
                          <option value={0}>Sin renovación</option>
                          <option value={1}>1 mes</option>
                          <option value={2}>2 meses</option>
                          <option value={3}>3 meses</option>
                          <option value={4}>4 meses</option>
                          <option value={5}>5 meses</option>
                          <option value={6}>6 meses</option>
                        </select>
                      </div>
                    </div>

                    {/* Asistente matemático por ítem */}
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (calcOpenIdx === idx) {
                            setCalcOpenIdx(null);
                          } else {
                            setCalcOpenIdx(idx);
                            runCalculadora(calcDosis, calcHoras, calcDias, idx);
                          }
                        }}
                        className="text-[11px] text-brand-blue font-bold flex items-center gap-1 hover:underline outline-none"
                      >
                        {calcOpenIdx === idx ? "Ocultar asistente de cálculo" : "✦ Asistente de cálculo matemático"}
                      </button>
                      {calcOpenIdx === idx && (
                        <div className="mt-2 bg-brand-blue/5 border border-brand-blue/15 rounded-xl p-3 flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-[11px] uppercase font-bold text-brand-blue mb-1">Dosis (u.)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={calcDosis}
                              onChange={(e) => {
                                setCalcDosis(e.target.value);
                                runCalculadora(e.target.value, calcHoras, calcDias, idx);
                              }}
                              className="w-16 bg-white border border-brand-blue/20 rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:border-brand-blue outline-none"
                            />
                          </div>
                          <div className="pb-1.5 text-[#5D7299] text-xs font-bold">cada</div>
                          <div>
                            <label className="block text-[11px] uppercase font-bold text-brand-blue mb-1">Horas</label>
                            <input
                              type="number"
                              min="1"
                              value={calcHoras}
                              onChange={(e) => {
                                setCalcHoras(e.target.value);
                                runCalculadora(calcDosis, e.target.value, calcDias, idx);
                              }}
                              className="w-16 bg-white border border-brand-blue/20 rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:border-brand-blue outline-none"
                            />
                          </div>
                          <div className="pb-1.5 text-[#5D7299] text-xs font-bold">por</div>
                          <div>
                            <label className="block text-[11px] uppercase font-bold text-brand-blue mb-1">Días</label>
                            <input
                              type="number"
                              min="1"
                              value={calcDias}
                              onChange={(e) => {
                                setCalcDias(e.target.value);
                                runCalculadora(calcDosis, calcHoras, e.target.value, idx);
                              }}
                              className="w-16 bg-white border border-brand-blue/20 rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:border-brand-blue outline-none"
                            />
                          </div>
                          <div className="pb-1.5 ml-auto text-right">
                            <span className="text-[10px] font-bold text-brand-blue/70 uppercase block">Total calculado</span>
                            <span className="text-sm font-black text-brand-blue bg-white border border-brand-blue/20 rounded-lg px-2.5 py-1 inline-block shadow-sm">
                              {Math.ceil((24 / (parseFloat(calcHoras) || 24)) * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0))} unid.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Botón agregar ítem */}
                <button
                  type="button"
                  onClick={() => setFormItems(prev => [...prev, nuevoItemVacio()])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-brand-blue/30 text-brand-blue text-sm font-semibold hover:bg-brand-blue/5 hover:border-brand-blue/50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Agregar otro medicamento
                </button>
              </div>
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
              <div>
                {/* Etiqueta + toggle solicitud genérica */}
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass}>Medicamento Solicitado</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nuevoValor = !esSolicitudGeneral;
                      setEsSolicitudGeneral(nuevoValor);
                      if (nuevoValor) {
                        setForm({ ...form, medicamento: "SOLICITUD_RECETA", codigoMedicamento: "" });
                        setIsComboboxOpen(false);
                      } else {
                        setForm({ ...form, medicamento: "", codigoMedicamento: "" });
                      }
                    }}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                      esSolicitudGeneral
                        ? "bg-amber-50 text-amber-700 border-amber-300 shadow-sm"
                        : "bg-[#F0F4FF] text-[#5D7299] border-[#DDE6F5] hover:border-amber-300 hover:text-amber-600"
                    }`}
                  >
                    {esSolicitudGeneral ? "✓ Solicitud Receta" : "⚕ Solicitud Receta"}
                  </button>
                </div>

                {/* Vista solicitud genérica (sin medicamento específico) */}
                {esSolicitudGeneral ? (
                  <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="text-sm font-bold text-amber-700">Solicitud de Receta</p>
                      <p className="text-xs text-amber-600/80">El médico definirá el medicamento al autorizar</p>
                    </div>
                  </div>
                ) : (
                  /* Combobox normal del inventario */
                  <div className="relative" ref={comboboxRef}>
                    <input
                      required={!esSolicitudGeneral}
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
                          <div className="px-4 py-3 text-sm text-[#5D7299] italic">No hay inventario cargado.</div>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-[#8FA3C4] mt-1">El médico definirá la cantidad exacta al autorizar la receta.</p>
                  </div>
                )}
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
                      className="text-[11px] text-[#8FA3C4] hover:text-red-500 transition-colors ml-auto">
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
          <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl p-5 space-y-5">
            <p className="text-xs font-bold text-brand-purple uppercase tracking-widest">
              {isDoctorMode ? "🩺 Decisión Médica" : "Estado de la Solicitud"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Estado</label>
                {isDoctorMode ? (
                  !receta ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-green-700">Emitir Receta Autorizada</p>
                        <p className="text-[11px] text-green-600/70">La receta queda lista para despacho en farmacia</p>
                      </div>
                    </div>
                  ) : (
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
                                : "border-[#DDE6F5] bg-white text-[#5D7299] hover:border-[#C4D4EE] hover:bg-[#F5F8FF]"
                            }`}
                          >
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            {labels[est]}
                          </button>
                        );
                      })}
                    </div>
                  )
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
                    <span className="text-xs text-[#5D7299] ml-auto">Solo un médico puede autorizar</span>
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

          {/* Auto-renovación / Duración — Solo para funcionario (el médico la define por ítem de medicamento) */}
          {!isDoctorMode && (form.estado === "completado" || form.estado === "rechazado" || (!receta && puedeEditarDatos) || (form.autoRenovacion && form.autoRenovacion > 0)) && (
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
                disabled={form.estado === "rechazado" || (!puedeEditarDatos && !soloAutorizacion)}
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
              isDoctorMode
                ? "bg-brand-blue hover:bg-brand-blue-dark shadow-blue"
                : "bg-brand-purple hover:bg-brand-purple-dark shadow-purple"
            }`}>
            <Save className="w-4 h-4" />
            {loading ? "Guardando..." : isDoctorMode && !receta ? "Emitir Receta Médica" : isDoctorMode ? "Confirmar Decisión" : "Guardar Registro"}
          </button>
        </div>

      </div>
    </div>
  );
}
