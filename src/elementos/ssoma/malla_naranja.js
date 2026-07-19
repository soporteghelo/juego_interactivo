import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * MALLA PLÁSTICA NARANJA — la barrera de obra que DELIMITA los frentes y labores activas
 * (base de conocimiento AESA/Cerro Lindo §4: "mallas plásticas naranjas delimitando frentes";
 * `mineria-draw.md` la lista en el checklist de señalética).
 *
 * Paño de rejilla romboidal naranja fluor tensado entre postes. El paño usa **alphaTest** (NO
 * blending): así no ensucia el orden de transparencias ni alimenta el bloom — solo recorta.
 *
 * Convención de ejes LOCAL: el paño se extiende a lo largo de X y el alto en Y; +Z es la cara
 * hacia quien se aproxima.
 *
 * Discretización (sub): pano (rejilla), postes (parantes + bases).
 */

export const meta = {
  id: 'malla_naranja',
  nombre: 'Malla plástica naranja (delimitación)',
  descripcion: 'Barrera de rejilla naranja fluor entre postes que delimita un frente o labor activa.'
};

// Textura y material CACHEADOS: una sola rejilla para toda la mina.
let _tex = null, _mat = null;
function _mallaMat(repX) {
  if (!_tex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = '#ff6a00';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    // Rejilla ROMBOIDAL (dos familias de diagonales), con wrap para repetir sin costura.
    for (let i = -64; i <= 128; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0);      ctx.lineTo(i + 64, 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 64);     ctx.lineTo(i + 64, 0);  ctx.stroke();
    }
    _tex = new THREE.CanvasTexture(c);
    _tex.wrapS = _tex.wrapT = THREE.RepeatWrapping;
    _tex.colorSpace = THREE.SRGBColorSpace;
  }
  if (!_mat) {
    _mat = new THREE.MeshStandardMaterial({
      map: _tex,
      transparent: true,
      alphaTest: 0.5,          // recorta (no mezcla) → sin problemas de orden ni de bloom
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.0
    });
  }
  // La repetición se ajusta por instancia clonando SOLO la textura (material compartido).
  if (repX && Math.abs(_tex.repeat.x - repX) > 0.01) _tex.repeat.set(repX, 2);
  return _mat;
}

/**
 * @param {{ancho?:number, alto?:number}} opts  ancho del vano a cerrar (m) y alto del paño (m)
 * @returns {THREE.Group}
 */
export function crear({ ancho = 4.0, alto = 1.15 } = {}) {
  const g = new THREE.Group();
  g.name = 'malla_naranja';

  const mPoste = MineMaterials.plano(0x2f3338, { rough: 0.6, metal: 0.55 });
  const mBase  = MineMaterials.plano(0x1a1a1c, { rough: 0.9, metal: 0.2 });

  // ── PAÑO de rejilla ───────────────────────────────────────────────
  let S = sub(g, 'pano', 'Paño de rejilla', 'Rejilla romboidal naranja fluor tensada entre los postes (alphaTest, sin blending).');
  const pano = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), _mallaMat(Math.max(2, ancho / 0.5)));
  pano.position.set(0, alto / 2 + 0.12, 0);
  S.add(pano);

  // ── POSTES (parantes + base) ──────────────────────────────────────
  S = sub(g, 'postes', 'Postes y bases', 'Parantes metálicos con base plana que tensan el paño.');
  const n = Math.max(2, Math.round(ancho / 2) + 1);
  for (let i = 0; i < n; i++) {
    const x = -ancho / 2 + (ancho * i) / (n - 1);
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, alto + 0.18, 6), mPoste);
    poste.position.set(x, (alto + 0.18) / 2, 0);
    S.add(poste);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 8), mBase);
    base.position.set(x, 0.025, 0);
    S.add(base);
  }

  return g;
}
