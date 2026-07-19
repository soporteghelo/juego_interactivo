import * as THREE from 'three';
import { Device } from '../core/Device.js';

/**
 * VentFlowSystem — hace VISIBLE el flujo de la ventilacion: un penacho tenue de polvo/vaho que
 * "sopla" desde la BOCA de la manga mas cercana (`userData.ventOutlet`) a lo largo de la labor.
 * Complementa al billowing de la propia manga (ver `elementos/servicios/ventilacion.js`).
 *
 * Presupuesto DURO y gateado (como WorkFX/WorkSiteSystem): pool minimo (1 tactil / 2 escritorio),
 * pocas particulas, material compartido, SIN blending aditivo (el aire no brilla). Solo la(s)
 * boca(s) mas cercana(s) y VISIBLE(s) reciben emisor; nada emite si `particleDensity` es ~0.
 *
 * Las particulas viven en ESPACIO MUNDO (Points sin transform); las bocas son estaticas, asi que
 * se descubren y georreferencian UNA vez al iniciar.
 */
export class VentFlowSystem {
  constructor({ scene, world, settings, bus }) {
    this.scene = scene;
    this.settings = settings;
    this.playerPos = new THREE.Vector3();
    bus?.on('player:moved', ({ position }) => this.playerPos.copy(position));

    // Descubre y georreferencia las bocas de descarga (una pasada; geometria estatica).
    this.outlets = [];
    for (const seg of world.segments || []) {
      seg.group.updateWorldMatrix?.(true, false);
      seg.group.traverse((o) => {
        if (!o.userData?.ventOutlet) return;
        if (o.name !== 'ventilacion' && o.name !== 'ventilacion_antigua') return;
        const vo = o.userData.ventOutlet;
        this.outlets.push({
          pos: vo.pos.clone().applyMatrix4(o.matrixWorld),
          dir: vo.dir.clone().transformDirection(o.matrixWorld).normalize(),
          seg
        });
      });
    }

    const touch = Device.isTouch;
    this.poolSize = touch ? 1 : 2;
    this.count = touch ? 12 : 18;
    this.range = 24;              // m: solo la boca mas cercana dentro de esto emite
    this._tex = this._softTex();
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) this.pool.push(this._makeEmitter());
  }

  _softTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  _makeEmitter() {
    const positions = new Float32Array(this.count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this._tex, color: 0xaeb0a8, size: 0.28,
      transparent: true, opacity: 0.16, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    this.scene.add(points);
    return {
      points, geo, positions,
      vel: new Float32Array(this.count * 3),
      life: new Float32Array(this.count),
      src: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1),
      active: false, warm: false
    };
  }

  _spawn(e, i, life01 = 1) {
    const ix = i * 3;
    const j = 0.18;
    e.positions[ix]     = e.src.x + (Math.random() - 0.5) * j;
    e.positions[ix + 1] = e.src.y + (Math.random() - 0.5) * j;
    e.positions[ix + 2] = e.src.z + (Math.random() - 0.5) * j;
    // Sopla a lo largo de la direccion de la boca + dispersion (corriente de aire).
    const sp = 1.6 + Math.random() * 1.2;
    e.vel[ix]     = e.dir.x * sp + (Math.random() - 0.5) * 0.6;
    e.vel[ix + 1] = e.dir.y * sp + (Math.random() - 0.5) * 0.4 - 0.15;
    e.vel[ix + 2] = e.dir.z * sp + (Math.random() - 0.5) * 0.6;
    e.life[i] = (1.1 + Math.random() * 0.9) * life01;
  }

  _assign(e, o) {
    e.src.copy(o.pos);
    e.dir.copy(o.dir);
    if (!e.warm) { for (let i = 0; i < this.count; i++) this._spawn(e, i, Math.random()); e.warm = true; }
    if (!e.active) { e.active = true; e.points.visible = true; }
  }

  _idle(e) {
    if (e.active) { e.active = false; e.points.visible = false; e.warm = false; }
  }

  update(dt) {
    const dens = this.settings.current.particleDensity;
    if (dens <= 0.05 || !this.outlets.length) { for (const e of this.pool) this._idle(e); return; }

    // Bocas VISIBLES y dentro de rango, ordenadas por cercania al jugador.
    const cand = [];
    for (const o of this.outlets) {
      if (!o.seg.group.visible) continue;
      const d2 = o.pos.distanceToSquared(this.playerPos);
      if (d2 < this.range * this.range) cand.push({ o, d2 });
    }
    cand.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      if (cand[i]) this._assign(e, cand[i].o); else this._idle(e);
    }

    // Integracion de las particulas activas.
    for (const e of this.pool) {
      if (!e.active || !e.warm) continue;
      const p = e.positions, v = e.vel, l = e.life;
      for (let i = 0; i < this.count; i++) {
        l[i] -= dt;
        if (l[i] <= 0) { this._spawn(e, i, 1); continue; }
        const ix = i * 3;
        p[ix] += v[ix] * dt; p[ix + 1] += v[ix + 1] * dt; p[ix + 2] += v[ix + 2] * dt;
        const f = Math.max(0, 1 - 0.7 * dt);   // el aire pierde impulso poco a poco
        v[ix] *= f; v[ix + 2] *= f;
      }
      e.geo.attributes.position.needsUpdate = true;
    }
  }
}
