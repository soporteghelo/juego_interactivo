import { crearSenal } from './senal.js';

/**
 * CHEVRON DE DIRECCION — md: flecha ">>" negra sobre amarillo, ~30×30cm, en pared o como
 * cono al borde del carril. Reutiliza la factory de senaletica.
 */

export const meta = {
  id: 'chevron',
  nombre: 'Chevron de direccion',
  descripcion: 'Flecha de direccion amarilla/negra para el borde del carril.'
};

/** @returns {THREE.Mesh} */
export function crear() {
  const s = crearSenal('chevron');
  s.scale.set(0.5, 0.5, 1);
  s.name = 'chevron';
  return s;
}
