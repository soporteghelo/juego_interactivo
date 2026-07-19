import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * MALLA DE ACERO (wire mesh) de sostenimiento.
 * md: cuadricula ~10cm, se oxida (cafe-oxido), cubre paredes y techo.
 *
 * Variante "sobresalida" (basada en fotos reales de mina):
 *   - Malla muy abombada/rasgada hacia afuera (roca empujando la malla al tunel).
 *   - Multiples jorobas irregulares (no solo una central).
 *   - Extremos de varilla/alambre sueltos sobresaliendo en angulos peligrosos.
 *   - Hazard tipo:'corte' — al contacto causa herida (pero NO mata al jugador).
 */

export const meta = {
  id: 'malla',
  nombre: 'Malla de acero',
  descripcion: 'Cuadricula de sostenimiento oxidada. Variante sobresalida con extremos de varilla peligrosos.'
};

let _texCache = null;
let _matNormal = null;
let _matSobre  = null;

function texturaCuadricula() {
  if (_texCache) return _texCache;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  // Fondo transparente
  ctx.clearRect(0, 0, 256, 256);
  // Alambres: trama cruzada oxidada
  ctx.strokeStyle = '#8B3A18';
  ctx.lineWidth = 8;
  const paso = 28;
  for (let i = 0; i <= 256; i += paso) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  // Nodos de union mas oscuros/gruesos
  ctx.fillStyle = '#5A1E08';
  for (let x = 0; x <= 256; x += paso) {
    for (let y = 0; y <= 256; y += paso) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Manchas de oxido irregulares
  const rustPts = [[30,40],[90,120],[180,60],[140,200],[60,210],[220,150]];
  for (const [rx, ry] of rustPts) {
    const rg = ctx.createRadialGradient(rx, ry, 2, rx, ry, 22);
    rg.addColorStop(0, 'rgba(130,55,15,0.55)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(rx, ry, 22, 0, Math.PI * 2); ctx.fill();
  }
  _texCache = new THREE.CanvasTexture(c);
  _texCache.wrapS = _texCache.wrapT = THREE.RepeatWrapping;
  return _texCache;
}

function _getMat(sobresalida) {
  if (sobresalida) {
    if (!_matSobre) _matSobre = new THREE.MeshStandardMaterial({
      map: texturaCuadricula(),
      transparent: true, alphaTest: 0.3,
      roughness: 0.92, metalness: 0.55,
      color: 0x6a2a0a, side: THREE.DoubleSide
    });
    return _matSobre;
  }
  if (!_matNormal) _matNormal = new THREE.MeshStandardMaterial({
    map: texturaCuadricula(),
    transparent: true, alphaTest: 0.3,
    roughness: 0.92, metalness: 0.55,
    color: 0x7a3a18, side: THREE.DoubleSide
  });
  return _matNormal;
}

// Escala los UVs de la geometría en lugar de clonar la textura con repeat distinto.
function _scaleUVs(geo, repeatX, repeatY) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatX, uv.getY(i) * repeatY);
  }
  uv.needsUpdate = true;
}

function seudoRng(seed) {
  let s = seed & 0xffffffff;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * @param {{width?:number, height?:number, sobresalida?:boolean, seed?:number}} opts
 * @returns {THREE.Mesh|THREE.Group}
 */
export function crear({ width = 3, height = 2.2, sobresalida = false, seed = 42 } = {}) {
  const mat = _getMat(sobresalida);
  const repeatX = width * 2.8;
  const repeatY = height * 2.8;

  if (!sobresalida) {
    // Malla plana simple con leve irregularidad
    const geo = new THREE.PlaneGeometry(width, height, 6, 5);
    _scaleUVs(geo, repeatX, repeatY);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, (Math.random() - 0.5) * 0.025);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'malla';
    return mesh;
  }

  // ══════════════════════════════════════════════════════════════════
  //  MALLA SOBRESALIDA — con deformacion grave y extremos peligrosos
  // ══════════════════════════════════════════════════════════════════
  const g = new THREE.Group();
  g.name = 'malla_sobresalida';

  const rng = seudoRng(seed);

  // Numero de jorobas/abombamientos (2-4 segun seed)
  const nBulges = 2 + Math.floor(rng() * 3);
  const bulges = [];
  for (let b = 0; b < nBulges; b++) {
    bulges.push({
      cx:  (rng() - 0.5) * width  * 0.72,
      cy:  (rng() - 0.5) * height * 0.65,
      str: 0.18 + rng() * 0.28,   // protrusion: 0.18 - 0.46m (un tercio del original)
      rx:  0.5  + rng() * 0.70,
      ry:  0.45 + rng() * 0.55
    });
  }

  // Panel principal con deformacion (alta subdivision para mejor forma)
  const segsX = 18, segsY = 12;
  const geo = new THREE.PlaneGeometry(width, height, segsX, segsY);
  _scaleUVs(geo, repeatX, repeatY);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = 0;
    for (const b of bulges) {
      const dx = (x - b.cx) / b.rx;
      const dy = (y - b.cy) / b.ry;
      const r2 = dx * dx + dy * dy;
      // Funcion de joroba: maxima en el centro, cae suavemente
      z += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
    }
    // Jitter de rugosidad (la malla no es lisa)
    z += (rng() - 0.5) * 0.018;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const panel = new THREE.Mesh(geo, mat);
  g.add(panel);

  // ── EXTREMOS DE VARILLA / ALAMBRE SUELTO ─────────────────────────
  // Simulan los extremos cortados de la malla que sobresalen peligrosamente.
  const matVar = MineMaterials.plano(0x4a1a06, { rough: 0.92, metal: 0.75 });

  const nVarillas = 9 + Math.floor(rng() * 8); // 9-16 extremos sueltos
  for (let i = 0; i < nVarillas; i++) {
    const largo  = 0.10 + rng() * 0.40; // 10-50cm
    const radio  = 0.003 + rng() * 0.004;
    const varilla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 0.5, largo, 5), matVar);

    // Posicion: mezcla de bordes (mas peligrosos) y superficie irregular
    const enBorde = rng() < 0.55;
    let vx, vy, vz;
    if (enBorde) {
      const borde = Math.floor(rng() * 4);
      const t = rng();
      switch (borde) {
        case 0: vx = -width / 2 + t * width; vy =  height / 2 + rng() * 0.08; break;
        case 1: vx = -width / 2 + t * width; vy = -height / 2 - rng() * 0.08; break;
        case 2: vx = -width / 2 - rng() * 0.06; vy = -height / 2 + t * height; break;
        default: vx =  width / 2 + rng() * 0.06; vy = -height / 2 + t * height; break;
      }
      // Profundidad de la joroba en ese punto (estimacion)
      let zBase = 0;
      for (const b of bulges) {
        const dx = (vx - b.cx) / b.rx;
        const dy = (vy - b.cy) / b.ry;
        const r2 = dx * dx + dy * dy;
        zBase += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
      }
      vz = zBase + largo * 0.3;
    } else {
      vx = (rng() - 0.5) * width  * 0.9;
      vy = (rng() - 0.5) * height * 0.9;
      // Profundidad de la joroba en este punto
      let zBase = 0;
      for (const b of bulges) {
        const dx = (vx - b.cx) / b.rx;
        const dy = (vy - b.cy) / b.ry;
        const r2 = dx * dx + dy * dy;
        zBase += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
      }
      vz = zBase + 0.05 + rng() * 0.25;
    }

    varilla.position.set(vx, vy, vz + largo / 2);
    // Angulo peligroso: mayormente saliendo hacia afuera (+Z), con desviacion irregular
    varilla.rotation.x = (rng() - 0.5) * 1.6;
    varilla.rotation.z = (rng() - 0.5) * 1.6;
    g.add(varilla);
  }

  // ── FRAGMENTOS DE SHOTCRETE pegados a la malla ─────────────────
  // Trozos de concreto colgando donde la roca empezo a ceder.
  const matCem = MineMaterials.plano(0x8a8880, { rough: 0.98, metal: 0 });
  const nFrags = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < nFrags; i++) {
    const fw = 0.15 + rng() * 0.30;
    const fh = 0.10 + rng() * 0.20;
    const fd = 0.04 + rng() * 0.08;
    const frag = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), matCem);
    const fx = (rng() - 0.5) * width * 0.7;
    const fy = (rng() - 0.5) * height * 0.7;
    let fz = 0;
    for (const b of bulges) {
      const dx = (fx - b.cx) / b.rx;
      const dy = (fy - b.cy) / b.ry;
      const r2 = dx * dx + dy * dy;
      fz += b.str * Math.max(0, 1 - r2 * 0.7) * Math.exp(-r2 * 0.35);
    }
    frag.position.set(fx, fy, fz - fd / 2 - 0.01);
    frag.rotation.set((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.3);
    g.add(frag);
  }

  // ── PELIGRO: corte al contacto (NO mata, solo hiere) ────────────
  g.userData.hazard = {
    tipo:     'corte',
    warn:     1.5,    // avisa al acercarse
    hurt:     0.35,   // causa herida al contacto (~35cm = rozar la pared)
    aviso:    'MALLA SOBRESALIDA — extremos de varilla cortantes. Mantente alejado de la pared.',
    reflexion:
      'La malla de sostenimiento estaba deformada con extremos de varilla sueltos. ' +
      'Al rozar la pared, estos extremos te produjeron una cortadura. Siempre inspecciona ' +
      'visualmente las paredes antes de acercarte y reporta toda malla sobresalida ' +
      'al responsable de geomecanica para reparacion inmediata.'
  };

  return g;
}
