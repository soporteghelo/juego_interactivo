import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Configuracion de Vite para el simulador de mina.
 *
 * - `optimizeDeps.exclude` con Rapier: el paquete `-compat` carga su WASM de forma
 *   asincrona; excluirlo del pre-bundling evita problemas de inicializacion del modulo.
 * - `server.host` permite abrir el dev server desde un celular en la misma red WiFi
 *   (clave para probar la jugabilidad tactil en un dispositivo real).
 */
export default defineConfig({
  root: '.',
  server: {
    host: true,      // expone la IP de red local para probar en el celular
    port: 5000,
    open: false
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        visor: resolve(__dirname, 'visor.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@dimforge/rapier3d-compat')) return 'rapier';
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
