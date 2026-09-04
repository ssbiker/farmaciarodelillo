import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gestión | CESFAM Rodelillo",
  description: "Sitio de Gestión Interna del CESFAM Rodelillo — Próximamente.",
};

export default function GestionPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#1A1A2E] to-[#050510] px-6 relative overflow-hidden">

      {/* Animated background orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">

        {/* Main Icon */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-purple-900/50 mx-auto rotate-3 group-hover:rotate-0 transition-transform">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 w-32 h-32 mx-auto rounded-3xl border-2 border-purple-500/40 animate-ping" />
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white/80 text-xs font-bold px-4 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          EN DESARROLLO
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl font-black text-white mb-4 leading-tight">
          Módulo de{" "}
          <span className="bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
            Gestión
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-white/60 text-lg font-medium mb-2">
          CESFAM Rodelillo
        </p>
        <p className="text-white/50 text-base max-w-md mx-auto mb-10">
          Estamos construyendo una plataforma de gestión interna para nuestro equipo.
          Pronto estará disponible con todas sus funcionalidades.
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-sm mb-10">
          <div className="flex justify-between text-xs font-bold text-white/40 mb-2">
            <span>Progreso</span>
            <span>49%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-1000"
              style={{ width: "49%" }}
            />
          </div>
        </div>

        {/* Features coming */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12 w-full max-w-lg">
          {[
            { icon: "📋", label: "Tablero Kanban" },
            { icon: "👥", label: "Gestión de Equipos" },
            { icon: "🔔", label: "Sistema de Alertas" },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 flex items-center gap-2"
            >
              <span className="text-xl">{f.icon}</span>
              <span className="text-white/70 text-xs font-semibold">{f.label}</span>
            </div>
          ))}
        </div>

        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/30 text-white font-bold px-6 py-3 rounded-full transition-all duration-300 hover:scale-105"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Volver al inicio
        </Link>
      </div>

      {/* Bottom decoration */}
      <p className="absolute bottom-6 text-white/20 text-xs font-medium">
        © {new Date().getFullYear()} CESFAM Rodelillo — Todos los derechos reservados
      </p>
    </main>
  );
}
