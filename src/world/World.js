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
    // `attach` conserva la transformada de mundo al cambiar de padre.
    for (const light of lights) {
      this.lightsGroup.attach(light);
      // Guarda la intensidad original para poder escalarla con el control de luminosidad.
      light.userData.baseIntensity = light.intensity;
    }

    // Reacciona al control de luminosidad del jugador en tiempo real.
    Settings.onBrightness((v) => this._applyBrightness(v));
    // Aplica la luminosidad inicial (por si el usuario ya la cambió antes de entrar).
    this._applyBrightness(Settings.brightness);
  }

  /** Escala la intensidad de todas las luces pinadas sin tocar emissive/materials. */
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
    // TODO(extension): descargar (disposeObject) y regenerar tramos para mundos infinitos.
  }
}
