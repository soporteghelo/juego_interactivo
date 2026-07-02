/**
 * Generador del TRAZADO de la mina: decide la secuencia de tramos (galeria, crucero,
 * rampa, camara, refugio) de forma reproducible a partir de una semilla.
 *
 * El trazado inicial garantiza una experiencia coherente con el md:
 *  - Arranca en una galeria PRINCIPAL con LED verde neon (Escena C).
 *  - Incluye un CRUCERO con cluster de senaletica (Escena D).
 *  - Incluye una galeria con BARRERA de advertencia/peligro (Escena A) — marcada con flag.
 *  - Termina en un REFUGIO minero (destino / punto de fuga).
 *
 * Devuelve una lista de descriptores { type, flags } que el SegmentAssembler instancia.
 */
export class LayoutGenerator {
  constructor(rng) {
    this.rng = rng;
  }

  /** @returns {Array<{type:string, flags?:object}>} */
  generate() {
    const rng = this.rng;
    const layout = [];

    // 1) Entrada: galeria principal con LED verde (spawn).
    layout.push({ type: 'mainGallery', flags: { spawn: true } });

    // 2) Cuerpo de la mina: mapa MUY grande con muchas galerias y varios cruceros.
    const middle = rng.int(24, 34);      // mapa ampliado (antes 14-22)
    let intersections = 0;
    let chambers = 0;
    let barriers = 0;
    let sinceIntersection = 0;

    for (let i = 0; i < middle; i++) {
      const r = rng.next();
      sinceIntersection++;

      // Crucero/interseccion (con cluster de senaletica) cada cierto tramo.
      if (sinceIntersection >= 3 && r < 0.32) {
        layout.push({ type: 'intersection', flags: { signage: true } });
        intersections++;
        sinceIntersection = 0;
      } else if (r < 0.42) {
        layout.push({ type: 'ramp' });
      } else if (chambers < 3 && r < 0.55) {
        // Camara/stope con peligro geologico (roca suelta, malla rasgada, shotcrete fisurado).
        layout.push({ type: 'chamber', flags: { hazard: true } });
        chambers++;
      } else if (barriers < 2 && r < 0.66) {
        layout.push({ type: 'gallery', flags: { barrier: true } });
        barriers++;
      } else if (r < 0.8) {
        // Galeria principal intermedia (LED verde) para variar la iluminacion.
        layout.push({ type: 'mainGallery' });
      } else {
        layout.push({ type: 'gallery' });
      }
    }

    // Garantias minimas de contenido del md (variedad asegurada).
    // Mapa ampliado -> se aseguran AL MENOS 4 cruceros (antes 2). Con equipos en movimiento
    // atravesando el trazado, los cruceros son los puntos de mayor riesgo de atropello.
    const MIN_INTERSECCIONES = 4;
    if (intersections < MIN_INTERSECCIONES) {
      const faltan = MIN_INTERSECCIONES - intersections;
      const puntos = [3, 8, 13, 18]; // distribuidos a lo largo del trazado
      for (let k = 0; k < faltan; k++) {
        const idx = Math.min(puntos[k] ?? layout.length, layout.length);
        layout.splice(idx, 0, { type: 'intersection', flags: { signage: true } });
        intersections++;
      }
    }
    if (chambers === 0) layout.splice(5, 0, { type: 'chamber', flags: { hazard: true } });
    if (barriers === 0) layout.push({ type: 'gallery', flags: { barrier: true } });

    // 3) Galeria principal de aproximacion + refugio al fondo.
    layout.push({ type: 'mainGallery' });
    layout.push({ type: 'refuge', flags: { destination: true } });

    // 4) CRUCERO CENTRAL: inyecta una galeria en interseccion exactamente en el punto medio.
    // Aparece una sola vez por trazado (no depende del RNG, es determinista).
    const midIdx = Math.floor(layout.length / 2);
    layout.splice(midIdx, 0, { type: 'crossroad', flags: { signage: true } });

    return layout;
  }
}
