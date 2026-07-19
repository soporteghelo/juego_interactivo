import * as THREE from 'three';
import { sub } from '../_comun/subelemento.js';
import { Settings } from '../../core/Settings.js';

/**
 * IDENTIDAD Y SEÑALÉTICA DE EQUIPO — helper COMPARTIDO para toda la flota trackless.
 *
 * Estampa en cada máquina lo que la hace una unidad REAL de una operación (md: "Raptor 002",
 * códigos JU-021/SC-115) en vez de un clon anónimo:
 *   - CÓDIGO INTERNO por unidad (SC-01, JU-02, RA-03…) en la trasera del equipo.
 *   - PLACA de flota del contratista (equipo autorizado).
 *   - AVISO "PELIGRO ARTICULACIÓN" (rombo) en el costado, solo en equipos articulados.
 *   - TARJETA de pre-uso / check-list en el costado de cabina (gated por heavyDetail).
 *   - TACOS/CUÑAS de estacionamiento en las ruedas traseras (equipo detenido); se guardan en
 *     `g.userData._tacos` para que el DriveController los oculte al conducir y los restaure al bajar.
 *
 * RENDIMIENTO: las TEXTURAS (canvas) y las geometrías de plano/cuña se CACHEAN y comparten;
 * el único recurso por unidad es la textura del código (su string es único). Colocación por
 * BOUNDING BOX del equipo → funciona en cualquier chasis sin tuning por archivo. Los decals van
 * en un `sub()` 'identidad' aislable en el visor.
 */

// ── Código por unidad: contador por prefijo (DETERMINISTA, sin Math.random) ──
const _counts = new Map();
function _codigo(prefijo) {
  const n = (_counts.get(prefijo) || 0) + 1;
  _counts.set(prefijo, n);
  return `${prefijo}-${String(n).padStart(2, '0')}`;
}

// ── Texturas de decal (cacheadas) ──
const _tex = new Map();
function _canvasTex(key, w, h, draw) {
  if (_tex.has(key)) return _tex.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _tex.set(key, t);
  return t;
}

const _texCodigo = (codigo) => _canvasTex(`cod:${codigo}`, 256, 110, (ctx, w, h) => {
  ctx.fillStyle = '#f4f2ec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#111';    ctx.fillRect(0, 0, w, 12);         // franja superior
  ctx.strokeStyle = '#0e1013'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = '#0e1013'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(h * 0.55)}px sans-serif`;
  ctx.fillText(codigo, w / 2, h * 0.57);
});

const _texPlaca = () => _canvasTex('placa', 256, 96, (ctx, w, h) => {
  ctx.fillStyle = '#123f8f'; ctx.fillRect(0, 0, w, h);          // azul contratista
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(h * 0.34)}px sans-serif`;
  ctx.fillText('AESA · MINA', w / 2, h * 0.36);
  ctx.font = `${Math.round(h * 0.20)}px sans-serif`;
  ctx.fillText('EQUIPO AUTORIZADO', w / 2, h * 0.70);
});

const _texArticulacion = () => _canvasTex('articul', 220, 220, (ctx, w, h) => {
  ctx.fillStyle = '#f3c50a';                                    // rombo amarillo advertencia
  ctx.beginPath(); ctx.moveTo(w / 2, 6); ctx.lineTo(w - 6, h / 2); ctx.lineTo(w / 2, h - 6); ctx.lineTo(6, h / 2); ctx.closePath();
  ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(h * 0.10)}px sans-serif`;
  ctx.fillText('PELIGRO', w / 2, h * 0.46);
  ctx.fillText('ARTICULACIÓN', w / 2, h * 0.60);
});

const _texPreUso = () => _canvasTex('preuso', 150, 200, (ctx, w, h) => {
  ctx.fillStyle = '#ededed'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0a7d2c'; ctx.fillRect(0, 0, w, h * 0.15);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(h * 0.075)}px sans-serif`;
  ctx.fillText('CHECK-LIST PRE-USO', w / 2, h * 0.08);
  for (let i = 0; i < 8; i++) {
    const y = h * 0.17 + i * h * 0.10;
    ctx.fillStyle = i % 2 ? '#f6d7d7' : '#ffffff'; ctx.fillRect(5, y, w - 10, h * 0.088);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(10, y + h * 0.018, h * 0.05, h * 0.05);
  }
});

// ── Materiales / geometrías compartidos ──
const _decalMats = new Map();
function _matDecal(tex) {
  if (_decalMats.has(tex)) return _decalMats.get(tex);
  // emissiveMap con el propio mapa → el decal se AUTOILUMINA levemente (legible en la mina
  // oscura, como una calcomanía reflectiva que capta el headlamp). polygonOffset anti z-fight.
  const m = new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22,
    roughness: 0.6, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  _decalMats.set(tex, m);
  return m;
}

const _planes = new Map();
function _plane(w, h) {
  const k = `${w.toFixed(3)}x${h.toFixed(3)}`;
  if (!_planes.has(k)) _planes.set(k, new THREE.PlaneGeometry(w, h));
  return _planes.get(k);
}

let _wedgeGeo = null;
function _wedge() {
  if (_wedgeGeo) return _wedgeGeo;
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.30, 0); s.lineTo(0, 0.17); s.closePath();   // cuña triangular
  _wedgeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.20, bevelEnabled: false });
  _wedgeGeo.translate(-0.15, 0, -0.10);
  return _wedgeGeo;
}
let _matTaco = null;
function _tacoMat() {
  if (!_matTaco) _matTaco = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.95, metalness: 0.0 });
  return _matTaco;
}

/**
 * Marca un equipo con su identidad y señalética. Llamar al FINAL de `crear()` (ya construido).
 * @param {THREE.Group} g          raíz del equipo (frente = +Z local)
 * @param {object} o
 * @param {string} o.prefijo       prefijo de flota ('SC','JU','RA','EMP','SHT','MIX','SCL','TH'…)
 * @param {boolean} [o.articulado] añade el aviso "PELIGRO ARTICULACIÓN"
 * @param {boolean} [o.tacos]      añade cuñas de estacionamiento (default true)
 * @param {number}  [o.heavyDetail] gate del detalle fino (tarjeta pre-uso); default lee Settings
 * @returns {string} el código asignado (también en g.userData.codigoEquipo)
 */
export function marcarEquipo(g, { prefijo = 'EQ', articulado = false, tacos = true, heavyDetail = Settings.current.heavyDetail ?? 1 } = {}) {
  const codigo = _codigo(prefijo);
  g.userData.codigoEquipo = codigo;

  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  if (!isFinite(bb.min.x)) return codigo;                 // equipo vacío: nada que marcar
  const cx = (bb.min.x + bb.max.x) / 2;
  const cyc = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const hx = (bb.max.x - bb.min.x) / 2;
  const hy = (bb.max.y - bb.min.y) / 2;
  const zr = bb.min.z;                                    // trasera (frente = +Z)

  const S = sub(g, 'identidad', 'Código y señalética de equipo',
    `Código interno ${codigo}, placa de flota${articulado ? ', aviso de articulación' : ''} y tarjeta de pre-uso.`);

  const decal = (tex, w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(_plane(w, h), _matDecal(tex));
    m.position.set(x, y, z); m.rotation.y = ry;
    S.add(m);
    return m;
  };

  // CÓDIGO en la TRASERA (motor), altura media-alta. Cara hacia -Z ⇒ ry = π.
  const codW = Math.min(0.95, Math.max(0.55, hx * 1.25));
  decal(_texCodigo(codigo), codW, codW * (110 / 256), cx, cyc + hy * 0.35, zr - 0.02, Math.PI);
  // PLACA de flota debajo del código.
  decal(_texPlaca(), codW * 0.78, codW * 0.78 * (96 / 256), cx, cyc - hy * 0.02, zr - 0.02, Math.PI);

  // AVISO DE ARTICULACIÓN en el costado -X, a la altura de la junta (centro).
  if (articulado) {
    decal(_texArticulacion(), 0.36, 0.36, bb.min.x - 0.02, cyc - hy * 0.15, cz, -Math.PI / 2);
  }

  // TARJETA de pre-uso en el costado -X hacia el frente (cabina). Detalle fino → gated.
  if (heavyDetail >= 0.7) {
    decal(_texPreUso(), 0.24, 0.32, bb.min.x - 0.02, cyc + hy * 0.15, cz + (bb.max.z - cz) * 0.5, -Math.PI / 2);
  }

  // TACOS de estacionamiento en las ruedas traseras (equipo detenido). El DriveController
  // los oculta al conducir (g.userData._tacos) y los restaura al bajar.
  if (tacos) {
    const T = sub(g, 'tacos', 'Tacos de estacionamiento', 'Cuñas de rueda que se retiran al operar el equipo (SSOMA: equipo detenido = acuñado).');
    for (const xs of [-1, 1]) {
      const w = new THREE.Mesh(_wedge(), _tacoMat());
      // Contra la cara trasera de la rueda trasera: al piso, algo por delante de la trasera.
      w.position.set(xs * hx * 0.74, bb.min.y + 0.001, zr + 0.85);
      w.rotation.y = xs > 0 ? Math.PI : 0;   // el plano inclinado mira a la rueda
      T.add(w);
    }
    g.userData._tacos = T;
  }

  return codigo;
}
