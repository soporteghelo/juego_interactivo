/**
 * Bucle principal con paso fijo para la fisica y paso variable para el render.
 *
 * La fisica (Rapier) necesita un dt estable para ser deterministica; el render usa el
 * tiempo real. Acumulamos el tiempo y damos pasos fijos de fisica, luego renderizamos.
 *
 * Los "sistemas" registrados pueden exponer:
 *   - fixedUpdate(fixedDt)  -> logica de simulacion (fisica, movimiento)
 *   - update(dt, elapsed)   -> logica visual (camara, particulas, animaciones)
 */
export class Loop {
  constructor(renderFn) {
    this._renderFn = renderFn;
    this._systems = [];
    this._running = false;

    this._fixedDt = 1 / 60;       // 60 Hz de simulacion
    this._accumulator = 0;
    this._maxAccum = 0.2;         // evita "espiral de la muerte" si la pestana se congela
    this._last = 0;
    this._elapsed = 0;

    this._tick = this._tick.bind(this);
  }

  /** Registra un sistema con update/fixedUpdate opcionales. */
  add(system) {
    this._systems.push(system);
    return system;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
  }

  _tick(now) {
    if (!this._running) return;
    requestAnimationFrame(this._tick);

    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > this._maxAccum) dt = this._maxAccum; // clamp ante saltos grandes
    this._elapsed += dt;

    // --- Paso fijo de simulacion ---
    this._accumulator += dt;
    while (this._accumulator >= this._fixedDt) {
      for (const s of this._systems) s.fixedUpdate?.(this._fixedDt);
      this._accumulator -= this._fixedDt;
    }

    // --- Paso variable de presentacion ---
    for (const s of this._systems) s.update?.(dt, this._elapsed);

    this._renderFn(dt, this._elapsed);
  }
}
