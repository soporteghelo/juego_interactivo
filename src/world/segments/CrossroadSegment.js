import * as THREE from 'three';
import { BaseSegment } from './BaseSegment.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { createTunnelShell } from './TunnelGeometry.js';
import { createLinearLed } from '../../lighting/LinearLed.js';

/** Ancho del ramal lateral (en el eje Z del tunel principal). */
const BRANCH_W  = 5.0;
/** Longitud de cada ramal lateral (en X). */
const BRANCH_L  = 15;
/** Altura del ramal lateral. */
const BRANCH_H  = 4.2;

/**
 * Crucero con ramales TRANSITABLES a ambos lados.
 *
 * El tunel principal (eje Z) conserva el shell en dos secciones (antes y despues
 * del crucero) dejando un hueco visual donde se abren los ramales. El jugador puede
 * entrar a ambos ramales laterales (colisionadores y geometria reales).
 *
 * Se registra en nichoZones para que BoundsGuard no saque al jugador cuando
 * explora los ramales.
 */
export class CrossroadSegment extends BaseSegment {
  constructor({ rng, lighting }) {
    super({
      width:  7,
      height: 5,
      length: 12,
      rng,
      shotcrete: false
    });
    this.type     = 'crossroad';
    this.lighting = lighting;
  }

  build() {
    // Shell del tunel principal en DOS partes — deja hueco en el centro para el crucero.
    this._buildSplitShell();
    // Piso del tunel principal (heredado de BaseSegment).
    this._buildFloor();
    // Colliders del tunel principal con aperturas laterales.
    this._buildCollidersWithOpenings();
    // Ramales laterales transitable (+X y -X).
    this._buildBranch(1);
    this._buildBranch(-1);
    // LED lineal del techo principal.
    this.group.add(
      createLinearLed({ height: this.height, length: this.length, lighting: this.lighting })
    );
    // Punto de anclaje para el cluster de senaletica (pared izquierda).
    this.signAnchor = new THREE.Object3D();
    this.signAnchor.position.set(-this.width / 2 + 0.1, 2.2, -this.length / 2);
    this.signAnchor.rotation.y = Math.PI / 2;
    this.group.add(this.signAnchor);
    // Registrar las zonas de ramal para BoundsGuard.
    this._registerBranchZones();
    return this;
  }

  // ── Shell partido ──────────────────────────────────────────────────────────

  _buildSplitShell() {
    const halfZ   = this.length / 2;     // 6
    const halfBW  = BRANCH_W / 2;        // 2.5
    const jZ      = -halfZ;              // centro del tramo = -6

    const len1 = halfZ - halfBW;         // 3.5 m antes del crucero
    const len2 = halfZ - halfBW;         // 3.5 m despues del crucero

    if (len1 > 0.4) this._shellSection(0,        len1);
    if (len2 > 0.4) this._shellSection(jZ - halfBW, len2);

    // Techo del area abierta del crucero (cubre ambos ramales y la zona central).
    const totalCeilW = this.width + BRANCH_L * 2 + 2;
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(totalCeilW, 0.35, BRANCH_W + 0.6),
      MineMaterials.roca()
    );
    ceil.position.set(0, this.height + 0.17, jZ);
    this.group.add(ceil);
  }

  _shellSection(zStart, length) {
    const rng = () => this.rng.next();
    const geo  = createTunnelShell({
      width:     this.width,
      height:    this.height,
      length,
      segmentsZ: Math.max(6, Math.round(length)),
      jitter:    0.35,
      rng
    });
    const mesh = new THREE.Mesh(geo, MineMaterials.rocaTunel());
    mesh.receiveShadow = true;
    mesh.position.set(0, 0, zStart);
    this.group.add(mesh);
  }

  // ── Colliders del tunel principal con huecos laterales ────────────────────

  _buildCollidersWithOpenings() {
    const halfW  = this.width / 2;
    const halfL  = this.length / 2;
    const wallH  = this.height;
    const halfBW = BRANCH_W / 2;
    const jZ     = -halfL;             // -6

    // Piso (completo + solapado en los extremos).
    this.colliders.push({ hx: halfW + 0.5, hy: 0.1, hz: halfL + 0.4, pos: [0, -0.1, -halfL] });
    // Techo.
    this.colliders.push({ hx: halfW, hy: 0.1, hz: halfL, pos: [0, wallH, -halfL] });

    const wallHalfH = BRANCH_H / 2 + 0.20;
    const wallCY    = BRANCH_H / 2 - 0.20;
    const topH      = wallH - BRANCH_H;

    for (const side of [1, -1]) {
      const wx = side * halfW;

      // Franja ENCIMA de la apertura (BRANCH_H .. wallH), longitud completa.
      if (topH > 0.05) {
        this.colliders.push({
          hx: 0.1, hy: topH / 2, hz: halfL,
          pos: [wx, BRANCH_H + topH / 2, -halfL]
        });
      }

      // Antes del ramal: z=0 → z=jZ+halfBW (= -3.5).
      const z1  = jZ + halfBW;
      const l1  = Math.abs(z1) / 2;
      if (l1 > 0.05) {
        this.colliders.push({ hx: 0.1, hy: wallHalfH, hz: l1, pos: [wx, wallCY, z1 / 2] });
      }

      // Despues del ramal: z=jZ-halfBW (= -8.5) → z=-length (= -12).
      const z2   = jZ - halfBW;
      const endZ = -this.length;
      const l2   = Math.abs(endZ - z2) / 2;
      if (l2 > 0.05) {
        this.colliders.push({ hx: 0.1, hy: wallHalfH, hz: l2, pos: [wx, wallCY, (z2 + endZ) / 2] });
      }
    }
  }

  // ── Ramal lateral (side: 1=derecha, -1=izquierda) ─────────────────────────

  _buildBranch(side) {
    const halfZ  = this.length / 2;       // 6 — Z del centro del crucero en espacio local
    const halfW  = this.width / 2;        // 3.5
    const jZ     = -halfZ;               // -6
    const L      = BRANCH_L;
    const W      = BRANCH_W;
    const H      = BRANCH_H;

    // El ramal se extiende desde x=side*halfW hasta x=side*(halfW+L).
    const bCX    = side * (halfW + L / 2);
    const bEndX  = side * (halfW + L);

    const matRoca = MineMaterials.roca();
    const matPiso = MineMaterials.barroMojado();

    // Piso del ramal.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.30, W), matPiso);
    floor.position.set(bCX, -0.15, jZ);
    this.group.add(floor);

    // Techo del ramal.
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(L, 0.30, W), matRoca);
    ceil.position.set(bCX, H + 0.15, jZ);
    this.group.add(ceil);

    // Pared del fondo (extremo del ramal).
    const farW = new THREE.Mesh(new THREE.BoxGeometry(0.50, H, W + 0.6), matRoca);
    farW.position.set(bEndX + side * 0.25, H / 2, jZ);
    this.group.add(farW);

    // Pared delantera (hacia z=0, lado de entrada al tramo).
    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(L + 0.6, H, 0.40), matRoca);
    wallFront.position.set(bCX, H / 2, jZ + W / 2);
    this.group.add(wallFront);

    // Pared trasera (hacia z=-length).
    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(L + 0.6, H, 0.40), matRoca);
    wallBack.position.set(bCX, H / 2, jZ - W / 2);
    this.group.add(wallBack);

    // Luces en el ramal (3 puntos a lo largo de la longitud).
    const nLights = 3;
    for (let i = 0; i < nLights; i++) {
      const t  = (i + 0.5) / nLights;
      const lx = side * (halfW + L * t);
      const pt = new THREE.PointLight(0xffdd88, 24, 12);
      pt.position.set(lx, H * 0.82, jZ);
      this.group.add(pt);
    }

    // Colliders del ramal.
    // Piso.
    this.colliders.push({ hx: L / 2, hy: 0.15, hz: W / 2, pos: [bCX, -0.15, jZ] });
    // Techo.
    this.colliders.push({ hx: L / 2, hy: 0.15, hz: W / 2, pos: [bCX, H + 0.15, jZ] });
    // Pared del fondo.
    this.colliders.push({ hx: 0.25, hy: H / 2, hz: W / 2 + 0.30, pos: [bEndX + side * 0.25, H / 2, jZ] });
    // Pared delantera Z.
    this.colliders.push({ hx: L / 2 + 0.30, hy: H / 2, hz: 0.20, pos: [bCX, H / 2, jZ + W / 2] });
    // Pared trasera Z.
    this.colliders.push({ hx: L / 2 + 0.30, hy: H / 2, hz: 0.20, pos: [bCX, H / 2, jZ - W / 2] });
  }

  // ── nichoZones para BoundsGuard ───────────────────────────────────────────

  _registerBranchZones() {
    const halfZ  = this.length / 2;
    const jZ     = -halfZ;
    const halfBW = BRANCH_W / 2;

    if (!this.nichoZones) this.nichoZones = [];
    for (const side of [1, -1]) {
      this.nichoZones.push({
        side,
        zMin: jZ - halfBW - 0.8,
        zMax: jZ + halfBW + 0.8
      });
    }
  }
}
