import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../world/materials/MineMaterials.js';

/**
 * Tira de LED verde neon que delinea el arco de la galeria (md, "GALERIA CON LED VERDE
 * NEON"). Es el elemento visual mas caracteristico de los accesos principales y refugios.
 *
 * Construye dos arcos emisivos (uno a cada lado, siguiendo el perfil) que con el bloom
 * banan toda la galeria en verde. Si hay presupuesto, agrega un PointLight verde tenue
 * para iluminacion real de la malla/paredes.
 *
 * @returns {THREE.Group}
 */
export function createLedStrip({ width, height, length, lighting, archRatio = 0.4 }) {
  const group = new THREE.Group();
  const halfW = width / 2;
  const wallTop = height * (1 - archRatio);
  const archH = height - wallTop;
  const mat = MineMaterials.ledVerde();

  // Genera la curva del perfil (pared + arco) como una serie de puntos para el tubo.
  const profilePoints = [];
  profilePoints.push(new THREE.Vector3(halfW, 0.4, 0));
  profilePoints.push(new THREE.Vector3(halfW, wallTop, 0));
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = (Math.PI * i) / steps;
    profilePoints.push(new THREE.Vector3(halfW * Math.cos(t), wallTop + archH * Math.sin(t), 0));
  }
  profilePoints.push(new THREE.Vector3(-halfW, wallTop, 0));
  profilePoints.push(new THREE.Vector3(-halfW, 0.4, 0));

  const curve = new THREE.CatmullRomCurve3(profilePoints);

  // Coloca varios arcos a lo largo del tramo (cada ~4m).
  const arcSpacing = 4;
  const count = Math.max(1, Math.round(length / arcSpacing));
  for (let i = 0; i <= count; i++) {
    const z = -(length * i) / count;
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.06, 6, false),
      mat
    );
    tube.position.z = z;
    group.add(tube);

    // Luz real verde solo si hay presupuesto (banar la galeria de verde).
    if (lighting?.canAddLight()) {
      const light = new THREE.PointLight(PALETTE.ledVerde, 32, 18, 2);
      light.position.set(0, wallTop, z);
      group.add(light);
      lighting.noteLight();
    }
  }

  return group;
}
