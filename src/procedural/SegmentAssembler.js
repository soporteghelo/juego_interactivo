import * as THREE from 'three';
import { GallerySegment } from '../world/segments/GallerySegment.js';
import { MainGallerySegment } from '../world/segments/MainGallerySegment.js';
import { IntersectionSegment } from '../world/segments/IntersectionSegment.js';
import { RampSegment } from '../world/segments/RampSegment.js';
import { ChamberSegment } from '../world/segments/ChamberSegment.js';
import { RefugeSegment } from '../world/segments/RefugeSegment.js';
import { CrossroadSegment } from '../world/segments/CrossroadSegment.js';
import { PropScatter } from './PropScatter.js';
import { buildSegmentColliders } from '../physics/Colliders.js';

/** Mapa tipo -> clase de tramo. Agregar aqui nuevos tipos de entorno (extension point). */
const SEGMENT_CLASSES = {
  gallery: GallerySegment,
  mainGallery: MainGallerySegment,
  intersection: IntersectionSegment,
  ramp: RampSegment,
  chamber: ChamberSegment,
  refuge: RefugeSegment,
  crossroad: CrossroadSegment
};

/**
 * Instancia los tramos de un trazado, los ENCADENA a lo largo del eje -Z usando sus
 * conectores, construye sus colisionadores y distribuye los props. Devuelve la lista de
 * tramos colocados, los interactuables (con su transform de mundo) y el punto de aparicion.
 */
export class SegmentAssembler {
  constructor({ scene, physics, lighting, rng, bus }) {
    this.scene = scene;
    this.physics = physics;
    this.lighting = lighting;
    this.rng = rng;
    this.bus = bus;
    this.scatter = new PropScatter(rng);
  }

  assemble(layout) {
    const segments = [];
    const interactables = [];
    const hazards = [];
    let spawnPoint = new THREE.Vector3(0, 1.4, -2);

    const cursor = new THREE.Vector3(0, 0, 0); // posicion de la entrada del proximo tramo
    let segIndex = 0;

    for (const node of layout) {
      const Cls = SEGMENT_CLASSES[node.type];
      if (!Cls) {
        console.warn(`[SegmentAssembler] tipo desconocido: ${node.type}`);
        continue;
      }

      const seg = new Cls({ rng: this.rng, lighting: this.lighting });
      seg.build();
      seg.flags = node.flags || {};

      // Los primeros 2 tramos siempre tienen shotcrete (el jugador aparece ahi).
      // A partir del 3ro: ~25% de tramos muestran ROCA EXPUESTA (sin parches de shotcrete).
      // NOTA: el contorno (shell) SIEMPRE usa rocaTunel() — no se reemplaza el material,
      // solo se omiten los parches de shotcrete para que se vea la roca desnuda.
      if (segIndex >= 2 && !node.flags?.spawn && this.rng.chance(0.25)) {
        seg.shotcrete = false; // PropScatter lo usa para omitir cracks de shotcrete
      }

      segIndex++;

      // Coloca el tramo: su entrada (z=0 local) coincide con el cursor.
      seg.group.position.copy(cursor);
      this.scene.add(seg.group);

      // Props (despues de posicionar para que los interactuables tomen transform correcto).
      this.scatter.scatter(seg, seg.flags);

      // Colisionadores estaticos en coordenadas de mundo.
      seg.physicsColliders = buildSegmentColliders(this.physics, seg, cursor);

      // Recolecta interactuables y peligros (los objetos ya estan en el grafo de escena).
      for (const it of seg.interactables) interactables.push(it);
      for (const hz of seg.hazards) hazards.push(hz);

      // Punto de aparicion: centro del primer tramo marcado spawn, alejado de peligros.
      // z=-8 (8m dentro del tramo) da margen frente a hazards y vehiculos al inicio.
      if (node.flags?.spawn) {
        const spawnDepth = Math.min(8, seg.length * 0.55);
        spawnPoint = new THREE.Vector3(cursor.x, cursor.y + 1.4, cursor.z - spawnDepth);
      }

      segments.push(seg);
      this.bus.emit('world:segmentLoaded', { type: seg.type, position: cursor.clone() });

      // Avanza el cursor a la salida del tramo (rampa puede cambiar la cota Y).
      cursor.z += seg.connectors.exit.position.z;     // exit.z es negativo
      cursor.y += seg.connectors.exit.position.y;     // distinto de 0 solo en rampas
    }

    return { segments, interactables, hazards, spawnPoint };
  }
}
