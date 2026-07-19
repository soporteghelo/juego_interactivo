import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * SENSOR FIJO DE GASES con BALIZA ESTROBOSCOPICA — estacion de monitoreo continuo en
 * labores con fuentes de gases (frente diesel, bombeo, shotcrete). Caja con display de
 * lecturas, cabezal sensor y baliza roja que ESTROBEA cuando hay evento de gas:
 * se suscribe (perezosamente) a 'event:gas' y 'gas:alarm' del bus.
 *
 * Origen en el PISO contra la pared; frente = +Z.
 */

export const meta = {
  id: 'sensor_gases',
  nombre: 'Sensor fijo de gases (con estrobo)',
  descripcion: 'Estación fija de monitoreo continuo: display de lecturas, cabezal sensor y baliza estroboscópica roja que se dispara con el evento de gas. Interactuable.'
};

function bx(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cy(rt, rb, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat); }
function put(grp, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m;
}

function _texDisplay() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050705'; ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#39ff14'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ['O2  20.8 %', 'CO   2 ppm', 'NO2 0.2ppm', 'H2S 0.4ppm'].forEach((r, i) => ctx.fillText(r, 10, 22 + i * 20));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const mCaja = MineMaterials.plano(0x2c3e50, { rough: 0.5, metal: 0.3 });
  const mK    = MineMaterials.plano(0x16181c, { rough: 0.8 });

  let S = sub(g, 'caja', 'Caja del sensor',
    'Gabinete con display de lecturas en vivo (O2/CO/NO2/H2S) y cabezal sensor inferior.');
  put(S, bx(0.34, 0.42, 0.16, mCaja), 0, 1.65, 0.08);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.18),
    new THREE.MeshStandardMaterial({
      map: _texDisplay(), roughness: 0.3,
      emissive: 0x1a3a1a, emissiveIntensity: 0.8, emissiveMap: _texDisplay()
    })
  );
  put(S, display, 0, 1.70, 0.165);
  put(S, cy(0.05, 0.06, 0.14, 10, mK), 0, 1.36, 0.08);        // cabezal sensor
  put(S, cy(0.052, 0.052, 0.02, 10, mK), 0, 1.28, 0.08);      // rejilla de difusion

  // Baliza estroboscopica roja (material UNICO: se anima)
  S = sub(g, 'estrobo', 'Baliza estroboscópica',
    'Baliza roja sobre la caja: parpadeo rápido durante un evento de gas / alarma por LMP.');
  const mStrobe = new THREE.MeshStandardMaterial({
    color: 0xff2020, emissive: 0xcc0000, emissiveIntensity: 0.25,
    roughness: 0.3, transparent: true, opacity: 0.92
  });
  put(S, cy(0.06, 0.07, 0.05, 10, mK), 0, 1.90, 0.08);        // base
  const domo = put(S, cy(0.05, 0.058, 0.11, 10, mStrobe), 0, 1.98, 0.08);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.name = 'sensor_gases';

  // ── Estrobo ligado a los eventos de gas del bus (suscripcion perezosa desde el tick,
  // cuando window.__mina ya existe). El tick corre solo con la sala visible. ──
  let alarma = 0;
  let suscrito = false;
  g.userData.tick = (dt, elapsed) => {
    if (!suscrito && window.__mina?.bus) {
      suscrito = true;
      window.__mina.bus.on('event:gas', () => { alarma = 12; });
      window.__mina.bus.on('gas:alarm', () => { alarma = Math.max(alarma, 6); });
    }
    if (alarma > 0) {
      alarma -= dt;
      domo.material.emissiveIntensity = Math.sin(elapsed * 22) > 0 ? 6.0 : 0.3;  // estrobo
    } else if (domo.material.emissiveIntensity !== 0.25) {
      domo.material.emissiveIntensity = 0.25;
    }
  };

  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Leer sensor de gases',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'SENSOR FIJO DE GASES — MONITOREO CONTINUO',
        body:
          'Lecturas en vivo de la estación:\n\n' +
          'O2:  20.8 %   (LMP: mínimo 19.5 %)\n' +
          'CO:  2 ppm    (LMP: 25 ppm)\n' +
          'NO2: 0.2 ppm  (LMP: 3 ppm)\n' +
          'H2S: 0.4 ppm  (LMP: 10 ppm)\n\n' +
          'Si la BALIZA ROJA estrobea: evacúa por la vía de escape hacia el refugio ' +
          'más cercano y reporta por el teléfono de emergencia. No regreses hasta el ' +
          'reingreso autorizado por ventilación.'
      })
    }
  };
  return g;
}
