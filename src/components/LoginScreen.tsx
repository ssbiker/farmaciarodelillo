import { useState } from "react";
import { Mail, Lock, AlertCircle, Pill } from "lucide-react";

export function LoginScreen({ onLogin, externalError }: { onLogin: (e: string, p: string) => Promise<void>; externalError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || externalError;

  return (
    <div className="min-h-screen flex items-center justify-center page-bg px-4 relative overflow-hidden">
      {/* Gradientes decorativos de fondo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-blue/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-brand-purple/8 rounded-full blur-3xl" />
        <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-brand-amber/6 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-modal rounded-3xl p-8 shadow-blue">
          {/* Logo y título */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 relative mb-4 bg-brand-blue/8 rounded-2xl border border-brand-blue/15 flex items-center justify-center shadow-blue">
              <img
                src="/logo.png"
                alt="Logo CESFAM Rodelillo"
                className="w-14 h-14 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <Pill className="w-8 h-8 text-brand-blue absolute" style={{ display: "none" }} />
            </div>
            <h1 className="text-2xl font-black text-[#0F1B35] text-center">Recetas Farmacia</h1>
            <p className="text-sm text-[#5D7299] mt-1">CESFAM Rodelillo — Acceso restringido</p>
          </div>

          {/* Error */}
          {displayError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <p className="text-sm">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8FA3C4] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo electrónico"
                  required
                  className="w-full bg-white border border-[#DDE6F5] text-[#0F1B35] placeholder-[#8FA3C4] rounded-xl pl-11 pr-4 py-3 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 transition-all outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8FA3C4] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  className="w-full bg-white border border-[#DDE6F5] text-[#0F1B35] placeholder-[#8FA3C4] rounded-xl pl-11 pr-4 py-3 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 transition-all outline-none"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 shadow-blue"
            >
              {loading ? "Ingresando..." : "Ingresar al Sistema"}
            </button>
          </form>

          <p className="text-center text-xs text-[#8FA3C4] mt-6">
            Solo personal autorizado del CESFAM puede acceder.
          </p>
        </div>
      </div>
    </div>
  );
}
