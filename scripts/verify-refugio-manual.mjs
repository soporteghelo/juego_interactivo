/**
 * REFUGIO ChamberREF® — fidelidad al Manual de Operación Dräger|SIMSA.
 *
 * El refugio se modeló a partir de fotos, y eso dejó errores que solo el manual del fabricante
 * revela. El más grave era de MARCA: la central purificadora aparecía rotulada "Breathing
 * Protection Unit", denominación que no existe en la documentación — el equipo es la
 * **UnidadREFUGE®** y la estación, el **ChamberREF®**. Iba pintado sobre el gabinete, así que
 * era una marca inventada a la vista del jugador.
 *
 * Esta prueba fija los datos que vienen del manual para que no se vuelvan a ir:
 *   · nomenclatura de producto (cap. III-5, esquema general p.6-7),
 *   · autonomía 48 h / protección hasta 96 h (portada y p.17), no las 36 h que decía el código,
 *   · los componentes del esquema general que faltaban por completo: salida de emergencia
 *     (p.6-7 y cap. V) y válvulas de sobrepresión (p.6-7),
 *   · umbrales del monitor de gases (p.12) y caudal de oxígeno (p.16).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Stub mínimo de canvas 2D: el elemento genera texturas con CanvasTexture. Sin WebGL.
const contexto = () => {
  const noop = new Proxy(function () {}, {
    get: (t, k) => (k === 'width' || k === 'height' ? 10 : noop),
    apply: () => noop, set: () => true
  });
  return new Proxy({}, {
    get: (t, k) => (k === 'measureText' ? (txt) => ({ width: String(txt).length * 9 }) : noop),
    set: () => true
  });
};
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: contexto }) };

const RUTA = 'src/elementos/ssoma/refugio_draeger.js';
const fuente = readFileSync(RUTA, 'utf8');
const { crear, meta, recorrido } = await import(`../${RUTA}`);

// ── 1. NOMENCLATURA DEL FABRICANTE ───────────────────────────────────────────
assert.equal(/Breathing Protection Unit/.test(fuente.replace(/^.*que no es la denominación.*$/m, '')), false,
  'Volvió a aparecer "Breathing Protection Unit": el equipo es la UnidadREFUGE®');
assert.match(meta.nombre, /ChamberREF/, 'El nombre del elemento debe usar la marca ChamberREF®');
assert.match(meta.descripcion, /UnidadREFUGE®/);
assert.match(meta.descripcion, /DOBLE CÁMARA/i, 'El manual define la estación como de doble cámara');

// ── 2. AUTONOMÍA ─────────────────────────────────────────────────────────────
assert.equal(/36\s*(h|horas)\b/.test(fuente), false,
  'Las 36 h no salen del manual: son 48 h de autonomía y hasta 96 h de protección');
assert.ok(/48 h|48 horas/.test(fuente), 'Debe declararse la autonomía de 48 h');
assert.ok(/96 h|96 horas/.test(fuente), 'Debe declararse la protección de hasta 96 h');

// ── 3. GEOMETRÍA DE LOS COMPONENTES QUE FALTABAN ─────────────────────────────
const g = crear();
g.updateMatrixWorld(true);
const sub = (id) => { let hit = null; g.traverse(o => { if (o.userData?.subelemento?.id === id) hit = o; }); return hit; };

const escotilla = sub('salida_emergencia');
const valvulas = sub('valvulas_sobrepresion');
assert.ok(escotilla, 'Falta la SALIDA DE EMERGENCIA del esquema general (p.6-7, cap. V)');
assert.ok(valvulas, 'Faltan las VÁLVULAS DE SOBREPRESIÓN del esquema general (p.6-7)');

const caja = (o) => new THREE.Box3().setFromObject(o);
const cEsc = caja(escotilla).getCenter(new THREE.Vector3());
// "Muro izquierdo, al fondo": costado +Z para quien ya entró y mira al interior, hacia -X.
assert.ok(cEsc.z > 1.0, `La escotilla debe ir en el hastial +Z (z=${cEsc.z.toFixed(2)})`);
assert.ok(cEsc.x < 0, `La escotilla debe ir al FONDO del refugio (x=${cEsc.x.toFixed(2)})`);
// Sobre la banca: el ocupante sentado debajo es quien la abre.
assert.ok(cEsc.y > 1.1 && cEsc.y < 2.0, `Altura impropia para salir desde la banca (y=${cEsc.y.toFixed(2)})`);

// El rótulo se lee DESDE DENTRO: es la cara que mira el ocupante que va a escapar.
let rotulo = null;
escotilla.traverse(o => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry') rotulo = o; });
assert.ok(rotulo, 'La escotilla debe llevar su rótulo de vía de escape');
const normal = new THREE.Vector3(0, 0, 1)
  .applyQuaternion(rotulo.getWorldQuaternion(new THREE.Quaternion()));
assert.ok(normal.z < 0, 'El rótulo de la escotilla mira hacia fuera: no se leería desde dentro');

// Las válvulas van altas, en el arranque de la bóveda.
const cVal = caja(valvulas);
assert.ok(cVal.max.y > 2.0, `Las válvulas de sobrepresión deben ir altas (y=${cVal.max.y.toFixed(2)})`);

// ── 4. CIFRAS OPERACIONALES DEL MANUAL ───────────────────────────────────────
assert.ok(/19,5\s*%|19\.5\s*%/.test(fuente), 'Falta el umbral de O2 > 19,5 % del monitor de gases');
assert.ok(/4000\s*ppm/i.test(fuente), 'Falta el umbral de CO2 < 4000 ppm');
assert.ok(/40\s*ppm/i.test(fuente), 'Falta el umbral de CO < 40 ppm');
assert.ok(/0,5\s*l\/min|0\.5\s*l\/min/i.test(fuente), 'Falta el caudal de 0,5 l/min por persona');
assert.ok(/Drägersorb/.test(fuente), 'Falta la cal sodada Drägersorb® 400 (absorbente de CO2)');
assert.ok(/ChamberCatalysis/.test(fuente), 'Falta el ChamberCatalysis® (catalizador de CO)');

// El guion del recorrido no debe apuntar a subelementos inexistentes (se filtran en silencio).
const ids = new Set();
g.traverse(o => { if (o.userData?.subelemento) ids.add(o.userData.subelemento.id); });
for (const paso of recorrido.pasos) {
  if (paso.sub) assert.ok(ids.has(paso.sub), `El guion apunta a un subelemento inexistente: ${paso.sub}`);
}

let mallas = 0; g.traverse(o => { if (o.isMesh) mallas++; });
console.log(JSON.stringify({
  producto: meta.nombre,
  autonomia: '48 h (protección hasta 96 h)',
  salidaEmergencia: {
    hastial: '+Z (muro izquierdo)',
    posicion: [+cEsc.x.toFixed(2), +cEsc.y.toFixed(2), +cEsc.z.toFixed(2)],
    rotuloLegibleDesdeDentro: true
  },
  valvulasSobrepresion: { alturaMax: +cVal.max.y.toFixed(2) },
  subelementos: ids.size,
  mallas
}, null, 2));
