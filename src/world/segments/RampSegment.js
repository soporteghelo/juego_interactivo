import * as THREE from 'three';
import { BaseSegment } from './BaseSegment.js';
import { createHangingBulb } from '../../lighting/HangingBulb.js';

/**
 * Rampa: galeria inclinada que conecta niveles. Mismo perfil que la galeria estandar pero
 * con pendiente. El conector de salida queda elevado/descendido respecto a la entrada, de
 * modo que el SegmentAssembler encadena el siguiente tramo a otra cota.
 */
export class RampSegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width: rng.range(5, 6),
      height: rng.range(4.5, 5),
      length: 14,
      rng,
      shotcrete: false // roca fBm expuesta (obligatorio)
    });
    this.type = 'ramp';
    this.lighting = lighting;
  }

  build() {
    super.build();

    // NOTA: para que la colision (cajas planas de BaseSegment) y la geometria coincidan,
    // en esta entrega la rampa se mantiene a nivel (sin inclinar el grupo) y conserva la
    // continuidad del trazado. TODO(extension): pendiente real con colisionadores escalonados
    // o un trimesh inclinado y ajuste del conector de salida en Y.
    const n = 2;
    for (let i = 0; i < n; i++) {
      const z = -((i + 0.5) * this.length) / n;
      this.group.add(
        createHangingBulb({
          position: new THREE.Vector3(0, this.height - 0.6, z),
          lighting: this.lighting
        })
      );
    }
    return this;
  }
}
