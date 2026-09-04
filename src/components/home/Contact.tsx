"use client";

import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { MapPin, Phone, Clock, MessageCircle, Stethoscope, AlertCircle, CalendarDays } from "lucide-react";

export function Contact() {
  const { ref, visible } = useScrollAnimation(0.05);

  const scheduleItems = [
    {
      icon: MessageCircle,
      color: "#25D366",
      bg: "rgba(37,211,102,0.1)",
      title: "Horas de Morbilidad",
      lines: [
        "Lunes a Viernes",
        "08:00 – 08:20 hrs.",
        "Vía WhatsApp 📲 +56 9 9909 0929",
      ],
      badge: "WhatsApp",
      badgeColor: "bg-green-100 text-green-700",
    },
    {
      icon: Stethoscope,
      color: "#7B2FBE",
      bg: "rgba(123,47,190,0.1)",
      title: "🦷 Urgencia Dental",
      lines: [
        "Lunes a Viernes",
        "09:30 hrs.",
        "3er piso CESFAM",
      ],
      badge: "Dental",
      badgeColor: "bg-purple-100 text-purple-700",
    },
    {
      icon: AlertCircle,
      color: "#F5C518",
      bg: "rgba(245,197,24,0.12)",
      title: "🚨 Horario SAPU",
      lines: [
        "Lun–Vie: 17:00 – 00:00 hrs.",
        "Sáb, Dom y Festivos:",
        "08:00 – 00:00 hrs.",
      ],
      badge: "SAPU",
      badgeColor: "bg-yellow-100 text-yellow-700",
    },
    {
      icon: CalendarDays,
      color: "#5CB85C",
      bg: "rgba(92,184,92,0.1)",
      title: "📋 Otras Horas",
      lines: [
        "Acercarse al SOME de tu sector.",
        "Para informaciones:",
        "322 136 383 · 322 136 618",
      ],
      badge: "SOME",
      badgeColor: "bg-green-100 text-green-700",
    },
  ];

  return (
    <section id="contacto" className="py-28 bg-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] animate-blob"
          style={{ background: "var(--color-morado)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-[0.04] animate-blob"
          style={{ background: "var(--color-verde)", animationDelay: "4s" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Header */}
        <div ref={ref} className={`text-center mb-16 ${visible ? "animate-fade-up" : "opacity-0"}`}>
          <span className="inline-block text-[var(--color-morado)] bg-[rgba(123,47,190,0.08)] font-bold text-xs uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4">
            Información y Horarios
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--color-foreground)] font-heading leading-tight mb-4">
            ¿Cómo acceder a{" "}
            <span className="gradient-text">nuestros servicios?</span>
          </h2>
          <p className="text-[var(--color-foreground)]/55 max-w-2xl mx-auto">
            Toda la información actualizada sobre horarios, formas de solicitar horas y cómo contactarnos.
          </p>
        </div>

        {/* Schedule Cards */}
        <div className={`grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14 ${visible ? "animate-fade-up delay-100" : "opacity-0"}`}>
          {scheduleItems.map((item, i) => (
            <div
              key={i}
              className="shimmer-card rounded-3xl p-6 group"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                  style={{ background: item.bg, color: item.color }}
                >
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>
              <h3 className="font-bold text-[var(--color-foreground)] mb-3 text-sm font-heading leading-snug">
                {item.title}
              </h3>
              <ul className="space-y-1">
                {item.lines.map((line, j) => (
                  <li key={j} className="text-xs text-[var(--color-foreground)]/55 leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Map + Info */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div
            className={`lg:col-span-2 rounded-3xl overflow-hidden shadow-xl border border-[rgba(123,47,190,0.08)] ${visible ? "animate-fade-left delay-200" : "opacity-0"}`}
            style={{ minHeight: 340 }}
          >
            <iframe
              title="Ubicación CESFAM Rodelillo"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3345.1234567!2d-71.6295!3d-33.0458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9689e2c6e6f9fe41%3A0x5a3d62c7b0b9e9d2!2sLa%20Merced%204350%2C%20Valpara%C3%ADso%2C%20Regi%C3%B3n%20de%20Valpara%C3%ADso!5e0!3m2!1ses!2scl!4v1700000000000!5m2!1ses!2scl"
              className="w-full h-full border-0"
              style={{ minHeight: 340 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Contacto directo */}
          <div className={`flex flex-col gap-4 ${visible ? "animate-fade-right delay-200" : "opacity-0"}`}>
            {[
              {
                icon: MapPin,
                label: "Dirección",
                value: "La Merced 4350\nValparaíso, Chile",
                color: "var(--color-morado)",
                bg: "rgba(123,47,190,0.08)",
              },
              {
                icon: Phone,
                label: "Teléfonos",
                value: "322 136 383\n322 136 618",
                color: "var(--color-verde-oscuro)",
                bg: "rgba(92,184,92,0.08)",
              },
              {
                icon: Clock,
                label: "Horario General",
                value: "Lun–Jue: 08:00–17:00\nViernes: 08:00–16:00",
                color: "var(--color-morado)",
                bg: "rgba(123,47,190,0.08)",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="shimmer-card rounded-2xl p-4 flex items-start gap-4 group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: item.bg, color: item.color }}
                >
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-foreground)]/35 mb-0.5">
                    {item.label}
                  </div>
                  <div className="font-bold text-[var(--color-foreground)] text-sm whitespace-pre-line leading-relaxed">
                    {item.value}
                  </div>
                </div>
              </div>
            ))}

            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/56999090929?text=Hola,%20quiero%20solicitar%20hora%20de%20morbilidad"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#1EBF5A] text-white font-bold py-3.5 px-6 rounded-2xl transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/25"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Pedir hora Morbilidad
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
