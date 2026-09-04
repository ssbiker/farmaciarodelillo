import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Receta, FarmaciaUser, FarmaciaConfig } from "../types";
import { Pill, Stethoscope, AlertCircle, Trash2 } from "lucide-react";
import { RecetaList } from "./RecetaList";
import { PapeleraModal } from "./PapeleraModal";

const DEFAULT_CONFIG: FarmaciaConfig = { diasAlertaRoja: 5, diasAlertaAmarilla: 3 };

type TabState = "controladas_A" | "controladas_B" | "cronicas_A" | "cronicas_B";

export function Dashboard({
  farmaciaUser,
  isAdmin,
}: {
  farmaciaUser: FarmaciaUser;
  isAdmin: boolean;
}) {
  const [recetasControladas, setRecetasControladas] = useState<Receta[]>([]);
  const [recetasCronicas, setRecetasCronicas] = useState<Receta[]>([]);
  const [config, setConfig] = useState<FarmaciaConfig>(DEFAULT_CONFIG);
  const [medicos, setMedicos] = useState<FarmaciaUser[]>([]);
  const [activeTab, setActiveTab] = useState<TabState>("controladas_A");
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
          .filter((u) => u.role?.toLowerCase() === "medico")
      );
    });

    const qCtrl = query(collection(db, "recetas_controladas"), orderBy("fechaSolicitud", "desc"));
    const unsubCtrl = onSnapshot(qCtrl,
      (s) => setRecetasControladas(s.docs.map((d) => ({ id: d.id, ...d.data() } as Receta))),
      () => setRecetasControladas([])
    );

    const qCron = query(collection(db, "recetas_cronicas"), orderBy("fechaSolicitud", "desc"));
    const unsubCron = onSnapshot(qCron,
      (s) => { setRecetasCronicas(s.docs.map((d) => ({ id: d.id, ...d.data() } as Receta))); setLoading(false); },
      () => { setRecetasCronicas([]); setLoading(false); }
    );

    return () => { unsubConfig(); unsubCtrl(); unsubCron(); };
  }, []);

  const getFiltered = (): Receta[] => {
    if (activeTab === "controladas_A") return recetasControladas.filter((r) => r.sector === "A");
    if (activeTab === "controladas_B") return recetasControladas.filter((r) => r.sector === "B");
    if (activeTab === "cronicas_A") return recetasCronicas.filter((r) => r.sector === "A");
    return recetasCronicas.filter((r) => r.sector === "B");
  };

  const criticalCount = (list: Receta[]) => {
    const now = Date.now();
    return list.filter((r) => {
      if (r.estado !== "pendiente") return false;
      if (r.eliminada) return false;
      if (r.fechaLimite) {
        // Con fecha límite: crítica si ya venció (pasó la fecha)
        return r.fechaLimite.toDate().getTime() < now;
      }
      // Sin fecha límite: crítica si lleva >= diasAlertaRoja días activa
      return Math.floor((now - r.fechaSolicitud.toDate().getTime()) / 86400000) >= config.diasAlertaRoja;
    }).length;
  };

  const cA = criticalCount(recetasControladas.filter((r) => r.sector === "A"));
  const cB = criticalCount(recetasControladas.filter((r) => r.sector === "B"));
  const crA = criticalCount(recetasCronicas.filter((r) => r.sector === "A"));
  const crB = criticalCount(recetasCronicas.filter((r) => r.sector === "B"));
  const totalCritical = cA + cB + crA + crB;

  // Papelera: recetas eliminadas de ambas colecciones
  const totalPapelera =
    recetasControladas.filter((r) => r.eliminada).length +
    recetasCronicas.filter((r) => r.eliminada).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Cargando tablero...</p>
      </div>
    );
  }

  const Tab = ({ label, id, icon: Icon, count }: { label: string; id: TabState; icon: React.ElementType; count: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
        activeTab === id
          ? "bg-brand-purple/20 text-white border border-brand-purple/30 shadow-[0_0_20px_rgba(123,47,190,0.15)]"
          : "text-white/50 hover:bg-white/5 hover:text-white/80"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {count > 0 && (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full shadow-[0_0_8px_rgba(239,68,68,0.7)]">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Banner alertas críticas */}
      {totalCritical > 0 && (
        <div className="flex items-center gap-4 bg-red-950/50 border border-red-500/25 rounded-2xl p-4">
          <div className="bg-red-500/20 p-2.5 rounded-xl flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
          <div>
            <p className="font-bold text-red-200 text-sm">
              {totalCritical} solicitud{totalCritical > 1 ? "es" : ""} con tiempo vencido
            </p>
            <p className="text-xs text-red-400/70">
              Llevan más de {config.diasAlertaRoja} días sin atención. Requieren acción inmediata.
            </p>
          </div>
        </div>
      )}

      {/* Tabs + botón papelera */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto bg-black/20 border border-white/5 p-1.5 rounded-2xl flex-1">
          <Tab label="Controladas — Sec. A" id="controladas_A" icon={Pill} count={cA} />
          <Tab label="Controladas — Sec. B" id="controladas_B" icon={Pill} count={cB} />
          <Tab label="Crónicas — Sec. A" id="cronicas_A" icon={Stethoscope} count={crA} />
          <Tab label="Crónicas — Sec. B" id="cronicas_B" icon={Stethoscope} count={crB} />
        </div>

        {/* Botón papelera — solo admins */}
        {isAdmin && (
          <button
            onClick={() => setPapeleraOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all whitespace-nowrap bg-black/20 border-white/5 text-white/40 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 flex-shrink-0"
            title="Papelera de recetas eliminadas"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Papelera</span>
            {totalPapelera > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-500/80 text-white text-[10px] font-black rounded-full">
                {totalPapelera}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Lista */}
      <RecetaList
        recetas={getFiltered()}
        config={config}
        medicos={medicos}
        isAdmin={isAdmin}
        farmaciaUser={farmaciaUser}
        activeTab={activeTab}
      />

      {/* Papelera modal */}
      {papeleraOpen && (
        <PapeleraModal farmaciaUser={farmaciaUser} onClose={() => setPapeleraOpen(false)} />
      )}
    </div>
  );
}

