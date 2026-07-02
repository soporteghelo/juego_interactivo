/**
 * LightingRig: aplica la "REGLA DE ORO" del md y administra el presupuesto de luces.
 *
 * Regla de oro: NO hay luz ambiental difusa. Solo existen fuentes puntuales (LED, faros,
 * bombillas, headlamp). El fondo se pierde en negro a 10-15m (eso lo hace la niebla).
 *
 * Las luces reales (PointLight/SpotLight) son caras: se limitan por preset
 * (maxDynamicLights). El "resplandor" visual lo aporta sobre todo la geometria emisiva
 * + el bloom del postprocesado, asi que aunque una fuente no reciba PointLight real,
 * sigue brillando. Este rig decide quien recibe luz real (presupuesto).
 */
export class LightingRig {
  constructor({ scene, settings }) {
    this.scene = scene;
    this.settings = settings;
    this._activeLights = 0;
    this._shadowLights = 0;
  }

  get budget() {
    return this.settings.current.maxDynamicLights;
  }

  /**
   * Presupuesto de luces con SOMBRA (mucho mas caras: cada PointLight con sombra usa un
   * shadow map de cubo que se muestrea por pixel). Se acota fuerte para no hundir el FPS
   * en GPU integrada, ya que ahora todas las luces quedan activas de forma permanente
   * (ver World._pinLights) para evitar recompilaciones de shader al recorrer.
   */
  get shadowBudget() {
    return Math.min(8, this.budget);
  }

  /** ¿Queda presupuesto para una luz real cerca de la camara? */
  canAddLight() {
    return this._activeLights < this.budget;
  }

  /** ¿Queda presupuesto para una luz que proyecte SOMBRA? */
  canAddShadow() {
    return this._shadowLights < this.shadowBudget;
  }

  /** Registra que se uso una luz real (la cuenta la lleva el rig). */
  noteLight(n = 1) {
    this._activeLights += n;
  }

  /** Registra que se uso una luz con sombra. */
  noteShadow(n = 1) {
    this._shadowLights += n;
  }

  /** Libera presupuesto (al descargar un segmento). */
  releaseLight(n = 1) {
    this._activeLights = Math.max(0, this._activeLights - n);
  }
}
