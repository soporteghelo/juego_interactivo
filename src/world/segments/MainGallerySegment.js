import { BaseSegment } from './BaseSegment.js';
import { createLedStrip } from '../../lighting/LedStrip.js';
import { createLinearLed } from '../../lighting/LinearLed.js';

/**
 * Galeria PRINCIPAL de acceso (md: 6–8m ancho × 5–6m alto) con la firma visual del md:
 * arcos delineados con LED verde neon + LED blanco lineal en el techo. Paredes con roca
 * y malla (sin shotcrete, segun el md para zonas con LED verde).
 *
 * Es el escenario inicial jugable (Escena C del md).
 */
export class MainGallerySegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width: rng.range(6, 8),
      height: rng.range(5, 6),
      length: 14,
      rng,
      shotcrete: false // roca expuesta con malla bajo el LED verde
    });
    this.type = 'mainGallery';
    this.lighting = lighting;
    this.hasGreenLed = true;
  }

  build() {
    super.build();

    // Arcos de LED verde neon a ambos lados (banan la galeria en verde).
    this.group.add(
      createLedStrip({
        width: this.width,
        height: this.height,
        length: this.length,
        lighting: this.lighting
      })
    );

    // LED blanco lineal en el centro del techo.
    this.group.add(
      createLinearLed({
        height: this.height,
        length: this.length,
        lighting: this.lighting
      })
    );

    return this;
  }
}
