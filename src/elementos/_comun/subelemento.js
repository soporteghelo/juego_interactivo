import * as THREE from 'three';

/**
 * SUBELEMENTOS — discretización de elementos complejos.
 *
 * Un elemento "completo" (refugio, camioneta, jumbo, etc.) se compone de varias
 * partes lógicas. Cada parte se agrupa en un THREE.Group etiquetado con
 * `userData.subelemento = { id, nombre, descripcion }` para que el VISUALIZADOR
 * (visor.html) pueda listarlas y aislarlas una a una, y para poder editar las
 * características de cada parte de forma independiente en el código.
 *
 * Convención de uso dentro de `crear()`:
 *
 *   let S = sub(g, 'skid', 'Patín (skid) y ruedas');
 *   S.add(skid); S.add(rueda); ...
 *   S = sub(g, 'casco', 'Casco exterior');
 *   S.add(pared); ...
 *
 * El grupo del subelemento se crea SIN transformación (identidad), por lo que
 * agrupar piezas dentro de él NO altera la geometría final del elemento.
 * Llamar `sub()` con un id ya usado devuelve el grupo existente (permite volver
 * a una sección anterior desde otro punto del código).
 */

/**
 * Crea (o recupera) el grupo de un subelemento dentro de `padre`.
 * @param {THREE.Group} padre   grupo raíz del elemento
 * @param {string} id           id corto y estable del subelemento (kebab/snake case)
 * @param {string} nombre       nombre legible para el visor
 * @param {string} [descripcion]
 * @returns {THREE.Group}
 */
export function sub(padre, id, nombre, descripcion = '') {
  for (const c of padre.children) {
    if (c.userData?.subelemento?.id === id) return c;
  }
  const s = new THREE.Group();
  s.name = `sub_${id}`;
  s.userData.subelemento = { id, nombre, descripcion };
  padre.add(s);
  return s;
}

/**
 * Recolecta los subelementos de PRIMER NIVEL de un objeto: desciende por hijos
 * no etiquetados, pero NO entra dentro de un subelemento ya etiquetado (así un
 * elemento anidado —p. ej. el refugio Dräger dentro del nicho— aparece como UNA
 * sola parte y no expone sus propias sub-partes).
 * @param {THREE.Object3D} root
 * @returns {THREE.Group[]}
 */
export function recolectarSubelementos(root) {
  const subs = [];
  const visitar = (o) => {
    for (const c of o.children) {
      if (c.userData?.subelemento) subs.push(c);
      else visitar(c);
    }
  };
  visitar(root);
  return subs;
}
