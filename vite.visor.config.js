import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Plugin dev: en modo desarrollo Vite siempre sirve index.html en la raiz "/",
 * ignorando el `input` (que solo aplica al build). Para que el puerto 5001 muestre
 * el visor y no el simulador, reescribimos "/" -> "/visor.html".
 */
function servirVisorEnRaiz() {
  return {
    name: 'servir-visor-en-raiz',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url === '/index.html') req.url = '/visor.html';
        next();
      });
    }
  };
}

/** Config del VISUALIZADOR de elementos — puerto 5001. */
export default defineConfig({
  root: '.',
  plugins: [servirVisorEnRaiz()],
  server: {
    host: true,
    port: 5001,
    open: '/visor.html'
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        visor: resolve(__dirname, 'visor.html')
      }
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
