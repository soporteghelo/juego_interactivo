import * as THREE from 'three';
import { BaseSegment } from '../segments/BaseSegment.js';
import { createLedStrip } from '../../lighting/LedStrip.js';
import { createLinearLed } from '../../lighting/LinearLed.js';
import { createHangingBulb } from '../../lighting/HangingBulb.js';
import { crearRotulo, crearSenal } from '../../elementos/senal/senal.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { Settings } from '../../core/Settings.js';

/** Subtitulo + color del rotulo de labor segun el tipo de tunel. */
const ROTULO_INFO = {
  gallery:  { sub: 'GALERÍA',            color: '#bfe6bf' },
  crucero:  { sub: 'CRUCERO',            color: '#9fc7d6' },
  mainRoad: { sub: 'VÍA PRINCIPAL RN 96', color: '#ffcf5a' },
  ramp:     { sub: 'RAMPA / DECLINE',    color: '#ffcf5a' },
  access:   { sub: 'ACCESO A LABOR',     color: '#bfe6bf' },
};

/**
 * EdgeSegment — un tunel RECTO que une dos nodos de la retICula (una arista del grafo).
 *
 * Hereda de BaseSegment toda la estructura (carcasa fBm, piso irregular, cunetas, colisiones)
 * construida en espacio LOCAL a lo largo de -Z. El GridAssembler luego ROTA el grupo (`edge.yaw`)
 * y lo posiciona en el borde del nodo de origen, de modo que las galerias corren en X y los
 * cruceros en Z. Las galerias/via principal llevan la firma de LED verde neon; todas llevan LED
 * blanco lineal en el techo.
 */
export class EdgeSegment extends BaseSegment {
  constructor({ edge, rng, lighting }) {
    super({
      width: edge.width,
      height: edge.height,
      length: edge.length,
      rng,
      // Galerias/via con LED verde → roca expuesta (sin shotcrete). Cruceros con shotcrete.
      shotcrete: edge.type === 'crucero',
      // Malla mas ligera: la retICula tiene decenas de tramos visibles a la vez.
      detail: 0.6
    });
    this.type = edge.type;          // 'gallery' | 'crucero' | 'mainRoad'
    this.label = edge.label;        // rotulo del plano (Ga 220, Cx 996, RN 96…)
    this.main = !!edge.main;
    this.lighting = lighting;
    this.edge = edge;
  }

  build() {
    super.build();

    // Firma de LED verde neon en galerias principales y en la via principal RN 96.
    // Version ALIGERADA para la retICula: arcos mas espaciados, tubos con menos segmentos y
    // una luz verde cada 2 arcos (el bloom sigue banando la galeria de verde).
    if (this.main || this.type === 'mainRoad') {
      this.group.add(
        createLedStrip({
          width: this.width,
          height: this.height,
          length: this.length,
          lighting: this.lighting,
          arcSpacing: 6, radialSegments: 4, tubularSegments: 10, lampEvery: 2
        })
      );
    }

    // LED blanco lineal en el centro del techo (todos los tramos), con menos luces reales.
    this.group.add(
      createLinearLed({
        height: this.height, length: this.length, lighting: this.lighting, lampSpacing: 10
      })
    );

    // ── RAMPA/decline: BERMAS de seguridad + señal de pendiente (D.S. 024-2016-EM:
    // las rampas con transito de equipo pesado llevan bermas laterales de contencion
    // de al menos 3/4 de la llanta y señalizacion de pendiente/velocidad). ──
    if (this.type === 'ramp') {
      const halfW = this.width / 2;
      const matBerma = MineMaterials.plano(0x6b6459, { rough: 0.95 });
      for (const side of [-1, 1]) {
        // Prisma corrido de material compactado contra el hastial (media caña).
        const berma = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.55, this.length - 1.2, 7, 1, false, 0, Math.PI),
          matBerma
        );
        berma.rotation.set(Math.PI / 2, 0, side > 0 ? Math.PI : 0);
        berma.position.set(side * (halfW - 0.30), 0.0, -this.length / 2);
        this.group.add(berma);
        this.colliders.push({
          hx: 0.35, hy: 0.30, hz: (this.length - 1.2) / 2,
          pos: [side * (halfW - 0.30), 0.25, -this.length / 2]
        });
      }
      // Señal de pendiente/velocidad en AMBAS bocas (se lee al entrar en cada sentido).
      for (const [z, ry] of [[-1.6, 0], [-(this.length - 1.6), Math.PI]]) {
        const s = crearSenal('rampa');
        s.position.set((ry ? -1 : 1) * (halfW - 0.14), 2.0, z);
        s.rotation.y = (ry ? 1 : -1) * Math.PI / 2;
        this.group.add(s);
      }
    }

    // Rótulo de labor (navegacion): indica el nombre del plano (Ga/Cx/RN/Rampa) y su tipo,
    // uno cerca de CADA extremo (en hastiales opuestos) para que sea legible en ambos sentidos.
    if (this.label) {
      const info = ROTULO_INFO[this.type] || ROTULO_INFO.gallery;
      const halfW = this.width / 2;
      const yR = Math.min(2.2, this.height - 0.8);
      // Cerca de la boca de entrada, hastial derecho.
      const r1 = crearRotulo(this.label, info.sub, { color: info.color });
      r1.position.set(halfW - 0.06, yR, -1.8);
      r1.rotation.y = -Math.PI / 2;
      this.group.add(r1);
      // Cerca del extremo lejano, hastial izquierdo (visible al venir en sentido contrario).
      // Solo en escritorio (heavyDetail alto): en celular basta uno por tunel.
      if (this.length > 8 && Settings.current.heavyDetail >= 0.7) {
        const r2 = crearRotulo(this.label, info.sub, { color: info.color });
        r2.position.set(-halfW + 0.06, yR, -(this.length - 1.8));
        r2.rotation.y = Math.PI / 2;
        this.group.add(r2);
      }
    }

    // Rampa/decline: focos colgantes cálidos a lo largo de la pendiente (identidad visual,
    // igual que la rampa del modo lineal).
    if (this.type === 'ramp') {
      const n = Math.max(2, Math.round(this.length / 7));
      for (let i = 0; i < n; i++) {
        const z = -((i + 0.5) * this.length) / n;
        this.group.add(createHangingBulb({
          position: new THREE.Vector3(0, this.height - 0.6, z),
          lighting: this.lighting
        }));
      }
    }

    return this;
  }
}
