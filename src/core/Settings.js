/**
 * Configuracion global y presets de calidad.
 *
 * Centraliza todos los toggles de rendimiento del plan (quality gating). Cada preset
 * ajusta sombras, postprocesado, densidad de particulas, distancia de dibujado y
 * pixelRatio para cumplir el objetivo de 60 FPS @ 1080p en GPU integrada y en celular.
 *
 * El preset se elige automaticamente segun el dispositivo (ver core/Device.js) y puede
 * forzarse manualmente desde el HUD.
 */

/**
 * Niveles de CONDICIONES INSEGURAS (configurable al inicio). Es un multiplicador que escala
 * el "desorden" del entorno: materiales botados, huecos en el piso, rocas/pernos sobresalidos,
 * malla rasgada, shotcrete fisurado, lodo, etc. Mas alto = mina mas peligrosa/desordenada.
 */
export const NIVELES_INSEGURIDAD = {
  bajo:    { label: 'Bajo',    factor: 0.4 },
  medio:   { label: 'Medio',   factor: 1.0 },
  alto:    { label: 'Alto',    factor: 1.9 },
  extremo: { label: 'Extremo', factor: 3.0 }
};

/** Presets disponibles. `draw*` en metros, coherentes con la niebla negra del md. */
export const QUALITY_PRESETS = {
  alto: {
    label: 'Alto',
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 1024,
    postprocessing: true,
    bloom: true,
    grain: true,
    vignette: true,
    particleDensity: 1.0,
    drawDistance: 70,       // niebla: fondo perdido lejos
    fogNear: 14,
    fogFar: 40,
    maxDynamicLights: 36,
    streamingRadius: 4      // segmentos activos a cada lado del jugador
  },
  medio: {
    label: 'Medio',
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMapSize: 512,
    postprocessing: true,
    bloom: true,
    grain: false,
    vignette: true,
    particleDensity: 0.6,
    drawDistance: 55,
    fogNear: 12,
    fogFar: 30,
    maxDynamicLights: 22,
    streamingRadius: 3
  },
  // Preset por defecto en celular: prioriza framerate sobre fidelidad.
  movil: {
    label: 'Movil',
    pixelRatioCap: 1.5,
    shadows: false,
    shadowMapSize: 256,
    postprocessing: true,
    bloom: true,           // el LED verde neon es clave del look; bloom barato
    grain: false,
    vignette: false,
    particleDensity: 0.35,
    drawDistance: 40,
    fogNear: 10,
    fogFar: 24,
    maxDynamicLights: 14,
    streamingRadius: 2
  },
  bajo: {
    label: 'Bajo',
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 256,
    postprocessing: false,
    bloom: false,
    grain: false,
    vignette: false,
    particleDensity: 0.2,
    drawDistance: 34,
    fogNear: 8,
    fogFar: 18,
    maxDynamicLights: 8,
    streamingRadius: 2
  }
};

/**
 * Estado de configuracion vivo. Otros sistemas leen `Settings.current`.
 * Es un singleton sencillo para no acoplar todo a una instancia.
 */
class SettingsState {
  constructor() {
    this.qualityKey = 'medio';
    this.current = { ...QUALITY_PRESETS.medio };
    // Nivel de condiciones inseguras (multiplicador de desorden/peligros del entorno).
    this.unsafeKey = 'medio';
    this.unsafeLevel = NIVELES_INSEGURIDAD.medio.factor;
    // Esquema de control: 'desktop' (teclado/raton) o 'touch' (celular).
    this.controlScheme = 'desktop';
    // Semilla del mundo procedural (compartible para reproducir escenarios).
    this.worldSeed = (Math.random() * 0xffffffff) >>> 0;
    this.audioEnabled = true;
    // Luminosidad de la mina: multiplicador aplicado a todas las luces de galeria
    // (PointLight/AmbientLight/HemiLight). NO afecta materiales emisivos (LEDs, cintas).
    this.brightness = 1.0;
    this._listeners = new Set();
    this._brightnessListeners = new Set();
  }

  /** Aplica un preset por clave ('alto'|'medio'|'movil'|'bajo'). */
  setQuality(key) {
    if (!QUALITY_PRESETS[key]) return;
    this.qualityKey = key;
    this.current = { ...QUALITY_PRESETS[key] };
    this._emit();
  }

  setControlScheme(scheme) {
    this.controlScheme = scheme;
  }

  /** Fija el nivel de condiciones inseguras ('bajo'|'medio'|'alto'|'extremo'). */
  setUnsafeLevel(key) {
    if (!NIVELES_INSEGURIDAD[key]) return;
    this.unsafeKey = key;
    this.unsafeLevel = NIVELES_INSEGURIDAD[key].factor;
  }

  /**
   * Ajusta la luminosidad general de la mina (rango 0.1–2.0, paso recomendado 0.1).
   * Afecta solo PointLight/AmbientLight/HemisphereLight — los materiales emisivos
   * (cintas reflectivas, LED strips, luminarias) NO se modifican.
   */
  setBrightness(v) {
    this.brightness = parseFloat(Math.max(0.1, Math.min(2.0, v)).toFixed(1));
    this._brightnessListeners.forEach((fn) => fn(this.brightness));
  }

  /** Suscripcion a cambios de luminosidad. */
  onBrightness(fn) {
    this._brightnessListeners.add(fn);
    return () => this._brightnessListeners.delete(fn);
  }

  /** Suscripcion a cambios de calidad (renderer/postprocesado reaccionan). */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this.current, this.qualityKey));
  }
}

export const Settings = new SettingsState();
