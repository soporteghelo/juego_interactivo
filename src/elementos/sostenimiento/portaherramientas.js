import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * PORTAHERRAMIENTAS — rack metálico anclado al hastial para colgar herramientas de la labor
 * (barretillas de desatado, palas, etc.). Según la foto real de mina:
 *  - Bastidor de varilla de acero pintada (tono amarillo/tan) que sobresale del hastial.
 *  - Rótulo verde "HERRAMIENTAS" en la parte superior.
 *  - Fila de ganchos con PUNTA AZUL en la barra frontal donde cuelgan las herramientas.
 *  - Herramientas apoyadas: una barretilla (barra de desatado) y una pala.
 *
 * Convención (como barretillas.js): el hastial es el plano XY (z≈0) y el rack PROYECTA hacia
 * +Z (fuera de la pared). Ancho en X, alto en Y. Se rota como cualquier prop de pared.
 *
 * @param {{conHerramientas?:boolean}} opts
 */

export const meta = {
  id: 'portaherramientas',
  nombre: 'Portaherramientas (rack de labor)',
  descripcion: 'Rack de acero anclado al hastial con rótulo verde "HERRAMIENTAS" y ganchos de punta azul para colgar barretillas, palas y otras herramientas.'
};

const matFrame  = () => MineMaterials.plano(0xcbb96f, { rough: 0.55, metal: 0.45 }); // varilla acero pintada tan
const matHook   = () => MineMaterials.plano(0xcbb96f, { rough: 0.55, metal: 0.45 });
const matTip    = () => MineMaterials.plano(0x2a6fc4, { rough: 0.45, metal: 0.1 });  // punta azul del gancho
const matBrkt   = () => MineMaterials.plano(0x35363a, { rough: 0.7, metal: 0.55 });  // placa de anclaje
const matMango  = () => MineMaterials.plano(0xb98a4a, { rough: 0.9, metal: 0.0 });   // mango de madera
const matNaranja= () => MineMaterials.plano(0xe4671e, { rough: 0.55, metal: 0.1 });  // grip/punta naranja
const matAcero  = () => MineMaterials.plano(0x6f6f72, { rough: 0.6, metal: 0.55 });  // acero herramienta

/** Cilindro (varilla) entre dos puntos. */
function rod(p1, p2, r, mat) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

// -- Rótulo verde "HERRAMIENTAS" --------------------------------------------------
let _texRotulo = null;
function texturaRotulo() {
  if (_texRotulo) return _texRotulo;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 130;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f8038'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#0e3d19'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
  // Texto blanco con contorno azul (estilo del letrero real)
  ctx.font = 'bold 62px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = '#123f8f';
  ctx.strokeText('HERRAMIENTAS', c.width / 2, c.height / 2 + 4, c.width - 30);
  ctx.fillStyle = '#f4f4ea';
  ctx.fillText('HERRAMIENTAS', c.width / 2, c.height / 2 + 4, c.width - 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  _texRotulo = tex;
  return tex;
}

/** Barra de desatado (barretilla) simplificada, colgada casi vertical. */
function crearBarraDesatado() {
  const g = new THREE.Group();
  const L = 1.25;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, L, 12), matAcero());
  shaft.castShadow = true; g.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.18, 12), matNaranja());
  grip.position.y = L / 2 - 0.12; g.add(grip);             // grip naranja arriba
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.10, 12), matAcero());
  tip.position.y = -L / 2 - 0.04; g.add(tip);              // uña abajo
  return g;
}

/** Pala (shovel): mango + grip en Y naranja + hoja metálica. */
function crearPala() {
  const g = new THREE.Group();
  const L = 0.95;
  const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, L, 12), matMango());
  mango.castShadow = true; g.add(mango);
  // Grip en Y (naranja) arriba
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), matNaranja());
  collar.position.y = L / 2 + 0.01; g.add(collar);
  for (const sx of [-1, 1]) {
    const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 8), matNaranja());
    brazo.position.set(sx * 0.03, L / 2 + 0.08, 0); brazo.rotation.z = sx * 0.5; g.add(brazo);
  }
  const cruz = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 8), matNaranja());
  cruz.rotation.z = Math.PI / 2; cruz.position.y = L / 2 + 0.135; g.add(cruz);
  // Hoja de la pala abajo
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.10, 10), matAcero());
  cuello.position.y = -L / 2 - 0.045; g.add(cuello);
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.015), matAcero());
  hoja.position.y = -L / 2 - 0.20; hoja.rotation.x = 0.12;
  hoja.castShadow = true; g.add(hoja);
  return g;
}

export function crear({ conHerramientas = true } = {}) {
  const g = new THREE.Group();
  g.name = 'portaherramientas';

  const HX = 0.45;      // semiancho (X)
  const yTop = 1.56, yBot = 1.12;
  const zW = 0.02, zFT = 0.34, zFB = 0.30; // z pared / frente-arriba / frente-abajo
  const r = 0.011;
  const fm = matFrame();

  // Puntos del bastidor
  const P = {
    WTL: new THREE.Vector3(-HX, yTop, zW), WTR: new THREE.Vector3(HX, yTop, zW),
    WBL: new THREE.Vector3(-HX, yBot, zW), WBR: new THREE.Vector3(HX, yBot, zW),
    FTL: new THREE.Vector3(-HX, yTop, zFT), FTR: new THREE.Vector3(HX, yTop, zFT),
    FBL: new THREE.Vector3(-HX, yBot, zFB), FBR: new THREE.Vector3(HX, yBot, zFB)
  };
  // Rieles frontales, brazos de separación, verticales de pared y frontales
  g.add(rod(P.FTL, P.FTR, r, fm));  // riel superior frontal
  g.add(rod(P.FBL, P.FBR, r, fm));  // riel inferior frontal (de aquí cuelgan las herramientas)
  g.add(rod(P.WTL, P.WTR, r, fm));  // riel superior de pared (tras el rótulo)
  g.add(rod(P.WTL, P.FTL, r, fm));  g.add(rod(P.WTR, P.FTR, r, fm)); // brazos superiores
  g.add(rod(P.WBL, P.FBL, r, fm));  g.add(rod(P.WBR, P.FBR, r, fm)); // brazos inferiores
  g.add(rod(P.WTL, P.WBL, r, fm));  g.add(rod(P.WTR, P.WBR, r, fm)); // verticales de pared
  g.add(rod(P.FTL, P.FBL, r, fm));  g.add(rod(P.FTR, P.FBR, r, fm)); // verticales frontales

  // Placas de anclaje al hastial
  for (const p of [P.WTL, P.WTR, P.WBL, P.WBR]) {
    const brkt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), matBrkt());
    brkt.position.set(p.x, p.y, 0.008); g.add(brkt);
  }

  // Ganchos de punta azul en el riel inferior frontal (abren hacia arriba)
  const NH = 6;
  for (let i = 0; i < NH; i++) {
    const x = -HX + 0.10 + (i / (NH - 1)) * (2 * HX - 0.20);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 14, Math.PI * 1.3), matHook());
    hook.position.set(x, yBot + 0.005, zFB);
    hook.rotation.x = Math.PI / 2;      // el anillo en plano X-Z, abertura hacia arriba/afuera
    hook.rotation.z = Math.PI * 0.1;
    g.add(hook);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), matTip());
    tip.position.set(x, yBot + 0.03, zFB + 0.022); g.add(tip);
  }

  // Rótulo verde "HERRAMIENTAS" arriba, mirando hacia afuera (+Z)
  const rotulo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.155),
    new THREE.MeshStandardMaterial({ map: texturaRotulo(), roughness: 0.7, emissive: 0x0d0d0d, emissiveIntensity: 0.12 })
  );
  rotulo.position.set(0, yTop + 0.02, zFT + 0.015);
  g.add(rotulo);
  // Colgadores del rótulo a los rieles
  for (const sx of [-0.26, 0.26]) g.add(rod(
    new THREE.Vector3(sx, yTop + 0.10, zFT), new THREE.Vector3(sx, yTop - 0.02, zW), 0.006, fm));

  // Herramientas colgadas (barretilla + pala) CENTRADAS en el rack, casi verticales.
  if (conHerramientas) {
    const barra = crearBarraDesatado();
    barra.position.set(-0.10, 0.72, 0.20); barra.rotation.x = 0.10; // arriba afuera, punta al piso
    g.add(barra);

    const pala = crearPala();
    pala.position.set(0.10, 0.86, 0.20); pala.rotation.x = 0.12;
    g.add(pala);
  }

  return g;
}
