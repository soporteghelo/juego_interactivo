import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { Settings } from './Settings.js';

/**
 * Cadena de postprocesado, clave para el look hiperrealista del md:
 *  - Bloom (UnrealBloom): el resplandor del LED verde neon y del headlamp. Imprescindible.
 *  - Film grain: simula el ISO alto/grano de las fotos reales (Honor Magic7 Lite del md).
 *  - Vignette: oscurece bordes, refuerza el claroscuro y la claustrofobia.
 *
 * Todo gated por el preset de calidad. En 'bajo' se omite y se renderiza directo.
 */
export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = Settings.current.postprocessing;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // Bloom: umbral alto para que solo brillen las fuentes emisivas (LED, faros).
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloom = new UnrealBloomPass(size, 0.9, 0.6, 0.85);
    this.composer.addPass(this.bloom);

    this.film = new FilmPass(0.35);

    this.vignette = new ShaderPass(VignetteShader);
    this.vignette.uniforms.offset.value = 1.1;
    this.vignette.uniforms.darkness.value = 1.3;

    this._applyQuality(Settings.current);
    Settings.onChange((q) => this._applyQuality(q));

    this.setSize(window.innerWidth, window.innerHeight);
  }

  _applyQuality(q) {
    this.enabled = q.postprocessing;
    this.bloom.enabled = q.bloom;

    // Reconstruye los passes opcionales segun el preset.
    this.composer.passes = this.composer.passes.filter(
      (p) => p !== this.film && p !== this.vignette
    );
    if (q.grain) this.composer.addPass(this.film);
    if (q.vignette) this.composer.addPass(this.vignette);

    // El ultimo pass debe renderizar a pantalla.
    const passes = this.composer.passes;
    passes.forEach((p, i) => (p.renderToScreen = i === passes.length - 1));
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    // Bloom a media resolucion: los pases de blur (los mas caros, cada frame) trabajan
    // con 1/4 de los pixeles. El resplandor es difuso, asi que la perdida es imperceptible
    // y el ahorro en GPU integrada / celular es grande.
    const factor = Settings.current.bloomHalfRes === false ? 1 : 0.5;
    this.bloom.setSize(Math.max(1, Math.round(w * factor)), Math.max(1, Math.round(h * factor)));
  }

  render(dt) {
    this.composer.render(dt);
  }
}
