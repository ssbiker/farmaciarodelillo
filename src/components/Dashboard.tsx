import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { decryptRecetaFields } from "../lib/crypto";
import type { Receta, FarmaciaUser, FarmaciaConfig, ItemReceta } from "../types";
import { Pill, Stethoscope, Baby, AlertCircle, Trash2, TrendingUp, LayoutDashboard, Package } from "lucide-react";
import { RecetaList } from "./RecetaList";
import { PapeleraModal } from "./PapeleraModal";
import { VistaMedico } from "./VistaMedico";
import { EstadisticasAdmin } from "./EstadisticasAdmin";
import { InventarioAdmin } from "./InventarioAdmin";

const DEFAULT_CONFIG: FarmaciaConfig = { diasAlertaRoja: 5, diasAlertaAmarilla: 3 };

type TabState = "controladas_A" | "controladas_B" | "cronicas_A" | "cronicas_B" | "controladas_CECOSF" | "cronicas_CECOSF" | "maternales_A" | "maternales_B" | "maternales_CECOSF" | "mi_panel" | "estadisticas" | "inventario";

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
  const [recetasMaternales, setRecetasMaternales] = useState<Receta[]>([]);
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
      (s) => setRecetasControladas(s.docs.map((d) => decryptRecetaFields({ id: d.id, ...d.data(), tipo: "controlado" } as Receta))),
      () => setRecetasControladas([])
    );

    const qCron = query(collection(db, "recetas_cronicas"), orderBy("fechaSolicitud", "desc"));
    const unsubCron = onSnapshot(qCron,
      (s) => { setRecetasCronicas(s.docs.map((d) => decryptRecetaFields({ id: d.id, ...d.data(), tipo: "cronico" } as Receta))); setLoading(false); },
      () => { setRecetasCronicas([]); setLoading(false); }
    );

    const qMaternal = query(collection(db, "recetas_maternales"), orderBy("fechaSolicitud", "desc"));
    const unsubMaternal = onSnapshot(qMaternal,
      (s) => setRecetasMaternales(s.docs.map((d) => decryptRecetaFields({ id: d.id, ...d.data(), tipo: "maternal" } as Receta))),
      () => setRecetasMaternales([])
    );

    return () => { unsubConfig(); unsubCtrl(); unsubCron(); unsubMaternal(); };
  }, []);

  const todasRecetas = [...recetasControladas, ...recetasCronicas, ...recetasMaternales];

  useEffect(() => {
    if (loading || todasRecetas.length === 0) return;

    // Procesar descuentos de auto-renovaciones automáticamente
    const procesarRenovaciones = async () => {
      const now = new Date();

      import("firebase/firestore").then(({ doc, runTransaction }) => {
        for (const r of todasRecetas) {
          if (r.eliminada || r.estado !== "completado" || !r.fechaSolicitud) continue;

          const start = r.fechaSolicitud.toDate();
          let elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
          if (now.getDate() < start.getDate()) elapsedMonths--;

          const colName = r.tipo === "controlado" ? "recetas_controladas" : r.tipo === "maternal" ? "recetas_maternales" : "recetas_cronicas";
          const recRef = doc(db, colName, r.id);

          // Caso 1: Receta con items[] (Multi-medicamento)
          if (r.items && r.items.length > 0) {
            const itemsRenovables = r.items.filter(it =>
              it.autoRenovacion && it.autoRenovacion > 0 &&
              it.codigoMedicamento && it.cantidad > 0 &&
              (it.mesesDescontados ?? 0) >= 1
            );

            const hayPendientes = itemsRenovables.some(it => {
              const maxMonths = it.autoRenovacion + 1;
              const currentMonth = Math.min(Math.max(1, elapsedMonths + 1), maxMonths);
              return currentMonth > (it.mesesDescontados || 1);
            });

            if (hayPendientes) {
              runTransaction(db, async (transaction) => {
                const recDoc = await transaction.get(recRef);
                if (!recDoc.exists()) return;
                const data = recDoc.data();
                const currentItems: ItemReceta[] = data.items || [];
                
                let huboCambios = false;
                const itemsActualizados: ItemReceta[] = [];

                for (const item of currentItems) {
                  if (item.autoRenovacion && item.autoRenovacion > 0 && item.codigoMedicamento && item.cantidad > 0) {
                    const maxMonths = item.autoRenovacion + 1;
                    const currentMonth = Math.min(Math.max(1, elapsedMonths + 1), maxMonths);
                    const localMeses = item.mesesDescontados || 1;

                    if (currentMonth > localMeses) {
                      const diff = currentMonth - localMeses;
                      const invRef = doc(db, "inventario", item.codigoMedicamento);
                      const invDoc = await transaction.get(invRef);
                      if (invDoc.exists()) {
                        transaction.update(invRef, { stock: invDoc.data().stock - (item.cantidad * diff) });
                      }
                      itemsActualizados.push({ ...item, mesesDescontados: currentMonth });
                      huboCambios = true;
                      continue;
                    }
                  }
                  itemsActualizados.push(item);
                }

                if (huboCambios) {
                  transaction.update(recRef, { items: itemsActualizados });
                }
              }).catch(e => console.error("Error renovando items multi-med:", e));
            }

          } else if (
            // Caso 2: Receta antigua (campos planos)
            r.autoRenovacion && r.autoRenovacion > 0 &&
            r.codigoMedicamento && r.cantidad &&
            r.mesesDescontados && r.mesesDescontados >= 1
          ) {
            const maxMonths = r.autoRenovacion + 1;
            const currentMonth = Math.min(Math.max(1, elapsedMonths + 1), maxMonths);
            const localMeses = r.mesesDescontados || 1;

            if (currentMonth > localMeses) {
              const invRef = doc(db, "inventario", r.codigoMedicamento as string);
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
              }).catch(e => console.error("Error en transacción de renovación legado:", e));
            }
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
    if (activeTab === "maternales_A") return recetasMaternales.filter((r) => r.sector === "A");
    if (activeTab === "maternales_B") return recetasMaternales.filter((r) => r.sector === "B");
    if (activeTab === "maternales_CECOSF") return recetasMaternales.filter((r) => r.sector === "CECOSF");
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
  const mA = criticalCount(recetasMaternales.filter((r) => r.sector === "A"));
  const mB = criticalCount(recetasMaternales.filter((r) => r.sector === "B"));
  const mCECOSF = criticalCount(recetasMaternales.filter((r) => r.sector === "CECOSF"));
  const totalCritical = cA + cB + crA + crB + cCECOSF + crCECOSF + mA + mB + mCECOSF;

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
    recetasCronicas.filter((r) => r.eliminada).length +
    recetasMaternales.filter((r) => r.eliminada).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-[#5D7299] text-sm">Cargando tablero...</p>
      </div>
    );
  }

  // ── Tab genérico para recetas ─────────────────────────────────────────────
  const RecetaTab = ({ label, id, icon: Icon, count }: { label: string; id: TabState; icon: React.ElementType; count: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
        activeTab === id
          ? (id.startsWith("maternales") ? "tab-active-purple" : "tab-active-blue")
          : "text-[#5D7299] hover:bg-[#EBF4FF] hover:text-[#1A55CC]"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-black rounded-full">
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
          : "text-[#5D7299] border-[#DDE6F5] bg-white hover:bg-[#EBF4FF] hover:text-[#1A55CC] hover:border-[#93C5FD]"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {count != null && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-black rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  const isRecetaTab = ["controladas_A", "controladas_B", "cronicas_A", "cronicas_B", "controladas_CECOSF", "cronicas_CECOSF", "maternales_A", "maternales_B", "maternales_CECOSF"].includes(activeTab);

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

      {/* Tabs — 3 grupos con labels de categoría */}
      <div className="w-full space-y-2">
        {/* Fila superior: grupos de tabs de recetas */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {/* Grupo Controladas */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-[#7B90B5] uppercase tracking-widest px-1">Controladas</span>
            <div className="flex gap-1 bg-white border border-[#DDE6F5] shadow-sm p-1 rounded-2xl">
              <RecetaTab label="Sector A" id="controladas_A" icon={Pill} count={cA} />
              <RecetaTab label="Sector B" id="controladas_B" icon={Pill} count={cB} />
              <RecetaTab label="CECOSF" id="controladas_CECOSF" icon={Pill} count={cCECOSF} />
            </div>
          </div>

          {/* Grupo Crónicas */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-[#7B90B5] uppercase tracking-widest px-1">Crónicas</span>
            <div className="flex gap-1 bg-white border border-[#DDE6F5] shadow-sm p-1 rounded-2xl">
              <RecetaTab label="Sector A" id="cronicas_A" icon={Stethoscope} count={crA} />
              <RecetaTab label="Sector B" id="cronicas_B" icon={Stethoscope} count={crB} />
              <RecetaTab label="CECOSF" id="cronicas_CECOSF" icon={Stethoscope} count={crCECOSF} />
            </div>
          </div>

          {/* Grupo Maternal */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-brand-purple uppercase tracking-widest px-1">Maternal</span>
            <div className="flex gap-1 bg-white border border-brand-purple/20 shadow-sm p-1 rounded-2xl">
              <RecetaTab label="Sector A" id="maternales_A" icon={Baby} count={mA} />
              <RecetaTab label="Sector B" id="maternales_B" icon={Baby} count={mB} />
              <RecetaTab label="CECOSF" id="maternales_CECOSF" icon={Baby} count={mCECOSF} />
            </div>
          </div>
        </div>

        {/* Fila inferior: tabs especiales */}
        <div className="flex items-center gap-2 flex-wrap">
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
              className="relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 whitespace-nowrap bg-white border-[#DDE6F5] text-[#5D7299] hover:text-red-500 hover:border-red-300 hover:bg-red-50"
              title="Papelera de recetas eliminadas"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Papelera</span>
              {totalPapelera > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-black rounded-full">
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
          todasRecetas={todasRecetas}
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
