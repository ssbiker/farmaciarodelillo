import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { decryptRecetaFields } from "../lib/crypto";
import type { Receta, FarmaciaUser, FarmaciaConfig } from "../types";
import { Pill, Stethoscope, AlertCircle, Trash2, TrendingUp, LayoutDashboard, Package } from "lucide-react";
import { RecetaList } from "./RecetaList";
import { PapeleraModal } from "./PapeleraModal";
import { VistaMedico } from "./VistaMedico";
import { EstadisticasAdmin } from "./EstadisticasAdmin";
import { InventarioAdmin } from "./InventarioAdmin";

const DEFAULT_CONFIG: FarmaciaConfig = { diasAlertaRoja: 5, diasAlertaAmarilla: 3 };

type TabState = "controladas_A" | "controladas_B" | "cronicas_A" | "cronicas_B" | "controladas_CECOSF" | "cronicas_CECOSF" | "mi_panel" | "estadisticas" | "inventario";

export function Dashboard({
  farmaciaUser,
  isAdmin,
  isMedico,
  isFuncionario,
}: {
  farmaciaUser: FarmaciaUser;
  isAdmin: boolean;
  isMedico: boolean;
  isFuncionario: boolean;
}) {
  const [recetasControladas, setRecetasControladas] = useState<Receta[]>([]);
  const [recetasCronicas, setRecetasCronicas] = useState<Receta[]>([]);
  const [config, setConfig] = useState<FarmaciaConfig>(DEFAULT_CONFIG);
  const [medicos, setMedicos] = useState<FarmaciaUser[]>([]);
  const [activeTab, setActiveTab] = useState<TabState>(
    // Médico puro: empieza en su panel personal
    isMedico && !isAdmin ? "mi_panel" : "controladas_A"
  );
  const [loading, setLoading] = useState(true);
  const [papeleraOpen, setPapeleraOpen] = useState(false);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "farmacia_config", "settings"), async (snap) => {
      if (snap.exists()) setConfig(snap.data() as FarmaciaConfig);
      else { await setDoc(doc(db, "farmacia_config", "settings"), DEFAULT_CONFIG); setConfig(DEFAULT_CONFIG); }
    });

    getDocs(collection(db, "users")).then((snap) => {
      setMedicos(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as FarmaciaUser))
          .filter((u) => u.role?.toLowerCase() === "medico" || u.isMedico === true)
      );
    });

    const qCtrl = query(collection(db, "recetas_controladas"), orderBy("fechaSolicitud", "desc"));
    const unsubCtrl = onSnapshot(qCtrl,
      (s) => setRecetasControladas(s.docs.map((d) => decryptRecetaFields({ id: d.id, ...d.data() } as Receta))),
      () => setRecetasControladas([])
    );

    const qCron = query(collection(db, "recetas_cronicas"), orderBy("fechaSolicitud", "desc"));
    const unsubCron = onSnapshot(qCron,
      (s) => { setRecetasCronicas(s.docs.map((d) => decryptRecetaFields({ id: d.id, ...d.data() } as Receta))); setLoading(false); },
      () => { setRecetasCronicas([]); setLoading(false); }
    );

    return () => { unsubConfig(); unsubCtrl(); unsubCron(); };
  }, []);

  const todasRecetas = [...recetasControladas, ...recetasCronicas];

  useEffect(() => {
    if (loading || todasRecetas.length === 0) return;

    // Procesar descuentos de auto-renovaciones automáticamente
    const procesarRenovaciones = async () => {
      const now = new Date();
      const renovables = todasRecetas.filter(r => 
        !r.eliminada && r.estado === "completado" && r.autoRenovacion && r.autoRenovacion > 0 
        && r.codigoMedicamento && r.cantidad
        && r.mesesDescontados && r.mesesDescontados >= 1 // Solo si el médico ya recetó
      );

      if (renovables.length === 0) return;

      import("firebase/firestore").then(({ doc, runTransaction }) => {
        for (const r of renovables) {
          const start = r.fechaSolicitud.toDate();
          let elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
          if (now.getDate() < start.getDate()) elapsedMonths--;
          
          const maxMonths = r.autoRenovacion! + 1; // 1 base + N renovaciones
          const currentMonth = Math.min(Math.max(1, elapsedMonths + 1), maxMonths);
          const localMeses = r.mesesDescontados || 1;

          if (currentMonth > localMeses) {
            const colName = r.tipo === "controlado" ? "recetas_controladas" : "recetas_cronicas";
            const recRef = doc(db, colName, r.id);
            const invRef = doc(db, "inventario", r.codigoMedicamento as string);
            
            // Transacción segura para evitar doble descuento si 2 usuarios abren la web a la vez
            runTransaction(db, async (transaction) => {
              const recDoc = await transaction.get(recRef);
              if (!recDoc.exists()) return;
              const currentMeses = recDoc.data().mesesDescontados || 1;
              if (currentMonth > currentMeses) {
                const diff = currentMonth - currentMeses;
                transaction.update(recRef, { mesesDescontados: currentMonth });
                const invDoc = await transaction.get(invRef);
                if (invDoc.exists()) {
                  transaction.update(invRef, { stock: invDoc.data().stock - (r.cantidad! * diff) });
                }
              }
            }).catch(e => console.error("Error en transacción de renovación:", e));
          }
        }
      });
    };
    
    procesarRenovaciones();
  }, [loading]); // Solo corre al terminar de cargar los datos

  const getFiltered = (): Receta[] => {
    if (activeTab === "controladas_A") return recetasControladas.filter((r) => r.sector === "A");
    if (activeTab === "controladas_B") return recetasControladas.filter((r) => r.sector === "B");
    if (activeTab === "controladas_CECOSF") return recetasControladas.filter((r) => r.sector === "CECOSF");
    if (activeTab === "cronicas_A") return recetasCronicas.filter((r) => r.sector === "A");
    if (activeTab === "cronicas_CECOSF") return recetasCronicas.filter((r) => r.sector === "CECOSF");
    return recetasCronicas.filter((r) => r.sector === "B");
  };

  const criticalCount = (list: Receta[]) => {
    const nowDate = new Date();
    const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    
    return list.filter((r) => {
      if (r.estado !== "pendiente" || r.eliminada) return false;
      if (r.fechaLimite) {
        const d = r.fechaLimite.toDate();
        const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        return target < today;
      }
      
      const d2 = r.fechaSolicitud.toDate();
      const start = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
      const days = Math.round((today - start) / 86400000);
      return days >= config.diasAlertaRoja;
    }).length;
  };

  const cA = criticalCount(recetasControladas.filter((r) => r.sector === "A"));
  const cB = criticalCount(recetasControladas.filter((r) => r.sector === "B"));
  const crA = criticalCount(recetasCronicas.filter((r) => r.sector === "A"));
  const crB = criticalCount(recetasCronicas.filter((r) => r.sector === "B"));
  const cCECOSF = criticalCount(recetasControladas.filter((r) => r.sector === "CECOSF"));
  const crCECOSF = criticalCount(recetasCronicas.filter((r) => r.sector === "CECOSF"));
  const totalCritical = cA + cB + crA + crB + cCECOSF + crCECOSF;

  // Urgentes en el panel personal del médico
  const misPendientesUrgentes = isMedico ? todasRecetas.filter((r) => {
    if (r.eliminada || r.estado !== "pendiente") return false;
    const esMio = r.medicoUid === farmaciaUser.id;
    
    const nowDate = new Date();
    const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    
    let esUrgente = false;
    if (r.fechaLimite) {
      const d = r.fechaLimite.toDate();
      const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      esUrgente = target < today;
    } else {
      const d2 = r.fechaSolicitud.toDate();
      const start = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
      const days = Math.round((today - start) / 86400000);
      esUrgente = days >= config.diasAlertaRoja;
    }
    
    return esMio && esUrgente;
  }).length : 0;

  const totalPapelera =
    recetasControladas.filter((r) => r.eliminada).length +
    recetasCronicas.filter((r) => r.eliminada).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-[#7B90B5] text-sm">Cargando tablero...</p>
      </div>
    );
  }

  // ── Tab genérico para recetas ─────────────────────────────────────────────
  const RecetaTab = ({ label, id, icon: Icon, count }: { label: string; id: TabState; icon: React.ElementType; count: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
        activeTab === id
          ? "tab-active-blue"
          : "text-[#7B90B5] hover:bg-[#EBF4FF] hover:text-[#1A55CC]"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  // ── Tab especial (Mi Panel / Estadísticas) ───────────────────────────────
  const SpecialTab = ({ label, id, icon: Icon, accentClass, count }: {
    label: string; id: TabState; icon: React.ElementType; accentClass: string; count?: number
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap border ${
        activeTab === id
          ? accentClass
          : "text-[#7B90B5] border-[#DDE6F5] bg-white hover:bg-[#EBF4FF] hover:text-[#1A55CC] hover:border-[#93C5FD]"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {count != null && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  const isRecetaTab = ["controladas_A", "controladas_B", "cronicas_A", "cronicas_B", "controladas_CECOSF", "cronicas_CECOSF"].includes(activeTab);

  return (
    <div className="space-y-5">
      {/* Banner alertas críticas */}
      {totalCritical > 0 && (
        <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="bg-red-500/20 p-2.5 rounded-xl flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <div>
            <p className="font-bold text-red-700 text-sm">
              {totalCritical} solicitud{totalCritical > 1 ? "es" : ""} con tiempo vencido
            </p>
            <p className="text-xs text-red-500">
              Llevan más de {config.diasAlertaRoja} días sin atención. Requieren acción inmediata.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 w-full">
        {/* Tabs de recetas — contenedor único con scroll horizontal */}
        <div className="flex gap-1 overflow-x-auto bg-white border border-[#DDE6F5] shadow-sm p-1 rounded-2xl lg:rounded-full w-full lg:w-auto scrollbar-hide">
          <RecetaTab label="Ctrl A" id="controladas_A" icon={Pill} count={cA} />
          <RecetaTab label="Ctrl B" id="controladas_B" icon={Pill} count={cB} />
          <RecetaTab label="Ctrl CECOSF" id="controladas_CECOSF" icon={Pill} count={cCECOSF} />
          
          <div className="w-px bg-[#DDE6F5] mx-1 my-1 hidden sm:block" />
          
          <RecetaTab label="Crón A" id="cronicas_A" icon={Stethoscope} count={crA} />
          <RecetaTab label="Crón B" id="cronicas_B" icon={Stethoscope} count={crB} />
          <RecetaTab label="Crón CECOSF" id="cronicas_CECOSF" icon={Stethoscope} count={crCECOSF} />
        </div>

        {/* Tabs especiales */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {/* Panel personal del médico */}
          {isMedico && (
            <SpecialTab
              label="Mi Panel"
              id="mi_panel"
              icon={LayoutDashboard}
              accentClass="tab-active-cyan border-transparent"
              count={misPendientesUrgentes}
            />
          )}

          {/* Inventario — solo admin */}
          {isAdmin && (
            <SpecialTab
              label="Inventario (Stock)"
              id="inventario"
              icon={Package}
              accentClass="tab-active-purple border-transparent"
            />
          )}

          {/* Estadísticas — solo admin */}
          {isAdmin && (
            <SpecialTab
              label="Estadísticas"
              id="estadisticas"
              icon={TrendingUp}
              accentClass="tab-active-purple border-transparent"
            />
          )}

          {/* Papelera — solo admin */}
          {isAdmin && (
            <button
              onClick={() => setPapeleraOpen(true)}
              className="relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 whitespace-nowrap bg-white border-[#DDE6F5] text-[#7B90B5] hover:text-red-500 hover:border-red-300 hover:bg-red-50"
              title="Papelera de recetas eliminadas"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Papelera</span>
              {totalPapelera > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full">
                  {totalPapelera}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Contenido según tab */}
      {isRecetaTab && (
        <RecetaList
          recetas={getFiltered()}
          config={config}
          medicos={medicos}
          isAdmin={isAdmin}
          isMedico={isMedico}
          isFuncionario={isFuncionario}
          farmaciaUser={farmaciaUser}
          activeTab={activeTab}
        />
      )}

      {activeTab === "mi_panel" && (
        <VistaMedico
          farmaciaUser={farmaciaUser}
          todasRecetas={todasRecetas}
          config={config}
          medicos={medicos}
          isAdmin={isAdmin}
          isMedico={isMedico}
          isFuncionario={isFuncionario}
        />
      )}

      {activeTab === "estadisticas" && isAdmin && (
        <EstadisticasAdmin
          todasRecetas={todasRecetas}
          medicos={medicos}
          config={config}
        />
      )}

      {activeTab === "inventario" && isAdmin && (
        <InventarioAdmin farmaciaUser={farmaciaUser} />
      )}

      {/* Papelera modal */}
      {papeleraOpen && (
        <PapeleraModal farmaciaUser={farmaciaUser} onClose={() => setPapeleraOpen(false)} />
      )}
    </div>
  );
}
