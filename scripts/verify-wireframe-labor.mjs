import * as THREE from 'three';
import { Rng } from '../src/procedural/Rng.js';
import { GridLayoutGenerator } from '../src/world/grid/GridLayoutGenerator.js';
import { SPAWN_EDGE } from '../src/world/grid/MinePlan.js';
import { createWireframeLaborShell } from '../src/world/segments/TunnelGeometry.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(`[wireframe] ${message}`);
};

const layout = new GridLayoutGenerator(new Rng(20260721)).generate();
const edge = layout.edges.find(candidate => candidate.id === SPAWN_EDGE);
assert(edge, `no existe la arista inicial ${SPAWN_EDGE}`);
assert(edge.wireframeStyle, 'la labor inicial no tiene wireframeStyle');
assert(edge.length >= 35, `la labor es demasiado corta (${edge.length} m)`);

const random = new Rng(707);
const geometry = createWireframeLaborShell({
  width: edge.width,
  height: edge.height,
  length: edge.length,
  segmentsZ: Math.max(6, Math.round(edge.length * 0.6 * 0.75)),
  rng: () => random.next()
});
geometry.computeBoundingBox();

const positions = geometry.attributes.position;
for (let index = 0; index < positions.count; index++) {
  assert(
    [positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite),
    `vértice inválido en ${index}`
  );
}
assert(geometry.index?.count > 0, 'la geometría no contiene triángulos');
assert(geometry.boundingBox.max.x > edge.width / 2, 'no existe sobreexcavación derecha');
assert(geometry.boundingBox.min.x < -edge.width / 2, 'no existe sobreexcavación izquierda');
assert(geometry.boundingBox.max.y > edge.height, 'la corona no presenta sobreexcavación');

const spawnLocal = new THREE.Vector3(0, 1.4, -edge.length * 0.30);
assert(Math.abs(spawnLocal.x) < edge.width / 2, 'spawn fuera del ancho transitable');
assert(spawnLocal.z < 0 && spawnLocal.z > -edge.length, 'spawn fuera del recorrido de la labor');

console.log(JSON.stringify({
  labor: edge.label,
  longitud: edge.length,
  spawnDesdeBoca: Math.abs(spawnLocal.z),
  vertices: positions.count,
  triangulos: geometry.index.count / 3,
  anchoVisual: geometry.boundingBox.max.x - geometry.boundingBox.min.x,
  altoVisual: geometry.boundingBox.max.y
}, null, 2));
