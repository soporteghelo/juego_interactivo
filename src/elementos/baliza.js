import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * BALIZA / DELINEADOR DE TRAFICO — md: poste cilindrico ~80cm, bandas reflectivas
 * (rojo-blanco arriba, azul, amarillo, verde abajo), base de concreto Ø30cm. Marca el
 * borde del carril.
 */

export const meta = {
  id: 'baliza',
  nombre: 'Baliza / delineador',
  descripcion: 'Poste reflectivo de borde de carril, base de concreto.'
};

// Definicion de las bandas (color + altura), compartida por crear() y la version instanciada.
const BANDAS = [
  { c: 0x2e7d32, h: 0.16 }, // verde
  { c: 0xffdd00, h: 0.16 }, // amarillo
  { c: 0x0d47a1, h: 0.16 }, // azul
  { c: 0xf0f0f0, h: 0.16 }, // blanco
  { c: 0xcc0000, h: 0.16 }  // rojo
];

// ── Instanciado: una sola geometria fusionada con colores por vertice ───────
// Fusiona base + 5 bandas en UN BufferGeometry con el color horneado por vertice,
// para poder dibujar TODAS las balizas del tramo en 1 draw call (InstancedMesh).
let _geoCache = null;
let _matCache = null;

function _pintarGeometria(geo, hex) {
  const col = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Geometria completa de la baliza (base + bandas) con color por vertice. Compartida. */
export function geometriaBaliza() {
  if (_geoCache) return _geoCache;
  const partes = [];

  const base = new THREE.CylinderGeometry(0.15, 0.18, 0.12, 10);
  base.translate(0, 0.06, 0);
  partes.push(_pintarGeometria(base, 0x9a9a92));

  let y = 0.12;
  for (const b of BANDAS) {
    const seg = new THREE.CylinderGeometry(0.05, 0.05, b.h, 8);
    seg.translate(0, y + b.h / 2, 0);
    partes.push(_pintarGeometria(seg, b.c));
    y += b.h;
  }

  _geoCache = mergeGeometries(partes, false);
  return _geoCache;
}

/** Material de baliza (usa colores por vertice, ligero brillo reflectivo). Compartido. */
export function materialBaliza() {
  if (!_matCache) {
    _matCache = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.5,
      metalness: 0.1,
      emissive: 0x222222,
      emissiveIntensity: 0.25
    });
  }
  return _matCache;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.12, 10),
    MineMaterials.plano(0x9a9a92, { rough: 1 })
  );
  base.position.y = 0.06;
  g.add(base);

  let y = 0.12;
  for (const b of BANDAS) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, b.h, 8),
      MineMaterials.plano(b.c, { rough: 0.5, emissive: b.c, emissiveIntensity: 0.3 })
    );
    seg.position.y = y + b.h / 2;
    g.add(seg);
    y += b.h;
  }

  g.name = 'baliza';
  return g;
}
