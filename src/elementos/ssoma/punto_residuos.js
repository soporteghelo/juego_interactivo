import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { crearSenal } from '../senal/senal.js';
import { sub } from '../_comun/subelemento.js';

/**
 * PUNTO DE ACOPIO DE RESIDUOS — segregacion por CODIGO DE COLORES (NTP 900.058):
 * cilindros metalicos de 55 gal pintados, sobre parihuela, con letrero verde.
 *   AMARILLO = metales/chatarra · ROJO = peligrosos (trapos con hidrocarburo) ·
 *   NEGRO = generales.
 * Tipico de toda labor/taller de mina peruana. Interactuable: [E] repasa la segregacion.
 *
 * Origen en el PISO contra la pared; frente = +Z.
 */

export const meta = {
  id: 'punto_residuos',
  nombre: 'Punto de acopio de residuos',
  descripcion: 'Tres cilindros de 55 gal por código de colores (amarillo metales, rojo peligrosos, negro generales) sobre parihuela + letrero. Interactuable.'
};

const CILINDROS = [
  { color: 0xf5c400, label: 'METALES' },
  { color: 0xc41414, label: 'PELIGROSOS' },
  { color: 0x1f2226, label: 'GENERALES' }
];

function _texEtiqueta(texto) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 40;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, 128, 40);
  ctx.fillStyle = '#111'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(texto, 64, 27);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mMadera = MineMaterials.plano(0x6e5233, { rough: 0.95 });

  // Parihuela de madera
  let S = sub(g, 'parihuela', 'Parihuela', 'Base de madera que separa los cilindros del barro.');
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.85), mMadera);
  tabla.position.set(0, 0.10, 0);
  S.add(tabla);

  // Cilindros de 55 galones por color
  S = sub(g, 'cilindros', 'Cilindros por código de colores',
    'Cilindros metálicos de 55 gal: amarillo (metales), rojo (peligrosos), negro (generales), con tapa y etiqueta.');
  CILINDROS.forEach((c, i) => {
    const x = (i - 1) * 0.68;
    const mat = MineMaterials.plano(c.color, { rough: 0.6, metal: 0.35 });
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.86, 14), mat);
    cuerpo.position.set(x, 0.60, 0);
    S.add(cuerpo);
    // Anillos de refuerzo + tapa
    for (const y of [0.38, 0.60, 0.82]) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.012, 5, 14), mat);
      aro.position.set(x, y, 0); aro.rotation.x = Math.PI / 2;
      S.add(aro);
    }
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14),
      MineMaterials.plano(0x3a3d42, { rough: 0.5, metal: 0.5 }));
    tapa.position.set(x, 1.05, 0);
    S.add(tapa);
    // Etiqueta frontal
    const et = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13),
      new THREE.MeshStandardMaterial({ map: _texEtiqueta(c.label), roughness: 0.6 }));
    et.position.set(x, 0.66, 0.295);
    S.add(et);
  });

  // Letrero del punto de acopio
  S = sub(g, 'letrero', 'Letrero de acopio', 'Letrero verde de PUNTO DE ACOPIO con recordatorio de segregación.');
  const senal = crearSenal('residuos');
  senal.position.set(0, 1.85, 0.05);
  S.add(senal);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'punto_residuos';
  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Revisar punto de acopio',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'PUNTO DE ACOPIO — SEGREGACIÓN DE RESIDUOS',
        body:
          'Código de colores (NTP 900.058):\n\n' +
          'AMARILLO — Metales: chatarra, pernos, alambre, restos de malla.\n' +
          'ROJO — Peligrosos: trapos y suelos con hidrocarburo, filtros, aerosoles.\n' +
          'NEGRO — Generales: residuos no aprovechables.\n\n' +
          'Un residuo mal segregado contamina TODO el cilindro.\n' +
          'Los residuos peligrosos se manifiestan y disponen con EO-RS autorizada.'
      })
    }
  };
  return g;
}
