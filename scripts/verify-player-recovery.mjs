import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GridBoundsGuard } from '../src/player/GridBoundsGuard.js';
import { CharacterController } from '../src/player/CharacterController.js';
import { Player } from '../src/player/Player.js';

function makePlayer() {
  const position = new THREE.Vector3(0, 1.4, 0);
  const calls = [];
  return {
    calls,
    controller: {
      grounded: true,
      get position() { return position; },
      teleport(target) { calls.push(target.clone()); position.copy(target); }
    },
    teleport(target) { calls.push(target.clone()); position.copy(target); }
  };
}

// Una costura de piso sostenida ya no debe reiniciar la ubicacion.
{
  const player = makePlayer();
  const world = { boundsCheck: () => false, recoveryReason: () => null };
  const guard = new GridBoundsGuard({ player, world });
  for (let i = 0; i < 120; i++) guard.fixedUpdate(1 / 60);
  assert.equal(player.calls.length, 0, 'Una costura todavia teletransporta al jugador');
}

// Una caida real conserva la red de seguridad.
{
  const player = makePlayer();
  const world = { boundsCheck: () => false, recoveryReason: () => 'caida_bajo_mina' };
  const guard = new GridBoundsGuard({ player, world });
  for (let i = 0; i < 30; i++) guard.fixedUpdate(1 / 60);
  assert.equal(player.calls.length, 1, 'Una caida real no recupera al jugador exactamente una vez');
}

// Teleport cinematico: limpia estado y sincroniza destino inmediato/siguiente.
{
  const calls = [];
  const controller = Object.create(CharacterController.prototype);
  controller.body = {
    setTranslation: (p) => calls.push(['now', { ...p }]),
    setNextKinematicTranslation: (p) => calls.push(['next', { ...p }])
  };
  controller.verticalVelocity = -12;
  controller.grounded = true;
  controller.teleport(new THREE.Vector3(4, 5, 6));
  assert.deepEqual(calls, [
    ['now', { x: 4, y: 5, z: 6 }],
    ['next', { x: 4, y: 5, z: 6 }]
  ]);
  assert.equal(controller.verticalVelocity, 0);
  assert.equal(controller.grounded, false);
}

// La capa Player tampoco conserva velocidad horizontal tras una recuperacion.
{
  const player = Object.create(Player.prototype);
  player._velocity = new THREE.Vector3(3, 0, 2);
  player._move = new THREE.Vector3(1, 0, 1);
  player._avatarLast = { x: 1, z: 1 };
  let teleported = null;
  player.controller = { teleport: p => { teleported = p.clone(); } };
  player.teleport(new THREE.Vector3(7, 8, 9));
  assert.equal(player._velocity.lengthSq(), 0);
  assert.equal(player._move.lengthSq(), 0);
  assert.deepEqual(teleported.toArray(), [7, 8, 9]);
  assert.equal(player._avatarLast, null);
}

console.log(JSON.stringify({
  transientFloorGapTeleports: 0,
  catastrophicRecovery: true,
  kinematicTargetSynchronized: true,
  horizontalVelocityReset: true
}, null, 2));
