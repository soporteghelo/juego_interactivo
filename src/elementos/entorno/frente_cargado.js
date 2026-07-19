import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crearSenal } from '../senal/senal.js';
import { sub } from '../_comun/subelemento.js';

/**
 * FRENTE CARGADO — la cara de un frente de desarrollo YA PERFORADA y CARGADA con explosivos,
 * lista para volar (fase «carguío de explosivos» del ciclo de avance).
 *
 * Muestra la malla de perforación (burn cut central + auxiliares + contorno) con los taladros
 * TACADOS y el CORDÓN DETONANTE saliendo de cada boca hasta una línea troncal que sale hacia la
 * cuadrilla. Lleva la tarjeta «VOLADURA — PROHIBIDO PASAR». Se monta sobre la caja del frente;
 * el bloqueo de acceso (cordón + hazard) lo pone la sala.
 *
 * Convención de ejes LOCAL: +Z = hacia la labor (las bocas y el cordón miran a la cuadrilla);
 * -Z = hacia el interior de la roca (los taladros entran por ahí). Y = alto, X = ancho.
 *
 * Discretización (sub): barrenos (bocas + tacos), cordon (cordón detonante + troncal),
 * senaletica (tarjeta de voladura).
 */

export const meta = {
  id: 'frente_cargado',
  nombre: 'Frente cargado (voladura)',
  descripcion: 'Cara del frente perforada y cargada: malla de taladros tacados + cordón detonante + tarjeta VOLADURA.'
};

/** Cordón/segmento fino entre dos puntos locales. */
function _cord(a, b, mat, r = 0.012) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 0.001;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  g.name = 'frente_cargado';

  const mCollar = MineMaterials.plano(0x080808, { rough: 1 });                                   // boca del taladro
  const mStem   = MineMaterials.plano(0xa9906a, { rough: 0.95 });                                 // taco (arcilla/detritus)
  const mCord   = MineMaterials.plano(0xf2c22a, { emissive: 0xc79600, emissiveIntensity: 0.45, rough: 0.5 }); // cordón detonante
  const mConn   = MineMaterials.plano(0xcc2200, { rough: 0.5, metal: 0.2 });                      // conectores de retardo

  // ── Patrón de perforación (burn cut + auxiliares + contorno) ──────
  const holes = [];
  const add = (x, y) => holes.push(new THREE.Vector2(x, y));
  // Burn cut central (arranque)
  add(0, 1.32); add(0.20, 1.32); add(-0.20, 1.32); add(0, 1.52); add(0, 1.12);
  // Auxiliares (anillo)
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(Math.cos(a) * 0.6, 1.32 + Math.sin(a) * 0.55); }
  // Contorno (perímetro de la caja ~2.2 x 2.1)
  const px = 1.05, pyb = 0.42, pyt = 2.35;
  for (const x of [-px, -0.42, 0.42, px]) { add(x, pyb); add(x, pyt); }
  for (const y of [0.95, 1.72]) { add(-px, y); add(px, y); }

  // ── Barrenos: boca oscura + taco ─────────────────────────────────
  let S = sub(g, 'barrenos', 'Barrenos cargados (bocas + tacos)', 'Malla de perforación con taladros tacados listos para volar.');
  const holeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8); holeGeo.rotateX(Math.PI / 2); // eje → Z (entra a la roca)
  const stemGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.06, 8); stemGeo.rotateX(Math.PI / 2);
  for (const h of holes) {
    const boca = new THREE.Mesh(holeGeo, mCollar); boca.position.set(h.x, h.y, -0.24); S.add(boca);
    const taco = new THREE.Mesh(stemGeo, mStem); taco.position.set(h.x, h.y, 0.0); S.add(taco);
  }

  // ── Cordón detonante: de cada boca baja a una TRONCAL y sale a la cuadrilla ──
  S = sub(g, 'cordon', 'Cordón detonante y troncal', 'Cordón detonante desde cada taladro a la línea troncal + conectores de retardo.');
  const trunkY = 0.34, trunkZ = 0.06;
  for (const h of holes) {
    S.add(_cord(new THREE.Vector3(h.x, h.y, 0.03), new THREE.Vector3(h.x, trunkY, trunkZ), mCord));
    const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), mConn);
    conn.position.set(h.x, h.y, 0.05); S.add(conn);
  }
  // Troncal horizontal a lo largo de la base
  S.add(_cord(new THREE.Vector3(-px - 0.1, trunkY, trunkZ), new THREE.Vector3(px + 0.1, trunkY, trunkZ), mCord, 0.016));
  // Lead-out hacia la cuadrilla (+Z), serpenteando por el piso
  S.add(_cord(new THREE.Vector3(0, trunkY, trunkZ), new THREE.Vector3(0.4, 0.06, 1.2), mCord, 0.016));
  S.add(_cord(new THREE.Vector3(0.4, 0.06, 1.2), new THREE.Vector3(-0.3, 0.05, 2.2), mCord, 0.016));

  // ── Tarjeta VOLADURA colgada del frente ──────────────────────────
  S = sub(g, 'senaletica', 'Tarjeta de voladura', 'Tarjeta roja «VOLADURA — PROHIBIDO PASAR».');
  const card = crearSenal('voladura');
  card.scale.setScalar(0.55);
  card.position.set(0.75, 2.5, 0.1);
  S.add(card);

  return g;
}
