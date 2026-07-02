import { createRockFall } from './RockFall.js';
import { createPowerOutage } from './PowerOutage.js';
import { createFire } from './Fire.js';
import { createGasLeak } from './GasLeak.js';

/**
 * Director de EVENTOS DINAMICOS (md: caida de rocas, derrumbes, corte electrico, incendio,
 * gases, emergencias, evacuaciones, fallas de equipos).
 *
 * Mantiene una lista de eventos activos y los actualiza hasta que terminan. Los eventos se
 * disparan publicando en el EventBus ('event:trigger' con {type}) o llamando trigger().
 * Tambien re-emite un evento especifico ('event:fire', etc.) para que otros sistemas
 * reaccionen (p.ej. NPCManager evacua).
 *
 * Para probar desde la consola del navegador:
 *   __mina.eventDirector.trigger('rockfall')
 *   __mina.eventDirector.trigger('blackout')
 *   __mina.eventDirector.trigger('fire')
 *   __mina.eventDirector.trigger('gas')
 */
const FACTORIES = {
  rockfall: createRockFall,
  blackout: createPowerOutage,
  fire: createFire,
  gas: createGasLeak
};

const REEMIT = {
  rockfall: 'event:rockfall',
  blackout: 'event:powerOutage',
  fire: 'event:fire',
  gas: 'event:gas'
};

export class EventDirector {
  constructor({ bus, world, lighting }) {
    this.bus = bus;
    this.world = world;
    this.lighting = lighting;
    this.active = [];

    this.bus.on('event:trigger', ({ type } = {}) => this.trigger(type));
  }

  /** Dispara un evento por tipo. */
  trigger(type) {
    const factory = FACTORIES[type];
    if (!factory) {
      console.warn(`[EventDirector] evento desconocido: ${type}`);
      return;
    }
    const ctx = {
      scene: window.__mina?.scene,
      camera: window.__mina?.camera,
      world: this.world,
      lighting: this.lighting,
      bus: this.bus
    };
    const instance = factory(ctx);
    this.active.push(instance);
    if (REEMIT[type]) this.bus.emit(REEMIT[type], {});
    this.bus.emit('ui:read', { title: 'EVENTO', body: instance.message || `Evento: ${type}` });
  }

  update(dt, elapsed) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const done = this.active[i].update(dt, elapsed);
      if (done) {
        this.active[i].stop?.();
        this.active.splice(i, 1);
      }
    }
  }
}
