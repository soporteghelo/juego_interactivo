import * as THREE from 'three';

/**
 * ESTARCIDO DE LABOR — el codigo de la labor PINTADO CON PLANTILLA directamente sobre el
 * hastial, dentro de su recuadro rojo (`CX-026`, `RN-96`, `GA-220`…).
 *
 * No es un cartel: es pintura sobre la roca. Topografia lo marca al abrir la labor y queda ahi
 * toda la vida de la excavacion, descascarandose y ensuciandose de polvo. En una mina real es
 * la forma en que uno sabe donde esta — los carteles colgados son la excepcion, la pintura es
 * la regla. Sin esto, una galeria se lee como decorado y no como labor identificada.
 *
 * Se implementa como CALCO: un plano pegado al hastial con `polygonOffset` en vez de separarlo
 * fisicamente, para que siga la roca sin despegarse ni parpadear contra ella (z-fighting).
 */

export const meta = {
  id: 'estarcido_labor',
  nombre: 'Codigo de labor estarcido',
  descripcion: 'Codigo de la labor pintado con plantilla sobre el hastial, en recuadro rojo, descascarado por la humedad.'
};

const _texCache = new Map();
const _matCache = new Map();

/** Plantilla pintada: recuadro rojo + codigo, con desgaste y salpicadura. */
function texturaEstarcido(codigo) {
  if (_texCache.has(codigo)) return _texCache.get(codigo);
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Recuadro rojo de la plantilla (pintura de labor, no señaletica reflectiva).
  ctx.strokeStyle = '#c0271c';
  ctx.lineWidth = 16;
  ctx.strokeRect(26, 34, W - 52, H - 68);

  // El codigo. Tipografia condensada de plantilla, como la marca el topografo.
  ctx.fillStyle = '#c83024';
  ctx.font = 'bold 116px "Arial Narrow", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(codigo, W / 2, H / 2 + 4);

  // DESGASTE: la pintura sobre roca rugosa nunca queda entera — se come en motas y se
  // descascara por la humedad. Se borra con `destination-out` para comer alpha, de modo que la
  // roca de debajo asome por los huecos en vez de quedar tapada por un parche gris.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 420; i++) {
    const r = 1 + Math.random() * 7;
    ctx.fillStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.65})`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Escurrimientos verticales: el agua de la roca lava la pintura hacia abajo.
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, Math.random() * H * 0.6, 2 + Math.random() * 5, H);
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _texCache.set(codigo, tex);
  return tex;
}

/** Material del calco, cacheado POR CODIGO (hay pocos codigos distintos en todo el plano). */
function materialEstarcido(codigo) {
  if (_matCache.has(codigo)) return _matCache.get(codigo);
  const mat = new THREE.MeshStandardMaterial({
    map: texturaEstarcido(codigo),
    transparent: true,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  _matCache.set(codigo, mat);
  return mat;
}

/**
 * @param {{codigo?:string, ancho?:number}} opts
 * @returns {THREE.Mesh} calco orientado como cualquier prop de hastial (+Z hacia la via)
 */
export function crear({ codigo = 'CX-026', ancho = 1.15 } = {}) {
  const geo = new THREE.PlaneGeometry(ancho, ancho * 0.5);
  const mesh = new THREE.Mesh(geo, materialEstarcido(codigo));
  mesh.name = 'estarcido_labor';
  mesh.userData.signText = `Codigo de labor: ${codigo}`;
  return mesh;
}

/**
 * BANDA PINTADA del hastial: la franja horizontal de pintura que corre al pie de la labor,
 * a la altura del ojo del operador. Marca el limite de la calzada y da a la galeria su linea
 * de fuga; en las fotos de labor es lo que hace que el hastial no sea un muro plano de roca.
 *
 * @param {{length:number, y?:number, color?:number}} opts
 * @returns {THREE.Mesh} banda a lo largo de -Z, para pegar al hastial
 */
export function crearBanda({ length = 20, y = 1.35, color = 0x9c3a24 } = {}) {
  const geo = new THREE.PlaneGeometry(length, 0.14);
  geo.rotateY(Math.PI / 2);          // el plano corre a lo largo de -Z, de cara a la via
  geo.translate(0, y, -length / 2);
  const mat = _matCache.get(`banda:${color}`) || new THREE.MeshStandardMaterial({
    color, roughness: 0.94, metalness: 0, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
  });
  _matCache.set(`banda:${color}`, mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'banda_hastial';
  return mesh;
}
