import * as THREE from 'three';
import { Device } from '../core/Device.js';

/**
 * DripSystem — GOTEO DE AGUA que cae de la boveda e impacta en el piso/charco (rizo).
 *
 * La mina esta a >90% HR (mineria-draw.md: ambiente humedo, condensacion): el agua de filtracion
 * gotea CONSTANTE de la corona. El AudioManager ya reproduce el "ploc" resonante de las goteras,
 * pero NO habia ninguna gota VISIBLE — se oia gotear y no se veia caer nada (desajuste audio-visual).
 * Este sistema lo cierra: gotas que caen cerca del jugador, iluminadas por el headlamp/LED (alimentan
 * el bloom de PostFX), y un RIZO que se expande al impactar (sobre el charco espeja el env-map). Al
 * impactar dispara `audio.drip(pos)` → el ploc suena SINCRONIZADO y espacializado con la gota.
 *
 * Presupuesto (mismo patron barato que VaporSystem/VentFlow): 1 THREE.Points para TODAS las gotas +
 * pool minimo de rizos (geometria/material compartidos); SIN luces nuevas; gateado por
 * `particleDensity` (nulo si <=0.05). Los puntos de emision (goteras) se colocan en la boveda
 * alrededor del jugador y se RECOLOCAN cuando este se aleja. Todo relativo a la posicion del jugador
 * → funciona en cualquier nivel (la cota del piso baja con `player.y`).
 */
export class DripSystem {
  constructor({ scene, settings, bus, audio }) {
    this.scene = scene;
    this.settings = settings;
    this.audio = audio || null;
    this.playerPos = new THREE.Vector3();
    this._hasPos = false;
    bus?.on('player:moved', ({ position }) => { this.playerPos.copy(position); this._hasPos = true; });

    const touch = Device.isTouch;
    this.maxDrops = touch ? 5 : 10;   // gotas simultaneas (slots del buffer)
    this.nPoints = touch ? 2 : 3;     // goteras (puntos de emision) alrededor del jugador
    this.range = 14;                  // recoloca las goteras si el jugador se aleja > range
    this.ceil = 2.9;                  // altura de emision sobre player.y (≈ boveda de la labor)
    this.floorRel = -1.45;            // cota de impacto relativa a player.y (≈ piso/charco)

    // --- Gotas: UN THREE.Points; cada slot del buffer es una gota que cae ---
    this._tex = this._makeTex();
    this.dropPos = new Float32Array(this.maxDrops * 3);
    this.dropVel = new Float32Array(this.maxDrops);   // velocidad de caida (m/s, hacia -Y)
    this.dropOn = new Uint8Array(this.maxDrops);
    for (let i = 0; i < this.maxDrops; i++) this.dropPos[i * 3 + 1] = -9999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.dropMat = new THREE.PointsMaterial({
      map: this._tex, color: 0xbfeaff, size: 0.17,
      transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true
    });
    this.drops = new THREE.Points(geo, this.dropMat);
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    scene.add(this.drops);

    // --- Rizos: pool minimo de anillos planos reutilizados (geometria compartida) ---
    this.ripGeo = new THREE.RingGeometry(0.14, 0.22, 16).rotateX(-Math.PI / 2);
    this.ripples = [];
    const nRip = touch ? 3 : 5;
    for (let i = 0; i < nRip; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(this.ripGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.ripples.push({ mesh, mat, t: 0, life: 0 });
    }

    // Goteras: cada punto de emision guarda su timer hacia la proxima gota.
    this.emit = [];
    for (let i = 0; i < this.nPoints; i++) this.emit.push({ x: 0, y: 0, z: 0, next: Math.random() * 2.5 });
    this._placed = false;
    this._placeCenter = new THREE.Vector3();
    this._impact = new THREE.Vector3();   // scratch para espacializar el audio
  }

  /** Textura suave y brillante de la gota (punto con halo). */
  _makeTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(235,250,255,1)');
    g.addColorStop(0.5, 'rgba(200,235,255,0.6)');
    g.addColorStop(1, 'rgba(200,235,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  /** Recoloca las goteras en la boveda alrededor del jugador (radio 2–7 m). */
  _place() {
    for (const e of this.emit) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 5;
      e.x = this.playerPos.x + Math.cos(a) * r;
      e.z = this.playerPos.z + Math.sin(a) * r;
      e.y = this.playerPos.y + this.ceil;
    }
    this._placeCenter.copy(this.playerPos);
    this._placed = true;
  }

  /** Enciende una gota en un slot libre del buffer, naciendo en la gotera (ex,ey,ez). */
  _spawnDrop(ex, ey, ez) {
    for (let i = 0; i < this.maxDrops; i++) {
      if (this.dropOn[i]) continue;
      const ix = i * 3;
      this.dropPos[ix] = ex + (Math.random() - 0.5) * 0.1;
      this.dropPos[ix + 1] = ey;
      this.dropPos[ix + 2] = ez + (Math.random() - 0.5) * 0.1;
      this.dropVel[i] = 1.0 + Math.random() * 0.6;
      this.dropOn[i] = 1;
      return;
    }
  }

  /** Enciende un rizo (anillo que se expande y desvanece) en el punto de impacto. */
  _spawnRipple(x, y, z) {
    for (const r of this.ripples) {
      if (r.life > 0) continue;
      r.mesh.position.set(x, y + 0.03, z);
      r.mesh.scale.setScalar(1);
      r.mat.opacity = 0.5;
      r.mesh.visible = true;
      r.t = 0; r.life = 0.55;
      return;
    }
  }

  _idle() {
    if (this.drops.visible) {
      for (let i = 0; i < this.maxDrops; i++) { this.dropOn[i] = 0; this.dropPos[i * 3 + 1] = -9999; }
      this.drops.geometry.attributes.position.needsUpdate = true;
      this.drops.visible = false;
    }
    for (const r of this.ripples) { if (r.life > 0) { r.life = 0; r.mesh.visible = false; } }
    this._placed = false;
  }

  update(dt) {
    const dens = this.settings.current.particleDensity;
    if (dens <= 0.05 || !this._hasPos) { this._idle(); return; }
    this.drops.visible = true;

    // Recolocar goteras al arrancar o cuando el jugador se alejo del cluster.
    if (!this._placed || this._placeCenter.distanceToSquared(this.playerPos) > this.range * this.range) {
      this._place();
    }

    // Menos goteras activas cuando baja la calidad (una siempre).
    const activePts = Math.max(1, Math.round(this.nPoints * dens));
    const floorY = this.playerPos.y + this.floorRel;

    // Emision de gotas por cada gotera activa.
    for (let k = 0; k < activePts; k++) {
      const e = this.emit[k];
      e.next -= dt;
      if (e.next <= 0) {
        this._spawnDrop(e.x, e.y, e.z);
        e.next = 1.6 + Math.random() * 3.4;   // cadencia de gotera (s)
      }
    }

    // Integrar caida de las gotas.
    let any = false;
    for (let i = 0; i < this.maxDrops; i++) {
      if (!this.dropOn[i]) continue;
      any = true;
      const ix = i * 3;
      this.dropVel[i] += 9.0 * dt;                 // gravedad
      this.dropPos[ix + 1] -= this.dropVel[i] * dt;
      if (this.dropPos[ix + 1] <= floorY) {
        // Impacto: rizo + ploc sincronizado y espacializado.
        this._spawnRipple(this.dropPos[ix], floorY, this.dropPos[ix + 2]);
        if (this.audio) { this._impact.set(this.dropPos[ix], floorY, this.dropPos[ix + 2]); this.audio.drip(this._impact); }
        this.dropOn[i] = 0;
        this.dropPos[ix + 1] = -9999;
      }
    }
    this.drops.geometry.attributes.position.needsUpdate = true;
    if (!any) this.drops.visible = false;

    // Animar rizos (expanden y se desvanecen).
    for (const r of this.ripples) {
      if (r.life <= 0) continue;
      r.t += dt;
      const q = r.t / r.life;
      if (q >= 1) { r.life = 0; r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(1 + q * 3.2);
      r.mat.opacity = 0.5 * (1 - q);
    }
  }
}
