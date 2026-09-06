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
// Costado -Z: el que queda a la DERECHA de quien ya entró y mira al interior (hacia -X).
assert.ok(cEsc.z < -1.0, `La escotilla debe ir en el hastial -Z (z=${cEsc.z.toFixed(2)})`);
assert.ok(cEsc.x < 0, `La escotilla debe ir al FONDO del refugio (x=${cEsc.x.toFixed(2)})`);
// Sobre la banca: el ocupante sentado debajo es quien la abre.
assert.ok(cEsc.y > 1.1 && cEsc.y < 2.0, `Altura impropia para salir desde la banca (y=${cEsc.y.toFixed(2)})`);

// La escotilla se rotula por sus DOS caras, y cada una mira a su lado:
//   · INTERIOR  → la placa de instrucción que lee el ocupante que va a escapar (mira a -Z).
//   · EXTERIOR  → el marco "SALIDA DE EMERGENCIA" que ve el minero desde la labor (mira a +Z).
// Antes esto se comprobaba quedándose con el ÚLTIMO PlaneGeometry del subelemento, así que al
// añadir la cara exterior el test pasó a medir el rótulo equivocado. Ahora se separan por nombre.
const planos = [];
escotilla.traverse(o => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry') planos.push(o); });
const normalDe = (o) => new THREE.Vector3(0, 0, 1)
  .applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));

const rotuloExt = planos.find(o => o.name === 'rotulo_salida_emergencia_ext');
assert.ok(rotuloExt, 'Falta la rotulación EXTERIOR de la escotilla: desde la labor no se ve la vía de escape');
assert.ok(normalDe(rotuloExt).z < 0, 'La rotulación exterior de la escotilla no mira a la mina');

const rotuloInt = planos.filter(o => o !== rotuloExt).pop();
assert.ok(rotuloInt, 'La escotilla debe llevar su rótulo de vía de escape');
assert.ok(normalDe(rotuloInt).z > 0, 'El rótulo interior de la escotilla mira hacia fuera: no se leería desde dentro');

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

// ── 5. FRENTE DE LA UnidadREFUGE® — fidelidad a las fotos del panel real ─────
// El frente se había modelado de memoria: un "paro de emergencia" rojo, un pulsador verde de
// marcha y un panel blanco impreso con pilotos y diagrama de flujo. Las fotos de cerca del
// equipo real no muestran nada de eso. Muestran, de la izquierda del operador a su derecha:
// selector de iluminación, selector de sirena, el controlador Dräger|SIMSA con su LCD magenta,
// el piloto "Respaldo", el monitor de baterías y el piloto "Línea". Rojo y verde son PILOTOS DE
// ALIMENTACIÓN, no pulsadores — y un paro de emergencia en la máquina de la que respiran veinte
// personas encerradas sería un error operacional, no sólo un error de modelo.
assert.equal(/const paro = /.test(fuente), false,
  'Volvió el "paro de emergencia" al frente de la UnidadREFUGE®: el rojo de la foto es el piloto "Respaldo"');
assert.equal(/btnVerde/.test(fuente), false,
  'Volvió el pulsador verde de marcha: el verde de la foto es el piloto "Línea"');
assert.equal(/_texturaPanelUnidadRefuge/.test(fuente), false,
  'Volvió el panel impreso inventado: en la foto los mandos van atornillados sobre la chapa azul');

// Lo que canta el LCD del controlador es dato, no relleno: modelo MRC5000 (el mismo de la placa
// de identificación), reloj de fábrica sin ajustar y los DOS ventiladores parados en espera.
assert.ok(/MRC5000/.test(fuente), 'El LCD del controlador debe mostrar el modelo MRC5000');
assert.ok(/V1 OFF/.test(fuente) && /V2 OFF/.test(fuente),
  'El LCD debe mostrar los dos ventiladores (V1/V2) parados: la unidad se arranca al encerrarse');

const bpu = sub('bpu');
assert.ok(bpu, 'Falta la UnidadREFUGE®');
const porNombre = (n) => { let hit = null; bpu.traverse(o => { if (o.name === n) hit = o; }); return hit; };
const mandos = ['bpu_controlador', 'bpu_piloto_respaldo', 'bpu_monitor_baterias', 'bpu_piloto_linea']
  .map((n) => { const o = porNombre(n); assert.ok(o, `Falta el mando "${n}" del frente`); return o; });

// Van EN EL MISMO ORDEN que en la foto. El observador mira la unidad desde +X, así que su
// izquierda es +Z: de +Z a -Z, controlador → Respaldo → monitor → Línea.
const zMandos = mandos.map((o) => o.getWorldPosition(new THREE.Vector3()).z);
for (let i = 1; i < zMandos.length; i++) {
  assert.ok(zMandos[i] < zMandos[i - 1],
    `Los mandos del frente no siguen el orden de la foto (z=${zMandos.map(v => v.toFixed(3))})`);
}

// Ninguno se sale de la chapa: el gabinete mide 0.67 m de ancho y el piloto de Línea es el que
// queda al filo. Si un mando cuelga fuera del frente, el modelo se delata desde cualquier ángulo.
// Se miden LOS MANDOS y no la caja del subelemento entero: del costado cuelga la manguera
// enrollada, que sí puede sobresalir del ancho del gabinete porque va colgada de un gancho.
const cajaBpu = caja(bpu);
for (const o of mandos) {
  const c = caja(o);
  assert.ok(Math.abs(c.min.z) <= 0.335 && Math.abs(c.max.z) <= 0.335,
    `El mando "${o.name}" se sale del frente (z=${c.min.z.toFixed(3)}..${c.max.z.toFixed(3)})`);
}

// Fila de mandos a la altura a la que se opera de pie. Se mide DESDE EL PISO DEL REFUGIO —la
// base del gabinete— y no desde el piso de la labor: el contenedor va sobre su patín, así que en
// coordenadas de mundo todo el interior está unos 25 cm más alto de lo que lo ve el ocupante.
const yPisoBpu = cajaBpu.min.y;
for (const o of mandos) {
  const y = o.getWorldPosition(new THREE.Vector3()).y - yPisoBpu;
  assert.ok(y > 1.0 && y < 1.25, `Mando "${o.name}" a altura impropia para operarlo de pie (y=${y.toFixed(2)})`);
}

// En la foto SÓLO alumbra el verde: el refugio está en espera, comiendo de la red de mina. Si
// alumbraran los dos —o el rojo— el jugador leería "refugio en baterías", que es otra situación.
const matDe = (o) => o.material;
assert.ok(matDe(porNombre('bpu_piloto_linea')).emissiveIntensity > 0.5,
  'El piloto LÍNEA debe estar encendido: el refugio en espera cuelga de la red de mina');
assert.equal(matDe(porNombre('bpu_piloto_respaldo')).emissiveIntensity, 0,
  'El piloto RESPALDO debe estar apagado mientras haya línea: encendido significa que corre con baterías');

// ── 6. TOLVAS DE CARGA — placa blanca con pestaña, y separadas ───────────────
// Antes los rótulos eran una banda naranja con letras blancas y las dos tolvas se tocaban. En la
// foto son placas BLANCAS con pestaña de color en el canto —naranja el absorbente, verde el
// catalizador— y entre los cajones queda una luz por la que asoma la brida que los amarra.
assert.equal(/_texturaTolva\b/.test(fuente), false,
  'Volvió la banda naranja de las tolvas: en la foto el rótulo es una placa blanca con pestaña');
const rotulos = [];
bpu.traverse(o => { if (o.name === 'bpu_rotulo_tolva') rotulos.push(o); });
assert.equal(rotulos.length, 2, 'Deben ir DOS tolvas rotuladas: absorbente de CO2 y humedad/catalizador');
const zRot = rotulos.map((o) => o.getWorldPosition(new THREE.Vector3()).z).sort((a, b) => a - b);
assert.ok(zRot[1] - zRot[0] > 0.28, `Las tolvas quedaron pegadas (separación ${(zRot[1] - zRot[0]).toFixed(3)} m)`);

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
  unidadRefuge: {
    mandosDelFrente: mandos.map((o) => o.name),
    pilotoEncendido: 'Línea (red de mina)',
    tolvas: { separacion: +(zRot[1] - zRot[0]).toFixed(3) }
  },
  subelementos: ids.size,
  mallas
}, null, 2));
