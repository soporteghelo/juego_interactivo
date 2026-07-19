/**
 * Capa de entrada UNIFICADA (escritorio + tactil).
 *
 * Tanto el teclado/raton como los controles tactiles (ui/TouchControls.js) escriben en
 * el MISMO estado de intencion. Asi el jugador (CharacterController/CameraRig) no sabe
 * ni le importa el origen del input.
 *
 * Estado expuesto:
 *  - move {x, y}: vector analogico de movimiento (-1..1). y>0 = adelante (W / joystick arriba).
 *  - held: teclas/botones sostenidos (run, crouch).
 *  - look: delta de camara acumulado; se consume con consumeLook().
 *  - pressed: acciones de un disparo (jump, interact, flashlight, view); consumir con consumePressed().
 *
 * En escritorio la mirada usa pointer-lock (movementX/Y). En celular no hay pointer-lock:
 * la mirada llega por arrastre desde TouchControls -> addLook().
 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;

    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    // run/crouch: marcha del peaton. boomUp/boomDown/bucketIn/bucketOut: hidraulica del
    // equipo conducido (los botones tactiles de DriveController/TouchControls los sostienen).
    this._held = {
      run: false, crouch: false,
      boomUp: false, boomDown: false, bucketIn: false, bucketOut: false
    };
    this._pressed = { jump: false, interact: false, flashlight: false, view: false };

    this.lookSensitivity = 0.0022; // raton (rad por pixel)
    this.pointerLocked = false;
    this.enabled = false;          // se activa tras pulsar "INGRESAR"
    this.controlScheme = 'desktop'; // lo fija el Engine segun Device ('desktop'|'touch')

    this._keys = new Set();
    this._bindKeyboard();
    this._bindMouse();
  }

  // ---- API publica (la leen el jugador / consumen TouchControls) ----

  /** Acumula delta de mirada (usado por raton y por arrastre tactil). */
  addLook(dx, dy) {
    if (!this.enabled) return;
    this.look.x += dx;
    this.look.y += dy;
  }

  /** Devuelve y resetea el delta de mirada acumulado este frame. */
  consumeLook() {
    const out = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return out;
  }

  /** Fija el vector de movimiento (usado por el joystick tactil). */
  setMove(x, y) {
    this.move.x = x;
    this.move.y = y;
  }

  /** Fija un estado sostenido (run/crouch) desde botones tactiles. */
  setHeld(name, value) {
    if (name in this._held) this._held[name] = value;
  }

  /** Marca una accion de un disparo (jump/interact/flashlight/view). */
  press(name) {
    if (name in this._pressed) this._pressed[name] = true;
  }

  isDown(name) {
    return Boolean(this._held[name]);
  }

  /** Devuelve true UNA vez por pulsacion y limpia el flag. */
  consumePressed(name) {
    if (this._pressed[name]) {
      this._pressed[name] = false;
      return true;
    }
    return false;
  }

  // ---- Teclado ----

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this._keys.has(e.code)) return; // ignora autorepeat para edge-triggers
      this._keys.add(e.code);
      this._applyKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
      this._applyKey(e.code, false);
    });
  }

  _applyKey(code, down) {
    switch (code) {
      case 'KeyW': case 'ArrowUp': this.move.y = down ? 1 : (this._keys.has('KeyS') ? -1 : 0); break;
      case 'KeyS': case 'ArrowDown': this.move.y = down ? -1 : (this._keys.has('KeyW') ? 1 : 0); break;
      case 'KeyA': case 'ArrowLeft': this.move.x = down ? -1 : (this._keys.has('KeyD') ? 1 : 0); break;
      case 'KeyD': case 'ArrowRight': this.move.x = down ? 1 : (this._keys.has('KeyA') ? -1 : 0); break;
      case 'ShiftLeft': case 'ShiftRight': this._held.run = down; break;
      case 'ControlLeft': case 'KeyC': this._held.crouch = down; break;
      case 'Space': if (down) this.press('jump'); break;
      case 'KeyE': if (down) this.press('interact'); break;
      case 'KeyF': if (down) this.press('flashlight'); break;
      case 'KeyV': if (down) this.press('view'); break;
    }
  }

  // ---- Raton + pointer lock ----

  _bindMouse() {
    this.dom.addEventListener('click', () => {
      // En escritorio, click bloquea el puntero para mirar con el raton.
      if (this.enabled && this.controlScheme !== 'touch' && !this.pointerLocked) {
        this.dom.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.addLook(-e.movementX * this.lookSensitivity, -e.movementY * this.lookSensitivity);
    });

    // Clic derecho (anticlick) en escritorio: cicla la linterna hacia arriba.
    this.dom.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.enabled && this.controlScheme !== 'touch') this.press('flashlight');
    });
  }
}
