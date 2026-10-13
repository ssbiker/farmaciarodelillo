import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const b = fs.readFileSync(path.join(HERE, "..", "Guia_Usuario_Recetas_Farmacia.pdf")).toString("latin1");
const pages = (b.match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log("Paginas:", pages);
console.log("Contiene correo de soporte:", b.includes("difusionrodelillo@cmvalparaiso.cl") ? "si ✓" : "NO");
console.log("Contiene enlace mailto:", b.includes("mailto:") ? "si ✓" : "NO");
console.log("Tamano MB:", (fs.statSync(path.join(HERE, "..", "Guia_Usuario_Recetas_Farmacia.pdf")).size / 1048576).toFixed(2));
