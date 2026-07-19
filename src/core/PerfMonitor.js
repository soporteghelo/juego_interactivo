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

    if (fps < this.targetFps - 7 && idx < ORDEN.length - 1) {
      // Rendimiento insuficiente → baja de nivel y espera a que estabilice.
      const nuevo = ORDEN[idx + 1];
      Settings.setQuality(nuevo);
      this._cooldown = 3.5;
      this._subidasSeguidas = 0;
      this.bus?.emit('perf:quality', { key: nuevo, fps: Math.round(fps), dir: 'down' });
    } else if (fps > this.targetFps + 20 && idx > 0) {
      // Sobra margen: sube solo tras varias ventanas holgadas (evita ping-pong).
      if (++this._subidasSeguidas >= 3) {
        const nuevo = ORDEN[idx - 1];
        Settings.setQuality(nuevo);
        this._cooldown = 5.0;
        this._subidasSeguidas = 0;
        this.bus?.emit('perf:quality', { key: nuevo, fps: Math.round(fps), dir: 'up' });
      }
    } else {
      this._subidasSeguidas = 0;
    }
  }
}
