import { useState } from "react";
import { Search, AlertCircle, CheckCircle } from "lucide-react";
import { formatRut, validarRut, normalizarRut } from "../lib/rutUtils";

interface Props {
  onConsultar: (rut: string) => void;
  loading: boolean;
}

export function RutInput({ onConsultar, loading }: Props) {
  const [rut, setRut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRut(e.target.value);
    setRut(formatted);
    if (touched && error) setError(null);
  };

  const handleBlur = () => {
    setTouched(true);
    if (rut && !validarRut(rut)) {
      setError("El RUT no es válido. Verifica el dígito verificador.");
    } else {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const clean = normalizarRut(rut);
    if (clean.length < 2) { setError("Por favor ingresa tu RUT."); return; }
    if (!validarRut(rut))  { setError("El RUT no es válido. Verifica el dígito verificador."); return; }
    setError(null);
    onConsultar(rut);
  };

  const isValid = rut.length > 0 && validarRut(rut);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div>
        <label
          htmlFor="rut-input"
          className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2"
        >
          Tu RUT
        </label>

        <div className="relative">
          <input
            id="rut-input"
            type="text"
            inputMode="numeric"
            placeholder="12.345.678-9"
            value={rut}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={12}
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={[
              "glass-input w-full h-14 px-5 rounded-2xl text-[20px] font-mono font-semibold",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isValid ? "valid" : "",
              error  ? "error"  : "",
            ].join(" ")}
          />

          {rut.length > 0 && !loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              {isValid
                ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                : <div className="w-2 h-2 rounded-full bg-slate-300" />
              }
            </div>
          )}

          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 mt-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}
      </div>

      <div className="glass-divider" />

      <button
        type="submit"
        disabled={loading || !isValid}
        className="btn-primary w-full rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2.5 px-6 py-3.5"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Consultando…
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            Consultar Estado de mi Receta
          </>
        )}
      </button>
    </form>
  );
}
