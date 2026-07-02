/**
 * Generador de numeros pseudoaleatorios seedable (mulberry32).
 *
 * La generacion procedural debe ser reproducible: con la misma semilla se obtiene
 * exactamente el mismo trazado de galerias. Permite compartir/guardar escenarios.
 */
export class Rng {
  /** @param {number} [seed] semilla entera; por defecto derivada del reloj. */
  constructor(seed = Date.now() >>> 0) {
    this.seed = seed >>> 0;
    this._state = this.seed;
  }

  /** Siguiente flotante en [0, 1). */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flotante en [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Entero en [min, max] (ambos inclusive). */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** Devuelve true con probabilidad p (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** Elemento aleatorio de un arreglo. */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Reinicia el generador a su semilla original. */
  reset() {
    this._state = this.seed;
  }
}
