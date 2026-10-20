import { useState, useEffect, useRef } from "react";
import { X, Save, AlertCircle, CheckCircle2, XCircle, Lock, Clock, Calendar, Plus, Trash2, History } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from "firebase/firestore";
import { registrarAccion, detectarCambios } from "../lib/auditoria";
import { AuditoriaDrawer } from "./AuditoriaDrawer";
import { encryptRecetaFields } from "../lib/crypto";
import { sincronizarRecetaPublica } from "../lib/recetaPublica";
import type { Receta, FarmaciaUser, ItemReceta } from "../types";
import { getItemsDeReceta, nuevoItemVacio, isRecetaVigente, formatRut, validarRut } from "../lib/recetaHelpers";
import { RutBadge } from "./RutBadge";

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
  todasRecetas,
}: {
  isOpen: boolean;
  onClose: () => void;
  receta: Receta | null;
  medicos: FarmaciaUser[];
  tipo: "controladas" | "cronicas" | "maternales" | "respiratorias";
  sector: "A" | "B" | "CECOSF";
  farmaciaUser: FarmaciaUser;
  /** Si true: el usuario solo puede cambiar el estado (médico sin permisos de edición de datos) */
  soloAutorizacion?: boolean;
  /** Si false: campos de datos del paciente deshabilitados */
  puedeEditarDatos?: boolean;
  /** Si false: el estado queda fijo en "pendiente" — para funcionarios que solo ingresan recetas */
  puedeAutorizar?: boolean;
  todasRecetas?: Receta[]; // Para detectar duplicados/recetas activas por RUT
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
  // Multi-medicamento (en modo médico, soloAutorizacion o Super Admin)
  const [formItems, setFormItems] = useState<ItemReceta[]>([]);
  const [activeComboIdx, setActiveComboIdx] = useState<number | null>(null); // índice del combobox abierto
  const isSuperAdmin = Boolean(
    farmaciaUser?.email?.toLowerCase() === "ssanchez@cmvalparaiso.cl" ||
    farmaciaUser?.role === "superadmin"
  );
  const isDoctorUser = farmaciaUser.isMedico === true || (farmaciaUser.role === 'medico' && farmaciaUser.isFuncionario !== true);
  const isDoctorMode = soloAutorizacion || isDoctorUser || isSuperAdmin;
  const [formTipo, setFormTipo] = useState<"controladas" | "cronicas" | "maternales" | "respiratorias">(tipo);
  const [formSector, setFormSector] = useState<"A" | "B" | "CECOSF">(sector);
  const [recetaVinculada, setRecetaVinculada] = useState<Receta | null>(null);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const getCollectionForReceta = (r: Receta | null | undefined, fallbackTipo?: string): string => {
    const t = r?.tipo as string | undefined;
    if (t === "controlado" || t === "controladas") return "recetas_controladas";
    if (t === "cronico" || t === "cronicas") return "recetas_cronicas";
    if (t === "maternal" || t === "maternales") return "recetas_maternales";
    if (t === "respiratorio" || t === "respiratorias") return "recetas_respiratorias";
    if (fallbackTipo === "controladas" || fallbackTipo === "controlado") return "recetas_controladas";
    if (fallbackTipo === "maternales" || fallbackTipo === "maternal") return "recetas_maternales";
    if (fallbackTipo === "respiratorias" || fallbackTipo === "respiratorio") return "recetas_respiratorias";
    return "recetas_cronicas";
  };

  const recetaObjetivo = receta || recetaVinculada;

  const vincularReceta = (r: Receta) => {
    setRecetaVinculada(r);
    setFormTipo(r.tipo === "controlado" ? "controladas" : r.tipo === "maternal" ? "maternales" : r.tipo === "respiratorio" ? "respiratorias" : "cronicas");
    setFormSector(r.sector);
    setForm(prev => ({
      ...prev,
      nombrePaciente: r.nombrePaciente,
      rut: r.rut,
      nota: r.nota || prev.nota,
      estado: r.estado === "rechazado" ? "completado" : r.estado,
    }));
    const itemsExistentes = getItemsDeReceta(r).map(it => ({ ...it }));
    if (itemsExistentes.length === 1 && itemsExistentes[0].medicamento === "SOLICITUD_RECETA") {
      setFormItems([nuevoItemVacio()]);
    } else {
      setFormItems([...itemsExistentes, nuevoItemVacio()]);
    }
  };

  const desvincularReceta = () => {
    setRecetaVinculada(null);
    setFormItems([nuevoItemVacio()]);
  };

  // Buscar recetas VIGENTES del mismo RUT (excluye completadas cuyo ciclo ya terminó)
  const rutNormalizado = form.rut.replace(/[^0-9kK]/gi, "").toUpperCase();
  const recetasActivasDelPaciente = (todasRecetas || []).filter(r => {
    if (receta && r.id === receta.id) return false; // excluir la receta actual
    const rutR = r.rut?.replace(/[^0-9kK]/gi, "").toUpperCase();
    if (rutR !== rutNormalizado || rutNormalizado.length < 7 || r.eliminada) return false;
    // Solo mostrar aviso si la receta aún tiene vigencia activa
    return isRecetaVigente(r);
  });
  const tieneRecetasActivas = recetasActivasDelPaciente.length > 0;

  const currentTipoNormalizado: import("../types").TipoReceta = !receta
    ? (formTipo === "controladas" ? "controlado" : formTipo === "maternales" ? "maternal" : formTipo === "respiratorias" ? "respiratorio" : "cronico")
    : (receta.tipo === "controlado" ? "controlado" : receta.tipo === "maternal" ? "maternal" : receta.tipo === "respiratorio" ? "respiratorio" : "cronico");

  const currentTipoLabel = currentTipoNormalizado === "controlado"
    ? "Controlada"
    : currentTipoNormalizado === "maternal"
    ? "Maternal"
    : currentTipoNormalizado === "respiratorio"
    ? "Respiratoria (ERA)"
    : "Crónica";

  const getTipoBadgeText = (tipo: string) => {
    switch (tipo) {
      case "controlado": return "💊 Controlada";
      case "maternal": return "🤰 Maternal";
      case "respiratorio": return "🫁 Respiratorio (ERA)";
      default: return "🩺 Crónica";
    }
  };

  const recetasMismoPrograma = recetasActivasDelPaciente.filter(r => r.tipo === currentTipoNormalizado);
  const recetasOtrosProgramas = recetasActivasDelPaciente.filter(r => r.tipo !== currentTipoNormalizado);

  const bannerRecetasActivas = tieneRecetasActivas && rutNormalizado.length >= 7 && (
    <div className="space-y-3">
      {/* 1. Alerta para recetas del MISMO programa (posible duplicidad / complementación dentro del programa) */}
      {recetasMismoPrograma.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-900 uppercase tracking-wider">
                {isDoctorMode ? `Receta ${currentTipoLabel} vigente detectada` : `Aviso: Receta ${currentTipoLabel} vigente`}
              </p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                {isDoctorMode
                  ? `Este paciente ya cuenta con una receta vigente en el programa ${currentTipoLabel}. Puedes agregar un fármaco a la receta existente o emitir una nueva receta independiente.`
                  : `Este paciente ya cuenta con una receta activa en este mismo programa. Verifique con el médico antes de duplicar la solicitud.`
                }
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {recetasMismoPrograma.slice(0, 3).map(r => {
              const items = getItemsDeReceta(r);
              const yaVinculada = recetaVinculada?.id === r.id;
              return (
                <div key={r.id} className={`bg-white border rounded-xl px-3 py-2.5 transition-all ${
                  yaVinculada ? "border-brand-blue ring-2 ring-brand-blue/20 bg-blue-50/40" : "border-amber-200"
                }`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-amber-900">
                        {getTipoBadgeText(r.tipo)} — Sector {r.sector}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {items.slice(0, 3).map((it, i) => (
                          <span key={i} className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-semibold">
                            {it.medicamento === "SOLICITUD_RECETA" ? "Sin med. asignado" : it.medicamento}
                            {it.cantidad > 0 ? ` ×${it.cantidad}` : ""}
                          </span>
                        ))}
                        {items.length > 3 && <span className="text-[10px] text-amber-600 font-bold">+{items.length - 3} más</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      r.estado === "completado" ? "bg-green-100 text-green-700" :
                      r.estado === "rechazado" ? "bg-slate-100 text-slate-500" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{r.estado}</span>
                  </div>

                  {/* Botón SOLO para recetas del mismo programa */}
                  {isDoctorMode && !receta && (
                    <div className="mt-2 pt-2 border-t border-amber-100 flex justify-end">
                      {yaVinculada ? (
                        <span className="text-xs font-bold text-brand-blue flex items-center gap-1">
                          ✓ Receta seleccionada para agregar fármaco
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => vincularReceta(r)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 border border-brand-blue/20 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar medicamento a esta receta
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {recetasMismoPrograma.length > 3 && (
              <p className="text-[11px] text-amber-600 text-center font-semibold">+{recetasMismoPrograma.length - 3} recetas más en este programa</p>
            )}
          </div>
        </div>
      )}

      {/* 2. Información clínica: Prescripciones en OTROS programas (coexistencia complementaria normal) */}
      {recetasOtrosProgramas.length > 0 && (
        <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-xl flex-shrink-0">🫁</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-black text-sky-950 uppercase tracking-wider">
                  Tratamientos vigentes en otros programas clínicos
                </p>
                <span className="text-[10px] bg-sky-200/60 text-sky-900 font-bold px-2 py-0.5 rounded-full">
                  Coexistencia complementaria
                </span>
              </div>
              <p className="text-xs text-sky-800 mt-0.5 leading-relaxed">
                Este paciente tiene prescripciones activas en otros programas de salud (ej: Respiratorio ERA, Controlados, Maternal).
                <b className="font-semibold text-sky-950 ml-1">Son recetas independientes que no interfieren con la receta actual.</b>
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {recetasOtrosProgramas.slice(0, 3).map(r => {
              const items = getItemsDeReceta(r);
              return (
                <div key={r.id} className="bg-white/95 border border-sky-200/80 rounded-xl px-3 py-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold text-sky-950">
                          {getTipoBadgeText(r.tipo)} — Sector {r.sector}
                        </p>
                        <span className="text-[9px] bg-teal-50 text-teal-700 font-semibold px-1.5 py-0.2 rounded border border-teal-200">
                          Programa independiente
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {items.slice(0, 3).map((it, i) => (
                          <span key={i} className="text-[10px] bg-sky-100/70 text-sky-800 rounded px-1.5 py-0.5 font-medium">
                            {it.medicamento === "SOLICITUD_RECETA" ? "Sin med. asignado" : it.medicamento}
                            {it.cantidad > 0 ? ` ×${it.cantidad}` : ""}
                            {it.autoRenovacion ? ` (${it.autoRenovacion}m)` : ""}
                          </span>
                        ))}
                        {items.length > 3 && <span className="text-[10px] text-sky-600 font-bold">+{items.length - 3} más</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      r.estado === "completado" ? "bg-green-100 text-green-700" :
                      r.estado === "rechazado" ? "bg-slate-100 text-slate-500" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{r.estado}</span>
                  </div>
                </div>
              );
            })}
            {recetasOtrosProgramas.length > 3 && (
              <p className="text-[11px] text-sky-600 text-center font-semibold">+{recetasOtrosProgramas.length - 3} recetas más en otros programas</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-sky-700 pt-1 font-medium border-t border-sky-100">
            <span className="text-emerald-600 font-bold">✓</span> Puedes autorizar o emitir la receta actual con total tranquilidad; se mantendrá en su respectivo programa.
          </div>
        </div>
      )}
    </div>
  );

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
    setRecetaVinculada(null);
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

  const collectionName = tipo === "controladas" ? "recetas_controladas"
                       : tipo === "maternales" ? "recetas_maternales"
                       : tipo === "respiratorias" ? "recetas_respiratorias"
                       : "recetas_cronicas";
  const targetCollection = !recetaObjetivo
    ? (formTipo === "controladas" ? "recetas_controladas" : formTipo === "maternales" ? "recetas_maternales" : formTipo === "respiratorias" ? "recetas_respiratorias" : "recetas_cronicas")
    : getCollectionForReceta(recetaObjetivo);
  const targetSector = !recetaObjetivo ? formSector : recetaObjetivo.sector;
  const targetTipo = !recetaObjetivo
    ? (formTipo === "controladas" ? "controlado" : formTipo === "maternales" ? "maternal" : formTipo === "respiratorias" ? "respiratorio" : "cronico")
    : (recetaObjetivo.tipo === "controlado" ? "controlado" : recetaObjetivo.tipo === "maternal" ? "maternal" : recetaObjetivo.tipo === "respiratorio" ? "respiratorio" : "cronico");

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
  const [calcHoras, setCalcHoras] = useState("24");
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
        if (recetaObjetivo) {
          // Si el médico autoriza la receta, verificar que tenga al menos un fármaco válido y cantidad > 0 (que no esté rechazado individualmente)
          if (form.estado === "completado") {
            const itemsValidos = formItems.filter(it => it.estadoItem !== "rechazado" && it.medicamento && it.medicamento !== "SOLICITUD_RECETA" && (it.cantidad ?? 0) > 0);
            if (itemsValidos.length === 0) {
              alert("Para autorizar la receta, al menos un medicamento debe estar autorizado con su cantidad mayor a 0. Si desea rechazar toda la receta, seleccione la opción 'Rechazar' en la decisión médica.");
              setLoading(false);
              return;
            }
          }

          // ── Modo médico: guarda items[] + estado en receta existente ──────────────────────────────
          const targetDocCollection = getCollectionForReceta(recetaObjetivo, formTipo || tipo);
          let finalCollection = targetDocCollection;
          let snapAntes = await getDoc(doc(db, targetDocCollection, recetaObjetivo.id));
          if (!snapAntes.exists()) {
            const allCols = ["recetas_controladas", "recetas_cronicas", "recetas_maternales", "recetas_respiratorias"].filter(c => c !== targetDocCollection);
            for (const col of allCols) {
              const snapAlt = await getDoc(doc(db, col, recetaObjetivo.id));
              if (snapAlt.exists()) {
                snapAntes = snapAlt;
                finalCollection = col;
                break;
              }
            }
          }
          const dataAntes = snapAntes.data() || {};

          // Mantener mesesDescontados de los items que ya existían
          const itemsConMeses: ItemReceta[] = formItems.map((it) => ({
            ...it,
            // Preservar mesesDescontados si el ítem ya existía y tiene el mismo código
            mesesDescontados: it.mesesDescontados ?? 0,
          }));

          // Primer ítem para retrocompatibilidad de campos planos (preferir uno autorizado)
          const primerItem = itemsConMeses.find(it => it.estadoItem !== "rechazado") ?? itemsConMeses[0] ?? nuevoItemVacio();

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
              ? (recetaObjetivo.medicoReceta || form.medicoReceta || farmaciaUser.name)
              : recetaObjetivo.medicoReceta,
            medicoUid: form.estado !== "pendiente"
              ? (recetaObjetivo.medicoUid || form.medicoUid || farmaciaUser.id)
              : recetaObjetivo.medicoUid,
            fechaReceta: form.estado === "completado" ? (recetaObjetivo.fechaReceta ?? now) : null,
            motivoRechazo: form.estado === "rechazado" ? (form.motivoRechazo || "") : "",
            nombrePaciente: form.nombrePaciente,
            rut: form.rut,
            nota: form.nota,
          };
          const payloadCifrado = encryptRecetaFields(payload as any);
          await updateDoc(doc(db, finalCollection, recetaObjetivo.id), payloadCifrado);
          // 🔄 Sincronizar portal público de pacientes (datos no sensibles)
          sincronizarRecetaPublica(
            recetaObjetivo.id,
            form.rut,
            payload.estado,
            recetaObjetivo.tipo,
            recetaObjetivo.sector,
            recetaObjetivo.fechaSolicitud,
            formItems[0]?.autoRenovacion ?? 0,
            formItems[0]?.mesesDescontados ?? 0,
            false
          ).catch(console.error);
          const cambios = detectarCambios(
            dataAntes,
            { ...payloadCifrado, items: itemsConMeses } as Record<string, unknown>,
            ["estado", "medicoReceta", "motivoRechazo", "medicamento", "cantidad", "items", "nombrePaciente", "rut", "nota"]
          );
          await registrarAccion(finalCollection, recetaObjetivo.id, "MODIFICACION", farmaciaUser, cambios);

          // ── Lógica de stock por ítem ──────────────────────────────────────────
          const { increment, updateDoc: uDoc, doc: fDoc } = await import("firebase/firestore");
          const oldItems: ItemReceta[] = Array.isArray(dataAntes.items)
            ? (dataAntes.items as ItemReceta[])
            : getItemsDeReceta(recetaObjetivo);

          if (payload.estado === "rechazado") {
            // Devolver stock de todos los ítems que ya se habían descontado
            oldItems.forEach(oldIt => {
              const m = oldIt.mesesDescontados || 1;
              if (oldIt.codigoMedicamento && oldIt.cantidad > 0 && (oldIt.mesesDescontados ?? 0) > 0) {
                uDoc(fDoc(db, "inventario", oldIt.codigoMedicamento), {
                  stock: increment(oldIt.cantidad * m)
                }).catch(console.error);
              }
            });
            // Marcar mesesDescontados = 0 en todos los ítems
            const itemsReset = itemsConMeses.map(it => ({ ...it, mesesDescontados: 0, autoRenovacion: 0 }));
            await updateDoc(doc(db, finalCollection, recetaObjetivo.id), { items: itemsReset });

          } else {
            // Para cada ítem nuevo/modificado, calcular delta de stock
            const itemsActualizados = itemsConMeses.map((newIt, idx) => {
              // Buscar coincidencia en los ítems previos (por código o posición)
              const oldIt = oldItems.find(o => o.codigoMedicamento === newIt.codigoMedicamento) || oldItems[idx];
              const firstTime = !oldIt || (newIt.mesesDescontados ?? 0) === 0;
              const codigoChanged = oldIt && oldIt.codigoMedicamento !== newIt.codigoMedicamento;
              const cantidadChanged = oldIt && oldIt.cantidad !== newIt.cantidad;

              // Si el ítem está rechazado individualmente, devolver stock previo si aplica y no descontar
              if (newIt.estadoItem === "rechazado") {
                if (oldIt && (oldIt.mesesDescontados ?? 0) > 0 && oldIt.codigoMedicamento && oldIt.cantidad > 0) {
                  const m = oldIt.mesesDescontados || 1;
                  uDoc(fDoc(db, "inventario", oldIt.codigoMedicamento), {
                    stock: increment(oldIt.cantidad * m)
                  }).catch(console.error);
                }
                return { ...newIt, mesesDescontados: 0, autoRenovacion: 0 };
              }

              if (newIt.codigoMedicamento && newIt.cantidad > 0) {
                if (firstTime) {
                  // Primera vez: descontar si la receta está en estado completado
                  if (payload.estado === "completado") {
                    uDoc(fDoc(db, "inventario", newIt.codigoMedicamento), {
                      stock: increment(-newIt.cantidad)
                    }).catch(console.error);
                    return { ...newIt, mesesDescontados: 1 };
                  }
                  return { ...newIt, mesesDescontados: 0 };
                } else if (oldIt && (codigoChanged || cantidadChanged)) {
                  const m = oldIt.mesesDescontados || 1;
                  if (codigoChanged) {
                    // Cambió de medicamento: devolver stock del anterior y descontar el nuevo
                    if (oldIt.codigoMedicamento && oldIt.cantidad > 0) {
                      uDoc(fDoc(db, "inventario", oldIt.codigoMedicamento), {
                        stock: increment(oldIt.cantidad * m)
                      }).catch(console.error);
                    }
                    uDoc(fDoc(db, "inventario", newIt.codigoMedicamento), {
                      stock: increment(-newIt.cantidad * m)
                    }).catch(console.error);
                  } else if (cantidadChanged) {
                    // Mismo fármaco, cantidad corregida: diff positivo devuelve al stock, negativo descuenta
                    const diff = oldIt.cantidad - newIt.cantidad;
                    uDoc(fDoc(db, "inventario", newIt.codigoMedicamento), {
                      stock: increment(diff * m)
                    }).catch(console.error);
                  }
                  return { ...newIt, mesesDescontados: m };
                }
              }
              return newIt;
            });

            // Ítems que existían antes pero fueron eliminados en esta edición
            oldItems.forEach(oldIt => {
              if (oldIt.codigoMedicamento && oldIt.cantidad > 0 && (oldIt.mesesDescontados ?? 0) > 0) {
                const sigueEstando = itemsConMeses.some(nIt => nIt.codigoMedicamento === oldIt.codigoMedicamento);
                if (!sigueEstando) {
                  const m = oldIt.mesesDescontados || 1;
                  uDoc(fDoc(db, "inventario", oldIt.codigoMedicamento), {
                    stock: increment(oldIt.cantidad * m)
                  }).catch(console.error);
                }
              }
            });

            // Guardar items actualizados con mesesDescontados correctos
            await updateDoc(doc(db, finalCollection, recetaObjetivo.id), { items: itemsActualizados });
          }
        } else {
          // ── Modo médico: CREAR NUEVA RECETA CON MULTI-MEDICAMENTO ──────────────────
          const itemsValidos = formItems.filter(it => it.estadoItem !== "rechazado" && it.codigoMedicamento && it.cantidad > 0);
          if (itemsValidos.length === 0) {
            alert("Por favor agregue al menos un medicamento válido del inventario con su cantidad que no esté rechazado.");
            setLoading(false);
            return;
          }

          const itemsConMeses: ItemReceta[] = formItems.map((it) => ({
            ...it,
            mesesDescontados: (form.estado === "completado" && it.estadoItem !== "rechazado" && it.codigoMedicamento && it.cantidad > 0) ? 1 : 0,
          }));

          const primerItem = itemsConMeses.find(it => it.estadoItem !== "rechazado") ?? itemsConMeses[0] ?? nuevoItemVacio();

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
          const cambiosCreacion = [
            {
              campo: "medicamentos_agregados",
              antes: null,
              despues: itemsConMeses.map((it) => {
                const cant = it.cantidad ? ` ×${it.cantidad}` : "";
                const reno = it.autoRenovacion && it.autoRenovacion > 0 ? ` (${it.autoRenovacion} meses)` : "";
                return `${it.medicamento}${cant}${reno}`;
              }).join(" | "),
            },
          ];
          await registrarAccion(targetCollection, docRef.id, "CREACION", farmaciaUser, cambiosCreacion);
          // 🔄 Sincronizar portal público de pacientes (datos no sensibles)
          sincronizarRecetaPublica(
            docRef.id,
            form.rut,
            "completado",
            targetTipo as import("../types").TipoReceta,
            targetSector,
            now,
            itemsConMeses[0]?.autoRenovacion ?? 0,
            1,
            false
          ).catch(console.error);

          // Descontar stock en inventario para cada medicamento prescrito (solo los no rechazados)
          const { increment, updateDoc: uDoc, doc: fDoc } = await import("firebase/firestore");
          for (const it of itemsConMeses) {
            if (it.estadoItem !== "rechazado" && it.codigoMedicamento && it.cantidad > 0) {
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

        if (recetaObjetivo) {
          const targetDocCollection = getCollectionForReceta(recetaObjetivo, tipo);
          let finalCollection = targetDocCollection;
          let snapAntes = await getDoc(doc(db, targetDocCollection, recetaObjetivo.id));
          if (!snapAntes.exists()) {
            const allCols = ["recetas_controladas", "recetas_cronicas", "recetas_maternales", "recetas_respiratorias"].filter(c => c !== targetDocCollection);
            for (const col of allCols) {
              const snapAlt = await getDoc(doc(db, col, recetaObjetivo.id));
              if (snapAlt.exists()) {
                snapAntes = snapAlt;
                finalCollection = col;
                break;
              }
            }
          }
          const dataAntes = snapAntes.data() || {};
          const payloadCifrado = encryptRecetaFields(payload);
          await updateDoc(doc(db, finalCollection, recetaObjetivo.id), payloadCifrado);
          // 🔄 Sincronizar portal público de pacientes (datos no sensibles)
          sincronizarRecetaPublica(
            recetaObjetivo.id,
            form.rut,
            payload.estado ?? recetaObjetivo.estado,
            recetaObjetivo.tipo,
            recetaObjetivo.sector,
            recetaObjetivo.fechaSolicitud,
            payload.autoRenovacion ?? recetaObjetivo.autoRenovacion ?? 0,
            recetaObjetivo.mesesDescontados ?? 0,
            false
          ).catch(console.error);
          const cambios = detectarCambios(
            dataAntes,
            payloadCifrado as Record<string, unknown>,
            ["nombrePaciente", "rut", "medicamento", "nota", "estado", "medicoReceta", "fechaLimite", "autoRenovacion", "motivoRechazo", "cantidad", "items"]
          );
          await registrarAccion(finalCollection, recetaObjetivo.id, "MODIFICACION", farmaciaUser, cambios);
          
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
          if (!payload.medicoUid && isDoctorUser) {
            payload.medicoUid = farmaciaUser.id;
            payload.medicoReceta = farmaciaUser.name;
            (payload as any).creadoPorMedico = true;
          }
          const payloadCifrado = encryptRecetaFields(payload);
          const docRef = await addDoc(collection(db, collectionName), {
            ...payloadCifrado,
            sector,
            tipo: tipo === "controladas" ? "controlado" : tipo === "maternales" ? "maternal" : tipo === "respiratorias" ? "respiratorio" : "cronico",
            fechaSolicitud: now,
            creadoPor: farmaciaUser.id,
            creadoEn: now,
            eliminada: false,
            mesesDescontados: 0, // El médico aún no ha recetado — se descuenta al autorizar
          } as Omit<Receta, "id">);
          const cambiosCreacion = [
            {
              campo: "medicamentos_agregados",
              antes: null,
              despues: payload.medicamento && payload.medicamento !== "SOLICITUD_RECETA"
                ? `${payload.medicamento}${payload.cantidad ? ` ×${payload.cantidad}` : ""}`
                : "📋 Solicitud de receta (pendiente de indicación médica)",
            },
          ];
          await registrarAccion(collectionName, docRef.id, "CREACION", farmaciaUser, cambiosCreacion);
          // 🔄 Sincronizar portal público de pacientes (datos no sensibles)
          sincronizarRecetaPublica(
            docRef.id,
            form.rut,
            "pendiente",
            (tipo === "controladas" ? "controlado" : tipo === "maternales" ? "maternal" : tipo === "respiratorias" ? "respiratorio" : "cronico") as import("../types").TipoReceta,
            sector,
            now,
            form.autoRenovacion ?? 0,
            0,
            false
          ).catch(console.error);
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
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-[#0F1B35]">
                {recetaVinculada
                  ? "Agregar Fármaco a Receta Activa"
                  : isSuperAdmin && receta
                  ? "Editar Receta"
                  : isDoctorMode && receta
                  ? "Autorizar / Rechazar Receta"
                  : isDoctorMode && !receta
                  ? "Nueva Receta Médica"
                  : receta
                  ? "Editar Solicitud"
                  : "Nueva Solicitud"}
              </h2>
              {isSuperAdmin && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-300 rounded-full px-2.5 py-0.5 shadow-sm">
                  🛡️ Super Admin
                </span>
              )}
            </div>
            <p className="text-xs text-[#5D7299] mt-0.5">
              {recetaVinculada ? (
                <span>
                  {recetaVinculada.tipo === "controlado" ? "💊 Controlada" : recetaVinculada.tipo === "maternal" ? "🤰 Maternal" : recetaVinculada.tipo === "respiratorio" ? "🫁 Respiratorio" : "🩺 Crónica"} — Sector {recetaVinculada.sector} (Prescripción activa)
                </span>
              ) : !receta ? (
                <span>
                  {formTipo === "controladas" ? "💊 Controlada" : formTipo === "maternales" ? "🤰 Maternal" : formTipo === "respiratorias" ? "🫁 Respiratorio" : "🩺 Crónica"} — Sector {formSector}
                </span>
              ) : (
                <span>
                  {tipo === "controladas" ? "💊 Controlada" : tipo === "maternales" ? "🤰 Maternal" : tipo === "respiratorias" ? "🫁 Respiratorio" : "🩺 Crónica"} — Sector {sector}
                </span>
              )}
              {isDoctorMode && !isSuperAdmin && (
                <span className="ml-2 text-brand-blue font-semibold">🩺 Dr(a). {farmaciaUser.name}</span>
              )}
              {isSuperAdmin && (
                <span className="ml-2 text-purple-700 font-semibold">👤 {farmaciaUser.name} ({farmaciaUser.email})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {recetaObjetivo?.id && (
              <button
                type="button"
                onClick={() => setAuditoriaOpen(true)}
                className="p-2 hover:bg-[#EFF3FB] rounded-xl transition-colors text-[#5D7299] hover:text-brand-purple"
                title="Ver historial de auditoría de esta receta"
              >
                <History className="w-5 h-5" />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 hover:bg-[#EFF3FB] rounded-xl transition-colors text-[#5D7299] hover:text-[#0F1B35]">
              <X className="w-5 h-5" />
            </button>
          </div>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#3D5278] uppercase tracking-wide">RUT</label>
                      <RutBadge rut={form.rut || receta?.rut} />
                    </div>
                    {!receta || puedeEditarDatos ? (
                      <input
                        required
                        type="text"
                        placeholder="12345678-9"
                        value={form.rut}
                        maxLength={12}
                        onChange={(e) => setForm({ ...form, rut: formatRut(e.target.value) })}
                        className={`${inputClass} font-mono`}
                      />
                    ) : (
                      <div className={`${inputDisabledClass} font-mono`}>{formatRut(receta?.rut || form.rut)}</div>
                    )}
                  </div>
                </div>

                {!receta && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className={labelClass}>Tipo de Receta</label>
                      <select
                        value={formTipo}
                        onChange={(e) => setFormTipo(e.target.value as "controladas" | "cronicas" | "maternales" | "respiratorias")}
                        className={inputClass}
                      >
                        <option value="controladas">💊 Receta Controlada</option>
                        <option value="cronicas">🩺 Receta Crónica</option>
                        <option value="maternales">🤰 Receta Maternal</option>
                        <option value="respiratorias">🫁 Receta Respiratorio</option>
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

                <div>
                  <label className={labelClass}>Indicaciones / Observaciones (opcional)</label>
                  {isSuperAdmin || !receta ? (
                    <textarea
                      rows={2}
                      placeholder="Posología o indicaciones para el paciente..."
                      value={form.nota}
                      onChange={(e) => setForm({ ...form, nota: e.target.value })}
                      className={`${inputClass} resize-none`}
                    />
                  ) : receta?.nota ? (
                    <div className={`${inputDisabledClass} whitespace-pre-wrap`}>{receta.nota}</div>
                  ) : (
                    <div className={`${inputDisabledClass} italic text-[#8FA3C4]`}>Sin observaciones registradas</div>
                  )}
                </div>
              </div>

              {bannerRecetasActivas}

              {/* Banner Super Admin */}
              {isSuperAdmin && receta && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <span className="text-2xl flex-shrink-0">🛡️</span>
                  <div>
                    <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                      Modo Super Administrador Activo
                    </p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Tienes control total sobre esta receta ya autorizada. Puedes modificar las cantidades, sustituir o agregar fármacos, ajustar los meses de renovación o corregir los datos del paciente. Los ajustes de stock se aplicarán automáticamente en el inventario.
                    </p>
                  </div>
                </div>
              )}

              {/* Banner receta vinculada */}
              {recetaVinculada && (
                <div className="bg-blue-50 border border-brand-blue/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">📎</span>
                    <div>
                      <p className="text-xs font-bold text-brand-blue-dark uppercase tracking-wider">
                        Agregando fármaco a Receta activa ({recetaVinculada.tipo === "controlado" ? "Controlada" : recetaVinculada.tipo === "maternal" ? "Maternal" : recetaVinculada.tipo === "respiratorio" ? "Respiratorio" : "Crónica"} · Sector {recetaVinculada.sector})
                      </p>
                      <p className="text-xs text-[#3D5278] mt-0.5">
                        Los medicamentos previos se conservan intactos. Solo se descontará del inventario el nuevo fármaco prescrito.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={desvincularReceta}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
                  >
                    Desvincular
                  </button>
                </div>
              )}

              {/* Lista de medicamentos — editable por el médico */}
              <div className={`border rounded-2xl p-4 space-y-3 transition-all ${
                form.estado === "rechazado"
                  ? "bg-gray-50 border-gray-200 opacity-70"
                  : "bg-[#F8FAFF] border-[#DDE6F5]"
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-blue uppercase tracking-widest">
                    💊 Medicamentos de la Receta {form.estado === "rechazado" && <span className="text-red-500 font-semibold normal-case">(Opcional al rechazar)</span>}
                  </p>
                  <span className="text-[11px] text-[#8FA3C4]">{formItems.length} ítem{formItems.length !== 1 ? "s" : ""}</span>
                </div>

                {form.estado === "rechazado" && (
                  <div className="bg-red-50/80 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-800 animate-fade-in">
                    <span className="text-base flex-shrink-0">ℹ️</span>
                    <p>
                      <b>Modo Rechazo activo:</b> No es necesario seleccionar medicamentos ni ingresar cantidades o posología. La solicitud se cerrará registrando únicamente el motivo indicado abajo.
                    </p>
                  </div>
                )}

                {formItems.map((item, idx) => {
                  const isItemExistente = !isSuperAdmin && Boolean(
                    (recetaObjetivo && (item.mesesDescontados ?? 0) > 0) ||
                    (recetaVinculada && idx < getItemsDeReceta(recetaVinculada).length)
                  );
                  const isRechazado = item.estadoItem === "rechazado";

                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-3 space-y-2.5 transition-all ${
                        isRechazado
                          ? "bg-red-50/40 border-red-300 shadow-sm"
                          : "bg-white border-[#DDE6F5]"
                      }`}
                    >
                      {/* Encabezado del ítem */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#5D7299] uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                          Medicamento {idx + 1}
                          {item.medicamento === "SOLICITUD_RECETA" && (
                            <span className="text-amber-600 normal-case font-semibold">— Solicitud sin med.</span>
                          )}
                          {isRechazado && (
                            <span className="text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-black normal-case">
                              ❌ Rechazado
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Toggle Rechazar Fármaco Individual (Solo médico y cuando la decisión general no es 'rechazado') */}
                          {isDoctorMode && form.estado !== "rechazado" && (
                            isRechazado ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, estadoItem: "autorizado" } : it));
                                }}
                                className="flex items-center gap-1 text-[11px] font-bold text-brand-blue hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors border border-brand-blue/30"
                                title="Reincorporar este fármaco para que sea despachado"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue" /> Reincorporar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, estadoItem: "rechazado", motivoRechazoItem: it.motivoRechazoItem || "No pertinente / Tratamiento no corresponde" } : it));
                                }}
                                className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors border border-red-200 hover:border-red-300"
                                title="Rechazar individualmente este fármaco dejando los otros vigentes"
                              >
                                <XCircle className="w-3.5 h-3.5 text-red-500" /> Rechazar fármaco
                              </button>
                            )
                          )}

                          {isItemExistente ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5D7299] bg-[#EFF3FB] border border-[#DDE6F5] px-2 py-0.5 rounded-lg">
                              <Lock className="w-3 h-3 text-[#8FA3C4]" /> Prescrito previamente
                            </span>
                          ) : formItems.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setFormItems(prev => prev.filter((_, i) => i !== idx));
                                setActiveComboIdx(null);
                              }}
                              className="flex items-center gap-1 text-[11px] text-[#8FA3C4] hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                              title="Eliminar este fármaco de la lista"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Bloque de motivo cuando el fármaco está rechazado individualmente */}
                      {isRechazado && (
                        <div className="bg-red-50/90 border border-red-200 rounded-xl p-3 space-y-2 animate-fade-in shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                              Fármaco No Autorizado Clínicamente — No se despachará en Farmacia
                            </p>
                            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                              No se despacha
                            </span>
                          </div>
                          <p className="text-[11px] text-red-700/90">
                            Indique el motivo clínico del rechazo (quedará registrado para farmacia y paciente):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {[
                              "No pertinente / Tratamiento no corresponde",
                              "Requiere control médico presencial",
                              "Receta ya emitida / Duplicada en AVIS",
                              "Faltan exámenes o parámetros alterados",
                              "Contraindicado clínicamente",
                            ].map((motivoRapido) => (
                              <button
                                key={motivoRapido}
                                type="button"
                                onClick={() => setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, motivoRechazoItem: motivoRapido } : it))}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all text-left ${
                                  item.motivoRechazoItem === motivoRapido
                                    ? "bg-red-600 text-white border-red-700 shadow-sm"
                                    : "bg-white text-red-700 border-red-200 hover:bg-red-100/60"
                                }`}
                              >
                                ✦ {motivoRapido}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Motivo o justificación clínica..."
                            value={item.motivoRechazoItem || ""}
                            onChange={(e) => setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, motivoRechazoItem: e.target.value } : it))}
                            className="w-full bg-white border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-900 placeholder-red-300 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
                          />
                        </div>
                      )}

                      {isItemExistente ? (
                        <div className={`space-y-2 ${isRechazado ? "opacity-60" : ""}`}>
                          <div>
                            <label className={labelClass}>Medicamento</label>
                            <div className={`${inputDisabledClass} font-semibold ${isRechazado ? "line-through text-red-700" : "text-brand-indigo"}`}>
                              {item.medicamento}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Cant. (Unid.)</label>
                              <div className={`${inputDisabledClass} text-center font-bold ${isRechazado ? "line-through text-red-400" : ""}`}>
                                {isRechazado ? 0 : item.cantidad}
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>Auto-Renovación</label>
                              <div className={`${inputDisabledClass} text-sm font-semibold`}>
                                {isRechazado ? "Cancelada" : item.autoRenovacion ? `${item.autoRenovacion} meses` : "Sin renovación"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={isRechazado ? "opacity-75 space-y-2.5" : "space-y-2.5"}>
                          {/* Aviso de solicitud genérica */}
                          {item.medicamento === "SOLICITUD_RECETA" && !isRechazado && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                              <span className="text-sm">📋</span>
                              <p className="text-xs text-amber-700 font-semibold">Asigne un medicamento del inventario</p>
                            </div>
                          )}

                          {/* Combobox de medicamento */}
                          <div className="relative">
                            <label className={labelClass}>Medicamento</label>
                            <input
                              disabled={isRechazado}
                              required={form.estado !== "rechazado" && !isRechazado && item.medicamento !== "SOLICITUD_RECETA"}
                              type="text"
                              placeholder={isRechazado ? "Fármaco no autorizado..." : form.estado === "rechazado" ? "No requerido al rechazar..." : "Buscar en el inventario..."}
                              value={item.medicamento === "SOLICITUD_RECETA" ? "" : item.medicamento}
                              onChange={(e) => {
                                setFormItems(prev => prev.map((it, i) =>
                                  i === idx ? { ...it, medicamento: e.target.value, codigoMedicamento: "" } : it
                                ));
                                setActiveComboIdx(idx);
                              }}
                              onFocus={() => { if (!isRechazado) setActiveComboIdx(idx); }}
                              className={`${inputClass} ${isRechazado ? "text-red-700 line-through bg-red-50/20 border-red-200" : "text-brand-indigo font-semibold placeholder-brand-indigo/30 focus:border-brand-indigo border-brand-indigo/30"}`}
                            />
                            {activeComboIdx === idx && !isRechazado && (
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
                                disabled={isRechazado}
                                required={form.estado !== "rechazado" && !isRechazado}
                                type="number"
                                step="any"
                                min={form.estado === "rechazado" || isRechazado ? undefined : "1"}
                                placeholder={isRechazado ? "0 (Rechazado)" : form.estado === "rechazado" ? "Opcional" : "Ej: 30"}
                                value={isRechazado ? "" : (item.cantidad > 0 ? item.cantidad : "")}
                                onChange={(e) => setFormItems(prev => prev.map((it, i) =>
                                  i === idx ? { ...it, cantidad: Number(e.target.value) } : it
                                ))}
                                className={`${inputClass} text-center font-bold ${isRechazado ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Auto-Renovación</label>
                              <select
                                disabled={isRechazado}
                                value={isRechazado ? 0 : (item.autoRenovacion ?? 0)}
                                onChange={(e) => setFormItems(prev => prev.map((it, i) =>
                                  i === idx ? { ...it, autoRenovacion: Number(e.target.value) } : it
                                ))}
                                className={`${inputClass} text-sm ${isRechazado ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
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
                              {calcOpenIdx === idx ? "Ocultar asistente de cálculo" : "✦ Asistente de cálculo matemático y posología"}
                            </button>
                            {calcOpenIdx === idx && (
                              <div className="mt-2.5 bg-gradient-to-br from-brand-blue/5 via-sky-50/40 to-indigo-50/30 border border-brand-blue/20 rounded-2xl p-3.5 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  <span className="text-[10px] font-bold text-brand-blue uppercase tracking-wider flex items-center gap-1">
                                    ✦ Calculadora de Posología
                                  </span>
                                  <span className="text-[10px] text-[#5D7299]">Dosis fraccionadas permitidas (ej: 0.25)</span>
                                </div>

                                {/* Fila de controles principales */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {/* 1. Dosis por toma */}
                                  <div className="space-y-1">
                                    <label className="block text-[11px] uppercase font-bold text-brand-blue">Dosis por toma</label>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="0.05"
                                        step="any"
                                        placeholder="0.25"
                                        value={calcDosis}
                                        onChange={(e) => {
                                          setCalcDosis(e.target.value);
                                          runCalculadora(e.target.value, calcHoras, calcDias, idx);
                                        }}
                                        className="w-full bg-white border border-brand-blue/30 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-brand-blue focus:border-brand-blue outline-none shadow-inner"
                                      />
                                      <span className="text-xs font-semibold text-[#5D7299]">comp.</span>
                                    </div>
                                    {/* Chips rápidos de dosis */}
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {[
                                        { label: "¼ (0.25)", val: "0.25" },
                                        { label: "½ (0.5)", val: "0.5" },
                                        { label: "¾ (0.75)", val: "0.75" },
                                        { label: "1", val: "1" },
                                        { label: "1½ (1.5)", val: "1.5" },
                                        { label: "2", val: "2" },
                                      ].map(chip => (
                                        <button
                                          key={chip.val}
                                          type="button"
                                          onClick={() => {
                                            setCalcDosis(chip.val);
                                            runCalculadora(chip.val, calcHoras, calcDias, idx);
                                          }}
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                            calcDosis === chip.val
                                              ? "bg-brand-blue text-white border-brand-blue shadow-sm scale-105"
                                              : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-brand-blue/10 hover:text-brand-blue"
                                          }`}
                                        >
                                          {chip.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 2. Frecuencia en horas */}
                                  <div className="space-y-1">
                                    <label className="block text-[11px] uppercase font-bold text-brand-blue">Frecuencia (Horas)</label>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="24"
                                        value={calcHoras}
                                        onChange={(e) => {
                                          setCalcHoras(e.target.value);
                                          runCalculadora(calcDosis, e.target.value, calcDias, idx);
                                        }}
                                        className="w-full bg-white border border-brand-blue/30 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-brand-blue focus:border-brand-blue outline-none shadow-inner"
                                      />
                                      <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                    </div>
                                    {/* Chips rápidos de horas */}
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {[
                                        { label: "24h (1x)", val: "24" },
                                        { label: "12h (2x)", val: "12" },
                                        { label: "8h (3x)", val: "8" },
                                        { label: "6h (4x)", val: "6" },
                                      ].map(chip => (
                                        <button
                                          key={chip.val}
                                          type="button"
                                          onClick={() => {
                                            setCalcHoras(chip.val);
                                            runCalculadora(calcDosis, chip.val, calcDias, idx);
                                          }}
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                            calcHoras === chip.val
                                              ? "bg-brand-blue text-white border-brand-blue shadow-sm scale-105"
                                              : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-brand-blue/10 hover:text-brand-blue"
                                          }`}
                                        >
                                          {chip.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 3. Días de tratamiento */}
                                  <div className="space-y-1">
                                    <label className="block text-[11px] uppercase font-bold text-brand-blue">Días de Tratamiento</label>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="30"
                                        value={calcDias}
                                        onChange={(e) => {
                                          setCalcDias(e.target.value);
                                          runCalculadora(calcDosis, calcHoras, e.target.value, idx);
                                        }}
                                        className="w-full bg-white border border-brand-blue/30 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-brand-blue focus:border-brand-blue outline-none shadow-inner"
                                      />
                                      <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                    </div>
                                    {/* Chips rápidos de días */}
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {[
                                        { label: "30d (1m)", val: "30" },
                                        { label: "60d (2m)", val: "60" },
                                        { label: "90d (3m)", val: "90" },
                                      ].map(chip => (
                                        <button
                                          key={chip.val}
                                          type="button"
                                          onClick={() => {
                                            setCalcDias(chip.val);
                                            runCalculadora(calcDosis, calcHoras, chip.val, idx);
                                          }}
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                            calcDias === chip.val
                                              ? "bg-brand-blue text-white border-brand-blue shadow-sm scale-105"
                                              : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-brand-blue/10 hover:text-brand-blue"
                                          }`}
                                        >
                                          {chip.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Barra de resultado y desglose */}
                                <div className="bg-white/90 border border-brand-blue/20 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                  <div className="text-xs text-[#5D7299]">
                                    <span className="font-semibold text-brand-blue">Cálculo:</span>{" "}
                                    {(24 / (parseFloat(calcHoras) || 24)).toFixed(1).replace(".0", "")} toma(s)/día × {calcDosis} comp. × {calcDias} días ={" "}
                                    <span className="font-bold text-[#0F1B35]">
                                      {((24 / (parseFloat(calcHoras) || 24)) * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0)).toFixed(2).replace(/\.?0+$/, "")} comp.
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <span className="text-[11px] font-bold text-brand-blue/80 uppercase">Total a despachar:</span>
                                    <span className="text-base font-black text-brand-blue bg-brand-blue/10 border border-brand-blue/30 rounded-lg px-3 py-0.5 shadow-sm">
                                      {Math.ceil((24 / (parseFloat(calcHoras) || 24)) * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0))} unid.
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Botón agregar ítem */}
                <button
                  type="button"
                  onClick={() => setFormItems(prev => [...prev, nuevoItemVacio()])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-brand-blue/30 text-brand-blue text-sm font-semibold hover:bg-brand-blue/5 hover:border-brand-blue/50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Agregar otro medicamento
                </button>

                {/* Banner informativo de Autorización Parcial */}
                {form.estado === "completado" && formItems.some(it => it.estadoItem === "rechazado") && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 animate-fade-in shadow-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Autorización Parcial configurada</p>
                      <p className="text-amber-800/90 text-[11px] mt-0.5">
                        Al confirmar, se autorizarán únicamente los fármacos activos. Los ítems marcados en rojo quedarán descartados con su motivo clínico sin despachar stock.
                      </p>
                    </div>
                  </div>
                )}
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
                  <input required type="text" placeholder="12345678-9" value={form.rut} maxLength={12}
                    onChange={(e) => setForm({ ...form, rut: formatRut(e.target.value) })} className={`${inputClass} font-mono`} />
                </div>
              </div>

              {bannerRecetasActivas}

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
                      required={form.estado !== "rechazado" && !esSolicitudGeneral}
                      type="text"
                      placeholder={form.estado === "rechazado" ? "No requerido al rechazar..." : "Buscar en el inventario..."}
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
                  required={form.estado !== "rechazado"}
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
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-700 uppercase tracking-widest flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-600" /> Motivo del Rechazo *
                </p>
                <span className="text-[11px] text-red-600 font-semibold bg-red-100/80 px-2 py-0.5 rounded-full">
                  Requerido
                </span>
              </div>
              <p className="text-xs text-red-700/80">
                Seleccione un motivo rápido o redacte la justificación clínica. Esta nota quedará en el historial del paciente:
              </p>
              {/* Chips rápidos de motivos frecuentes */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "No pertinente / Tratamiento no corresponde",
                  "Requiere control médico presencial",
                  "Receta ya emitida / Duplicada en AVIS",
                  "Faltan exámenes de control recientes",
                  "Paciente derivado a especialista o extra-sistema",
                ].map((motivoRapido) => (
                  <button
                    key={motivoRapido}
                    type="button"
                    onClick={() => setForm({ ...form, motivoRechazo: motivoRapido })}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all text-left ${
                      form.motivoRechazo === motivoRapido
                        ? "bg-red-600 text-white border-red-700 shadow-sm"
                        : "bg-white text-red-700 border-red-200 hover:bg-red-100/60 hover:border-red-300"
                    }`}
                  >
                    ✦ {motivoRapido}
                  </button>
                ))}
              </div>
              <textarea
                required
                disabled={!puedeEditarDatos && !soloAutorizacion}
                rows={3}
                placeholder="Escriba o ajuste el motivo del rechazo clínico..."
                value={form.motivoRechazo ?? ""}
                onChange={(e) => setForm({ ...form, motivoRechazo: e.target.value })}
                className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 placeholder-red-300 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none transition-all disabled:opacity-50"
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
              isSuperAdmin
                ? "bg-purple-600 hover:bg-purple-700 shadow-purple"
                : isDoctorMode
                ? "bg-brand-blue hover:bg-brand-blue-dark shadow-blue"
                : "bg-brand-purple hover:bg-brand-purple-dark shadow-purple"
            }`}>
            <Save className="w-4 h-4" />
            {loading
              ? "Guardando..."
              : isSuperAdmin && receta
              ? "Guardar Corrección (Super Admin)"
              : isDoctorMode && !receta
              ? `Emitir Receta ${currentTipoLabel}`
              : isDoctorMode
              ? (form.estado === "completado"
                  ? (formItems.some(it => it.estadoItem === "rechazado")
                      ? `Autorizar Receta (Parcial)`
                      : `Autorizar Receta ${currentTipoLabel}`)
                  : form.estado === "rechazado" ? "Confirmar Rechazo" : "Confirmar Decisión")
              : "Guardar Registro"}
          </button>
        </div>

      </div>

      {auditoriaOpen && recetaObjetivo?.id && (
        <AuditoriaDrawer
          recetaId={recetaObjetivo.id}
          collectionName={getCollectionForReceta(recetaObjetivo, formTipo || tipo)}
          paciente={form.nombrePaciente || recetaObjetivo.nombrePaciente}
          onClose={() => setAuditoriaOpen(false)}
        />
      )}
    </div>
  );
}
