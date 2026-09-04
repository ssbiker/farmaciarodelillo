"use client";

import { useState } from "react";

const WA_NUMBER = "56999090929";
const WA_MESSAGE = "Hola, quiero solicitar hora de morbilidad 🏥";
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;

export function WhatsAppButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2"
      style={{ isolation: "isolate" }}
    >
      {/* Tooltip label - aparece al hover */}
      <div
        className="transition-all duration-300 overflow-hidden"
        style={{
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
          pointerEvents: hovered ? "auto" : "none",
        }}
      >
        <div className="bg-[#111827] text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-xl whitespace-nowrap text-right leading-relaxed">
          <div>💬 Solicitar hora de Morbilidad</div>
          <div className="text-white/50 text-[10px] mt-0.5">Lun–Vie · 08:00 – 08:20 hrs</div>
        </div>
      </div>

      {/* WhatsApp button */}
      <a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp para solicitar hora de morbilidad"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "50%",
          backgroundColor: "#25D366",
          boxShadow: hovered
            ? "0 8px 32px rgba(37,211,102,0.55)"
            : "0 4px 20px rgba(37,211,102,0.4)",
          transform: hovered ? "scale(1.12)" : "scale(1)",
          transition: "all 0.25s cubic-bezier(.22,1,.36,1)",
          position: "relative",
          zIndex: 9999,
        }}
      >
        {/* Pulse ring */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid #25D366",
            animation: "wa-ping 2s ease-out infinite",
            opacity: 0.4,
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid #25D366",
            animation: "wa-ping 2s ease-out infinite",
            animationDelay: "0.7s",
            opacity: 0.2,
          }}
        />

        {/* WhatsApp SVG icon */}
        <svg
          viewBox="0 0 32 32"
          style={{ width: 34, height: 34, fill: "white", position: "relative", zIndex: 1 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16 0C7.164 0 0 7.163 0 16c0 2.822.737 5.469 2.027 7.77L0 32l8.437-2.01A15.93 15.93 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333a13.3 13.3 0 01-6.79-1.858l-.487-.29-5.007 1.193 1.215-4.876-.317-.5A13.273 13.273 0 012.667 16C2.667 8.637 8.636 2.667 16 2.667c7.363 0 13.333 5.97 13.333 13.333 0 7.364-5.97 13.333-13.333 13.333zm7.31-9.987c-.4-.2-2.366-1.167-2.732-1.3-.366-.133-.633-.2-.9.2-.267.4-1.033 1.3-1.267 1.567-.233.267-.467.3-.867.1-.4-.2-1.688-.622-3.215-1.983-1.188-1.06-1.99-2.37-2.223-2.77-.233-.4-.025-.616.175-.815.18-.178.4-.466.6-.7.2-.233.267-.4.4-.666.133-.267.067-.5-.033-.7-.1-.2-.9-2.167-1.233-2.967-.325-.778-.657-.673-.9-.686-.233-.013-.5-.016-.767-.016s-.7.1-1.067.5c-.367.4-1.4 1.367-1.4 3.333s1.433 3.867 1.633 4.133c.2.267 2.82 4.3 6.833 6.033.954.412 1.699.658 2.28.842.957.305 1.83.262 2.52.159.768-.115 2.366-.966 2.7-1.9.333-.933.333-1.733.233-1.9-.1-.167-.366-.267-.766-.467z"/>
        </svg>
      </a>

      {/* CSS animation for ping */}
      <style>{`
        @keyframes wa-ping {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
