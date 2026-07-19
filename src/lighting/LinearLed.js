import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';

/**
 * LED blanco lineal en el centro del techo (md: "Luz blanca LED lineal en el centro del
 * techo", sombras duras laterales). Barra emisiva blanca a lo largo del tramo + algunas
 * luces reales hacia abajo si hay presupuesto.
 *
 * @returns {THREE.Group}
 */
export function createLinearLed({ height, length, lighting, archRatio = 0.4, lampSpacing = 6 }) {
  const group = new THREE.Group();
  const y = height - 0.1; // justo bajo la clave del arco

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.06, length * 0.96),
    MineMaterials.ledBlanco()
  );
  bar.position.set(0, y, -length / 2);
  group.add(bar);

  // Luces reales blancas frias repartidas (sombras duras, luz dirigida hacia abajo).
  // `lampSpacing` mayor = menos luces (el modo retICula lo sube para aligerar).
  const count = Math.max(1, Math.round(length / lampSpacing));
  for (let i = 0; i < count; i++) {
    if (!lighting?.canAddLight()) break;
    const z = -((i + 0.5) * length) / count;
    const light = new THREE.PointLight(0xf5f8ff, 32, 22, 2);
    light.position.set(0, y - 0.1, z);
    // Solo unas pocas LEDs proyectan sombra (caras): el resto solo ilumina.
    if (lighting.settings.current.shadows && lighting.canAddShadow()) {
      light.castShadow = true;
      light.shadow.mapSize.set(
        lighting.settings.current.shadowMapSize,
        lighting.settings.current.shadowMapSize
      );
      lighting.noteShadow();
    }
    group.add(light);
    lighting.noteLight();
  }

  return group;
}
