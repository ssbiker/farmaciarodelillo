import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { LoginScreen } from "./components/LoginScreen";
import { Dashboard } from "./components/Dashboard";
import { AdminSettings } from "./components/AdminSettings";
import { LogOut, Settings, Pill } from "lucide-react";
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
            const role = userData.role?.toLowerCase() || "";
            const isAdmin = role === "admin" || role === "quimico" || currentUser.email === "ssanchez@cmvalparaiso.cl";
            const hasAccess = isAdmin || userData.inFarmaciaTeam === true;

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

  const role = farmaciaUser.role?.toLowerCase() || "";
  const isAdmin = role === "admin" || role === "quimico" || user.email === "ssanchez@cmvalparaiso.cl";

  return (
    <div className="min-h-screen bg-[#0F0F1E] text-white flex flex-col">
      {/* Header */}
      <header className="bg-white/5 border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="bg-brand-purple/20 p-2 rounded-xl">
              <Pill className="w-5 h-5 text-brand-purple" />
            </div>
            <div>
              <h1 className="text-base font-black leading-none">Recetas Farmacia</h1>
              <p className="text-[10px] text-white/40 leading-none mt-0.5">CESFAM Rodelillo</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 hidden md:block">{user.email}</span>
            {isAdmin && (
              <Link
                to="/settings"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                title="Administración"
              >
                <Settings className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <Routes>
          <Route path="/" element={<Dashboard farmaciaUser={farmaciaUser} isAdmin={isAdmin} />} />
          <Route
            path="/settings"
            element={isAdmin ? <AdminSettings currentUser={user} farmaciaUser={farmaciaUser} /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
