import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * ESTACIÓN TOTAL sobre TRÍPODE — instrumento de topografía (soporte técnico · monitoreo).
 *
 * La topografía marca el gálibo/dirección al inicio y verifica el avance al final del ciclo
 * (base de conocimiento AESA/Cerro Lindo). Un topógrafo se para tras el instrumento apuntando
 * por el anteojo mientras el portaprisma sostiene el prisma en el frente.
 *
 * Discretización (sub): trípode (3 patas + cabezal), instrumento (base/tribrach, cuerpo,
 * anteojo, pantalla, asa). Amarillo instrumento (estilo Topcon) + aluminio del trípode.
 */

export const meta = {
  id: 'estacion_total',
  nombre: 'Estación total (topografía)',
  descripcion: 'Instrumento topográfico sobre trípode: cuerpo amarillo, anteojo, pantalla y patas de aluminio.'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  g.name = 'estacion_total';

  const mAlu    = MineMaterials.plano(0xb9bcc0, { rough: 0.4, metal: 0.8 });   // patas aluminio
  const mNegro  = MineMaterials.plano(0x1c1c1e, { rough: 0.6, metal: 0.3 });
  const mAmar   = MineMaterials.plano(0xf3c400, { rough: 0.5, metal: 0.3 });   // cuerpo instrumento
  const mLente  = MineMaterials.plano(0x0b1a22, { rough: 0.2, metal: 0.4 });   // óptica
  const mScreen = MineMaterials.plano(0x0a3016, { emissive: 0x2fbf50, emissiveIntensity: 1.6, rough: 0.4 });

  const hubY = 1.30;   // altura del cabezal del trípode

  // ── TRÍPODE: 3 patas + cabezal ────────────────────────────────────
  let S = sub(g, 'tripode', 'Trípode', 'Tres patas de aluminio extensibles y cabezal de montaje.');
  const R = 0.42, top = new THREE.Vector3(0, hubY, 0), up = new THREE.Vector3(0, 1, 0);
  const legGeo = new THREE.CylinderGeometry(0.018, 0.026, 1, 6);
  for (let i = 0; i < 3; i++) {
    const th = (i / 3) * Math.PI * 2;
    const foot = new THREE.Vector3(Math.cos(th) * R, 0, Math.sin(th) * R);
    const dir = new THREE.Vector3().subVectors(top, foot);
    const len = dir.length();
    const leg = new THREE.Mesh(legGeo, mAlu);
    leg.scale.y = len;
    leg.position.copy(foot).addScaledVector(dir, 0.5);
    leg.quaternion.setFromUnitVectors(up, dir.clone().normalize());
    leg.castShadow = true;
    S.add(leg);
    // Zapata (pie) puntiaguda
    const pie = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 6), mNegro);
    pie.position.copy(foot).setY(0.04);
    S.add(pie);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 12), mNegro);
  hub.position.y = hubY; S.add(hub);

  // ── INSTRUMENTO ───────────────────────────────────────────────────
  S = sub(g, 'instrumento', 'Instrumento (estación total)', 'Base nivelante, cuerpo amarillo, anteojo, pantalla y asa.');
  const inst = new THREE.Group();
  inst.position.y = hubY + 0.03;

  // Base nivelante (tribrach)
  const tribrach = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 12), mNegro);
  tribrach.position.y = 0.035; inst.add(tribrach);

  // Cuerpo (alidada) + dos montantes en U que sostienen el anteojo
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.16), mAmar);
  base.position.y = 0.12; base.castShadow = true; inst.add(base);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.13), mAmar);
    post.position.set(sx * 0.085, 0.24, 0); inst.add(post);
  }
  // Anteojo (telescopio) horizontal entre los montantes
  const anteojo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.20, 12), mAmar);
  anteojo.rotation.z = Math.PI / 2;
  anteojo.position.set(0, 0.29, 0); inst.add(anteojo);
  const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 12), mLente);
  lente.rotation.z = Math.PI / 2; lente.position.set(0, 0.29, 0.10 + 0.001);
  // óptica en la cara +Z (objetivo)
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.015, 12), mLente);
  obj.rotation.x = Math.PI / 2; obj.position.set(0, 0.29, 0.105); inst.add(obj);
  const ocular = obj.clone(); ocular.position.z = -0.105; inst.add(ocular);

  // Pantalla/teclado (emisiva) al frente del cuerpo
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.012), mScreen);
  screen.position.set(0, 0.115, 0.086); inst.add(screen);

  // Asa de transporte
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), mNegro);
  asa.position.set(0, 0.37, 0); asa.rotation.x = Math.PI; inst.add(asa);

  S.add(inst);

  return g;
}
