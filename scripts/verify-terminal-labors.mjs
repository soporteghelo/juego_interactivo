import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GridLayoutGenerator } from '../src/world/grid/GridLayoutGenerator.js';
import { TerminalLaborSegment } from '../src/world/grid/TerminalLaborSegment.js';
import { Rng } from '../src/procedural/Rng.js';
import { DIM, ROOM_SIZE } from '../src/world/grid/MinePlan.js';

const layout = new GridLayoutGenerator(new Rng(1600)).generate();
const rooms = layout.nodes.filter(node => node.kind === 'room');
assert.ok(rooms.length > 0, 'El plano debe contener labores terminales');

for (const room of rooms) {
  const access = room.edges.find(edge => edge.type === 'access');
  assert.ok(access, `${room.id} debe tener una via de acceso`);
  assert.equal(access.width, DIM.access.width, `${room.id}: ancho distinto al acceso nominal`);
  assert.equal(access.height, DIM.access.height, `${room.id}: alto distinto al acceso nominal`);

  const otherId = access.a === room.id ? access.b : access.a;
  const other = layout.byId.get(otherId);
  const centerDistance = Math.hypot(room.x - other.x, room.z - other.z);
  const joinedDistance = other.size / 2 + access.length + room.size / 2;
  assert.ok(Math.abs(centerDistance - joinedDistance) < 1e-6, `${room.id}: hay hueco o solape en la boca`);
}

// Comprueba tambien la envolvente logica del nuevo segmento sin requerir WebGL/DOM.
const terminal = new TerminalLaborSegment({
  width: DIM.access.width,
  height: DIM.access.height,
  length: ROOM_SIZE,
  openDirs: [{ x: 0, z: 1 }],
  roomType: 'camara',
  label: 'Prueba',
  lighting: null,
  rng: new Rng(1600),
  wireframeStyle: true
});
assert.equal(terminal.type, 'room', 'Debe conservar la interfaz de los sistemas de trabajo');
assert.equal(terminal.terminalLabor, true);
assert.equal(terminal.size, DIM.access.width, 'El mobiliario no debe asumir 12 m de ancho');
assert.equal(terminal.width, DIM.access.width);
assert.equal(terminal.height, DIM.access.height);
assert.equal(terminal.length, ROOM_SIZE);

const child = new THREE.Group();
child.position.set(ROOM_SIZE / 2, 0, 0);
child.rotation.y = Math.PI / 2;
const transformed = terminal._toRootCollider({ hx: 2.1, hy: 2.1, hz: 6, pos: [0, 2.1, -6] }, child);
assert.ok(Math.abs(transformed.pos[0]) < 1e-6 && Math.abs(transformed.pos[2]) < 1e-6,
  'La caja longitudinal debe quedar centrada en el nodo terminal');
assert.equal(transformed.hx, 6, 'Un tramo sobre X debe intercambiar los semiejes X/Z');
assert.equal(transformed.hz, 2.1, 'El ancho fisico debe seguir siendo el del acceso');

console.log(JSON.stringify({
  terminales: rooms.length,
  seccionConstante: `${DIM.access.width} x ${DIM.access.height} m`,
  longitudFondoCiego: `${ROOM_SIZE} m`,
  ensanche: false
}, null, 2));
