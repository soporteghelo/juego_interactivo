/**
 * Pool de objetos generico.
 *
 * Optimizacion clave del plan: evita crear/destruir objetos en caliente (particulas,
 * luces dinamicas, NPCs, efectos de eventos). Se reutilizan instancias inactivas.
 *
 * @example
 *   const pool = new ObjectPool(() => new THREE.Sprite(), s => s.visible = false);
 *   const s = pool.acquire();   // obtiene uno
 *   pool.release(s);            // lo devuelve para reutilizar
 */
export class ObjectPool {
  /**
   * @param {() => any} factory   crea una nueva instancia cuando el pool esta vacio
   * @param {(obj:any) => void} [reset]  prepara una instancia para reutilizarse
   * @param {number} [prewarm]    cuantas instancias precrear
   */
  constructor(factory, reset = () => {}, prewarm = 0) {
    this._factory = factory;
    this._reset = reset;
    this._free = [];
    this._active = new Set();
    for (let i = 0; i < prewarm; i++) this._free.push(this._factory());
  }

  /** Obtiene una instancia lista para usar. */
  acquire() {
    const obj = this._free.pop() ?? this._factory();
    this._active.add(obj);
    return obj;
  }

  /** Devuelve una instancia al pool (la resetea para el proximo uso). */
  release(obj) {
    if (!this._active.has(obj)) return;
    this._active.delete(obj);
    this._reset(obj);
    this._free.push(obj);
  }

  /** Itera sobre las instancias actualmente en uso. */
  forEachActive(fn) {
    this._active.forEach(fn);
  }

  get activeCount() {
    return this._active.size;
  }
}
