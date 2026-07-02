import * as THREE from 'three';

/**
 * Base de sistemas de particulas basada en THREE.Points.
 *
 * Crea un buffer de N particulas con posiciones y velocidades. Las subclases definen como
 * se inicializan y actualizan. Pensado para ser barato (un solo objeto, sin pooling de
 * objetos Three): el "pooling" aqui es el reuso del mismo buffer cada frame.
 */
export class ParticleSystem {
  constructor({ scene, count, material, bounds }) {
    this.scene = scene;
    this.count = count;
    this.bounds = bounds; // {x,y,z} medio-tamano de la caja de simulacion

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false; // sigue a la camara, siempre visible
    scene.add(this.points);
  }

  setVisible(v) {
    this.points.visible = v;
  }
}
