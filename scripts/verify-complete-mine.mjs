import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import {
  COMPLETE_MINE_EXPECTED_PLACEMENTS,
  COMPLETE_MINE_PLAN,
  COMPLETE_MINE_SOURCE_ELEMENTS
} from '../src/world/complete/CompleteMinePlan.js';
import {
  carveCompleteMinePortals,
  isCompleteMineFloorLayer,
  isCompleteMineServiceLayer
} from '../src/world/complete/CompleteMineGeometry.js';

const root = process.cwd();
const elementsDir = join(root, 'prueba', 'elementos');
const masterPath = join(elementsDir, '_mina_completa.csv');
const layoutPath = join(elementsDir, '_mina_completa_layout.csv');
const expectedHeader = 'TRIANGLE,XP1,YP1,ZP1,XP2,YP2,ZP2,XP3,YP3,ZP3,COLOUR,LAYERS,LABOR,LINK';

assert.equal(COMPLETE_MINE_PLAN.length, COMPLETE_MINE_EXPECTED_PLACEMENTS, 'Cantidad de emplazamientos incorrecta');
assert.equal(new Set(COMPLETE_MINE_PLAN.map(item => item.id)).size, COMPLETE_MINE_EXPECTED_PLACEMENTS, 'IDs duplicados');
assert.equal(new Set(COMPLETE_MINE_PLAN.map(item => item.file)).size, COMPLETE_MINE_SOURCE_ELEMENTS, 'Faltan CSV fuente');

const lines = readFileSync(masterPath, 'utf8').trim().split(/\r?\n/);
assert.equal(lines.shift(), expectedHeader, 'Encabezado maestro incompatible');
const labors = new Map();
const roadRockPositions = [];
const roadRockColors = [];
const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };

for (let row = 0; row < lines.length; row++) {
  const values = lines[row].split(',');
  assert.equal(values.length, 14, `Fila ${row + 2} incompleta`);
  assert.equal(Number(values[0]), row + 1, `TRIANGLE no secuencial en fila ${row + 2}`);
  const labor = values[12];
  const layer = values[11];
  labors.set(labor, (labors.get(labor) || 0) + 1);
  for (let vertex = 0; vertex < 3; vertex++) {
    const x = Number(values[1 + vertex * 3]);
    const y = Number(values[2 + vertex * 3]);
    const z = Number(values[3 + vertex * 3]);
    assert.ok([x, y, z].every(Number.isFinite), `Coordenada inválida en fila ${row + 2}`);
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
    if (!isCompleteMineServiceLayer(layer) && !isCompleteMineFloorLayer(layer) && !layer.includes('CUNETA')) {
      roadRockPositions.push(x, z, -y);
      roadRockColors.push(1, 1, 1);
    }
  }
}

// La via principal debe quedar libre a altura del cuerpo. Los CSV de cruceros/estocadas
// traen hastiales propios que, sin abrir portales, cortan el eje en varios empalmes.
const portalMap = new Map();
for (const item of COMPLETE_MINE_PLAN) {
  const portal = {
    x: item.position[0], y: item.position[2], z: -item.position[1], radius: 5.25, height: 5.4
  };
  portalMap.set(`${portal.x},${portal.y},${portal.z}`, portal);
}
const openedRoadRock = carveCompleteMinePortals(roadRockPositions, roadRockColors, [...portalMap.values()]);
const roadRay = new THREE.Ray(new THREE.Vector3(-49, 9.1, -3.35), new THREE.Vector3(1, 0, 0));
const ta = new THREE.Vector3(), tb = new THREE.Vector3(), tc = new THREE.Vector3();
const hit = new THREE.Vector3();
const blockers = [];
for (let offset = 0; offset < openedRoadRock.positions.length; offset += 9) {
  ta.fromArray(openedRoadRock.positions, offset);
  tb.fromArray(openedRoadRock.positions, offset + 3);
  tc.fromArray(openedRoadRock.positions, offset + 6);
  const point = roadRay.intersectTriangle(ta, tb, tc, false, hit);
  if (point && point.x >= -49 && point.x <= 506.1) blockers.push(point.x);
}
assert.equal(blockers.length, 0, `La via principal conserva ${blockers.length} paredes internas`);
assert.ok(openedRoadRock.removed > 5_000, 'No se abrieron suficientes empalmes entre labores');

assert.equal(labors.size, COMPLETE_MINE_EXPECTED_PLACEMENTS, 'El CSV maestro no contiene todos los emplazamientos');
for (const item of COMPLETE_MINE_PLAN) {
  assert.ok(labors.has(item.id), `Falta la labor ${item.id}`);
  assert.ok(labors.get(item.id) >= 100, `${item.id} tiene geometría insuficiente`);
}
assert.ok(lines.length > 350_000, 'La mina ampliada perdió demasiados triángulos');
assert.ok(bounds.maxX - bounds.minX > 1_000, 'Extensión este-oeste insuficiente');
assert.ok(bounds.maxY - bounds.minY > 280, 'Extensión norte-sur insuficiente');
assert.ok(bounds.maxZ - bounds.minZ > 225, 'La mina no conecta suficientes cotas');
assert.ok(bounds.maxZ >= 20, 'Falta la bocamina en superficie');
assert.ok(bounds.minZ <= -205, 'Falta la extensión profunda del pique');

const layoutLines = readFileSync(layoutPath, 'utf8').trim().split(/\r?\n/);
assert.equal(layoutLines.length - 1, COMPLETE_MINE_EXPECTED_PLACEMENTS, 'Catálogo de emplazamientos incompleto');

// La mina maestra debe ser el mundo jugable predeterminado, no solo una pagina de visor.
const engineSource = readFileSync(join(root, 'src', 'core', 'Engine.js'), 'utf8');
const settingsSource = readFileSync(join(root, 'src', 'core', 'Settings.js'), 'utf8');
const worldSource = readFileSync(join(root, 'src', 'world', 'complete', 'CompleteMineWorld.js'), 'utf8');
const geometrySource = readFileSync(join(root, 'src', 'world', 'complete', 'CompleteMineGeometry.js'), 'utf8');
const physicsSource = readFileSync(join(root, 'src', 'physics', 'Physics.js'), 'utf8');
const minimapSource = readFileSync(join(root, 'src', 'ui', 'Minimap.js'), 'utf8');
const characterSource = readFileSync(join(root, 'src', 'player', 'CharacterController.js'), 'utf8');
const loopSource = readFileSync(join(root, 'src', 'core', 'Loop.js'), 'utf8');
const boundsGuardSource = readFileSync(join(root, 'src', 'player', 'GridBoundsGuard.js'), 'utf8');
const inputSource = readFileSync(join(root, 'src', 'core', 'Input.js'), 'utf8');
const playerSource = readFileSync(join(root, 'src', 'player', 'Player.js'), 'utf8');
const driveSource = readFileSync(join(root, 'src', 'world', 'DriveController.js'), 'utf8');
assert.match(engineSource, /modoCompleto \? CompleteMineWorld/, 'El juego no selecciona la mina completa');
assert.match(settingsSource, /return 'complete'/, 'La mina completa no es el mapa predeterminado');
assert.match(worldSource, /COMPLETE_MINE_PLAN/, 'El mundo jugable no usa los 54 emplazamientos');
assert.match(worldSource, /_mina_completa\.csv\?url/, 'El juego no carga el mismo CSV maestro de mina-completa.html');
assert.match(worldSource, /carveCompleteMinePortals/, 'El mapa no abre los empalmes entre labores');
assert.match(worldSource, /MineMaterials\.rocaTunel\(\)/, 'La mina completa no usa el material rocoso texturizado');
assert.match(worldSource, /MineMaterials\.barroMojado\(\)/, 'El piso no tiene un material propio');
assert.match(worldSource, /optimizeSurfaceGeometry/, 'Las superficies CSV siguen duplicando vertices');
assert.match(geometrySource, /setAttribute\('uv'/, 'La triangulacion maestra no genera coordenadas UV');
assert.match(geometrySource, /floorVisualPositions/, 'Piso y roca no estan separados visualmente');
assert.match(worldSource, /floorIndex\.addPositions/, 'Falta navegacion sobre los pisos topograficos');
assert.match(worldSource, /addColliderForGeometry/, 'Faltan colisiones de las mallas completas');
assert.match(worldSource, /_decorateSegment/, 'No se restauro la capa operacional del mapa anterior');
assert.match(worldSource, /luminaria_led_mina_completa/, 'Faltan luminarias visibles en la mina completa');
assert.match(worldSource, /cuneta_agua_visible/, 'Faltan cunetas visibles en las labores transitables');
assert.match(worldSource, /nicho_refugio_transitable/, 'Faltan nichos peatonales abiertos y transitables');
assert.match(worldSource, /_nicheFloorPositions/, 'Los nichos no aportan piso al indice transitable');
assert.match(worldSource, /segment\.width \/ 2 - 0\.18/, 'Los nichos no usan el ancho real de la labor');
assert.match(worldSource, /_onSegmentAxis\(segment, sample\)/, 'Los nichos pueden partir desde una cuneta en vez del eje de la labor');
assert.match(worldSource, /if \(this\._nicheAt\(position\)\) return true/, 'Entrar al nicho activa aun el reinicio de ubicacion');
assert.match(worldSource, /this\.minimapCells = this\.floorIndex\.minimapCells/, 'El radar no recibe la huella triangulada real');
assert.match(worldSource, /vehicleFleetLimit = 6/, 'La flota completa no tiene limite antiatasco');
assert.match(worldSource, /const outbound[\s\S]*const inbound/, 'El trafico no tiene carriles separados');
assert.match(physicsSource, /ColliderDesc\.trimesh/, 'Rapier no tiene colision triangular habilitada');
assert.match(physicsSource, /FIX_INTERNAL_EDGES/, 'La colision no corrige las aristas internas del hastial');
assert.match(minimapSource, /Math\.abs\(cell\.y - this\._playerY\)/, 'El radar mezcla labores de distintas cotas');
assert.match(minimapSource, /this\._mapBuckets/, 'El radar recorre toda la mina en cada frame');
assert.doesNotMatch(characterSource, /corrected\.y \+ nudgeY/, 'El jugador aun rebota al rozar el hastial');
assert.match(loopSource, /_maxFixedSteps = 3/, 'La fisica puede entrar otra vez en espiral de pasos');
assert.match(boundsGuardSource, /_invalidTime < 0\.35/, 'Una costura aislada aun puede reiniciar la ubicacion');
assert.match(inputSource, /resetMotion\(\)/, 'La entrada puede quedar trabada a maxima velocidad');
assert.match(playerSource, /this\._velocity\.lerp/, 'El peaton alcanza la maxima velocidad instantaneamente');
assert.match(driveSource, /const ACCEL = 1\.6/, 'Los equipos alcanzan la maxima velocidad demasiado rapido');

console.log(JSON.stringify({
  placements: labors.size,
  sourceElements: COMPLETE_MINE_SOURCE_ELEMENTS,
  triangles: lines.length,
  scale: '1:1 m',
  extent: {
    eastWest: +(bounds.maxX - bounds.minX).toFixed(1),
    northSouth: +(bounds.maxY - bounds.minY).toFixed(1),
    vertical: +(bounds.maxZ - bounds.minZ).toFixed(1)
  },
  elevations: { min: bounds.minZ, max: bounds.maxZ },
  playableDefault: true,
  status: 'MINA COMPLETA OK'
}, null, 2));
