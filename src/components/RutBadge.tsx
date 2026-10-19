import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { formatRut } from "../lib/recetaHelpers";

export function RutBadge({
  rut,
  className = "",
  showCopy = true,
}: {
  rut: string | undefined | null;
  className?: string;
  showCopy?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const formatted = formatRut(rut);

  if (!formatted) return <span className="text-[#8FA3C4] italic text-xs">Sin RUT</span>;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formatted);
      } else {
        // Fallback para navegadores antiguos o contextos no seguros
        const textArea = document.createElement("textarea");
        textArea.value = formatted;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copiando RUT:", err);
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs whitespace-nowrap select-all ${className}`}
    >
      <span>{formatted}</span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className={`p-1 rounded-md transition-all active:scale-95 ${
            copied
              ? "bg-green-100 text-green-700 shadow-sm"
              : "text-[#8FA3C4] hover:text-brand-blue hover:bg-brand-blue/10"
          }`}
          title={copied ? "¡RUT copiado para AVIS!" : "Copiar RUT sin puntos para AVIS"}
          aria-label="Copiar RUT para AVIS"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-600 animate-in fade-in" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </span>
  );
}
