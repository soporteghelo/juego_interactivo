import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../../world/materials/MineMaterials.js';
import { crearSenal } from '../senal/senal.js';
import { sub } from '../_comun/subelemento.js';

/**
 * REFUGIO MINERO (contenedor Drager) — md "ELEMENTO ESPECIAL: REFUGIO MINERO".
 *
 * Contenedor verde HABITABLE (~4×2.5×2.8 m): casco hueco con paredes macizas por los cuatro
 * costados + techo, y un ÚNICO acceso por la PUERTA frontal. La puerta se ABRE y CIERRA al
 * interactuar (E), y bloquea físicamente el vano cuando está cerrada — la única forma de
 * entrar o salir es por ella. Lleva semáforo verde/rojo (disponible/ocupado), letrero
 * ENTRADA/ENTRY (capacidad 20) y extintor lateral. INTERACTUABLE: ingresar.
 *
 * La solidez la aplica PropSolids leyendo `group.userData.solids` (cajas locales): los costados
 * son macizos y la caja `door:true` es la hoja que se habilita/deshabilita según
 * `group.userData._doorOpen`. El descriptor de interacción queda en group.userData.interactable.
 */

export const meta = {
  id: 'refugio',
  nombre: 'Refugio minero (Drager)',
  descripcion: 'Cámara de refugio habitable: puerta que abre/cierra (único acceso), semáforo y extintor. Interactuable.'
};

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  g.name = 'refugio';

  // Dimensiones del contenedor (habitable: la cápsula del jugador ~2.1 m cruza el vano).
  const W = 4.0;   // ancho (X, a lo largo del hastial)
  const H = 2.5;   // alto de paredes (Y)
  const D = 2.8;   // profundidad (Z, la puerta va en la cara +Z)
  const t = 0.1;   // medio-espesor de pared para la colisión
  const dW = 1.0;  // ancho del vano de puerta
  const dH = 2.2;  // alto del vano de puerta
  const front = D / 2; // cara frontal (+Z)

  const mCuerpo = MineMaterials.plano(0x1b6e3c, { rough: 0.6, metal: 0.5 });
  const mInterior = MineMaterials.plano(0x3a4f42, { rough: 0.85, metal: 0.15 });
  const mPuerta = MineMaterials.plano(0x14502b, { rough: 0.5, metal: 0.5 });

  // ── CASCO (paredes macizas + techo + piso) ───────────────────────
  let S = sub(g, 'cuerpo', 'Contenedor (casco)', 'Casco verde hueco ~4×2.5×2.8 m con acceso único por la puerta.');
  const panel = (w, h, d) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mCuerpo);

  // Fondo (-Z)
  const fondo = panel(W, H, 0.12); fondo.position.set(0, H / 2, -D / 2); fondo.castShadow = true; S.add(fondo);
  // Costados (±X)
  for (const sx of [-1, 1]) {
    const lado = panel(0.12, H, D); lado.position.set(sx * W / 2, H / 2, 0); lado.castShadow = true; S.add(lado);
  }
  // Techo
  const techo = panel(W + 0.06, 0.12, D + 0.06); techo.position.set(0, H, 0); techo.castShadow = true; S.add(techo);
  // Piso interior (fino, visual)
  const piso = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.06, D - 0.1), mInterior);
  piso.position.set(0, 0.03, 0); S.add(piso);

  // ── FRENTE (+Z): paneles a los lados del vano + dintel visual (sin collider) ──
  S = sub(g, 'frente', 'Frente y vano de puerta', 'Pared frontal con el hueco de acceso, paneles laterales y dintel.');
  const sideW = W / 2 - dW / 2;                 // ancho de cada panel lateral
  for (const sx of [-1, 1]) {
    const pfr = panel(sideW, H, 0.12);
    pfr.position.set(sx * (dW / 2 + sideW / 2), H / 2, front);
    S.add(pfr);
  }
  // Dintel visual sobre la puerta (no colisiona: deja gálibo de cabeza).
  const dintel = panel(dW + 0.1, H - dH, 0.12);
  dintel.position.set(0, dH + (H - dH) / 2, front);
  S.add(dintel);

  // ── PUERTA (hoja con bisagra en +X, abre hacia afuera) ────────────
  S = sub(g, 'puerta', 'Puerta frontal', 'Hoja de acceso: abre y cierra al interactuar; único ingreso al refugio.');
  const puerta = new THREE.Group();                 // pivote de la bisagra
  puerta.position.set(dW / 2, 0, front + 0.02);     // borde derecho del vano
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(dW, dH, 0.07), mPuerta);
  hoja.position.set(-dW / 2, dH / 2, 0);            // extiende hacia -X desde la bisagra
  hoja.castShadow = true;
  puerta.add(hoja);
  // Manija
  const manija = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), MineMaterials.plano(0x111111, { rough: 0.4, metal: 0.6 }));
  manija.position.set(-dW + 0.14, dH / 2, 0.06);
  puerta.add(manija);
  // Ventanilla (ojo de buey)
  const ojo = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), MineMaterials.plano(0x1a2a33, { rough: 0.2, metal: 0.3 }));
  ojo.position.set(-dW / 2, dH - 0.45, 0.04);
  puerta.add(ojo);
  S.add(puerta);

  // ── SEMÁFORO verde/rojo (panel +Z, junto a la puerta) ─────────────
  S = sub(g, 'semaforo', 'Semáforo verde/rojo', 'Verde = disponible, rojo = ocupado.');
  const greenLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    MineMaterials.plano(PALETTE.ledVerde, { emissive: PALETTE.ledVerde, emissiveIntensity: 3 })
  );
  greenLamp.position.set(-(dW / 2 + sideW / 2), H - 0.5, front + 0.08);
  S.add(greenLamp);
  const redLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    MineMaterials.plano(0x330000, { emissive: 0xcc0000, emissiveIntensity: 0 })
  );
  redLamp.position.set(-(dW / 2 + sideW / 2), H - 0.75, front + 0.08);
  S.add(redLamp);

  // ── LETRERO ENTRADA/ENTRY sobre la puerta ─────────────────────────
  S = sub(g, 'letrero', 'Letrero ENTRADA/ENTRY', 'Señal de entrada con capacidad (20 personas).');
  const entry = crearSenal('refugio_entrada');
  entry.scale.set(0.9, 0.45, 1);
  entry.position.set(0, dH + 0.28, front + 0.09);
  S.add(entry);

  // ── EXTINTOR lateral ──────────────────────────────────────────────
  S = sub(g, 'extintor', 'Extintor lateral', 'Extintor rojo montado en el costado.');
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), MineMaterials.plano(0xcc0000, { rough: 0.4, metal: 0.3 }));
  ext.position.set(W / 2 + 0.12, 0.6, front - 0.4);
  S.add(ext);

  // ── COLISIÓN DEL CASCO (solo se entra/sale por la puerta) ─────────
  const doorHz = 0.09, doorHx = dW / 2;
  g.userData.solids = [
    { hx: W / 2, hy: H / 2, hz: 0.09, pos: [0, H / 2, -D / 2] },                       // fondo (-Z)
    { hx: 0.09, hy: H / 2, hz: D / 2, pos: [ W / 2, H / 2, 0] },                        // costado +X
    { hx: 0.09, hy: H / 2, hz: D / 2, pos: [-W / 2, H / 2, 0] },                        // costado -X
    { hx: W / 2, hy: 0.09, hz: D / 2, pos: [0, H, 0] },                                 // techo
    { hx: sideW / 2, hy: H / 2, hz: 0.09, pos: [ (dW / 2 + sideW / 2), H / 2, front] }, // panel frontal +X
    { hx: sideW / 2, hy: H / 2, hz: 0.09, pos: [-(dW / 2 + sideW / 2), H / 2, front] }, // panel frontal -X
    // HOJA de puerta (bloquea el vano cuando está cerrada). Sin dintel de colisión.
    { hx: doorHx, hy: dH / 2, hz: doorHz, pos: [0, dH / 2, front + 0.02], door: true }
  ];

  // ── ESTADO + ANIMACIÓN DE LA PUERTA ───────────────────────────────
  let abierto = false;
  g.userData._doorOpen = abierto;      // lo lee PropSolids para el collider de la puerta
  const OPEN_ANGLE = Math.PI * 0.6;    // abre hacia afuera
  let doorAngle = 0, doorTarget = 0;

  const setEstado = (ab) => {
    doorTarget = ab ? OPEN_ANGLE : 0;
    greenLamp.material.emissiveIntensity = ab ? 0 : 3;
    redLamp.material.emissiveIntensity = ab ? 3 : 0;
    g.userData._doorOpen = ab;
    if (g.userData._doorColliders) {
      for (const c of g.userData._doorColliders) c.setEnabled(!ab);
    }
  };

  // Tick: anima el giro de la hoja (y exime al refugio del "freeze" de matrices estáticas).
  g.userData.tick = (dt) => {
    if (Math.abs(doorTarget - doorAngle) > 1e-3) {
      doorAngle += (doorTarget - doorAngle) * Math.min(1, dt * 6);
      puerta.rotation.y = doorAngle;
    }
  };

  g.userData.interactable = {
    object: g,
    descriptor: {
      label: 'Ingresar al Refugio Minero N°2',
      onInteract: () => {
        abierto = !abierto;
        setEstado(abierto);
        window.__mina?.bus.emit('ui:read', {
          title: 'REFUGIO MINERO N°2 — NEXA',
          body:
            (abierto ? 'Puerta ABIERTA — Refugio OCUPADO. ' : 'Puerta CERRADA — Refugio DISPONIBLE. ') +
            'Capacidad: 20 personas. Fabricante: Drager. En caso de emergencia: ingresar, ' +
            'sellar la puerta, activar el sistema de aire/scrubber de CO2 y mantener la calma ' +
            'hasta el rescate. Verificar oxigeno y comunicar por linea de vida.'
        });
      }
    }
  };
  return g;
}
