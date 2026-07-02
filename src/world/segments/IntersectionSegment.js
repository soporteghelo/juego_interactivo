import * as THREE from 'three';
import { BaseSegment } from './BaseSegment.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { createLinearLed } from '../../lighting/LinearLed.js';

/**
 * Crucero / interseccion (md, "Escena D"): punto donde dos galerias se cruzan, con un
 * cluster de senaletica en la pared. Geometricamente es un tramo mas ancho y corto con
 * una abertura lateral (galeria transversal, decorativa/oscura) y LED blanco frio.
 *
 * El cluster de senales lo coloca PropScatter (USO OBLIGATORIO EPP / VIA DE ESCAPE /
 * chevrones). Aqui marcamos el punto de anclaje en userData para que PropScatter lo use.
 */
export class IntersectionSegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width: rng.range(6, 7),
      height: rng.range(4.5, 5.5),
      length: 10,
      rng,
      shotcrete: false // roca fBm expuesta (obligatorio)
    });
    this.type = 'intersection';
    this.lighting = lighting;
  }

  build() {
    super.build();

    // Abertura lateral: un hueco oscuro en la pared derecha (galeria transversal).
    const opening = new THREE.Mesh(
      new THREE.BoxGeometry(3, this.height * 0.7, 3.5),
      MineMaterials.roca()
    );
    opening.position.set(this.width / 2 + 1.4, this.height * 0.35, -this.length / 2);
    this.group.add(opening);
    // Hueco transitable -> hay que quitar el colisionador de pared derecha en esa zona.
    // Para simplicidad, dejamos la pared (el jugador no entra al ramal en esta entrega).

    // Punto de anclaje del cluster de senaletica (pared izquierda, a la vista).
    this.signAnchor = new THREE.Object3D();
    this.signAnchor.position.set(-this.width / 2 + 0.1, 2.2, -this.length / 2);
    this.signAnchor.rotation.y = Math.PI / 2; // mira al interior
    this.group.add(this.signAnchor);

    // LED blanco frio y directo.
    this.group.add(
      createLinearLed({ height: this.height, length: this.length, lighting: this.lighting })
    );

    return this;
  }
}
