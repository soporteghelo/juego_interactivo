import * as THREE from 'three';
import { Settings } from './Settings.js';
import { Device } from './Device.js';

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
      // AA solo en escritorio con margen. En tactil se desactiva: el MSAA cuesta ancho de
      // banda/memoria en GPU movil y a pixelRatio 1.25+ apenas se aprecia; ademas cuando hay
      // postprocesado el MSAA del framebuffer por defecto no hace nada (se renderiza a un RT).
      antialias: !Device.isTouch && Settings.current.pixelRatioCap > 1,
      powerPreference: 'high-performance',
      stencil: false
    });

    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    // Exposicion: control global de luminosidad de toda la escena renderizada.
    // Bajada de 6.0 a 5.0 (junto con el recorte de luz ambiental en SceneManager) para
    // recuperar el claroscuro del md: negros profundos, luces puntuales que resaltan.
    this.instance.toneMappingExposure = 5.0;

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
