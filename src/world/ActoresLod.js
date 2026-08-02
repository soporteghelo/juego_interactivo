import * as THREE from 'three';
import { Settings } from '../core/Settings.js';

/**
 * ACTORES PESADOS — nivel de detalle por distancia para EQUIPOS APARCADOS y PERSONAS.
 *
 * Son los dos objetos más caros de la mina y los únicos que no pasan por el streaming de tramos
 * ni por la fusión de estáticos. Medido en el juego cargado con preset móvil:
 *
 *   · 11 personas visibles = 590.136 triángulos — el 90 % del frame. Cada minero FBX son
 *     49.112 triángulos, y los que llevan el EPP procedural gastan además 60-65 draw calls.
 *   · un scoop aparcado son 314 mallas y una camioneta 348, todas fuera del alcance de
 *     `BatchStatics` porque la máquina lleva `tick`/`interactable`/`hazard` en su raíz.
 *
 * Y sobraba de largo: con `fogFar` en 17-22 m se estaban dibujando personas a 34 m y un scoop
 * a 135 m — geometría entera para pintar píxeles que la niebla negra ya había puesto en negro.
 *
 * TRES ESTADOS, con histéresis para que nada parpadee en el umbral:
 *
 *   CERCA  (< `cerca`)          jerarquía completa y animada. Es cuando el jugador inspecciona
 *                               la máquina o se cruza con la cuadrilla: no se toca nada.
 *   MEDIA  (`cerca`..`lejos`)   equipos → CARCASA FUSIONADA (pocas mallas, sin animación);
 *                               personas → se retira el EPP procedural y se deja el cuerpo.
 *   LEJOS  (> `lejos`)          oculto por completo. `lejos` sale de `drawDistance` del preset,
 *                               que es justo donde la niebla ya lo había tapado.
 *
 * En MEDIA y LEJOS se marca `userData._lodEstado`, que los dueños de la animación (NPC,
 * WorkCrewSystem) consultan para SALTARSE el mixer: un esqueleto que nadie ve no necesita que
 * le recalculen los huesos en CPU cada frame.
 */

// Distancia a la que un equipo deja de inspeccionarse de cerca. Por debajo de esto el jugador
// puede leer el código interno y ver la hidráulica, así que manda la jerarquía real.
const CERCA_EQUIPO = 12;
// Las personas se sustituyen antes: el EPP son piezas de centímetros que a 9 m ya no se leen.
const CERCA_PERSONA = 9;
// Margen de histéresis (m): el umbral de salida es mayor que el de entrada.
const MARGEN = 2.0;
// Cada cuánto se reevalúan las distancias. Un actor no cambia de estado en 150 ms andando.
const PERIODO = 1 / 6;

/** Raíces de equipo trackless que se aparcan en las labores (nombre del grupo que crea cada factoría). */
const EQUIPOS = new Set([
  'scoop', 'jumbo', 'raptor', 'empernador', 'desatador', 'shotcretera',
  'mixer', 'camion', 'camioneta', 'telehandler'
]);

export class ActoresLod {
  /**
   * @param {{ bus?:object, construirCarcasa?:Function }} opts
   *   `construirCarcasa` se inyecta para no acoplar este sistema al fusionador (y poder
   *   probarlo sin three-mesh-bvh ni WebGL).
   */
  constructor({ bus = null, construirCarcasa = null } = {}) {
    this.construirCarcasa = construirCarcasa;
    this._actores = [];
    this._playerPos = new THREE.Vector3();
    this._t = 0;
    this._tmp = new THREE.Vector3();
    bus?.on?.('player:moved', ({ position }) => this._playerPos.copy(position));
  }

  /**
   * Registra un EQUIPO aparcado. La carcasa NO se construye aquí: se hace la primera vez que
   * el equipo entra en MEDIA, para que su pose de reposo ya sea la definitiva.
   */
  registrarEquipo(raiz) {
    if (!raiz || raiz.userData._lodRegistrado) return;
    raiz.userData._lodRegistrado = true;
    this._actores.push({ tipo: 'equipo', raiz, carcasa: null, intentoCarcasa: false, estado: 'cerca' });
  }

  /**
   * Registra una PERSONA. `gear` son las mallas de EPP procedural que se retiran a media
   * distancia; si no se pasan, se deducen (todo lo que no es parte del cuerpo animado).
   */
  registrarPersona(raiz, { gear = null } = {}) {
    if (!raiz || raiz.userData._lodRegistrado) return;
    raiz.userData._lodRegistrado = true;
    this._actores.push({
      tipo: 'persona', raiz, estado: 'cerca',
      gear: gear || this._deducirGear(raiz)
    });
  }

  /**
   * Busca los EQUIPOS APARCADOS en los tramos del mundo y los registra. Los equipos que
   * CIRCULAN los gestiona `VehicleSystem`, que ya tiene su propio culling por distancia: se
   * reconocen porque cuelgan de la escena y no de un tramo, así que aquí no aparecen.
   */
  registrarEquiposDeMundo(segments = []) {
    let n = 0;
    for (const seg of segments) {
      if (!seg?.group) continue;
      seg.group.traverse(o => {
        if (EQUIPOS.has(o.name) && !o.userData._lodRegistrado) { this.registrarEquipo(o); n++; }
      });
    }
    return n;
  }

  /** Quita un actor (la persona murió, el equipo se despawnea). */
  olvidar(raiz) {
    const i = this._actores.findIndex(a => a.raiz === raiz);
    if (i < 0) return;
    const a = this._actores[i];
    if (a.carcasa) a.carcasa.removeFromParent();
    if (a.raiz) a.raiz.userData._lodRegistrado = false;
    this._actores.splice(i, 1);
  }

  /** EPP procedural = mallas propias que NO forman parte del cuerpo con esqueleto. */
  _deducirGear(raiz) {
    const gear = [];
    raiz.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      // Si cuelga de un hueso, se mueve con el cuerpo y es parte de la silueta: se conserva.
      for (let p = o.parent; p && p !== raiz; p = p.parent) if (p.isBone) return;
      gear.push(o);
    });
    return gear;
  }

  /**
   * Umbral LEJOS: donde el actor ya es invisible de verdad.
   *
   * Manda `fogFar`, no `drawDistance`. La niebla es `THREE.Fog` LINEAL y del MISMO negro que el
   * fondo (SceneManager.js), así que a `fogFar` el objeto es negro puro sobre negro puro:
   * ocultarlo ahí no quita absolutamente nada de la imagen. Usar `drawDistance` (36 m en móvil
   * frente a 22 m de `fogFar`) dejaba a las personas dibujándose 14 m más allá de donde se las
   * podía ver — y cada minero FBX son 49.112 triángulos.
   *
   * El 1.08 es el margen para que un actor justo en el límite no se note al aparecer.
   */
  get _lejos() {
    const q = Settings.current;
    return Math.min(q.drawDistance, q.fogFar * 1.08);
  }

  update(dt) {
    if (!this._actores.length) return;
    this._t += dt;
    if (this._t < PERIODO) return;
    this._t = 0;

    const lejos = this._lejos;
    for (const a of this._actores) {
      if (!a.raiz.parent && a.estado !== 'lejos') continue;   // ya lo soltó el streaming
      a.raiz.getWorldPosition(this._tmp);
      const d = this._tmp.distanceTo(this._playerPos);
      const cerca = a.tipo === 'equipo' ? CERCA_EQUIPO : CERCA_PERSONA;

      // Histéresis: para SALIR de un estado hay que superar el umbral por `MARGEN`.
      let nuevo = a.estado;
      if (a.estado === 'cerca')      nuevo = d > cerca + MARGEN ? (d > lejos + MARGEN ? 'lejos' : 'media') : 'cerca';
      else if (a.estado === 'media') nuevo = d < cerca ? 'cerca' : (d > lejos + MARGEN ? 'lejos' : 'media');
      else                           nuevo = d < lejos ? (d < cerca ? 'cerca' : 'media') : 'lejos';

      if (nuevo !== a.estado) this._aplicar(a, nuevo);
    }
  }

  _aplicar(a, estado) {
    a.estado = estado;
    a.raiz.userData._lodEstado = estado;
    if (a.tipo === 'equipo') this._aplicarEquipo(a, estado);
    else this._aplicarPersona(a, estado);
  }

  _aplicarEquipo(a, estado) {
    if (estado === 'cerca') {
      a.raiz.visible = true;
      if (a.carcasa) a.carcasa.visible = false;
      return;
    }
    if (estado === 'lejos') {
      a.raiz.visible = false;
      if (a.carcasa) a.carcasa.visible = false;
      return;
    }
    // MEDIA: se intenta la carcasa una sola vez. Si no se pudo construir, se deja la
    // jerarquía visible — es mejor gastar draw calls que hacer desaparecer un equipo.
    if (!a.carcasa && !a.intentoCarcasa) {
      a.intentoCarcasa = true;
      try {
        const c = this.construirCarcasa?.(a.raiz);
        if (c) {
          c.visible = false;
          a.raiz.parent?.add(c);
          // La geometría viene horneada en el espacio LOCAL del equipo, así que la carcasa tiene
          // que llevar el mismo transform que él dentro del padre común.
          c.position.copy(a.raiz.position);
          c.quaternion.copy(a.raiz.quaternion);
          c.scale.copy(a.raiz.scale);
          // OJO: la carcasa lleva `matrixAutoUpdate = false` (nunca se mueve, y así Three no
          // recompone su matriz cada frame). Con esa bandera `updateMatrixWorld` NO recompone la
          // matriz local desde position/quaternion/scale: hay que pedirlo a mano. Sin este
          // `updateMatrix()` la carcasa se quedaba en el origen del tramo — medido, entre 1.7 y
          // 4.4 m fuera de sitio según la máquina.
          c.updateMatrix();
          c.updateMatrixWorld(true);
          a.carcasa = c;
        }
      } catch { /* sin carcasa: se sigue con la jerarquía completa */ }
    }
    if (a.carcasa) {
      a.carcasa.visible = true;
      a.raiz.visible = false;
    } else {
      a.raiz.visible = true;
    }
  }

  _aplicarPersona(a, estado) {
    if (estado === 'lejos') { a.raiz.visible = false; return; }
    a.raiz.visible = true;
    // A media distancia se retira el EPP procedural: son las piezas que más draw calls cuestan
    // y las primeras que dejan de leerse.
    const conGear = estado === 'cerca';
    for (const m of a.gear) m.visible = conGear;
  }

  /** ¿Debe animarse este actor? Lo consultan NPC/WorkCrew antes de tocar su mixer. */
  static debeAnimar(raiz) {
    return raiz?.userData?._lodEstado !== 'lejos';
  }

  /** Censo para depuración y para el test de presupuesto. */
  censo() {
    const c = { cerca: 0, media: 0, lejos: 0, equipos: 0, personas: 0, carcasas: 0 };
    for (const a of this._actores) {
      c[a.estado]++;
      if (a.tipo === 'equipo') { c.equipos++; if (a.carcasa) c.carcasas++; }
      else c.personas++;
    }
    return c;
  }
}
