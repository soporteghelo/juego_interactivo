import * as THREE from 'three';

/**
 * PT-TAG (tag de proximity/tracking) — dispositivo de rastreo personal (PBE).
 *
 * Segun la foto real:
 *  - Cuerpo pequeño (~8×6×1.5 cm), gris oscuro con franja verde neon en los bordes.
 *  - Boton/sensor redondo en la parte frontal con LED indicador.
 *  - LED VERDE  = bateria OK (estado normal de la mayoria de trabajadores).
 *  - LED AMBAR  = bateria baja (advertencia).
 *  - LED ROJO   = bateria critica.
 *  - Se engancha en el pecho derecho del trabajador a la altura del esternon.
 *
 * Uso en persona.js:
 *   const tag = crearPtTag({ bateria: 'ok' }); // 'ok'|'baja'|'critica'
 *   tag.position.set(+0.18, 0.28, 0.08);       // pecho derecho del torso
 *   torso.add(tag);
 */

// Escala real del dispositivo en metros (aprox. 8×6×1.5 cm)
const W = 0.080; // ancho
const H = 0.060; // alto
const D = 0.018; // profundidad (grosor)

/** Crea el LED con el color segun el estado de bateria. */
function colorLed(bateria) {
  switch (bateria) {
    case 'baja':    return { color: 0xffaa00, emissive: 0xffaa00 }; // ambar
    case 'critica': return { color: 0xff1111, emissive: 0xff1100 }; // rojo
    default:        return { color: 0x00ff44, emissive: 0x00ff44 }; // verde OK
  }
}

/**
 * @param {{ bateria?: 'ok'|'baja'|'critica' }} opts
 * @returns {THREE.Group}
 */
export function crearPtTag({ bateria = 'ok' } = {}) {
  const g = new THREE.Group();
  g.name = 'pt_tag';

  // ── Cuerpo principal (gris oscuro) ───────────────────────────────
  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshStandardMaterial({ color: 0x303238, roughness: 0.85, metalness: 0.15 })
  );
  g.add(cuerpo);

  // ── Franja verde neon en borde (4 tiras delgadas) ────────────────
  const mNeon = new THREE.MeshStandardMaterial({
    color: 0xaaff00, emissive: 0x55cc00, emissiveIntensity: 0.8, roughness: 0.5
  });
  const borderThick = 0.004;
  const borderD     = D + 0.001;
  // Arriba / abajo
  for (const ys of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(W + borderThick * 2, borderThick, borderD), mNeon);
    t.position.set(0, ys * (H / 2 + borderThick / 2), 0);
    g.add(t);
  }
  // Izquierda / derecha
  for (const xs of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(borderThick, H, borderD), mNeon);
    t.position.set(xs * (W / 2 + borderThick / 2), 0, 0);
    g.add(t);
  }

  // ── Boton / sensor redondo (frente del dispositivo) ──────────────
  const boton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.005, 12),
    new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.5, metalness: 0.4 })
  );
  boton.rotation.x = Math.PI / 2;
  boton.position.set(-W * 0.22, H * 0.20, D / 2 + 0.001);
  g.add(boton);

  // ── LED indicador (encima del boton) ─────────────────────────────
  const ledDef = colorLed(bateria);
  const ledMat = new THREE.MeshStandardMaterial({
    color: ledDef.color,
    emissive: ledDef.emissive,
    emissiveIntensity: 2.5,
    roughness: 0.2
  });
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 8, 6),
    ledMat
  );
  led.position.set(-W * 0.22, H * 0.20, D / 2 + 0.005);
  g.add(led);

  // ── Etiqueta "PT-TAG" (placa blanca con texto via CanvasTexture) ──
  const cvs = document.createElement('canvas');
  cvs.width = 128; cvs.height = 64;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#1a1a2a';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PT-TAG', 64, 28);
  ctx.font = '11px sans-serif';
  ctx.fillText('PBE', 64, 46);
  const tex = new THREE.CanvasTexture(cvs);
  const placa = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.70, H * 0.40),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
  );
  placa.position.set(W * 0.10, -H * 0.08, D / 2 + 0.0012);
  g.add(placa);

  // ── Clip / gancho de sujecion (parte trasera) ────────────────────
  const clip = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.3, H * 0.5, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.7, metalness: 0.5 })
  );
  clip.position.set(W * 0.30, 0, -D / 2 - 0.004);
  g.add(clip);

  // ── Animacion del LED (parpadeo segun estado) ─────────────────────
  const isPulse = bateria !== 'ok';
  g.userData.tick = (dt, elapsed) => {
    if (isPulse) {
      ledMat.emissiveIntensity = 1.0 + Math.abs(Math.sin(elapsed * 3.5)) * 3.0;
    }
  };

  return g;
}
