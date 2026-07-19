import * as THREE from 'three';

/**
 * WorkSiteSystem — hace que las LABORES suenen y "trabajen": conecta cada sala activa con un
 * emisor de audio sintetizado (AudioManager) y un emisor de particulas (WorkFX), gestionados
 * por DISTANCIA al jugador. La geometria y la animacion de los equipos ya existen; esto añade
 * la capa sensorial que hace que la mina se sienta viva.
 *
 * Reglas de presupuesto (movil primero):
 *  - AUDIO: un emisor por PERFIL (percusion/hiss/bomba). Se activa la labor MAS CERCANA de
 *    cada tipo dentro de rango; las demas quedan en silencio.
 *  - FX: pool duro (2 tactil / 4 escritorio). Se sirven las labores MAS CERCANAS primero.
 *  - Nada suena/emite si la sala no es visible (el streaming ya la oculta por distancia) o si
 *    esta mas lejos que el radio del efecto.
 *
 * Compatibilidad: si el mundo no tiene salas (modo lineal), la lista queda vacia y el sistema
 * es inerte (coste cero).
 */

// Perfil por tipo de labor: equipo (getObjectByName), sonido, particulas, y OFFSET LOCAL del
// punto de trabajo (broca/pica/boquilla) dentro del equipo — en su espacio local.
const PERFILES = {
  frente:        { equipo: 'raptor',      audio: 'percusion', fx: 'polvo', off: [0, 1.7, 4.0], dir: 'up' },
  sostenimiento: { equipo: 'desatador',   audio: 'percusion', fx: 'polvo', off: [0, 3.0, 2.6], dir: 'up' },
  shotcrete:     { equipo: 'shotcretera', audio: 'hiss',      fx: 'spray', off: [0, 1.8, 2.2], dir: 'wall' },
  bombeo:        { equipo: null,          audio: 'bomba',     fx: null,    off: [0, 0.6, 0],   dir: 'up' },
};

const AUDIO_PROFILES = ['percusion', 'hiss', 'bomba'];
const FX_DIST = 25;      // m: dentro de esto se emiten particulas
const AUDIO_DIST = 32;   // m: dentro de esto se oye la labor

export class WorkSiteSystem {
  constructor({ world, bus, audio, fx }) {
    this.audio = audio;
    this.fx = fx;
    this.playerPos = new THREE.Vector3();
    bus.on('player:moved', ({ position }) => this.playerPos.copy(position));

    this._pos = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    // Descubre las labores con perfil (una pasada al iniciar).
    this.sites = [];
    for (const seg of world.segments || []) {
      if (seg.type !== 'room') continue;
      const perfil = PERFILES[seg.roomType];
      if (!perfil) continue;
      const equipo = perfil.equipo ? seg.group.getObjectByName(perfil.equipo) : null;
      if (perfil.equipo && !equipo) continue;   // el equipo no se pudo crear
      this.sites.push({ seg, perfil, equipo, center: seg._center, fxH: null });
    }
  }

  /** Punto de trabajo en MUNDO (+ direccion del efecto) de una labor. */
  _anchor(site) {
    const p = site.perfil, o = p.off;
    if (site.equipo) site.equipo.localToWorld(this._pos.set(o[0], o[1], o[2]));
    else this._pos.set(site.center.x + o[0], o[1], site.center.z + o[2]);
    if (p.dir === 'up') this._dir.set(0, 1, 0);
    else {
      // 'wall': horizontal desde el centro de la sala hacia el punto (hacia el hastial).
      this._dir.set(this._pos.x - site.center.x, 0, this._pos.z - site.center.z);
      if (this._dir.lengthSq() < 1e-4) this._dir.set(0, 0, 1);
      this._dir.normalize();
    }
    return this._pos;
  }

  update() {
    if (!this.sites.length) return;

    // Distancia + visibilidad de cada labor; procesamos de la mas cercana a la mas lejana.
    const activos = [];
    for (const s of this.sites) {
      const vis = s.seg.group.visible;
      const d = vis ? s.center.distanceTo(this.playerPos) : Infinity;
      activos.push({ s, d, vis });
    }
    activos.sort((a, b) => a.d - b.d);

    // AUDIO: la labor mas cercana de cada perfil dentro de rango gana su emisor.
    const audioTomado = {};
    for (const a of activos) {
      const prof = a.s.perfil.audio;
      if (a.vis && a.d < AUDIO_DIST && prof && !audioTomado[prof]) {
        audioTomado[prof] = true;
        this.audio?.setWorkEmitter(prof, this._anchor(a.s), true);
      }
    }
    for (const prof of AUDIO_PROFILES) {
      if (!audioTomado[prof]) this.audio?.setWorkEmitter(prof, null, false);
    }

    // FX: las labores mas cercanas se sirven primero hasta agotar el pool.
    let budget = this.fx ? this.fx.poolSize : 0;
    for (const a of activos) {
      const tipo = a.s.perfil.fx;
      const quiere = a.vis && a.d < FX_DIST && tipo && budget > 0;
      if (quiere) {
        if (!a.s.fxH) a.s.fxH = this.fx.acquire(tipo);
        if (a.s.fxH) { a.s.fxH.setSource(this._anchor(a.s), this._dir); budget--; }
      } else if (a.s.fxH) {
        a.s.fxH.release();
        a.s.fxH = null;
      }
    }
  }
}
