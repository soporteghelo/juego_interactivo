import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * BARRETILLAS — juego de barras de acero para DESATADO DE ROCA (scaling bars) guardadas en su
 * PORTA-BARRETILLAS sobre el hastial. Según las fotos reales de mina:
 *  - 4 barretillas de distinto largo (6, 8, 10 y 12 pies), la más corta arriba.
 *  - Un porta-barretillas de VARILLA DE ACERO doblada (tono amarillo/tan): rieles verticales,
 *    cunas/ganchos en "U" que abrazan cada barra por el frente, y varillas diagonales en
 *    zig-zag (truss) entre niveles.
 *  - Cada barra amarrada a la cuna con BRIDAS/amarras plásticas AZULES.
 *  - Arriba, un rótulo verde "BARRETILLAS" colgado de dos mosquetones.
 *
 * Convención: el hastial es el plano XY (z≈0); las barras corren en X y se apilan en Y; todo
 * proyecta hacia +Z (fuera de la pared). Se rota como cualquier prop de pared.
 */

export const meta = {
  id: 'barretillas',
  nombre: 'Barretillas (juego + porta-barretillas)',
  descripcion: 'Juego de 4 barretillas de desatado (6, 8, 10 y 12 pies) en su porta-barretillas de varilla doblada, con amarras azules y rótulo verde.'
};

const PIE = 0.3048; // 1 pie en metros

// Largos del juego, en pies. La más corta arriba, la más larga abajo (como en la foto).
export const LARGOS_PIES = [6, 8, 10, 12];

const _matAcero = () => MineMaterials.plano(0x6f6f72, { rough: 0.62, metal: 0.55 }); // acero desgastado
const _matPunta = () => MineMaterials.plano(0x565658, { rough: 0.5, metal: 0.62 });  // punta pulida
const _matRack  = () => MineMaterials.plano(0xcbb96f, { rough: 0.55, metal: 0.45 }); // varilla del porta (amarillo/tan)
const _matTie   = () => MineMaterials.plano(0x1f6fe0, { rough: 0.4, metal: 0.03 });  // brida azul
const _matBrkt  = () => MineMaterials.plano(0x35363a, { rough: 0.7, metal: 0.55 });  // placa de anclaje
const _matMadera = () => MineMaterials.plano(0x8a5a2b, { rough: 0.95, metal: 0.0 }); // marco del rótulo

/** Cilindro (varilla) recto entre dos puntos. */
function rod(p1, p2, r, mat) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

/**
 * Crea UNA barretilla centrada en el origen, tumbada a lo largo de X.
 * @param {number} pies  Largo en pies (6/8/10/12).
 * @param {number} diam  Diámetro del cuerpo (m).
 */
export function crearBarretilla(pies = 8, diam = 0.03) {
  const g = new THREE.Group();
  g.name = `barretilla_${pies}ft`;
  const L = pies * PIE;
  const r = diam / 2;
  const acero = _matAcero();

  // Cuerpo principal (deja hueco para punta y bisel en los extremos).
  const bodyLen = L - 0.18;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyLen, 14), acero);
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  g.add(shaft);

  // Extremo -X: punta cónica (mango de agarre).
  const punta = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, 0.16, 14), _matPunta());
  punta.rotation.z = Math.PI / 2;                 // ápice hacia -X
  punta.position.x = -(bodyLen / 2 + 0.07);
  punta.castShadow = true;
  g.add(punta);

  // Extremo +X: bisel/uña plana forjada (herramienta de palanca).
  const bisel = new THREE.Mesh(new THREE.BoxGeometry(0.16, diam * 1.15, diam * 0.42), _matPunta());
  bisel.position.x = bodyLen / 2 + 0.06;
  bisel.castShadow = true;
  g.add(bisel);
  const codo = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.75, 0.06, 12), acero);
  codo.rotation.z = -Math.PI / 2;
  codo.position.x = bodyLen / 2 - 0.005;
  g.add(codo);

  // Collarines forjados a lo largo del cuerpo (los abultamientos de la foto).
  for (const t of [-0.28, 0.02, 0.34]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.05, 14), _matPunta());
    collar.rotation.z = Math.PI / 2;
    collar.position.x = t * bodyLen;
    collar.castShadow = true;
    g.add(collar);
  }

  g.userData.pies = pies;
  g.userData.largo = L;
  return g;
}

/**
 * Cuna/gancho en "U" (varilla doblada) que abraza una barra por el frente y regresa al hastial.
 * @param {number} x  Posición X del gancho.
 * @param {number} y0 Altura del eje de la barra.
 * @param {number} r  Radio de la barra.
 * @param {number} zF Z del eje de la barra (frente).
 */
function crearCuna(x, y0, r, zF) {
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, y0 + 0.035, 0.0),          // ancla superior en el hastial
    new THREE.Vector3(x, y0 + r + 0.015, zF + 0.004),// pasa sobre la barra
    new THREE.Vector3(x, y0, zF + r + 0.022),        // frente de la "U" (retiene la barra)
    new THREE.Vector3(x, y0 - r - 0.015, zF + 0.004),// pasa bajo la barra
    new THREE.Vector3(x, y0 - 0.035, 0.0)            // ancla inferior en el hastial
  ]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.006, 6, false), _matRack());
  m.castShadow = true;
  return m;
}

/** Brida/amarra azul que ata la barra a la cuna. */
function crearBrida(x, y0, r, zF) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, 0.006, 6, 14), _matTie());
  t.rotation.y = Math.PI / 2;                 // el anillo rodea la barra (eje X)
  t.position.set(x, y0, zF);
  t.castShadow = true;
  return t;
}

// -- Rótulo verde "BARRETILLAS" ----------------------------------------------------
let _texRotulo = null;
function texturaRotulo() {
  if (_texRotulo) return _texRotulo;
  const c = document.createElement('canvas');
  c.width = 640; c.height = 150;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f7a34'; ctx.fillRect(0, 0, c.width, c.height);            // verde señalética
  ctx.strokeStyle = '#0e3d19'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
  ctx.font = 'bold 68px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = '#0b3313';
  ctx.strokeText('BARRETILLAS', c.width / 2, c.height / 2 + 4, c.width - 40);
  ctx.fillStyle = '#f4f4ea';
  ctx.fillText('BARRETILLAS', c.width / 2, c.height / 2 + 4, c.width - 40);   // texto blanco completo
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  _texRotulo = tex;
  return tex;
}

function crearRotulo() {
  const g = new THREE.Group();
  g.name = 'rotulo_barretillas';
  const w = 0.78, h = 0.185;

  // Marco/tabla de fondo.
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.02), _matMadera());
  tabla.castShadow = true;
  g.add(tabla);

  // Placa verde con el texto.
  const placa = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: texturaRotulo(), roughness: 0.7, metalness: 0.0,
      emissive: 0x0d0d0d, emissiveIntensity: 0.12 })
  );
  placa.position.z = 0.012;
  g.add(placa);
  g.userData.signText = 'BARRETILLAS — barras de desatado de roca (6, 8, 10 y 12 pies).';

  // Dos mosquetones de los que cuelga el rótulo.
  for (const sx of [-0.24, 0.24]) {
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 16, Math.PI * 1.5), _matRack());
    anillo.position.set(sx, h / 2 + 0.055, 0.01);
    anillo.rotation.z = Math.PI * 0.15;
    g.add(anillo);
  }
  return g;
}

/**
 * Crea el JUEGO COMPLETO: 4 barretillas en su porta-barretillas sobre el hastial.
 * @param {{diam?:number, spacing?:number}} opts
 */
export function crear({ diam = 0.03, spacing = 0.3 } = {}) {
  const g = new THREE.Group();
  g.name = 'barretillas';
  const r = diam / 2;

  // Alinea los extremos izquierdos (punta) de las barras; las más largas sobresalen a la derecha.
  const xLeft = -1.7;
  const yTop = 0;
  const zFront = 0.075;   // eje de las barras, separado del hastial
  const zRail = 0.028;    // rieles/diagonales, cerca de la pared

  const ys = LARGOS_PIES.map((_, i) => yTop - i * spacing);
  const yBot = ys[ys.length - 1];

  // --- Rieles verticales del porta-barretillas (3 columnas, dentro del tramo de la barra corta) ---
  const railXs = [-1.5, -0.75, 0.0];
  const yTopRail = yTop + 0.12;
  const yBotRail = yBot - 0.08;
  for (const rx of railXs) {
    g.add(rod(new THREE.Vector3(rx, yTopRail, zRail), new THREE.Vector3(rx, yBotRail, zRail), 0.007, _matRack()));
    // Placas de anclaje al hastial (arriba y abajo de cada riel).
    for (const py of [yTopRail, yBotRail]) {
      const brkt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), _matBrkt());
      brkt.position.set(rx, py, 0.008);
      g.add(brkt);
    }
  }

  // --- Varillas diagonales en zig-zag (truss) entre rieles y niveles ---
  for (let k = 0; k < railXs.length - 1; k++) {
    for (let i = 0; i < ys.length - 1; i++) {
      const aX = (i % 2 === 0) ? railXs[k] : railXs[k + 1];
      const bX = (i % 2 === 0) ? railXs[k + 1] : railXs[k];
      g.add(rod(new THREE.Vector3(aX, ys[i], zRail), new THREE.Vector3(bX, ys[i + 1], zRail), 0.005, _matRack()));
    }
  }

  // --- Barras + cunas + bridas ---
  LARGOS_PIES.forEach((pies, i) => {
    const bar = crearBarretilla(pies, diam);
    const y = ys[i];
    const L = pies * PIE;
    const cx = xLeft + L / 2;              // centro para que la punta quede en xLeft
    bar.position.set(cx, y, zFront);
    g.add(bar);

    // Cuna (gancho amarillo) + brida (azul) en cada riel que cruza la barra.
    for (const rx of railXs) {
      if (rx > xLeft + L - 0.05) continue; // solo donde la barra realmente llega
      g.add(crearCuna(rx, y, r, zFront));
      g.add(crearBrida(rx, y, r, zFront));
    }
  });

  // --- Rótulo arriba, colgado sobre las puntas ---
  const rotulo = crearRotulo();
  rotulo.position.set(railXs[1] - 0.35, yTop + spacing * 0.92, zFront + 0.02);
  g.add(rotulo);

  return g;
}
