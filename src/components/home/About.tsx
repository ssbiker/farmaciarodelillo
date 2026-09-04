"use client";

import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import Image from "next/image";
import { MapPin, Building2, Users2, Award } from "lucide-react";

const pillars = [
  { icon: Users2, title: "Enfoque Familiar", desc: "Trabajamos con el modelo de salud familiar, entendiendo a cada persona dentro de su contexto social y familiar." },
  { icon: Building2, title: "Infraestructura Moderna", desc: "Nuestras instalaciones están equipadas para brindar la mejor atención posible a nuestra comunidad." },
  { icon: Award, title: "Compromiso Comunitario", desc: "Más de 20 años trabajando junto a las familias de Rodelillo y sectores aledaños de Valparaíso." },
];

export function About() {
  const left  = useScrollAnimation(0.05);
  const right = useScrollAnimation(0.05);

  return (
    <section id="nosotros" className="py-28 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: image + map badge */}
          <div ref={left.ref} className={`relative ${left.visible ? "animate-fade-left" : "opacity-0"}`}>
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-purple-900/10 aspect-[4/3]">
              <Image
                src="/cesfam.jpg"
                alt="CESFAM Rodelillo"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                quality={90}
              />
              {/* Overlay sutil */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E]/30 to-transparent" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 border border-purple-100 animate-float">
              <div className="w-10 h-10 bg-[rgba(123,47,190,0.1)] rounded-xl flex items-center justify-center text-[var(--color-morado)]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--color-foreground)]">La Merced 4350</div>
                <div className="text-xs text-[var(--color-foreground)]/50">Valparaíso, Chile</div>
              </div>
            </div>

            {/* Logo badge */}
            <div className="absolute -top-6 -left-6 bg-white rounded-2xl shadow-xl p-3 border border-purple-100 animate-float" style={{ animationDelay: "1.5s" }}>
              <div className="w-14 h-14 relative">
                <Image src="/logo.png" alt="Logo CESFAM" fill sizes="56px" className="object-contain" />
              </div>
            </div>

            {/* Accent blobs behind card */}
            <div className="absolute -z-10 -top-8 -left-8 w-48 h-48 rounded-full bg-purple-100 blur-3xl opacity-50" />
            <div className="absolute -z-10 -bottom-8 -right-8 w-48 h-48 rounded-full bg-green-100 blur-3xl opacity-50" />
          </div>

          {/* Right: text */}
          <div ref={right.ref} className={right.visible ? "animate-fade-right" : "opacity-0"}>
            <span className="inline-block text-[var(--color-morado)] bg-[rgba(123,47,190,0.08)] font-bold text-xs uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-5">
              Quiénes Somos
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-[var(--color-foreground)] mb-5 font-heading leading-tight">
              Cuidamos tu salud{" "}
              <span className="gradient-text">desde adentro</span>
            </h2>
            <p className="text-[var(--color-foreground)]/60 text-lg leading-relaxed mb-8">
              El CESFAM Rodelillo es un Centro de Salud Familiar dependiente de la Municipalidad de Valparaíso, 
              comprometido con la atención integral, humanizada y gratuita de las familias de nuestra comuna.
            </p>

            <div className="space-y-5 mb-10">
              {pillars.map((p, i) => (
                <div
                  key={i}
                  className={`flex gap-4 group ${right.visible ? `animate-fade-up delay-${(i + 1) * 100}` : "opacity-0"}`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-[rgba(123,47,190,0.08)] flex items-center justify-center text-[var(--color-morado)] flex-shrink-0 group-hover:bg-[var(--color-morado)] group-hover:text-white transition-all duration-300 group-hover:scale-110">
                    <p.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--color-foreground)] mb-1 font-heading group-hover:text-[var(--color-morado)] transition-colors">
                      {p.title}
                    </h4>
                    <p className="text-sm text-[var(--color-foreground)]/55 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://maps.google.com/?q=La+Merced+4350,+Valparaíso"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[var(--color-morado)] font-bold hover:gap-4 transition-all duration-300 group"
            >
              <MapPin className="w-4 h-4" />
              Ver en Google Maps
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
