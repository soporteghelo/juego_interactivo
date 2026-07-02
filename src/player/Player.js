import * as THREE from 'three';
import { CharacterController } from './CharacterController.js';
import { CameraRig } from './CameraRig.js';
import { Headlamp } from './Headlamp.js';
import { crear as crearPersona, animarMarcha } from '../elementos/persona.js';

/**
 * Jugador: integra el controlador de personaje, la camara (1a/3a) y la linterna.
 * Traduce el INPUT UNIFICADO (teclado o tactil) en movimiento y mira. Es agnostico del
 * origen del input.
 *
 * Controles:
 *   Movimiento WASD / joystick · Correr (Shift / boton) · Agacharse (Ctrl-C / boton) ·
 *   Saltar (Space / boton) · Linterna (F / boton) · Cambiar vista (V / boton) ·
 *   Interactuar (E / boton)
 */
export class Player {
  constructor({ scene, camera, physics, input, bus, spawn }) {
    this.scene = scene;
    this.input = input;
    this.bus = bus;

    this.controller = new CharacterController(physics, spawn);
    this.rig = new CameraRig(camera);
    this.headlamp = new Headlamp(camera, scene, bus);

    this.walkSpeed = 3.2;
    this.runSpeed = 5.8;
    this.crouchSpeed = 1.7;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._lastEmit = 0;
    this._phase = 0; // fase de la marcha del avatar

    this._buildMinerMesh();
  }

  get position() {
    return this.controller.position;
  }

  _buildMinerMesh() {
    // Avatar en 3a persona: minero articulado con EPP (persona del catalogo de elementos).
    const g = crearPersona({ rol: 'operador' });
    g.userData.tick = null;  // el Player controla su animacion (marcha)
    g.visible = false;       // arranca en 1a persona
    this.scene.add(g);
    this.mesh = g;
  }

  // --- Simulacion (paso fijo): movimiento y colision ---
  fixedUpdate(dt) {
    if (!this.input.enabled) {
      this.controller.move(this._move.set(0, 0, 0), dt); // solo gravedad
      return;
    }

    this.rig.getForward(this._forward);
    this.rig.getRight(this._right);

    const mv = this.input.move;
    this._move
      .set(0, 0, 0)
      .addScaledVector(this._forward, mv.y)
      .addScaledVector(this._right, mv.x);
    if (this._move.lengthSq() > 1) this._move.normalize();

    let speed = this.input.isDown('crouch')
      ? this.crouchSpeed
      : this.input.isDown('run')
        ? this.runSpeed
        : this.walkSpeed;

    this._move.multiplyScalar(speed * dt);

    if (this.input.consumePressed('jump')) this.controller.jump();

    this.controller.move(this._move, dt);
  }

  // --- Presentacion (paso variable): camara, linterna, avatar ---
  update(dt, elapsed) {
    const look = this.input.consumeLook();
    this.rig.applyLook(look.x, look.y);

    if (this.input.consumePressed('view')) {
      this.rig.toggleMode();
      this.mesh.visible = this.rig.mode === 'third';
    }
    if (this.input.consumePressed('flashlight')) this.headlamp.cycle();

    const pos = this.controller.position;
    const crouching = this.input.isDown('crouch');
    this.rig.update(pos, crouching);
    this.headlamp.update();

    // Avatar (solo visible en 3a persona). Pies a ras de piso (capsula: centro - 1.05).
    this.mesh.position.set(pos.x, pos.y - 1.05, pos.z);
    this.mesh.rotation.y = this.rig.yaw + Math.PI;

    // Marcha del avatar segun la velocidad de movimiento.
    if (this.mesh.visible) {
      const mv = this.input.move;
      const moviendo = this.input.enabled && (Math.abs(mv.x) + Math.abs(mv.y)) > 0.15;
      if (moviendo) {
        this._phase += dt * (this.input.isDown('run') ? 14 : 9);
        animarMarcha(this.mesh, this._phase, 0.6);
      } else {
        animarMarcha(this.mesh, elapsed * 1.5, 0.06); // idle
      }
    }

    // Notifica posicion para streaming/audio (a ~10 Hz).
    if (elapsed - this._lastEmit > 0.1) {
      this._lastEmit = elapsed;
      this.bus.emit('player:moved', { position: pos.clone(), yaw: this.rig.yaw });
    }
  }
}
