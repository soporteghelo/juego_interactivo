import * as THREE from 'three';
import { ANCHO_PASO_INTERSECCION } from './MinePlan.js';

export const CSV_INTERSECTION_ORIGIN = Object.freeze({ x: 6000, y: 4500, z: -220 });
// Anchos ORIGINALES del archivo topografico (m): la envolvente reforzada que forma la via E-W y
// la via perpendicular N-S que la atraviesa.
export const CSV_SOURCE_MAIN_WIDTH = 5.4;
export const CSV_SOURCE_CROSS_WIDTH = 4.5;
export const CSV_INTERSECTION_HEIGHT = 5.4;

// ── AMPLIACION EN PLANTA ──────────────────────────────────────────────────────
// El cruce autorado es de 5.4 m (E-W) x 4.5 m (N-S): mas ANGOSTO que las labores del plano, con
// lo que un scoop lo llenaba entero y el peaton no tenia por donde pasar — y ademas producia un
// escalon (y huecos) en la union tunel→cruce. La malla se estira SOLO EN PLANTA hasta dejar las
// dos vias con el mismo ancho de paso (ANCHO_PASO_INTERSECCION). La COTA no se toca: la corona
// sigue a 5.4 m, la altura real del archivo.
export const CSV_SCALE_X = ANCHO_PASO_INTERSECCION / CSV_SOURCE_CROSS_WIDTH;  // ensancha la via N-S
export const CSV_SCALE_Z = ANCHO_PASO_INTERSECCION / CSV_SOURCE_MAIN_WIDTH;   // ensancha la via E-W
/** Ancho libre de CUALQUIERA de las cuatro bocas del cruce, ya escalado (m). */
export const CSV_INTERSECTION_WIDTH = ANCHO_PASO_INTERSECCION;

const EXPECTED_HEADER = [
  'TRIANGLE', 'XP1', 'YP1', 'ZP1', 'XP2', 'YP2', 'ZP2', 'XP3', 'YP3', 'ZP3',
  'COLOUR', 'LAYERS', 'LABOR', 'LINK'
];

const COLORS = {
  floor: new THREE.Color(0x514b43),
  gutter: new THREE.Color(0x22282a),
  shotcrete: new THREE.Color(0xa5a49d),
  crown: new THREE.Color(0x777875),
  rock: new THREE.Color(0x686862),
  bolt: new THREE.Color(0xb98a45)
};

function layerColor(layer, colour) {
  if (layer.startsWith('PLACA_PERNO') || colour === 6) return COLORS.bolt;
  if (layer === 'CUNETA_0.40x0.35') return COLORS.gutter;
  if (layer === 'PISO_RASANTE') return COLORS.floor;
  if (layer.includes('CORONA')) return COLORS.crown;
  if (layer.includes('SHOTCRETE') || layer === 'BOCA_REFORZADA') return COLORS.shotcrete;
  return COLORS.rock;
}

/**
 * Mapea topografia (Este, Norte, cota) a Three.js (X, Y vertical, Z). La COTA se conserva 1:1;
 * la planta se estira por CSV_SCALE_X / CSV_SCALE_Z para ampliar el ancho de paso del cruce.
 */
function toLocal(x, y, z) {
  return {
    x: (x - CSV_INTERSECTION_ORIGIN.x) * CSV_SCALE_X,
    y: z - CSV_INTERSECTION_ORIGIN.z,
    z: -(y - CSV_INTERSECTION_ORIGIN.y) * CSV_SCALE_Z
  };
}

function interpolate(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

/** Recorta un poligono contra un semiplano axis-aligned. */
function clipPlane(vertices, axis, limit, keepGreater) {
  if (!vertices.length) return vertices;
  const inside = point => keepGreater ? point[axis] >= limit - 1e-7 : point[axis] <= limit + 1e-7;
  const output = [];
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const previous = vertices[(i + vertices.length - 1) % vertices.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside !== previousInside) {
      const denominator = current[axis] - previous[axis];
      const t = Math.abs(denominator) < 1e-12 ? 0 : (limit - previous[axis]) / denominator;
      output.push(interpolate(previous, current, t));
    }
    if (currentInside) output.push(current);
  }
  return output;
}

function clipToSquare(triangle, halfSize) {
  let polygon = triangle;
  polygon = clipPlane(polygon, 'x', -halfSize, true);
  polygon = clipPlane(polygon, 'x', halfSize, false);
  polygon = clipPlane(polygon, 'z', -halfSize, true);
  polygon = clipPlane(polygon, 'z', halfSize, false);
  return polygon;
}

function triangleNormal(a, b, c) {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  return {
    x: uy * vz - uz * vy,
    y: uz * vx - ux * vz,
    z: ux * vy - uy * vx
  };
}

/** Cara del refuerzo X que debe abrirse para recibir la via perpendicular. */
function isCentralDivider(triangle, layer) {
  if (!layer.includes('HASTIAL') && !layer.includes('RINON') && !layer.includes('PLACA_PERNO_0.15x0.15_WALL')) return false;
  const normal = triangleNormal(...triangle);
  return Math.abs(normal.z) > Math.abs(normal.x) * 0.72;
}

function triangleArea(points) {
  const normal = triangleNormal(...points);
  return Math.hypot(normal.x, normal.y, normal.z) / 2;
}

function pushPolygonTriangles(target, polygon, layer, colour) {
  if (polygon.length < 3) return;
  for (let i = 1; i < polygon.length - 1; i++) {
    const points = [polygon[0], polygon[i], polygon[i + 1]];
    // Evita agujas microscopicas creadas justo sobre un plano de recorte.
    if (triangleArea(points) < 1e-4) continue;
    const edges = points.map((point, index) => {
      const next = points[(index + 1) % 3];
      return Math.hypot(point.x - next.x, point.y - next.y, point.z - next.z);
    });
    const shortest = Math.min(...edges);
    const longest = Math.max(...edges);
    if (shortest < 0.008 || longest / shortest > 80) continue;
    target.push({ points, layer, colour });
  }
}

function geometryFromTriangles(triangles, metadata = {}) {
  const positions = [];
  const colors = [];
  const uvs = [];
  for (const item of triangles) {
    const color = layerColor(item.layer, item.colour);
    const normal = triangleNormal(...item.points);
    const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
    for (const point of item.points) {
      positions.push(point.x, point.y, point.z);
      colors.push(color.r, color.g, color.b);
      // UV por plano dominante. Usar siempre X/Y degeneraba el piso y los hastiales paralelos
      // a X, estirando un solo texel en largas bandas triangulares.
      const textureScale = 2.4;
      if (ay >= ax && ay >= az) uvs.push(point.x / textureScale, point.z / textureScale);
      else if (ax >= az) uvs.push(point.z / textureScale, point.y / textureScale);
      else uvs.push(point.x / textureScale, point.y / textureScale);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.csvIntersection = metadata;
  return geometry;
}

function capDirection(triangle, layer) {
  // Los planos de las tapas del archivo (x = ±6, z = ±28) viajan con el estirado en planta.
  const eps = 0.02;
  const capX = 6 * CSV_SCALE_X;
  const capZ = 28 * CSV_SCALE_Z;
  const every = predicate => triangle.every(predicate);
  if (layer === 'BOCA_REFORZADA') {
    if (every(p => Math.abs(p.x + capX) < eps)) return 'W';
    if (every(p => Math.abs(p.x - capX) < eps)) return 'E';
  }
  if (layer === 'PORTAL' || layer === 'FRENTE') {
    if (every(p => Math.abs(p.z - capZ) < eps)) return 'N';
    if (every(p => Math.abs(p.z + capZ) < eps)) return 'S';
  }
  return null;
}

function moveCapToBoundary(triangle, direction, halfSize) {
  return triangle.map(point => {
    const moved = { ...point };
    if (direction === 'W') moved.x = -halfSize;
    if (direction === 'E') moved.x = halfSize;
    if (direction === 'N') moved.z = halfSize;
    if (direction === 'S') moved.z = -halfSize;
    return moved;
  });
}

/**
 * Convierte el archivo completo en la zona central reutilizable por cada nodo del juego.
 * Todos los valores geometricos proceden del CSV y permanecen en metros, sin reescalado.
 */
export function buildCsvIntersectionGeometry(csvText, { halfSize = 5 } = {}) {
  const lines = csvText.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(value => value.trim());
  if (header.length !== EXPECTED_HEADER.length || header.some((value, index) => value !== EXPECTED_HEADER[index])) {
    throw new Error('[Interseccion CSV] Encabezado incompatible');
  }

  // Medias anchuras YA ESCALADAS: la envolvente reforzada (recorte de los brazos de la via Y) y
  // la via perpendicular (vano que se abre en los hastiales del refuerzo). Ambas valen
  // ANCHO_PASO_INTERSECCION/2 por construccion de CSV_SCALE_X / CSV_SCALE_Z.
  const reinforcementHalf = (CSV_SOURCE_MAIN_WIDTH * CSV_SCALE_Z) / 2;
  const crossHalf = (CSV_SOURCE_CROSS_WIDTH * CSV_SCALE_X) / 2;

  const central = [];
  const caps = { N: [], S: [], E: [], W: [] };
  let removedNested = 0;
  let openedDividers = 0;
  let clippedSourceTriangles = 0;

  // El CSV concatena via X, via Y y refuerzo central. Sus dos reinicios se reconocen por
  // PISO/link=1 inmediatamente despues del patron de pernos de la envolvente anterior.
  const transitions = [];
  for (let row = 2; row < lines.length; row++) {
    const current = lines[row].split(',');
    const previous = lines[row - 1].split(',');
    if (current[11] === 'PISO_RASANTE' && current[13] === '1' && previous[11]?.startsWith('PLACA_PERNO')) {
      transitions.push(row);
    }
  }
  if (transitions.length !== 2) throw new Error('[Interseccion CSV] No se pudieron separar las tres envolventes');

  for (let row = 1; row < lines.length; row++) {
    const values = lines[row].split(',');
    if (values.length !== EXPECTED_HEADER.length) throw new Error(`[Interseccion CSV] Fila ${row + 1} incompleta`);
    const triangle = [0, 1, 2].map(index => toLocal(
      Number(values[1 + index * 3]),
      Number(values[2 + index * 3]),
      Number(values[3 + index * 3])
    ));
    if (triangle.flatMap(point => [point.x, point.y, point.z]).some(value => !Number.isFinite(value))) {
      throw new Error(`[Interseccion CSV] Coordenada no numerica en fila ${row + 1}`);
    }
    const layer = values[11];
    const colour = Number(values[10]);
    const sourcePart = row < transitions[0] ? 'x' : row < transitions[1] ? 'y' : 'reinforcement';

    const direction = capDirection(triangle, layer);
    if (direction) {
      caps[direction].push({ points: moveCapToBoundary(triangle, direction, halfSize), layer, colour });
    }

    // Las tapas terminales originales estan a 6/28 m. Las bocas del nodo deben quedar abiertas.
    if (layer === 'PORTAL' || layer === 'FRENTE' || layer === 'BOCA_REFORZADA') continue;

    // Dentro del nodo, la via X de 4.5 m esta completamente contenida por el refuerzo X de
    // 5.4 m. Mantener ambas envolventes cerradas produjo la maraña de caras de la captura.
    if (sourcePart === 'x') { removedNested++; continue; }

    const polygon = clipToSquare(triangle, halfSize);
    if (polygon.length < 3) continue;
    clippedSourceTriangles++;

    if (sourcePart === 'y') {
      // La via Y solo aporta sus brazos fuera del volumen reforzado. Se recorta por planos,
      // no por centroide, para que ningun triangulo pueda cruzar el vano central.
      const north = clipPlane(polygon, 'z', reinforcementHalf, true);
      const south = clipPlane(polygon, 'z', -reinforcementHalf, false);
      pushPolygonTriangles(central, north, layer, colour);
      pushPolygonTriangles(central, south, layer, colour);
      if (north.length < 3 && south.length < 3) removedNested++;
      continue;
    }

    if (isCentralDivider(triangle, layer)) {
      // Abre en los dos hastiales del refuerzo el ancho exacto de la via perpendicular.
      const westSide = clipPlane(polygon, 'x', -crossHalf, false);
      const eastSide = clipPlane(polygon, 'x', crossHalf, true);
      pushPolygonTriangles(central, westSide, layer, colour);
      pushPolygonTriangles(central, eastSide, layer, colour);
      openedDividers++;
      continue;
    }
    pushPolygonTriangles(central, polygon, layer, colour);
  }

  const sourceTriangles = lines.length - 1;
  const geometry = geometryFromTriangles(central, {
    source: 'prueba/elementos/interseccion_4_vias.csv',
    sourceTriangles,
    clippedSourceTriangles,
    outputTriangles: central.length,
    removedNested,
    openedDividers,
    // Cota 1:1 (corona real de 5.4 m); planta estirada para igualar el ancho de paso del plano.
    scale: '1:1 en cota',
    scaleX: +CSV_SCALE_X.toFixed(4),
    scaleZ: +CSV_SCALE_Z.toFixed(4),
    passageWidth: ANCHO_PASO_INTERSECCION,
    halfSize
  });
  const capGeometries = Object.fromEntries(Object.entries(caps).map(([direction, triangles]) => [
    direction,
    geometryFromTriangles(triangles, { direction, sourceTriangles: triangles.length, scale: '1:1' })
  ]));
  return { geometry, capGeometries, metadata: geometry.userData.csvIntersection };
}
