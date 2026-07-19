import * as THREE from 'three';
import { Rng } from '../../procedural/Rng.js';
import { GridAssembler } from './GridAssembler.js';
import { WorldRuntime } from '../WorldRuntime.js';

/**
 * GridWorld — mundo en RETICULA que reproduce el plano de mina (galerias + cruceros + via
 * principal RN 96) de forma TRANSITABLE. Expone la MISMA interfaz publica que `World`
 * (`segments`, `interactables`, `hazards`, `spawnPoint`, `registerInteractables`, `update`),
 * de modo que el Engine lo consume sin cambios. Ademas ofrece:
 *  - `vehicleRoutes`: circuito(s) de mundo para que los vehiculos recorran la via principal.
 *  - `boundsCheck(pos)`: contencion por caja ORIENTADA (los tramos ya no estan centrados en
 *    x=0 ni encadenados en -Z), usado por GridBoundsGuard.
 */
export class GridWorld extends WorldRuntime {
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
    this.spawnPoint = new THREE.Vector3(0, 1.4, 0);
    this.vehicleRoutes = [];

    this._playerPos = new THREE.Vector3(0, 1.4, 0);
    this.bus.on('player:moved', ({ position }) => this._playerPos.copy(position));

    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  async build(onProgress = () => {}) {
    const rng = new Rng(this.seed);
    const assembler = new GridAssembler({
      scene: this.scene,
      physics: this.physics,
      lighting: this.lighting,
      rng,
      bus: this.bus
    });

    const result = await assembler.assemble(onProgress);
    this.segments = result.segments;
    this.interactables = result.interactables;
    this.hazards = result.hazards;
    this.spawnPoint = result.spawnPoint;
    this.vehicleRoutes = result.vehicleRoutes;

    // Cajas de contencion (espacio LOCAL de cada tramo) + inversa de su matriz de mundo.
    for (const seg of this.segments) {
      // La malla curva de la rampa espiral NO aporta caja de contencion (una AABB no describe
      // una helice); la contencion/piso la dan sus SPANS rectos (tipo 'ramp'). Se omite aqui →
      // sin `_localBounds`, boundsCheck/groundHeight la saltan.
      if (seg.skipBounds) continue;
      seg.group.updateMatrixWorld(true);
      seg._invMatrix = new THREE.Matrix4().copy(seg.group.matrixWorld).invert();
      if (seg.type === 'node' || seg.type === 'room') {
        // Bloques CENTRADos en su posicion (caja simetrica en X y Z).
        seg._localBounds = { hx: seg.size / 2, zMin: -seg.size / 2, zMax: seg.size / 2, top: seg.height };
      } else {
        // Tuneles: se extienden desde la entrada (z=0) hacia -Z (salida).
        seg._localBounds = { hx: seg.width / 2, zMin: -seg.length, zMax: 0, top: seg.height };
      }
    }

    this._pinLights();
  }

  /** Registra todos los interactuables en el sistema de interaccion. */
  registerInteractables(interaction) {
    for (const { object, descriptor } of this.interactables) {
      interaction.registerInteractable(object, descriptor);
    }
  }

  /**
   * ¿La posicion mundial esta DENTRO del gabarito de algun tramo/nodo? Transforma el punto al
   * espacio local de cada tramo (que puede estar rotado) y lo compara con su caja local, con
   * margenes generosos (nichos/cunetas/costuras). Usado por GridBoundsGuard.
   */
  boundsCheck(pos) {
    const M = 1.6;    // margen lateral (cubre cunetas y bocas de nicho)
    const ZP = 0.9;   // margen a lo largo del tramo (costuras con nodos)
    for (const seg of this.segments) {
      const b = seg._localBounds;
      if (!b) continue;
      const l = this._tmp.copy(pos).applyMatrix4(seg._invMatrix);
      const dentroY = l.y > -2.5 && l.y < b.top + 3;
      if (!dentroY) continue;

      if (
        Math.abs(l.x) < b.hx + M &&
        l.z > b.zMin - ZP && l.z < b.zMax + ZP
      ) {
        return true;
      }

      // Dentro de un nicho/bahía el jugador puede estar mucho más allá del ancho del túnel
      // (misma tolerancia que el BoundsGuard lineal: hasta 22 m hacia el lado registrado).
      if (seg.nichoZones && Math.abs(l.x) > b.hx) {
        const side = l.x > 0 ? 1 : -1;
        for (const z of seg.nichoZones) {
          if (z.side === side && l.z >= z.zMin && l.z <= z.zMax && Math.abs(l.x) < b.hx + 22) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Altura del PISO bajo la posicion `pos` (o null si ningun tramo la contiene). Transforma
   * el punto al espacio local de cada tramo y devuelve la Y MUNDIAL del plano de piso local
   * (y=0) en esa (x,z) — en las RAMPAS el grupo esta inclinado, asi que esto devuelve la
   * altura correcta a lo largo del decline. Entre niveles (piso inferior a -12 m) se elige
   * el piso mas cercano a la Y actual. Lo usa DriveController para conducir siguiendo el
   * terreno (bajar rampas) sin raycasts.
   */
  groundHeight(pos) {
    let best = null;
    for (const seg of this.segments) {
      const b = seg._localBounds;
      if (!b) continue;
      const l = this._tmp.copy(pos).applyMatrix4(seg._invMatrix);
      if (l.y <= -3 || l.y >= b.top + 3) continue;                      // otro nivel
      if (Math.abs(l.x) >= b.hx + 1.6) continue;
      if (l.z <= b.zMin - 0.9 || l.z >= b.zMax + 0.9) continue;
      const y = this._tmp2.set(l.x, 0, l.z).applyMatrix4(seg.group.matrixWorld).y;
      if (best === null || Math.abs(y - pos.y) < Math.abs(best - pos.y)) best = y;
    }
    return best;
  }
}
