"use client";
import { useState } from 'react';
import { ClipboardList, UserSquare2, Phone, FileText, ChevronRight, X, CheckCircle2, Loader2, Stethoscope, Baby, AlertCircle } from 'lucide-react';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwnAF_Wxyipdf0cmBtjsl6_rdrxumKgStZ7NkJcLW6DTznsrsdl8kyHSEBjgejt8RASDg/exec";

export function Demand() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [rutError, setRutError] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    rut: "",
    telefono: "",
    motivo: "",
    subMotivo: "",
    detalles: ""
  });

  const MOTIVO_NOTES: Record<string, string> = {
    "Control Ginecologico": "Control anual para realizar examen ginecológico.",
    "Control Regulación Fertilidad": "Uso de anticonceptivos.",
    "Control climaterio": "Usuarias de 40 a 64 años con menopausia.",
    "Ingreso Prenatal": "Test de embarazo positivo. Indique si tiene ecografía o traslado de otro CESFAM."
  };

  const SUB_MOTIVOS: Record<string, string[]> = {
    "Control Regulación Fertilidad": [
      "Recambio de Implante",
      "Recambio DIU",
      "Cambio a otros métodos (excluye implante y DIU)",
      "Continuar con el mismo método"
    ],
    "Control climaterio": [
      "Uso terapia hormonal de reemplazo",
      "No uso terapia hormonal de reemplazo"
    ]
  };

  const validateRut = (rutStr: string) => {
    const cleanRut = rutStr.replace(/\./g, "").replace(/-/g, "");
    if (cleanRut.length < 2) return false;
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();
    
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const expectedDv = 11 - (sum % 11);
    const dvChar = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
    return dv === dvChar;
  };

  const formatRut = (rut: string) => {
    let value = rut.replace(/[^0-9kK]/g, '');
    if (value.length > 1) {
      value = value.slice(0, -1) + '-' + value.slice(-1);
    }
    return value.toUpperCase();
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRut(e.target.value);
    setFormData({ ...formData, rut: formatted });
    if (formatted.length > 7) {
      setRutError(!validateRut(formatted));
    } else {
      setRutError(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRut(formData.rut)) {
      setRutError(true);
      return;
    }
    if (formData.telefono.length !== 8) return;

    setStatus("loading");

    try {
      const urlParams = new URLSearchParams();
      urlParams.append("nombre", formData.nombre);
      urlParams.append("rut", formData.rut);
      // Evitamos el "+" inicial para que Google Sheets no crea que es una fórmula matemática (#ERROR!)
      urlParams.append("telefono", "569 " + formData.telefono);
      let finalMotivo = formData.subMotivo ? `${formData.motivo} - ${formData.subMotivo}` : formData.motivo;
      if (formData.detalles && formData.detalles.trim() !== "") {
        finalMotivo += ` | Notas: ${formData.detalles.trim()}`;
      }
      urlParams.append("motivo", finalMotivo);

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: urlParams.toString()
      });
      
      setStatus("success");
      setTimeout(() => {
        setIsModalOpen(false);
        setStatus("idle");
        setFormData({ nombre: "", rut: "", telefono: "", motivo: "", subMotivo: "", detalles: "" });
      }, 3000);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <section className="py-24 bg-[#0F0F1E] relative overflow-hidden" id="gestion-demanda">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#7B2FBE]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[#F5C518]/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          
          {/* Texto de la sección */}
          <div className="flex-1 text-center md:text-left">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-bold rounded-full text-sm mb-6 border border-white/10">
              <ClipboardList className="w-4 h-4 text-[#F5C518]" /> Trámites en Línea
            </span>
            <h2 className="text-4xl md:text-5xl font-black font-heading text-white mb-6 leading-tight">
              Gestión de la <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5C518] to-[#FF9800]">Demanda</span>
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto md:mx-0">
              Solicita tu hora médica de forma rápida y segura sin salir de casa. Nuestros profesionales ingresarán tu solicitud al sistema interno.
            </p>
          </div>

          {/* Tarjetas de Solicitud */}
          <div className="flex-1 w-full max-w-md">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300 group text-left relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-red-600 to-transparent opacity-20 rounded-bl-full" />
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center mb-6 shadow-[0_8px_30px_rgba(239,68,68,0.3)] group-hover:scale-110 transition-transform">
                <Baby className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 font-heading">Horas de Matrona</h3>
              <p className="text-white/50 text-sm mb-6">Controles, planificación familiar y consultas ginecológicas.</p>
              <div className="flex items-center gap-2 text-red-400 font-bold group-hover:translate-x-2 transition-transform">
                Solicitar cupo ahora <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          </div>

        </div>
      </div>

      {/* ─── MODAL FORMULARIO MATRONA ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => status !== 'loading' && setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-up flex flex-col max-h-[90vh]">
            {/* Header Rojo para Matrona */}
            <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 text-white shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">En Línea</span>
                <button onClick={() => setIsModalOpen(false)} disabled={status === "loading"} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <h3 className="text-2xl font-black font-heading flex items-center gap-2">
                <Baby className="w-6 h-6" /> Solicitar Matrona
              </h3>
              <p className="text-white/70 text-sm mt-2">Completa tus datos y te contactaremos para confirmar la hora.</p>
            </div>

            {/* Formulario */}
            <div className="p-6 md:p-8 overflow-y-auto">
              {status === "success" ? (
                <div className="text-center py-10 animate-fade-in">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-black text-[#1A1A2E] mb-2">¡Solicitud Enviada!</h4>
                  <p className="text-gray-500">Tus datos han sido registrados con éxito en nuestro sistema interno. Te contactaremos pronto.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-black text-[#1A1A2E] mb-2">Nombre Completo</label>
                    <div className="relative">
                      <UserSquare2 className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-semibold text-[#1A1A2E]" placeholder="Ej: María José Pérez" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-black text-[#1A1A2E] mb-2">RUT</label>
                      <div className="relative">
                        <FileText className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 ${rutError ? 'text-red-400' : 'text-gray-400'}`} />
                        <input type="text" required value={formData.rut} onChange={handleRutChange} className={`w-full bg-gray-50 border rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 outline-none transition-all font-semibold text-[#1A1A2E] ${rutError ? 'border-red-400 focus:border-red-500 focus:ring-red-100 text-red-600' : 'border-gray-200 focus:border-red-500 focus:ring-red-100'}`} placeholder="12.345.678-9" />
                      </div>
                      {rutError && <p className="text-red-500 text-xs font-bold mt-1">RUT Incorrecto</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-black text-[#1A1A2E] mb-2">Teléfono</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">+56 9</span>
                        <input type="tel" maxLength={8} required value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value.replace(/\D/g, '')})} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-16 pr-4 py-3.5 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-semibold text-[#1A1A2E]" placeholder="1234 5678" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-[#1A1A2E] mb-2">Prestación</label>
                    <select required value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value, subMotivo: ""})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-semibold text-[#1A1A2E]">
                      <option value="" disabled>Seleccione una prestación...</option>
                      <option value="Control Ginecologico">Control Ginecologico</option>
                      <option value="Control Regulación Fertilidad">Control Regulación Fertilidad</option>
                      <option value="Control climaterio">Control climaterio</option>
                      <option value="Ingreso Prenatal">Ingreso Prenatal</option>
                    </select>

                    {SUB_MOTIVOS[formData.motivo] && (
                      <div className="mt-4 animate-fade-in">
                        <label className="block text-sm font-black text-[#1A1A2E] mb-2">Detalle de la Prestación</label>
                        <select required value={formData.subMotivo} onChange={e => setFormData({...formData, subMotivo: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-semibold text-[#1A1A2E]">
                          <option value="" disabled>Seleccione una opción...</option>
                          {SUB_MOTIVOS[formData.motivo].map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.motivo && MOTIVO_NOTES[formData.motivo] && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-fade-in">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-red-800 leading-snug">
                          {MOTIVO_NOTES[formData.motivo]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-black text-[#1A1A2E] mb-2">Comentarios Adicionales <span className="text-gray-400 font-medium text-xs">(Opcional)</span></label>
                    <textarea rows={3} value={formData.detalles} onChange={e => setFormData({...formData, detalles: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all font-semibold text-[#1A1A2E] resize-none" placeholder="Si necesitas especificar algo más, escríbelo aquí..." />
                  </div>

                  {status === "error" && (
                    <p className="text-red-500 text-sm font-bold text-center">Hubo un problema al enviar la solicitud. Intenta nuevamente.</p>
                  )}

                  <button 
                    type="submit" 
                    disabled={status === "loading"}
                    className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-black py-4 rounded-xl shadow-lg transition-all hover:-translate-y-1 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2 mt-4"
                  >
                    {status === "loading" ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</> : "Enviar Solicitud"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
