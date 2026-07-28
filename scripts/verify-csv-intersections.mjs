import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCsvIntersectionGeometry, CSV_INTERSECTION_WIDTH } from '../src/world/grid/CsvIntersectionGeometry.js';
import { GridLayoutGenerator } from '../src/world/grid/GridLayoutGenerator.js';
import { DIM, ANCHO_MINIMO_LABOR, ANCHO_PASO_INTERSECCION, EQUIPO_MAS_ANCHO, PASO_PEATONAL } from '../src/world/grid/MinePlan.js';
import { Rng } from '../src/procedural/Rng.js';

const csvPath = new URL('../prueba/elementos/interseccion_4_vias.csv', import.meta.url);
const csvText = fs.readFileSync(csvPath, 'utf8');
const sourceLines = csvText.trim().split(/\r?\n/);
assert.equal(sourceLines.length - 1, 6164, 'El CSV fuente debe conservar sus 6,164 triangulos');

const asset = buildCsvIntersectionGeometry(csvText, { halfSize: 5 });
const positions = asset.geometry.getAttribute('position');
const uvs = asset.geometry.getAttribute('uv');
assert.ok(positions.count > 0 && positions.count % 3 === 0, 'La malla central debe contener triangulos');
assert.equal(asset.metadata.sourceTriangles, 6164);
assert.equal(asset.metadata.scale, '1:1 en cota');
assert.equal(asset.metadata.passageWidth, ANCHO_PASO_INTERSECCION);
assert.equal(asset.metadata.halfSize, 5);
assert.equal(asset.geometry.boundingBox.min.x, -5);
assert.equal(asset.geometry.boundingBox.max.x, 5);
assert.equal(asset.geometry.boundingBox.min.z, -5);
assert.equal(asset.geometry.boundingBox.max.z, 5);
assert.ok(asset.geometry.boundingBox.max.y >= 5.4, 'Debe conservar la corona reforzada de 5.4 m');
assert.ok(asset.metadata.removedNested > 0, 'Deben eliminarse las envolventes internas superpuestas');

let degenerateTriangles = 0;
let degenerateUvs = 0;
let longestEdge = 0;
let worstAspect = 0;
for (let vertex = 0; vertex < positions.count; vertex += 3) {
  const points = [0, 1, 2].map(offset => [
    positions.getX(vertex + offset), positions.getY(vertex + offset), positions.getZ(vertex + offset)
  ]);
  const edges = points.map((point, index) => {
    const next = points[(index + 1) % 3];
    return Math.hypot(point[0] - next[0], point[1] - next[1], point[2] - next[2]);
  });
  longestEdge = Math.max(longestEdge, ...edges);
  worstAspect = Math.max(worstAspect, Math.max(...edges) / Math.min(...edges));
  const ab = points[1].map((value, index) => value - points[0][index]);
  const ac = points[2].map((value, index) => value - points[0][index]);
  const area = Math.hypot(
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ) / 2;
  if (area < 1e-4) degenerateTriangles++;
  const uv = [0, 1, 2].map(offset => [uvs.getX(vertex + offset), uvs.getY(vertex + offset)]);
  const uvArea = Math.abs(
    (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) -
    (uv[1][1] - uv[0][1]) * (uv[2][0] - uv[0][0])
  ) / 2;
  if (uvArea < 1e-8) degenerateUvs++;
}
assert.equal(degenerateTriangles, 0, 'No debe haber triangulos geometricos degenerados');
assert.equal(degenerateUvs, 0, 'No debe haber UVs degenerados que estiren la textura');
// El limite de 3 m del archivo original viaja con el estirado en planta del cruce (el ancho de
// paso se amplio para que el peaton circule junto al scoop), asi que el tope se escala igual.
const topeArista = 3 * Math.max(asset.metadata.scaleX, asset.metadata.scaleZ);
assert.ok(longestEdge < topeArista, `Arista excesiva: ${longestEdge.toFixed(3)} m (tope ${topeArista.toFixed(3)} m)`);
assert.ok(worstAspect <= 80.01, `Triangulo aguja: relacion ${worstAspect.toFixed(1)}`);

for (const direction of ['N', 'S', 'E', 'W']) {
  const capTriangles = asset.capGeometries[direction].getAttribute('position').count / 3;
  assert.equal(capTriangles, 27, `La tapa ${direction} debe proceder completa del CSV`);
}

const layout = new GridLayoutGenerator(new Rng(1600)).generate();
const intersections = layout.nodes.filter(node => node.kind !== 'room');
assert.ok(intersections.length >= 50, 'La prueba debe cubrir la reticula completa');
const fourWay = intersections.filter(node => node.edges.length === 4).length;
assert.ok(fourWay > 0, 'El plano debe contener cruces de cuatro vias');

// ── SECCION TRANSITABLE: el peaton debe poder pasar POR EL COSTADO del scoop en cualquier
// labor y en cualquier cruce, para varias semillas (el jitter de seccion es aleatorio).
const anchoLibreMinimo = EQUIPO_MAS_ANCHO + PASO_PEATONAL;   // 4.15 m de calzada util
for (const dim of Object.values(DIM)) {
  assert.ok(dim.width >= ANCHO_MINIMO_LABOR, `Seccion nominal insuficiente: ${dim.width} m`);
  assert.ok(dim.height <= 5.4, `La labor no puede ser mas alta que la corona del cruce: ${dim.height} m`);
}
assert.ok(CSV_INTERSECTION_WIDTH >= ANCHO_MINIMO_LABOR, 'El cruce es mas angosto que la labor');
for (const semilla of [1, 7, 1600, 24601]) {
  for (const edge of new GridLayoutGenerator(new Rng(semilla)).generate().edges) {
    assert.ok(
      edge.width - EQUIPO_MAS_ANCHO >= PASO_PEATONAL,
      `${edge.id}: ${edge.width} m no deja pasar al peaton junto al scoop (min ${anchoLibreMinimo} m)`
    );
    assert.ok(
      edge.width <= ANCHO_PASO_INTERSECCION,
      `${edge.id}: ${edge.width} m supera la boca del cruce (${ANCHO_PASO_INTERSECCION} m)`
    );
    assert.ok(edge.variant?.rockType, `${edge.id}: sin variante de caja (todas las labores se verian iguales)`);
  }
}

const assemblerSource = fs.readFileSync(new URL('../src/world/grid/GridAssembler.js', import.meta.url), 'utf8');
const segmentSource = fs.readFileSync(new URL('../src/world/grid/CsvIntersectionSegment.js', import.meta.url), 'utf8');
assert.match(assemblerSource, /new CsvIntersectionSegment\(/, 'Todos los nodos deben usar la interseccion CSV');
assert.doesNotMatch(assemblerSource, /new NodeSegment\(/, 'No debe quedar activa la geometria cuadrada anterior');
assert.doesNotMatch(segmentSource, /EdgesGeometry|triangulacion_interseccion_csv/, 'No debe superponerse una segunda malla de aristas');

console.log(JSON.stringify({
  archivo: 'interseccion_4_vias.csv',
  triangulosFuente: asset.metadata.sourceTriangles,
  triangulosZonaCentral: asset.metadata.outputTriangles,
  escala: asset.metadata.scale,
  anchoDePasoCruce: asset.metadata.passageWidth,
  estiradoEnPlanta: { x: asset.metadata.scaleX, z: asset.metadata.scaleZ },
  uvDegenerados: degenerateUvs,
  triangulosDegenerados: degenerateTriangles,
  aristaMaxima: +longestEdge.toFixed(3),
  aspectoMaximo: +worstAspect.toFixed(1),
  nodosActualizados: intersections.length,
  crucesCuatroVias: fourWay,
  tapasCsvPorDireccion: 27
}, null, 2));
