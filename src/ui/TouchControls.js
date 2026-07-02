/**
 * Controles tactiles para celular.
 *
 * Escribe en el MISMO Input unificado que el teclado:
 *  - Joystick virtual (abajo-izquierda): vector de movimiento analogico.
 *  - Superficie de mirada (resto de la pantalla): arrastre para mirar (no hay pointer-lock).
 *  - Botones (abajo-derecha): saltar, agachar, correr, accion (interactuar), luz, vista.
 *
 * Usa Pointer Events con seguimiento de pointerId para soportar multitouch (mover y mirar
 * a la vez). Solo se instancia en dispositivos tactiles (ver Engine + Device).
 */
export class TouchControls {
  constructor({ input, container }) {
    this.input = input;
    this.root = container;

    this.lookSensitivity = 0.004; // rad por pixel
    this._lookPointer = null;
    this._lastLook = { x: 0, y: 0 };
    this._joyPointer = null;

    this._buildLookSurface();
    this._buildJoystick();
    this._buildButtons();
  }

  // --- Superficie de mirada (toda la pantalla, por debajo de joystick/botones) ---
  _buildLookSurface() {
    const surf = document.createElement('div');
    surf.style.cssText =
      'position:fixed;inset:0;z-index:11;touch-action:none;background:transparent;';
    this.root.appendChild(surf);

    surf.addEventListener('pointerdown', (e) => {
      if (this._lookPointer !== null) return;
      this._lookPointer = e.pointerId;
      this._lastLook = { x: e.clientX, y: e.clientY };
      surf.setPointerCapture(e.pointerId);
    });
    surf.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._lookPointer) return;
      const dx = e.clientX - this._lastLook.x;
      const dy = e.clientY - this._lastLook.y;
      this._lastLook = { x: e.clientX, y: e.clientY };
      // Mismo signo que el raton: arrastrar a la derecha mira a la derecha.
      this.input.addLook(-dx * this.lookSensitivity, -dy * this.lookSensitivity);
    });
    const end = (e) => {
      if (e.pointerId === this._lookPointer) this._lookPointer = null;
    };
    surf.addEventListener('pointerup', end);
    surf.addEventListener('pointercancel', end);
  }

  // --- Joystick virtual de movimiento ---
  _buildJoystick() {
    const base = document.createElement('div');
    base.className = 'touch-joystick';
    const stick = document.createElement('div');
    stick.className = 'stick';
    base.appendChild(stick);
    this.root.appendChild(base);

    const radius = 55; // px de recorrido maximo

    const setFromEvent = (e) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      // up (dy negativo) = adelante (move.y positivo)
      this.input.setMove(dx / radius, -dy / radius);
    };

    base.addEventListener('pointerdown', (e) => {
      this._joyPointer = e.pointerId;
      base.setPointerCapture(e.pointerId);
      setFromEvent(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._joyPointer) return;
      setFromEvent(e);
    });
    const end = (e) => {
      if (e.pointerId !== this._joyPointer) return;
      this._joyPointer = null;
      stick.style.transform = 'translate(0,0)';
      this.input.setMove(0, 0);
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  // --- Botones de accion ---
  _buildButtons() {
    const pad = document.createElement('div');
    pad.className = 'touch-buttons';
    this.root.appendChild(pad);

    // Botones de un disparo
    this._makeButton(pad, 'SALTAR', () => this.input.press('jump'));
    this._makeButton(pad, 'ACCION', () => this.input.press('interact'));
    this._makeButton(pad, 'LUZ', () => this.input.press('flashlight'));
    this._makeButton(pad, 'VISTA', () => this.input.press('view'));

    // Toggles sostenidos
    this._makeToggle(pad, 'CORRER', 'run');
    this._makeToggle(pad, 'AGACHAR', 'crouch');
  }

  _makeButton(parent, label, onPress) {
    const b = document.createElement('div');
    b.className = 'touch-btn';
    b.textContent = label;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onPress();
      b.classList.add('active');
    });
    b.addEventListener('pointerup', () => b.classList.remove('active'));
    parent.appendChild(b);
    return b;
  }

  _makeToggle(parent, label, heldName) {
    const b = document.createElement('div');
    b.className = 'touch-btn';
    b.textContent = label;
    let on = false;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      on = !on;
      this.input.setHeld(heldName, on);
      b.classList.toggle('active', on);
    });
    parent.appendChild(b);
    return b;
  }
}
