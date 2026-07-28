import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(ROOT, 'elementos');
const HEADER = ['TRIANGLE', 'XP1', 'YP1', 'ZP1', 'XP2', 'YP2', 'ZP2', 'XP3', 'YP3', 'ZP3', 'COLOUR', 'LAYERS', 'LABOR', 'LINK'];
const summaries = [];

mkdirSync(OUTPUT_DIR, { recursive: true });

function hashString(text) {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function hash(index, seed) {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function noise(value, seed) {
  const index = Math.floor(value);
  const fraction = value - index;
  const smooth = fraction * fraction * (3 - 2 * fraction);
  return (hash(index, seed) * (1 - smooth) + hash(index + 1, seed) * smooth) * 2 - 1;
}

function fbm(value, seed) {
  return noise(value, seed) * 0.58 + noise(value * 2.03, seed + 19) * 0.28 + noise(value * 4.07, seed + 41) * 0.14;
}

function point(x, y, z) {
  return { x, y, z };
}

function addPoints(...points) {
  return points.reduce((sum, current) => point(sum.x + current.x, sum.y + current.y, sum.z + current.z), point(0, 0, 0));
}

function scalePoint(value, scale) {
  return point(value.x * scale, value.y * scale, value.z * scale);
}

function normalisedCross(a, b, c) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const cross = point(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  const magnitude = Math.hypot(cross.x, cross.y, cross.z) || 1;
  return scalePoint(cross, 1 / magnitude);
}

function irregularDistances(length, nominalSpacing, seed) {
  if (length <= 0) return [0];
  const distances = [0];
  let distance = 0;
  let round = 0;
  while (distance < length) {
    const variation = 0.76 + 0.48 * hash(round + 17, seed + 211);
    const step = nominalSpacing * variation;
    const remaining = length - distance;
    distance = remaining < step * 1.35 ? length : Math.min(length, distance + step);
    distances.push(distance);
    round++;
  }
  return distances;
}

function triangleArea(a, b, c) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

class Mesh {
  constructor(labor, colour = 11) {
    this.labor = labor;
    this.colour = colour;
    this.triangles = [];
  }

  add(a, b, c, layer, link, colour = this.colour) {
    if (triangleArea(a, b, c) < 1e-5) return;
    this.triangles.push({ a, b, c, layer, link, colour });
  }
}

function horseshoeProfile(width, height, gutter = true, floorDetail = true) {
  const radius = width / 2;
  const springline = Math.max(height - radius, height * 0.38);
  const profile = [
    [-radius, 0],
    [-radius, springline * 0.52],
    [-radius, springline]
  ];
  for (let degrees = 165; degrees >= 15; degrees -= 15) {
    const angle = degrees * Math.PI / 180;
    profile.push([Math.cos(angle) * radius, springline + Math.sin(angle) * (height - springline)]);
  }
  profile.push(
    [radius, springline],
    [radius, springline * 0.52],
    [radius, 0]
  );
  if (gutter) profile.push([radius, -0.35], [radius - 0.40, -0.35], [radius - 0.40, 0]);
  if (floorDetail) {
    profile.push(
      [width * 0.30, -0.025],
      [width * 0.22, -0.105],
      [width * 0.14, -0.030],
      [0, -0.005],
      [-width * 0.14, -0.030],
      [-width * 0.22, -0.105],
      [-width * 0.30, -0.025]
    );
  } else profile.push([0, 0]);
  return profile;
}

function chamberProfile(width, height, gutter = true, floorDetail = true) {
  return horseshoeProfile(width, height, gutter, floorDetail);
}

function stopeProfile(width, height) {
  return [
    [-0.50 * width, 0.00 * height],
    [-0.50 * width, 0.20 * height],
    [-0.50 * width, 0.40 * height],
    [-0.50 * width, 0.60 * height],
    [-0.50 * width, 0.80 * height],
    [-0.50 * width, 1.00 * height],
    [-0.25 * width, 1.00 * height],
    [0.00 * width, 1.00 * height],
    [0.25 * width, 1.00 * height],
    [0.50 * width, 1.00 * height],
    [0.50 * width, 0.80 * height],
    [0.50 * width, 0.60 * height],
    [0.50 * width, 0.40 * height],
    [0.50 * width, 0.20 * height],
    [0.50 * width, 0.00 * height],
    [0.25 * width, 0.00 * height],
    [0.00 * width, 0.00 * height],
    [-0.25 * width, 0.00 * height]
  ];
}

function excavationLayer(side, up, width, height, vocabulary = 'development') {
  if (up < -0.05 && side > 0) return 'CUNETA_0.40x0.35';
  if (up <= 0.07 * height) return vocabulary === 'stope' ? 'MURO_PISO' : 'PISO_RASANTE';
  if (up >= 0.82 * height) return vocabulary === 'stope' ? 'TECHO_TAJO_ESTRIADO' : 'CORONA_SHOTCRETE_MALLA_PERNOS_1.2m';
  if (vocabulary === 'stope') return side < 0 ? 'CAJA_PISO' : 'CAJA_TECHO';
  if (up >= height - width / 2) return side < 0 ? 'RINON_IZQ_SHOTCRETE_PERNOS' : 'RINON_DER_SHOTCRETE_PERNOS';
  return side < 0 ? 'HASTIAL_CAJA_PISO_SHOTCRETE' : 'HASTIAL_CAJA_TECHO_SERVICIOS';
}

function horizontalPath(config, distance) {
  if (config.pathAt) return config.pathAt(distance, config);
  const angle = config.angle ?? 0;
  const curve = (config.curveAmplitude ?? 0) * Math.sin(distance / (config.curveWavelength ?? 45));
  const secondCurve = (config.curveAmplitude ?? 0) * 0.28 * fbm(distance / 22, config.seed + 7);
  const lateral = curve + secondCurve;
  return point(
    config.origin.x + Math.cos(angle) * distance - Math.sin(angle) * lateral,
    config.origin.y + Math.sin(angle) * distance + Math.cos(angle) * lateral,
    config.origin.z + (config.grade ?? 0) * distance + (config.floorUndulation ?? 0.08) * fbm(distance / 8, config.seed + 13)
  );
}

function pathFrame(config, distance) {
  const center = horizontalPath(config, distance);
  const before = horizontalPath(config, Math.max(0, distance - 0.15));
  const after = horizontalPath(config, Math.min(config.length, distance + 0.15));
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const tangentLength = Math.hypot(dx, dy) || 1;
  return {
    center,
    tangentX: dx / tangentLength,
    tangentY: dy / tangentLength,
    lateralX: -dy / tangentLength,
    lateralY: dx / tangentLength
  };
}

function addTubeAlongPath(mesh, config, tube) {
  const seed = config.seed ?? hashString(config.name ?? mesh.labor);
  const distances = irregularDistances(config.length, tube.stationSpacing ?? 2.5, seed + hashString(tube.layer));
  const sides = tube.sides ?? 10;
  const rings = [];
  for (let station = 0; station < distances.length; station++) {
    const distance = distances[station];
    const { center, lateralX, lateralY } = pathFrame(config, distance);
    const hangerWave = tube.flexible ? -0.055 * (0.5 - 0.5 * Math.cos(distance / (tube.hangerPitch ?? 2.5) * Math.PI * 2)) : 0;
    const radiusScale = 1 + (tube.flexible ? 0.025 : 0.006) * fbm(distance / 2.2, seed + 401);
    const ring = [];
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2 + (tube.startAngle ?? 0);
      const lateralOffset = tube.side + Math.cos(angle) * tube.radius * radiusScale;
      ring.push(point(
        center.x + lateralX * lateralOffset,
        center.y + lateralY * lateralOffset,
        center.z + tube.up + hangerWave + Math.sin(angle) * tube.radius * radiusScale
      ));
    }
    rings.push(ring);
  }
  for (let station = 0; station < rings.length - 1; station++) {
    for (let side = 0; side < sides; side++) {
      const following = (side + 1) % sides;
      mesh.add(rings[station][side], rings[station + 1][side], rings[station + 1][following], tube.layer, station + 1, tube.colour);
      mesh.add(rings[station][side], rings[station + 1][following], rings[station][following], tube.layer, station + 1, tube.colour);
    }
  }
}

function addStandardServices(mesh, config) {
  addTubeAlongPath(mesh, config, { side: -config.width * 0.28, up: config.height * 0.80, radius: 0.45, sides: 12, layer: 'MANGA_VENTILACION_D0.90', colour: 4, flexible: true, hangerPitch: 2.5 });
  addTubeAlongPath(mesh, config, { side: config.width * 0.42, up: config.height * 0.58, radius: 0.050, sides: 8, layer: 'TUBERIA_AGUA_D0.10', colour: 3 });
  addTubeAlongPath(mesh, config, { side: config.width * 0.42, up: config.height * 0.68, radius: 0.075, sides: 8, layer: 'TUBERIA_AIRE_D0.15', colour: 5 });
  addTubeAlongPath(mesh, config, { side: config.width * 0.43, up: config.height * 0.77, radius: 0.035, sides: 6, layer: 'CABLES_COMUNICACION', colour: 1 });
}

function addSupportPattern(mesh, config) {
  const seed = config.seed ?? hashString(config.name ?? mesh.labor);
  const distances = irregularDistances(config.length, config.boltSpacing ?? 1.5, seed + 503);
  const halfPlate = 0.075;

  function plateAt(distance, side, up, orientation, link) {
    const { center, tangentX, tangentY, lateralX, lateralY } = pathFrame(config, distance);
    const stagger = 0.025 * fbm(distance * 1.7 + side * 3.1 + up, seed + 541);
    const plateCenter = point(
      center.x + lateralX * side,
      center.y + lateralY * side,
      center.z + up + stagger
    );
    const along = point(tangentX * halfPlate, tangentY * halfPlate, 0);
    const across = orientation === 'crown'
      ? point(lateralX * halfPlate, lateralY * halfPlate, 0)
      : point(0, 0, halfPlate);
    const a = addPoints(plateCenter, scalePoint(along, -1), scalePoint(across, -1));
    const b = addPoints(plateCenter, along, scalePoint(across, -1));
    const c = addPoints(plateCenter, along, across);
    const d = addPoints(plateCenter, scalePoint(along, -1), across);
    mesh.add(a, b, c, `PLACA_PERNO_0.15x0.15_${orientation.toUpperCase()}`, link, 6);
    mesh.add(a, c, d, `PLACA_PERNO_0.15x0.15_${orientation.toUpperCase()}`, link, 6);
  }

  distances.slice(1, -1).forEach((distance, index) => {
    plateAt(distance, 0, config.height - 0.05, 'crown', index + 1);
    const wallSide = index % 2 === 0 ? -1 : 1;
    plateAt(distance, wallSide * (config.width / 2 - 0.035), config.height * 0.54, 'wall', index + 1);
    if (index % 3 === 0) {
      plateAt(distance, -wallSide * (config.width / 2 - 0.035), config.height * 0.72, 'wall', index + 1);
    }
  });
}

function addFrontDetails(mesh, config) {
  const { center, lateralX, lateralY } = pathFrame(config, config.length);
  const holes = [];
  for (const side of [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]) holes.push({ side, up: 0.28, type: 'ARRASTRE' });
  for (const up of [1.0, 1.8, 2.6, 3.3]) {
    holes.push({ side: -2.0, up, type: 'CUADRADOR' }, { side: 2.0, up, type: 'CUADRADOR' });
  }
  for (const [side, up] of [[-1.75,3.65],[-1.25,4.05],[-0.65,4.35],[0,4.45],[0.65,4.35],[1.25,4.05],[1.75,3.65]]) {
    holes.push({ side, up, type: 'ALZA_CONTORNO' });
  }
  for (const [side, up, type] of [
    [-0.28,1.85,'ALIVIO'],[0.28,1.85,'ALIVIO'],[-0.28,2.35,'ALIVIO'],[0.28,2.35,'ALIVIO'],
    [-0.65,1.55,'AYUDA'],[0.65,1.55,'AYUDA'],[-0.65,2.65,'AYUDA'],[0.65,2.65,'AYUDA'],
    [-1.15,2.10,'AYUDA'],[1.15,2.10,'AYUDA']
  ]) holes.push({ side, up, type });

  const sides = 8;
  holes.forEach((hole, index) => {
    const radius = hole.type === 'ALIVIO' ? 0.09 : 0.055;
    const origin = point(center.x + lateralX * hole.side, center.y + lateralY * hole.side, center.z + hole.up);
    const ring = Array.from({ length: sides }, (_, side) => {
      const angle = side / sides * Math.PI * 2;
      return point(
        origin.x + lateralX * Math.cos(angle) * radius,
        origin.y + lateralY * Math.cos(angle) * radius,
        origin.z + Math.sin(angle) * radius
      );
    });
    for (let side = 0; side < sides; side++) {
      mesh.add(origin, ring[side], ring[(side + 1) % sides], `COLLAR_${hole.type}`, index + 1, 1);
    }
  });

  const muckCenter = horizontalPath(config, Math.max(0, config.length - 2.5));
  addVerticalExcavation(mesh, {
    name: 'marina_frente', origin: { x: muckCenter.x, y: muckCenter.y, z: muckCenter.z }, height: 1.35,
    radiusX: 1.65, radiusY: 1.35, sides: 14, stationSpacing: 0.35, overbreak: 0.16, drift: 0,
    radiusAt: ratio => 1 - 0.72 * ratio, wallLayer: 'MARINA_MUCK', bottomLayer: 'MARINA_BASE', topLayer: 'MARINA_CIMA'
  });
}

function addSweptExcavation(mesh, config) {
  const seed = config.seed ?? hashString(config.name ?? mesh.labor);
  config.seed = seed;
  const distances = irregularDistances(config.length, config.stationSpacing ?? 2.5, seed + 181);
  const profileFactory = config.profile === 'chamber' ? chamberProfile : config.profile === 'stope' ? stopeProfile : horseshoeProfile;
  const vocabulary = config.profile === 'stope' ? 'stope' : 'development';
  const rings = [];

  for (let station = 0; station < distances.length; station++) {
    const distance = distances[station];
    const ratio = distance / config.length;
    const { center, lateralX, lateralY } = pathFrame(config, distance);
    const taper = config.scaleAt ? config.scaleAt(ratio) : 1;
    const widthScale = taper * (1 + (config.widthVariation ?? 0.040) * fbm(distance / 10, seed + 29));
    const heightScale = taper * (1 + (config.heightVariation ?? 0.035) * fbm(distance / 11, seed + 37));
    const profile = profileFactory(config.width, config.height, config.gutter !== false, config.floorDetail !== false);
    const ring = profile.map(([baseSide, baseUp], vertex) => {
      const crownWeight = Math.max(0, (baseUp / config.height - 0.72) / 0.3);
      const wallWeight = Math.min(1, Math.abs(baseSide) / (config.width * 0.5));
      const floorWeight = baseUp <= 0.08 ? 1 : 0;
      const localOverbreak = (config.overbreak ?? 0.10) * (
        0.60 * fbm(distance / 3.5 + vertex * 2.9, seed + 61 + vertex) +
        0.40 * fbm(distance / 1.9 + vertex * 4.1, seed + 89 + vertex)
      );
      const blastPocket = (config.overbreak ?? 0.10) * 0.62 * Math.max(0, fbm(distance / 5.5 + vertex * 0.37, seed + 137));
      const crownBulge = (config.crownOverbreak ?? 0.12) * crownWeight * Math.max(0, fbm(distance / 7, seed + 101));
      const side = baseSide * widthScale + (localOverbreak + blastPocket) * (0.28 + wallWeight) * Math.sign(baseSide || 1);
      const rutRipple = floorWeight * 0.025 * fbm(distance / 1.6 + vertex, seed + 167);
      const up = baseUp * heightScale + localOverbreak * (floorWeight ? 0.14 : 0.45) + crownBulge - rutRipple;
      return {
        point: point(center.x + lateralX * side, center.y + lateralY * side, center.z + up),
        side,
        up
      };
    });
    rings.push(ring);
  }

  for (let station = 0; station < rings.length - 1; station++) {
    const current = rings[station];
    const next = rings[station + 1];
    for (let vertex = 0; vertex < current.length; vertex++) {
      const following = (vertex + 1) % current.length;
      const layer = excavationLayer(current[vertex].side, current[vertex].up, config.width, config.height, vocabulary);
      const a = current[vertex].point;
      const b = next[vertex].point;
      const c = next[following].point;
      const d = current[following].point;
      const skew = 0.07 * fbm(station * 1.9 + vertex * 3.7, seed + 229);
      const center = addPoints(
        scalePoint(a, 0.25 + skew),
        scalePoint(b, 0.25 - skew),
        scalePoint(c, 0.25 + skew),
        scalePoint(d, 0.25 - skew)
      );
      const surfaceNormal = normalisedCross(a, b, d);
      const isFloor = layer === 'PISO_RASANTE' || layer === 'CUNETA_0.40x0.35' || layer === 'MURO_PISO';
      const isCrown = layer.includes('CORONA') || layer.includes('TECHO');
      const detailAmplitude = config.surfaceDetail ?? (vocabulary === 'stope' ? 0.09 : isFloor ? 0.035 : isCrown ? 0.14 : 0.105);
      const facetOffset = detailAmplitude * fbm(station * 2.3 + vertex * 4.9, seed + 277 + vertex);
      const facet = addPoints(center, scalePoint(surfaceNormal, facetOffset));
      mesh.add(a, b, facet, layer, station + 1);
      mesh.add(b, c, facet, layer, station + 1);
      mesh.add(c, d, facet, layer, station + 1);
      mesh.add(d, a, facet, layer, station + 1);
    }
  }

  function cap(ring, reverse, layer, link) {
    const center = ring.reduce((sum, vertex) => point(sum.x + vertex.point.x / ring.length, sum.y + vertex.point.y / ring.length, sum.z + vertex.point.z / ring.length), point(0, 0, 0));
    for (let vertex = 0; vertex < ring.length; vertex++) {
      const following = (vertex + 1) % ring.length;
      if (reverse) mesh.add(center, ring[following].point, ring[vertex].point, layer, link);
      else mesh.add(center, ring[vertex].point, ring[following].point, layer, link);
    }
  }

  if (config.capStart !== false) cap(rings[0], true, config.startLayer ?? 'PORTAL', 1);
  if (config.capEnd !== false) cap(rings.at(-1), false, config.endLayer ?? 'FRENTE', rings.length);
  if (vocabulary === 'development' && config.supports !== false && config.length >= 6) addSupportPattern(mesh, config);
  if (config.services) addStandardServices(mesh, config);
  if (config.drillingPattern) addFrontDetails(mesh, config);
}

function addVerticalExcavation(mesh, config) {
  const seed = config.seed ?? hashString(config.name ?? mesh.labor);
  const distances = irregularDistances(config.height, config.stationSpacing ?? 2.5, seed + 313);
  const sides = config.sides ?? 20;
  const rings = [];

  for (let station = 0; station < distances.length; station++) {
    const ratio = distances[station] / config.height;
    const z = config.origin.z + distances[station];
    const radiusScale = config.radiusAt ? config.radiusAt(ratio) : 1;
    const driftX = (config.drift ?? 0.12) * fbm(ratio * 4, seed + 11);
    const driftY = (config.drift ?? 0.12) * fbm(ratio * 4, seed + 17);
    const ring = [];
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2 + (config.startAngle ?? 0);
      const roughness = (config.overbreak ?? 0.05) * fbm(station * 0.41 + side * 2.7, seed + 31 + side);
      const radiusX = config.radiusX * radiusScale + roughness;
      const radiusY = config.radiusY * radiusScale + roughness;
      ring.push(point(
        config.origin.x + driftX + Math.cos(angle) * radiusX,
        config.origin.y + driftY + Math.sin(angle) * radiusY,
        z + (config.ringIrregularity ?? 0.03) * fbm(side * 1.7 + station * 0.23, seed + 71)
      ));
    }
    rings.push(ring);
  }

  for (let station = 0; station < rings.length - 1; station++) {
    for (let side = 0; side < sides; side++) {
      const following = (side + 1) % sides;
      const a = rings[station][side];
      const b = rings[station + 1][side];
      const c = rings[station + 1][following];
      const d = rings[station][following];
      const center = scalePoint(addPoints(a, b, c, d), 0.25);
      const surfaceNormal = normalisedCross(a, b, d);
      const smoothLining = (config.wallLayer ?? '').includes('LISA') || (config.wallLayer ?? '').includes('REVESTIMIENTO');
      const facetAmplitude = config.surfaceDetail ?? (smoothLining ? 0.012 : Math.max(0.035, (config.overbreak ?? 0.08) * 0.55));
      const facetOffset = facetAmplitude * fbm(station * 2.1 + side * 4.3, seed + 367 + side);
      const facet = addPoints(center, scalePoint(surfaceNormal, facetOffset));
      const layer = config.wallLayer ?? 'PARED_ROCA';
      mesh.add(a, b, facet, layer, station + 1);
      mesh.add(b, c, facet, layer, station + 1);
      mesh.add(c, d, facet, layer, station + 1);
      mesh.add(d, a, facet, layer, station + 1);
    }
  }

  function cap(ring, reverse, layer, link) {
    const center = ring.reduce((sum, vertex) => point(sum.x + vertex.x / ring.length, sum.y + vertex.y / ring.length, sum.z + vertex.z / ring.length), point(0, 0, 0));
    for (let side = 0; side < sides; side++) {
      const following = (side + 1) % sides;
      if (reverse) mesh.add(center, ring[following], ring[side], layer, link);
      else mesh.add(center, ring[side], ring[following], layer, link);
    }
  }

  cap(rings[0], true, config.bottomLayer ?? 'FONDO', 1);
  cap(rings.at(-1), false, config.topLayer ?? 'BOCA', rings.length);
}

function writeMesh(filename, mesh, metadata) {
  if (mesh.triangles.length < 100) throw new Error(`${filename}: malla insuficiente`);
  const lines = [HEADER.join(',')];
  const values = [];
  const fixed = value => Number(value).toFixed(3);

  mesh.triangles.forEach((triangle, index) => {
    for (const vertex of [triangle.a, triangle.b, triangle.c]) values.push(vertex);
    lines.push([
      index + 1,
      fixed(triangle.a.x), fixed(triangle.a.y), fixed(triangle.a.z),
      fixed(triangle.b.x), fixed(triangle.b.y), fixed(triangle.b.z),
      fixed(triangle.c.x), fixed(triangle.c.y), fixed(triangle.c.z),
      triangle.colour, triangle.layer, mesh.labor, triangle.link
    ].join(','));
  });

  const allFinite = values.every(vertex => Number.isFinite(vertex.x) && Number.isFinite(vertex.y) && Number.isFinite(vertex.z));
  const minArea = Math.min(...mesh.triangles.map(triangle => triangleArea(triangle.a, triangle.b, triangle.c)));
  if (!allFinite || minArea < 1e-5) throw new Error(`${filename}: geometría inválida`);

  const bounds = {
    x: [Math.min(...values.map(value => value.x)), Math.max(...values.map(value => value.x))],
    y: [Math.min(...values.map(value => value.y)), Math.max(...values.map(value => value.y))],
    z: [Math.min(...values.map(value => value.z)), Math.max(...values.map(value => value.z))]
  };
  writeFileSync(join(OUTPUT_DIR, filename), `${lines.join('\n')}\n`, 'utf8');
  summaries.push({ filename, triangles: mesh.triangles.length, bounds, ...metadata });
}

function createHorizontal(spec) {
  const mesh = new Mesh(spec.labor, spec.colour ?? 11);
  addSweptExcavation(mesh, spec);
  writeMesh(spec.filename, mesh, spec.metadata);
}

function createVertical(spec) {
  const mesh = new Mesh(spec.labor, spec.colour ?? 8);
  addVerticalExcavation(mesh, spec);
  writeMesh(spec.filename, mesh, spec.metadata);
}

const base = { x: 6000, y: 4500, z: -220 };

function spiralRampPath(distance, config) {
  const radius = config.curveRadius;
  const angle = distance / radius;
  return point(
    config.origin.x + Math.sin(angle) * radius,
    config.origin.y + (1 - Math.cos(angle)) * radius,
    config.origin.z + config.grade * distance
  );
}

const horizontalExcavations = [
  {
    filename: 'bocamina.csv', labor: 'BOCAMINA', name: 'bocamina', origin: { x: base.x, y: base.y, z: -22 },
    length: 90, width: 5.0, height: 5.0, grade: -0.13, curveAmplitude: 1.8, curveWavelength: 50,
    overbreak: 0.24, crownOverbreak: 0.28, services: true,
    startLayer: 'PORTAL_SUPERFICIE', endLayer: 'EMPALME_RAMPA',
    metadata: { tipo: 'acceso_superficie', dimensiones: '90 m; 5.0 x 5.0 m; -13.0%; cuneta 0.40 x 0.35 m' }
  },
  {
    filename: 'galeria.csv', labor: 'GALERIA', name: 'galeria', origin: base,
    length: 220, width: 4.5, height: 4.5, grade: -0.004, curveAmplitude: 3.0, curveWavelength: 78,
    overbreak: 0.26, crownOverbreak: 0.30, services: true,
    metadata: { tipo: 'desarrollo_sobre_rumbo', dimensiones: '220 m; 4.5 x 4.5 m; -0.4%; cuneta 0.40 x 0.35 m' }
  },
  {
    filename: 'galeria_wireframe_simulada.csv', labor: 'GALERIA_SIMULADA_HD', name: 'galeria_hd', origin: base,
    length: 120, width: 4.5, height: 4.5, grade: -0.004, curveAmplitude: 4.0, curveWavelength: 46,
    stationSpacing: 1.2, overbreak: 0.30, crownOverbreak: 0.36, services: true,
    metadata: { tipo: 'desarrollo_alta_densidad', dimensiones: '120 m; 4.5 x 4.5 m; -0.4%; detalle longitudinal 1.2 m' }
  },
  {
    filename: 'crucero.csv', labor: 'CRUCERO', name: 'crucero', origin: base,
    length: 70, width: 4.5, height: 4.5, angle: Math.PI / 2, grade: -0.003, curveAmplitude: 0.35,
    overbreak: 0.25, services: true, endLayer: 'CONTACTO_CUERPO_MINERAL',
    metadata: { tipo: 'desarrollo_transversal', dimensiones: '70 m; 4.5 x 4.5 m; -0.3%; boca reforzada' }
  },
  {
    filename: 'rampa.csv', labor: 'RAMPA', name: 'rampa', origin: base,
    length: 240, width: 5.0, height: 5.0, grade: -0.13, curveRadius: 22, pathAt: spiralRampPath,
    stationSpacing: 2.0, overbreak: 0.24, crownOverbreak: 0.28, services: true,
    metadata: { tipo: 'rampa_principal_helicoidal', dimensiones: '240 m; 5.0 x 5.0 m; -13.0%; radio 22 m' }
  },
  {
    filename: 'subnivel.csv', labor: 'SUBNIVEL', name: 'subnivel', origin: base,
    length: 80, width: 4.0, height: 4.0, grade: -0.003, curveAmplitude: 0.8, curveWavelength: 45,
    overbreak: 0.22, services: true,
    metadata: { tipo: 'perforacion_longhole', dimensiones: '80 m; 4.0 x 4.0 m; -0.3%; intervalo vertical 15-30 m' }
  },
  {
    filename: 'nivel_principal.csv', labor: 'NIVEL_PRINCIPAL', name: 'nivel_principal', origin: base,
    length: 260, width: 6.5, height: 5.5, grade: -0.004, curveAmplitude: 2.5, curveWavelength: 92,
    overbreak: 0.28, services: true,
    metadata: { tipo: 'transporte_principal', dimensiones: '260 m; 6.5 x 5.5 m; -0.4%; galibo peatonal 0.90 m' }
  },
  {
    filename: 'frente_desarrollo.csv', labor: 'FRENTE_DESARROLLO', name: 'frente', origin: base,
    length: 36, width: 4.5, height: 4.5, grade: -0.004, curveAmplitude: 0.25,
    overbreak: 0.30, crownOverbreak: 0.34, services: true, drillingPattern: true, endLayer: 'FRENTE_MALLA_PERFORACION',
    metadata: { tipo: 'frente_ciego', dimensiones: '36 m; 4.5 x 4.5 m; -0.4%; avance 3-4 m/disparo' }
  },
  {
    filename: 'camara_carguio.csv', labor: 'CAMARA_CARGUIO', name: 'camara_carguio', origin: base,
    length: 26, width: 7.0, height: 5.5, profile: 'chamber', grade: -0.003,
    scaleAt: ratio => 0.84 + 0.16 * Math.sin(Math.PI * ratio) ** 0.55,
    overbreak: 0.22, widthVariation: 0.025, heightVariation: 0.025,
    metadata: { tipo: 'estacion_carguio', dimensiones: '26 m; hasta 7.0 x 5.5 m; ensanche de maniobra' }
  },
  {
    filename: 'taller_subterraneo.csv', labor: 'TALLER_SUBTERRANEO', name: 'taller', origin: base,
    length: 38, width: 11.0, height: 7.5, profile: 'chamber', grade: -0.002,
    scaleAt: ratio => 0.84 + 0.16 * Math.sin(Math.PI * ratio) ** 0.45,
    overbreak: 0.24, stationSpacing: 2.0,
    metadata: { tipo: 'infraestructura', dimensiones: '38 m; hasta 11.0 x 7.5 m; cámara trackless' }
  },
  {
    filename: 'estacion_bombeo.csv', labor: 'ESTACION_BOMBEO', name: 'estacion_bombeo', origin: base,
    length: 24, width: 8.0, height: 6.5, profile: 'chamber', grade: -0.004,
    scaleAt: ratio => 0.82 + 0.18 * Math.sin(Math.PI * ratio) ** 0.5,
    overbreak: 0.20,
    metadata: { tipo: 'infraestructura_drenaje', dimensiones: '24 m; hasta 8.0 x 6.5 m; punto bajo de bombeo' }
  },
  {
    filename: 'polvorin.csv', labor: 'POLVORIN', name: 'polvorin', origin: base,
    length: 30, width: 7.0, height: 5.5, profile: 'chamber', grade: -0.003,
    scaleAt: ratio => 0.86 + 0.14 * Math.sin(Math.PI * ratio),
    overbreak: 0.18,
    metadata: { tipo: 'infraestructura_restringida', dimensiones: '30 m; hasta 7.0 x 5.5 m; ventilado y aislado' }
  },
  {
    filename: 'refugio_mineros.csv', labor: 'REFUGIO_MINEROS', name: 'refugio', origin: base,
    length: 20, width: 8.0, height: 6.0, profile: 'chamber', grade: 0,
    scaleAt: ratio => 0.80 + 0.20 * Math.sin(Math.PI * ratio) ** 0.5,
    overbreak: 0.16,
    metadata: { tipo: 'refugio_minero_sellado', dimensiones: '20 m; hasta 8.0 x 6.0 m; cámara de emergencia' }
  },
  {
    filename: 'socavon.csv', labor: 'SOCAVON', name: 'socavon', origin: { x: base.x, y: base.y, z: -18 },
    length: 120, width: 5.0, height: 4.5, grade: -0.004, curveAmplitude: 1.0,
    overbreak: 0.26, services: true, startLayer: 'PORTAL_LUZ_DIA',
    metadata: { tipo: 'acceso_horizontal_superficie', dimensiones: '120 m; 5.0 x 4.5 m; -0.4%' }
  },
  {
    filename: 'cortada.csv', labor: 'CORTADA', name: 'cortada', origin: base,
    length: 85, width: 4.5, height: 4.5, angle: Math.PI / 2, grade: -0.004,
    overbreak: 0.25, services: true,
    metadata: { tipo: 'desarrollo_en_esteril', dimensiones: '85 m; 4.5 x 4.5 m; -0.4%' }
  },
  {
    filename: 'ventana.csv', labor: 'VENTANA', name: 'ventana', origin: base,
    length: 16, width: 4.0, height: 4.0, angle: Math.PI / 2, grade: 0,
    overbreak: 0.18,
    metadata: { tipo: 'conexion_corta', dimensiones: '16 m; 4.0 x 4.0 m; bypass-galería' }
  },
  {
    filename: 'estocada_carguio.csv', labor: 'ESTOCADA_CARGUIO', name: 'estocada', origin: base,
    length: 12, width: 4.0, height: 4.0, angle: Math.PI / 2, grade: -0.003,
    overbreak: 0.20, endLayer: 'TOPE_ESTOCADA',
    metadata: { tipo: 'labor_corta_ciega', dimensiones: '12 m; 4.0 x 4.0 m; carguío/volteo' }
  },
  {
    filename: 'nicho_refugio_peatonal.csv', labor: 'NICHO_REFUGIO_PEATONAL', name: 'nicho_peatonal', origin: base,
    length: 1.8, width: 2.0, height: 2.0, angle: Math.PI / 2, grade: 0,
    overbreak: 0.06, gutter: false, endLayer: 'FONDO_NICHO',
    metadata: { tipo: 'refugio_peatonal', dimensiones: '1.8 m profundidad; 2.0 x 2.0 m; cada ~30 m' }
  },
  {
    filename: 'estacion_nivel.csv', labor: 'ESTACION_NIVEL', name: 'estacion_nivel', origin: base,
    length: 32, width: 7.0, height: 5.5, profile: 'chamber', grade: -0.003,
    scaleAt: ratio => 0.82 + 0.18 * Math.sin(Math.PI * ratio) ** 0.5, overbreak: 0.22,
    metadata: { tipo: 'ensanche_rampa_nivel', dimensiones: '32 m; hasta 7.0 x 5.5 m; cruce de equipos' }
  },
  {
    filename: 'grifo_subterraneo.csv', labor: 'GRIFO_SUBTERRANEO', name: 'grifo', origin: base,
    length: 28, width: 9.0, height: 6.5, profile: 'chamber', grade: -0.002,
    scaleAt: ratio => 0.84 + 0.16 * Math.sin(Math.PI * ratio), overbreak: 0.18,
    metadata: { tipo: 'despacho_combustible', dimensiones: '28 m; hasta 9.0 x 6.5 m; berma de contención' }
  },
  {
    filename: 'subestacion_electrica.csv', labor: 'SUBESTACION_ELECTRICA', name: 'subestacion', origin: base,
    length: 24, width: 8.0, height: 6.0, profile: 'chamber', grade: 0,
    scaleAt: ratio => 0.84 + 0.16 * Math.sin(Math.PI * ratio), overbreak: 0.16,
    metadata: { tipo: 'infraestructura_electrica', dimensiones: '24 m; hasta 8.0 x 6.0 m' }
  },
  {
    filename: 'sala_chancado.csv', labor: 'SALA_CHANCADO', name: 'chancado', origin: base,
    length: 34, width: 12.0, height: 8.0, profile: 'chamber', grade: -0.003,
    scaleAt: ratio => 0.82 + 0.18 * Math.sin(Math.PI * ratio), overbreak: 0.24,
    metadata: { tipo: 'infraestructura_proceso', dimensiones: '34 m; hasta 12.0 x 8.0 m' }
  },
  {
    filename: 'poza_sedimentacion.csv', labor: 'POZA_SEDIMENTACION', name: 'poza', origin: base,
    length: 18, width: 6.0, height: 4.5, profile: 'chamber', grade: -0.005,
    scaleAt: ratio => 0.86 + 0.14 * Math.sin(Math.PI * ratio), overbreak: 0.16,
    metadata: { tipo: 'drenaje', dimensiones: '18 m; hasta 6.0 x 4.5 m; punto bajo' }
  }
];

horizontalExcavations.forEach(createHorizontal);

const verticalExcavations = [
  {
    filename: 'chimenea.csv', labor: 'CHIMENEA', name: 'chimenea', origin: base,
    height: 60, radiusX: 1.50, radiusY: 1.50, sides: 20, stationSpacing: 2.0,
    overbreak: 0.20, drift: 0.20, wallLayer: 'PARED_CHIMENEA_CONVENCIONAL',
    metadata: { tipo: 'conexion_vertical', dimensiones: '60 m; diámetro 3.0 m; convencional irregular' }
  },
  {
    filename: 'chimenea_ventilacion.csv', labor: 'CHIMENEA_VENTILACION', name: 'chimenea_vent', origin: base,
    height: 80, radiusX: 1.75, radiusY: 1.75, sides: 24, stationSpacing: 2.0,
    overbreak: 0.025, drift: 0.025, wallLayer: 'PARED_RAISE_BORED_LISA',
    metadata: { tipo: 'ventilacion_raise_bore', dimensiones: '80 m; diámetro 3.5 m; raise-bored' }
  },
  {
    filename: 'pique.csv', labor: 'PIQUE', name: 'pique', origin: { ...base, z: -320 },
    height: 120, radiusX: 2.75, radiusY: 2.75, sides: 24, stationSpacing: 2.5,
    overbreak: 0.035, drift: 0.04, wallLayer: 'REVESTIMIENTO_PIQUE', topLayer: 'COLLAR_PIQUE',
    metadata: { tipo: 'acceso_vertical_izaje', dimensiones: '120 m; diámetro 5.5 m' }
  },
  {
    filename: 'echadero_mineral.csv', labor: 'ECHADERO_MINERAL', name: 'ore_pass', origin: base,
    height: 60, radiusX: 1.50, radiusY: 1.50, sides: 20, stationSpacing: 1.5,
    overbreak: 0.16, drift: 0.16, wallLayer: 'PARED_ECHADERO_DESGASTADA',
    radiusAt: ratio => 1 + 0.08 * Math.sin(ratio * Math.PI * 3),
    metadata: { tipo: 'manejo_mineral', dimensiones: '60 m; diámetro 3.0 m; ore pass vertical' }
  },
  {
    filename: 'slot_raise.csv', labor: 'SLOT_RAISE', name: 'slot_raise', origin: base,
    height: 30, radiusX: 1.0, radiusY: 1.0, sides: 16, stationSpacing: 1.5,
    overbreak: 0.10, drift: 0.08, wallLayer: 'CARA_LIBRE_SLOT',
    metadata: { tipo: 'chimenea_corte_longhole', dimensiones: '30 m; diámetro 2.0 m; cara libre inicial' }
  },
  {
    filename: 'camino_escape.csv', labor: 'CAMINO_ESCAPE', name: 'camino_escape', origin: base,
    height: 45, radiusX: 2.121, radiusY: 2.121, sides: 4, startAngle: Math.PI / 4, stationSpacing: 1.5,
    overbreak: 0.08, drift: 0.06, wallLayer: 'PARED_CAMINO_3x3',
    metadata: { tipo: 'escape_personal', dimensiones: '45 m; sección cuadrada 3.0 x 3.0 m; escaleras/plataformas' }
  }
];

verticalExcavations.forEach(createVertical);

{
  const mesh = new Mesh('BY_PASS', 11);
  for (const [name, offset] of [['bypass_aire_fresco', -7.5], ['bypass_retorno', 7.5]]) {
    addSweptExcavation(mesh, {
      name, origin: { x: base.x, y: base.y + offset, z: base.z }, length: 120,
      width: 5.0, height: 4.5, grade: -0.004, curveAmplitude: 1.1, curveWavelength: 70,
      overbreak: 0.24, services: true
    });
  }
  for (const [index, station] of [30, 60, 90].entries()) {
    addSweptExcavation(mesh, {
      name: `ventana_${index + 1}`, origin: { x: base.x + station, y: base.y - 7.5, z: base.z - 0.004 * station },
      length: 15, width: 4.0, height: 4.0, angle: Math.PI / 2, grade: 0,
      overbreak: 0.18, startLayer: 'BOCA_VENTANA', endLayer: 'BOCA_VENTANA'
    });
  }
  writeMesh('by_pass.csv', mesh, { tipo: 'bypass_doble_ventilacion', dimensiones: '2 x 120 m; 5.0 x 4.5 m; separación 15 m; 3 ventanas' });
}

{
  const mesh = new Mesh('TAJO_SUBNIVELES_LONGHOLE', 12);
  addSweptExcavation(mesh, {
    name: 'vacio_tajeo', origin: base, length: 36, width: 14, height: 30, profile: 'stope', grade: 0,
    overbreak: 0.18, crownOverbreak: 0.12, widthVariation: 0.018, heightVariation: 0.015,
    stationSpacing: 1.5, startLayer: 'EXTREMO_SLOT', endLayer: 'FRENTE_RETIRADA'
  });
  addVerticalExcavation(mesh, {
    name: 'slot_integrado', origin: { x: base.x + 1.5, y: base.y, z: base.z }, height: 30,
    radiusX: 1.0, radiusY: 1.0, sides: 16, stationSpacing: 1.5, overbreak: 0.08, drift: 0.04,
    wallLayer: 'SLOT_CARA_LIBRE', bottomLayer: 'SLOT_BASE', topLayer: 'SLOT_CABEZA'
  });
  for (const [index, x] of [8, 18, 28].entries()) {
    addSweptExcavation(mesh, {
      name: `drawpoint_${index + 1}`, origin: { x: base.x + x, y: base.y - 16, z: base.z - 0.2 },
      length: 18, width: 4.5, height: 4.5, angle: Math.PI / 2, grade: 0.01,
      overbreak: 0.20, startLayer: 'CRUCERO_EXTRACCION', endLayer: 'BROW_DRAWPOINT'
    });
    addVerticalExcavation(mesh, {
      name: `muck_${index + 1}`, origin: { x: base.x + x, y: base.y - 0.5, z: base.z }, height: 2.2,
      radiusX: 2.1, radiusY: 1.8, sides: 14, stationSpacing: 0.55, overbreak: 0.16, drift: 0,
      radiusAt: ratio => 1 - 0.78 * ratio, wallLayer: 'MUCK_PILE', bottomLayer: 'MUCK_BASE', topLayer: 'MUCK_CIMA'
    });
  }
  for (const [index, elevation] of [0, 15, 30].entries()) {
    addSweptExcavation(mesh, {
      name: `subnivel_perforacion_${index + 1}`, origin: { x: base.x, y: base.y + 8, z: base.z + elevation },
      length: 36, width: 4.0, height: 4.0, angle: 0, grade: 0,
      overbreak: 0.16, startLayer: 'BOCA_SUBNIVEL', endLayer: 'TOPE_SUBNIVEL'
    });
  }
  writeMesh('tajo_subniveles.csv', mesh, { tipo: 'sublevel_longhole_stoping', dimensiones: 'tajeo 36 x 14 x 30 m; slot 2.0 m; 3 drawpoints; subniveles cada 15 m' });
}

{
  const mesh = new Mesh('TAJO_CORTE_RELLENO', 12);
  addSweptExcavation(mesh, {
    name: 'tajo_corte_relleno', origin: base, length: 30, width: 8.0, height: 20, profile: 'stope', grade: 0,
    overbreak: 0.20, widthVariation: 0.02, heightVariation: 0.02, stationSpacing: 1.5,
    startLayer: 'EXTREMO_TAJO', endLayer: 'FRENTE_TAJO'
  });
  writeMesh('tajo_corte_relleno.csv', mesh, { tipo: 'tajo_tabular', dimensiones: '30 x 8 x 20 m; dentro de rango 5-20 x 15-40 x 15-40 m' });
}

{
  const mesh = new Mesh('INTERSECCION_4_VIAS', 10);
  addSweptExcavation(mesh, {
    name: 'interseccion_x', origin: { x: base.x - 28, y: base.y, z: base.z }, length: 56,
    width: 4.5, height: 4.5, angle: 0, grade: -0.003, curveAmplitude: 0.12, overbreak: 0.24
  });
  addSweptExcavation(mesh, {
    name: 'interseccion_y', origin: { x: base.x, y: base.y - 28, z: base.z }, length: 56,
    width: 4.5, height: 4.5, angle: Math.PI / 2, grade: -0.003, curveAmplitude: 0.12, overbreak: 0.24
  });
  addSweptExcavation(mesh, {
    name: 'refuerzo_central', origin: { x: base.x - 6, y: base.y, z: base.z }, length: 12,
    width: 5.4, height: 5.4, profile: 'chamber', angle: 0, grade: 0,
    scaleAt: ratio => 0.92 + 0.08 * Math.sin(Math.PI * ratio), overbreak: 0.16,
    startLayer: 'BOCA_REFORZADA', endLayer: 'BOCA_REFORZADA'
  });
  writeMesh('interseccion_4_vias.csv', mesh, { tipo: 'conexion_reforzada', dimensiones: 'galerías 4.5 x 4.5 m; zona central +20% = 5.4 x 5.4 m' });
}

{
  const mesh = new Mesh('TOLVA_DRAWPOINT', 9);
  addSweptExcavation(mesh, {
    name: 'drawpoint_acceso', origin: { x: base.x, y: base.y, z: base.z }, length: 24,
    width: 4.5, height: 4.5, angle: 0, grade: -0.004, curveAmplitude: 0.2, overbreak: 0.22,
    endLayer: 'FRENTE_DRAWPOINT'
  });
  addVerticalExcavation(mesh, {
    name: 'campana_tolva', origin: { x: base.x + 20, y: base.y, z: base.z + 3.0 }, height: 15,
    radiusX: 1.5, radiusY: 1.5, sides: 20, stationSpacing: 1.0, overbreak: 0.12, drift: 0.05,
    radiusAt: ratio => 1 + 0.50 * ratio ** 1.7,
    wallLayer: 'CAMPANA_EXTRACCION', bottomLayer: 'BOCA_DESCARGA', topLayer: 'PARRILLA_TOLVA'
  });
  writeMesh('tolva_drawpoint.csv', mesh, { tipo: 'extraccion', dimensiones: 'acceso 24 m; 4.5 x 4.5 m; campana 15 m; diámetro 3.0-4.5 m' });
}

const summaryLines = [
  'ARCHIVO,TIPO,DIMENSIONES,ESCALA,UNIDAD,EJE_VERTICAL,REFERENCIA,TRIANGULOS,MIN_X,MAX_X,MIN_Y,MAX_Y,MIN_Z,MAX_Z',
  ...summaries.map(item => [
    item.filename, item.tipo, item.dimensiones, '1:1', 'm', 'Z', '.claude/commands/mina-3d-trackless.md', item.triangles,
    item.bounds.x[0].toFixed(3), item.bounds.x[1].toFixed(3),
    item.bounds.y[0].toFixed(3), item.bounds.y[1].toFixed(3),
    item.bounds.z[0].toFixed(3), item.bounds.z[1].toFixed(3)
  ].join(','))
];
writeFileSync(join(OUTPUT_DIR, '_catalogo.csv'), `${summaryLines.join('\n')}\n`, 'utf8');

console.table(summaries.map(item => ({
  archivo: item.filename,
  triangulos: item.triangles,
  x: (item.bounds.x[1] - item.bounds.x[0]).toFixed(1),
  y: (item.bounds.y[1] - item.bounds.y[0]).toFixed(1),
  z: (item.bounds.z[1] - item.bounds.z[0]).toFixed(1)
})));
console.log(`Generados ${summaries.length} elementos en ${OUTPUT_DIR}`);
