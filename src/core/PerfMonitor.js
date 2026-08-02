import { Settings } from './Settings.js';

/**
 * MONITOR DE RENDIMIENTO ADAPTATIVO (DRS — Dynamic Resolution/Quality Scaling).
 *
 * Mide los FPS reales en ventanas cortas y AJUSTA el preset de calidad al vuelo:
 *  - Si el framerate cae de forma sostenida → baja un nivel (menos pixelRatio, sombras,
 *    postprocesado, distancia de dibujado) para recuperar fluidez.
 *  - Si sobra rendimiento de forma sostenida → sube un nivel (con histéresis para no oscilar).
 *
 * Es la salvaguarda "definitiva" multi-dispositivo: da igual el hardware (PC potente, GPU
 * integrada o celular), el juego converge solo a un preset jugable. El cambio de calidad se
 * propaga por Settings.onChange → Renderer (pixelRatio/sombras) y PostFX reaccionan en vivo.
 *
 * CUIDADO — cambiar de preset NO es gratis: al alternar sombras o postprocesado cambian las
 * claves de programa de Three y se RECOMPILAN todos los shaders (~1 s de congelacion en GPU
 * integrada). Por eso el monitor es deliberadamente perezoso para BAJAR:
 *  - no juzga hasta pasados unos segundos desde `engine:begin` (los primeros frames aun suben
 *    texturas a la GPU y disparan JIT: siempre parecen lentos),
 *  - exige DOS ventanas malas seguidas antes de bajar (un tiron aislado no cuenta).
 * Sin eso, el arranque caia en un circulo vicioso: primeros frames lentos → baja calidad →
 * recompilacion completa → mas tirones → vuelve a bajar. Justo el "lag antes de jugar".
 */

const ORDEN = ['alto', 'medio', 'movil', 'bajo']; // de más a menos exigente

export class PerfMonitor {
  /**
   * @param {{ bus?:object, targetFps?:number, ventana?:number, calentamiento?:number }} opts
   */
  constructor({ bus = null, targetFps = 45, ventana = 2.0, calentamiento = 3.0 } = {}) {
    this.bus = bus;
    this.targetFps = targetFps;
    this.ventana = ventana;
    this._t = 0;
    this._frames = 0;
    this._cooldown = calentamiento; // ignora los primeros segundos (carga/JIT/compilación)
    this._subidasSeguidas = 0;
    this._bajadasSeguidas = 0;

    // Al entrar de verdad al juego se reinicia el calentamiento: los primeros segundos de
    // gameplay suben texturas y geometria a la GPU y no representan el rendimiento real.
    this.bus?.on?.('engine:begin', () => {
      this._cooldown = 5.0;
      this._t = 0;
      this._frames = 0;
      this._bajadasSeguidas = 0;
    });
  }

  update(dt) {
    // Ignora frames larguísimos (pestaña en 2º plano, GC) que ensucian la media.
    if (dt > 0.5) return;
    this._t += dt;
    this._frames++;
    if (this._cooldown > 0) { this._cooldown -= dt; if (this._t >= this.ventana) { this._t = 0; this._frames = 0; } return; }
    if (this._t < this.ventana) return;

    const fps = this._frames / this._t;
    this._t = 0;
    this._frames = 0;

    const idx = ORDEN.indexOf(Settings.qualityKey);
    if (idx === -1) return;

    // ESCALON DE RESOLUCION. Al llegar a 'bajo' ya no quedan sombras ni postprocesado que
    // apagar: antes el monitor se quedaba sin margen y el juego se estancaba ahi. Rasterizar
    // menos pixeles es lo unico que sigue dando FPS, y ademas es barato — cambiar el pixelRatio
    // no recompila shaders, asi que puede moverse en pasos pequeños y sin la pereza que exige
    // la escalera de presets.
    if (idx === ORDEN.length - 1) {
      if (fps < this.targetFps - 7) {
        if (++this._bajadasSeguidas >= 2 && Settings.setResolutionScale(Settings.resolutionScale - 0.1)) {
          this._bajadasSeguidas = 0;
          this.bus?.emit('perf:quality', { key: Settings.qualityKey, fps: Math.round(fps), dir: 'down', escala: Settings.resolutionScale });
        }
        this._subidasSeguidas = 0;
        return;
      }
      // Recupera nitidez ANTES de intentar subir de preset: es el cambio menos disruptivo.
      if (fps > this.targetFps + 20 && Settings.resolutionScale < 1) {
        if (++this._subidasSeguidas >= 3 && Settings.setResolutionScale(Settings.resolutionScale + 0.1)) {
          this._subidasSeguidas = 0;
          this.bus?.emit('perf:quality', { key: Settings.qualityKey, fps: Math.round(fps), dir: 'up', escala: Settings.resolutionScale });
        }
        this._bajadasSeguidas = 0;
        return;
      }
    }

    if (fps < this.targetFps - 7 && idx < ORDEN.length - 1) {
      // Rendimiento insuficiente. Bajar cuesta una recompilacion completa de shaders, asi que
      // se exige que la caida se repita en DOS ventanas seguidas (~4 s) antes de tocar nada.
      if (++this._bajadasSeguidas < 2) { this._subidasSeguidas = 0; return; }
      const nuevo = ORDEN[idx + 1];
      Settings.setQuality(nuevo);
      this._cooldown = 4.0;
      this._subidasSeguidas = 0;
      this._bajadasSeguidas = 0;
      this.bus?.emit('perf:quality', { key: nuevo, fps: Math.round(fps), dir: 'down' });
    } else if (fps > this.targetFps + 20 && idx > 0) {
      this._bajadasSeguidas = 0;
      // Sobra margen: sube solo tras varias ventanas holgadas (evita ping-pong).
      if (++this._subidasSeguidas >= 3) {
        const nuevo = ORDEN[idx - 1];
        Settings.setQuality(nuevo);
        this._cooldown = 5.0;
        this._subidasSeguidas = 0;
        this.bus?.emit('perf:quality', { key: nuevo, fps: Math.round(fps), dir: 'up' });
      }
    } else {
      // Zona estable: se olvidan tanto las ventanas malas como las holgadas.
      this._subidasSeguidas = 0;
      this._bajadasSeguidas = 0;
    }
  }
}
