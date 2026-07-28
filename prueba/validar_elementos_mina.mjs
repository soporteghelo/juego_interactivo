import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIRECTORY = join(ROOT, 'elementos');
const EXPECTED_HEADER = ['TRIANGLE', 'XP1', 'YP1', 'ZP1', 'XP2', 'YP2', 'ZP2', 'XP3', 'YP3', 'ZP3', 'COLOUR', 'LAYERS', 'LABOR', 'LINK'];
const files = readdirSync(DIRECTORY)
  .filter(name => name.endsWith('.csv') && !name.startsWith('_'))
  .sort((a, b) => a.localeCompare(b, 'es'));
const errors = [];
const results = [];
const scaleChecks = new Map([
  ['bocamina.csv', [5.0, 5.35]],
  ['galeria.csv', [4.5, 4.85]],
  ['galeria_wireframe_simulada.csv', [4.5, 4.85]],
  ['crucero.csv', [4.5, 4.85]],
  ['rampa.csv', [5.0, 5.35]],
  ['subnivel.csv', [4.0, 4.35]],
  ['nivel_principal.csv', [6.5, 5.85]],
  ['frente_desarrollo.csv', [4.5, 4.85]],
  ['socavon.csv', [5.0, 4.85]],
  ['cortada.csv', [4.5, 4.85]],
  ['ventana.csv', [4.0, 4.35]],
  ['estocada_carguio.csv', [4.0, 4.35]],
  ['nicho_refugio_peatonal.csv', [2.0, 2.0]]
]);

function area(values) {
  const [ax, ay, az, bx, by, bz, cx, cy, cz] = values;
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

for (const file of files) {
  const lines = readFileSync(join(DIRECTORY, file), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  if (header.join('|') !== EXPECTED_HEADER.join('|')) errors.push(`${file}: encabezado incompatible`);

  const bounds = {
    minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY, maxZ: Number.NEGATIVE_INFINITY
  };
  const layers = new Set();
  const labors = new Set();
  const firstSectionPoints = [];
  let minimumArea = Number.POSITIVE_INFINITY;
  let invalidRows = 0;

  for (let index = 1; index < lines.length; index++) {
    const cells = lines[index].split(',');
    if (cells.length !== 14 || Number(cells[0]) !== index) {
      invalidRows++;
      continue;
    }
    const coordinates = cells.slice(1, 10).map(Number);
    if (!coordinates.every(Number.isFinite)) {
      invalidRows++;
      continue;
    }
    const triangleArea = area(coordinates);
    minimumArea = Math.min(minimumArea, triangleArea);
    if (triangleArea < 1e-5) invalidRows++;
    for (let vertex = 0; vertex < 3; vertex++) {
      const x = coordinates[vertex * 3];
      const y = coordinates[vertex * 3 + 1];
      const z = coordinates[vertex * 3 + 2];
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
      bounds.minZ = Math.min(bounds.minZ, z);
      bounds.maxZ = Math.max(bounds.maxZ, z);
    }
    layers.add(cells[11]);
    labors.add(cells[12]);
    if (cells[13] === '1' && !/MANGA_|TUBERIA_|CABLES_|COLLAR_|MARINA_/.test(cells[11])) {
      for (let vertex = 0; vertex < 3; vertex++) {
        firstSectionPoints.push({ x: coordinates[vertex * 3], y: coordinates[vertex * 3 + 1], z: coordinates[vertex * 3 + 2] });
      }
    }
  }

  const triangles = lines.length - 1;
  const extents = [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ];
  if (triangles < 100) errors.push(`${file}: solo ${triangles} triángulos`);
  if (invalidRows) errors.push(`${file}: ${invalidRows} filas inválidas`);
  if (labors.size !== 1) errors.push(`${file}: LABOR no es uniforme`);
  if (layers.size < 2) errors.push(`${file}: faltan capas de superficie`);
  if (extents.filter(value => value > 0.5).length < 3) errors.push(`${file}: volumen sin extensión tridimensional`);

  let scaleStatus = 'n/a';
  if (scaleChecks.has(file) && firstSectionPoints.length) {
    const [expectedWidth, expectedHeight] = scaleChecks.get(file);
    const sectionX = Math.max(...firstSectionPoints.map(value => value.x)) - Math.min(...firstSectionPoints.map(value => value.x));
    const sectionY = Math.max(...firstSectionPoints.map(value => value.y)) - Math.min(...firstSectionPoints.map(value => value.y));
    const sectionZ = Math.max(...firstSectionPoints.map(value => value.z)) - Math.min(...firstSectionPoints.map(value => value.z));
    const measuredWidth = Math.max(sectionX, sectionY);
    if (Math.abs(measuredWidth - expectedWidth) > 0.85 || Math.abs(sectionZ - expectedHeight) > 0.85) {
      errors.push(`${file}: escala de sección fuera de tolerancia (${measuredWidth.toFixed(2)} x ${sectionZ.toFixed(2)} m)`);
      scaleStatus = 'ERROR';
    } else {
      scaleStatus = `${measuredWidth.toFixed(2)}x${sectionZ.toFixed(2)}m`;
    }
  }

  results.push({
    archivo: file,
    triangulos: triangles,
    capas: layers.size,
    labor: [...labors].join('|'),
    escala: scaleStatus,
    areaMin: minimumArea.toFixed(5),
    x: extents[0].toFixed(1),
    y: extents[1].toFixed(1),
    z: extents[2].toFixed(1)
  });
}

const catalogLines = readFileSync(join(DIRECTORY, '_catalogo.csv'), 'utf8').trim().split(/\r?\n/);
const catalogHeader = catalogLines[0].split(',');
for (const required of ['ESCALA', 'UNIDAD', 'EJE_VERTICAL', 'REFERENCIA']) {
  if (!catalogHeader.includes(required)) errors.push(`_catalogo.csv: falta columna ${required}`);
}
const scaleIndex = catalogHeader.indexOf('ESCALA');
const unitIndex = catalogHeader.indexOf('UNIDAD');
const axisIndex = catalogHeader.indexOf('EJE_VERTICAL');
if (catalogLines.length - 1 !== files.length) errors.push('_catalogo.csv: cantidad de elementos inconsistente');
for (const line of catalogLines.slice(1)) {
  const cells = line.split(',');
  if (cells[scaleIndex] !== '1:1' || cells[unitIndex] !== 'm' || cells[axisIndex] !== 'Z') {
    errors.push(`_catalogo.csv: convención de escala inválida en ${cells[0]}`);
  }
}

console.table(results);
console.log(`${files.length} archivos revisados; ${results.reduce((sum, item) => sum + item.triangulos, 0).toLocaleString('es-PE')} triángulos.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('VALIDACIÓN OK: esquema, valores, áreas, capas y volúmenes correctos.');
}
