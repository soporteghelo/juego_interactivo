import * as THREE from 'three';
import { Settings } from '../core/Settings.js';
import { blockedByProp } from '../physics/PropSolids.js';

/**
 * WorldRuntime — logica COMPARTIDA por el mundo lineal (`World`) y el de retICula (`GridWorld`):
 *  - "pinneo" de luces: saca las luces de los grupos de tramo (que se ocultan por distancia) y
 *    las cuelga de un grupo persistente + un POOL fijo reasignado a las fuentes mas cercanas.
 *    Mantener el NUMERO de luces constante evita que Three.js recompile shaders al recorrer.
 *  - streaming por distancia: oculta tramos lejanos y anima solo los cercanos.
 *
 * Ambos mundos deben aportar: `this.scene`, `this.segments` (cada uno con `group`, `_center`,
 * `animated`), `this.lighting` y `this._playerPos`.
 */
export class WorldRuntime {
  /**
   * Saca TODAS las luces reales de los grupos de tramo y las cuelga de un grupo
   * persistente que nunca se oculta por distancia.
   *
   * Motivo (corrige el "lag" al recorrer): el culling por distancia oculta/muestra grupos de
   * tramo. Si dentro hay PointLight/SpotLight, ocultarlos cambia el NUMERO de luces activas y
   * Three.js RECOMPILA todos los shaders (y reconstruye shadow maps) — un tiron de varios
   * segundos en GPU integrada. Con las luces siempre presentes el conteo es constante.
   */
  _pinLights() {
    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'pinnedLights';
    this.scene.add(this.lightsGroup);

    // Asegura matrices de mundo antes de reparentar conservando la posicion global.
    this.scene.updateMatrixWorld(true);

    const lights = [];
    for (const seg of this.segments) {
      seg.group.traverse((o) => { if (o.isLight) lights.push(o); });
    }

    // Una luz es "pooleable" si es una fuente ambiental normal SIN sombra y NO es un
    // indicador/animada marcado como staticLight. Las de sombra (LED blanco de techo) y los
    // indicadores (estado de refugio) se mantienen FIJAS: sus sombras estan horneadas y sus
    // colores son informativos, no deben moverse.
    const poolable = [];
    const wp = new THREE.Vector3();
    for (const light of lights) {
      const esPool = Settings.lightPoolEnabled
        && !light.castShadow
        && !light.userData.staticLight
        && !light.userData.tick;
      if (esPool) {
        light.getWorldPosition(wp);
        poolable.push({
          x: wp.x, y: wp.y, z: wp.z,
          color: light.color.getHex(),
          intensity: light.intensity,
          distance: light.distance,
          decay: light.decay,
          _d2: Infinity
        });
      } else {
        // Fija: reparent conservando transform de mundo.
        this.lightsGroup.attach(light);
        light.userData.baseIntensity = light.intensity;
      }
    }

    // Quita de la escena las luces pooleables originales (las reemplaza el pool).
    if (Settings.lightPoolEnabled) {
      for (const light of lights) {
        if (!light.castShadow && !light.userData.staticLight && !light.userData.tick) {
          light.parent?.remove(light);
        }
      }
    }

    // Crea el POOL: un conjunto FIJO de PointLights que se reasignan a las fuentes mas
    // cercanas al jugador cada pocos frames. El conteo total de luces es constante -> no hay
    // recompilacion de shaders al recorrer, y solo N luces entran en el bucle por fragmento.
    this._lightSpecs = poolable;
    this._poolLights = [];
    if (Settings.lightPoolEnabled && poolable.length) {
      const poolSize = Math.min(Settings.current.lightPool ?? 12, poolable.length);
      for (let i = 0; i < poolSize; i++) {
        const pl = new THREE.PointLight(0xffffff, 0, 10, 2);
        pl.castShadow = false;
        this.lightsGroup.add(pl);
        this._poolLights.push(pl);
      }
      this._lightAccum = 0;
      this._assignPoolLights();
    }

    // Reacciona al control de luminosidad del jugador en tiempo real.
    Settings.onBrightness((v) => { this._applyBrightness(v); this._assignPoolLights(); });
    // Aplica la luminosidad inicial (por si el usuario ya la cambió antes de entrar).
    this._applyBrightness(Settings.brightness);

    // Congela las matrices de todo lo ESTATICO de los tramos (ver _freezeStatic).
    this._freezeStatic();

    // Reune las cajas de props SOLIDOS de todos los tramos (para la evasion de los NPC).
    this._collectPropBlocks();
  }

  /**
   * Junta las AABB de mundo de todos los props solidos (refugio, mobiliario) que PropSolids
   * registro por tramo. Los NPC consultan `blockedByProp` para no traspasarlos.
   */
  _collectPropBlocks() {
    this.propBlocks = [];
    this.refugeNiches = [];
    const p = new THREE.Vector3();
    for (const seg of this.segments) {
      if (seg.propBlocks) for (const b of seg.propBlocks) this.propBlocks.push(b);
      // Bocas de nicho peatonal en MUNDO: los NPC se resguardan DENTRO al pasar un equipo.
      if (seg.refugeNiches) {
        seg.group.updateMatrixWorld(true);
        for (const n of seg.refugeNiches) {
          p.set(n.x, 0.9, n.z).applyMatrix4(seg.group.matrixWorld);
          this.refugeNiches.push({ x: p.x, z: p.z });
        }
      }
    }
  }

  /** ¿La posicion cae dentro de algun prop solido? Usado por los NPC (evasion de mobiliario). */
  blockedByProp(pos, radius = 0.35) {
    return blockedByProp(this.propBlocks, pos, radius);
  }

  /**
   * Nicho de refugio peatonal mas cercano (distancia XZ) dentro de `maxDist`, o null. Lo usan
   * los NPC para meterse en el nicho cuando se acerca un equipo pesado.
   */
  nearestRefuge(pos, maxDist = 14) {
    const list = this.refugeNiches;
    if (!list || !list.length) return null;
    let best = null, bestD2 = maxDist * maxDist;
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const dx = n.x - pos.x, dz = n.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = n; }
    }
    return best;
  }

  /**
   * OPTIMIZACION CPU: pone `matrixAutoUpdate = false` en todos los objetos ESTATICOS de los
   * tramos. Three.js recompone la matriz local de CADA objeto en CADA frame durante
   * updateMatrixWorld; con miles de mallas estaticas (pernos, paneles, señales, roca) eso es
   * trabajo repetido para transformar objetos que nunca se mueven. Congelarlos elimina ese
   * coste por completo.
   *
   * EXENTOS (siguen animables): los subarboles con `userData.tick` (ventiladores, balizas,
   * semaforos) y los INTERACTUABLES (puertas de refugio) — cualquier cosa que pueda cambiar
   * su transform en runtime.
   */
  _freezeStatic() {
    for (const seg of this.segments) {
      // Reune las raices exentas: animados registrados + interactuables del tramo.
      const exempt = new Set();
      const markSubtree = (root) => { root?.traverse?.((o) => exempt.add(o)); };
      for (const a of seg.animated) markSubtree(a);
      for (const it of seg.interactables) markSubtree(it.object);

      seg.group.traverse((o) => {
        // Un tick descubierto en el propio traverse tambien exime su subarbol.
        if (o.userData?.tick) { markSubtree(o); return; }
        if (exempt.has(o)) return;
        o.updateMatrix();            // deja la matriz local al dia ANTES de congelar
        o.matrixAutoUpdate = false;
      });
    }
  }

  /**
   * Reasigna las luces del pool a las `_lightSpecs` mas cercanas al jugador. Constante en
   * numero de luces (no recompila); O(specs log specs) por el sort, con specs acotado.
   */
  _assignPoolLights() {
    const pool = this._poolLights;
    if (!pool || !pool.length || this._poolPaused) return;
    const specs = this._lightSpecs;
    const px = this._playerPos.x, py = this._playerPos.y, pz = this._playerPos.z;
    for (const s of specs) {
      const dx = s.x - px, dy = s.y - py, dz = s.z - pz;
      s._d2 = dx * dx + dy * dy + dz * dz;
    }
    specs.sort((a, b) => a._d2 - b._d2);
    const b = Settings.brightness;
    for (let i = 0; i < pool.length; i++) {
      const pl = pool[i];
      const s = specs[i];
      if (s) {
        pl.position.set(s.x, s.y, s.z);
        pl.color.setHex(s.color);
        pl.distance = s.distance;
        pl.decay = s.decay;
        pl.intensity = s.intensity * b;
      } else {
        pl.intensity = 0;
      }
    }
  }

  /** Escala la intensidad de las luces FIJAS sin tocar emissive/materials (el pool se escala aparte). */
  _applyBrightness(factor) {
    this.lightsGroup?.traverse((o) => {
      if (o.isLight && o.userData.baseIntensity !== undefined) {
        o.intensity = o.userData.baseIntensity * factor;
      }
    });
  }

  /**
   * Streaming ligero: oculta tramos lejanos y anima los elementos (ventiladores, balizas)
   * SOLO de los tramos visibles y cercanos (ahorro de CPU).
   */
  update(dt, elapsed) {
    const maxDist = Settings.current.drawDistance + 16;
    for (const seg of this.segments) {
      const d = seg._center.distanceTo(this._playerPos);
      const visible = d < maxDist;
      if (seg.group.visible !== visible) seg.group.visible = visible;

      if (visible && seg.animated.length) {
        for (const obj of seg.animated) obj.userData.tick?.(dt, elapsed);
      }
    }

    // Pool de luces: reasigna las luces reales a las fuentes mas cercanas ~cada 0.12 s.
    // No cada frame (el sort es innecesario a 60 Hz) y los cambios ocurren tras la niebla.
    if (this._poolLights && this._poolLights.length) {
      this._lightAccum += dt;
      if (this._lightAccum >= 0.12) {
        this._lightAccum = 0;
        this._assignPoolLights();
      }
    }
  }
}
