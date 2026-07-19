import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * VENTILADOR SECUNDARIO (axial) — impulsa aire por la manga de ventilacion.
 *
 * Dos variantes:
 *  - SIN proteccion: aspas expuestas (mas peligroso).
 *  - CON proteccion: grilla/guarda circular de acero en la cara de entrada (foto real).
 *    La guarda tiene anillo exterior, anillos concéntricos intermedios y radios (spokes).
 *    Peligro reducido con guarda (kill mayor distancia).
 *
 * Animacion: userData.tick(dt) gira las aspas. El peligro depende de la variante.
 */

export const meta = {
  id: 'ventilador',
  nombre: 'Ventilador secundario',
  descripcion: 'Ventilador axial. Variante con guarda protectora (grilla circular, como en foto real) o sin guarda (aspas expuestas).'
};

/**
 * @param {{ conPatas?:boolean, radio?:number, conProteccion?:boolean }} opts
 * @returns {THREE.Group}
 */
export function crear({ conPatas = true, radio = 0.6, conProteccion = false } = {}) {
  const g = new THREE.Group();

  // ── Material de la carcasa (muy oscura/hollinada como en la foto) ──
  const mCarcasa = MineMaterials.plano(
    conProteccion ? 0x141416 : 0xf0a000,
    conProteccion ? { rough: 0.95, metal: 0.5 } : { rough: 0.65, metal: 0.5 }
  );
  const mGrilla  = MineMaterials.plano(0x1a1a1c, { rough: 0.90, metal: 0.65 });
  const mAcero   = MineMaterials.aceroOxidado();   // anillos de refuerzo: acero fijo oxidado

  // ── Carcasa cilindrica ────────────────────────────────────────────
  // `S` = grupo del SUBELEMENTO activo (discretización para el visor).
  let S = sub(g, 'carcasa', 'Carcasa cilíndrica', 'Cilindro de la carcasa con anillos de refuerzo en los extremos.');
  const carcasa = new THREE.Mesh(
    new THREE.CylinderGeometry(radio, radio, 1.0, 24, 1, true),
    mCarcasa
  );
  carcasa.rotation.z = Math.PI / 2;        // eje horizontal (sopla en X)
  carcasa.position.y = radio + 0.25;
  carcasa.material.side = THREE.DoubleSide;
  S.add(carcasa);

  // Anillos de refuerzo en los dos extremos del cilindro
  for (const x of [-0.50, 0.50]) {
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(radio, 0.04, 6, 22), mAcero);
    anillo.position.set(x, radio + 0.25, 0);
    anillo.rotation.y = Math.PI / 2;
    S.add(anillo);
  }

  // ── Hub + aspas (rotor giratorio) ────────────────────────────────
  S = sub(g, 'rotor', 'Rotor (hub + aspas)', 'Rotor giratorio animado con 6 aspas.');
  const rotor = new THREE.Group();
  rotor.position.set(0, radio + 0.25, 0);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10),
    MineMaterials.plano(0x252525, { metal: 0.7, rough: 0.4 })
  );
  hub.rotation.z = Math.PI / 2;
  rotor.add(hub);

  const aspaMat = MineMaterials.plano(
    conProteccion ? 0x303035 : 0xcfd3d6,
    { metal: 0.6, rough: 0.4 }
  );
  const nAspas = 6;
  for (let i = 0; i < nAspas; i++) {
    const aspa = new THREE.Mesh(new THREE.BoxGeometry(0.06, radio * 0.95, 0.18), aspaMat);
    aspa.position.set(0, radio * 0.5, 0);
    aspa.rotation.x = 0.5;
    const brazo = new THREE.Group();
    brazo.rotation.x = (i / nAspas) * Math.PI * 2;
    brazo.add(aspa);
    rotor.add(brazo);
  }
  S.add(rotor);

  // ══════════════════════════════════════════════════════════════════
  //  GUARDA PROTECTORA (variante con proteccion)
  //  Basada en la foto: anillo exterior grueso + anillos concéntricos
  //  + radios metálicos + tapa central. Todo muy oscuro/hollinado.
  // ══════════════════════════════════════════════════════════════════
  if (conProteccion) {
    S = sub(g, 'guarda', 'Guarda protectora', 'Grilla circular de acero: anillo exterior, anillos concéntricos, radios, marco de montaje, LED y caja de control.');
    const gx = -0.54;             // posicion X de la cara delantera de la guarda
    const gy = radio + 0.25;      // centro vertical del ventilador

    // Anillo exterior (grueso, oscuro)
    const anilloExt = new THREE.Mesh(
      new THREE.TorusGeometry(radio - 0.02, 0.05, 8, 28),
      mGrilla
    );
    anilloExt.position.set(gx, gy, 0);
    anilloExt.rotation.y = Math.PI / 2;
    S.add(anilloExt);

    // Anillos concéntricos interiores (imitando la foto: red circular)
    const rInterior = [radio * 0.65, radio * 0.38];
    for (const ri of rInterior) {
      const anillo = new THREE.Mesh(
        new THREE.TorusGeometry(ri, 0.022, 6, 20),
        mGrilla
      );
      anillo.position.set(gx, gy, 0);
      anillo.rotation.y = Math.PI / 2;
      S.add(anillo);
    }

    // Radios / spokes (barras desde el centro al borde)
    const nSpokes = 10;
    for (let i = 0; i < nSpokes; i++) {
      const angle = (i / nSpokes) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, (radio - 0.04) * 1.96, 0.025),
        mGrilla
      );
      spoke.position.set(gx, gy, 0);
      spoke.rotation.x = angle;
      S.add(spoke);
    }

    // Tapa central (hub de la guarda)
    const tapaCentral = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.05, 10),
      mGrilla
    );
    tapaCentral.rotation.z = Math.PI / 2;
    tapaCentral.position.set(gx - 0.01, gy, 0);
    S.add(tapaCentral);

    // Marco cuadrado de montaje (soporte de la guarda en la pared)
    const fw = radio * 2.1 + 0.14;
    const mMarco = MineMaterials.plano(0x1a1a1c, { rough: 0.88, metal: 0.5 });
    for (const [bw, bh, bby, bbz] of [
      [fw, 0.06, gy + radio + 0.02, 0],
      [fw, 0.06, gy - radio - 0.02, 0],
      [0.06, radio * 2 + 0.08, gy, 0]
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.06, bh > 0.07 ? 0.06 : bh), mMarco);
      bar.position.set(gx, bby, bbz);
      S.add(bar);
    }

    // Luz indicadora roja (como en la foto — punto luminoso)
    const mLed = new THREE.MeshStandardMaterial({
      color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 3.5
    });
    const ledInd = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mLed);
    ledInd.position.set(gx, gy - radio * 0.70, radio * 0.55);
    S.add(ledInd);

    // Caja de control lateral (con los cables de la foto)
    const mCaja = MineMaterials.plano(0x282828, { rough: 0.85, metal: 0.4 });
    const cajaCtrl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.10), mCaja);
    cajaCtrl.position.set(gx, gy - radio * 0.55, radio + 0.14);
    S.add(cajaCtrl);
    // Cables bajando de la caja
    for (const dz of [-0.02, 0.02]) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.50, 5),
        MineMaterials.plano(0x111111, { rough: 0.95 })
      );
      cable.rotation.z = 0.12;
      cable.position.set(gx, gy - radio * 0.55 - 0.38, radio + 0.12 + dz);
      S.add(cable);
    }
  }

  // ── Patas y base ─────────────────────────────────────────────────
  if (conPatas) {
    S = sub(g, 'patas', 'Patas y base', 'Soporte de piso del ventilador.');
    for (const x of [-0.45, 0.45]) {
      const pata = new THREE.Mesh(new THREE.BoxGeometry(0.06, radio + 0.25, 0.06), mAcero);
      pata.position.set(x, (radio + 0.25) / 2, 0);
      S.add(pata);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), mAcero);
    base.position.y = 0.03;
    S.add(base);
  }

  // ── Hazard y tick ────────────────────────────────────────────────
  g.name = 'ventilador';
  g.userData.solid = true;   // obstaculo solido: el jugador/NPC no lo atraviesa
  const velocidad = 18;
  g.userData.tick = (dt) => { rotor.rotation.x += velocidad * dt; };

  if (conProteccion) {
    g.userData.hazard = {
      tipo: 'aspas_guardadas',
      warn: 1.8,
      kill: 0.6,
      aviso: 'VENTILADOR EN OPERACION — guarda de proteccion instalada. No retires la guarda.',
      reflexion:
        'El ventilador te atrapó a pesar de la guarda. Nunca retires resguardos de seguridad ni ' +
        'intentes acceder a partes móviles sin apagado y bloqueo (LOTO).'
    };
  } else {
    g.userData.hazard = {
      tipo: 'aspas',
      warn: 3,
      kill: 1.1,
      aviso: 'PELIGRO: aspas en movimiento SIN guarda. No te acerques al ventilador en operacion.',
      reflexion:
        'Las aspas del ventilador te atraparon. Nunca te aproximes a partes moviles sin la ' +
        'parada y el bloqueo de energia (LOTO). Exige siempre que los equipos tengan ' +
        'sus resguardos correctamente instalados.'
    };
  }
  return g;
}
