import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crearSenal } from '../senal/senal.js';
import { sub } from '../_comun/subelemento.js';

/**
 * CHIMENEA DE ESCAPE (RB / raise borer) — SEGUNDA SALIDA fisica de la mina
 * (D.S. 024-2016-EM: toda mina subterranea debe contar con dos vias de salida
 * independientes a superficie/nivel superior).
 *
 * Boca circular en la corona con ESCALERA metalica con guarda de aros (jaula),
 * plataforma de acceso con baranda y señaletica de VIA DE ESCAPE. Interactuable:
 * [E] explica el uso de la segunda salida.
 *
 * Origen en el PISO; la escalera sube pegada al plano +Z (montar contra un hastial).
 * `altura` = altura de la corona donde perfora la boca.
 */

export const meta = {
  id: 'chimenea_escape',
  nombre: 'Chimenea de escape (RB)',
  descripcion: 'Segunda salida: boca de chimenea en la corona con escalera enjaulada, plataforma con baranda y señal de vía de escape. Interactuable.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

/**
 * @param {{altura?:number}} opts altura de la corona (m)
 * @returns {THREE.Group}
 */
export function crear({ altura = 4.6 } = {}) {
  const g = new THREE.Group();
  const mAce  = MineMaterials.plano(0x8a8f96, { rough: 0.5, metal: 0.7 });   // acero galvanizado
  const mAm   = MineMaterials.plano(0xf5c400, { rough: 0.6 });                // baranda amarilla
  const mBoca = MineMaterials.plano(0x0a0908, { rough: 1.0 });                // interior oscuro del RB

  // ── Boca del RB en la corona (cilindro oscuro que "perfora" el techo) ──
  let S = sub(g, 'boca', 'Boca del raise (RB)',
    'Chimenea circular Ø1.5 m perforada con raise borer que conecta al nivel superior; brocal de concreto.');
  put(S, cy(0.75, 0.75, 1.6, 16, mBoca), 0, altura + 0.5, 0.0);
  const brocal = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.10, 8, 18),
    MineMaterials.plano(0x9d9689, { rough: 0.9 }));
  put(S, brocal, 0, altura - 0.20, 0, Math.PI / 2);

  // ── Escalera con jaula (guarda de aros) ──
  S = sub(g, 'escalera', 'Escalera enjaulada',
    'Escalera metalica vertical con guarda de aros cada 0.7 m, desde la plataforma hasta la boca.');
  const hEsc = altura + 0.4;
  for (const sx of [-0.25, 0.25]) put(S, bx(0.05, hEsc, 0.05, mAce), sx, hEsc / 2, 0.35); // largueros
  const nPeld = Math.floor(hEsc / 0.32);
  for (let i = 1; i <= nPeld; i++) put(S, cy(0.018, 0.018, 0.5, 6, mAce), 0, i * 0.32, 0.35, 0, 0, Math.PI / 2);
  for (let y = 1.6; y < hEsc - 0.3; y += 0.7) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 14, Math.PI), mAce);
    aro.position.set(0, y, 0.35);
    aro.rotation.set(Math.PI / 2, 0, 0);
    S.add(aro);
  }

  // ── Plataforma de acceso con baranda ──
  S = sub(g, 'plataforma', 'Plataforma de acceso',
    'Tarima metalica antideslizante con baranda amarilla y rodapie.');
  put(S, bx(1.5, 0.10, 1.2, mAce), 0, 0.30, 0.75);
  for (const sx of [-0.7, 0.7]) put(S, cy(0.03, 0.03, 1.0, 6, mAm), sx, 0.80, 1.30);
  put(S, cy(0.025, 0.025, 1.44, 6, mAm), 0, 1.28, 1.30, 0, 0, Math.PI / 2);   // pasamanos
  put(S, bx(1.5, 0.12, 0.03, mAm), 0, 0.42, 1.33);                             // rodapie

  // ── Señaletica ──
  S = sub(g, 'senal', 'Señalización', 'Señal de VÍA DE ESCAPE apuntando a la chimenea.');
  const s1 = crearSenal('via_escape');
  s1.position.set(0.95, 1.9, 0.15);
  S.add(s1);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'chimenea_escape';
  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Inspeccionar chimenea de escape',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'CHIMENEA DE ESCAPE (RB) — SEGUNDA SALIDA',
        body:
          'Toda mina subterránea debe contar con DOS vías de salida independientes.\n\n' +
          'Esta chimenea (raise Ø1.5 m) conecta con el nivel superior mediante escalera ' +
          'enjaulada con descansos.\n\n' +
          'Úsala SOLO si la vía principal está bloqueada (derrumbe, incendio, humo):\n' +
          '1. Reporta por el teléfono de emergencia antes de subir si es posible.\n' +
          '2. Sube de a UNO, tres puntos de apoyo, autorrescatador colocado.\n' +
          '3. En el nivel superior sigue la señalética de VÍA DE ESCAPE.'
      })
    }
  };
  return g;
}
