import * as THREE from 'three';
import { BaseSegment } from './BaseSegment.js';
import { createHangingBulb } from '../../lighting/HangingBulb.js';
import { MineMaterials } from '../materials/MineMaterials.js';

/**
 * Camara / stope de extraccion (md: 8–15m alto, techo irregular). Espacio amplio y muy
 * alto, roca expuesta con mineralizacion dorada (sulfuros) y escombros. Sensacion de
 * vacio oscuro hacia arriba (la luz no alcanza el techo -> negro).
 */
export class ChamberSegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width: rng.range(8, 12),
      height: rng.range(8, 12),
      length: 16,
      rng,
      shotcrete: false
    });
    this.type = 'chamber';
    this.lighting = lighting;
  }

  build() {
    super.build();

    // Vetas de mineralizacion dorada en las paredes (parches emisivos sutiles).
    for (let i = 0; i < 6; i++) {
      const vein = new THREE.Mesh(
        new THREE.IcosahedronGeometry(this.rng.range(0.3, 0.9), 0),
        MineMaterials.rocaMineralizada()
      );
      const side = this.rng.chance(0.5) ? 1 : -1;
      vein.position.set(
        (side * this.width) / 2 - side * 0.3,
        this.rng.range(1, this.height - 2),
        -this.rng.range(1, this.length - 1)
      );
      vein.scale.set(1, this.rng.range(0.6, 1.4), 0.5);
      this.group.add(vein);
    }

    // Iluminacion escasa a nivel bajo (el techo se pierde en negro).
    this.group.add(
      createHangingBulb({
        position: new THREE.Vector3(0, 3.5, -this.length / 2),
        lighting: this.lighting
      })
    );
    return this;
  }
}
