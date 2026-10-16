import { useState, useEffect } from "react";
import { X, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import {
  collection, onSnapshot, query, where,
  updateDoc, deleteDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { registrarAccion, registrarEliminacionDefinitiva } from "../lib/auditoria";
import { decryptRecetaFields } from "../lib/crypto";
import type { Receta, FarmaciaUser } from "../types";

function formatFecha(ts: any): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const COLLECTIONS = ["recetas_controladas", "recetas_cronicas", "recetas_maternales", "recetas_respiratorias"] as const;

export function PapeleraModal({
  farmaciaUser,
  onClose,
}: {
  farmaciaUser: FarmaciaUser;
  onClose: () => void;
}) {
  const [items, setItems] = useState<{ receta: Receta; coleccion: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDef, setConfirmDef] = useState<{ receta: Receta; coleccion: string } | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = COLLECTIONS.map((col) => {
      const q = query(collection(db, col), where("eliminada", "==", true));
      return onSnapshot(q, (snap) => {
        const nuevos = snap.docs.map((d) => ({
          receta: decryptRecetaFields({ id: d.id, ...d.data() } as Receta),
          coleccion: col,
        }));
        setItems((prev) => {
          const sinEsteCol = prev.filter((i) => i.coleccion !== col);
          return [...sinEsteCol, ...nuevos];
        });
        setLoading(false);
      });
    });
    return () => unsubs.forEach((u) => u());
  }, []);

  const handleRestaurar = async (item: { receta: Receta; coleccion: string }) => {
    setProcesando(item.receta.id);
    try {
      await updateDoc(doc(db, item.coleccion, item.receta.id), {
        eliminada: false,
        eliminadaPor: null,
        eliminadaEn: null,
        motivoEliminacion: null,
        actualizadoEn: Timestamp.now(),
      });
      await registrarAccion(item.coleccion, item.receta.id, "RESTAURACION", farmaciaUser);
    } finally {
      setProcesando(null);
    }
  };

  const handleEliminarDefinitivo = async () => {
    if (!confirmDef) return;
    setProcesando(confirmDef.receta.id);
    try {
      await registrarEliminacionDefinitiva(
        confirmDef.coleccion,
        confirmDef.receta.id,
        confirmDef.receta.nombrePaciente,
        confirmDef.receta.medicamento,
        farmaciaUser
      );
      await deleteDoc(doc(db, confirmDef.coleccion, confirmDef.receta.id));
      setConfirmDef(null);
    } finally {
      setProcesando(null);
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const ta = (a.receta.eliminadaEn as any)?.toDate?.()?.getTime() ?? 0;
    const tb = (b.receta.eliminadaEn as any)?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 sm:inset-8 md:inset-16 bg-white border border-[#DDE6F5] rounded-3xl z-50 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#DDE6F5] bg-[#F8FAFF] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-xl">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#0F1B35]">Papelera de Recetas</h2>
              <p className="text-xs text-[#5D7299] mt-0.5">
                Solo el administrador puede restaurar o eliminar definitivamente.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#EFF3FB] rounded-xl transition-colors text-[#5D7299] hover:text-[#0F1B35]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && sortedItems.length === 0 && (
            <div className="text-center py-16">
              <Trash2 className="w-12 h-12 text-[#C4D4EE] mx-auto mb-3" />
              <p className="text-[#5D7299] text-sm">La papelera está vacía.</p>
            </div>
          )}
          {!loading && sortedItems.length > 0 && (
            <div className="space-y-3">
              {sortedItems.map(({ receta, coleccion }) => (
                <div key={receta.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-red-100 rounded-2xl p-4 hover:border-red-200 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0F1B35]">{receta.nombrePaciente}</span>
                      <span className="text-[11px] bg-[#EFF3FB] px-1.5 py-0.5 rounded-full text-[#3D5278] font-mono">{receta.rut}</span>
                      <span className="text-[11px] bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full text-red-600">
                        {coleccion === "recetas_controladas" ? "💊 Controlada" : coleccion === "recetas_maternales" ? "🤰 Maternal" : coleccion === "recetas_respiratorias" ? "🫁 Respiratorio" : "📋 Crónica"} — Sec. {receta.sector}
                      </span>
                    </div>
                    <p className="text-sm text-brand-purple font-semibold mt-0.5">{receta.medicamento}</p>
                    {receta.motivoEliminacion && (
                      <p className="text-xs text-[#5D7299] mt-1">
                        <span className="text-[#8FA3C4]">Motivo:</span> {receta.motivoEliminacion}
                      </p>
                    )}
                    <p className="text-xs text-[#8FA3C4] mt-0.5">
                      Enviada por <span className="text-[#5D7299]">{receta.eliminadaPor ?? "—"}</span> • {formatFecha(receta.eliminadaEn)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestaurar({ receta, coleccion })}
                      disabled={procesando === receta.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Restaurar
                    </button>
                    <button
                      onClick={() => setConfirmDef({ receta, coleccion })}
                      disabled={procesando === receta.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar definitivo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm eliminación definitiva */}
      {confirmDef && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmDef(null)} />
          <div className="relative bg-white border border-red-200 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/20 p-3 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-black text-lg text-red-700">¡Acción irreversible!</h3>
                <p className="text-xs text-red-500">Esta operación no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-[#3D5278] mb-6">
              ¿Eliminar permanentemente la receta de{" "}
              <strong className="text-[#0F1B35]">{confirmDef.receta.nombrePaciente}</strong> ({confirmDef.receta.medicamento})?
              Se guardará un registro de quién realizó esta acción.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDef(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#3D5278] hover:bg-[#EFF3FB] transition-colors">
                Cancelar
              </button>
              <button onClick={handleEliminarDefinitivo} disabled={!!procesando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
                {procesando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
