import * as THREE from 'three';

/**
 * Evento: CORTE ELECTRICO (md: "corte electrico", emergencias).
 * Apaga todas las luces dinamicas durante unos segundos (oscuridad casi total: solo queda
 * el headlamp del jugador), luego restaura. Punto de extension: luz de emergencia roja,
 * fallo de equipos, secuencia de reinicio.
 */
export function createPowerOutage({ scene, world }) {
  // Pausa el pool de luces: si no, su reasignacion periodica volveria a encender las luces
  // en mitad del apagon. Se reanuda en stop().
  if (world) world._poolPaused = true;

  const saved = [];
  scene.traverse((o) => {
    if (o.isLight && o.type !== 'AmbientLight') {
      saved.push({ light: o, intensity: o.intensity });
      o.intensity = 0;
    }
    // Atenua tambien los emisivos (LED) para que se "apaguen".
    if (o.isMesh && o.material && 'emissiveIntensity' in o.material && o.material.emissive) {
      saved.push({ mat: o.material, emissive: o.material.emissiveIntensity });
      o.material.emissiveIntensity *= 0.04;
    }
  });

  let life = 0;
  const duration = 6;
  return {
    message: 'CORTE ELECTRICO. Mantenga la calma, use su lampara de casco y dirijase a la via de escape.',
    update(dt) {
      life += dt;
      return life >= duration;
    },
    stop() {
      for (const s of saved) {
        if (s.light) s.light.intensity = s.intensity;
        else if (s.mat) s.mat.emissiveIntensity = s.emissive;
      }
      // Reanuda el pool de luces (vuelve a seguir al jugador).
      if (world) world._poolPaused = false;
    }
  };
}
