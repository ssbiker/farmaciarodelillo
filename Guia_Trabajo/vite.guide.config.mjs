// ============================================================
// Configuración de Vite SOLO para la sesión de capturas de la guía.
// Replica la configuración del proyecto (react + tailwind) pero
// apunta la caché a Guia_Trabajo para NO escribir dentro del proyecto.
// ============================================================
import { pathToFileURL } from "node:url";

const PROJ = "C:/Users/Sergio Andres/.gemini/antigravity/scratch/Recetas-Farmacia";
const WORK = PROJ + "/Guia_Trabajo";

const reactMod = await import(pathToFileURL(PROJ + "/node_modules/@vitejs/plugin-react/dist/index.js").href);
const tailwindMod = await import(pathToFileURL(PROJ + "/node_modules/@tailwindcss/vite/dist/index.mjs").href);

export default {
  root: PROJ,
  envDir: PROJ,
  cacheDir: WORK + "/.vite-cache",
  logLevel: "info",
  plugins: [reactMod.default(), tailwindMod.default()],
  server: {
    host: "127.0.0.1",
    port: 5199,
    strictPort: true,
    watch: {
      // No vigilar la carpeta de trabajo (perfiles de Chrome, capturas, caché):
      // sus cambios provocaban recargas en bucle de la página.
      ignored: ["**/Guia_Trabajo/**"],
    },
  },
};
