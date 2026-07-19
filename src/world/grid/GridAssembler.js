import * as THREE from 'three';
import { GridLayoutGenerator } from './GridLayoutGenerator.js';
import { NodeSegment } from './NodeSegment.js';
import { RoomSegment } from './RoomSegment.js';
import { EdgeSegment } from './EdgeSegment.js';
import { HelicalRampSegment } from './HelicalRampSegment.js';
import { PropScatter } from '../../procedural/PropScatter.js';
import { buildSegmentColliders } from '../../physics/Colliders.js';
import { registerPropSolids } from '../../physics/PropSolids.js';
import { crearGuiaRefugio } from '../../elementos/senal/senal.js';
import { crear as crearChimeneaEscape } from '../../elementos/ssoma/chimenea_escape.js';
import { DIM, VEHICLE_LOOP, SPAWN_NODE } from './MinePlan.js';

/** Alto de una sala de labor especial (m): holgado para un jumbo/scoop dentro. */
const ROOM_HEIGHT = 5.5;

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
  }

  async assemble(onProgress = () => {}) {
    const layout = new GridLayoutGenerator(this.rng).generate();
    const { nodes, edges, byId } = layout;

    const segments = [];
    const interactables = [];
    const hazards = [];

    const total = nodes.length + edges.length;
    let done = 0;

    // ── Nodos (intersecciones y salas) ────────────────────────────────────
    for (const node of nodes) {
      const openDirs = this._openDirs(node, byId);
      let seg;
      let height;
      if (node.kind === 'room') {
        height = ROOM_HEIGHT;
        seg = new RoomSegment({
          size: node.size, height, openDirs,
          roomType: node.room.type, label: node.room.label, lighting: this.lighting
        });
      } else {
        height = this._nodeHeight(node);
        seg = new NodeSegment({ size: node.size, height, openDirs, lighting: this.lighting, rng: this.rng });
      }
      seg.build();

      // ── CHIMENEAS DE ESCAPE (RB): segunda salida fisica, UNA POR NIVEL (D.S. 024-2016-EM
      // exige dos vias de salida independientes). c1_r1 = nivel principal; lower_entry = nivel
      // inferior (su RB sube al principal). En un rincon del cruce, fuera de los carriles.
      if (node.id === 'c1_r1' || node.id === 'lower_entry') {
        try {
          const ch = crearChimeneaEscape({ altura: height });
          const off = node.size / 2 - 2.4;
          ch.position.set(-off, 0, -off);
          ch.rotation.y = Math.atan2(off, off);   // la plataforma mira al centro del cruce
          seg.group.add(ch);
          if (ch.userData.interactable) seg.interactables.push(ch.userData.interactable);
        } catch { /* decorativo: nunca rompe el build */ }
      }
      seg.group.position.set(node.x, node.y, node.z);
      this.scene.add(seg.group);
      seg.group.updateMatrixWorld(true);

      seg.physicsColliders = buildSegmentColliders(this.physics, seg, seg.group.position);
      // Props SOLIDOS de la sala (refugio Dräger, mobiliario): colision para jugador y NPC.
      registerPropSolids(this.physics, seg);
      seg._center = new THREE.Vector3(node.x, node.y + height * 0.5, node.z);
      seg.nodeId = node.id;

      for (const it of seg.interactables) interactables.push(it);
      for (const hz of seg.hazards) hazards.push(hz);

      segments.push(seg);
      if (++done % 4 === 0) { onProgress(done, total); await new Promise(r => setTimeout(r, 0)); }
    }

    // ── Aristas (tuneles) ─────────────────────────────────────────────────
    for (const edge of edges) {
      // RAMPA ESPIRAL: la arista con `helix` no es un tunel recto → se instancia como
      // HelicalRampSegment (malla curva) + sus SPANS rectos de colision/contencion.
      if (edge.helix) {
        done = await this._buildHelixEdge(edge, segments, { done, total, onProgress });
        continue;
      }

      const seg = new EdgeSegment({ edge, rng: this.rng, lighting: this.lighting });
      seg.build();

      // Posicion + rotacion: la entrada (z=0 local) queda en el borde del nodo origen y el
      // tunel se extiende (por -Z local) hacia el nodo destino. `pitch` inclina las rampas
      // (orden YXZ: primero pitch sobre X, luego yaw sobre Y → -Z local apunta a la direccion 3D).
      seg.group.position.set(edge.pos.x, edge.pos.y, edge.pos.z);
      seg.group.rotation.set(edge.pitch || 0, edge.yaw, 0, 'YXZ');
      this.scene.add(seg.group);
      seg.group.updateMatrixWorld(true);

      // Props DESPUES de posicionar/rotar (los interactuables toman su transform de mundo).
      // flags.light = versión aligerada de props (menos malla/relleno) para la retICula.
      this.scatter.scatter(seg, { light: true });
      seg.group.updateMatrixWorld(true);

      seg.physicsColliders = buildSegmentColliders(this.physics, seg, seg.group.position);
      // Props SOLIDOS del tunel (ventiladores, tableros, estaciones): colision para jugador/NPC.
      registerPropSolids(this.physics, seg);

      for (const it of seg.interactables) interactables.push(it);
      for (const hz of seg.hazards) hazards.push(hz);

      // Centro del tramo (mitad de su longitud a lo largo de -Z local, ya rotado).
      const mid = new THREE.Vector3(0, edge.height * 0.5, -edge.length / 2)
        .applyMatrix4(seg.group.matrixWorld);
      seg._center = mid;

      segments.push(seg);
      if (++done % 4 === 0) { onProgress(done, total); await new Promise(r => setTimeout(r, 0)); }
    }

    // Señalizacion de EVACUACION: guias al refugio Dräger mas cercano en cada interseccion.
    this._placeRefugeWayfinding(layout, segments);

    onProgress(total, total);

    const spawnPoint = this._spawn(byId);
    const vehicleRoutes = this._vehicleRoutes(byId);

    return { segments, interactables, hazards, spawnPoint, vehicleRoutes };
  }

  /**
   * Instancia una RAMPA ESPIRAL: la malla curva (visual) como UN segmento, y sus SPANS rectos
   * cortos como pseudo-tramos independientes (colision + contencion + piso para conducir). El
   * visual lleva `skipBounds` (no aporta caja de contencion); los spans si.
   */
  async _buildHelixEdge(edge, segments, { done, total, onProgress }) {
    const ramp = new HelicalRampSegment({
      helix: edge.helix,
      dim: { width: edge.width, height: edge.height },
      lighting: this.lighting,
      rng: this.rng
    });
    ramp.build();
    this.scene.add(ramp.group);                 // ya trae su transform en group.position
    ramp.group.updateMatrixWorld(true);
    segments.push(ramp);

    for (const span of ramp.spans) {
      span.physicsColliders = buildSegmentColliders(this.physics, span, span.group.position);
      segments.push(span);
    }

    if ((done += 1) % 4 === 0) { onProgress(done, total); await new Promise(r => setTimeout(r, 0)); }
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
      // `width`/`height` del tunel que llega: NodeSegment/RoomSegment los usan para sellar
      // y acampanar la boca (jambas de RockDetail) al ancho REAL de la via.
      dirs.push({ x: ux, z: uz, width: edge.width, height: edge.height });
    }
    return dirs;
  }

  /** Alto del nodo = mayor alto de los tuneles que llegan (para que los techos casen). */
  _nodeHeight(node) {
    let h = DIM.gallery.height;
    for (const edge of node.edges) h = Math.max(h, edge.height);
    return h;
  }

  /** Punto de aparicion: dentro del nodo de spawn (extremo sur de la via principal). */
  _spawn(byId) {
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
