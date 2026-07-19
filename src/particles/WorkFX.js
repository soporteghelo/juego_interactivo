import * as THREE from 'three';
import { Device } from '../core/Device.js';

/**
 * WorkFX — pool de emisores de PARTICULAS baratos para las labores activas:
 *   - 'polvo': puffs grises que nacen en la broca/pica, suben y se disipan (perforacion/desate).
 *   - 'spray': cono claro desde la boquilla hacia el hastial (shotcrete).
 *
 * Presupuesto DURO: 2 emisores en tactil / 4 en escritorio, cada uno con 16/24 particulas y
 * material compartido (una textura suave). Sin blending aditivo (el polvo NO brilla). El
 * WorkSiteSystem adquiere/suelta emisores segun la distancia del jugador a cada labor.
 *
 * Las particulas viven en ESPACIO MUNDO (los Points cuelgan de la escena sin transform), asi
 * que el emisor sigue a la herramienta moviendo solo el punto de nacimiento (`setSource`).
 */
export class WorkFX {
  constructor({ scene }) {
    this.scene = scene;
    const touch = Device.isTouch;
    this.poolSize = touch ? 2 : 4;
    this.count = touch ? 16 : 24;
    this._tex = this._softTex();
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) this.pool.push(this._makeEmitter());
    this._v = new THREE.Vector3();
  }

  /** Textura radial suave (misma idea que el MistSystem). */
  _softTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  _makeEmitter() {
    const positions = new Float32Array(this.count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this._tex, color: 0x9a938a, size: 0.32,
      transparent: true, opacity: 0.22, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;   // la nube se mueve fuera de su bounding original
    points.visible = false;
    this.scene.add(points);
    return {
      points, geo, mat, positions,
      vel: new Float32Array(this.count * 3),
      life: new Float32Array(this.count),
      inUse: false, warm: false, tipo: null,
      src: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0)
    };
  }

  /** Reserva un emisor libre del pool (o null si estan todos ocupados). */
  acquire(tipo) {
    const e = this.pool.find(x => !x.inUse);
    if (!e) return null;
    e.inUse = true; e.warm = false; e.tipo = tipo;
    e.points.visible = true;
    // Ajusta el look del material segun el tipo.
    if (tipo === 'spray') { e.mat.color.setHex(0xd2ccc2); e.mat.opacity = 0.30; e.mat.size = 0.22; }
    else                  { e.mat.color.setHex(0x9a938a); e.mat.opacity = 0.22; e.mat.size = 0.34; }
    const self = this;
    return {
      setSource(pos, dir) {
        e.src.copy(pos);
        if (dir) e.dir.copy(dir);
        if (!e.warm) { for (let i = 0; i < self.count; i++) self._spawn(e, i, Math.random()); e.warm = true; }
      },
      release() { self._release(e); }
    };
  }

  _release(e) {
    e.inUse = false; e.tipo = null;
    e.points.visible = false;
  }

  _spawn(e, i, life01 = 1) {
    const ix = i * 3;
    const j = 0.12;
    e.positions[ix]     = e.src.x + (Math.random() - 0.5) * j;
    e.positions[ix + 1] = e.src.y + (Math.random() - 0.5) * j;
    e.positions[ix + 2] = e.src.z + (Math.random() - 0.5) * j;
    if (e.tipo === 'spray') {
      const sp = 2.2 + Math.random() * 1.4;
      e.vel[ix]     = e.dir.x * sp + (Math.random() - 0.5) * 0.7;
      e.vel[ix + 1] = e.dir.y * sp + (Math.random() - 0.5) * 0.7 - 0.3;
      e.vel[ix + 2] = e.dir.z * sp + (Math.random() - 0.5) * 0.7;
      e.life[i] = (0.35 + Math.random() * 0.3) * life01;
    } else { // polvo: sube y deriva
      e.vel[ix]     = (Math.random() - 0.5) * 0.5;
      e.vel[ix + 1] = 0.35 + Math.random() * 0.5;
      e.vel[ix + 2] = (Math.random() - 0.5) * 0.5;
      e.life[i] = (0.9 + Math.random() * 0.8) * life01;
    }
  }

  update(dt) {
    for (const e of this.pool) {
      if (!e.inUse || !e.warm) continue;
      const p = e.positions, v = e.vel, l = e.life;
      for (let i = 0; i < this.count; i++) {
        l[i] -= dt;
        if (l[i] <= 0) { this._spawn(e, i, 1); continue; }
        const ix = i * 3;
        p[ix]     += v[ix] * dt;
        p[ix + 1] += v[ix + 1] * dt;
        p[ix + 2] += v[ix + 2] * dt;
        // El spray frena rapido (choca contra la pared); el polvo se frena poco.
        const drag = e.tipo === 'spray' ? 2.6 : 0.6;
        const f = Math.max(0, 1 - drag * dt);
        v[ix] *= f; v[ix + 2] *= f;
      }
      e.geo.attributes.position.needsUpdate = true;
    }
  }
}
