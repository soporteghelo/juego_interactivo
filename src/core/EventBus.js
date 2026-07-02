/**
 * Bus de eventos pub/sub para desacoplar sistemas.
 *
 * Los sistemas de gameplay (eventos dinamicos, misiones, IA, audio, UI) se comunican
 * publicando/escuchando mensajes en vez de referenciarse entre si. Esto es el "cableado"
 * que mantiene el simulador extensible (ver extension points del plan).
 *
 * Convencion de eventos (crecera con el tiempo):
 *   'player:moved', 'player:interact', 'world:segmentLoaded',
 *   'event:rockfall', 'event:powerOutage', 'event:fire', 'event:gas',
 *   'mission:objectiveComplete', 'ui:prompt', 'quality:changed'
 */
export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  /** Suscribe `fn` al evento `type`. Devuelve una funcion para desuscribirse. */
  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  /** Suscripcion de un solo disparo. */
  once(type, fn) {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(type, fn) {
    this._handlers.get(type)?.delete(fn);
  }

  /** Publica un evento con datos opcionales. */
  emit(type, payload) {
    const set = this._handlers.get(type);
    if (!set) return;
    // Copia defensiva: un handler puede desuscribirse durante la emision.
    [...set].forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] error en handler de "${type}":`, err);
      }
    });
  }
}
