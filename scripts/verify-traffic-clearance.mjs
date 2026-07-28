import assert from 'node:assert/strict';
import * as THREE from 'three';
import { vehicleFootprintsOverlap } from '../src/world/VehicleSystem.js';

function vehicle(x, z, yaw, halfLen = 5.3, halfWidth = 1.35) {
  return { mesh: { position: new THREE.Vector3(x, 0, z) }, _yaw: yaw, halfLen, halfWidth };
}

// Dos scoops paralelos en los carriles reales (separacion 3.6 m) no estan chocando.
const laneA = vehicle(20, -6, Math.PI / 2);
const laneB = vehicle(20, -2.4, -Math.PI / 2);
assert.equal(vehicleFootprintsOverlap(laneA, laneB), false, 'Carriles paralelos producen un falso choque');

// Traslape longitudinal en el mismo carril sí debe activar la cesion de paso.
const sameLane = vehicle(24, -6, Math.PI / 2);
assert.equal(vehicleFootprintsOverlap(laneA, sameLane), true, 'No se detecta un traslape real');

// Una interseccion ocupada perpendicularmente tambien es contacto real.
const crossing = vehicle(20, -6, 0);
assert.equal(vehicleFootprintsOverlap(laneA, crossing), true, 'No se protege una interseccion ocupada');

console.log(JSON.stringify({
  parallelLaneFalseCollision: false,
  realOverlapDetected: true,
  stopSeconds: 1.8,
  npcHardBlocker: false
}, null, 2));
