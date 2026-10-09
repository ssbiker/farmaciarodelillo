import { useState, useRef, useEffect } from "react";
import { collection, doc, writeBatch, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import * as xlsx from "xlsx";
import { Package, Upload, AlertCircle, CheckCircle2, Search, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";
import type { MedicamentoInventario, FarmaciaUser } from "../types";

export function InventarioAdmin({ farmaciaUser }: { farmaciaUser: FarmaciaUser }) {
  const [inventario, setInventario] = useState<MedicamentoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<MedicamentoInventario[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, "inventario"), orderBy("nombre"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: MedicamentoInventario[] = [];
      snapshot.forEach((doc) => {
        data.push(doc.data() as MedicamentoInventario);
      });
      setInventario(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching inventario:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 });

        const parsedData: MedicamentoInventario[] = [];
        const now = Timestamp.now();

        // Encontrar los índices de las columnas dinámicamente
        // Buscamos la fila que contenga los headers principales "Código", "Nombre", "Stock"
        let headerRowIndex = -1;
        let colCodigo = -1;
        let colNombre = -1;
        let colStock = -1;

        for (let i = 0; i < Math.min(data.length, 10); i++) {
          const row = data[i];
          if (!row || !Array.isArray(row)) continue;
          
          row.forEach((cell, idx) => {
            if (typeof cell === 'string') {
              const lower = cell.toLowerCase();
              if (lower.includes("código") || lower.includes("codigo")) colCodigo = idx;
              else if (lower.includes("nombre") || lower.includes("artículo") || lower.includes("articulo")) colNombre = idx;
              else if (lower.includes("stock")) colStock = idx;
            }
          });

          if (colCodigo !== -1 && colNombre !== -1 && colStock !== -1) {
            headerRowIndex = i;
            break;
          }
        }

        // Si no encontró exactamente esas palabras, probamos con las posiciones por defecto 0, 1, 2
        if (headerRowIndex === -1) {
          colCodigo = 0;
          colNombre = 1;
          colStock = 2;
          headerRowIndex = 0; // Asumimos que empieza abajo
        }

        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[colCodigo]) continue; // Skip si no hay código

          const codigo = String(row[colCodigo]).trim();
          const nombre = String(row[colNombre] || "").trim();
          const stockVal = row[colStock];
          const stock = typeof stockVal === 'number' ? stockVal : parseInt(String(stockVal).replace(/\D/g, ''), 10) || 0;

          if (codigo && nombre && codigo !== "null" && nombre !== "null") {
            parsedData.push({
              codigo,
              nombre,
              stock,
              actualizadoEn: now
            });
          }
        }

        setPreviewData(parsedData);
      } catch (err) {
        console.error("Error parsing Excel:", err);
        alert("Ocurrió un error leyendo el archivo Excel. Asegúrate de que el formato sea correcto.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmUpload = async () => {
    if (!previewData || previewData.length === 0) return;
    setUploading(true);
    try {
      // Usar multiples batches si hay más de 500
      const chunks = [];
      for (let i = 0; i < previewData.length; i += 400) {
        chunks.push(previewData.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const item of chunk) {
          const docRef = doc(db, "inventario", item.codigo);
          batch.set(docRef, item, { merge: true }); // Merge por si hay otros campos, pero actualizará nombre y stock
        }
        await batch.commit();
      }

      setPreviewData(null);
      alert("¡Inventario sincronizado exitosamente con el Excel!");
    } catch (err) {
      console.error(err);
      alert("Error al sincronizar el inventario.");
    } finally {
      setUploading(false);
    }
  };

  const filtered = inventario.filter(i => 
    i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-10 flex justify-center"><RefreshCw className="w-8 h-8 text-brand-blue animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      
      {/* Vista Previa del Upload */}
      {previewData && (
        <div className="bg-white rounded-3xl border border-brand-blue/30 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-blue-50 border-b border-brand-blue/20 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-brand-blue flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" /> Vista Previa de Sincronización
              </h3>
              <p className="text-sm text-brand-blue/70 mt-1">
                Se encontraron <strong>{previewData.length}</strong> medicamentos en el archivo Excel.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={uploading}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-dark transition-colors flex items-center gap-2"
              >
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Sincronizando..." : "Confirmar y Subir Stock"}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-bold">Advertencia: Sincronización Maestra</p>
                <p>Al confirmar, el stock de la base de datos será reemplazado <strong>exactamente</strong> por los números que vienen en este Excel. Los descuentos temporales hechos hoy serán sobrescritos.</p>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold w-32">Código</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold">Medicamento</th>
                    <th className="px-4 py-2 text-right text-slate-500 font-semibold w-32">Stock a subir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.slice(0, 50).map((med, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{med.codigo}</td>
                      <td className="px-4 py-2 font-semibold text-slate-700">{med.nombre}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-xs ${med.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                          {med.stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 50 && (
              <p className="text-center text-xs text-slate-400 mt-3 italic">Mostrando los primeros 50 registros de {previewData.length}</p>
            )}
          </div>
        </div>
      )}

      {/* Header del inventario actual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#0F1B35] flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-blue" />
            Inventario y Stock
          </h2>
          <p className="text-sm text-[#7B90B5]">
            Administra el stock maestro de medicamentos. 
          </p>
        </div>
        
        <div>
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F1B35] hover:bg-[#1a2c54] text-white rounded-xl font-bold transition-all"
          >
            <Upload className="w-4 h-4" />
            Subir Excel (Stock Master)
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#A8BDD8]" />
        <input
          type="text"
          placeholder="Buscar por nombre o código de medicamento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-[#DDE6F5] rounded-2xl pl-12 pr-4 py-3.5 text-[#0F1B35] font-medium placeholder-[#A8BDD8] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 outline-none transition-all"
        />
      </div>

      {/* Tabla Actual */}
      <div className="bg-white rounded-3xl border border-[#DDE6F5] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFF] border-b border-[#DDE6F5]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#7B90B5] uppercase tracking-wider w-32">Código</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#7B90B5] uppercase tracking-wider">Medicamento</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-[#7B90B5] uppercase tracking-wider w-40">Stock Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3FC]">
              {inventario.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-[#7B90B5]">
                    <Package className="w-12 h-12 text-[#DDE6F5] mx-auto mb-3" />
                    <p className="font-semibold text-[#3D5278]">El inventario está vacío</p>
                    <p className="text-xs mt-1">Sube el archivo Excel para cargar el stock inicial.</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[#7B90B5]">
                    No se encontraron medicamentos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.codigo} className="hover:bg-[#F5F8FF] transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-[#7B90B5] bg-[#F0F4FF] px-2 py-1 rounded-md border border-[#DDE6F5]">
                        {item.codigo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-[#0F1B35]">{item.nombre}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-lg font-black text-sm border ${
                        item.stock <= 0 
                          ? 'bg-red-50 text-red-600 border-red-200' 
                          : item.stock <= 10 
                            ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-[#F8FAFF] border-t border-[#DDE6F5] px-6 py-3 text-xs text-[#7B90B5] flex justify-between items-center">
          <span>Total de ítems: <strong>{inventario.length}</strong></span>
          <span>{filtered.length !== inventario.length ? `(Filtrados: ${filtered.length})` : ''}</span>
        </div>
      </div>

    </div>
  );
}
