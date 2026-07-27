/**
 * PERFILADO DE ARRANQUE — instrumentacion barata del boot, activable por URL.
 *
 * Sin `?perf` en la URL no hace absolutamente nada (las llamadas se reducen a un
 * `if` y una suma), asi que puede quedarse en produccion. Con `?perf` imprime en
 * consola una tabla con el coste de cada fase del arranque y un censo de la
 * escena (mallas, geometrias/materiales unicos, triangulos, luces con sombra),
 * que es lo que decide cuanto tarda `compileAsync` y el horneado de sombras.
 *
 * Uso:
 *   Perf.marca('construir mundo');   // cierra la fase anterior y abre esta
 *   Perf.fin();                      // cierra la ultima fase
 *   Perf.censo(scene);               // vuelca el censo de la escena
 *   Perf.tabla();                    // imprime el resumen
 */

const ACTIVO = (() => {
  try { return new URLSearchParams(location.search).has('perf'); } catch { return false; }
})();

class Perfilador {
  constructor() {
    this.activo = ACTIVO;
    this.fases = [];
    this._t0 = 0;
    this._nombre = null;
  }

  /** Cierra la fase en curso (si la hay) y abre una nueva. */
  marca(nombre) {
    if (!this.activo) return;
    this.fin();
    this._nombre = nombre;
    this._t0 = performance.now();
  }

  /** Cierra la fase en curso. */
  fin() {
    if (!this.activo || !this._nombre) return;
    this.fases.push([this._nombre, performance.now() - this._t0]);
    this._nombre = null;
  }

  /** Mide una funcion (sincrona o async) como una fase con nombre propio. */
  async medir(nombre, fn) {
    if (!this.activo) return fn();
    const t = performance.now();
    const r = await fn();
    this.fases.push([nombre, performance.now() - t]);
    return r;
  }

  /**
   * Mide una funcion SINCRONA que se llama muchas veces (una por tramo, por prop…) y ACUMULA
   * su coste bajo un mismo nombre. Sin `?perf` la sobrecarga es una comparacion booleana.
   */
  acumula(nombre, fn) {
    if (!this.activo) return fn();
    const t = performance.now();
    const r = fn();
    const ms = performance.now() - t;
    const i = this.fases.findIndex(([n]) => n === nombre);
    if (i >= 0) this.fases[i][1] += ms;
    else this.fases.push([nombre, ms]);
    return r;
  }

  /** Censo de la escena: lo que realmente paga compileAsync y el bake de sombras. */
  censo(scene) {
    if (!this.activo) return null;
    const geos = new Set(), mats = new Set();
    let objetos = 0, mallas = 0, instanciadas = 0, tris = 0;
    let luces = 0, lucesSombra = 0, emisoresSombra = 0;
    scene.traverse((o) => {
      objetos++;
      if (o.isLight) { luces++; if (o.castShadow) lucesSombra++; return; }
      if (!o.isMesh && !o.isInstancedMesh && !o.isPoints && !o.isLine) return;
      mallas++;
      if (o.isInstancedMesh) instanciadas++;
      if (o.castShadow) emisoresSombra++;
      if (o.geometry) {
        geos.add(o.geometry);
        const idx = o.geometry.index;
        const pos = o.geometry.attributes?.position;
        const n = idx ? idx.count / 3 : (pos ? pos.count / 3 : 0);
        tris += n * (o.isInstancedMesh ? o.count : 1);
      }
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => mats.add(x));
      else if (m) mats.add(m);
    });
    const c = {
      objetos, mallas, instanciadas,
      triangulos: Math.round(tris),
      geometriasUnicas: geos.size,
      materialesUnicos: mats.size,
      luces, lucesConSombra: lucesSombra, mallasQueProyectan: emisoresSombra
    };
    this.ultimoCenso = c;
    console.log('[perf] censo de escena', JSON.stringify(c));
    return c;
  }

  /** Imprime la tabla de fases ordenada por coste. */
  tabla() {
    if (!this.activo) return;
    this.fin();
    const total = this.fases.reduce((a, [, ms]) => a + ms, 0);
    console.log(`[perf] ARRANQUE: ${(total / 1000).toFixed(2)} s`);
    console.table(
      [...this.fases]
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, ms]) => ({
          fase: nombre,
          ms: Math.round(ms),
          '%': ((ms / total) * 100).toFixed(1)
        }))
    );
  }
}

export const Perf = new Perfilador();

// Con `?perf` queda accesible desde la consola del navegador (`__perf.fases`, `__perf.ultimoCenso`).
if (ACTIVO) { try { window.__perf = Perf; } catch { /* sin window */ } }
