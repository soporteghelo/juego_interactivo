import * as THREE from 'three';
import { GridLayoutGenerator } from './GridLayoutGenerator.js';
import { CsvIntersectionSegment } from './CsvIntersectionSegment.js';
import { TerminalLaborSegment } from './TerminalLaborSegment.js';
import { EdgeSegment } from './EdgeSegment.js';
import { HelicalRampSegment } from './HelicalRampSegment.js';
import { PropScatter } from '../../procedural/PropScatter.js';
import { buildSegmentColliders } from '../../physics/Colliders.js';
import { registerPropSolids } from '../../physics/PropSolids.js';
import { batchStaticMeshes } from '../../procedural/BatchStatics.js';
import { crearGuiaRefugio } from '../../elementos/senal/senal.js';
import { DIM, VEHICLE_LOOP, SPAWN_EDGE, SPAWN_NODE } from './MinePlan.js';
import { Perf } from '../../core/Perf.js';
import { crearCedente } from '../../utils/Ceder.js';

/**
 * GridAssembler — instancia la retICula del plano: un NodeSegment por interseccion y un
 * EdgeSegment por tunel, los posiciona/rota, construye sus colisionadores (rotados en las
 * aristas), dispersa props y recolecta interactuables/peligros. Ademas calcula el punto de
 * aparicion (sobre la via principal) y el circuito de vehiculos.
 */
export class GridAssembler {
  constructor({ scene, physics, lighting, rng, bus }) {
    this.scene = scene;
    this.physics = physics;
    this.lighting = lighting;
    this.rng = rng;
    this.bus = bus;
    this.scatter = new PropScatter(rng);
    this._batch = { fusionadas: 0, resultantes: 0 };
  }

  /**
   * Fusiona las piezas estaticas anonimas del tramo (ver `BatchStatics.js`): cada tablero,
   * baranda o equipo estacionado son decenas de cajas sueltas y cada una costaba su propia
   * llamada de dibujo. Nunca debe romper el juego, asi que si algo fallara se sigue con la
   * jerarquia original.
   */
  _fusionar(seg) {
    try {
      const r = Perf.acumula('  · fusion de estaticos', () => batchStaticMeshes(seg.group));
      this._batch.fusionadas += r.fusionadas;
      this._batch.resultantes += r.resultantes;
    } catch (e) {
      console.warn('[GridAssembler] fusion de estaticos omitida en un tramo:', e);
    }
  }

  async assemble(onProgress = () => {}) {
    const layout = new GridLayoutGenerator(this.rng).generate();
    const { nodes, edges, byId } = layout;

    const segments = [];
    const interactables = [];
    const hazards = [];

    const total = nodes.length + edges.length;
    let done = 0;

    // Cesion por PRESUPUESTO DE TIEMPO en vez de "cada 4 tramos": los tramos cuestan cosas muy
    // distintas (una interseccion con refugio vale por 20 tuneles cortos), asi que contar tramos
    // producia bloqueos de 300 ms —la pantalla de carga se veia congelada— alternados con
    // cesiones inutiles. Con presupuesto, ningun bloqueo pasa de ~12 ms y el progreso avanza fluido.
    const ceder = crearCedente(12, (hecho) => onProgress(hecho, total));

    // ── Nodos (intersecciones y salas) ────────────────────────────────────
    for (const node of nodes) {
      const openDirs = this._openDirs(node, byId);
      let seg;
      let height;
      if (node.kind === 'room') {
        // Ninguna labor terminal se abre como camara. La seccion del acceso que llega al nodo
        // continua sin ensancharse hasta un frente rocoso ciego; `node.size` pasa a ser solo la
        // longitud del ultimo tramo, no el ancho de una sala cuadrada.
        const access = node.edges.find(edge => edge.type === 'access') || node.edges[0];
        const width = access?.width ?? DIM.access.width;
        height = access?.height ?? DIM.access.height;
        seg = new TerminalLaborSegment({
          width,
          height,
          length: node.size,
          openDirs,
          roomType: node.room.type,
          label: node.room.label,
          lighting: this.lighting,
          rng: this.rng,
          wireframeStyle: Boolean(access?.wireframeStyle),
          // Misma caja que su acceso: la labor no cambia de roca al pasar la boca.
          variant: access?.variant || null
        });
      } else {
        height = this._nodeHeight(node);
        seg = new CsvIntersectionSegment({ size: node.size, height, openDirs, lighting: this.lighting, rng: this.rng });
        height = seg.height;
      }
      Perf.acumula('  · build() de nodos', () => seg.build());

      // NOTA: las CHIMENEAS DE ESCAPE (RB) con su jaula de escalines se retiraron del mapa a
      // peticion — quedaban plantadas en medio del cruce y estorbaban la circulacion. La
      // señaletica de VIA DE ESCAPE y las guias al refugio Dräger si se conservan.
      // El elemento sigue disponible en `src/elementos/ssoma/chimenea_escape.js` (visor).
      seg.group.position.set(node.x, node.y, node.z);
      this.scene.add(seg.group);
      seg.group.updateMatrixWorld(true);

      Perf.acumula('  · colisionadores', () => { seg.physicsColliders = buildSegmentColliders(this.physics, seg, seg.group.position); });
      // Props SOLIDOS de la sala (refugio Dräger, mobiliario): colision para jugador y NPC.
      Perf.acumula('  · props solidos', () => registerPropSolids(this.physics, seg));
      // Fusion de estaticos: SIEMPRE despues de colisionadores y solidos (esos leen la
      // jerarquia original de mallas).
      this._fusionar(seg);
      seg._center = new THREE.Vector3(node.x, node.y + height * 0.5, node.z);
      seg.nodeId = node.id;

      for (const it of seg.interactables) interactables.push(it);
      for (const hz of seg.hazards) hazards.push(hz);

      segments.push(seg);
      await ceder(++done, total);
    }

    // ── Aristas (tuneles) ─────────────────────────────────────────────────
    for (const edge of edges) {
      // RAMPA ESPIRAL: la arista con `helix` no es un tunel recto → se instancia como
      // HelicalRampSegment (malla curva) + sus SPANS rectos de colision/contencion.
      if (edge.helix) {
        done = await this._buildHelixEdge(edge, segments, { done, total, ceder });
        continue;
      }

      const seg = new EdgeSegment({ edge, rng: this.rng, lighting: this.lighting });
      Perf.acumula('  · build() de tuneles', () => seg.build());

      // Posicion + rotacion: la entrada (z=0 local) queda en el borde del nodo origen y el
      // tunel se extiende (por -Z local) hacia el nodo destino. `pitch` inclina las rampas
      // (orden YXZ: primero pitch sobre X, luego yaw sobre Y → -Z local apunta a la direccion 3D).
      seg.group.position.set(edge.pos.x, edge.pos.y, edge.pos.z);
      seg.group.rotation.set(edge.pitch || 0, edge.yaw, 0, 'YXZ');
      this.scene.add(seg.group);
      seg.group.updateMatrixWorld(true);

      // Props DESPUES de posicionar/rotar (los interactuables toman su transform de mundo).
      // flags.light = versión aligerada de props (menos malla/relleno) para la retICula.
      Perf.acumula('  · PropScatter', () => this.scatter.scatter(seg, { light: true }));
      Perf.acumula('  · updateMatrixWorld', () => seg.group.updateMatrixWorld(true));

      Perf.acumula('  · colisionadores', () => { seg.physicsColliders = buildSegmentColliders(this.physics, seg, seg.group.position); });
      // Props SOLIDOS del tunel (ventiladores, tableros, estaciones): colision para jugador/NPC.
      Perf.acumula('  · props solidos', () => registerPropSolids(this.physics, seg));
      this._fusionar(seg);

      for (const it of seg.interactables) interactables.push(it);
      for (const hz of seg.hazards) hazards.push(hz);

      // Centro del tramo (mitad de su longitud a lo largo de -Z local, ya rotado).
      const mid = new THREE.Vector3(0, edge.height * 0.5, -edge.length / 2)
        .applyMatrix4(seg.group.matrixWorld);
      seg._center = mid;

      segments.push(seg);
      await ceder(++done, total);
    }

    // Señalizacion de EVACUACION: guias al refugio Dräger mas cercano en cada interseccion.
    Perf.acumula('  · señalizacion de evacuacion', () => this._placeRefugeWayfinding(layout, segments));

    onProgress(total, total);

    if (this._batch.fusionadas) {
      console.info(`[Mina] Estaticos fusionados: ${this._batch.fusionadas} piezas → ${this._batch.resultantes} mallas`);
    }

    const spawnPoint = this._spawn(byId, edges);
    const vehicleRoutes = this._vehicleRoutes(byId);

    return { segments, interactables, hazards, spawnPoint, vehicleRoutes };
  }

  /**
   * Instancia una RAMPA ESPIRAL: la malla curva (visual) como UN segmento, y sus SPANS rectos
   * cortos como pseudo-tramos independientes (colision + contencion + piso para conducir). El
   * visual lleva `skipBounds` (no aporta caja de contencion); los spans si.
   */
  async _buildHelixEdge(edge, segments, { done, total, ceder }) {
    const ramp = new HelicalRampSegment({
      helix: edge.helix,
      dim: { width: edge.width, height: edge.height },
      lighting: this.lighting,
      rng: this.rng,
      variant: edge.variant || null
    });
    ramp.build();
    this.scene.add(ramp.group);                 // ya trae su transform en group.position
    ramp.group.updateMatrixWorld(true);
    segments.push(ramp);

    for (const span of ramp.spans) {
      span.physicsColliders = buildSegmentColliders(this.physics, span, span.group.position);
      segments.push(span);
    }

    await ceder(++done, total);
    return done;
  }

  /**
   * Coloca letreros-guia hacia el REFUGIO Dräger mas cercano en cada interseccion. Calcula la
   * distancia de cada nodo a los refugios con Dijkstra (multi-fuente, pesos = longitud de
   * arista) y cuelga la guia sobre la boca del tunel que conduce al refugio, con la distancia.
   */
  _placeRefugeWayfinding(layout, segments) {
    const { byId } = layout;
    const targets = layout.nodes
      .filter(n => n.kind === 'room' && n.room?.type === 'refugio')
      .map(n => n.id);
    if (!targets.length) return;

    // Dijkstra multi-fuente sobre el grafo (grafo pequeño → PQ por array basta).
    const dist = new Map();
    const pq = [];
    for (const t of targets) { dist.set(t, 0); pq.push({ id: t, d: 0 }); }
    while (pq.length) {
      pq.sort((a, b) => a.d - b.d);
      const { id, d } = pq.shift();
      if (d > (dist.get(id) ?? Infinity)) continue;
      const node = byId.get(id);
      for (const e of node.edges) {
        const otherId = e.a === id ? e.b : e.a;
        const nd = d + e.length;
        if (nd < (dist.get(otherId) ?? Infinity)) {
          dist.set(otherId, nd);
          pq.push({ id: otherId, d: nd });
        }
      }
    }

    const segById = new Map();
    for (const s of segments) if (s.nodeId) segById.set(s.nodeId, s);

    for (const node of layout.nodes) {
      if (node.kind === 'room') continue;           // no dentro de las salas de labor
      const seg = segById.get(node.id);
      if (!seg) continue;

      // Vecino que minimiza (peso + distancia_al_refugio): el siguiente salto hacia el refugio.
      let bestCost = Infinity, bestDir = null;
      for (const e of node.edges) {
        const otherId = e.a === node.id ? e.b : e.a;
        const dv = dist.get(otherId);
        if (dv == null) continue;
        const cost = e.length + dv;
        if (cost < bestCost) {
          bestCost = cost;
          // Boca del helicoide: usa su direccion explicita; el resto, linea recta al vecino.
          const override = node.id === e.a ? e.dirA : (node.id === e.b ? e.dirB : null);
          if (override) {
            bestDir = { x: override.x, z: override.z };
          } else {
            const other = byId.get(otherId);
            const dx = other.x - node.x, dz = other.z - node.z;
            const dh = Math.hypot(dx, dz) || 1;
            bestDir = { x: dx / dh, z: dz / dh };
          }
        }
      }
      if (!bestDir) continue;

      const H = seg.height;
      const off = node.size / 2 - 0.25;
      const guia = crearGuiaRefugio({ metros: bestCost });
      guia.scale.setScalar(1.6);
      guia.position.set(bestDir.x * off, Math.min(H - 1.0, H * 0.72), bestDir.z * off);
      // Cara del letrero mirando al centro del nodo (normal = -dir).
      guia.rotation.y = Math.atan2(-bestDir.x, -bestDir.z);
      seg.group.add(guia);
      seg.group.updateMatrixWorld(true);
    }
  }

  /** Direcciones unitarias (XZ) hacia los nodos vecinos: donde el nodo tiene boca abierta. */
  _openDirs(node, byId) {
    const dirs = [];
    for (const edge of node.edges) {
      // La rampa espiral NO sale en linea recta hacia el otro nodo → usa la direccion de boca
      // explicita del helicoide (dirA en el nodo `a`, dirB en el `b`); el resto, linea recta.
      const override = node.id === edge.a ? edge.dirA : (node.id === edge.b ? edge.dirB : null);
      let ux, uz;
      if (override) {
        ux = override.x; uz = override.z;
      } else {
        const otherId = edge.a === node.id ? edge.b : edge.a;
        const other = byId.get(otherId);
        const dx = other.x - node.x, dz = other.z - node.z;
        const d = Math.hypot(dx, dz) || 1;
        ux = dx / d; uz = dz / d;
      }
      // `width`/`height`/`archRatio` del tunel que llega: la interseccion los usa para construir
      // el COLLAR DE BOCA con la herradura EXACTA de esa via (sin ellos queda una rendija
      // abierta al vacio en la junta) y para sellar/acampanar la boca al ancho real.
      dirs.push({
        x: ux, z: uz,
        width: edge.width, height: edge.height,
        archRatio: edge.variant?.archRatio ?? 0.40
      });
    }
    return dirs;
  }

  /** Alto del nodo = mayor alto de los tuneles que llegan (para que los techos casen). */
  _nodeHeight(node) {
    let h = DIM.gallery.height;
    for (const edge of node.edges) h = Math.max(h, edge.height);
    return h;
  }

  /** Punto de aparición: dentro del acceso irregular a Frente 2 (lo que anuncia la pantalla de
   *  inicio "INICIO · FRENTE 2 · LABOR IRREGULAR"). Galeria recta aleatoria y nodo como respaldos. */
  _spawn(byId, edges) {
    // PRIMARIO: la labor demostrativa (Frente 2). El jugador arranca al 30% del recorrido desde la
    // boca — unos 12 m dentro de la labor larga, mirando hacia otros ~29 m de excavación irregular.
    // Usa el mismo transform YXZ que el ensamblador. Coincide con el rótulo de la pantalla de inicio.
    const labor = edges.find(edge => edge.id === SPAWN_EDGE && edge.wireframeStyle);
    if (labor) {
      const local = new THREE.Vector3(0, 1.4, -labor.length * 0.30);
      local.applyEuler(new THREE.Euler(labor.pitch || 0, labor.yaw, 0, 'YXZ'));
      return local.add(new THREE.Vector3(labor.pos.x, labor.pos.y, labor.pos.z));
    }

    // RESPALDO: una galeria recta cualquiera y un punto interior seguro. Las rampas helicoidales
    // se excluyen porque su trazado curvo no se puede muestrear como un tunel recto.
    const candidates = edges.filter(edge => !edge.helix && edge.length > 4 && edge.width > 1.8);
    if (candidates.length) {
      const edge = candidates[Math.floor(this.rng.next() * candidates.length)];
      const sideMargin = 0.8;
      const endMargin = 2;
      const halfWidth = Math.max(0, edge.width / 2 - sideMargin);
      const usableLength = Math.max(0, edge.length - endMargin * 2);
      const local = new THREE.Vector3(
        (this.rng.next() * 2 - 1) * halfWidth,
        1.4,
        -(endMargin + this.rng.next() * usableLength)
      );
      local.applyEuler(new THREE.Euler(edge.pitch || 0, edge.yaw, 0, 'YXZ'));
      return local.add(new THREE.Vector3(edge.pos.x, edge.pos.y, edge.pos.z));
    }

    // ÚLTIMO RECURSO: el centro del nodo de spawn.
    const n = byId.get(SPAWN_NODE) || byId.values().next().value;
    return new THREE.Vector3(n.x, 1.4, n.z);
  }

  /** Circuito cerrado de vehiculos: centros de los nodos del VEHICLE_LOOP (mundo). */
  _vehicleRoutes(byId) {
    const pts = [];
    for (const id of VEHICLE_LOOP) {
      const n = byId.get(id);
      if (n) pts.push(new THREE.Vector3(n.x, 0, n.z));
    }
    return pts.length >= 2 ? [pts] : [];
  }
}
