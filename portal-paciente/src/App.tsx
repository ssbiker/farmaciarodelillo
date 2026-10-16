import { useState } from "react";
import { ArrowLeft, Shield, Phone, Stethoscope } from "lucide-react";
import { RutInput } from "./components/RutInput";
import { RecetaCard } from "./components/RecetaCard";
import { hashRut } from "./lib/rutUtils";
import { consultarRecetasPorHash } from "./lib/recetasPublicas";
import type { RecetaPublica } from "./lib/recetasPublicas";
import "./index.css";

type Pantalla = "consulta" | "resultado" | "sin-resultados" | "error";

export default function App() {
  const [pantalla, setPantalla] = useState<Pantalla>("consulta");
  const [loading, setLoading] = useState(false);
  const [recetas, setRecetas] = useState<RecetaPublica[]>([]);
  const [rutConsultado, setRutConsultado] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleConsultar = async (rut: string) => {
    setLoading(true);
    setRutConsultado(rut);
    try {
      const hash = await hashRut(rut);
      const resultados = await consultarRecetasPorHash(hash);
      if (resultados.length === 0) {
        setPantalla("sin-resultados");
      } else {
        setRecetas(resultados);
        setPantalla("resultado");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("No pudimos conectarnos al sistema. Verifica tu conexión e intenta de nuevo.");
      setPantalla("error");
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    setPantalla("consulta");
    setRecetas([]);
    setRutConsultado("");
    setErrorMsg("");
  };

  return (
    <>
      {/* Fondo animado claro */}
      <div className="bg-scene" aria-hidden="true">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">

        {/* ─── Header flotante ─── */}
        <header className="glass-header sticky top-0 z-20">
          <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-slate-200/80 shadow-sm bg-white">
                <img
                  src="/logo.png"
                  alt="CESFAM Rodelillo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-none tracking-tight">
                  CESFAM Rodelillo
                </p>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5 font-medium">
                  Portal de Recetas
                </p>
              </div>
            </div>

            {pantalla !== "consulta" && (
              <button
                onClick={handleVolver}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-full hover:bg-blue-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Nueva consulta
              </button>
            )}
          </div>
        </header>

        {/* ─── Main ─── */}
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-5">

            {/* ══ CONSULTA ══ */}
            {pantalla === "consulta" && (
              <>
                <div className="text-center space-y-3 px-2 animate-fade-up">
                  {/* Logo grande */}
                  <div className="flex justify-center mb-5">
                    <div className="relative">
                      <div className="w-[76px] h-[76px] rounded-[20px] overflow-hidden ring-1 ring-slate-200 shadow-lg bg-white">
                        <img
                          src="/logo.png"
                          alt="CESFAM Rodelillo"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                      {/* Reflejo especular iOS */}
                      <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                    </div>
                  </div>

                  <h1 className="text-[27px] font-black text-slate-800 leading-tight tracking-tight">
                    Consulta tu Receta
                  </h1>
                  <p className="text-slate-500 text-[15px] leading-relaxed max-w-sm mx-auto">
                    Ingresa tu RUT para saber si tu receta médica ya está lista para retiro.
                  </p>
                </div>

                {/* Card glass blanca */}
                <div className="glass-surface rounded-3xl p-6 animate-fade-up-delay">
                  <RutInput onConsultar={handleConsultar} loading={loading} />
                </div>

                {/* Nota privacidad */}
                <div className="flex items-start gap-2 px-2 animate-fade-up-delay-2">
                  <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-slate-400 leading-relaxed">
                    Tu RUT se procesa localmente y no se almacena. Solo consultamos el estado de tu receta.
                  </p>
                </div>
              </>
            )}

            {/* ══ RESULTADO ══ */}
            {pantalla === "resultado" && recetas.length > 0 && (
              <>
                <div className="text-center space-y-1 px-2 animate-fade-up">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    {recetas.length === 1
                      ? "Encontramos tu receta"
                      : `Encontramos ${recetas.length} recetas`}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Asociadas a tu RUT en el sistema
                  </p>
                </div>

                <div className="space-y-3">
                  {recetas.map((r, i) => (
                    <div
                      key={r.id}
                      style={{ animationDelay: `${i * 80}ms` }}
                      className="animate-fade-up"
                    >
                      <RecetaCard receta={r} />
                    </div>
                  ))}
                </div>

                <div className="glass-surface rounded-2xl p-4 flex items-start gap-3 animate-fade-up-delay">
                  <Phone className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">¿Tienes dudas?</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Comunícate con la farmacia del CESFAM Rodelillo o consulta en ventanilla.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ══ SIN RESULTADOS ══ */}
            {pantalla === "sin-resultados" && (
              <div className="glass-surface rounded-3xl p-8 text-center space-y-5 animate-fade-up">
                <div className="text-5xl">🔍</div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    No encontramos recetas
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    No hay recetas activas para el RUT{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      {rutConsultado}
                    </span>
                  </p>
                </div>

                <div className="glass-divider" />

                <div className="text-left space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Posibles razones
                  </p>
                  <ul className="space-y-1.5">
                    {[
                      "Tu médico aún no ha ingresado la receta",
                      "La receta fue emitida hace mucho tiempo",
                      "El RUT podría tener un error tipográfico",
                    ].map((txt) => (
                      <li key={txt} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="text-blue-400 flex-shrink-0 mt-0.5">·</span>
                        {txt}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handleVolver}
                  className="btn-primary w-full h-12 rounded-2xl font-bold text-sm text-white"
                >
                  Intentar con otro RUT
                </button>
              </div>
            )}

            {/* ══ ERROR ══ */}
            {pantalla === "error" && (
              <div className="glass-surface rounded-3xl p-8 text-center space-y-5 animate-fade-up">
                <div className="text-5xl">⚠️</div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-800">Error de conexión</h2>
                  <p className="text-slate-500 text-sm">{errorMsg}</p>
                </div>
                <button
                  onClick={handleVolver}
                  className="btn-primary w-full h-12 rounded-2xl font-bold text-sm text-white"
                >
                  Volver a intentar
                </button>
              </div>
            )}

          </div>
        </main>

        {/* ─── Footer ─── */}
        <footer className="py-6 px-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Stethoscope className="w-3 h-3 text-slate-300" />
            <p className="text-[11px] text-slate-400 font-medium tracking-wide">
              CESFAM Rodelillo · Valparaíso
            </p>
          </div>
          <p className="text-[10px] text-slate-300">
            Portal de consulta de recetas médicas
          </p>
        </footer>

      </div>
    </>
  );
}
