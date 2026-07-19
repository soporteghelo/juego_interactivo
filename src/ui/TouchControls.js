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
  constructor({ input, container, bus }) {
    this.input = input;
    this.root = container;
    this.bus = bus;

    this.lookSensitivity = 0.004; // rad por pixel
    this._lookPointer = null;
    this._lastLook = { x: 0, y: 0 };
    this._joyPointer = null;

    this._buildLookSurface();
    this._buildJoystick();
    this._buildButtons();
    this._buildDrivePad();

    // Modo CONDUCCION: cambia la botonera del peaton por la del vehiculo (el joystick
    // se conserva: conduce adelante/atras + direccion).
    this.bus?.on('drive:enter', ({ api } = {}) => this._setDriveMode(true, api));
    this.bus?.on('drive:exit', () => this._setDriveMode(false, false));
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

    const radius = 55;     // px de recorrido maximo
    const deadzone = 0.14; // fraccion del radio ignorada (evita deriva por micro-toques)

    const setFromEvent = (e) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      // El pomo se dibuja donde toca el dedo (respuesta 1:1, sin salto visual).
      stick.style.transform = `translate(${dx}px, ${dy}px)`;

      // Vector analogico con ZONA MUERTA: por debajo del umbral => quieto; por encima se
      // renormaliza 0..1 desde el borde de la zona muerta (control fino cerca del centro).
      let nx = dx / radius, ny = -dy / radius; // up (dy negativo) = adelante
      const mag = Math.hypot(nx, ny);
      if (mag < deadzone) { nx = 0; ny = 0; }
      else {
        const scaled = (mag - deadzone) / (1 - deadzone) / mag;
        nx *= scaled; ny *= scaled;
      }
      this.input.setMove(nx, ny);
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

  // --- Botones de accion (peaton) ---
  _buildButtons() {
    const pad = document.createElement('div');
    pad.className = 'touch-buttons';
    this.root.appendChild(pad);
    this._walkPad = pad;

    // Botones de un disparo
    this._makeButton(pad, 'SALTAR', () => this.input.press('jump'));
    this._makeButton(pad, 'ACCION', () => this.input.press('interact'));
    this._makeButton(pad, 'LUZ', () => this.input.press('flashlight'));
    this._makeButton(pad, 'VISTA', () => this.input.press('view'));

    // Toggles sostenidos
    this._makeToggle(pad, 'CORRER', 'run');
    this._makeToggle(pad, 'AGACHAR', 'crouch');
  }

  // --- Botonera de CONDUCCION (se muestra al subir a un vehiculo) ---
  _buildDrivePad() {
    const pad = document.createElement('div');
    pad.className = 'touch-buttons';
    pad.style.display = 'none';
    this.root.appendChild(pad);
    this._drivePad = pad;

    // Hidraulica (solo equipos con brazo/cuchara): botones SOSTENIDOS.
    this._apiBtns = [
      this._makeHold(pad, 'BRAZO ▲', 'boomUp'),
      this._makeHold(pad, 'BRAZO ▼', 'boomDown'),
      this._makeHold(pad, 'CARGAR', 'bucketIn'),
      this._makeHold(pad, 'VOLCAR', 'bucketOut')
    ];
    this._makeButton(pad, 'BOCINA', () => this.bus?.emit('drive:horn'));
    this._makeButton(pad, 'BAJAR', () => this.input.press('interact'));
  }

  /** Alterna entre botonera de peaton y de conduccion. `api` = el equipo tiene hidraulica. */
  _setDriveMode(driving, api) {
    if (this._walkPad) this._walkPad.style.display = driving ? 'none' : '';
    if (this._drivePad) this._drivePad.style.display = driving ? '' : 'none';
    for (const b of this._apiBtns || []) b.style.display = driving && api ? '' : 'none';
    // Limpia estados sostenidos al cambiar de modo (que no quede hidraulica "pegada").
    for (const h of ['boomUp', 'boomDown', 'bucketIn', 'bucketOut']) this.input.setHeld(h, false);
  }

  /** Boton SOSTENIDO: mantiene un held mientras el dedo esta abajo. */
  _makeHold(parent, label, heldName) {
    const b = document.createElement('div');
    b.className = 'touch-btn';
    b.textContent = label;
    const on = (e) => {
      e.stopPropagation();
      b.setPointerCapture?.(e.pointerId);
      this.input.setHeld(heldName, true);
      b.classList.add('active');
    };
    const off = () => {
      this.input.setHeld(heldName, false);
      b.classList.remove('active');
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    parent.appendChild(b);
    return b;
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
