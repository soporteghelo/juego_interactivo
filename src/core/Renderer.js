import * as THREE from 'three';
import { Settings } from './Settings.js';

/**
 * Configuracion del WebGLRenderer fiel a la "regla de oro" del md:
 * ambiente extremadamente oscuro, alto contraste, tono cinematografico.
 *
 * - ACESFilmicToneMapping + exposicion baja: negros profundos, luces que no se queman.
 * - sRGB output: colores correctos.
 * - Sombras PCFSoft (solo si el preset las habilita).
 * - pixelRatio limitado por preset: clave para rendimiento en celular/GPU integrada.
 */
export class Renderer {
  constructor(container) {
    this.container = container;

    this.instance = new THREE.WebGLRenderer({
      antialias: Settings.current.pixelRatioCap > 1, // AA solo si hay margen
      powerPreference: 'high-performance',
      stencil: false
    });

    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    // Exposicion: control global de luminosidad de toda la escena renderizada.
    // Triplicado a 6.0 respecto al baseline original (2.0) -> galerias 3x iluminadas.
    this.instance.toneMappingExposure = 6.0;

    this._applyQuality(Settings.current);
    Settings.onChange((q) => this._applyQuality(q));

    this.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.instance.domElement);
  }

  _applyQuality(q) {
    const ratio = Math.min(window.devicePixelRatio || 1, q.pixelRatioCap);
    this.instance.setPixelRatio(ratio);

    this.instance.shadowMap.enabled = q.shadows;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  setSize(w, h) {
    this.instance.setSize(w, h);
  }

  get domElement() {
    return this.instance.domElement;
  }

  dispose() {
    this.instance.dispose();
  }
}
