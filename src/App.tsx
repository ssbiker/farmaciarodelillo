import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { LoginScreen } from "./components/LoginScreen";
import { Dashboard } from "./components/Dashboard";
import { AdminSettings } from "./components/AdminSettings";
import { AsistenteFlotante } from "./components/AsistenteFlotante";
import { LogOut, Settings, ArrowLeft } from "lucide-react";
import type { FarmaciaUser } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [farmaciaUser, setFarmaciaUser] = useState<FarmaciaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as FarmaciaUser;
            const role = (userData.role || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const isAdmin = role === "admin" || role === "quimico" || currentUser.email === "ssanchez@cmvalparaiso.cl";
            const isMedico = userData.isMedico === true || (role === "medico" && userData.isFuncionario !== true);
            const isFuncionario = (userData.isFuncionario === true || role === "funcionario") && !isMedico;
            // Médicos, funcionarios, admins y usuarios con acceso concedido tienen acceso directo
            const hasAccess = isAdmin || userData.inFarmaciaTeam === true || userData.hasFarmaciaAccess === true || isMedico || isFuncionario;

            if (hasAccess) {
              setUser(currentUser);
              setFarmaciaUser({
                ...userData,
                id: currentUser.uid,
                email: currentUser.email || "",
              });
              setAuthError(null);
            } else {
              await signOut(auth);
              setUser(null);
              setFarmaciaUser(null);
              setAuthError("Acceso Denegado: Tu cuenta no tiene permisos para el módulo de Farmacia.");
            }
          } else {
            await signOut(auth);
            setUser(null);
            setFarmaciaUser(null);
            setAuthError("Acceso Denegado: Tu perfil no existe en el sistema.");
          }
        } catch {
          await signOut(auth);
          setUser(null);
          setFarmaciaUser(null);
          setAuthError("Error de seguridad al verificar los permisos.");
        }
      } else {
        setUser(null);
        setFarmaciaUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F1E] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !farmaciaUser) {
    return <LoginScreen onLogin={handleLogin} externalError={authError} />;
  }

  const role = (farmaciaUser.role || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isAdmin = role === "admin" || role === "quimico" || user.email === "ssanchez@cmvalparaiso.cl";
  // Considera tanto el role string como el flag booleano independiente
  // Así un admin con isMedico: true puede autorizar sin perder su acceso admin
  const isMedico      = farmaciaUser.isMedico === true || (role === "medico" && farmaciaUser.isFuncionario !== true);
  const isFuncionario = (farmaciaUser.isFuncionario === true || role === "funcionario") && !isMedico;

  return (
    <div className="min-h-screen page-bg text-[#0F1B35] flex flex-col">

      {/* ── Header — gradiente azul cielo → cyan → violeta ── */}
      <header className="header-gradient sticky top-0 z-50">
        <div className="relative z-10 max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Grupo izquierdo: Logo + Botón Volver */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="header-logo-pill flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full transition-all duration-300 group-hover:scale-[1.02]">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] overflow-hidden">
                  <img src="/logo.png" alt="CESFAM Logo" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-black leading-none text-white drop-shadow-sm">Recetas Farmacia</p>
                  <p className="text-[10px] text-white/90 leading-none mt-0.5 font-bold">CESFAM Rodelillo</p>
                </div>
              </div>
            </Link>

            {/* Volver al Portal */}
            <a 
              href="https://landing-cesfamrod.web.app/funcionarios" 
              className="hidden md:flex items-center gap-1.5 header-logo-pill px-3 py-2 rounded-full text-white hover:bg-white/20 hover:scale-[1.02] transition-all duration-300 shadow-sm"
              title="Volver al Portal de Funcionarios"
            >
              <ArrowLeft className="w-4 h-4 opacity-80" />
              <span className="text-xs font-bold leading-none">Portal</span>
            </a>
          </div>

          {/* Acciones del header */}
          <div className="flex items-center gap-2">
            {/* Email */}
            <span className="text-xs text-white/60 hidden lg:block">{user.email}</span>

            {/* Badges de rol */}
            {isMedico && (
              <span className="hidden sm:flex items-center gap-1.5 header-logo-pill text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
                🩺 Médico
              </span>
            )}
            {isFuncionario && (
              <span className="hidden sm:flex items-center gap-1.5 header-logo-pill text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
                📋 Funcionario
              </span>
            )}

            {/* Administración */}
            {isAdmin && (
              <Link
                to="/settings"
                className="header-pill p-2.5 rounded-xl"
                title="Administración"
              >
                <Settings className="w-4 h-4 text-white" />
              </Link>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="header-pill p-2.5 rounded-xl hover:!bg-red-500/30 hover:!border-red-300/40"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <Routes>
          <Route path="/" element={<Dashboard farmaciaUser={farmaciaUser} isAdmin={isAdmin} isMedico={isMedico} isFuncionario={isFuncionario} />} />
          <Route
            path="/settings"
            element={isAdmin ? <AdminSettings currentUser={user} farmaciaUser={farmaciaUser} /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Asistente Experto Interno ($0, Cero Latencia, 100% Seguro) */}
      <AsistenteFlotante farmaciaUser={farmaciaUser} isMedico={isMedico} isFuncionario={isFuncionario} isAdmin={isAdmin} />
    </div>
  );
}
