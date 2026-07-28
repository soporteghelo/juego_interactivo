import {
  ROWS, COLS, SPACING_X, SPACING_Z, LEVEL_DROP, DIM, NODE_SIZE, ROOM_SIZE, SPUR_DIST,
  HOLES, DECLINES, SPURS, VARIETY, ANCHO_MINIMO_LABOR, ANCHO_PASO_INTERSECCION
} from './MinePlan.js';

/** Vectores de direccion cardinal en el plano XZ (N=+Z norte, S=-Z, E=+X, W=-X). */
const DIRS = { N: { x: 0, z: 1 }, S: { x: 0, z: -1 }, E: { x: 1, z: 0 }, W: { x: -1, z: 0 } };

/**
 * GridLayoutGenerator — convierte la TOPOLOGIA de `MinePlan` en geometria de retICula en 3D:
 * nodos (intersecciones / salas) y aristas (galerias, cruceros, via principal, RAMPA ESPIRAL y
 * accesos), en COORDENADAS DE MUNDO, listos para que el GridAssembler los instancie.
 *
 * Con una semilla (`rng`) el trazado VARIA de forma reproducible (Item 3 — mapa mas variado):
 * pilares extra, seccion jitter por labor y que galerias reciben LED verde.
 */
export class GridLayoutGenerator {
  /** @param {import('../../procedural/Rng.js').Rng} [rng] semilla; sin ella el trazado es el fijo. */
  constructor(rng = null) {
    this.rng = rng;
  }

  generate() {
    const nCols = COLS.length;
    const nRows = ROWS.length;

    // Offsets para centrar el nivel principal en el origen.
    this._offX = -((nCols - 1) * SPACING_X) / 2;
    this._offZ = ((nRows - 1) * SPACING_Z) / 2;

    this.byId = new Map();
    this.nodes = [];
    this.edges = [];

    // Variedad por semilla (Item 3): resuelta ANTES de crear nodos/aristas.
    const holes = this._resolveHoles();
    const mainRows = this._resolveMainRows();

    // ── Nodos del nivel principal (level 0) ────────────────────────────────
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const id = `c${c}_r${r}`;
        if (holes.has(id)) continue;
        this._addNode({ id, col: c, row: r, level: 0, size: NODE_SIZE });
      }
    }

    // ── Aristas del nivel principal ────────────────────────────────────────
    const nodeId = (c, r) => `c${c}_r${r}`;
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols - 1; c++) {
        const a = nodeId(c, r), b = nodeId(c + 1, r);
        if (this.byId.has(a) && this.byId.has(b)) {
          this._makeEdge(a, b, { type: 'gallery', label: ROWS[r].label, main: mainRows.has(r) });
        }
      }
    }
    for (let c = 0; c < nCols; c++) {
      const type = COLS[c].type === 'mainRoad' ? 'mainRoad' : 'crucero';
      for (let r = 0; r < nRows - 1; r++) {
        const a = nodeId(c, r), b = nodeId(c, r + 1);
        if (this.byId.has(a) && this.byId.has(b)) {
          this._makeEdge(a, b, { type, label: COLS[c].label, main: false });
        }
      }
    }

    // ── RAMPAS ESPIRALES + niveles inferiores (una o varias bajadas) ───────
    // Se construyen EN ORDEN: cada helice arranca de un nodo del nivel anterior (que ya existe),
    // luego cuelga su sub-grid. Asi la 2ª rampa puede salir del nivel 1 hacia el nivel 2.
    for (const d of DECLINES) {
      this._buildHelix(d.helix);
      this._buildLower(d.lower);
    }

    // ── Labores especiales en fondo de saco (spurs) ────────────────────────
    for (const sp of SPURS) {
      const parent = this.byId.get(sp.from);
      if (!parent) continue;
      const d = DIRS[sp.dir];
      const roomId = `spur_${sp.type}_${sp.from}`;
      const spurDistance = sp.distance ?? SPUR_DIST;
      this._addNode({
        id: roomId,
        // coloca la sala a SPUR_DIST del padre en la direccion pedida (mismo nivel).
        x: parent.x + d.x * spurDistance,
        z: parent.z + d.z * spurDistance, // N (d.z=+1) => hacia +Z (norte)
        y: parent.y,
        size: ROOM_SIZE, kind: 'room', room: { type: sp.type, label: sp.label }
      });
      // Los accesos a labores activas usan la sección facetada/irregular del wireframe de
      // referencia. Refugios, talleres y servicios conservan una excavación más regular.
      const wireframeStyle = sp.wireframeStyle ?? ['frente', 'sostenimiento', 'desatado', 'disparado', 'camara', 'shotcrete'].includes(sp.type);
      this._makeEdge(sp.from, roomId, { type: 'access', label: sp.label, main: false, wireframeStyle });
    }

    this._validateComplete();
    return { nodes: this.nodes, edges: this.edges, byId: this.byId };
  }

  // ── VARIEDAD POR SEMILLA (Item 3) ──────────────────────────────────────────

  /** HOLES fijos + un subconjunto EXTRA (interior, no critico) elegido por semilla. */
  _resolveHoles() {
    const s = new Set(HOLES);
    if (!this.rng) return s;
    const pool = VARIETY.holeCandidates.filter(id => !s.has(id));
    const k = this.rng.int(0, VARIETY.extraHolesMax);
    for (let i = 0; i < k && pool.length; i++) {
      s.add(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
    }
    return s;
  }

  /** Conjunto de indices de fila (galeria) que reciben LED verde neon; sorteado por semilla. */
  _resolveMainRows() {
    const set = new Set();
    if (!this.rng) { ROWS.forEach((r, i) => { if (r.main) set.add(i); }); return set; }
    const n = this.rng.int(VARIETY.mainRowsMin, Math.min(VARIETY.mainRowsMax, ROWS.length));
    const idx = ROWS.map((_, i) => i);
    for (let i = 0; i < n && idx.length; i++) {
      set.add(idx.splice(this.rng.int(0, idx.length - 1), 1)[0]);
    }
    return set;
  }

  /**
   * VARIANTE DE CAJA de una labor: lo que hace que recorrer la mina NO se sienta repetido.
   * Cada arista saca de la semilla su tipo de roca (rampa de color de la carcasa), la forma de
   * la herradura, cuanto shotcrete lleva, como esta labrada la cuneta, cuanta roca suelta hay y
   * que tan irregular/desatable quedo la corona. Todo es determinista por semilla.
   */
  _sectionVariant(type) {
    if (!this.rng) {
      return {
        rockType: 'caliza', archRatio: 0.40, shotcrete: type === 'crucero',
        cuneta: 'ambas', debris: 1, crownRough: 0.5, sueltas: 0.35
      };
    }
    const rockTypes = VARIETY.rockTypes;
    const cunetaModes = VARIETY.cunetaModes;
    return {
      // Tipo de roca de la caja (color por vertice de la carcasa).
      rockType: rockTypes[this.rng.int(0, rockTypes.length - 1)],
      // Forma de la herradura: de casi rectangular (0.30) a arco de medio punto (0.52).
      archRatio: +(0.30 + this.rng.next() * 0.22).toFixed(3),
      // Sostenimiento: unas labores en roca expuesta, otras revestidas con shotcrete.
      shotcrete: this.rng.next() < (VARIETY.shotcreteChance[type] ?? 0.4),
      // Cuneta labrada: a ambos lados, a uno solo, o labor sin cuneta (drenaje por el piso).
      cuneta: cunetaModes[this.rng.int(0, cunetaModes.length - 1)],
      // Cuanta roca suelta / escombro hay tirado (0.4 = limpia, 2.0 = sin limpiar tras el disparo).
      debris: +(0.4 + this.rng.next() * 1.6).toFixed(2),
      // Rugosidad de la CORONA (sobre-excavacion del techo): 0 = perfilada, 1 = muy quebrada.
      crownRough: +this.rng.next().toFixed(3),
      // Probabilidad de que la labor tenga roca/shotcrete a punto de desprenderse en la corona.
      sueltas: +this.rng.next().toFixed(3)
    };
  }

  // ── RAMPA ESPIRAL ──────────────────────────────────────────────────────────

  /**
   * Construye la RAMPA HELICOIDAL desde `RAMP_HELIX.from`: calcula el eje del helicoide para que
   * el anillo de ENTRADA coincida con la boca del nodo origen, crea el nodo de LLEGADA justo en
   * la salida del helicoide (nivel inferior), y añade una arista de grafo con los parametros del
   * helicoide (`edge.helix`) que el GridAssembler instancia como `HelicalRampSegment`.
   */
  _buildHelix(H) {
    const from = this.byId.get(H.from);
    if (!from) return;

    const dir = DIRS[H.entryDir] || DIRS.N;                       // heading de entrada (horizontal)
    const boca = { x: from.x + dir.x * (from.size / 2), z: from.z + dir.z * (from.size / 2) };
    const total = H.turnDir * H.turns * 2 * Math.PI;

    // startAngle t.q. la tangente horizontal de entrada = `dir`:
    //   tangente(θ) = turnDir·(-sinθ, cosθ)  ⇒  sinθ = -dir.x·turnDir, cosθ = dir.z·turnDir
    const startAngle = Math.atan2(-dir.x * H.turnDir, dir.z * H.turnDir);
    // Eje del helicoide: el anillo de entrada (radio, startAngle) debe caer en la boca.
    const ax = boca.x - H.radius * Math.cos(startAngle);
    const az = boca.z - H.radius * Math.sin(startAngle);

    // Salida del helicoide (nivel inferior).
    const endAngle = startAngle + total;
    const ex = ax + H.radius * Math.cos(endAngle);
    const ez = az + H.radius * Math.sin(endAngle);
    const ey = from.y - H.drop;

    // Tangente horizontal de salida (unitaria): el tunel llega al nodo moviendose en +tEnd,
    // asi que la boca del nodo mira hacia -tEnd (de vuelta al helicoide).
    let tx = H.turnDir * -Math.sin(endAngle);
    let tz = H.turnDir * Math.cos(endAngle);
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;

    // Nodo de llegada: su boca (cara -tEnd) queda en la salida ⇒ centro = salida + tEnd·(size/2).
    const toNode = this._addNode({
      id: H.toNode,
      x: ex + tx * (NODE_SIZE / 2), y: ey, z: ez + tz * (NODE_SIZE / 2),
      level: H.toLevel, size: NODE_SIZE
    });

    const arc = Math.abs(total) * H.radius;
    const length = Math.hypot(arc, H.drop);          // longitud 3D (para Dijkstra/wayfinding)
    const dimR = DIM.ramp;
    const edge = {
      id: `edge_helix_${H.from}_${H.toNode}`,
      type: 'ramp', label: H.label, main: false,
      width: dimR.width, height: dimR.height, length,
      a: H.from, b: H.toNode,
      // El helicoide no arranca en linea recta hacia el otro nodo → dirs de boca explicitas.
      dirA: { x: dir.x, z: dir.z },
      dirB: { x: -tx, z: -tz },
      variant: this._sectionVariant('ramp'),
      helix: {
        axis: { x: ax, z: az }, topY: from.y,
        radius: H.radius, startAngle, totalAngle: total, drop: H.drop, label: H.label
      }
    };
    from.edges.push(edge);
    toNode.edges.push(edge);
    this.edges.push(edge);
  }

  /** Nivel inferior: nodos por offset (dx,dz) desde el nodo de llegada + sus aristas. */
  _buildLower(LOWER) {
    const entry = this.byId.get(LOWER.entry);
    if (!entry) return;
    for (const n of LOWER.nodes) {
      if (n.id === LOWER.entry) continue;             // ya creado por el helicoide
      this._addNode({
        id: n.id, x: entry.x + n.dx, y: entry.y, z: entry.z + n.dz,
        level: LOWER.level, size: NODE_SIZE
      });
    }
    for (const [a, b, type, label] of LOWER.edges) {
      if (this.byId.has(a) && this.byId.has(b)) this._makeEdge(a, b, { type, label, main: false });
    }
  }

  /**
   * FUERZA que la mina generada este COMPLETA: galerias, cruceros, via principal, rampa a
   * otro nivel, accesos y labores especiales. `MinePlan.js` es data autorada — si una
   * edicion la deja incompleta, fallamos AQUI con un mensaje claro en vez de cargar una
   * mina a medias.
   */
  _validateComplete() {
    const tipos = new Set(this.edges.map(e => e.type));
    const faltan = ['gallery', 'crucero', 'mainRoad', 'ramp', 'access']
      .filter(t => !tipos.has(t));
    if (!this.nodes.some(n => n.kind === 'room')) faltan.push('salas de labores (rooms)');
    if (!this.nodes.some(n => n.level > 0)) faltan.push('nivel inferior');
    if (!this.edges.some(e => e.helix)) faltan.push('rampa espiral');
    if (faltan.length) {
      throw new Error(`[MinePlan] Mina INCOMPLETA — faltan: ${faltan.join(', ')}. Revisa src/world/grid/MinePlan.js`);
    }
  }

  /** Añade un nodo. Acepta col/row (coordenadas de lattice) o x/z/y explicitos. */
  _addNode({ id, col, row, level = 0, x, y, z, size, kind = 'node', room = null }) {
    const px = x !== undefined ? x : this._offX + col * SPACING_X;
    const pz = z !== undefined ? z : this._offZ - row * SPACING_Z;
    const py = y !== undefined ? y : -level * LEVEL_DROP;
    const node = { id, col, row, level, x: px, y: py, z: pz, size, kind, room, edges: [] };
    this.byId.set(id, node);
    this.nodes.push(node);
    return node;
  }

  /** Construye una arista entre dos nodos (soporta desnivel → rampa inclinada). */
  _makeEdge(aId, bId, { type, label, main, wireframeStyle = false }) {
    const a = this.byId.get(aId);
    const b = this.byId.get(bId);

    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const dh = Math.hypot(dx, dz) || 1;       // distancia horizontal
    const gap = a.size / 2 + b.size / 2;
    const hrun = Math.max(2, dh - gap);        // recorrido horizontal entre bocas de nodo
    const length = Math.hypot(hrun, dy);       // longitud 3D del tunel (incluye pendiente)

    // Direccion HORIZONTAL unitaria y heading.
    const hx = dx / dh, hz = dz / dh;
    const yaw = Math.atan2(-dx, -dz);          // rotacion Y (heading horizontal)
    const pitch = Math.atan2(dy, hrun);        // inclinacion sobre el recorrido; 0 en planos

    // Entrada del tramo: en la BOCA del nodo A, a la cota del PISO del nodo (y = a.y). El tunel
    // desciende/asciende `dy` sobre `hrun` hasta llegar a la boca del nodo B (y = b.y).
    const pos = { x: a.x + hx * (a.size / 2), y: a.y, z: a.z + hz * (a.size / 2) };

    // Seccion base + jitter por semilla (Item 3): galerias/cruceros varian ±sectionJitter.
    const dim = DIM[type] || DIM.gallery;
    let width = dim.width, height = dim.height;
    if (this.rng && VARIETY.sectionJitter && (type === 'gallery' || type === 'crucero')) {
      width  = +(width  * (1 + (this.rng.next() * 2 - 1) * VARIETY.sectionJitter)).toFixed(3);
      height = +(height * (1 + (this.rng.next() * 2 - 1) * VARIETY.sectionJitter)).toFixed(3);
      // ACOTA la seccion: el minimo garantiza que el peaton siga pasando por el costado del
      // scoop (ANCHO_MINIMO_LABOR) y el maximo iguala la BOCA del cruce (ANCHO_PASO_INTERSECCION):
      // por encima el tunel seria mas ancho que la interseccion y se veria un escalon en la union.
      width  = Math.max(ANCHO_MINIMO_LABOR, Math.min(ANCHO_PASO_INTERSECCION, width));
      // El alto tope es la corona de la interseccion CSV (5.4 m): el collar de boca la cubre.
      height = Math.max(4.4, Math.min(5.4, height));
    }

    const edge = {
      id: `edge_${aId}_${bId}`,
      type, label, main, wireframeStyle,
      width, height, length,
      pos, yaw, pitch,
      a: aId, b: bId,
      variant: this._sectionVariant(type)
    };
    a.edges.push(edge);
    b.edges.push(edge);
    this.edges.push(edge);
    return edge;
  }
}
