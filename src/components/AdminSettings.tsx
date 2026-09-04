import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { User } from "firebase/auth";
import { Save, Clock, Users, Stethoscope, ShieldCheck, ShieldOff, CheckCircle, Trash2 } from "lucide-react";
import type { FarmaciaUser, FarmaciaConfig } from "../types";
import { PapeleraModal } from "./PapeleraModal";

const DEFAULT_CONFIG: FarmaciaConfig = { diasAlertaRoja: 5, diasAlertaAmarilla: 3 };

export function AdminSettings({ currentUser, farmaciaUser }: { currentUser: User; farmaciaUser: FarmaciaUser }) {
  const [config, setConfig] = useState<FarmaciaConfig>(DEFAULT_CONFIG);
  const [users, setUsers] = useState<FarmaciaUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [papeleraOpen, setPapeleraOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    const unsubCfg = onSnapshot(doc(db, "farmacia_config", "settings"), (snap) => {
      if (snap.exists()) setConfig(snap.data() as FarmaciaConfig);
    });
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FarmaciaUser)));
    });
    return () => { unsubCfg(); unsubUsers(); };
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "farmacia_config", "settings"), config, { merge: true });
      showToast("✅ Configuración guardada.");
    } catch { showToast("❌ Error al guardar."); }
    finally { setSaving(false); }
  };

  const toggleFarmaciaAccess = async (user: FarmaciaUser) => {
    setSavingUserId(user.id);
    const newVal = !user.inFarmaciaTeam;
    await updateDoc(doc(db, "users", user.id), { inFarmaciaTeam: newVal });
    showToast((newVal ? "✅ Acceso otorgado" : "🚫 Acceso retirado") + " a " + user.name + ".");
    setSavingUserId(null);
  };

  const toggleMedicoRole = async (user: FarmaciaUser) => {
    setSavingUserId(user.id);
    const isMedico = user.role?.toLowerCase() === "medico";
    await updateDoc(doc(db, "users", user.id), { role: isMedico ? "" : "medico" });
    showToast((!isMedico ? "🩺 Marcado como Médico" : "❌ Rol Médico removido") + ": " + user.name);
    setSavingUserId(null);
  };

  const sectionClass = "bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-5";
  const inputClass = "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-purple outline-none transition-colors";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-black">Administración</h2>
        <p className="text-white/50 mt-1 text-sm">Configura tiempos de alerta, médicos y accesos al módulo.</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-sm font-medium backdrop-blur-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}

      {/* Tiempos de alerta */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className="bg-brand-purple/20 p-2 rounded-xl"><Clock className="w-5 h-5 text-brand-purple" /></div>
          <div>
            <h3 className="font-bold">Tiempos de Alerta</h3>
            <p className="text-xs text-white/40">Define cuántos días se toleran antes de activar alertas.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
              Alerta Amarilla (días)
            </label>
            <input type="number" min={1} value={config.diasAlertaAmarilla}
              onChange={(e) => setConfig({ ...config, diasAlertaAmarilla: parseInt(e.target.value) || 1 })}
              className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              Alerta Roja Crítica (días)
            </label>
            <input type="number" min={1} value={config.diasAlertaRoja}
              onChange={(e) => setConfig({ ...config, diasAlertaRoja: parseInt(e.target.value) || 1 })}
              className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={saveConfig} disabled={saving}
            className="flex items-center gap-2 bg-brand-purple hover:bg-brand-purple-dark text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Tiempos"}
          </button>
        </div>
      </div>

      {/* Papelera */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-xl"><Trash2 className="w-5 h-5 text-red-400" /></div>
          <div>
            <h3 className="font-bold">Papelera de Recetas</h3>
            <p className="text-xs text-white/40">
              Revisa recetas eliminadas, restáuralas o bórralas definitivamente. Todo queda registrado.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => setPapeleraOpen(true)}
            className="flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 px-6 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-500/20">
            <Trash2 className="w-4 h-4" /> Abrir Papelera
          </button>
        </div>
      </div>

      {/* Gestión de usuarios */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-xl"><Users className="w-5 h-5 text-blue-400" /></div>
          <div>
            <h3 className="font-bold">Acceso y Roles de Usuarios</h3>
            <p className="text-xs text-white/40">
              Activa acceso al módulo o marca a un usuario como Médico para que aparezca en el selector de recetas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Acceso al módulo activo</span>
          <span className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-cyan-400" /> Aparece en lista de médicos</span>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {users.length === 0 && (
            <p className="text-center text-white/30 text-sm py-8">Cargando usuarios...</p>
          )}
          {users
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .map((u) => {
              const isMedico = u.role?.toLowerCase() === "medico";
              const hasAccess = u.inFarmaciaTeam === true;
              const isCurrentUser = u.id === currentUser.uid;
              const isLoading = savingUserId === u.id;
              return (
                <div key={u.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${hasAccess || isMedico ? "bg-white/[0.05] border-white/10" : "bg-transparent border-white/5"}`}>
                  <div className="w-9 h-9 rounded-full bg-brand-purple/20 text-brand-purple flex items-center justify-center text-xs font-black flex-shrink-0">
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">
                      {u.name || "Sin nombre"}
                      {isCurrentUser && <span className="ml-1.5 text-[10px] bg-brand-purple/20 text-brand-purple px-1.5 py-0.5 rounded-full">tú</span>}
                    </p>
                    <p className="text-xs text-white/40 truncate">{u.email}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.role && u.role !== "medico" && (
                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full text-white/50 capitalize">{u.role}</span>
                      )}
                      {isMedico && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Stethoscope className="w-2.5 h-2.5" /> Médico
                        </span>
                      )}
                      {hasAccess && (
                        <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" /> Farmacia
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => toggleMedicoRole(u)} disabled={isLoading}
                      title={isMedico ? "Quitar rol Médico" : "Marcar como Médico"}
                      className={`p-2 rounded-lg text-xs transition-all disabled:opacity-40 ${isMedico ? "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10" : "bg-white/5 text-white/30 hover:bg-cyan-500/10 hover:text-cyan-400"}`}>
                      <Stethoscope className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleFarmaciaAccess(u)} disabled={isLoading || isCurrentUser}
                      title={hasAccess ? "Retirar acceso a Farmacia" : "Dar acceso a Farmacia"}
                      className={`p-2 rounded-lg text-xs transition-all disabled:opacity-40 ${hasAccess ? "bg-green-500/20 text-green-300 hover:bg-red-500/10 hover:text-red-400" : "bg-white/5 text-white/30 hover:bg-green-500/10 hover:text-green-400"}`}>
                      {hasAccess ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {papeleraOpen && (
        <PapeleraModal farmaciaUser={farmaciaUser} onClose={() => setPapeleraOpen(false)} />
      )}
    </div>
  );
}
