import { useState, useEffect, useRef } from "react";
import { X, Save, AlertCircle, CheckCircle2, XCircle, Lock, Clock, Calendar, Plus, Trash2, History } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc, Timestamp, getDoc } from "firebase/firestore";
import { registrarAccion, detectarCambios } from "../lib/auditoria";
import { AuditoriaDrawer } from "./AuditoriaDrawer";
import { encryptRecetaFields } from "../lib/crypto";
import { sincronizarRecetaPublica } from "../lib/recetaPublica";
import type { Receta, FarmaciaUser, ItemReceta } from "../types";
import { getItemsDeReceta, nuevoItemVacio, isRecetaVigente, formatRut, validarRut, PACK_CRONICOS_NOMBRE, PACK_CRONICOS_CODIGO, esPackCronicos } from "../lib/recetaHelpers";
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
    emisorReceta: "",
    emisorUid: "",
    fechaEmisionManual: "",
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
  const esRecetaCronica = formTipo === "cronicas" || tipo === "cronicas" || recetaObjetivo?.tipo === "cronico";

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
        emisorReceta: receta.emisorReceta || receta.medicoReceta || "",
        emisorUid: receta.emisorUid || receta.medicoUid || "",
        fechaEmisionManual: tsToDateStr(receta.fechaReceta) || new Date().toISOString().split("T")[0],
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
        emisorReceta: isDoctorMode ? farmaciaUser.name : "",
        emisorUid: isDoctorMode ? farmaciaUser.id : "",
        fechaEmisionManual: new Date().toISOString().split("T")[0],
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
  type FormatoDosis = "comp" | "puff" | "amp" | "gotas" | "ml" | "crema" | "ovulo" | "unid";
  const [calcOpenIdx, setCalcOpenIdx] = useState<number | null>(null);
  const [calcTipo, setCalcTipo] = useState<FormatoDosis>("comp");
  const [calcDosis, setCalcDosis] = useState("1");
  const [calcHoras, setCalcHoras] = useState("24");
  const [calcDias, setCalcDias] = useState("30");
  const [calcFrascoTamano, setCalcFrascoTamano] = useState("10"); // ml o capacidad según presentación

  const runCalculadora = (
    d: string,
    h: string,
    days: string,
    tipo: FormatoDosis = calcTipo,
    frascoTamanoStr: string = calcFrascoTamano,
    targetIdx: number = 0
  ) => {
    const dosis = parseFloat(d) || 0;
    const horas = parseFloat(h) || 24;
    const dias = parseFloat(days) || 0;
    const tomas = 24 / (horas > 0 ? horas : 24);
    let total = 0;

    if (tipo === "comp") {
      total = Math.ceil(tomas * dosis * dias);
    } else if (tipo === "puff") {
      const totalPuffs = tomas * dosis * dias;
      const dosisPorInhalador = parseFloat(frascoTamanoStr) || 200;
      total = Math.ceil(totalPuffs / (dosisPorInhalador > 0 ? dosisPorInhalador : 200));
      total = Math.max(1, total);
    } else if (tipo === "amp") {
      total = Math.ceil(tomas * dosis * dias);
      total = Math.max(1, total);
    } else if (tipo === "gotas") {
      const totalGotas = tomas * dosis * dias;
      const frascoMl = parseFloat(frascoTamanoStr) || 10;
      const gotasPorFrasco = frascoMl * 20; // 1 ml ≈ 20 gotas estándar
      total = Math.ceil(totalGotas / (gotasPorFrasco > 0 ? gotasPorFrasco : 200));
      total = Math.max(1, total);
    } else if (tipo === "ml") {
      const totalMl = tomas * dosis * dias;
      const mlPorFrasco = parseFloat(frascoTamanoStr) || 100;
      total = Math.ceil(totalMl / (mlPorFrasco > 0 ? mlPorFrasco : 100));
      total = Math.max(1, total);
    } else if (tipo === "crema") {
      // Para cremas/ungüentos: dosis representa directamente los tubos a despachar
      total = Math.max(1, Math.round(dosis));
    } else if (tipo === "ovulo") {
      total = Math.ceil(tomas * dosis * dias);
      total = Math.max(1, total);
    } else if (tipo === "unid") {
      total = Math.ceil(tomas * dosis * dias);
      total = Math.max(1, total);
    }

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
            const itemsValidos = formItems.filter(it => it.estadoItem !== "rechazado" && it.medicamento && it.medicamento !== "SOLICITUD_RECETA" && (it.codigoMedicamento === PACK_CRONICOS_CODIGO || (it.cantidad ?? 0) > 0));
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
              ? (form.medicoReceta || farmaciaUser.name)
              : recetaObjetivo.medicoReceta,
            medicoUid: form.estado !== "pendiente"
              ? (form.medicoUid || farmaciaUser.id)
              : recetaObjetivo.medicoUid,
            emisorReceta: form.emisorReceta || form.medicoReceta || farmaciaUser.name,
            emisorUid: form.emisorUid || form.medicoUid || farmaciaUser.id,
            fechaReceta: form.estado === "completado"
              ? (form.fechaEmisionManual ? Timestamp.fromDate(new Date(form.fechaEmisionManual + "T12:00:00")) : (recetaObjetivo.fechaReceta ?? now))
              : null,
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

              // Pack Crónicos: nunca tocar inventario
              if (newIt.codigoMedicamento === PACK_CRONICOS_CODIGO) {
                return { ...newIt, mesesDescontados: 0 };
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
          const itemsValidos = formItems.filter(it => it.estadoItem !== "rechazado" && (it.codigoMedicamento === PACK_CRONICOS_CODIGO || (it.codigoMedicamento && it.cantidad > 0)));
          if (itemsValidos.length === 0) {
            alert("Por favor agregue al menos un medicamento válido del inventario con su cantidad que no esté rechazado.");
            setLoading(false);
            return;
          }

          const itemsConMeses: ItemReceta[] = formItems.map((it) => ({
            ...it,
            mesesDescontados: (form.estado === "completado" && it.estadoItem !== "rechazado" && it.codigoMedicamento && it.codigoMedicamento !== PACK_CRONICOS_CODIGO && it.cantidad > 0) ? 1 : 0,
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
            emisorReceta: form.emisorReceta || farmaciaUser.name,
            emisorUid: form.emisorUid || farmaciaUser.id,
            fechaLimite: dateStrToTs(form.fechaLimite),
            autoRenovacion: primerItem.autoRenovacion ?? 0,
            motivoRechazo: "",
            sector: targetSector,
            tipo: targetTipo,
            fechaSolicitud: now,
            fechaReceta: form.fechaEmisionManual ? Timestamp.fromDate(new Date(form.fechaEmisionManual + "T12:00:00")) : now,
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

          // Descontar stock en inventario para cada medicamento prescrito (solo los no rechazados y no Pack)
          const { increment, updateDoc: uDoc, doc: fDoc } = await import("firebase/firestore");
          for (const it of itemsConMeses) {
            if (it.estadoItem !== "rechazado" && it.codigoMedicamento && it.codigoMedicamento !== PACK_CRONICOS_CODIGO && it.cantidad > 0) {
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
          emisorReceta: form.emisorReceta || form.medicoReceta,
          emisorUid: form.emisorUid || form.medicoUid,
          actualizadoEn: now,
          fechaReceta: form.estado === "completado"
            ? (form.fechaEmisionManual ? Timestamp.fromDate(new Date(form.fechaEmisionManual + "T12:00:00")) : (receta?.fechaReceta ?? now))
            : null,
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
          if (payload.estado === "rechazado" && dataAntes.estado !== "rechazado" && payload.codigoMedicamento && payload.codigoMedicamento !== PACK_CRONICOS_CODIGO && payload.cantidad) {
            import("firebase/firestore").then(({ increment }) => {
              updateDoc(doc(db, "inventario", payload.codigoMedicamento as string), {
                stock: increment(payload.cantidad as number)
              }).catch(e => console.error("Error devolviendo stock:", e));
            });
          }
          // Si era rechazado y ahora vuelve a pendiente/completado, volvemos a descontar
          if (dataAntes.estado === "rechazado" && payload.estado !== "rechazado" && payload.codigoMedicamento && payload.codigoMedicamento !== PACK_CRONICOS_CODIGO && payload.cantidad) {
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
                if (oldCodigo && oldCodigo !== PACK_CRONICOS_CODIGO && oldCantidad > 0) {
                  updateDoc(doc(db, "inventario", oldCodigo), { stock: increment(oldCantidad) }).catch(e => console.error(e));
                }
                if (payload.codigoMedicamento && payload.codigoMedicamento !== PACK_CRONICOS_CODIGO && (payload.cantidad ?? 0) > 0) {
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
              despues: payload.codigoMedicamento === PACK_CRONICOS_CODIGO
                ? "📦 Pack Crónicos (Tratamiento AVIS)"
                : payload.medicamento && payload.medicamento !== "SOLICITUD_RECETA"
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
                  {isSuperAdmin || isDoctorMode || puedeAutorizar || !receta ? (
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-brand-blue uppercase tracking-widest">
                      💊 Medicamentos de la Receta {form.estado === "rechazado" && <span className="text-red-500 font-semibold normal-case">(Opcional al rechazar)</span>}
                    </p>
                    <span className="text-[11px] text-[#8FA3C4]">({formItems.length} ítem{formItems.length !== 1 ? "s" : ""})</span>
                  </div>

                  {esRecetaCronica && form.estado !== "rechazado" && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentRenovacion = formItems[0]?.autoRenovacion ?? (form.autoRenovacion || 0);
                        setFormItems([{
                          medicamento: PACK_CRONICOS_NOMBRE,
                          codigoMedicamento: PACK_CRONICOS_CODIGO,
                          cantidad: 1,
                          autoRenovacion: currentRenovacion,
                          mesesDescontados: 0,
                        }]);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm hover:shadow transition-all transform active:scale-95"
                      title="Cargar automáticamente Pack Crónicos (Tratamiento AVIS)"
                    >
                      <span>⚡ Pack Crónicos (Tratamiento AVIS)</span>
                    </button>
                  )}
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
                  const isPack = esPackCronicos(item);

                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-3 space-y-2.5 transition-all ${
                        isRechazado
                          ? "bg-red-50/40 border-red-300 shadow-sm"
                          : isPack
                          ? "bg-emerald-50/20 border-emerald-200 shadow-sm"
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
                          {isPack && (
                            <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black normal-case">
                              📦 Pack Crónicos (AVIS)
                            </span>
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
                          ) : isPack ? (
                            <button
                              type="button"
                              onClick={() => {
                                setFormItems([nuevoItemVacio()]);
                                setActiveComboIdx(null);
                              }}
                              className="flex items-center gap-1 text-[11px] text-[#8FA3C4] hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                              title="Quitar Pack y usar medicamentos individuales"
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

                      {isPack ? (
                        <div className={`space-y-3 ${isRechazado ? "opacity-60" : ""}`}>
                          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-start gap-2.5">
                              <span className="text-2xl flex-shrink-0">📦</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                                    Pack Crónicos (Tratamiento AVIS)
                                  </p>
                                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                    Multifármaco Activo
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                                  Prescripción multifármaco vinculada a la <b>Ficha Clínica AVIS</b> activa del paciente. Farmacia despacha el conjunto de fármacos crónicos autorizados sin requerir desglose por fármaco ni posología individual en esta plataforma.
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-emerald-200/60 text-[10px] font-medium text-emerald-800">
                              <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">✓ No descuenta stock unitario</span>
                              <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">✓ Despacho en Farmacia según AVIS</span>
                              <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">✓ 1 Tratamiento mensual</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Cantidad Prescrita</label>
                              <div className={`${inputDisabledClass} font-semibold text-emerald-900 bg-emerald-50/50 border-emerald-200`}>
                                1 Tratamiento Mensual
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>Auto-Renovación Médica</label>
                              <select
                                disabled={isRechazado}
                                value={isRechazado ? 0 : (item.autoRenovacion ?? 0)}
                                onChange={(e) => setFormItems(prev => prev.map((it, i) =>
                                  i === idx ? { ...it, autoRenovacion: Number(e.target.value) } : it
                                ))}
                                className={`${inputClass} text-sm font-semibold text-emerald-900 border-emerald-300 focus:border-emerald-500`}
                              >
                                <option value={0}>Sin renovación (1 mes)</option>
                                <option value={1}>1 mes adicional</option>
                                <option value={2}>2 meses adicionales</option>
                                <option value={3}>3 meses adicionales</option>
                                <option value={4}>4 meses adicionales</option>
                                <option value={5}>5 meses adicionales</option>
                                <option value={6}>6 meses adicionales</option>
                              </select>
                            </div>
                          </div>

                          {!isItemExistente && (
                            <div className="flex justify-end pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormItems(prev => prev.map((it, i) => i === idx ? nuevoItemVacio() : it));
                                }}
                                className="text-[11px] text-[#5D7299] hover:text-red-600 underline transition-colors"
                              >
                                Cambiar a medicamento individual del inventario
                              </button>
                            </div>
                          )}
                        </div>
                      ) : isItemExistente ? (
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
                                  const itemMed = item.medicamento?.toLowerCase() || "";
                                  let detectedTipo: FormatoDosis = "comp";
                                  let initialDosis = "1";
                                  let initialFrasco = "10";
                                  let initialHoras = "24";
                                  let initialDias = "30";

                                  if (
                                    itemMed.includes("puff") ||
                                    itemMed.includes("aerosol") ||
                                    itemMed.includes("inhalad") ||
                                    itemMed.includes("salbutamol") ||
                                    itemMed.includes("budeson") ||
                                    itemMed.includes("salmeterol") ||
                                    itemMed.includes("fluticason") ||
                                    itemMed.includes("ipratropio")
                                  ) {
                                    detectedTipo = "puff";
                                    initialDosis = "2";
                                    initialHoras = "8";
                                    initialDias = "30";
                                    initialFrasco = "200";
                                  } else if (
                                    itemMed.includes("ampoll") ||
                                    itemMed.includes("inyect") ||
                                    itemMed.includes("diclofenaco") ||
                                    itemMed.includes("75mg/2ml") ||
                                    itemMed.includes("ketorolaco") ||
                                    itemMed.includes("neurobion") ||
                                    itemMed.includes("penicilin")
                                  ) {
                                    detectedTipo = "amp";
                                    initialDosis = "1";
                                    initialHoras = "24";
                                    initialDias = "3";
                                    initialFrasco = "1";
                                  } else if (
                                    itemMed.includes("crema") ||
                                    itemMed.includes("unguent") ||
                                    itemMed.includes("ungüent") ||
                                    itemMed.includes("pomada") ||
                                    itemMed.includes("gel") ||
                                    itemMed.includes("dermic") ||
                                    itemMed.includes("mupirocina") ||
                                    itemMed.includes("betametasona") ||
                                    (itemMed.includes("clotrimazol") && !itemMed.includes("ovulo") && !itemMed.includes("óvulo"))
                                  ) {
                                    detectedTipo = "crema";
                                    initialDosis = "1";
                                    initialHoras = "12";
                                    initialDias = "14";
                                    initialFrasco = "1";
                                  } else if (
                                    itemMed.includes("ovulo") ||
                                    itemMed.includes("óvulo") ||
                                    itemMed.includes("supositorio")
                                  ) {
                                    detectedTipo = "ovulo";
                                    initialDosis = "1";
                                    initialHoras = "24";
                                    initialDias = "7";
                                    initialFrasco = "1";
                                  } else if (
                                    itemMed.includes("gotas") ||
                                    itemMed.includes("colirio") ||
                                    itemMed.includes("oftalm") ||
                                    itemMed.includes("lagrimas") ||
                                    itemMed.includes("lágrimas") ||
                                    itemMed.includes("tramadol")
                                  ) {
                                    detectedTipo = "gotas";
                                    initialDosis = itemMed.includes("lagrimas") || itemMed.includes("lágrimas") || itemMed.includes("colirio") ? "2" : "10";
                                    initialHoras = "8";
                                    initialDias = "15";
                                    initialFrasco = "10";
                                  } else if (
                                    itemMed.includes("suspens") ||
                                    itemMed.includes("jarabe") ||
                                    itemMed.includes("lactulosa") ||
                                    itemMed.includes("solucion") ||
                                    itemMed.includes("solución") ||
                                    itemMed.includes("oral")
                                  ) {
                                    detectedTipo = "ml";
                                    initialDosis = itemMed.includes("lactulosa") ? "10" : "5";
                                    initialHoras = "12";
                                    initialDias = "30";
                                    initialFrasco = itemMed.includes("lactulosa") ? "200" : "100";
                                  } else if (
                                    itemMed.includes("insulina") ||
                                    itemMed.includes("glargina") ||
                                    itemMed.includes("nph") ||
                                    itemMed.includes("cristalina") ||
                                    itemMed.includes("lispro") ||
                                    itemMed.includes("aspart") ||
                                    itemMed.includes("detemir") ||
                                    itemMed.includes("degludec") ||
                                    itemMed.includes("jeringa") ||
                                    itemMed.includes("lanceta") ||
                                    itemMed.includes("aguja")
                                  ) {
                                    detectedTipo = "unid";
                                    initialDosis = itemMed.includes("jeringa") ? "1" : "20";
                                    initialHoras = "24";
                                    initialDias = "30";
                                    initialFrasco = "1";
                                  } else {
                                    detectedTipo = "comp";
                                    initialDosis = "1";
                                    initialHoras = "24";
                                    initialDias = "30";
                                    initialFrasco = "1";
                                  }

                                  setCalcTipo(detectedTipo);
                                  setCalcDosis(initialDosis);
                                  setCalcHoras(initialHoras);
                                  setCalcDias(initialDias);
                                  setCalcFrascoTamano(initialFrasco);
                                  runCalculadora(initialDosis, initialHoras, initialDias, detectedTipo, initialFrasco, idx);
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
                                    ✦ Calculadora de Posología Clínica
                                  </span>
                                  <span className="text-[10px] text-[#5D7299]">Comprimidos, Inhaladores, Inyectables, Gotas, Jarabes, Cremas y Óvulos</span>
                                </div>

                                {/* Selector de Formato: 8 presentaciones */}
                                <div className="flex items-center gap-1.5 p-1 bg-white/95 border border-brand-blue/20 rounded-xl overflow-x-auto shadow-inner">
                                  {[
                                    { id: "comp", label: "💊 Comprimidos", activeBg: "bg-brand-blue text-white shadow-sm" },
                                    { id: "unid", label: "💉 Unidades (Insulina)", activeBg: "bg-teal-700 text-white shadow-sm" },
                                    { id: "puff", label: "🫁 Inhalador (Puff)", activeBg: "bg-sky-700 text-white shadow-sm" },
                                    { id: "amp", label: "🩹 Inyectable (Amp.)", activeBg: "bg-emerald-700 text-white shadow-sm" },
                                    { id: "gotas", label: "💧 Gotas", activeBg: "bg-cyan-700 text-white shadow-sm" },
                                    { id: "ml", label: "🧪 Jarabe (ml)", activeBg: "bg-purple-700 text-white shadow-sm" },
                                    { id: "crema", label: "🧴 Crema / Tópico", activeBg: "bg-amber-700 text-white shadow-sm" },
                                    { id: "ovulo", label: "🔘 Óvulo / Supos.", activeBg: "bg-rose-700 text-white shadow-sm" },
                                  ].map(tab => {
                                    const isActive = calcTipo === tab.id;
                                    return (
                                      <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                          const newTipo = tab.id as FormatoDosis;
                                          let defDosis = "1";
                                          let defHoras = calcHoras;
                                          let defDias = calcDias;
                                          let defFrasco = "10";

                                          if (newTipo === "comp") {
                                            defDosis = "1";
                                            defFrasco = "1";
                                          } else if (newTipo === "puff") {
                                            defDosis = "2";
                                            defHoras = "8";
                                            defDias = "30";
                                            defFrasco = "200";
                                          } else if (newTipo === "amp") {
                                            defDosis = "1";
                                            defHoras = "24";
                                            defDias = "3";
                                            defFrasco = "1";
                                          } else if (newTipo === "gotas") {
                                            defDosis = "10";
                                            defHoras = "8";
                                            defDias = "15";
                                            defFrasco = "10";
                                          } else if (newTipo === "ml") {
                                            defDosis = "10";
                                            defHoras = "12";
                                            defDias = "30";
                                            defFrasco = "200";
                                          } else if (newTipo === "crema") {
                                            defDosis = "1";
                                            defHoras = "12";
                                            defDias = "14";
                                            defFrasco = "1";
                                          } else if (newTipo === "ovulo") {
                                            defDosis = "1";
                                            defHoras = "24";
                                            defDias = "7";
                                            defFrasco = "1";
                                          } else if (newTipo === "unid") {
                                            defDosis = "20";
                                            defHoras = "24";
                                            defDias = "30";
                                            defFrasco = "1";
                                          }

                                          setCalcTipo(newTipo);
                                          setCalcDosis(defDosis);
                                          setCalcHoras(defHoras);
                                          setCalcDias(defDias);
                                          setCalcFrascoTamano(defFrasco);
                                          runCalculadora(defDosis, defHoras, defDias, newTipo, defFrasco, idx);
                                        }}
                                        className={`flex-shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                          isActive
                                            ? tab.activeBg
                                            : "text-[#5D7299] hover:text-[#0F1B35] hover:bg-slate-100"
                                        }`}
                                      >
                                        <span>{tab.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Caso 1: Comprimidos */}
                                {calcTipo === "comp" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                            runCalculadora(e.target.value, calcHoras, calcDias, "comp", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-brand-blue/30 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-brand-blue focus:border-brand-blue outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">comp.</span>
                                      </div>
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
                                              runCalculadora(chip.val, calcHoras, calcDias, "comp", calcFrascoTamano, idx);
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
                                            runCalculadora(calcDosis, e.target.value, calcDias, "comp", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-brand-blue/30 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-brand-blue focus:border-brand-blue outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
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
                                              runCalculadora(calcDosis, chip.val, calcDias, "comp", calcFrascoTamano, idx);
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
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "comp", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-brand-blue/30 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-brand-blue focus:border-brand-blue outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
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
                                              runCalculadora(calcDosis, calcHoras, chip.val, "comp", calcFrascoTamano, idx);
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
                                )}

                                {/* Caso 2: Inhalador / Puff (Aerosoles) */}
                                {calcTipo === "puff" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-sky-800">Dosis por toma</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="2"
                                          value={calcDosis}
                                          onChange={(e) => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "puff", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-sky-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-sky-900 focus:border-sky-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">puffs</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 puff", val: "1" },
                                          { label: "2 puffs", val: "2" },
                                          { label: "3 puffs", val: "3" },
                                          { label: "4 puffs", val: "4" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "puff", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-sky-700 text-white border-sky-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-sky-50 hover:text-sky-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-sky-800">Frecuencia (Horas)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="8"
                                          value={calcHoras}
                                          onChange={(e) => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "puff", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-sky-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-sky-900 focus:border-sky-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "24h (1x)", val: "24" },
                                          { label: "12h (2x)", val: "12" },
                                          { label: "8h (3x)", val: "8" },
                                          { label: "6h (4x)", val: "6" },
                                          { label: "4h (6x)", val: "4" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcHoras(chip.val);
                                              runCalculadora(calcDosis, chip.val, calcDias, "puff", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-sky-700 text-white border-sky-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-sky-50 hover:text-sky-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-sky-800">Días de Tratamiento</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="30"
                                          value={calcDias}
                                          onChange={(e) => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "puff", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-sky-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-sky-900 focus:border-sky-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "7 días", val: "7" },
                                          { label: "15 días", val: "15" },
                                          { label: "30d (1m)", val: "30" },
                                          { label: "60d (2m)", val: "60" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "puff", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-sky-700 text-white border-sky-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-sky-50 hover:text-sky-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-sky-800">Dosis por Inhalador</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="any"
                                          placeholder="200"
                                          value={calcFrascoTamano}
                                          onChange={(e) => {
                                            setCalcFrascoTamano(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, calcDias, "puff", e.target.value, idx);
                                          }}
                                          className="w-full bg-white border border-sky-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-sky-900 focus:border-sky-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">dosis</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "200 dosis (Salbutamol)", val: "200" },
                                          { label: "120 dosis", val: "120" },
                                          { label: "60 dosis", val: "60" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcFrascoTamano(chip.val);
                                              runCalculadora(calcDosis, calcHoras, calcDias, "puff", chip.val, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcFrascoTamano === chip.val
                                                ? "bg-sky-700 text-white border-sky-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-sky-50 hover:text-sky-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Caso 3: Inyectables / Ampollas */}
                                {calcTipo === "amp" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-emerald-800">Dosis por aplicación</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="1"
                                          value={calcDosis}
                                          onChange={(e) => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "amp", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-emerald-900 focus:border-emerald-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">ampollas</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 ampolla", val: "1" },
                                          { label: "2 ampollas", val: "2" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "amp", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-emerald-700 text-white border-emerald-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-emerald-50 hover:text-emerald-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-emerald-800">Frecuencia (Horas)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="24"
                                          value={calcHoras}
                                          onChange={(e) => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "amp", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-emerald-900 focus:border-emerald-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "Dosis única (24h)", val: "24" },
                                          { label: "Cada 24h (1x/día)", val: "24" },
                                          { label: "Cada 12h (2x/día)", val: "12" },
                                          { label: "Cada 8h (3x/día)", val: "8" },
                                        ].map(chip => (
                                          <button
                                            key={chip.label}
                                            type="button"
                                            onClick={() => {
                                              setCalcHoras(chip.val);
                                              runCalculadora(calcDosis, chip.val, calcDias, "amp", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-emerald-700 text-white border-emerald-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-emerald-50 hover:text-emerald-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-emerald-800">Días de Tratamiento</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="3"
                                          value={calcDias}
                                          onChange={(e) => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "amp", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-emerald-900 focus:border-emerald-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 día (única)", val: "1" },
                                          { label: "2 días", val: "2" },
                                          { label: "3 días", val: "3" },
                                          { label: "5 días", val: "5" },
                                          { label: "7 días", val: "7" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "amp", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-emerald-700 text-white border-emerald-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-emerald-50 hover:text-emerald-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Caso 4: Gotas */}
                                {calcTipo === "gotas" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-cyan-800">Dosis por toma</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="10"
                                          value={calcDosis}
                                          onChange={(e) => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "gotas", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-cyan-900 focus:border-cyan-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">gotas</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 gta", val: "1" },
                                          { label: "2 gtas", val: "2" },
                                          { label: "5 gtas", val: "5" },
                                          { label: "10 gtas", val: "10" },
                                          { label: "15 gtas", val: "15" },
                                          { label: "20 gtas", val: "20" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "gotas", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-cyan-700 text-white border-cyan-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-cyan-50 hover:text-cyan-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-cyan-800">Frecuencia (Horas)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="8"
                                          value={calcHoras}
                                          onChange={(e) => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "gotas", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-cyan-900 focus:border-cyan-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
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
                                              runCalculadora(calcDosis, chip.val, calcDias, "gotas", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-cyan-700 text-white border-cyan-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-cyan-50 hover:text-cyan-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-cyan-800">Días de Tratamiento</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="15"
                                          value={calcDias}
                                          onChange={(e) => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "gotas", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-cyan-900 focus:border-cyan-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "7 días", val: "7" },
                                          { label: "10 días", val: "10" },
                                          { label: "15 días", val: "15" },
                                          { label: "30 días", val: "30" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "gotas", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-cyan-700 text-white border-cyan-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-cyan-50 hover:text-cyan-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-cyan-800">Frasco (ml)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="any"
                                          placeholder="10"
                                          value={calcFrascoTamano}
                                          onChange={(e) => {
                                            setCalcFrascoTamano(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, calcDias, "gotas", e.target.value, idx);
                                          }}
                                          className="w-full bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-cyan-900 focus:border-cyan-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">ml</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "5ml (100g)", val: "5" },
                                          { label: "10ml (200g)", val: "10" },
                                          { label: "15ml (300g)", val: "15" },
                                          { label: "20ml (400g)", val: "20" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcFrascoTamano(chip.val);
                                              runCalculadora(calcDosis, calcHoras, calcDias, "gotas", chip.val, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcFrascoTamano === chip.val
                                                ? "bg-cyan-700 text-white border-cyan-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-cyan-50 hover:text-cyan-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Caso 5: Jarabes y Suspensiones (ml) */}
                                {calcTipo === "ml" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-purple-800">Dosis por toma</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="0.5"
                                          step="any"
                                          placeholder="10"
                                          value={calcDosis}
                                          onChange={(e) => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "ml", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-purple-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-purple-900 focus:border-purple-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">ml</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "2.5 ml", val: "2.5" },
                                          { label: "5 ml", val: "5" },
                                          { label: "7.5 ml", val: "7.5" },
                                          { label: "10 ml", val: "10" },
                                          { label: "15 ml", val: "15" },
                                          { label: "20 ml", val: "20" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "ml", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-purple-700 text-white border-purple-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-purple-50 hover:text-purple-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-purple-800">Frecuencia (Horas)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="12"
                                          value={calcHoras}
                                          onChange={(e) => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "ml", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-purple-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-purple-900 focus:border-purple-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
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
                                              runCalculadora(calcDosis, chip.val, calcDias, "ml", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-purple-700 text-white border-purple-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-purple-50 hover:text-purple-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-purple-800">Días de Tratamiento</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="30"
                                          value={calcDias}
                                          onChange={(e) => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "ml", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-purple-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-purple-900 focus:border-purple-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "5 días", val: "5" },
                                          { label: "7 días", val: "7" },
                                          { label: "10 días", val: "10" },
                                          { label: "15 días", val: "15" },
                                          { label: "30 días", val: "30" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "ml", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-purple-700 text-white border-purple-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-purple-50 hover:text-purple-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-purple-800">Frasco (ml)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="any"
                                          placeholder="100"
                                          value={calcFrascoTamano}
                                          onChange={(e) => {
                                            setCalcFrascoTamano(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, calcDias, "ml", e.target.value, idx);
                                          }}
                                          className="w-full bg-white border border-purple-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-purple-900 focus:border-purple-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">ml</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "60 ml", val: "60" },
                                          { label: "100 ml", val: "100" },
                                          { label: "120 ml", val: "120" },
                                          { label: "150 ml", val: "150" },
                                          { label: "200 ml", val: "200" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcFrascoTamano(chip.val);
                                              runCalculadora(calcDosis, calcHoras, calcDias, "ml", chip.val, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcFrascoTamano === chip.val
                                                ? "bg-purple-700 text-white border-purple-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-purple-50 hover:text-purple-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Caso 6: Cremas, Geles y Ungüentos */}
                                {calcTipo === "crema" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-amber-800">Tubos a Prescribir</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="1"
                                          value={calcDosis}
                                          onChange={(e) => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "crema", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-amber-900 focus:border-amber-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">tubos</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 tubo (local)", val: "1" },
                                          { label: "2 tubos (2-4 sem)", val: "2" },
                                          { label: "3 tubos (extenso)", val: "3" },
                                          { label: "4 tubos", val: "4" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "crema", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-amber-700 text-white border-amber-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-amber-50 hover:text-amber-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-amber-800">Frecuencia de Aplicación</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="12"
                                          value={calcHoras}
                                          onChange={(e) => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "crema", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-amber-900 focus:border-amber-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "Cada 24h (1x/día)", val: "24" },
                                          { label: "Cada 12h (2x/día)", val: "12" },
                                          { label: "Cada 8h (3x/día)", val: "8" },
                                        ].map(chip => (
                                          <button
                                            key={chip.label}
                                            type="button"
                                            onClick={() => {
                                              setCalcHoras(chip.val);
                                              runCalculadora(calcDosis, chip.val, calcDias, "crema", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-amber-700 text-white border-amber-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-amber-50 hover:text-amber-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-amber-800">Días de Tratamiento</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="14"
                                          value={calcDias}
                                          onChange={(e) => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "crema", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-amber-900 focus:border-amber-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "7 días (1 sem)", val: "7" },
                                          { label: "14 días (2 sem)", val: "14" },
                                          { label: "21 días", val: "21" },
                                          { label: "30 días (1 mes)", val: "30" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "crema", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-amber-700 text-white border-amber-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-amber-50 hover:text-amber-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Caso 7: Óvulos y Supositorios */}
                                {calcTipo === "ovulo" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-rose-800">Dosis por aplicación</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="1"
                                          value={calcDosis}
                                          onChange={(e) => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "ovulo", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-rose-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-rose-900 focus:border-rose-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">óvulo/sup.</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 unidad", val: "1" },
                                          { label: "2 unidades", val: "2" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "ovulo", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-rose-700 text-white border-rose-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-rose-50 hover:text-rose-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-rose-800">Frecuencia (Horas)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="24"
                                          value={calcHoras}
                                          onChange={(e) => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "ovulo", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-rose-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-rose-900 focus:border-rose-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs.</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "Cada 24h (noche / 1x)", val: "24" },
                                          { label: "Cada 12h (2x/día)", val: "12" },
                                          { label: "Cada 8h (3x/día)", val: "8" },
                                        ].map(chip => (
                                          <button
                                            key={chip.label}
                                            type="button"
                                            onClick={() => {
                                              setCalcHoras(chip.val);
                                              runCalculadora(calcDosis, chip.val, calcDias, "ovulo", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-rose-700 text-white border-rose-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-rose-50 hover:text-rose-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] uppercase font-bold text-rose-800">Días de Tratamiento</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          step="1"
                                          placeholder="7"
                                          value={calcDias}
                                          onChange={(e) => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "ovulo", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-rose-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-rose-900 focus:border-rose-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "3 días", val: "3" },
                                          { label: "6 días", val: "6" },
                                          { label: "7 días (estándar)", val: "7" },
                                          { label: "10 días", val: "10" },
                                          { label: "14 días", val: "14" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "ovulo", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-rose-700 text-white border-rose-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-rose-50 hover:text-rose-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Inputs para UNIDADES (Insulina, Jeringas, etc.) */}
                                {calcTipo === "unid" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {/* Dosis en Unidades */}
                                    <div className="space-y-1">
                                      <label className="text-xs font-bold text-teal-800 flex items-center justify-between">
                                        <span>💉 Dosis / Cantidad:</span>
                                        <span className="text-[10px] text-teal-700 font-semibold">UI o jeringas</span>
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          step="any"
                                          min="1"
                                          value={calcDosis}
                                          onChange={e => {
                                            setCalcDosis(e.target.value);
                                            runCalculadora(e.target.value, calcHoras, calcDias, "unid", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-teal-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-teal-900 focus:border-teal-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">unid/UI</span>
                                      </div>
                                      {/* Chips de dosis comunes */}
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "1 unid (jeringa)", val: "1" },
                                          { label: "10 UI", val: "10" },
                                          { label: "15 UI", val: "15" },
                                          { label: "20 UI", val: "20" },
                                          { label: "30 UI", val: "30" },
                                          { label: "40 UI", val: "40" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDosis(chip.val);
                                              runCalculadora(chip.val, calcHoras, calcDias, "unid", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDosis === chip.val
                                                ? "bg-teal-700 text-white border-teal-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-teal-50 hover:text-teal-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Frecuencia (horas) */}
                                    <div className="space-y-1">
                                      <label className="text-xs font-bold text-teal-800 flex items-center justify-between">
                                        <span>⏰ Cada cuántas horas:</span>
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          max="48"
                                          value={calcHoras}
                                          onChange={e => {
                                            setCalcHoras(e.target.value);
                                            runCalculadora(calcDosis, e.target.value, calcDias, "unid", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-teal-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-teal-900 focus:border-teal-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">hrs</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "c/24h (1x día)", val: "24" },
                                          { label: "c/12h (2x día)", val: "12" },
                                          { label: "c/8h (3x día)", val: "8" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcHoras(chip.val);
                                              runCalculadora(calcDosis, chip.val, calcDias, "unid", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcHoras === chip.val
                                                ? "bg-teal-700 text-white border-teal-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-teal-50 hover:text-teal-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Días de tratamiento */}
                                    <div className="space-y-1">
                                      <label className="text-xs font-bold text-teal-800 flex items-center justify-between">
                                        <span>📅 Días de tratamiento:</span>
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="1"
                                          value={calcDias}
                                          onChange={e => {
                                            setCalcDias(e.target.value);
                                            runCalculadora(calcDosis, calcHoras, e.target.value, "unid", calcFrascoTamano, idx);
                                          }}
                                          className="w-full bg-white border border-teal-300 rounded-xl px-2.5 py-1.5 text-sm text-center font-black text-teal-900 focus:border-teal-500 outline-none shadow-inner"
                                        />
                                        <span className="text-xs font-semibold text-[#5D7299]">días</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                          { label: "30 días (1 mes)", val: "30" },
                                          { label: "60 días (2 meses)", val: "60" },
                                          { label: "90 días (3 meses)", val: "90" },
                                        ].map(chip => (
                                          <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                              setCalcDias(chip.val);
                                              runCalculadora(calcDosis, calcHoras, chip.val, "unid", calcFrascoTamano, idx);
                                            }}
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border transition-all ${
                                              calcDias === chip.val
                                                ? "bg-teal-700 text-white border-teal-800 shadow-sm scale-105"
                                                : "bg-white text-[#3D5278] border-[#DDE6F5] hover:bg-teal-50 hover:text-teal-800"
                                            }`}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Barra de resultado y desglose */}
                                {calcTipo === "comp" && (
                                  <div className="bg-white/90 border border-brand-blue/20 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                    <div className="text-xs text-[#5D7299]">
                                      <span className="font-semibold text-brand-blue">Cálculo:</span>{" "}
                                      {(24 / (parseFloat(calcHoras) || 24)).toFixed(1).replace(".0", "")} toma(s)/día × {calcDosis} comp. × {calcDias} días ={" "}
                                      <span className="font-bold text-[#0F1B35]">
                                        {((24 / (parseFloat(calcHoras) || 24)) * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0)).toFixed(2).replace(/\.?0+$/, "")} comp.
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                      <span className="text-[11px] font-bold text-brand-blue/80 uppercase">Total a despachar:</span>
                                      <span className="text-base font-black text-brand-blue bg-brand-blue/10 border border-brand-blue/30 rounded-lg px-3 py-0.5 shadow-sm">
                                        {Math.ceil((24 / (parseFloat(calcHoras) || 24)) * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0))} comp.
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {calcTipo === "puff" && (() => {
                                  const tomas = 24 / (parseFloat(calcHoras) || 24);
                                  const totalPuffs = tomas * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0);
                                  const dosisPorInhalador = parseFloat(calcFrascoTamano) || 200;
                                  const inhaladores = Math.max(1, Math.ceil(totalPuffs / dosisPorInhalador));
                                  return (
                                    <div className="bg-white/90 border border-sky-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <div>
                                          <span className="font-semibold text-sky-800">Cálculo:</span>{" "}
                                          {tomas.toFixed(1).replace(".0", "")} toma(s)/día × {calcDosis} puff × {calcDias} días ={" "}
                                          <span className="font-bold text-[#0F1B35]">{Math.round(totalPuffs)} puffs en total</span>
                                        </div>
                                        <div className="text-[11px] text-[#5D7299] mt-0.5">
                                          Inhalador de {dosisPorInhalador} dosis: {Math.round(totalPuffs)} ÷ {dosisPorInhalador} = {(totalPuffs / dosisPorInhalador).toFixed(2)} frascos
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-sky-900 uppercase">Inhaladores a despachar:</span>
                                        <span className="text-base font-black text-sky-900 bg-sky-100 border border-sky-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {inhaladores} inhalador{inhaladores !== 1 ? "es" : ""}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {calcTipo === "amp" && (() => {
                                  const tomas = 24 / (parseFloat(calcHoras) || 24);
                                  const totalAmp = Math.max(1, Math.ceil(tomas * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0)));
                                  return (
                                    <div className="bg-white/90 border border-emerald-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <span className="font-semibold text-emerald-800">Cálculo:</span>{" "}
                                        {tomas.toFixed(1).replace(".0", "")} aplicación(es)/día × {calcDosis} ampolla × {calcDias} días ={" "}
                                        <span className="font-bold text-[#0F1B35]">{totalAmp} ampollas requeridas</span>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-emerald-900 uppercase">Ampollas a despachar:</span>
                                        <span className="text-base font-black text-emerald-900 bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {totalAmp} ampolla{totalAmp !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {calcTipo === "gotas" && (() => {
                                  const tomas = 24 / (parseFloat(calcHoras) || 24);
                                  const totalGotas = tomas * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0);
                                  const frascoMl = parseFloat(calcFrascoTamano) || 10;
                                  const gotasPorFrasco = frascoMl * 20;
                                  const frascos = Math.max(1, Math.ceil(totalGotas / gotasPorFrasco));
                                  return (
                                    <div className="bg-white/90 border border-cyan-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <div>
                                          <span className="font-semibold text-cyan-800">Cálculo:</span>{" "}
                                          {tomas.toFixed(1).replace(".0", "")} toma(s)/día × {calcDosis} gotas × {calcDias} días ={" "}
                                          <span className="font-bold text-[#0F1B35]">{Math.round(totalGotas)} gotas en total</span>
                                        </div>
                                        <div className="text-[11px] text-[#5D7299] mt-0.5">
                                          Frasco de {frascoMl} ml (~{gotasPorFrasco} gotas): {Math.round(totalGotas)} ÷ {gotasPorFrasco} = {(totalGotas / gotasPorFrasco).toFixed(2)} frascos
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-cyan-900 uppercase">Frascos a despachar:</span>
                                        <span className="text-base font-black text-cyan-900 bg-cyan-100 border border-cyan-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {frascos} frasco{frascos !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {calcTipo === "ml" && (() => {
                                  const tomas = 24 / (parseFloat(calcHoras) || 24);
                                  const totalMl = tomas * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0);
                                  const mlPorFrasco = parseFloat(calcFrascoTamano) || 100;
                                  const frascos = Math.max(1, Math.ceil(totalMl / mlPorFrasco));
                                  return (
                                    <div className="bg-white/90 border border-purple-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <div>
                                          <span className="font-semibold text-purple-800">Cálculo:</span>{" "}
                                          {tomas.toFixed(1).replace(".0", "")} toma(s)/día × {calcDosis} ml × {calcDias} días ={" "}
                                          <span className="font-bold text-[#0F1B35]">{totalMl.toFixed(1).replace(".0", "")} ml en total</span>
                                        </div>
                                        <div className="text-[11px] text-[#5D7299] mt-0.5">
                                          Frasco de {mlPorFrasco} ml: {totalMl.toFixed(1).replace(".0", "")} ÷ {mlPorFrasco} = {(totalMl / mlPorFrasco).toFixed(2)} frascos
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-purple-900 uppercase">Frascos a despachar:</span>
                                        <span className="text-base font-black text-purple-900 bg-purple-100 border border-purple-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {frascos} frasco{frascos !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {calcTipo === "crema" && (() => {
                                  const tubos = Math.max(1, Math.round(parseFloat(calcDosis) || 1));
                                  return (
                                    <div className="bg-white/90 border border-amber-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <div>
                                          <span className="font-semibold text-amber-800">Indicación Tópica:</span>{" "}
                                          Aplicar cada {calcHoras} hrs durante {calcDias} días.
                                        </div>
                                        <div className="text-[11px] text-[#5D7299] mt-0.5">
                                          {parseFloat(calcDias) > 14 ? "✓ Tratamiento > 14 días: suele requerir 2 o más tubos." : "✓ Tratamiento localizado ≤ 14 días: 1 tubo suficiente."}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-amber-900 uppercase">Tubos a despachar:</span>
                                        <span className="text-base font-black text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {tubos} tubo{tubos !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {calcTipo === "ovulo" && (() => {
                                  const tomas = 24 / (parseFloat(calcHoras) || 24);
                                  const totalOvulos = Math.max(1, Math.ceil(tomas * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0)));
                                  return (
                                    <div className="bg-white/90 border border-rose-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <span className="font-semibold text-rose-800">Cálculo:</span>{" "}
                                        {tomas.toFixed(1).replace(".0", "")} aplicación(es)/día × {calcDosis} unid. × {calcDias} días ={" "}
                                        <span className="font-bold text-[#0F1B35]">{totalOvulos} unidades en total</span>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-rose-900 uppercase">Unidades a despachar:</span>
                                        <span className="text-base font-black text-rose-900 bg-rose-100 border border-rose-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {totalOvulos} unid.
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {calcTipo === "unid" && (() => {
                                  const tomas = 24 / (parseFloat(calcHoras) || 24);
                                  const totalUnid = Math.max(1, Math.ceil(tomas * (parseFloat(calcDosis) || 0) * (parseFloat(calcDias) || 0)));
                                  return (
                                    <div className="bg-white/90 border border-teal-300/60 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                                      <div className="text-xs text-[#5D7299]">
                                        <div>
                                          <span className="font-semibold text-teal-800">Cálculo:</span>{" "}
                                          {tomas.toFixed(1).replace(".0", "")} aplicación(es)/día × {calcDosis} unid. × {calcDias} días ={" "}
                                          <span className="font-bold text-[#0F1B35]">{totalUnid} unidades en total</span>
                                        </div>
                                        <div className="text-[11px] text-[#5D7299] mt-0.5">
                                          {parseFloat(calcDosis) <= 2
                                            ? `✓ Jeringas de insulina: ${totalUnid} jeringas para el período.`
                                            : `✓ Si calcula Insulina UI: ${totalUnid} UI (~${Math.ceil(totalUnid / 300)} lápices de 300 UI o ~${Math.ceil(totalUnid / 1000)} frascos de 1000 UI).`}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                        <span className="text-[11px] font-bold text-teal-900 uppercase">Total a despachar:</span>
                                        <span className="text-base font-black text-teal-900 bg-teal-100 border border-teal-300 rounded-lg px-3 py-0.5 shadow-sm">
                                          {totalUnid} unid.
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}
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
                {/* Etiqueta + toggle solicitud genérica + toggle Pack Crónicos */}
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className={labelClass}>Medicamento Solicitado</label>
                  <div className="flex items-center gap-1.5">
                    {esRecetaCronica && (
                      <button
                        type="button"
                        onClick={() => {
                          const isCurrentlyPack = form.codigoMedicamento === PACK_CRONICOS_CODIGO;
                          if (isCurrentlyPack) {
                            setForm({ ...form, medicamento: "", codigoMedicamento: "", cantidad: "" });
                          } else {
                            setForm({ ...form, medicamento: PACK_CRONICOS_NOMBRE, codigoMedicamento: PACK_CRONICOS_CODIGO, cantidad: "1" });
                            setEsSolicitudGeneral(false);
                            setIsComboboxOpen(false);
                          }
                        }}
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          form.codigoMedicamento === PACK_CRONICOS_CODIGO
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        {form.codigoMedicamento === PACK_CRONICOS_CODIGO ? "✓ Pack Crónicos AVIS" : "📦 Pack Crónicos AVIS"}
                      </button>
                    )}
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
                </div>

                {/* Vista Pack Crónicos en modo funcionario */}
                {form.codigoMedicamento === PACK_CRONICOS_CODIGO ? (
                  <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">📦</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-900">Pack Crónicos (Tratamiento AVIS)</p>
                      <p className="text-xs text-emerald-800/80">Tratamiento multifármaco crónico según Ficha AVIS activa. El médico validará la vigencia y meses de renovación al autorizar.</p>
                    </div>
                  </div>
                ) : esSolicitudGeneral ? (
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

            {/* Configuración clínica avanzada: Emisor original y Fecha de emisión AVIS */}
            {(isDoctorMode || puedeAutorizar || isSuperAdmin) && (
              <div className="pt-3 border-t border-[#DDE6F5]/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Profesional emisor de la receta física/AVIS */}
                <div>
                  <label className={labelClass}>
                    <span>🩺 Profesional Emisor (Quien confeccionó la receta)</span>
                  </label>
                  <select
                    value={form.emisorUid || form.medicoUid || ""}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const selMed = medicos.find((m) => m.id === selId);
                      setForm((prev) => ({
                        ...prev,
                        emisorUid: selId,
                        emisorReceta: selMed ? selMed.name : "",
                      }));
                    }}
                    className={`${inputClass} appearance-none text-xs`}
                  >
                    <option value="">Mismo profesional autorizador / tratante</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.id === farmaciaUser?.id ? "(Usted)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#5D7299] mt-1">
                    Útil si usted está autorizando en plataforma una receta emitida por otro colega en box o AVIS.
                  </p>
                </div>

                {/* Fecha de emisión real de la receta (AVIS) */}
                <div>
                  <label className={labelClass}>
                    <span>📅 Fecha de Emisión en AVIS / Papel</span>
                  </label>
                  <input
                    type="date"
                    value={form.fechaEmisionManual || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, fechaEmisionManual: e.target.value }))}
                    className={`${inputClass} text-xs font-semibold`}
                  />
                  <p className="text-[11px] text-[#5D7299] mt-1">
                    Permite sincronizar con la fecha de retiro de AVIS para evitar falsos vencimientos.
                  </p>
                </div>
              </div>
            )}
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

          {/* Nota o indicación médica para recetas autorizadas (solicitado por Dra. Karina Burgos) */}
          {form.estado === "completado" && (isDoctorMode || puedeAutorizar || isSuperAdmin) && (
            <div className="bg-green-50/70 border border-green-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-green-800 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" /> Nota o Indicación para la Receta Autorizada (Opcional)
                </p>
                <span className="text-[11px] text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full">
                  Visible en Farmacia
                </span>
              </div>
              <p className="text-xs text-green-700/80">
                Instrucciones clínicas, pauta de retiro próximo o indicaciones que quedarán registradas en la receta:
              </p>
              {/* Chips rápidos de indicaciones comunes */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Retiro mensual según pauta AVIS",
                  "Control médico en 30 días",
                  "Control médico en 60 días",
                  "Traer exámenes de control al próximo retiro",
                  "Mantener tratamiento actual sin cambios",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, nota: prev.nota ? `${prev.nota}. ${chip}` : chip }))}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-green-300 bg-white text-green-800 hover:bg-green-100/70 transition-all text-left"
                  >
                    ✦ {chip}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                placeholder="Escriba aquí la indicación o nota para el retiro..."
                value={form.nota || ""}
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
                className="w-full bg-white border border-green-300 rounded-xl px-4 py-3 text-sm text-green-900 placeholder-green-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 resize-none transition-all"
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
