import * as THREE from 'three';
import { Rng } from '../procedural/Rng.js';
import { LayoutGenerator } from '../procedural/LayoutGenerator.js';
import { SegmentAssembler } from '../procedural/SegmentAssembler.js';
import { Settings } from '../core/Settings.js';

/**
 * World: orquesta la construccion del mundo procedural.
 *
 * Genera un trazado reproducible (semilla), lo ensambla (tramos + colisionadores + props),
 * expone el punto de aparicion y los interactuables, y hace un "streaming" ligero por
 * distancia (oculta tramos lejanos para ahorrar dibujado; la niebla ya los esconde).
 */
export class World {
  constructor({ scene, physics, assets, bus, lighting, seed }) {
    this.scene = scene;
    this.physics = physics;
    this.assets = assets;
    this.bus = bus;
    this.lighting = lighting;
    this.seed = seed;

    this.segments = [];
    this.interactables = [];
    this.hazards = [];
    this.spawnPoint = new THREE.Vector3(0, 1.4, -2);

    this._playerPos = new THREE.Vector3(0, 1.4, -2);
    this.bus.on('player:moved', ({ position }) => this._playerPos.copy(position));
  }

  async build(onProgress = () => {}) {
    const rng = new Rng(this.seed);
    const layout = new LayoutGenerator(rng).generate();

    const assembler = new SegmentAssembler({
      scene: this.scene,
      physics: this.physics,
      lighting: this.lighting,
      rng,
      bus: this.bus
    });

    const result = await assembler.assemble(layout, onProgress);
    this.segments = result.segments;
    this.interactables = result.interactables;
    this.hazards = result.hazards;
    this.spawnPoint = result.spawnPoint;

    // Centro aproximado de cada tramo (para el culling por distancia).
    for (const seg of this.segments) {
      const c = seg.group.position.clone();
      c.z -= seg.length / 2;
      seg._center = c;
    }

    this._pinLights();
  }

  /**
   * Saca TODAS las luces reales de los grupos de tramo y las cuelga de un grupo
   * persistente que nunca se oculta por distancia.
   *
   * Motivo (corrige el "lag" de ~7 s al recorrer): el culling por distancia oculta/muestra
   * grupos de tramo (`group.visible`). Si dentro de esos grupos hay PointLight/SpotLight,
   * ocultarlos cambia el NUMERO de luces activas en la escena, y Three.js RECOMPILA todos
   * los programas de shader (y reconstruye los shadow maps de cubo) cada vez que ese número
   * cambia — un tirón de varios segundos, brutal en GPU integrada.
   *
   * Al mantener las luces siempre presentes, el conteo es constante y no hay recompilaciones.
   * Las luces lejanas no cuestan nada visualmente: su alcance (`distance`) es <=13 m y la
   * niebla las oculta mucho antes del radio de culling.
   */
  _pinLights() {
    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'pinnedLights';
    this.scene.add(this.lightsGroup);

    // Asegura matrices de mundo antes de reparentar conservando la posicion global.
    this.scene.updateMatrixWorld(true);

    const lights = [];
    for (const seg of this.segments) {
      seg.group.traverse((o) => { if (o.isLight) lights.push(o); });
    }

    // Una luz es "pooleable" si es una fuente ambiental normal SIN sombra y NO es un
    // indicador/animada marcado como staticLight. Las de sombra (LED blanco de techo) y los
    // indicadores (estado de refugio) se mantienen FIJAS: sus sombras estan horneadas y sus
    // colores son informativos, no deben moverse.
    const poolable = [];
    const wp = new THREE.Vector3();
    for (const light of lights) {
      const esPool = Settings.lightPoolEnabled
        && !light.castShadow
        && !light.userData.staticLight
        && !light.userData.tick;
      if (esPool) {
        light.getWorldPosition(wp);
        poolable.push({
          x: wp.x, y: wp.y, z: wp.z,
          color: light.color.getHex(),
          intensity: light.intensity,
          distance: light.distance,
          decay: light.decay,
          _d2: Infinity
        });
      } else {
        // Fija: reparent conservando transform de mundo.
        this.lightsGroup.attach(light);
        light.userData.baseIntensity = light.intensity;
      }
    }

    // Quita de la escena las luces pooleables originales (las reemplaza el pool).
    if (Settings.lightPoolEnabled) {
      for (const light of lights) {
        if (!light.castShadow && !light.userData.staticLight && !light.userData.tick) {
          light.parent?.remove(light);
        }
      }
    }

    // Crea el POOL: un conjunto FIJO de PointLights que se reasignan a las fuentes mas
    // cercanas al jugador cada pocos frames. El conteo total de luces es constante -> no hay
    // recompilacion de shaders al recorrer, y solo N luces entran en el bucle por fragmento.
    this._lightSpecs = poolable;
    this._poolLights = [];
    if (Settings.lightPoolEnabled && poolable.length) {
      const poolSize = Math.min(Settings.current.lightPool ?? 12, poolable.length);
      for (let i = 0; i < poolSize; i++) {
        const pl = new THREE.PointLight(0xffffff, 0, 10, 2);
        pl.castShadow = false;
        this.lightsGroup.add(pl);
        this._poolLights.push(pl);
      }
      this._lightAccum = 0;
      this._assignPoolLights();
    }

    // Reacciona al control de luminosidad del jugador en tiempo real.
    Settings.onBrightness((v) => { this._applyBrightness(v); this._assignPoolLights(); });
    // Aplica la luminosidad inicial (por si el usuario ya la cambió antes de entrar).
    this._applyBrightness(Settings.brightness);
  }

  /**
   * Reasigna las luces del pool a las `_lightSpecs` mas cercanas al jugador. Constante en
   * numero de luces (no recompila); O(specs log specs) por el sort, con specs acotado.
   */
  _assignPoolLights() {
    const pool = this._poolLights;
    if (!pool || !pool.length || this._poolPaused) return;
    const specs = this._lightSpecs;
    const px = this._playerPos.x, py = this._playerPos.y, pz = this._playerPos.z;
    for (const s of specs) {
      const dx = s.x - px, dy = s.y - py, dz = s.z - pz;
      s._d2 = dx * dx + dy * dy + dz * dz;
    }
    specs.sort((a, b) => a._d2 - b._d2);
    const b = Settings.brightness;
    for (let i = 0; i < pool.length; i++) {
      const pl = pool[i];
      const s = specs[i];
      if (s) {
        pl.position.set(s.x, s.y, s.z);
        pl.color.setHex(s.color);
        pl.distance = s.distance;
        pl.decay = s.decay;
        pl.intensity = s.intensity * b;
      } else {
        pl.intensity = 0;
      }
    }
  }

  /** Escala la intensidad de las luces FIJAS sin tocar emissive/materials (el pool se escala aparte). */
  _applyBrightness(factor) {
    this.lightsGroup?.traverse((o) => {
      if (o.isLight && o.userData.baseIntensity !== undefined) {
        o.intensity = o.userData.baseIntensity * factor;
      }
    });
  }

  /** Registra todos los interactuables en el sistema de interaccion. */
  registerInteractables(interaction) {
    for (const { object, descriptor } of this.interactables) {
      interaction.registerInteractable(object, descriptor);
    }
  }

  /**
   * Streaming ligero: oculta tramos lejanos y anima los elementos (ventiladores, balizas)
   * SOLO de los tramos visibles y cercanos (ahorro de CPU).
   */
  update(dt, elapsed) {
    const maxDist = Settings.current.drawDistance + 16;
    for (const seg of this.segments) {
      const d = seg._center.distanceTo(this._playerPos);
      const visible = d < maxDist;
      if (seg.group.visible !== visible) seg.group.visible = visible;

      if (visible && seg.animated.length) {
        for (const obj of seg.animated) obj.userData.tick?.(dt, elapsed);
      }
    }

    // Pool de luces: reasigna las luces reales a las fuentes mas cercanas ~cada 0.12 s.
    // No cada frame (el sort es innecesario a 60 Hz) y los cambios ocurren tras la niebla.
    if (this._poolLights && this._poolLights.length) {
      this._lightAccum += dt;
      if (this._lightAccum >= 0.12) {
        this._lightAccum = 0;
        this._assignPoolLights();
      }
    }
    // TODO(extension): descargar (disposeObject) y regenerar tramos para mundos infinitos.
  }
}
