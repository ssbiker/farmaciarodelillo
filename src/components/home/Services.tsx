"use client";

import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Stethoscope, Users, Baby, Pill, Activity, Syringe,
  Smile, Heart, Eye, Brain
} from "lucide-react";

const services = [
  { icon: Stethoscope, title: "Medicina General", desc: "Atención integral para jóvenes, adultos y adultos mayores con enfoque preventivo.", color: "#7B2FBE", bg: "rgba(123,47,190,0.08)" },
  { icon: Users, title: "Salud Familiar", desc: "Cuidado continuo y preventivo para todo el núcleo familiar.", color: "#5CB85C", bg: "rgba(92,184,92,0.08)" },
  { icon: Baby, title: "Control del Niño Sano", desc: "Seguimiento del desarrollo físico y psicomotor en la infancia.", color: "#F5C518", bg: "rgba(245,197,24,0.12)" },
  { icon: Pill, title: "Farmacia", desc: "Dispensación gratuita de medicamentos para tratamientos indicados.", color: "#7B2FBE", bg: "rgba(123,47,190,0.08)" },
  { icon: Activity, title: "Kinesiología", desc: "Rehabilitación física, terapias respiratorias y atención motora.", color: "#5CB85C", bg: "rgba(92,184,92,0.08)" },
  { icon: Syringe, title: "Vacunatorio", desc: "Inmunización según el Programa Nacional de Inmunizaciones (PNI).", color: "#F5C518", bg: "rgba(245,197,24,0.12)" },
  { icon: Smile, title: "Salud Dental", desc: "Atención odontológica preventiva y curativa para toda la familia.", color: "#7B2FBE", bg: "rgba(123,47,190,0.08)" },
  { icon: Heart, title: "Salud Cardiovascular", desc: "Programa de atención y control de enfermedades cardiovasculares crónicas.", color: "#5CB85C", bg: "rgba(92,184,92,0.08)" },
  { icon: Brain, title: "Salud Mental", desc: "Apoyo psicológico, consejería y atención en salud mental comunitaria.", color: "#F5C518", bg: "rgba(245,197,24,0.12)" },
];

export function Services() {
  const header = useScrollAnimation(0.05);
  const cards  = useScrollAnimation(0.05);

  return (
    <section id="servicios" className="py-28 bg-[var(--color-blanco-perla)] relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-[0.04] animate-blob"
        style={{ background: "var(--color-morado)" }} />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-[0.04] animate-blob"
        style={{ background: "var(--color-verde)", animationDelay: "4s" }} />

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Header */}
        <div ref={header.ref} className={`text-center max-w-3xl mx-auto mb-20 ${header.visible ? "animate-fade-up" : "opacity-0"}`}>
          <span className="inline-block text-[var(--color-verde-oscuro)] bg-[rgba(92,184,92,0.1)] font-bold text-xs uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4">
            Nuestras Prestaciones
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--color-foreground)] mb-5 font-heading leading-tight">
            Atención Médica{" "}
            <span className="gradient-text">Integral</span>
          </h2>
          <p className="text-lg text-[var(--color-foreground)]/60 leading-relaxed">
            Ofrecemos una amplia gama de prestaciones de salud enfocadas en la prevención, 
            promoción y tratamiento — <strong className="text-[var(--color-foreground)]/80">completamente gratuitas</strong> para nuestros inscritos.
          </p>
        </div>

        {/* Grid */}
        <div ref={cards.ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, idx) => (
            <div
              key={idx}
              className={`shimmer-card rounded-3xl p-7 group cursor-default ${cards.visible ? `animate-card-in` : "opacity-0"}`}
              style={{ animationDelay: `${0.05 * idx}s` }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-lg"
                style={{ background: service.bg, color: service.color }}
              >
                <service.icon className="w-7 h-7" />
              </div>

              {/* Accent bar */}
              <div
                className="w-10 h-1 rounded-full mb-4 transition-all duration-500 group-hover:w-16"
                style={{ background: service.color }}
              />

              <h3 className="text-lg font-bold text-[var(--color-foreground)] mb-2 font-heading group-hover:text-[var(--color-morado)] transition-colors duration-300">
                {service.title}
              </h3>
              <p className="text-[var(--color-foreground)]/55 text-sm leading-relaxed">
                {service.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
