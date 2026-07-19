/**
 * MinePlan — TOPOLOGIA del plano de mina (réplica de plano de mina subterránea NEXA).
 *
 * La retICula se autora ALINEADA A EJES (la rotacion ~30° del plano es solo dibujo). Modela
 * una mina COMPLETA y AMPLIA (ref. `/mina-3d-trackless`):
 *   - Galerias (Ga)  → filas, corren en X (incluye una fila BY-PASS paralela).
 *   - Cruceros (Cx)  → columnas, corren en Z.
 *   - Via principal RN 96 → columna este (espina N-S, transito de equipos).
 *   - HOLES → bloques/macizos sin excavar (rompen la cuadricula, como el plano = pilares).
 *   - Nivel INFERIOR conectado por una RAMPA/decline en espiral real.
 *   - SPURS → labores especiales en fondo de saco, colgadas del PERIMETRO y apuntando HACIA
 *     AFUERA (regla anti-colision: fuera del perimetro no hay retICula, asi que ningun spur
 *     se cruza con una galeria/crucero): refugios, subestaciones, bahias, camara/stope, bombeo,
 *     talleres, frentes, sostenimiento, shotcrete, desatado, polvorin, echadero.
 *
 * Coordenadas de lattice: x = col*SPACING_X, z = -row*SPACING_Z (centradas). `row` puede ser
 * FRACCIONARIO o negativo (para el nivel inferior al norte). `y = -level*LEVEL_DROP`.
 *
 * Presupuesto: mas labores NO dispara los draw calls — `WorldRuntime.update` hace streaming por
 * distancia (oculta tramos lejanos) y las luces van en un pool de conteo constante. El coste de
 * ampliar es tiempo de carga y memoria, no FPS.
 */

// Separacion entre nodos de la retICula (m).
export const SPACING_X = 32; // entre cruceros, a lo largo de la galeria (eje X)
export const SPACING_Z = 30; // entre galerias, a lo largo del crucero (eje Z)
export const LEVEL_DROP = 12; // desnivel entre niveles (m)

// Galerias (filas) del nivel principal. Norte (row 0) → sur (row 5). `main` = LED verde neon.
// La fila r3 es un BY-PASS (galeria paralela para separar transito/ventilacion), conectada a
// las vecinas por los cruceros (que actuan de ventanas).
export const ROWS = [
  { label: 'Ga 240',      main: true  },
  { label: 'Ga 220',      main: false },
  { label: 'Ga 200',      main: true  },
  { label: 'By-Pass 190', main: false },
  { label: 'Ga 180',      main: false },
  { label: 'Ga 160',      main: true  },
];

// Cruceros (columnas). Oeste (col 0) → este (col 8). La ultima es la VIA PRINCIPAL RN 96.
export const COLS = [
  { label: 'Cx 999', type: 'crucero'  },
  { label: 'Cx 998', type: 'crucero'  },
  { label: 'Cx 997', type: 'crucero'  },
  { label: 'Cx 996', type: 'crucero'  },
  { label: 'Cx 995', type: 'crucero'  },
  { label: 'Cx 994', type: 'crucero'  },
  { label: 'Cx 993', type: 'crucero'  },
  { label: 'Cx 992', type: 'crucero'  },
  { label: 'RN 96',  type: 'mainRoad' },
];

// BLOQUES abiertos (macizos sin excavar): nodos INTERIORES que no existen. Solo interiores:
// el perimetro se mantiene intacto para el circuito de vehiculos. Ninguno es `c1_r1` (chimenea
// de escape) ni padre de un spur. Dispersos → nunca desconectan el grafo.
export const HOLES = new Set([
  'c2_r2', 'c5_r2',   // pilares fila central-norte
  'c3_r3', 'c6_r3',   // pilares del by-pass
  'c4_r4',            // pilar central-sur
]);

// ── VARIEDAD POR SEMILLA (Item 3) ──────────────────────────────────────────────
// El generador usa la semilla del mundo para que cada carga sea una mina DISTINTA pero
// reproducible. Todo lo aqui listado es INTERIOR y no critico: no toca el perimetro del
// VEHICLE_LOOP ni los nodos con chimenea/spawn ni padres de spur, y quitar un nodo interior
// suelto de una retICula llena nunca desconecta el grafo.
export const VARIETY = {
  // Pilares EXTRA elegidos por semilla (0..N de este pool de interiores libres).
  holeCandidates: ['c3_r1', 'c6_r1', 'c2_r4', 'c6_r4'],
  extraHolesMax: 2,
  // Jitter de seccion por arista: ±fraccion sobre width/height. Amplio (±20%) para que se
  // vean labores marcadamente mas ANGOSTAS y mas AMPLIAS (breasting/desquinche/rehabilitacion).
  // El generador ACOTA el resultado a un rango transitable y < boca del cruce (no abre huecos).
  sectionJitter: 0.20,
  // Galerias que reciben LED verde neon (main): se sortea cuantas filas ademas de las fijas.
  mainRowsMin: 2,
  mainRowsMax: 3,
};

// Dimensiones de la seccion transversal por tipo de labor (m). Tamaño real (D.S. 024-2016-EM /
// `/mina-3d-trackless` §4): herradura, ancho×alto. Calibradas a la boca del cruce (NODE_SIZE).
export const DIM = {
  gallery:  { width: 5.0, height: 4.6 }, // galeria (Ga) / by-pass
  crucero:  { width: 4.5, height: 4.4 }, // crucero (Cx)
  mainRoad: { width: 7.0, height: 5.2 }, // via principal RN 96
  access:   { width: 4.2, height: 4.2 }, // acceso corto a una labor (spur)
  ramp:     { width: 5.5, height: 5.0 }, // rampa / decline
};

// Tamaño (lado, m) del bloque abierto de interseccion. La boca (size - 2*POST_T) debe superar
// el ancho de la via principal (7 m) → size = 10.
export const NODE_SIZE = 10.0;
export const ROOM_SIZE = 12.0;   // sala de una labor especial (mas amplia que un crucero)
export const SPUR_DIST = 24.0;   // distancia del nodo padre a la sala (deja un acceso corto)

// ── RAMPA EN ESPIRAL (decline helicoidal) ──────────────────────────────────────
// Conecta el nivel principal (c8_r0, tope de RN 96) con el inferior bajando en HELICE. Las
// minas trackless bajan de nivel con rampa en espiral para compactar la huella. La geometria
// (roca curva + piso + berma) la genera `HelicalRampSegment`; el generador crea el nodo de
// llegada (`toNode`) EXACTAMENTE en la salida del helicoide, y el nivel inferior cuelga de ahi.
// El helicoide espirala al ESTE de RN 96 (fuera de la retICula y de los spurs norte).
//   entryDir : cara del nodo `from` por la que arranca la rampa (N=+Z…).
//   radius   : radio del eje del helicoide (m) — huella de la espiral.
//   turns    : vueltas para bajar `drop` (grade ~ drop / (turns·2π·radius) ≈ 0.11 con estos valores).
//   turnDir  : sentido de giro visto desde arriba (-1 horario, +1 antihorario).
export const RAMP_HELIX = {
  from: 'c8_r0',
  entryDir: 'N',
  radius: 15,
  turns: 1.25,
  turnDir: -1,
  drop: LEVEL_DROP,
  toLevel: 1,
  toNode: 'lower_entry',
  label: 'Rampa espiral −12',
};

// Compat: ya no hay rampas rectas (las reemplaza RAMP_HELIX). Se conserva el export vacio.
export const RAMPS = [];

// ── NIVEL INFERIOR ────────────────────────────────────────────────────────────
// Sub-grid del nivel 1 (12 m mas abajo) que CUELGA del nodo de llegada de la rampa espiral
// (`lower_entry`). Los nodos se definen por offset (dx,dz en m) desde ese nodo, para que el
// trazado quede SIEMPRE alineado con la salida del helicoide (se calcule donde se calcule).
// El helicoide arranca al NORTE de c8_r0 y espirala en un anillo (radio RAMP_HELIX.radius)
// centrado al ESTE de la boca; llega a `lower_entry` viniendo desde el OESTE (dirB=-X). Por eso
// el nivel inferior se extiende hacia el ESTE y el SUR desde la llegada: es el lado por el que
// el anillo de la rampa NO pasa, evitando que un nodo del nivel 1 caiga dentro de las vueltas
// bajas del decline (misma cota y=-12).
export const LOWER = {
  level: 1,
  entry: 'lower_entry',
  nodes: [
    { id: 'lower_entry', dx: 0,               dz: 0 },
    { id: 'l_a',  dx: SPACING_X,       dz: 0 },
    { id: 'l_b',  dx: 2 * SPACING_X,   dz: 0 },
    { id: 'l_a2', dx: SPACING_X,       dz: -SPACING_Z },
    { id: 'l_b2', dx: 2 * SPACING_X,   dz: -SPACING_Z },
    { id: 'l_a3', dx: SPACING_X,       dz: -2 * SPACING_Z },
    { id: 'l_b3', dx: 2 * SPACING_X,   dz: -2 * SPACING_Z },
  ],
  edges: [
    ['lower_entry', 'l_a',  'gallery', 'Ga 168'],
    ['l_a',  'l_b',  'gallery', 'Ga 168'],
    ['l_a2', 'l_b2', 'gallery', 'Ga 156'],
    ['l_a3', 'l_b3', 'gallery', 'Ga 144'],
    ['l_a',  'l_a2', 'crucero', 'Cx 990'],
    ['l_a2', 'l_a3', 'crucero', 'Cx 990'],
    ['l_b',  'l_b2', 'crucero', 'Cx 991'],
    ['l_b2', 'l_b3', 'crucero', 'Cx 991'],
  ],
};

// LABORES ESPECIALES en fondo de saco (spurs). `dir`: N=+Z, S=-Z, E=+X, W=-X.
// REGLA: todas cuelgan del PERIMETRO y apuntan HACIA AFUERA (no hay retICula fuera del borde →
// jamas colisionan con una galeria/crucero). Los DOS refugios Dräger de 20 personas van en
// esquinas OPUESTAS (c0_r1 al NO, c7_r5 al SE) para minimizar la distancia maxima de evacuacion.
export const SPURS = [
  // ── Oeste (columna c0) → apuntan al W ──
  { from: 'c0_r0', dir: 'W', type: 'polvorin',     label: 'Polvorín' },   // alejado, esquina NO
  { from: 'c0_r1', dir: 'W', type: 'refugio',      label: 'Refugio 1' },
  { from: 'c0_r2', dir: 'W', type: 'camara',       label: 'Cámara' },     // stope: carga del HaulCycle
  { from: 'c0_r4', dir: 'W', type: 'taller',       label: 'Taller' },
  // ── Norte (fila r0) → apuntan al N ──
  { from: 'c1_r0', dir: 'N', type: 'desatado',     label: 'Desatado' },
  { from: 'c2_r0', dir: 'N', type: 'subestacion',  label: 'S/E 1' },
  { from: 'c4_r0', dir: 'N', type: 'frente',       label: 'Frente 1' },
  { from: 'c6_r0', dir: 'N', type: 'bahia',        label: 'Bahía 1' },
  { from: 'c7_r0', dir: 'N', type: 'sostenimiento', label: 'Sostenim.' },
  // ── Sur (fila r5) → apuntan al S ──
  { from: 'c1_r5', dir: 'S', type: 'shotcrete',    label: 'Shotcrete' },
  { from: 'c2_r5', dir: 'S', type: 'echadero',     label: 'Echadero' },   // descarga del HaulCycle
  { from: 'c4_r5', dir: 'S', type: 'frente',       label: 'Frente 2' },
  { from: 'c6_r5', dir: 'S', type: 'bombeo',       label: 'Bombeo' },
  { from: 'c7_r5', dir: 'S', type: 'refugio',      label: 'Refugio 2' },
  // ── Este (columna RN 96, c8) → apuntan al E ──
  { from: 'c8_r2', dir: 'E', type: 'bahia',        label: 'Bahía 2' },
  { from: 'c8_r3', dir: 'E', type: 'subestacion',  label: 'S/E 2' },
];

/**
 * Circuito CERRADO de vehiculos: PERIMETRO del nivel principal (baja por RN 96, cruza la
 * galeria sur, sube por el crucero oeste y vuelve por la galeria norte). Todos sus nodos son
 * ADYACENTES y NINGUNO es HOLE. No toca el interior.
 */
export const VEHICLE_LOOP = [
  'c8_r0', 'c8_r1', 'c8_r2', 'c8_r3', 'c8_r4', 'c8_r5',                            // RN 96 (col 8) N→S
  'c7_r5', 'c6_r5', 'c5_r5', 'c4_r5', 'c3_r5', 'c2_r5', 'c1_r5', 'c0_r5',          // galeria sur (row 5) E→W
  'c0_r4', 'c0_r3', 'c0_r2', 'c0_r1', 'c0_r0',                                     // crucero oeste (col 0) S→N
  'c1_r0', 'c2_r0', 'c3_r0', 'c4_r0', 'c5_r0', 'c6_r0', 'c7_r0',                   // galeria norte (row 0) W→E
];

/** Nodo donde aparece el jugador: extremo sur de la via principal (boca de acceso). */
export const SPAWN_NODE = 'c8_r5';
