import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { User } from "firebase/auth";
import { Save, Clock, Users, Stethoscope, ShieldCheck, ShieldOff, CheckCircle, Trash2, ClipboardList } from "lucide-react";
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
    const currentlyMedico = user.isMedico === true || (user.role?.toLowerCase() === "medico" && user.isFuncionario !== true);
    const newMedico = !currentlyMedico;

    const updates: Record<string, any> = {
      isMedico: newMedico,
      isFuncionario: false,
    };
    if (user.role !== "admin" && user.role !== "quimico") {
      updates.role = newMedico ? "medico" : "funcionario";
    }
    if (newMedico && !user.inFarmaciaTeam) {
      updates.inFarmaciaTeam = true;
    }

    await updateDoc(doc(db, "users", user.id), updates);
    showToast((newMedico ? "🩺 Rol Médico activado" : "❌ Rol Médico desactivado") + ": " + (user.name || user.email));
    setSavingUserId(null);
  };

  const toggleFuncionarioRole = async (user: FarmaciaUser) => {
    setSavingUserId(user.id);
    const currentlyFuncionario = (user.isFuncionario === true || user.role?.toLowerCase() === "funcionario") && user.isMedico !== true;
    const newFuncionario = !currentlyFuncionario;

    const updates: Record<string, any> = {
      isFuncionario: newFuncionario,
      isMedico: false,
    };
    if (user.role !== "admin" && user.role !== "quimico") {
      updates.role = newFuncionario ? "funcionario" : "usuario";
    }
    if (newFuncionario && !user.inFarmaciaTeam) {
      updates.inFarmaciaTeam = true;
    }

    await updateDoc(doc(db, "users", user.id), updates);
    showToast((newFuncionario ? "📋 Rol Funcionario activado" : "❌ Rol Funcionario desactivado") + ": " + (user.name || user.email));
    setSavingUserId(null);
  };

  const sectionClass = "bg-[#F8FAFF] border border-[#DDE6F5] rounded-3xl p-6 space-y-5";
  const inputClass = "w-full bg-white border border-[#DDE6F5] rounded-xl px-4 py-3 text-[#0F1B35] placeholder-[#8FA3C4] focus:border-brand-blue outline-none transition-colors";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-black text-[#0F1B35]">Administración</h2>
        <p className="text-[#5D7299] mt-1 text-sm">Configura tiempos de alerta, médicos y accesos al módulo.</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-[#F8FAFF] border border-[#DDE6F5] rounded-2xl px-5 py-3 text-sm font-medium backdrop-blur-xl flex items-center gap-2 text-[#0F1B35]">
          <CheckCircle className="w-4 h-4 text-green-600" />
          {toast}
        </div>
      )}

      {/* Tiempos de alerta */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className="bg-brand-purple/20 p-2 rounded-xl"><Clock className="w-5 h-5 text-brand-purple" /></div>
          <div>
            <h3 className="font-bold text-[#0F1B35]">Tiempos de Alerta</h3>
            <p className="text-xs text-[#5D7299]">Define cuántos días se toleran antes de activar alertas.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#3D5278] uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
              Alerta Amarilla (días)
            </label>
            <input type="number" min={1} value={config.diasAlertaAmarilla}
              onChange={(e) => setConfig({ ...config, diasAlertaAmarilla: parseInt(e.target.value) || 1 })}
              className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#3D5278] uppercase tracking-wide flex items-center gap-1.5">
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
            className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Tiempos"}
          </button>
        </div>
      </div>

      {/* Papelera */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-xl"><Trash2 className="w-5 h-5 text-red-500" /></div>
          <div>
            <h3 className="font-bold text-[#0F1B35]">Papelera de Recetas</h3>
            <p className="text-xs text-[#5D7299]">
              Revisa recetas eliminadas, restáuralas o bórralas definitivamente. Todo queda registrado.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => setPapeleraOpen(true)}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-6 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-200">
            <Trash2 className="w-4 h-4" /> Abrir Papelera
          </button>
        </div>
      </div>

      {/* Gestión de usuarios */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3">
          <div className="bg-brand-blue/10 p-2 rounded-xl"><Users className="w-5 h-5 text-brand-blue" /></div>
          <div>
            <h3 className="font-bold text-[#0F1B35]">Acceso y Roles de Usuarios</h3>
            <p className="text-xs text-[#5D7299]">
              Gestiona el acceso y rol de cada usuario. Los médicos pueden autorizar recetas. Los funcionarios pueden ingresar recetas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-[#5D7299]">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Acceso al módulo activo</span>
          <span className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-brand-blue" /> Médico — puede autorizar/rechazar</span>
          <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-orange-500" /> Funcionario — puede ingresar recetas</span>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {users.length === 0 && (
            <p className="text-center text-[#5D7299] text-sm py-8">Cargando usuarios...</p>
          )}
          {users
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .map((u) => {
              // Considera flags booleanos y role plano sin conflicto
              const isMedico = u.isMedico === true || (u.role?.toLowerCase() === "medico" && u.isFuncionario !== true);
              const isFuncionario = (u.isFuncionario === true || u.role?.toLowerCase() === "funcionario") && !isMedico;
              const hasAccess = u.inFarmaciaTeam === true;
              const isCurrentUser = u.id === currentUser.uid;
              const isLoading = savingUserId === u.id;
              return (
                <div key={u.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${hasAccess || isMedico || isFuncionario ? "bg-white border-[#DDE6F5]" : "bg-transparent border-[#EEF3FC]"}`}>
                  <div className="w-9 h-9 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black flex-shrink-0">
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate text-[#0F1B35]">
                      {u.name || "Sin nombre"}
                      {isCurrentUser && <span className="ml-1.5 text-[11px] bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-full">tú</span>}
                    </p>
                    <p className="text-xs text-[#5D7299] truncate">{u.email}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.role && u.role !== "medico" && u.role !== "funcionario" && (
                        <span className="text-[11px] bg-[#EFF3FB] px-1.5 py-0.5 rounded-full text-[#3D5278] capitalize">{u.role}</span>
                      )}
                      {isMedico && (
                        <span className="text-[11px] bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Stethoscope className="w-2.5 h-2.5" /> Médico
                        </span>
                      )}
                      {isFuncionario && (
                        <span className="text-[11px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <ClipboardList className="w-2.5 h-2.5" /> Funcionario
                        </span>
                      )}
                      {hasAccess && (
                        <span className="text-[11px] bg-green-500/10 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" /> Farmacia
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Toggle Médico */}
                    <button onClick={() => toggleMedicoRole(u)} disabled={isLoading}
                      title={isMedico ? "Quitar rol Médico" : "Marcar como Médico"}
                      className={`p-2 rounded-lg text-xs transition-all disabled:opacity-30 ${isMedico ? "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20" : "bg-[#EFF3FB] text-[#5D7299] hover:bg-brand-blue/10 hover:text-brand-blue"}`}>
                      <Stethoscope className="w-4 h-4" />
                    </button>
                    {/* Toggle Funcionario */}
                    <button onClick={() => toggleFuncionarioRole(u)} disabled={isLoading}
                      title={isFuncionario ? "Quitar rol Funcionario" : "Marcar como Funcionario"}
                      className={`p-2 rounded-lg text-xs transition-all disabled:opacity-30 ${isFuncionario ? "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" : "bg-[#EFF3FB] text-[#5D7299] hover:bg-orange-500/10 hover:text-orange-500"}`}>
                      <ClipboardList className="w-4 h-4" />
                    </button>
                    {/* Toggle Acceso Farmacia */}
                    <button onClick={() => toggleFarmaciaAccess(u)} disabled={isLoading || isCurrentUser}
                      title={hasAccess ? "Retirar acceso a Farmacia" : "Dar acceso a Farmacia"}
                      className={`p-2 rounded-lg text-xs transition-all disabled:opacity-40 ${hasAccess ? "bg-green-500/10 text-green-700 hover:bg-red-50 hover:text-red-500" : "bg-[#EFF3FB] text-[#5D7299] hover:bg-green-50 hover:text-green-600"}`}>
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
