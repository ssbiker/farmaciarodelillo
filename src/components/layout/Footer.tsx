"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Clock, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0F0F1E] text-white pt-20 pb-8 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-5 animate-blob"
        style={{ background: "radial-gradient(circle, var(--color-morado), transparent)" }} />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-5 animate-blob"
        style={{ background: "radial-gradient(circle, var(--color-verde), transparent)", animationDelay: "3s" }} />

      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 relative flex-shrink-0 bg-white/5 rounded-2xl p-2 border border-white/10">
                <Image src="/logo.png" alt="Logo CESFAM" fill sizes="56px" className="object-contain p-1" />
              </div>
              <div>
                <div className="font-black text-lg font-heading text-white">CESFAM</div>
                <div className="text-xs text-[var(--color-verde)] font-semibold tracking-wide">Rodelillo</div>
              </div>
            </div>
            <p className="text-white/40 text-sm leading-relaxed mb-5">
              Centro de Salud Familiar comprometido con la salud integral de la comunidad de Valparaíso.
            </p>
            <div className="flex items-center gap-1.5 text-white/30 text-xs">
              <Heart className="w-3.5 h-3.5 text-red-400/70" />
              <span>Salud para todas las familias</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-5">Navegación</h4>
            <ul className="space-y-3">
              {["Inicio", "Servicios", "Nosotros", "Contacto"].map((item) => (
                <li key={item}>
                  <Link
                    href={`/#${item.toLowerCase()}`}
                    className="text-white/50 hover:text-white text-sm transition-colors duration-200 hover:translate-x-1 inline-block"
                  >
                    {item}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/funcionarios"
                  className="text-[var(--color-morado-light)] hover:text-white text-sm transition-colors duration-200 font-semibold"
                >
                  Portal Funcionarios →
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-5">Contacto</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--color-morado-light)] mt-0.5 flex-shrink-0" />
                <span className="text-white/50 text-sm">La Merced 4350, Valparaíso</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[var(--color-verde)] flex-shrink-0" />
                <span className="text-white/50 text-sm">322 136 383 · 322 136 618</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[var(--color-morado-light)] flex-shrink-0" />
                <span className="text-white/50 text-sm">contacto@cesfamrodelillo.cl</span>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-5">Horario</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[var(--color-verde)] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-white/70 text-sm font-semibold">Lunes a Jueves</div>
                  <div className="text-white/40 text-xs">08:00 – 17:00 hrs</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[var(--color-amarillo)] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-white/70 text-sm font-semibold">Viernes</div>
                  <div className="text-white/40 text-xs">08:00 – 16:00 hrs</div>
                </div>
              </li>
              <li className="mt-3 inline-flex items-center gap-2 bg-yellow-900/20 text-yellow-400 text-xs px-3 py-1.5 rounded-full font-semibold border border-yellow-700/20">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0" />
                SAPU Lun–Vie 17:00–00:00
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white/25 text-xs">
          <p>&copy; {new Date().getFullYear()} CESFAM Rodelillo · Municipalidad de Valparaíso</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white/60 transition-colors">Privacidad</Link>
            <Link href="#" className="hover:text-white/60 transition-colors">Accesibilidad</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
