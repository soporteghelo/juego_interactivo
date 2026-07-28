import * as THREE from 'three';

export const COMPLETE_MINE_HEADER = [
  'TRIANGLE', 'XP1', 'YP1', 'ZP1', 'XP2', 'YP2', 'ZP2', 'XP3', 'YP3', 'ZP3',
  'COLOUR', 'LAYERS', 'LABOR', 'LINK'
].join(',');

const SERVICE_LAYER = /MANGA|TUBERIA|CABLE|PLACA_PERNO|COLLAR_|PARRILLA|REVESTIMIENTO_PIQUE/;
const FLOOR_LAYER = /PISO_RASANTE|MURO_PISO|CAJA_PISO|MARINA_BASE|MUCK_BASE|SLOT_BASE/;

const COLORS = {
  floor: new THREE.Color(0x49443d),
  gutter: new THREE.Color(0x252c2c),
  shotcrete: new THREE.Color(0x9b9991),
  rock: new THREE.Color(0x746655),
  mineral: new THREE.Color(0x7c6045),
  muck: new THREE.Color(0x614a35),
  bolt: new THREE.Color(0xd6a54a),
  water: new THREE.Color(0x419bc5),
  air: new THREE.Color(0xc65d4e),
  cable: new THREE.Color(0x252629),
  ventilation: new THREE.Color(0xd89d35),
  collar: new THREE.Color(0x27292b),
  lining: new THREE.Color(0x777b7b)
};

export function isCompleteMineServiceLayer(layer) {
  return SERVICE_LAYER.test(layer);
}

export function isCompleteMineFloorLayer(layer) {
  return FLOOR_LAYER.test(layer);
}

/**
 * Retira solamente caras casi verticales que atraviesan un punto de empalme entre labores.
 * Los CSV individuales son tuneles cerrados; al superponerlos, sus hastiales terminales
 * quedaban dentro de la via receptora. Piso y corona se conservan para no crear caidas.
 */
export function carveCompleteMinePortals(positions, colors, portals) {
  if (!positions.length || !portals?.length) return { positions, colors, removed: 0 };
  const carvedPositions = [];
  const carvedColors = [];
  let removed = 0;
  for (let offset = 0; offset < positions.length; offset += 9) {
    const ax = positions[offset], ay = positions[offset + 1], az = positions[offset + 2];
    const bx = positions[offset + 3], by = positions[offset + 4], bz = positions[offset + 5];
    const cx = positions[offset + 6], cy = positions[offset + 7], cz = positions[offset + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    const verticalFace = Math.abs(ny / normalLength) < 0.78;
    const centerX = (ax + bx + cx) / 3;
    const centerY = (ay + by + cy) / 3;
    const centerZ = (az + bz + cz) / 3;
    let remove = false;
    if (verticalFace) for (const portal of portals) {
      const dx = centerX - portal.x;
      const dz = centerZ - portal.z;
      if (
        dx * dx + dz * dz <= portal.radius * portal.radius &&
        centerY >= portal.y - 0.75 && centerY <= portal.y + portal.height
      ) {
        remove = true;
        break;
      }
    }
    if (remove) { removed++; continue; }
    for (let index = 0; index < 9; index++) {
      carvedPositions.push(positions[offset + index]);
      carvedColors.push(colors[offset + index]);
    }
  }
  return { positions: carvedPositions, colors: carvedColors, removed };
}

function layerColor(layer, colour) {
  if (layer.includes('MANGA')) return COLORS.ventilation;
  if (layer.includes('TUBERIA_AGUA')) return COLORS.water;
  if (layer.includes('TUBERIA_AIRE')) return COLORS.air;
  if (layer.includes('CABLE')) return COLORS.cable;
  if (layer.includes('PLACA_PERNO') || colour === 6) return COLORS.bolt;
  if (layer.includes('COLLAR')) return COLORS.collar;
  if (layer.includes('CUNETA')) return COLORS.gutter;
  if (layer.includes('PISO') || layer.includes('MURO_PISO')) return COLORS.floor;
  if (layer.includes('MUCK') || layer.includes('MARINA')) return COLORS.muck;
  if (layer.includes('SHOTCRETE') || layer.includes('CORONA') || layer.includes('RINON')) return COLORS.shotcrete;
  if (layer.includes('REVESTIMIENTO')) return COLORS.lining;
  if (layer.includes('TAJO') || layer.includes('CAJA_')) return COLORS.mineral;
  return COLORS.rock;
}

function emptyBucket(id) {
  return {
    id,
    rockPositions: [], rockColors: [], servicePositions: [], serviceColors: [],
    floorVisualPositions: [], floorVisualColors: [],
    floorPositions: [], triangles: 0,
    bounds: new THREE.Box3()
  };
}

function pushWorldVertex(target, x, north, elevation) {
  // CSV topografico: X=Este, Y=Norte, Z=cota. Three.js: X=Este, Y=cota, Z=-Norte.
  target.push(x, elevation, -north);
}

/**
 * Lee el CSV maestro sin alterar escala ni coordenadas. Se separa por labor para que el
 * streaming pueda ocultar emplazamientos lejanos y para crear colisionadores independientes.
 */
export async function parseCompleteMineCsv(csvText, plan, { onProgress = () => {}, yieldEvery = 8000 } = {}) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.shift()?.replace(/^\uFEFF/, '') !== COMPLETE_MINE_HEADER) {
    throw new Error('[Mina completa] Encabezado CSV incompatible');
  }

  const buckets = new Map(plan.map(item => [item.id, emptyBucket(item.id)]));
  const globalBounds = new THREE.Box3();
  const point = new THREE.Vector3();

  for (let row = 0; row < lines.length; row++) {
    const values = lines[row].split(',');
    if (values.length !== 14) throw new Error(`[Mina completa] Fila ${row + 2} incompleta`);
    const bucket = buckets.get(values[12]);
    if (!bucket) throw new Error(`[Mina completa] Labor desconocida: ${values[12]}`);
    const layer = values[11];
    const service = isCompleteMineServiceLayer(layer);
    const floor = isCompleteMineFloorLayer(layer);
    const floorVisual = floor || layer.includes('CUNETA');
    const positions = service
      ? bucket.servicePositions
      : (floorVisual ? bucket.floorVisualPositions : bucket.rockPositions);
    const colors = service
      ? bucket.serviceColors
      : (floorVisual ? bucket.floorVisualColors : bucket.rockColors);
    const color = layerColor(layer, Number(values[10]));

    for (let vertex = 0; vertex < 3; vertex++) {
      const x = Number(values[1 + vertex * 3]);
      const north = Number(values[2 + vertex * 3]);
      const elevation = Number(values[3 + vertex * 3]);
      if (![x, north, elevation].every(Number.isFinite)) {
        throw new Error(`[Mina completa] Coordenada no numerica en fila ${row + 2}`);
      }
      pushWorldVertex(positions, x, north, elevation);
      colors.push(color.r, color.g, color.b);
      point.set(x, elevation, -north);
      if (floor) bucket.floorPositions.push(x, elevation, -north);
      bucket.bounds.expandByPoint(point);
      globalBounds.expandByPoint(point);
    }
    bucket.triangles++;

    if (yieldEvery > 0 && row > 0 && row % yieldEvery === 0) {
      onProgress(row, lines.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  onProgress(lines.length, lines.length);
  return { buckets, triangles: lines.length, bounds: globalBounds };
}

export function geometryFromCompleteMineBucket(positions, colors, { withUvs = true } = {}) {
  if (!positions.length) return null;
  let uvs = null;

  // Proyeccion UV por plano dominante, triangulo a triangulo. La mina maestra llega como
  // posiciones topograficas sin UV; sin esta capa el material solo podia mostrar colores
  // planos. Elegir el plano segun la normal evita estirar la textura en pisos y hastiales.
  if (withUvs) {
    uvs = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const textureScale = 3.6;
    for (let offset = 0; offset < positions.length; offset += 9) {
      a.fromArray(positions, offset);
      b.fromArray(positions, offset + 3);
      c.fromArray(positions, offset + 6);
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
      const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
      if (ay >= ax && ay >= az) {
        uvs.push(a.x / textureScale, a.z / textureScale,
          b.x / textureScale, b.z / textureScale,
          c.x / textureScale, c.z / textureScale);
      } else if (ax >= az) {
        uvs.push(a.z / textureScale, a.y / textureScale,
          b.z / textureScale, b.y / textureScale,
          c.z / textureScale, c.y / textureScale);
      } else {
        uvs.push(a.x / textureScale, a.y / textureScale,
          b.x / textureScale, b.y / textureScale,
          c.x / textureScale, c.y / textureScale);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
