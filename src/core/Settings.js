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
    // Oclusion ambiental (GTAO): pase de pantalla completa que "asienta" props y roca
    // (contacto oscuro). SOLO en 'alto' (desktop con margen); demasiado caro para GPU
    // integrada/movil, donde el claroscuro ya lo dan la niebla y las luces puntuales.
    ao: true,
    particleDensity: 1.0,
    drawDistance: 70,       // niebla: fondo perdido lejos
    fogNear: 14,
    fogFar: 40,
    maxDynamicLights: 36,
    lightPool: 16,          // luces reales (sin sombra) que siguen al jugador
    streamingRadius: 4,     // segmentos activos a cada lado del jugador
    // `heavyDetail` (0..1): densidad de PROPS pesados que se fijan al CONSTRUIR el mundo
    // (nichos peatonales, basura, mallas sobresalidas, rotulos dobles). El mundo se arma una
    // sola vez con el preset inicial del dispositivo, asi que este valor decide cuanta
    // geometria extra carga el celular. En escritorio se aprovecha todo el detalle.
    heavyDetail: 1.0
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
    ao: false,
    particleDensity: 0.6,
    drawDistance: 55,
    fogNear: 12,
    fogFar: 30,
    maxDynamicLights: 22,
    lightPool: 12,
    streamingRadius: 3,
    heavyDetail: 0.75
  },
  // Preset por defecto en celular: prioriza framerate sobre fidelidad.
  movil: {
    label: 'Movil',
    // pixelRatio 1.25 (antes 1.5): en pantallas de alta densidad rebaja ~30% el numero de
    // fragmentos a sombrear — el mayor ahorro de GPU en celular sin ver "pixelado".
    pixelRatioCap: 1.25,
    shadows: false,
    shadowMapSize: 256,
    // Postprocesado APAGADO en celular: el EffectComposer renderiza la escena a un render
    // target a resolucion completa y UnrealBloom encadena varios passes de pantalla completa
    // (el mayor coste de fill-rate en GPU movil). Sin composer se renderiza directo al
    // framebuffer con el tone mapping ACES del propio renderer. El LED verde neon sigue
    // brillando por su material emisivo saturado, solo pierde el halo difuso del bloom.
    postprocessing: false,
    bloom: false,
    grain: false,
    vignette: false,
    ao: false,
    // Polvo minimo; la niebla volumetrica (MistSystem) se desactiva en tactil por overdraw.
    particleDensity: 0.3,
    drawDistance: 36,
    fogNear: 10,
    fogFar: 22,
    maxDynamicLights: 12,
    lightPool: 6,
    streamingRadius: 2,
    // Props pesados MUY reducidos: nichos peatonales mas espaciados, casi sin basura ni
    // mallas sueltas, un solo rotulo por tunel. Recupera el framerate en gama media/baja.
    heavyDetail: 0.4
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
    ao: false,
    particleDensity: 0.15,
    drawDistance: 30,
    fogNear: 8,
    fogFar: 17,
    maxDynamicLights: 8,
    lightPool: 5,
    streamingRadius: 2,
    heavyDetail: 0.25
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
    // Modo de mundo: 'grid' POR DEFECTO — la mina COMPLETA del plano (galerías + cruceros +
    // vía principal RN 96 + rampas a otro nivel + labores especiales). El corredor lineal
    // antiguo solo con `?mapa=linear`.
    this.worldMode = this._readWorldMode();
    this.audioEnabled = true;
    // Luminosidad de la mina: multiplicador aplicado a todas las luces de galeria
    // (PointLight/AmbientLight/HemiLight). NO afecta materiales emisivos (LEDs, cintas).
    this.brightness = 1.0;
    // Pool de luces: un conjunto FIJO de PointLights (sin sombra) sigue al jugador en vez
    // de mantener decenas de luces reales encendidas por todo el mapa. Cuenta constante =>
    // no hay recompilacion de shaders al recorrer. Poner en false restaura el comportamiento
    // antiguo (todas las luces fijas por presupuesto) si se detectara algun problema visual.
    this.lightPoolEnabled = true;
    this._listeners = new Set();
    this._brightnessListeners = new Set();
  }

  /**
   * Lee el modo de mundo del parametro `?mapa=` de la URL ('grid'|'linear').
   * Por DEFECTO el mundo es la retICula COMPLETA del plano (galerias + cruceros + rampas +
   * labores); el corredor lineal antiguo queda disponible solo con `?mapa=linear`.
   */
  _readWorldMode() {
    try {
      const p = new URLSearchParams(window.location.search).get('mapa');
      if (p === 'linear' || p === 'lineal') return 'linear';
    } catch { /* SSR/entorno sin window: usa el valor por defecto */ }
    return 'grid';
  }

  /** Fija el modo de mundo ('linear'|'grid'). */
  setWorldMode(key) {
    this.worldMode = key === 'grid' ? 'grid' : 'linear';
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
