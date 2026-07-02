import * as THREE from 'three';

/**
 * Evento: GASES (md: "gases", monitoreo de gases). Simula la presencia de gas peligroso:
 * tinta la niebla de la escena con un tono verdoso/enfermizo y reduce la visibilidad,
 * durante unos segundos. Re-emitido como 'event:gas' (los NPCs evacuan).
 *
 * Extension: integrar con el tablero de monitoreo de gases (valores en tiempo real),
 * detector personal con alarma sonora, zonas de concentracion variable.
 */
export function createGasLeak({ scene }) {
  const fog = scene.fog;
  const original = fog ? { color: fog.color.clone(), near: fog.near, far: fog.far } : null;

  if (fog) {
    fog.color.setHex(0x1a2a12); // verdoso
    fog.far = Math.max(6, fog.far * 0.5); // menos visibilidad
  }

  let life = 0;
  const duration = 10;
  return {
    message: 'ALERTA DE GASES. Concentracion peligrosa detectada. Coloque respirador, no genere chispas y evacue.',
    update(dt) {
      life += dt;
      return life >= duration;
    },
    stop() {
      if (fog && original) {
        fog.color.copy(original.color);
        fog.near = original.near;
        fog.far = original.far;
      }
    }
  };
}
