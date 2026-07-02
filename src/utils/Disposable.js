/**
 * Helpers de limpieza de memoria GPU.
 *
 * Three.js no libera geometrias/texturas/materiales automaticamente. Al descargar
 * segmentos lejanos (streaming procedural) hay que liberarlos a mano o se acumula
 * memoria de video. `disposeObject` recorre un objeto y libera todo lo que cuelga.
 */

function disposeMaterial(material) {
  if (!material) return;
  // Libera todas las texturas referenciadas por el material.
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && typeof value === 'object' && typeof value.dispose === 'function' && value.isTexture) {
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * Libera geometrias, materiales y texturas de un objeto y toda su jerarquia,
 * y lo desconecta de su padre.
 * @param {THREE.Object3D} object
 */
export function disposeObject(object) {
  if (!object) return;

  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
    } else if (child.material) {
      disposeMaterial(child.material);
    }
  });

  if (object.parent) object.parent.remove(object);
}
