import * as THREE from 'three';
import { NPC } from '../ai/NPC.js';
import { Device } from '../core/Device.js';
import { setTarea } from '../elementos/personas/minero.js';
import { MineMaterials } from '../world/materials/MineMaterials.js';

// Geometria de roca (caida en el desatado) COMPARTIDA entre instancias.
let _rockGeo = null;
const _rockGeometry = () => (_rockGeo ??= new THREE.DodecahedronGeometry(0.25, 0));

/**
 * WorkCrewSystem — pone CUADRILLAS humanas en las labores activas: la mina real esta VIVA, con
 * gente EJECUTANDO tareas (perforando, instalando sostenimiento, lanzando shotcrete, operando
 * la bomba) y un vigia/señalero en la boca. Complementa a WorkSiteSystem (que solo daba la capa
 * sensorial de las MAQUINAS: audio + polvo/spray) añadiendo los OPERADORES y ayudantes.
 *
 * Presupuesto (movil primero):
 *  - Las cuadrillas se CREAN por proximidad (spawn a <46 m, antes de ser visibles) y se RETIRAN
 *    al alejarse (>62 m, con histeresis para no titilar): nunca hay mas de 1-2 cuadrillas vivas.
 *  - En tactil se coloca MEDIA cuadrilla (los primeros miembros).
 *  - Cada NPC gestiona su propio LOD (animacion a tasa reducida / oculto por distancia).
 *
 * Anclaje ROBUSTO: cada miembro se coloca respecto al EQUIPO de la labor desplazandose HACIA el
 * centro de la sala (`fwd`, siempre espacio abierto → nunca dentro del hastial) y a un lado
 * (`lat`). No depende del eje local de cada maquina (cada equipo mira distinto). Si el punto cae
 * fuera del galibo transitable (boundsCheck), ese puesto se omite.
 *
 * Compatibilidad: si el mundo no tiene salas (modo lineal), la lista queda vacia y el sistema es
 * inerte (coste cero).
 */

// Cuadrilla por tipo de labor. `equipo`=nombre del objeto (getObjectByName) usado de ancla.
// Miembro: rol (casco por color) · fwd/lat (m, hacia el centro / al costado) · gesto (micro-
// animacion) · mira ('equipo' la maquina | 'centro' | 'boca' hacia el acceso) · epp (overrides).
const CUADRILLAS = {
  frente: {
    equipo: 'raptor',
    miembros: [
      { rol: 'operador',    fwd: 2.6, lat: -2.0, gesto: 'perforar',    mira: 'equipo' }, // maestro perforista
      { rol: 'operador',    fwd: 3.6, lat:  1.9, gesto: 'operar',      mira: 'equipo' }, // ayudante
      { rol: 'geomecanica', fwd: 7.0, lat:  2.2, gesto: 'topografiar', mira: 'boca'   }, // topografo (estacion total)
      { rol: 'ssoma',       fwd: 8.4, lat: -0.4, gesto: 'observar',    mira: 'boca'   }  // vigia / señalero
    ]
  },
  sostenimiento: {
    equipo: 'empernador',
    miembros: [
      { rol: 'operador', fwd: 2.4, lat: -1.9, gesto: 'instalar', mira: 'equipo' }, // cuadrilla de sostenimiento
      { rol: 'operador', fwd: 3.0, lat:  1.7, gesto: 'instalar', mira: 'equipo' },
      { rol: 'operador', fwd: 4.6, lat: -0.6, gesto: 'cargar',   mira: 'equipo' }  // ayudante acarrea malla/pernos
    ]
  },
  shotcrete: {
    equipo: 'shotcretera',
    miembros: [
      { rol: 'operador', fwd: 2.6, lat:  1.9, gesto: 'operar',   mira: 'equipo', epp: { respirador: true } }, // boquillero
      { rol: 'ssoma',    fwd: 4.4, lat: -2.4, gesto: 'observar', mira: 'boca',   epp: { respirador: true } }
    ]
  },
  bombeo: {
    equipo: null,
    miembros: [
      { rol: 'operador', off: [2.2, 0, 1.4], gesto: 'operar', mira: 'centro' } // cañeria / servicios junto a la bomba
    ]
  },
  // DESATADO MANUAL (PETS-CL-OPE-1): cuadrilla de DOS anclada al FRENTE (pared del fondo).
  // Uno DESATA con barretilla, el otro ALUMBRA; INTERCAMBIAN rol cada `swap` s (PETS: cada
  // 15 min, comprimido). `frente:true` → se anclan al fondo mirando la cara a desatar.
  desatado: {
    equipo: null,
    frente: true,
    swap: 20,
    miembros: [
      { rol: 'operador', fwd: 1.7, lat: -0.7, gesto: 'desatar',  mira: 'fondo' }, // maestro: desata
      { rol: 'operador', fwd: 2.7, lat:  1.3, gesto: 'alumbrar', mira: 'fondo' }  // ayudante: alumbra
    ]
  }
};

const SPAWN_DIST   = 46;   // m: aparece la cuadrilla al acercarse (antes de entrar en cuadro)
const DESPAWN_DIST = 62;   // m: se retira al alejarse (histeresis para no titilar)

export class WorkCrewSystem {
  constructor({ world, bus, scene }) {
    this.scene = scene;
    this._boundsCheck = typeof world.boundsCheck === 'function' ? world.boundsCheck.bind(world) : null;
    this._blockedCheck = typeof world.blockedByProp === 'function' ? world.blockedByProp.bind(world) : null;
    this._physics = world.physics || null;

    this.playerPos = new THREE.Vector3();
    bus.on('player:moved', ({ position }) => this.playerPos.copy(position));

    // Descubre las labores con cuadrilla (una pasada al iniciar). No spawnea todavia.
    this.sites = [];
    for (const seg of world.segments || []) {
      if (seg.type !== 'room' || !seg._center) continue;
      const plan = CUADRILLAS[seg.roomType];
      if (!plan) continue;
      const equipo = plan.equipo ? seg.group.getObjectByName(plan.equipo) : null;
      if (plan.equipo && !equipo) continue;   // el equipo no se pudo crear → sin ancla
      this.sites.push({ seg, plan, equipo, center: seg._center, npcs: null });
    }
  }

  _spawn(site) {
    // Ancla + eje "hacia el centro" (siempre espacio abierto) + su perpendicular:
    //  · con equipo → ancla en el equipo.
    //  · frente:true → ancla en el FRENTE (pared del fondo, opuesta al acceso).
    //  · si no → ancla en el centro.
    const eq = new THREE.Vector3();
    const toCenter = new THREE.Vector3();
    if (site.equipo) {
      site.equipo.getWorldPosition(eq);
      toCenter.set(site.center.x - eq.x, 0, site.center.z - eq.z);
    } else if (site.plan.frente) {
      const back = new THREE.Vector3();
      for (const d of site.seg.openDirs || []) { back.x -= d.x; back.z -= d.z; }  // opuesto al acceso
      if (back.lengthSq() < 1e-3) back.set(0, 0, -1);
      back.normalize();
      const off = (site.seg.size || 12) * 0.34;
      eq.set(site.center.x + back.x * off, 0, site.center.z + back.z * off);      // punto del frente
      toCenter.set(-back.x, 0, -back.z);                                          // del frente hacia el centro
    } else {
      eq.set(site.center.x, 0, site.center.z);
      toCenter.set(0, 0, 1);
    }
    if (toCenter.lengthSq() < 1e-3) toCenter.set(0, 0, 1);
    toCenter.normalize();
    const side = new THREE.Vector3(toCenter.z, 0, -toCenter.x);

    // Punto del FRENTE (para la caída de roca del desatado).
    if (site.plan.frente) site._frentePt = eq.clone();

    // Presupuesto movil: media cuadrilla (los primeros miembros).
    const lista = Device.isTouch
      ? site.plan.miembros.slice(0, Math.ceil(site.plan.miembros.length / 2))
      : site.plan.miembros;

    site.npcs = [];
    for (const m of lista) {
      const pos = new THREE.Vector3();
      if (m.off) pos.set(site.center.x + m.off[0], m.off[1], site.center.z + m.off[2]);
      else pos.copy(eq).addScaledVector(toCenter, m.fwd).addScaledVector(side, m.lat);
      pos.y = 0;
      if (this._boundsCheck && !this._boundsCheck(pos)) continue;   // puesto fuera del galibo → omite

      // Punto que mira el trabajador.
      const focus = new THREE.Vector3();
      if (m.mira === 'equipo' && site.equipo) site.equipo.getWorldPosition(focus);
      else if (m.mira === 'boca') focus.copy(pos).addScaledVector(toCenter, 4);   // hacia el acceso
      else if (m.mira === 'fondo') focus.copy(eq);                                // hacia el frente (desate)
      else focus.set(site.center.x, 0, site.center.z);
      focus.y = 0;

      const npc = new NPC({
        role: m.rol,
        position: pos,
        behavior: 'trabajando',
        gesto: m.gesto,
        faceTarget: focus,
        epp: m.epp,
        boundsCheck: this._boundsCheck,
        blockedCheck: this._blockedCheck,
        physics: this._physics
      });
      this.scene.add(npc.object);
      site.npcs.push(npc);
    }
  }

  _despawn(site) {
    for (const npc of site.npcs) { npc.dispose?.(); this.scene.remove(npc.object); }
    site.npcs = null;
    if (site._rocks) { for (const r of site._rocks) this.scene.remove(r.mesh); site._rocks = null; }
  }

  /**
   * Caída de roca en el frente del desatado: cada pocos segundos una roca se desprende del techo
   * y cae al piso (lo que baja la cuadrilla al barretear). Pool de hasta 4 rocas RECICLADAS
   * (geometría/material compartidos); se retiran al despawnear la cuadrilla. md/PETS: "caída de rocas".
   */
  _tickRockfall(site, dt) {
    if (!site._frentePt) return;
    if (!site._rocks) { site._rocks = []; site._rockT = 1.5; }
    site._rockT -= dt;
    if (site._rockT <= 0) {
      site._rockT = 2.5 + Math.random() * 2.5;
      let r = site._rocks.find(x => x.settled);
      if (!r && site._rocks.length < 4) {
        const mesh = new THREE.Mesh(_rockGeometry(), MineMaterials.rocaMineralizada());
        mesh.castShadow = false;
        this.scene.add(mesh);
        r = { mesh }; site._rocks.push(r);
      }
      if (!r) r = site._rocks[0];   // recicla la más vieja si el pool está lleno
      const s = 0.5 + Math.random() * 0.8;
      r.mesh.scale.setScalar(s);
      r.mesh.position.set(
        site._frentePt.x + (Math.random() - 0.5) * 1.6,
        (site.seg.height || 4.6) * 0.78,
        site._frentePt.z + (Math.random() - 0.5) * 1.0
      );
      r.vy = 0; r.rest = 0.12 + Math.random() * 0.15; r.settled = false; r.mesh.visible = true;
    }
    for (const r of site._rocks) {
      if (r.settled) continue;
      r.vy += -16 * dt;
      r.mesh.position.y += r.vy * dt;
      r.mesh.rotation.x += dt * 3; r.mesh.rotation.z += dt * 2;
      if (r.mesh.position.y <= r.rest) {
        r.mesh.position.y = r.rest; r.vy *= -0.3;
        if (Math.abs(r.vy) < 0.4) r.settled = true;
      }
    }
  }

  update(dt) {
    if (!this.sites.length) return;
    for (const site of this.sites) {
      const d = site.center.distanceTo(this.playerPos);
      if (!site.npcs && d < SPAWN_DIST) this._spawn(site);
      else if (site.npcs && d > DESPAWN_DIST) this._despawn(site);
      if (site.npcs) {
        // Rotación de rol (maestro↔ayudante): intercambia el GESTO de los dos primeros cada
        // `swap` s (PETS: cambio cada 15 min por ergonomía, comprimido al tiempo de juego).
        if (site.plan.swap && site.npcs.length >= 2) {
          site._swapT = (site._swapT || 0) + dt;
          if (site._swapT >= site.plan.swap) {
            site._swapT = 0;
            const [a, b] = site.npcs;
            const ga = a.gesto, gb = b.gesto;
            setTarea(a.object, gb); a.gesto = gb;
            setTarea(b.object, ga); b.gesto = ga;
          }
        }
        if (site.plan.frente) this._tickRockfall(site, dt);   // caída de roca en el desatado
        for (const npc of site.npcs) npc.update(dt, this.playerPos);
      }
    }
  }
}
