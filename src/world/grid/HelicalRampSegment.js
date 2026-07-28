import * as THREE from 'three';
import { createHelicalTunnelShell, createHelicalFloorBerma } from '../segments/TunnelGeometry.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { createHangingBulb } from '../../lighting/HangingBulb.js';
import { crearSenal } from '../../elementos/senal/senal.js';
import { geometriaCharco, materialCharco } from '../../elementos/entorno/charco.js';

/**
 * HelicalRampSegment — RAMPA EN ESPIRAL (decline helicoidal) que conecta dos niveles.
 *
 * A diferencia de un EdgeSegment recto inclinado, esta rampa describe una helice: la roca
 * (hastiales + arco de herradura), el piso y la berma de contencion se barren a lo largo de
 * una curva (ver `TunnelGeometry.createHelicalTunnelShell`). Para que el jugador/vehiculos la
 * recorran sin reescribir la fisica, la parte VISUAL (una malla curva cacheable) se DESACOPLA
 * de la COLISION/CONTENCION: la helice se aproxima con una cadena de SPANS rectos cortos
 * inclinados. Cada span es un pseudo-tramo (con su propio grupo orientado, `_localBounds` y
 * colisionadores) que GridWorld ya sabe consumir en `boundsCheck`/`groundHeight` y la fisica
 * en `buildSegmentColliders` — sin tocar esos sistemas.
 *
 * El grupo se posiciona con el EJE del helicoide en `helix.axis` (x,z) y el PISO superior en
 * `helix.topY`; la geometria local desciende en -Y hasta `-drop`.
 */
export class HelicalRampSegment {
  /**
   * @param {object} o
   * @param {object} o.helix   { axis:{x,z}, topY, radius, startAngle, totalAngle, drop, label }
   * @param {{width:number,height:number}} o.dim  seccion de la rampa
   * @param {object} o.lighting  rig de luces (canAddLight/noteLight)
   * @param {import('../../procedural/Rng.js').Rng} o.rng
   */
  constructor({ helix, dim, lighting, rng, variant = null }) {
    this.helix = helix;
    this.width = dim.width;
    this.height = dim.height;
    this.variant = variant || {};
    this.lighting = lighting;
    this.rng = rng;

    this.type = 'helixVisual';
    this.skipBounds = true;        // la contencion/piso la aportan los SPANS, no el visual
    this.group = new THREE.Group();
    this.group.name = 'rampa_espiral';
    this.animated = [];
    this.interactables = [];
    this.hazards = [];
    this.colliders = [];           // el visual no colisiona (lo hacen los spans)
    this.spans = [];               // pseudo-tramos de colision/contencion
  }

  build() {
    const { axis, topY, radius, startAngle, totalAngle, drop } = this.helix;
    const arcLen = Math.abs(totalAngle) * radius;
    // Densidad longitudinal del barrido visual: ~1 anillo cada 1.3 m (curva suave).
    const rows = Math.max(24, Math.round(arcLen / 1.3));

    // ── Carcasa curva (roca) ──
    const shellGeo = createHelicalTunnelShell({
      width: this.width, height: this.height, radius, startAngle, totalAngle, drop,
      rows, jitter: 0.42,
      archRatio: this.variant.archRatio ?? 0.40,
      rockType: this.variant.rockType ?? 'caliza',
      rng: () => this.rng.next()
    });
    const shell = new THREE.Mesh(shellGeo, MineMaterials.rocaTunel());
    shell.receiveShadow = true;
    shell.name = 'helix_shell';
    this.group.add(shell);

    // ── Piso curvo + berma exterior ──
    const { floorGeo, bermaGeo } = createHelicalFloorBerma({
      width: this.width, radius, startAngle, totalAngle, drop, rows
    });
    const floor = new THREE.Mesh(floorGeo, MineMaterials.barroMojado());
    floor.receiveShadow = true;
    floor.name = 'helix_floor';
    this.group.add(floor);

    const berma = new THREE.Mesh(bermaGeo, MineMaterials.plano(0x6b6459, { rough: 0.95 }));
    berma.name = 'helix_berma';
    this.group.add(berma);

    // ── Bombillas colgantes calidas a lo largo del eje (identidad de rampa) ──
    const nb = Math.max(3, Math.round(arcLen / 7));
    for (let i = 0; i < nb; i++) {
      const f = (i + 0.5) / nb;
      const th = startAngle + totalAngle * f;
      this.group.add(createHangingBulb({
        position: new THREE.Vector3(
          radius * Math.cos(th), -drop * f + this.height - 0.5, radius * Math.sin(th)
        ),
        lighting: this.lighting
      }));
    }

    // ── Señal de pendiente/velocidad en la boca superior (se lee al entrar a la rampa) ──
    try {
      const s = crearSenal('rampa');
      const thS = startAngle;
      const ct = Math.cos(thS), st = Math.sin(thS);
      const lat = this.width / 2 - 0.2;
      s.position.set(radius * ct + ct * lat, 2.0, radius * st + st * lat);
      s.rotation.y = Math.atan2(-ct, -st);   // mira hacia el centro de la labor
      this.group.add(s);
    } catch { /* decorativo: nunca rompe el build */ }

    // ── Sostenimiento + servicios + refugios: que la rampa se vea como una LABOR ──
    this._decorate();

    this.group.position.set(axis.x, topY, axis.z);

    // ── Spans de colision/contencion (cadena de tramos rectos inclinados) ──
    this._buildSpans();

    // Centro para el culling por distancia (mitad de la rampa).
    const midTh = startAngle + totalAngle * 0.5;
    this._center = new THREE.Vector3(
      axis.x + radius * Math.cos(midTh),
      topY - drop * 0.5 + this.height * 0.5,
      axis.z + radius * Math.sin(midTh)
    );
    return this;
  }

  /**
   * DECORA la rampa como una labor real: pernos de sostenimiento (InstancedMesh) en el arco,
   * charcos reflectivos en el piso, una corrida de cable por el hastial y balizas de REFUGIO a
   * intervalos. Todo en coordenadas LOCALES (el grupo se posiciona despues). Barato: 2-3 draw
   * calls instanciados + 1 tubo; se oculta con el streaming cuando la rampa esta lejos.
   */
  _decorate() {
    const { radius, startAngle, totalAngle, drop } = this.helix;
    const H = this.height, halfW = this.width / 2;
    const arcLen = Math.abs(totalAngle) * radius;
    const g = this.group;
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), scl = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3(), inward = new THREE.Vector3(), ctr = new THREE.Vector3();

    // Marco local (centro del piso + direccion radial = ancho de la seccion) en la fraccion f.
    const frame = (f) => {
      const th = startAngle + totalAngle * f;
      return {
        c: new THREE.Vector3(radius * Math.cos(th), -drop * f, radius * Math.sin(th)),
        radial: new THREE.Vector3(Math.cos(th), 0, Math.sin(th)),
        th
      };
    };

    // ── Pernos + placas de sostenimiento en el arco (2 InstancedMesh) ──
    const rings = Math.max(6, Math.round(arcLen / 2.6));
    const cross = [{ x: -0.85, y: 0.60 }, { x: -0.45, y: 0.92 }, { x: 0, y: 1.0 }, { x: 0.45, y: 0.92 }, { x: 0.85, y: 0.60 }];
    const n = rings * cross.length;
    const bMat = MineMaterials.aceroOxidado();
    const pernos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 6), bMat, n);
    const placas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.03), bMat, n);
    let ii = 0;
    for (let r = 0; r < rings; r++) {
      const { c, radial } = frame((r + 0.5) / rings);
      ctr.copy(c).addScaledVector(up, H * 0.5);
      for (const cr of cross) {
        pos.copy(c).addScaledVector(radial, cr.x * halfW).addScaledVector(up, cr.y * H);
        inward.copy(ctr).sub(pos).normalize();
        q.setFromUnitVectors(up, inward);
        m.compose(pos, q, scl); placas.setMatrixAt(ii, m);
        pos.addScaledVector(inward, 0.13);
        m.compose(pos, q, scl); pernos.setMatrixAt(ii, m);
        ii++;
      }
    }
    pernos.instanceMatrix.needsUpdate = placas.instanceMatrix.needsUpdate = true;
    pernos.name = 'ramp_pernos'; g.add(pernos); g.add(placas);

    // ── Charcos reflectivos en el piso (InstancedMesh) ──
    const nCh = Math.max(4, Math.round(arcLen / 6));
    const charcos = new THREE.InstancedMesh(geometriaCharco(), materialCharco(), nCh);
    for (let i = 0; i < nCh; i++) {
      const { c, radial } = frame((i + 0.5) / nCh);
      pos.copy(c).addScaledVector(radial, Math.sin(i * 2.3) * halfW * 0.5); pos.y += 0.02;
      scl.set(0.9 + (i % 3) * 0.4, 1, 0.7 + (i % 2) * 0.5);
      m.compose(pos, q.identity(), scl); charcos.setMatrixAt(i, m);
    }
    charcos.instanceMatrix.needsUpdate = true; charcos.name = 'ramp_charcos'; g.add(charcos);
    scl.set(1, 1, 1);

    // ── Corrida de CABLE por el hastial (tubo que sigue la curva) ──
    const steps = Math.max(12, rings);
    const cablePts = [];
    for (let i = 0; i <= steps; i++) {
      const { c, radial } = frame(i / steps);
      cablePts.push(c.clone().addScaledVector(radial, halfW * 0.92).addScaledVector(up, H * 0.78));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), steps, 0.05, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85, metalness: 0.1 })
    );
    tube.name = 'ramp_cable'; g.add(tube);

    // ── Balizas de REFUGIO peatonal a lo largo de la rampa (cada ~20 m; bloom en la oscuridad) ──
    const nRef = Math.max(1, Math.round(arcLen / 20));
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0x0a3d1a, emissive: 0x35ff55, emissiveIntensity: 2.6, roughness: 0.5 });
    for (let i = 0; i < nRef; i++) {
      const { c, radial } = frame((i + 0.5) / nRef);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), beaconMat);
      b.position.copy(c).addScaledVector(radial, halfW - 0.1).addScaledVector(up, 2.0);
      b.name = 'ramp_refugio'; g.add(b);
    }
  }

  /**
   * Aproxima la helice con N tramos rectos inclinados. Cada uno queda como un pseudo-tramo
   * INDEPENDIENTE (su grupo orientado + colisionadores locales) que se empuja a
   * `world.segments`. La desviacion cuerda↔arco es de pocos cm (el ancho del tunel y el
   * margen de `boundsCheck` la absorben).
   */
  _buildSpans() {
    const { axis, topY, radius, startAngle, totalAngle, drop } = this.helix;
    const arcLen = Math.abs(totalAngle) * radius;
    const nSpans = Math.max(8, Math.round(arcLen / 5));   // ~1 span cada 5 m
    const halfW = this.width / 2;
    const H = this.height;

    // Punto del EJE (mundo) en la fraccion f del recorrido.
    const pointAt = (f) => {
      const th = startAngle + totalAngle * f;
      return new THREE.Vector3(
        axis.x + radius * Math.cos(th),
        topY - drop * f,
        axis.z + radius * Math.sin(th)
      );
    };

    for (let i = 0; i < nSpans; i++) {
      const A = pointAt(i / nSpans);
      const B = pointAt((i + 1) / nSpans);
      const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
      const hrun = Math.hypot(dx, dz) || 0.001;
      const len = Math.hypot(hrun, dy);
      const yaw = Math.atan2(-dx, -dz);          // heading horizontal (misma convencion que edges)
      const pitch = Math.atan2(dy, hrun);        // inclinacion sobre el recorrido

      // Grupo orientado del span: entrada en z=0 local, se extiende por -Z hacia B.
      const g = new THREE.Group();
      g.position.copy(A);
      g.rotation.set(pitch, yaw, 0, 'YXZ');
      g.updateMatrixWorld(true);

      // Colisionadores locales (mismo layout que BaseSegment, con solape en las costuras).
      const colliders = [
        { hx: halfW + 0.5, hy: 0.1, hz: len / 2 + 0.3, pos: [0, -0.1, -len / 2] },          // piso
        { hx: 0.1, hy: H / 2 + 0.2, hz: len / 2, pos: [halfW,  H / 2 - 0.2, -len / 2], tag: 'wallR' },
        { hx: 0.1, hy: H / 2 + 0.2, hz: len / 2, pos: [-halfW, H / 2 - 0.2, -len / 2], tag: 'wallL' },
        { hx: halfW, hy: 0.1, hz: len / 2, pos: [0, H, -len / 2] },                          // techo
      ];

      this.spans.push({
        group: g,
        type: 'ramp',
        width: this.width, height: H, length: len,
        colliders,
        animated: [], interactables: [], hazards: [],
        _center: new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2 + H * 0.5, (A.z + B.z) / 2),
        isHelixSpan: true
      });
    }
  }
}
