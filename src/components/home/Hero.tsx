"use client";

import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, HeartPulse, Shield, Clock, Wifi, Zap, Stethoscope, RadioTower } from "lucide-react";

const stats = [
  { value: "SAPU", label: "Servicio de Atención Primaria de Urgencia", icon: Zap, color: "#F5C518" },
  { value: "RX", label: "Radiografías Dentales disponibles", icon: RadioTower, color: "#5CB85C" },
  { value: "SOME", label: "Solicita horas en tu sector", icon: Stethoscope, color: "#F5C518" },
  { value: "APS", label: "Atención Primaria de Salud", icon: HeartPulse, color: "#5CB85C" },
];

export function Hero() {
  const { ref, visible } = useScrollAnimation(0.01);

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Background image del CESFAM */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/cesfam.jpg"
          alt="CESFAM Rodelillo"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          quality={90}
        />
        {/* Overlay gradiente premium */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A2E]/90 via-[#1A1A2E]/70 to-[var(--color-morado-oscuro)]/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E]/80 via-transparent to-transparent" />
      </div>

      {/* Animated blobs de fondo */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20 animate-blob"
          style={{ background: "radial-gradient(circle, var(--color-morado) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15 animate-blob"
          style={{ background: "radial-gradient(circle, var(--color-verde) 0%, transparent 70%)", animationDelay: "3s" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: Text */}
          <div ref={ref} className="text-white">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 glass-dark px-4 py-2 rounded-full mb-8 text-sm border border-white/10 ${visible ? "animate-fade-up" : "opacity-0"}`}>
              <span className="w-2 h-2 rounded-full bg-[var(--color-verde)] ripple-dot flex-shrink-0" />
              <span className="text-white/80 font-medium">Centro de Salud Familiar · Valparaíso</span>
            </div>

            {/* Heading */}
            <h1 className={`text-5xl md:text-6xl xl:text-7xl font-black leading-[1.05] mb-6 font-heading ${visible ? "animate-fade-up delay-100" : "opacity-0"}`}>
              Tu salud,{" "}
              <span className="relative inline-block">
                <span style={{
                  background: "linear-gradient(135deg, #F5C518, #5CB85C)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  nuestra misión
                </span>
              </span>
            </h1>

            {/* Sub */}
            <p className={`text-lg md:text-xl text-white/70 mb-10 max-w-lg leading-relaxed ${visible ? "animate-fade-up delay-200" : "opacity-0"}`}>
              Brindamos atención médica integral, cercana y de calidad a toda la comunidad de Rodelillo y sectores aledaños de Valparaíso.
            </p>

            {/* CTAs */}
            <div className={`flex flex-col sm:flex-row gap-4 mb-14 ${visible ? "animate-fade-up delay-300" : "opacity-0"}`}>
              <Link
                href="#servicios"
                className="group bg-[var(--color-morado)] hover:bg-[var(--color-morado-oscuro)] text-white px-8 py-4 rounded-2xl font-bold text-base shadow-2xl shadow-purple-900/40 transition-all duration-300 hover:scale-105 hover:shadow-purple-900/60 flex items-center justify-center gap-2"
              >
                Ver Servicios
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#contacto"
                className="glass text-white hover:bg-white/25 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 border border-white/20"
              >
                Cómo llegar
              </Link>
            </div>

            {/* Badges flotantes */}
            <div className={`flex flex-wrap gap-3 ${visible ? "animate-fade-up delay-400" : "opacity-0"}`}>
              {[
                { icon: HeartPulse, text: "Atención Primaria" },
                { icon: Shield, text: "100% Gratuito" },
                { icon: Clock, text: "SAPU Lun–Vie 17–00 hrs" },
                { icon: Zap, text: "Morbilidad 08:00–08:20" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 glass-dark text-white/80 text-xs font-semibold px-3 py-2 rounded-xl border border-white/10">
                  <Icon className="w-3.5 h-3.5 text-[var(--color-amarillo)]" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Stats cards */}
          <div className={`hidden lg:grid grid-cols-2 gap-4 ${visible ? "animate-fade-right delay-200" : "opacity-0"}`}>
            {stats.map((stat, i) => (
              <div
                key={i}
                className="glass-dark rounded-2xl p-5 border border-white/10 text-white text-center animate-card-in group hover:border-white/20 transition-all duration-300"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: `${stat.color}25`, color: stat.color }}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-black font-heading mb-1" style={{
                  background: i % 2 === 0
                    ? "linear-gradient(135deg, var(--color-amarillo), var(--color-amarillo-light))"
                    : "linear-gradient(135deg, var(--color-verde), #7EC67E)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  {stat.value}
                </div>
                <div className="text-white/55 text-[11px] font-medium leading-tight">{stat.label}</div>
              </div>
            ))}

            {/* Logo card */}
            <div className="col-span-2 glass-dark rounded-2xl p-4 border border-white/10 flex items-center gap-4 animate-float">
              <div className="w-16 h-16 relative flex-shrink-0">
                <Image 
                  src="/logo.png" 
                  alt="Logo CESFAM Rodelillo" 
                  fill 
                  loading="eager"
                  sizes="64px"
                  className="object-contain drop-shadow-lg" 
                />
              </div>
              <div className="text-white">
                <div className="font-black text-sm font-heading">CESFAM Rodelillo</div>
                <div className="text-white/50 text-xs mt-0.5">Centro de Salud Familiar</div>
                <div className="text-white/40 text-[10px] mt-1">La Merced 4350, Valparaíso</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <svg viewBox="0 0 1440 100" fill="none" className="w-full block">
          <path d="M0 100L80 88C160 76 320 52 480 40C640 28 800 28 960 34C1120 40 1280 52 1360 58L1440 64V100H0Z" fill="var(--color-blanco-perla)" />
        </svg>
      </div>
    </section>
  );
}
