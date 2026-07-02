import * as THREE from 'three';

// Vector temporal reutilizable para calculos de distancia (evita allocation por frame).
const _tmp = new THREE.Vector3();

/**
 * Sistema de PELIGROS: vigila la distancia del jugador a cada peligro y:
 *  - dentro del radio de AVISO  -> muestra advertencia en el HUD ('hazard:warn').
 *  - dentro del radio de HERIDA -> lesion no fatal ('player:hurt') — p.ej. malla sobresalida.
 *  - dentro del radio de CONTACTO -> el jugador MUERE ('player:death').
 *
 * Tipos de peligro:
 *  - Normal (kill): vehiculos, barreras, zonas. Muerte al contacto.
 *  - 'corte' (hurt, sin kill): malla sobresalida. Solo lesion, no fatal.
 *
 * Peligros ESTATICOS: Box3 calculada una sola vez al arrancar.
 * Peligros VIVOS (live:true, vehiculos en movimiento): Box3 recalculada cada frame.
 * Peligros DINAMICOS: incendio u otros eventos, posicion puntual via EventBus.
 */
export class HazardSystem {
  constructor({ player, world, bus, input }) {
    this.player = player;
    this.bus = bus;
    this.input = input;
    this.dead = false;
    this._currentWarn = undefined;
    this._hurtCooldown = 0;   // segundos hasta que se puede recibir otro corte
    this._graceTimer   = 5.0; // periodo de gracia al inicio: 5s sin deteccion de peligros

    this.hazards = world.hazards.map((h) => {
      const live = !!h.live;
      let box = null, center = null;

      if (!live) {
        box = new THREE.Box3().setFromObject(h.object);
        if (box.isEmpty()) {
          center = h.object.getWorldPosition(new THREE.Vector3());
          box = null;
        }
      }

      return {
        object: h.object,
        live,
        _liveBox: live ? new THREE.Box3() : null,
        box,
        center,
        warn: h.warn ?? 4,
        kill: h.kill ?? null,       // null = sin limite fatal (solo corte)
        hurt: h.hurt ?? null,       // distancia de herida no fatal
        aviso: h.aviso,
        reflexion: h.reflexion,
        tipo: h.tipo,
      };
    });

    // Peligros dinamicos (incendio, etc.) via EventBus.
    this._dynamic = new Map();
    this.bus.on('hazard:add', (d) => {
      this._dynamic.set(d.id, {
        center: d.position.clone(),
        warn: d.warn ?? 4,
        kill: d.kill ?? 1.2,
        hurt: d.hurt ?? null,
        aviso: d.aviso,
        reflexion: d.reflexion,
        tipo: d.tipo,
      });
    });
    this.bus.on('hazard:remove', (id) => this._dynamic.delete(id));
  }

  _dist(h, p) {
    if (h.live) {
      h.object.updateWorldMatrix(true, false);
      h._liveBox.setFromObject(h.object);
      if (h._liveBox.isEmpty()) return h.object.getWorldPosition(_tmp).distanceTo(p);
      return h._liveBox.distanceToPoint(p);
    }
    return h.box ? h.box.distanceToPoint(p) : h.center.distanceTo(p);
  }

  _distDyn(h, p) {
    return h.center.distanceTo(p);
  }

  update(dt = 0) {
    if (this.dead || !this.input.enabled) return;

    // Periodo de gracia al inicio: el jugador tiene 5s para orientarse sin morir.
    if (this._graceTimer > 0) {
      this._graceTimer = Math.max(0, this._graceTimer - dt);
      return;
    }

    // Decrementa el cooldown de heridas
    if (this._hurtCooldown > 0) this._hurtCooldown = Math.max(0, this._hurtCooldown - dt);

    const p = this.player.position;
    let nearestWarn = null;
    let minWarn = Infinity;

    const revisar = (h) => {
      const d = this._dist(h, p);

      // Muerte (peligros letales: vehiculos, barreras, zonas)
      if (h.kill != null && d <= h.kill) {
        this._morir(h);
        return true;
      }

      // Herida no fatal (corte: malla sobresalida, pernos sobresalidos, etc.)
      if (h.hurt != null && d <= h.hurt && this._hurtCooldown <= 0) {
        this._herir(h);
      }

      if (d <= h.warn && d < minWarn) {
        minWarn = d;
        nearestWarn = h;
      }
      return false;
    };

    const revisarDyn = (h) => {
      const d = this._distDyn(h, p);
      if (h.kill != null && d <= h.kill) { this._morir(h); return true; }
      if (h.hurt != null && d <= h.hurt && this._hurtCooldown <= 0) this._herir(h);
      if (d <= h.warn && d < minWarn) { minWarn = d; nearestWarn = h; }
      return false;
    };

    for (const h of this.hazards) if (revisar(h)) return;
    for (const h of this._dynamic.values()) if (revisarDyn(h)) return;

    // Separa zona prohibida (banner ambar constante) de peligros letales (banner rojo pulsante).
    const esProhibida = nearestWarn?.tipo === 'prohibida';
    const aviso = nearestWarn ? nearestWarn.aviso : null;
    if (aviso !== this._currentWarn) {
      this._currentWarn = aviso;
      this.bus.emit('hazard:warn',  esProhibida ? null  : aviso);
      this.bus.emit('hazard:zona',  esProhibida ? aviso : null);
    }
  }

  _morir(h) {
    this.dead = true;
    this.input.enabled = false;
    this.bus.emit('hazard:warn', null);
    this.bus.emit('player:death', { reflexion: h.reflexion, tipo: h.tipo });
  }

  /** Lesion no fatal — el jugador queda herido pero sigue activo. Cooldown 4s. */
  _herir(h) {
    this._hurtCooldown = 4.0;
    this.bus.emit('player:hurt', { reflexion: h.reflexion, tipo: h.tipo });
  }
}
