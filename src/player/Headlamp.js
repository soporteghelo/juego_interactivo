import * as THREE from 'three';
import { PALETTE } from '../world/materials/MineMaterials.js';

/**
 * Linterna de casco (headlamp) con 5 estados ciclicos:
 *   OFF → L1 → L2 → L3 → L4 (maximo) → OFF …
 *
 * Se activa con la tecla F o CLIC DERECHO (anticlick). El estado actual se
 * emite via EventBus ('headlamp:changed') para que el HUD actualice el indicador.
 */

const NIVELES = [
  { label: 'OFF', intensity: 0,   distance: 0  },
  { label: 'L1',  intensity: 5,   distance: 20 },
  { label: 'L2',  intensity: 12,  distance: 38 },
  { label: 'L3',  intensity: 24,  distance: 56 },
  { label: 'L4',  intensity: 42,  distance: 80 },
];

export class Headlamp {
  constructor(camera, scene, bus) {
    this.camera = camera;
    this._bus = bus;
    this._level = 3;  // arranca en L3 (brillo maximo)
    this.on = true;

    this.light = new THREE.SpotLight(
      PALETTE.headlampFrio,
      NIVELES[3].intensity,
      NIVELES[3].distance,
      Math.PI / 6.5, 0.4, 1.2
    );
    this.light.castShadow = false;

    this.target = new THREE.Object3D();
    scene.add(this.light);
    scene.add(this.target);
    this.light.target = this.target;

    this._dir = new THREE.Vector3();
  }

  /**
   * Ciclo ASCENDENTE: OFF → L1 → L2 → L3 → L4 → OFF → …
   * Cada anticlick (clic derecho) sube un nivel; al llegar a L4 se apaga.
   */
  cycle() {
    this._level = (this._level + 1) % 5;
    this._apply();
  }

  /** Toggle on/off directo (sin pasar por los niveles intermedios). */
  toggle() {
    this._level = this.on ? 0 : 3;
    this._apply();
  }

  _apply() {
    const n = NIVELES[this._level];
    this.on = this._level > 0;
    this.light.intensity = n.intensity;
    if (this._level > 0) this.light.distance = n.distance;
    this._bus?.emit('headlamp:changed', { level: this._level, label: n.label });
  }

  /** Sigue a la camara cada frame (la luz sale desde la cabeza hacia donde se mira). */
  update() {
    this.camera.getWorldDirection(this._dir);
    this.light.position.copy(this.camera.position);
    this.target.position.copy(this.camera.position).add(this._dir.multiplyScalar(10));
  }

  /** Intensidad maxima (L4). */
  get onIntensity() { return NIVELES[4].intensity; }
}
