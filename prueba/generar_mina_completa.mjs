import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPLETE_MINE_EXPECTED_PLACEMENTS,
  COMPLETE_MINE_PLAN,
  COMPLETE_MINE_SOURCE_ELEMENTS
} from '../src/world/complete/CompleteMinePlan.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ELEMENTS_DIR = join(ROOT, 'elementos');
const OUTPUT_FILE = join(ELEMENTS_DIR, '_mina_completa.csv');
const LAYOUT_FILE = join(ELEMENTS_DIR, '_mina_completa_layout.csv');
const HEADER = ['TRIANGLE', 'XP1', 'YP1', 'ZP1', 'XP2', 'YP2', 'ZP2', 'XP3', 'YP3', 'ZP3', 'COLOUR', 'LAYERS', 'LABOR', 'LINK'];

if (COMPLETE_MINE_PLAN.length !== COMPLETE_MINE_EXPECTED_PLACEMENTS) {
  throw new Error(`Plano incompleto: ${COMPLETE_MINE_PLAN.length}/${COMPLETE_MINE_EXPECTED_PLACEMENTS} emplazamientos`);
}
const ids = new Set(COMPLETE_MINE_PLAN.map(item => item.id));
const files = new Set(COMPLETE_MINE_PLAN.map(item => item.file));
if (ids.size !== COMPLETE_MINE_PLAN.length) throw new Error('El plano contiene IDs duplicados');
if (files.size !== COMPLETE_MINE_SOURCE_ELEMENTS) {
  throw new Error(`El plano debe usar los ${COMPLETE_MINE_SOURCE_ELEMENTS} CSV fuente; usa ${files.size}`);
}

const output = [HEADER.join(',')];
const layout = ['ID,ARCHIVO,ETIQUETA,TIPO,NIVEL,POS_X,POS_Y,COTA_Z,ROTACION_GRADOS,TRIANGULOS,MIN_X,MAX_X,MIN_Y,MAX_Y,MIN_Z,MAX_Z'];
let triangleNumber = 1;
let totalTriangles = 0;
const globalBounds = {
  minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity
};

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function updateBounds(bounds, x, y, z) {
  bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
  bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
}

for (const item of COMPLETE_MINE_PLAN) {
  const text = readFileSync(join(ELEMENTS_DIR, item.file), 'utf8').trim();
  const rows = text.split(/\r?\n/);
  const header = rows.shift().split(',');
  if (header.length !== HEADER.length || header.some((value, index) => value !== HEADER[index])) {
    throw new Error(`${item.file}: encabezado incompatible`);
  }

  const radians = item.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const removed = new Set(item.removeLayers || []);
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  let placedTriangles = 0;

  for (const row of rows) {
    const values = row.split(',');
    if (values.length !== HEADER.length) throw new Error(`${item.file}: fila incompleta`);
    const layer = values[11];
    if (removed.has(layer)) continue;
    const transformed = [];
    for (let vertex = 0; vertex < 3; vertex++) {
      const x = Number(values[1 + vertex * 3]) - item.origin[0];
      const y = Number(values[2 + vertex * 3]) - item.origin[1];
      const z = Number(values[3 + vertex * 3]) - item.origin[2];
      if (![x, y, z].every(Number.isFinite)) throw new Error(`${item.file}: coordenada no numérica`);
      const worldX = item.position[0] + x * cos - y * sin;
      const worldY = item.position[1] + x * sin + y * cos;
      const worldZ = item.position[2] + z;
      transformed.push(worldX.toFixed(3), worldY.toFixed(3), worldZ.toFixed(3));
      updateBounds(bounds, worldX, worldY, worldZ);
      updateBounds(globalBounds, worldX, worldY, worldZ);
    }
    output.push([
      triangleNumber++, ...transformed, values[10], layer, item.id, `${item.file}:${values[13]}`
    ].join(','));
    placedTriangles++;
  }

  totalTriangles += placedTriangles;
  layout.push([
    item.id, item.file, csvCell(item.label), csvCell(item.type), csvCell(item.level),
    item.position[0], item.position[1], item.position[2], item.rotation, placedTriangles,
    bounds.minX.toFixed(3), bounds.maxX.toFixed(3), bounds.minY.toFixed(3), bounds.maxY.toFixed(3), bounds.minZ.toFixed(3), bounds.maxZ.toFixed(3)
  ].join(','));
}

writeFileSync(OUTPUT_FILE, `${output.join('\n')}\n`, 'utf8');
writeFileSync(LAYOUT_FILE, `${layout.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  output: OUTPUT_FILE,
  layout: LAYOUT_FILE,
  placements: COMPLETE_MINE_PLAN.length,
  sourceElements: files.size,
  triangles: totalTriangles,
  bounds: globalBounds,
  scale: '1:1 m'
}, null, 2));
