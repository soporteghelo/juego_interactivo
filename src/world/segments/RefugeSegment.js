import { BaseSegment } from './BaseSegment.js';
import { createLedStrip } from '../../lighting/LedStrip.js';
import { createLinearLed } from '../../lighting/LinearLed.js';
import { crear as crearRefugio } from '../../elementos/refugio.js';

/**
 * Tramo de REFUGIO MINERO (md, "ELEMENTO ESPECIAL: REFUGIO MINERO" + "Escena C" al fondo).
 *
 * Galeria amplia (>6m), shotcrete blanco, LED verde neon, con el contenedor Drager
 * (elemento src/elementos/refugio.js): puerta, semaforo, ENTRADA/ENTRY, extintor.
 * El refugio es INTERACTUABLE (ingresar). Suele ser el destino de la escena inicial.
 */
export class RefugeSegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width: rng.range(6.5, 8),
      height: rng.range(5, 6),
      length: 14,
      rng,
      shotcrete: true // shotcrete blanco alrededor del refugio
    });
    this.type = 'refuge';
    this.lighting = lighting;
  }

  build() {
    super.build();

    this.group.add(createLedStrip({ width: this.width, height: this.height, length: this.length, lighting: this.lighting }));
    this.group.add(createLinearLed({ height: this.height, length: this.length, lighting: this.lighting }));

    // Contenedor Drager arrimado a la pared derecha, mirando al centro de la galeria.
    const refugio = crearRefugio();
    refugio.position.set(this.width / 2 - 0.2 - 0.9, 0, -this.length / 2);
    refugio.rotation.y = -Math.PI / 2;
    this.group.add(refugio);
    if (refugio.userData.interactable) this.interactables.push(refugio.userData.interactable);

    return this;
  }
}
