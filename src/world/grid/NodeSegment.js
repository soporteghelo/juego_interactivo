import * as THREE from 'three';
import { MineMaterials } from '../materials/MineMaterials.js';
import { Settings } from '../../core/Settings.js';
import { crear as crearCharco } from '../../elementos/entorno/charco.js';
import { crear as crearEspejoConvexo } from '../../elementos/ssoma/espejo_convexo.js';
import { POST_T, addCornerFillets, addMouthJambs, vaultGeo, wallGeo, cableGeo, nodeFloorGeo } from './RockDetail.js';

/**
 * NodeSegment — bloque ABIERTO de interseccion (crucero de 4 vias) de la retICula.
 *
 * Es un cuadrado de lado `size` con el techo a `height`. En cada uno de los 4 lados puede
 * haber una BOCA abierta (si por ahi conecta un tunel) o una PARED de cierre (fondo de saco
 * en el borde del plano).
 *
 * REALISMO — nada debe verse CUADRADO (ver RockDetail.js, geometrias cacheadas/compartidas):
 *  - ESQUINAS REDONDEADAS: filetes de roca curvos (bezier + ruido) en vez de pilares rectos;
 *    la demarcacion reflectiva (linea roja) sigue la curva.
 *  - BOCAS ACAMPANADAS: jambas rocosas en abanico sellan la transicion tunel→cruce (la vieja
 *    rendija recta entre el ancho del tunel y la boca delataba la caja).
 *  - CORONA ABOVEDADA colgante + paredes de fondo con relieve.
 *  - Luminaria colgante, huellas de rodadura en los ejes con transito, cable en catenaria y
 *    charcos (estos ultimos gated por heavyDetail).
 *
 * Los COLISIONADORES siguen siendo cajas (pilares de esquina + paredes + jambas): la fisica
 * no cambia, solo la piel visible. Alineado a ejes (sin rotacion).
 */
export class NodeSegment {
  /**
   * @param {object}   o
   * @param {number}   o.size     lado del bloque (m)
   * @param {number}   o.height   alto hasta el techo (m)
   * @param {Array<{x:number,z:number,width?:number}>} o.openDirs direcciones con tunel (+ ancho)
   * @param {object}   o.lighting rig de iluminacion (presupuesto de luces)
   * @param {object}   [o.rng]    RNG seedable del mundo (reproducible); opcional
   */
  constructor({ size, height, openDirs, lighting, rng = null }) {
    this.type = 'node';
    this.size = size;
    this.width = size;
    this.length = size;
    this.height = height;
    this.openDirs = openDirs || [];
    this.lighting = lighting;
    this.rng = rng;

    this.group = new THREE.Group();
    this.group.name = 'node';
    this.colliders = [];
    this.interactables = [];
    this.hazards = [];
    this.animated = [];

    // Conectores stub (la API de tramo los espera; el grid no encadena por conectores).
    this.connectors = {
      entry: { position: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, 1) },
      exit:  { position: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, -1) }
    };
  }

  /** Aleatorio [0,1): usa el RNG seedable del mundo si esta disponible. */
  _rnd() { return this.rng ? this.rng.next() : Math.random(); }

  build() {
    const half = this.size / 2;
    const H = this.height;
    const mouth = this.size - 2 * POST_T; // ancho de la boca entre esquinas

    const matRoca = MineMaterials.roca();
    const matPiso = MineMaterials.barroMojado();

    // ── Piso (losa cuadrada, ligeramente desbordada para solapar con los tuneles) ──
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(this.size + 1, 0.30, this.size + 1),
      matPiso
    );
    floor.position.set(0, -0.15, 0);
    floor.receiveShadow = true;
    floor.name = 'node_piso';
    this.group.add(floor);
    this.colliders.push({ hx: half + 0.5, hy: 0.15, hz: half + 0.5, pos: [0, -0.15, 0] });

    // Piel de piso IRREGULAR (muck/barro pisado) sobre la losa: mata la cara plana del cruce.
    const floorSkin = new THREE.Mesh(nodeFloorGeo(this.size), matPiso);
    floorSkin.position.set(0, 0.02, 0);
    floorSkin.receiveShadow = true;
    floorSkin.name = 'node_piso_relieve';
    this.group.add(floorSkin);

    // ── Techo: TAPA plana (sella por encima, colisionador) + CORONA abovedada visible ──
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(this.size + 0.6, 0.35, this.size + 0.6),
      matRoca
    );
    ceil.position.set(0, H + 0.17, 0);
    ceil.name = 'node_techo';
    this.group.add(ceil);
    this.colliders.push({ hx: half, hy: 0.15, hz: half, pos: [0, H + 0.17, 0] });

    const vault = new THREE.Mesh(vaultGeo(this.size, H), matRoca);
    vault.position.set(0, H - 0.02, 0);
    // Variedad entre nodos con la MISMA geometria: rotacion de 0/90/180/270°.
    vault.rotation.y = Math.floor(this._rnd() * 4) * (Math.PI / 2);
    vault.name = 'node_corona';
    this.group.add(vault);

    // ── ESQUINAS REDONDEADAS (filetes de roca curvos + demarcacion reflectiva) ──
    // El collider conserva la caja historica de cada esquina (queda DETRAS de la roca).
    addCornerFillets(this.group, half, H);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = sx * (half - POST_T / 2);
        const pz = sz * (half - POST_T / 2);
        this.colliders.push({ hx: POST_T / 2, hy: H / 2, hz: POST_T / 2, pos: [px, H / 2, pz] });
      }
    }

    // ── BOCAS ACAMPANADAS: jambas que sellan tunel→cruce en abanico ──
    addMouthJambs(this.group, this.colliders, this.openDirs, half, H);

    // ── Paredes de cierre ROCOSAS en los lados SIN tunel ──
    const wallsG = new THREE.Group();
    wallsG.name = 'node_paredes';
    const sides = [
      { dir: { x:  1, z: 0 }, axis: 'x', sign:  1 },
      { dir: { x: -1, z: 0 }, axis: 'x', sign: -1 },
      { dir: { x: 0, z:  1 }, axis: 'z', sign:  1 },
      { dir: { x: 0, z: -1 }, axis: 'z', sign: -1 },
    ];
    const muroGeo = wallGeo(H, mouth);
    for (const s of sides) {
      if (this._isOpen(s.dir)) continue; // hay tunel por aqui: boca abierta
      const wall = new THREE.Mesh(muroGeo, matRoca);
      if (s.axis === 'x') {
        const x = s.sign * half;
        wall.position.set(x, H / 2, 0);
        wallsG.add(wall);
        this.colliders.push({ hx: 0.2, hy: H / 2, hz: mouth / 2, pos: [x, H / 2, 0] });
      } else {
        const z = s.sign * half;
        wall.position.set(0, H / 2, z);
        wall.rotation.y = Math.PI / 2;
        wallsG.add(wall);
        this.colliders.push({ hx: mouth / 2, hy: H / 2, hz: 0.2, pos: [0, H / 2, z] });
      }
    }
    this.group.add(wallsG);

    // ── HUELLAS DE RODADURA en los ejes con transito (bocas opuestas abiertas) ──
    const matHuella = new THREE.MeshStandardMaterial({
      color: 0x0b0a09, roughness: 1.0, transparent: true, opacity: 0.4,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const ejeX = this._isOpen({ x: 1, z: 0 }) && this._isOpen({ x: -1, z: 0 });
    const ejeZ = this._isOpen({ x: 0, z: 1 }) && this._isOpen({ x: 0, z: -1 });
    const huellaGeo = new THREE.PlaneGeometry(0.55, this.size + 0.8);
    for (const [activo, ry] of [[ejeZ, 0], [ejeX, Math.PI / 2]]) {
      if (!activo) continue;
      for (const lado of [-0.85, 0.85]) {
        const h = new THREE.Mesh(huellaGeo, matHuella);
        h.rotation.set(-Math.PI / 2, 0, ry);
        h.position.set(ry ? 0 : lado, 0.012, ry ? lado : 0);
        this.group.add(h);
      }
    }

    // ── Luminaria del crucero: COLGANTE de conduit con carcasa (ya no flota) ──
    const y = H - 0.15;
    const matCarcasa = MineMaterials.plano(0x2c2f33, { rough: 0.6, metal: 0.5 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), matCarcasa);
    stem.position.set(0, H - 0.24, 0);
    this.group.add(stem);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.30), matCarcasa);
    housing.position.set(0, y - 0.30, 0);
    this.group.add(housing);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.06, 0.2),
      MineMaterials.ledBlanco()
    );
    panel.position.set(0, y - 0.38, 0);
    panel.name = 'node_luz';
    this.group.add(panel);
    if (this.lighting?.canAddLight?.()) {
      const light = new THREE.PointLight(0xf5f8ff, 30, 20, 2);
      light.position.set(0, y - 0.55, 0);
      this.group.add(light);
      this.lighting.noteLight();
    }

    // ── Detalle pesado (gated por heavyDetail: en calidad 'bajo' se omite) ──
    if ((Settings.current.heavyDetail ?? 1) >= 0.4) {
      // ESPEJO CONVEXO en cruces CIEGOS (3+ bocas): permite ver el trafico perpendicular
      // antes de asomarse — obligatorio en el reglamento interno de transito de la mina.
      if (this.openDirs.length >= 3) {
        const espejo = crearEspejoConvexo();
        const sx = this._rnd() < 0.5 ? -1 : 1;
        const sz = this._rnd() < 0.5 ? -1 : 1;
        const ex = sx * (half - 1.15), ez = sz * (half - 1.15);
        espejo.position.set(ex, Math.min(H - 1.2, 3.3), ez);
        espejo.rotation.y = Math.atan2(-ex, -ez);   // el domo mira al centro del cruce
        this.group.add(espejo);
      }
      // Cable electrico en catenaria cruzando en alto, pegado a un costado de la via.
      if (ejeZ || ejeX) {
        const cable = new THREE.Mesh(
          cableGeo(this.size),
          MineMaterials.plano(0x101014, { rough: 0.7 })
        );
        const off = half - POST_T - 0.35;
        cable.position.set(ejeZ ? off : 0, H - 0.55, ejeZ ? 0 : off);
        cable.rotation.y = ejeZ ? 0 : Math.PI / 2;
        this.group.add(cable);
      }
      // Charcos de agua (drenaje pobre en el cruce) fuera del eje de rodadura.
      const nCharcos = Math.floor(this._rnd() * 3); // 0..2
      for (let i = 0; i < nCharcos; i++) {
        try {
          const ch = crearCharco({});
          const ang = this._rnd() * Math.PI * 2;
          const r = half * (0.35 + this._rnd() * 0.35);
          ch.position.set(Math.cos(ang) * r, 0.02, Math.sin(ang) * r);
          this.group.add(ch);
        } catch { /* charco opcional: nunca rompe el build */ }
      }
    }

    return this;
  }

  _isOpen(dir) {
    return this.openDirs.some(d => d.x * dir.x + d.z * dir.z > 0.7);
  }
}
