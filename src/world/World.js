import * as THREE from 'three';
import { Rng } from '../procedural/Rng.js';
import { LayoutGenerator } from '../procedural/LayoutGenerator.js';
import { SegmentAssembler } from '../procedural/SegmentAssembler.js';
import { WorldRuntime } from './WorldRuntime.js';

/**
 * World: orquesta la construccion del mundo procedural LINEAL (corredor a lo largo de -Z).
 *
 * Genera un trazado reproducible (semilla), lo ensambla (tramos + colisionadores + props),
 * expone el punto de aparicion y los interactuables. El "pinneo" de luces y el streaming por
 * distancia viven en WorldRuntime (compartidos con GridWorld).
 */
export class World extends WorldRuntime {
  constructor({ scene, physics, assets, bus, lighting, seed }) {
    super();
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

  /** Registra todos los interactuables en el sistema de interaccion. */
  registerInteractables(interaction) {
    for (const { object, descriptor } of this.interactables) {
      interaction.registerInteractable(object, descriptor);
    }
  }
}
