import * as THREE from 'three';
import { MineMaterials } from '../world/materials/MineMaterials.js';
import { crear as crearExtintor } from './extintor.js';

/**
 * CAMION MINERO / VOLQUETE (dump truck) — equipo pesado de acarreo. Chasis + cabina +
 * tolva (dump bed) + ruedas grandes. Amarillo industrial polvoriento (md: equipos
 * polvorientos). Baliza ambar giratoria en la cabina (animada).
 *
 * Para editar dimensiones/colores, modifica este archivo.
 */

export const meta = {
  id: 'camion',
  nombre: 'Camion / volquete',
  descripcion: 'Equipo pesado de acarreo con tolva y baliza ambar. Amarillo polvoriento.'
};

function rueda(radio = 0.55, ancho = 0.45) {
  const r = new THREE.Mesh(
    new THREE.CylinderGeometry(radio, radio, ancho, 16),
    MineMaterials.plano(0x141414, { rough: 0.95, metal: 0.1 })
  );
  r.rotation.x = Math.PI / 2;
  // Llanta
  const llanta = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.5, radio * 0.5, ancho + 0.02, 10),
    MineMaterials.plano(0x888888, { metal: 0.7, rough: 0.4 })
  );
  llanta.rotation.x = Math.PI / 2;
  r.add(llanta);
  return r;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const amarillo = MineMaterials.plano(0xc9a227, { rough: 0.8, metal: 0.25 });
  const oscuro = MineMaterials.plano(0x3a3a3a, { rough: 0.7, metal: 0.4 });

  // Chasis
  const chasis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 7.5), oscuro);
  chasis.position.y = 0.9;
  g.add(chasis);

  // Cabina (adelante, +Z)
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.8), amarillo);
  cabina.position.set(0, 1.7, 2.6);
  cabina.castShadow = true;
  g.add(cabina);
  // Parabrisas
  const vidrio = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.7, 0.05),
    MineMaterials.plano(0x223344, { rough: 0.1, metal: 0.2 })
  );
  vidrio.position.set(0, 1.95, 3.5);
  g.add(vidrio);
  // Faros
  for (const x of [-0.8, 0.8]) {
    const faro = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 12),
      MineMaterials.plano(0xffffee, { emissive: 0xffffcc, emissiveIntensity: 1.2 })
    );
    faro.position.set(x, 1.3, 3.56);
    g.add(faro);
  }

  // Tolva (dump bed) atras, ligeramente levantada al frente
  const tolva = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.3, 4.6), amarillo);
  tolva.position.set(0, 2.0, -1.6);
  tolva.castShadow = true;
  g.add(tolva);
  // Hueco (carga oscura)
  const carga = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 4.2), MineMaterials.roca());
  carga.position.set(0, 2.55, -1.6);
  g.add(carga);

  // Ruedas (2 delanteras + 4 traseras) — guardadas para animar el giro.
  const ejeY = 0.6;
  const posRuedas = [
    [-1.25, ejeY, 2.4], [1.25, ejeY, 2.4],
    [-1.25, ejeY, -1.2], [1.25, ejeY, -1.2],
    [-1.25, ejeY, -2.6], [1.25, ejeY, -2.6]
  ];
  const ruedas = [];
  for (const p of posRuedas) {
    const r = rueda();
    r.position.set(p[0], p[1], p[2]);
    g.add(r);
    ruedas.push(r);
  }

  // Baliza ambar (parpadea)
  const baliza = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10),
    MineMaterials.plano(0xff8800, { emissive: 0xff8800, emissiveIntensity: 2 })
  );
  baliza.position.set(0.7, 2.5, 2.6);
  g.add(baliza);

  // Extintor con tarjeta de inspeccion (lado derecho de la cabina)
  g.add(crearExtintor({ x: 1.16, y: 0.62, z: 2.8, ry: Math.PI / 2 }));

  g.name = 'camion';
  // _speed lo inyecta PropScatter al configurar el patrullaje.
  g.userData._speed = 0;
  g.userData.tick = (dt, elapsed) => {
    baliza.material.emissiveIntensity = 1.2 + Math.abs(Math.sin(elapsed * 6)) * 2.5;
    // Giro de ruedas proporcional a la velocidad de avance (radio ~0.55 m).
    const vel = g.userData._speed;
    if (vel !== 0) {
      for (const r of ruedas) r.rotation.z += (vel / 0.55) * dt;
    }
  };
  // live:true -> HazardSystem recalcula la caja envolvente cada frame.
  // hurt (no kill): el contacto con equipo en movimiento GOLPEA pero no es fatal.
  g.userData.hazard = {
    tipo: 'atropello',
    live: true,
    warn: 7,
    hurt: 0.5,
    aviso: 'EQUIPO PESADO EN MOVIMIENTO — via peatonal obligatoria, contacto visual con el operador.',
    reflexion:
      'Fuiste golpeado por un volquete en movimiento. En mineria NUNCA te ubiques en la ' +
      'trayectoria ni en el punto ciego de un equipo pesado. Usa siempre la via peatonal ' +
      'demarcada, manten contacto visual con el operador y respeta las distancias de seguridad.'
  };
  return g;
}
