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
  // Los tramos LEJANOS estan desenganchados de la escena por rendimiento (ver
  // WorldRuntime._mostrar), asi que `scene.traverse` ya no los alcanza: se recorren aparte.
  // El `vistos` evita atenuar dos veces un material compartido —seria 0.04² y al restaurar
  // quedaria a oscuras, porque la segunda copia habria guardado el valor ya atenuado.
  const vistos = new Set();
  const apagar = (raiz) => raiz.traverse((o) => {
    if (vistos.has(o)) return;
    vistos.add(o);
    if (o.isLight && o.type !== 'AmbientLight') {
      saved.push({ light: o, intensity: o.intensity });
      o.intensity = 0;
    }
    // Atenua tambien los emisivos (LED) para que se "apaguen".
    const mat = o.isMesh ? o.material : null;
    if (mat && !vistos.has(mat) && 'emissiveIntensity' in mat && mat.emissive) {
      vistos.add(mat);
      saved.push({ mat, emissive: mat.emissiveIntensity });
      mat.emissiveIntensity *= 0.04;
    }
  });

  apagar(scene);
  for (const grupo of world?.gruposFueraDeEscena?.() ?? []) apagar(grupo);

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
