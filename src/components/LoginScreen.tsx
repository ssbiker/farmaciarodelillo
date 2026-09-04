import { useState } from "react";
import { Mail, Lock, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F0F1E] via-[#1A1A2E] to-[#2D1B69] px-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 relative mb-4">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <h1 className="text-2xl font-black text-white text-center">Recetas Farmacia</h1>
          </div>
          {displayError && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-4 rounded-2xl flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{displayError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo electrónico"
                  required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-brand-purple transition-all outline-none"
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-brand-purple transition-all outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-purple hover:bg-brand-purple-dark text-white font-bold py-3.5 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-60 shadow-lg"
            >
              {loading ? "Ingresando..." : "Ingresar al Sistema"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
