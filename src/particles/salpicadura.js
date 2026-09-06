import * as THREE from 'three';

/**
 * SALPICADURA — el agua que levanta la bota al pisar una vía anegada.
 *
 * `mineria-draw.md` pone los charcos entre lo más presente de la mina ("charcos de agua con
 * reflejo metálico, muy presentes en casi todas las escenas") y el mundo YA los modela: cada
 * tramo sortea su grado de encharcado y los más bajos llevan una lámina de agua sobre la
 * calzada (`via_inundada`). Pero el jugador la cruzaba sin que pasara nada: el recorrido sonaba
 * y se veía igual en un tramo seco que con el agua por el tobillo.
 *
 * Este sistema cierra el hueco por el lado visual: en cada contacto de talón (`player:paso`,
 * que emite la marcha de la cámara) consulta cuánta agua hay bajo los pies y, si la hay,
 * levanta un puñado de gotas y un rizo que se abre en la lámina.
 *
 * ── Presupuesto ───────────────────────────────────────────────────────────────
 * Mismo patrón barato que `DripSystem`: UN solo `THREE.Points` para todas las gotas (buffer de
 * ranuras reutilizadas) y un pool mínimo de rizos con geometría y material compartidos. Sin
 * luces, sin geometría por evento y gateado por `particleDensity` — nulo en preset 'bajo'.
 */

// Por debajo de esto la labor está embarrada pero no encharcada: la bota no levanta agua.
const UMBRAL_MOJADO = 0.45;

export class SalpicaduraSystem {
  constructor({ scene, settings, bus, world, audio = null }) {
    this.scene = scene;
    this.settings = settings;
    this.world = world;
    this.audio = audio;

    this.playerPos = new THREE.Vector3();
    this._hasPos = false;
    bus?.on('player:moved', ({ position, pie }) => {
      if (!pie) return;                  // conduciendo el scoop no hay bota que salpique
      this.playerPos.copy(position);
      this._hasPos = true;
    });
    bus?.on('player:paso', (e) => this._pisada(e));

    // ── Gotas: un único Points; cada ranura del buffer es una gota en vuelo ──
    this.maxGotas = 24;
    this.pos = new Float32Array(this.maxGotas * 3);
    this.vel = new Float32Array(this.maxGotas * 3);
    this.viva = new Uint8Array(this.maxGotas);
    for (let i = 0; i < this.maxGotas; i++) this.pos[i * 3 + 1] = -9999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mat = new THREE.PointsMaterial({
      map: this._textura(), color: 0xcfe6f2, size: 0.055,
      transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true
    });
    this.gotas = new THREE.Points(geo, this.mat);
    this.gotas.frustumCulled = false;
    this.gotas.visible = false;
    this.gotas.name = 'salpicadura_gotas';
    scene.add(this.gotas);

    // ── Rizos: anillos planos reutilizados sobre la lámina de agua ──
    this.rizoGeo = new THREE.RingGeometry(0.05, 0.10, 14).rotateX(-Math.PI / 2);
    this.rizos = [];
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd6ecf7, transparent: true, opacity: 0, depthWrite: false
      });
      const mesh = new THREE.Mesh(this.rizoGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.name = 'salpicadura_rizo';
      scene.add(mesh);
      this.rizos.push({ mesh, mat, t: 0, vida: 0 });
    }
  }

  /** Gota: punto con halo suave (la misma receta que la gotera de la bóveda). */
  _textura() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(240,252,255,1)');
    g.addColorStop(0.5, 'rgba(205,238,255,0.55)');
    g.addColorStop(1, 'rgba(205,238,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  /**
   * Contacto de talón. Consulta el agua bajo los pies y reparte el dato: las gotas y el rizo
   * los pone este sistema; el TIMBRE de la pisada lo aplica el AudioManager, al que se le
   * empuja el valor para que no tenga que conocer la topología del mundo.
   */
  _pisada(e) {
    const mojado = this.world?.mojadoActual?.() ?? 0;
    this.audio?.setMojado?.(mojado);
    if (!this._hasPos || mojado < UMBRAL_MOJADO) return;

    const dens = this.settings.current.particleDensity;
    if (dens <= 0.05) return;

    // Cuanta más agua y más rápido se pisa, más levanta la bota.
    const fuerza = (mojado - UMBRAL_MOJADO) / (1 - UMBRAL_MOJADO);
    const veloc = Math.min(1, (e?.velocidad ?? 1.5) / 4.6);
    const n = Math.round((3 + fuerza * 5 + veloc * 3) * Math.min(1, dens));

    // Pies: la cápsula del jugador tiene su centro ~1.05 m sobre la planta.
    const py = this.playerPos.y - 1.05;
    for (let k = 0; k < n; k++) this._lanzarGota(this.playerPos.x, py, this.playerPos.z, fuerza, veloc);
    this._lanzarRizo(this.playerPos.x, py, this.playerPos.z, fuerza);
  }

  _lanzarGota(x, y, z, fuerza, veloc) {
    for (let i = 0; i < this.maxGotas; i++) {
      if (this.viva[i]) continue;
      const ix = i * 3;
      const a = Math.random() * Math.PI * 2;
      const r = 0.06 + Math.random() * 0.12;
      this.pos[ix]     = x + Math.cos(a) * r;
      this.pos[ix + 1] = y + 0.02;
      this.pos[ix + 2] = z + Math.sin(a) * r;
      // Sale hacia afuera y hacia arriba: la bota desplaza el agua en corona.
      const lateral = (0.5 + Math.random() * 0.9) * (0.4 + fuerza * 0.9);
      this.vel[ix]     = Math.cos(a) * lateral;
      this.vel[ix + 1] = (1.0 + Math.random() * 1.1) * (0.5 + veloc * 0.8);
      this.vel[ix + 2] = Math.sin(a) * lateral;
      this.viva[i] = 1;
      return;
    }
  }

  _lanzarRizo(x, y, z, fuerza) {
    for (const r of this.rizos) {
      if (r.vida > 0) continue;
      r.mesh.position.set(x, y + 0.025, z);
      r.mesh.scale.setScalar(1);
      r.mat.opacity = 0.30 + fuerza * 0.22;
      r.mesh.visible = true;
      r.t = 0;
      r.vida = 0.55;
      return;
    }
  }

  update(dt) {
    if (this.settings.current.particleDensity <= 0.05) {
      if (this.gotas.visible) this.gotas.visible = false;
      return;
    }

    // Gotas: balística simple y muerte al volver a la lámina.
    let alguna = false;
    for (let i = 0; i < this.maxGotas; i++) {
      if (!this.viva[i]) continue;
      const ix = i * 3;
      this.vel[ix + 1] -= 9.8 * dt;
      this.pos[ix]     += this.vel[ix] * dt;
      this.pos[ix + 1] += this.vel[ix + 1] * dt;
      this.pos[ix + 2] += this.vel[ix + 2] * dt;
      // Al caer por debajo de donde nació, la gota se reabsorbe en el charco.
      if (this.vel[ix + 1] < 0 && this.pos[ix + 1] < this.playerPos.y - 1.07) {
        this.viva[i] = 0;
        this.pos[ix + 1] = -9999;
      } else {
        alguna = true;
      }
    }
    this.gotas.visible = alguna;
    if (alguna) this.gotas.geometry.attributes.position.needsUpdate = true;

    // Rizos: se abren y se desvanecen.
    for (const r of this.rizos) {
      if (r.vida <= 0) continue;
      r.t += dt;
      const q = r.t / r.vida;
      if (q >= 1) { r.vida = 0; r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(1 + q * 3.4);
      r.mat.opacity = (1 - q) * (0.30 + 0.22);
    }
  }
}
