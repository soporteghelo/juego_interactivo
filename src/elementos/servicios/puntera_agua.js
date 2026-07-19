import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * PUNTERA DE AGUA (acople de extremo) + CABLE ANTILATIGAZO — según fotos reales de mina:
 * en el extremo de una tubería/manguera de agua se instala un ACOPLE (tipo camlock/Bauer) con
 * palancas AZULES y una boquilla metálica. Cruzando la unión va un CABLE ANTILATIGAZO
 * (whip-check): dos lazos de cable de acero —uno en la manguera, otro en el tubo— unidos por
 * tramos que atraviesan el acople, de modo que si el acople falla la manguera NO latiguea.
 *
 * Se construye a lo largo de su eje local +Z: la manguera entra por -Z y la boquilla apunta a +Z.
 * `manguera.js` orienta cada puntera según la tangente del tendido en su extremo.
 *
 * @param {{diam?:number}} opts  diam = diámetro de la manguera (m).
 */

export const meta = {
  id: 'puntera_agua',
  nombre: 'Puntera de agua + cable antilatigazo',
  descripcion: 'Acople de extremo de tubería de agua (camlock con palancas azules) y cable antilatigazo (whip-check) cruzando la unión.'
};

const _matAcople = () => MineMaterials.plano(0x8d8d90, { rough: 0.5, metal: 0.6 });   // cuerpo del acople (acero)
const _matPalanca = () => MineMaterials.plano(0x2f6fc0, { rough: 0.45, metal: 0.15 }); // palancas azules
const _matBoquilla = () => MineMaterials.plano(0x6f6f72, { rough: 0.5, metal: 0.62 }); // boquilla/ferrula
const _matCable = () => MineMaterials.plano(0x9a968c, { rough: 0.55, metal: 0.55 });   // cable de acero galvanizado

/** Cilindro a lo largo del eje Z (la geometría de Three nace en Y). */
function cylZ(rTop, rBot, len, mat, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 16), mat);
  m.rotation.x = Math.PI / 2; // +Y local → +Z
  m.position.z = z;
  m.castShadow = true;
  return m;
}

/** Varilla/cable recto entre dos puntos. */
function rod(p1, p2, r, mat) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

export function crear({ diam = 0.08 } = {}) {
  const g = new THREE.Group();
  g.name = 'puntera_agua';
  const R = diam / 2;

  // Abrazadera sobre la manguera (lado -Z).
  g.add(cylZ(R * 1.18, R * 1.18, 0.05, _matAcople(), -0.05));

  // Cuerpo principal del acople.
  g.add(cylZ(R * 1.5, R * 1.5, 0.10, _matAcople(), 0.0));

  // Tuerca/anillo del acople.
  const nut = new THREE.Mesh(new THREE.TorusGeometry(R * 1.5, R * 0.16, 8, 18), _matAcople());
  nut.position.z = 0.05;
  g.add(nut);

  // Boquilla / ferrula que se estrecha hacia el extremo (+Z).
  g.add(cylZ(R * 0.95, R * 1.15, 0.09, _matBoquilla(), 0.10));
  const punta = new THREE.Mesh(new THREE.TorusGeometry(R * 0.95, R * 0.12, 8, 16), _matBoquilla());
  punta.position.z = 0.145;
  g.add(punta);

  // Palancas azules del camlock (a ±X, ligeramente inclinadas hacia atrás).
  for (const sx of [-1, 1]) {
    const palanca = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.055, 0.075), _matPalanca());
    palanca.position.set(sx * R * 1.6, 0, -0.005);
    palanca.rotation.y = sx * 0.15;
    palanca.castShadow = true;
    g.add(palanca);
  }

  // --- Cable antilatigazo (whip-check): 2 lazos + tramos que cruzan el acople ---
  const cableMat = _matCable();
  const rLoop = R * 1.4, rCab = 0.006;
  const zHose = -0.055, zPipe = 0.11;

  const loopA = new THREE.Mesh(new THREE.TorusGeometry(rLoop, rCab, 6, 18), cableMat);
  loopA.position.z = zHose;               // lazo en la manguera
  loopA.castShadow = true;
  g.add(loopA);

  const loopB = new THREE.Mesh(new THREE.TorusGeometry(R * 1.25, rCab, 6, 18), cableMat);
  loopB.position.z = zPipe;               // lazo en el tubo/boquilla
  loopB.castShadow = true;
  g.add(loopB);

  // Tramos de cable que cruzan la unión (arriba y abajo), abrazando el acople.
  for (const ang of [Math.PI / 2, -Math.PI / 2]) {
    const a = new THREE.Vector3(Math.cos(ang) * rLoop, Math.sin(ang) * rLoop, zHose);
    const b = new THREE.Vector3(Math.cos(ang) * R * 1.25, Math.sin(ang) * R * 1.25, zPipe);
    const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
    mid.addScaledVector(new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0), R * 0.25); // leve arco hacia afuera
    const curva = new THREE.CatmullRomCurve3([a, mid, b]);
    const tramo = new THREE.Mesh(new THREE.TubeGeometry(curva, 12, rCab, 6, false), cableMat);
    tramo.castShadow = true;
    g.add(tramo);
  }

  return g;
}
