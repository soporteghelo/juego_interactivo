import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * BASURA / ACUMULACION DE RESIDUOS EN GALERIA
 * Tres variantes observadas en la mina:
 *   'chatarra' — malla vieja, cables, varillas y fragmentos metalicos en el piso
 *   'embalaje' — cajas de carton, bolsas plasticas y papel disperso
 *   'mixta'    — combinacion de ambas con lona roja central (la mas comun)
 *
 * Cada variante es un grupo THREE.Group listo para agregar a la escena.
 * Las posiciones internas usan funciones sin/cos para ser deterministas (sin Math.random).
 */
export const meta = {
  id: 'basura',
  nombre: 'Basura / acumulacion de residuos',
  descripcion: '3 variantes: chatarra metalica, materiales de embalaje, y mixta con lona.'
};

// ─── helpers ───────────────────────────────────────────────────────────────
function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function put(g, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}

/**
 * Trozo de malla oxidada tirada en el suelo (LineSegments sobre plano deformado).
 * @param {THREE.Material} mat
 * @param {number} seed  variacion de forma (0-1)
 */
function trozoDeMalla(mat, seed = 0) {
  const cols = 6, rows = 5;
  const W = 0.55 + seed * 0.3, H = 0.42 + seed * 0.15;
  const verts = [];
  const deform = (x, y) => Math.sin(x * 4.3 + seed * 2) * Math.cos(y * 3.1 + seed) * 0.06;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = (c / cols - 0.5) * W, x1 = ((c + 1) / cols - 0.5) * W;
      const y  = (r / rows - 0.5) * H;
      verts.push(x0, y, deform(x0, y), x1, y, deform(x1, y));
    }
  }
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x  = (c / cols - 0.5) * W;
      const y0 = (r / rows - 0.5) * H, y1 = ((r + 1) / rows - 0.5) * H;
      verts.push(x, y0, deform(x, y0), x, y1, deform(x, y1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return new THREE.LineSegments(geo, mat);
}

/** Caja de carton: puede estar abierta y/o aplastada. */
function cajaCarton(matBase, matOscuro, abierta, aplastada) {
  const g = new THREE.Group();
  const mat = abierta ? matOscuro : matBase;
  const h   = aplastada ? 0.05 : (abierta ? 0.26 : 0.30);
  const W = 0.40, D = 0.30;
  put(g, bx(W, h, D, mat), 0, h / 2, 0);
  if (!aplastada && abierta) {
    // Tapa trasera levantada
    const tapa = bx(W, 0.008, D / 2, mat);
    put(g, tapa, 0, h + 0.03, -D / 4 + 0.02, -Math.PI / 3, 0, 0);
    // Tapa lateral
    const tapaL = bx(W / 2, 0.008, D, mat);
    put(g, tapaL, W / 4 + 0.02, h + 0.01, 0, 0, 0, Math.PI / 4);
  }
  return g;
}

/** Bolsa plastica: plane deformado ligeramente arrugado. */
function bolsaPlastica(mat, seed) {
  const geo = new THREE.PlaneGeometry(0.52, 0.40, 5, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const xi = pos.getX(i), yi = pos.getY(i);
    pos.setZ(i, Math.sin(xi * 5.1 + seed) * Math.cos(yi * 3.8 + seed * 0.7) * 0.045);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Lona/tarp tirada en el suelo (plano ondulado grande). */
function lona(mat) {
  const geo = new THREE.PlaneGeometry(1.10, 0.75, 8, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const xi = pos.getX(i), yi = pos.getY(i);
    pos.setZ(i, Math.sin(xi * 2.0) * Math.cos(yi * 1.7) * 0.13 + Math.sin(xi * 5.3 + 1.2) * 0.04);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ─── materiales ─────────────────────────────────────────────────────────────
function buildMaterials() {
  return {
    carton:    MineMaterials.plano(0x7a5a28, { rough: 0.96, metal: 0 }),
    cartonMoj: MineMaterials.plano(0x5c3e18, { rough: 0.98, metal: 0 }),
    plastico:  new THREE.MeshStandardMaterial({ color: 0x7a8eaa, roughness: 0.35, metalness: 0.12, transparent: true, opacity: 0.88 }),
    plasticoS: new THREE.MeshStandardMaterial({ color: 0xaab4c0, roughness: 0.28, metalness: 0.18, transparent: true, opacity: 0.80 }),
    lonaRoja:  MineMaterials.plano(0xbb1a00, { rough: 0.76, metal: 0 }),
    alambre:   new THREE.LineBasicMaterial({ color: 0x8a6418 }),
    cable:     MineMaterials.plano(0x141414, { rough: 0.88, metal: 0.10 }),
    metal:     MineMaterials.plano(0x6a6a66, { rough: 0.72, metal: 0.55 }),
    papel:     MineMaterials.plano(0xc8c4a8, { rough: 0.98, metal: 0 }),
    roca:      MineMaterials.roca()
  };
}

// ─── variante: CHATARRA ─────────────────────────────────────────────────────
function buildChatarra(g, m) {
  // Trozos de malla vieja en el piso
  const malla1 = trozoDeMalla(m.alambre, 0.1);
  put(g, malla1, -0.55, 0.01, 0.25, Math.PI / 2 - 0.18, 0.35, 0.12);

  const malla2 = trozoDeMalla(m.alambre, 0.6);
  put(g, malla2, 0.45, 0.01, -0.25, Math.PI / 2 - 0.10, -0.82, -0.08);

  const malla3 = trozoDeMalla(m.alambre, 0.3);
  put(g, malla3, -0.10, 0.12, -0.55, Math.PI / 2 - 0.35, 1.20, 0.25);

  // Cables tirados
  const cablesData = [
    [-0.80, 0.45, 0.42, 1.20],
    [ 0.20, -0.60, -0.28, 0.85],
    [ 0.65, 0.38, 1.15, 0.70],
    [-0.30, -0.70, 0.65, 0.55]
  ];
  for (const [cx, cz, cry, clen] of cablesData) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, clen, 5), m.cable);
    put(g, cable, cx, 0.013, cz, 0, cry, Math.PI / 2 - 0.08);
  }

  // Varilla / rebar metalica
  const varilla = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.10, 6), m.metal);
  put(g, varilla, -0.05, 0.018, 0.05, 0, 0.55, Math.PI / 2);

  // Fragmentos de roca/hormigon
  for (const [rx, rz, rrx, rry, rs] of [[-0.62, -0.38, 0.22, 0.42, 0.12], [0.50, 0.60, 0.12, -0.32, 0.09]]) {
    const frag = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), m.roca);
    put(g, frag, rx, rs, rz, rrx, rry, 0.15);
  }

  // Tubo metalico aplastado
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.65, 8), m.metal);
  put(g, tubo, 0.70, 0.04, 0.55, 0.08, -0.40, Math.PI / 2);
}

// ─── variante: EMBALAJE ─────────────────────────────────────────────────────
function buildEmbalaje(g, m) {
  // Cajas de carton
  const cajasData = [
    { x: 0.12, z: 0.30, ry: 0.22, abierta: true,  aplastada: false },
    { x: -0.50, z: -0.18, ry: -0.48, abierta: false, aplastada: false },
    { x: 0.58, z: -0.08, ry: 1.12,  abierta: false, aplastada: true  },
    { x: -0.08, z: 0.72, ry: 0.82,  abierta: true,  aplastada: false },
    { x: 0.82, z: 0.52,  ry: -0.32, abierta: false, aplastada: true  },
    { x: -0.72, z: 0.60, ry: 0.55,  abierta: false, aplastada: false },
  ];
  for (const d of cajasData) {
    const cj = cajaCarton(m.carton, m.cartonMoj, d.abierta, d.aplastada);
    cj.position.set(d.x, 0, d.z);
    cj.rotation.y = d.ry;
    g.add(cj);
  }

  // Bolsas plasticas en el suelo
  const bolsasData = [[-0.30, 0.50, 0.60], [0.38, 0.82, -0.32], [-0.72, -0.12, 1.22], [0.20, -0.48, 0.18]];
  for (const [px, pz, pry] of bolsasData) {
    const b = bolsaPlastica(Math.sin(pry) > 0 ? m.plastico : m.plasticoS, pry);
    put(g, b, px, 0.005, pz, -Math.PI / 2, 0, pry);
  }

  // Papeles/cartulinas planas en el piso
  for (const [ppx, ppz, ppry] of [[0.22, -0.50, 0.20], [-0.82, 0.42, -0.80], [0.50, 0.60, 1.10]]) {
    const papel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), m.papel);
    put(g, papel, ppx, 0.004, ppz, -Math.PI / 2, 0, ppry);
  }
}

// ─── variante: MIXTA ────────────────────────────────────────────────────────
function buildMixta(g, m) {
  // Lona roja central (protagonista visual como en las fotos)
  const l = lona(m.lonaRoja);
  put(g, l, -0.10, 0.015, -0.40, -Math.PI / 2, 0, 0.18);

  // Cajas encima/alrededor de la lona
  const cajasM = [
    { x: 0.10, z: 0.28, ry: 0.20, abierta: true,  aplastada: false },
    { x: -0.45, z: -0.15, ry: -0.45, abierta: false, aplastada: false },
    { x: 0.55, z: -0.05, ry: 1.10, abierta: false, aplastada: true  },
  ];
  for (const d of cajasM) {
    const cj = cajaCarton(m.carton, m.cartonMoj, d.abierta, d.aplastada);
    cj.position.set(d.x, 0, d.z); cj.rotation.y = d.ry;
    g.add(cj);
  }

  // Trozo de malla
  const malla1 = trozoDeMalla(m.alambre, 0.4);
  put(g, malla1, 0.60, 0.01, 0.50, Math.PI / 2 - 0.15, -0.60, 0.10);

  // Cables
  for (const [cx, cz, cry, clen] of [[-0.75, 0.40, 0.45, 1.0], [0.25, -0.55, -0.30, 0.70]]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, clen, 5), m.cable);
    put(g, cable, cx, 0.013, cz, 0, cry, Math.PI / 2 - 0.08);
  }

  // Bolsas plasticas
  for (const [px, pz, pry] of [[-0.65, 0.55, 0.70], [0.40, 0.78, -0.38]]) {
    const b = bolsaPlastica(m.plasticoS, pry);
    put(g, b, px, 0.005, pz, -Math.PI / 2, 0, pry);
  }

  // Papel
  const papel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), m.papel);
  put(g, papel, 0.22, 0.004, -0.52, -Math.PI / 2, 0, 0.22);

  // Fragmento de roca
  const frag = new THREE.Mesh(new THREE.DodecahedronGeometry(0.10, 0), m.roca);
  put(g, frag, -0.60, 0.10, -0.45, 0.18, 0.38, 0.12);
}

// ─── export principal ────────────────────────────────────────────────────────
/**
 * @param {{'chatarra'|'embalaje'|'mixta'}} opts.variante
 * @returns {THREE.Group}
 */
export function crear({ variante = 'mixta' } = {}) {
  const g = new THREE.Group();
  const m = buildMaterials();

  switch (variante) {
    case 'chatarra': buildChatarra(g, m); break;
    case 'embalaje': buildEmbalaje(g, m); break;
    default:         buildMixta(g, m);    break;
  }

  g.name = `basura_${variante}`;
  g.userData.hazard = {
    tipo: 'ordenAseo',
    warn: 0.9,
    // Solo advertencia (sin kill ni hurt): el desorden avisa pero no lesiona por si mismo.
    aviso: 'ZONA CON RESIDUOS — el desorden en la labor es un riesgo. Reporta al supervisor.',
    reflexion:
      'Transitaste por una zona con acumulacion de residuos. El desorden en las labores ' +
      'aumenta el riesgo de tropiezos, incendios y contaminacion. Mantener el orden ' +
      'y aseo es responsabilidad de todos los trabajadores de la mina.'
  };
  return g;
}
