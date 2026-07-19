import * as THREE from 'three';
import { Device } from '../core/Device.js';

/**
 * VaporSystem — VAHO/condensación en las labores CALUROSAS y mal ventiladas (frente, shotcrete,
 * bombeo). Ambiente 31–34 °C y >90 % HR con voladura/diésel reciente ⇒ el aire "humea" en los
 * haces de luz (`mineria-draw.md`: "neblina/vaho densos en frentes mal ventilados; condensación";
 * "omitir polvo/neblina" es ERROR). Complementa al `Mist` ambiental global y al `VentFlowSystem`.
 *
 * Mismo patrón de presupuesto que VentFlow/WorkFX: pool mínimo (1 táctil / 2 escritorio), pocas
 * partículas, material compartido, SIN blending aditivo (el vaho NO brilla). Solo la labor más
 * cercana y VISIBLE emite; nada si `particleDensity` es ~0. Las fuentes (salas) son estáticas →
 * se descubren una vez.
 */
export class VaporSystem {
  constructor({ scene, world, settings, bus }) {
    this.scene = scene;
    this.settings = settings;
    this.playerPos = new THREE.Vector3();
    bus?.on('player:moved', ({ position }) => this.playerPos.copy(position));

    const TIPOS = ['frente', 'shotcrete', 'bombeo'];
    this.sources = [];
    for (const seg of world.segments || []) {
      if (seg.type !== 'room' || !TIPOS.includes(seg.roomType) || !seg._center) continue;
      // Fuente cerca del piso de la labor (el vaho sube desde ahí).
      this.sources.push({ pos: new THREE.Vector3(seg._center.x, Math.max(0.6, seg._center.y - 2.0), seg._center.z), seg });
    }

    const touch = Device.isTouch;
    this.poolSize = touch ? 1 : 2;
    this.count = touch ? 14 : 22;
    this.range = 26;
    this._tex = this._softTex();
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) this.pool.push(this._makeEmitter());
  }

  _softTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  _makeEmitter() {
    const positions = new Float32Array(this.count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this._tex, color: 0xb8bcc0, size: 0.9,
      transparent: true, opacity: 0.10, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    this.scene.add(points);
    return {
      points, geo, positions,
      vel: new Float32Array(this.count * 3),
      life: new Float32Array(this.count),
      src: new THREE.Vector3(),
      active: false, warm: false
    };
  }

  _spawn(e, i, life01 = 1) {
    const ix = i * 3;
    // Nace en un disco amplio a ras de piso y SUBE lento derivando (columna de vaho).
    const r = Math.random() * 1.8, a = Math.random() * Math.PI * 2;
    e.positions[ix]     = e.src.x + Math.cos(a) * r;
    e.positions[ix + 1] = e.src.y + Math.random() * 0.3;
    e.positions[ix + 2] = e.src.z + Math.sin(a) * r;
    e.vel[ix]     = (Math.random() - 0.5) * 0.25;
    e.vel[ix + 1] = 0.28 + Math.random() * 0.35;   // asciende lento (aire caliente)
    e.vel[ix + 2] = (Math.random() - 0.5) * 0.25;
    e.life[i] = (2.6 + Math.random() * 2.0) * life01;
  }

  _assign(e, s) {
    e.src.copy(s.pos);
    if (!e.warm) { for (let i = 0; i < this.count; i++) this._spawn(e, i, Math.random()); e.warm = true; }
    if (!e.active) { e.active = true; e.points.visible = true; }
  }

  _idle(e) {
    if (e.active) { e.active = false; e.points.visible = false; e.warm = false; }
  }

  update(dt) {
    const dens = this.settings.current.particleDensity;
    if (dens <= 0.05 || !this.sources.length) { for (const e of this.pool) this._idle(e); return; }

    const cand = [];
    for (const s of this.sources) {
      if (!s.seg.group.visible) continue;
      const d2 = s.pos.distanceToSquared(this.playerPos);
      if (d2 < this.range * this.range) cand.push({ s, d2 });
    }
    cand.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      if (cand[i]) this._assign(e, cand[i].s); else this._idle(e);
    }

    for (const e of this.pool) {
      if (!e.active || !e.warm) continue;
      const p = e.positions, v = e.vel, l = e.life;
      for (let i = 0; i < this.count; i++) {
        l[i] -= dt;
        if (l[i] <= 0) { this._spawn(e, i, 1); continue; }
        const ix = i * 3;
        p[ix] += v[ix] * dt; p[ix + 1] += v[ix + 1] * dt; p[ix + 2] += v[ix + 2] * dt;
        const f = Math.max(0, 1 - 0.5 * dt);   // deriva que se frena
        v[ix] *= f; v[ix + 2] *= f;
      }
      e.geo.attributes.position.needsUpdate = true;
    }
  }
}
