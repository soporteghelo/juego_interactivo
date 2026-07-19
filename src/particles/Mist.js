import * as THREE from 'three';
import { Device } from '../core/Device.js';

/**
 * Niebla baja / neblina a ras de piso (md: halo difuso en neblina, ambiente humedo).
 *
 * Complementa a la niebla de escena (SceneManager) con unas pocas capas planas
 * semitransparentes a baja altura que se mueven suavemente y siguen a la camara. Es muy
 * barato (3-4 planos) y aporta volumen a los haces de luz. Se desactiva en calidad baja.
 *
 * OJO fill-rate: son 4 planos aditivos de 30x30 con depthWrite:false que siguen a la camara,
 * es decir ~4x overdraw de PANTALLA COMPLETA cada frame. Barato en escritorio, pero uno de los
 * mayores costes en GPU movil (tile-based), asi que se DESACTIVA en dispositivos tactiles.
 */
export class MistSystem {
  constructor({ scene, settings }) {
    this.scene = scene;
    this.settings = settings;
    this.group = new THREE.Group();
    this.enabled = settings.current.particleDensity > 0.25 && !Device.isTouch;

    const tex = this._softTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0x2a3530
    });

    this.layers = [];
    const layerCount = 4;
    for (let i = 0; i < layerCount; i++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = 0.4 + i * 0.25;
      this.group.add(plane);
      this.layers.push(plane);
    }
    this.group.visible = this.enabled;
    scene.add(this.group);
  }

  /** Textura suave radial para difuminar los planos. */
  _softTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  update(dt, elapsed) {
    if (!this.enabled) return;
    // Sigue a la camara en el plano XZ y deriva lentamente.
    const cam = window.__mina?.camera;
    if (cam) this.group.position.set(cam.position.x, 0, cam.position.z);
    this.layers.forEach((l, i) => {
      l.rotation.z = elapsed * 0.02 * (i % 2 ? 1 : -1);
    });
  }
}
