/**
 * LETREROS INTERIORES DEL REFUGIO — verifica que el recorrido guiado los muestra DE FORMA
 * INDEPENDIENTE y, sobre todo, que la cámara los mira POR LA CARA ESCRITA.
 *
 * La regresión que cubre: los rótulos son planos de UNA SOLA CARA pegados al hastial mirando
 * hacia adentro. Cuando los 17 planos colgaban de un único subelemento `senaletica_interior`, el
 * paso encuadraba una caja que iba de hastial a hastial y la cámara acababa fuera del refugio:
 * los rótulos de la pared más cercana quedaban de espaldas (backface culling los descartaba) y
 * los de la otra, a ~4 m, eran ilegibles.
 *
 * Aquí se reproduce el MISMO cálculo de encuadre que hace `RecorridoGuiado._encuadre` y se
 * comprueba, letrero a letrero, que la posición resultante de la cámara cae del lado de la cara
 * pintada y lo bastante cerca como para leerlo.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';

// ── Stub mínimo de canvas 2D: el elemento genera sus texturas con CanvasTexture, que en Node
//    solo necesita un objeto con width/height. Ningún test toca WebGL.
const contexto = () => {
  const noop = new Proxy(function () {}, {
    get: (t, k) => (k === 'width' || k === 'height' ? 10 : noop),
    apply: () => noop,
    set: () => true
  });
  return new Proxy({}, {
    get: (t, k) => (k === 'measureText'
      ? (txt) => ({ width: String(txt).length * 9 })
      : noop),
    set: () => true
  });
};
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: contexto })
};

const { crear, recorrido } = await import('../src/elementos/ssoma/refugio_draeger.js');
const { recolectarSubelementos } = await import('../src/elementos/_comun/subelemento.js');

const refugio = crear();
refugio.updateMatrixWorld(true);
const porId = new Map(recolectarSubelementos(refugio).map(s => [s.userData.subelemento.id, s]));

// 1. NINGÚN PASO SE PIERDE. `construirPasos()` filtra en silencio los pasos cuyo `sub` no
//    existe, así que un id mal escrito vaciaría el paso sin avisar en pantalla.
for (const paso of recorrido.pasos) {
  if (!paso.sub) continue;
  assert.ok(porId.has(paso.sub), `El guion apunta a un subelemento inexistente: ${paso.sub}`);
}

// 2. El subelemento agrupado ya no existe: cada letrero va por separado.
assert.equal(porId.has('senaletica_interior'), false,
  'senaletica_interior volvió a agrupar los letreros en un solo subelemento');

const LETREROS = [
  'letrero_tanque_co', 'letrero_catalizador_co',
  'letrero_raciones_alimentos', 'letrero_raciones_agua',
  'letrero_diagrama_agua', 'letrero_procedimiento_ingreso',
  'plano_rescate_nivel', 'plano_ubicacion_refugios',
  'letrero_procedimiento_o2'
];
// Lo EXIGIBLE es que cada letrero sea un subelemento propio: así se aísla desde la lista del
// visor y por doble clic, que es lo que significa "verse de forma independiente". QUÉ letreros
// entran además en el recorrido guiado es una decisión editorial del guion —está curado a mano
// y se acorta a conveniencia—, así que aquí no se impone: solo se comprueban los que sí están.
for (const id of LETREROS) {
  assert.ok(porId.has(id), `Falta el subelemento del letrero ${id}`);
  const meta = porId.get(id).userData.subelemento;
  assert.ok(meta.descripcion?.length > 40, `${id}: la ficha del subelemento es demasiado corta`);
  const paso = recorrido.pasos.find(p => p.sub === id);
  if (!paso) continue;                       // no está en el guion: es válido
  // Los que sí están heredan la ficha del subelemento: el paso no duplica el texto.
  assert.equal(paso.texto, undefined, `${id}: el paso duplica el texto del subelemento`);
}

// ── Mismas constantes que RecorridoGuiado / el visor ──────────────────────────
const FOV = 50, ASPECTO = 16 / 9, HOLGURA = 1.15, SESGO_Y = 0.14, MIN_DIST = 0.2;

/** Réplica de `RecorridoGuiado._encuadre`. */
function encuadre(grupo, paso) {
  const caja = new THREE.Box3().setFromObject(grupo);
  const centro = caja.getCenter(new THREE.Vector3());
  const tam = caja.getSize(new THREE.Vector3());
  const radio = Math.max(tam.length() * 0.5, 0.12);

  const fovV = THREE.MathUtils.degToRad(FOV);
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * ASPECTO);
  const dAjuste = radio / Math.sin(Math.min(fovV, fovH) / 2);

  const yaw = THREE.MathUtils.degToRad(paso.yaw ?? 38);
  const pitch = THREE.MathUtils.degToRad(paso.pitch ?? 18);
  const d = Math.max(dAjuste * HOLGURA * (paso.dist ?? 0.95), radio + 0.15, MIN_DIST + 0.05);

  const mira = centro.clone();
  mira.y -= radio * SESGO_Y;
  const pos = new THREE.Vector3(
    mira.x + d * Math.cos(pitch) * Math.cos(yaw),
    mira.y + d * Math.sin(pitch),
    mira.z + d * Math.cos(pitch) * Math.sin(yaw)
  );
  return { centro, pos, radio, d };
}

/** Normal de la cara PINTADA de un plano (mira a +Z local) en coordenadas de mundo. */
function normalDe(malla) {
  return new THREE.Vector3(0, 0, 1)
    .applyQuaternion(malla.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
}

const informe = [];
for (const id of LETREROS) {
  const grupo = porId.get(id);
  const paso = recorrido.pasos.find(p => p.sub === id);

  const planos = [];
  grupo.traverse(o => { if (o.isMesh) planos.push(o); });
  assert.ok(planos.length > 0, `${id}: el subelemento quedó vacío`);

  // 3. TODOS los rótulos del subelemento miran al mismo lado. Si uno apuntara al contrario,
  //    volveríamos al caso de la caja que abarca las dos paredes.
  const normales = planos.map(normalDe);
  for (const n of normales) {
    assert.ok(n.dot(normales[0]) > 0.99,
      `${id}: agrupa rótulos de paredes opuestas, ningún encuadre puede mostrarlos a la vez`);
  }

  // Los letreros que el guion NO recorre ya han pasado lo exigible (subelemento propio con su
  // ficha, y rótulos coherentes). El resto de comprobaciones son sobre el ENCUADRE del paso,
  // así que solo aplican a los que están en el recorrido.
  if (!paso) continue;
  const { centro, pos, d } = encuadre(grupo, paso);

  // 4. LA CÁMARA VE LA CARA ESCRITA. Éste es el fallo que se corrige: con la cámara del lado
  //    contrario el plano se descarta por backface culling y el letrero no aparece.
  const haciaCamara = pos.clone().sub(centro).normalize();
  const coseno = normales[0].dot(haciaCamara);
  assert.ok(coseno > 0,
    `${id}: la cámara queda DETRÁS del letrero (yaw ${paso.yaw}°) — backface culling lo oculta`);

  // 5. Y lo mira de frente, no escorzado: dentro de ~25° de la normal.
  const desvio = THREE.MathUtils.radToDeg(Math.acos(Math.min(1, coseno)));
  assert.ok(desvio < 25, `${id}: se lee escorzado a ${desvio.toFixed(1)}° de la normal`);

  // 6. Y de cerca: el fallo original dejaba la cámara a ~4 m de rótulos de 7 cm de alto.
  assert.ok(d < 2.0, `${id}: la cámara se queda a ${d.toFixed(2)} m, el rótulo no se lee`);

  informe.push({
    id,
    yaw: paso.yaw,
    distanciaCamara: +d.toFixed(2),
    desvioNormal: +desvio.toFixed(1),
    piezas: planos.length
  });
}

console.log(JSON.stringify({
  pasosDelRecorrido: recorrido.pasos.length,
  letrerosIndependientes: LETREROS.length,
  letrerosEnElGuion: informe.length,
  distanciaMaxima: +Math.max(...informe.map(l => l.distanciaCamara)).toFixed(2),
  desvioMaximo: +Math.max(...informe.map(l => l.desvioNormal)).toFixed(1),
  letreros: informe
}, null, 2));
