import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const output = join(dirname(fileURLToPath(import.meta.url)), 'galeria_wireframe_simulada.csv');
const sections = 41;
const profile = [
  [-2.55, 0.10],
  [-2.72, 1.45],
  [-2.55, 2.75],
  [-2.08, 3.62],
  [-1.22, 4.22],
  [0.00, 4.48],
  [1.12, 4.28],
  [2.02, 3.72],
  [2.52, 2.82],
  [2.68, 1.42],
  [2.52, 0.08],
  [0.00, -0.06]
];

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

const distances = [0];
for (let index = 1; index < sections; index++) {
  const spacing = 2.55 + (noise(index * 0.73, 5) + 1) * 0.55;
  distances.push(distances.at(-1) + spacing);
}

function centerline(distance) {
  return {
    x: 5882 + distance * 0.10 + 6.4 * Math.sin(distance / 31) + 1.35 * fbm(distance / 13, 3),
    y: 4437 + distance + 0.8 * fbm(distance / 11, 9),
    z: -180 + distance * 0.026 + 0.72 * Math.sin(distance / 23) + 0.34 * fbm(distance / 8, 14)
  };
}

function sectionVertices(index) {
  const distance = distances[index];
  const center = centerline(distance);
  const before = centerline(Math.max(0, distance - 0.15));
  const after = centerline(Math.min(distances.at(-1), distance + 0.15));
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const length = Math.hypot(dx, dy) || 1;
  const lateralX = -dy / length;
  const lateralY = dx / length;
  const widthScale = 1 + 0.10 * fbm(distance / 9, 22);
  const heightScale = 1 + 0.08 * fbm(distance / 10, 31);
  const sideBias = 0.16 * fbm(distance / 7, 47);
  const crownOverbreak = 0.42 * Math.exp(-(((distance - 37) / 7) ** 2));
  const rightOverbreak = 0.35 * Math.exp(-(((distance - 84) / 6) ** 2));

  return profile.map(([baseSide, baseUp], vertex) => {
    const crownWeight = Math.max(0, (baseUp - 3.2) / 1.3);
    const rightWeight = Math.max(0, baseSide / 2.7) * Math.max(0, 1 - Math.abs(baseUp - 2.1) / 2.2);
    const sideRoughness = 0.16 * fbm(distance / 2.8 + vertex * 3.7, 60 + vertex);
    const verticalRoughness = 0.13 * fbm(distance / 2.5 + vertex * 4.2, 90 + vertex);
    const side = baseSide * widthScale + sideBias + sideRoughness + rightOverbreak * rightWeight;
    const up = baseUp * heightScale + verticalRoughness + crownOverbreak * crownWeight;
    return {
      x: center.x + lateralX * side,
      y: center.y + lateralY * side,
      z: center.z + up
    };
  });
}

const rings = Array.from({ length: sections }, (_, index) => sectionVertices(index));
const triangles = [];

function addTriangle(a, b, c, layer, link) {
  triangles.push({ a, b, c, layer, link });
}

for (let station = 0; station < sections - 1; station++) {
  const current = rings[station];
  const next = rings[station + 1];
  for (let side = 0; side < profile.length; side++) {
    const following = (side + 1) % profile.length;
    const [profileSide, profileUp] = profile[side];
    const layer = profileUp < 0.4 ? 'PISO' : Math.abs(profileSide) > 2.3 && profileUp < 3.2 ? 'HASTIAL' : 'CORONA';
    addTriangle(current[side], next[side], next[following], layer, station + 1);
    addTriangle(current[side], next[following], current[following], layer, station + 1);
  }
}

for (const [ring, reverse, link] of [[rings[0], true, 1], [rings.at(-1), false, sections]]) {
  const center = ring.reduce((sum, point) => ({ x: sum.x + point.x / ring.length, y: sum.y + point.y / ring.length, z: sum.z + point.z / ring.length }), { x: 0, y: 0, z: 0 });
  for (let side = 0; side < ring.length; side++) {
    const following = (side + 1) % ring.length;
    if (reverse) addTriangle(center, ring[following], ring[side], 'PORTAL', link);
    else addTriangle(center, ring[side], ring[following], 'FRENTE', link);
  }
}

const header = ['TRIANGLE','XP1','YP1','ZP1','XP2','YP2','ZP2','XP3','YP3','ZP3','COLOUR','LAYERS','LABOR','LINK'];
const lines = [header.join(',')];
const fixed = value => Number(value).toFixed(3);

triangles.forEach((triangle, index) => {
  lines.push([
    index + 1,
    fixed(triangle.a.x), fixed(triangle.a.y), fixed(triangle.a.z),
    fixed(triangle.b.x), fixed(triangle.b.y), fixed(triangle.b.z),
    fixed(triangle.c.x), fixed(triangle.c.y), fixed(triangle.c.z),
    11, triangle.layer, 'GALERIA_SIMULADA', triangle.link
  ].join(','));
});

writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(`${output}\n${triangles.length} triángulos`);
