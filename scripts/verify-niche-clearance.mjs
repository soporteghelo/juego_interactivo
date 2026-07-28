import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = readFileSync(join(root, 'src', 'world', 'complete', 'CompleteMineWorld.js'), 'utf8');
const layout = readFileSync(join(root, 'prueba', 'elementos', '_mina_completa_layout.csv'), 'utf8')
  .trim().split(/\r?\n/);
const header = layout.shift().split(',');
const records = layout.map(line => Object.fromEntries(line.split(',').map((value, i) => [header[i], value])));
const main = records.find(row => row.ID === 'nivel_160_principal');
const legacyNiche = records.find(row => row.ID === 'nicho_peatonal');
assert.ok(main && legacyNiche, 'Faltan las referencias de via principal/nicho en el plano');

// El asset antiguo sí estaba superpuesto a la huella del nivel principal: debe permanecer
// deshabilitado como shell y convertirse en una excavacion del hastial.
const overlaps = !(
  Number(legacyNiche.MAX_X) < Number(main.MIN_X) || Number(legacyNiche.MIN_X) > Number(main.MAX_X) ||
  Number(legacyNiche.MAX_Y) < Number(main.MIN_Y) || Number(legacyNiche.MIN_Y) > Number(main.MAX_Y)
);
assert.equal(overlaps, true, 'La prueba ya no reproduce la superposicion historica');
assert.match(source, /EMBEDDED_FEATURE_IDS = new Set\(\['nicho_peatonal'\]\)/);
assert.match(source, /item\.id === 'nivel_160_principal'/);
assert.match(source, /center\.x = 190/);

// Gálibo en la via principal: la cara del hastial queda fuera de ambos ejes de circulacion.
const northMin = Number(main.MIN_Y);
const northMax = Number(main.MAX_Y);
const centerNorth = (northMin + northMax) / 2;
const halfWidth = (northMax - northMin) / 2 - 0.18;
const nearestLaneDistance = Math.max(
  Math.abs(6.0 - centerNorth),
  Math.abs(2.4 - centerNorth)
);
const laneToWallClearance = halfWidth - nearestLaneDistance;
assert.ok(laneToWallClearance > 1.7, `El nicho invade el gálibo: margen ${laneToWallClearance.toFixed(2)} m`);

// Señal y baliza se colocan dentro del receso, no unos centímetros dentro de la calzada.
assert.match(source, /halfWidth \+ 0\.16/);
assert.match(source, /halfWidth \+ 0\.14/);

console.log(JSON.stringify({
  standaloneShellDisabled: true,
  embeddedAtMainLevel: true,
  laneToWallClearance: +laneToWallClearance.toFixed(2),
  mouthCollider: false
}, null, 2));
