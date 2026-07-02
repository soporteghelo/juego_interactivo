import { BaseSegment } from './BaseSegment.js';
import { createHangingBulb } from '../../lighting/HangingBulb.js';
import * as THREE from 'three';

/**
 * Galeria estandar de trabajo (md: 4.5–6m ancho × 4–5m alto).
 * Paredes con shotcrete, iluminada por bombillas colgantes calidas (sin LED verde).
 * Es el tramo mas comun del trazado.
 */
export class GallerySegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width: rng.range(4.5, 6),
      height: rng.range(4, 5),
      length: 12,
      rng,
      shotcrete: false // roca fBm expuesta en toda la galeria (obligatorio)
    });
    this.type = 'gallery';
    this.lighting = lighting;
  }

  build() {
    super.build();

    // Bombillas colgantes cada ~6m a lo largo del techo.
    const n = Math.max(1, Math.round(this.length / 6));
    for (let i = 0; i < n; i++) {
      const z = -((i + 0.5) * this.length) / n;
      const bulb = createHangingBulb({
        position: new THREE.Vector3(this.rng.range(-1, 1), this.height - 0.6, z),
        lighting: this.lighting
      });
      this.group.add(bulb);
    }
    return this;
  }
}
