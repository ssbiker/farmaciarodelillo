"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/#inicio", label: "Inicio" },
    { href: "/#servicios", label: "Servicios" },
    { href: "/#nosotros", label: "Nosotros" },
    { href: "/#contacto", label: "Contacto" },
    { href: "/funcionarios", label: "Portal Funcionarios" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-xl shadow-lg shadow-purple-900/5 py-2"
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-12 h-12 group-hover:scale-110 transition-transform duration-300">
              <Image
                src="/logo.png"
                alt="CESFAM Rodelillo"
                fill
                sizes="48px"
                className="object-contain drop-shadow-sm"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className={`text-base font-black tracking-tight transition-colors duration-300 font-heading ${isScrolled ? "text-[var(--color-morado)]" : "text-white drop-shadow"}`}>
                CESFAM
              </span>
              <span className={`text-xs font-semibold tracking-widest uppercase transition-colors duration-300 ${isScrolled ? "text-[var(--color-verde-oscuro)]" : "text-white/80 drop-shadow"}`}>
                Rodelillo
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <ul className="hidden lg:flex items-center gap-7">
            {navLinks.slice(0, 4).map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`text-sm font-semibold transition-all duration-300 relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:rounded-full after:bg-[var(--color-morado)] after:transition-all after:duration-300 hover:after:w-full ${
                    isScrolled ? "text-[var(--color-foreground)]/80 hover:text-[var(--color-morado)]" : "text-white/90 hover:text-white drop-shadow"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/funcionarios"
              className="bg-[var(--color-morado)] hover:bg-[var(--color-morado-oscuro)] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg shadow-purple-700/30 transition-all duration-300 hover:scale-105 hover:shadow-purple-700/50"
            >
              Portal Funcionarios
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className={`w-6 h-6 ${isScrolled ? "text-[var(--color-foreground)]" : "text-white"}`} />
            ) : (
              <Menu className={`w-6 h-6 ${isScrolled ? "text-[var(--color-foreground)]" : "text-white"}`} />
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-xl shadow-2xl border-t border-purple-100 py-6 px-6 animate-fade-up">
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-3 px-4 rounded-xl text-[var(--color-foreground)] font-semibold hover:bg-purple-50 hover:text-[var(--color-morado)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
