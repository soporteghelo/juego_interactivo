/**
 * CESION DE HILO POR PRESUPUESTO DE TIEMPO (time slicing).
 *
 * Los bucles largos de construccion (armar 184 tramos de mina) tienen que devolver el control
 * al navegador cada poco o la pantalla de carga se queda CONGELADA: no repinta el mensaje de
 * estado ni la barra de progreso, y el usuario lo lee como "se colgo".
 *
 * Ceder cada N elementos no funciona bien porque los elementos cuestan cosas muy distintas
 * (una interseccion con refugio cuesta 20 veces mas que un tunel corto): con N fijo se alternan
 * bloqueos de 300 ms con cesiones inutiles. Aqui se cede por TIEMPO: se trabaja hasta agotar el
 * presupuesto (~10 ms, medio frame) y solo entonces se cede.
 *
 * La cesion usa el mecanismo mas rapido disponible:
 *   1. `scheduler.yield()`  — la API nativa: vuelve en el mismo turno de tareas, sin espera.
 *   2. `MessageChannel`     — macrotarea inmediata; deja repintar sin el retardo de setTimeout.
 *   3. `setTimeout(0)`      — respaldo (el navegador lo limita a 1-4 ms por llamada).
 *
 * Con setTimeout puro, 46 cesiones costaban ~200 ms de pura espera.
 */

/** Cede el hilo al navegador por el camino mas rapido que soporte. */
export function cederHilo() {
  // API nativa de planificacion (Chrome 129+): reanuda antes que cualquier macrotarea.
  const s = globalThis.scheduler;
  if (s && typeof s.yield === 'function') return s.yield();

  if (typeof MessageChannel === 'function') {
    return new Promise((resolve) => {
      const canal = new MessageChannel();
      canal.port1.onmessage = () => { canal.port1.close(); resolve(); };
      canal.port2.postMessage(null);
    });
  }

  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Crea un cedente con presupuesto: llamalo tras cada unidad de trabajo y solo cedera cuando se
 * hayan consumido `presupuestoMs` desde la ultima cesion.
 *
 *   const ceder = crearCedente(10, (hecho, total) => onProgress(hecho, total));
 *   for (const cosa of cosas) { construir(cosa); await ceder(++hecho, total); }
 *
 * @param {number} presupuestoMs  ms de trabajo entre cesiones (por defecto medio frame)
 * @param {(hecho:number, total:number) => void} [alCeder]  aviso de progreso en cada cesion
 * @returns {(hecho?:number, total?:number) => Promise<void>}
 */
export function crearCedente(presupuestoMs = 10, alCeder = null) {
  let ultima = performance.now();
  return async (hecho = 0, total = 0) => {
    if (performance.now() - ultima < presupuestoMs) return;
    alCeder?.(hecho, total);
    await cederHilo();
    ultima = performance.now();
  };
}
