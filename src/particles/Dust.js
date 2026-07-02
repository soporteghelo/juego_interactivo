import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem.js';

/**
 * Polvo en suspension visible en los haces de luz (md: "Dense dust/mist particles visible
 * in light beams"; no olvidar el polvo en escenas de perforacion/shotcrete).
 *
 * Nube de particulas que rodea a la camara y deriva lentamente. Con el bloom y el headlamp
 * crea el caracteristico polvo iluminado. La cantidad escala con el preset (particleDensity).
 */
export class DustSystem extends ParticleSystem {
  constructor({ scene, camera, settings }) {
    const base = 1200;
    const count = Math.max(120, Math.round(base * settings.current.particleDensity));
    const bounds = { x: 10, y: 5, z: 10 };

    const material = new THREE.PointsMaterial({
      color: 0xb9b6a8,
      size: 0.02,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    super({ scene, count, material, bounds });
    this.camera = camera;

    // Distribucion inicial + velocidades de deriva muy suaves.
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 2 * bounds.x;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * bounds.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * bounds.z;
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.05;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }
  }

  update(dt) {
    const cam = this.camera.position;
    const b = this.bounds;
    // El sistema de particulas se centra en la camara (recoloca el contenedor).
    this.points.position.set(cam.x, cam.y, cam.z);

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      this.positions[ix] += this.velocities[ix] * dt;
      this.positions[ix + 1] += this.velocities[ix + 1] * dt;
      this.positions[ix + 2] += this.velocities[ix + 2] * dt;

      // Envuelve las particulas dentro de la caja (efecto infinito).
      if (this.positions[ix] > b.x) this.positions[ix] -= 2 * b.x;
      else if (this.positions[ix] < -b.x) this.positions[ix] += 2 * b.x;
      if (this.positions[ix + 1] > b.y) this.positions[ix + 1] -= 2 * b.y;
      else if (this.positions[ix + 1] < -b.y) this.positions[ix + 1] += 2 * b.y;
      if (this.positions[ix + 2] > b.z) this.positions[ix + 2] -= 2 * b.z;
      else if (this.positions[ix + 2] < -b.z) this.positions[ix + 2] += 2 * b.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}
