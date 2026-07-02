import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Cargador central de assets con cache y fallback a placeholder.
 *
 * En esta entrega NO hay modelos externos: toda la geometria es procedural (primitivas).
 * Pero GLTFLoader + DRACOLoader quedan cableados para que, al soltar archivos .glb en
 * src/assets/models/, se sustituyan los placeholders sin tocar la logica del mundo.
 *
 * `loadModel(url)` intenta cargar; si falla, devuelve el placeholder provisto para que
 * la escena nunca quede vacia (requisito del plan: placeholders cuando no hay assets).
 */
export class AssetLoader {
  constructor() {
    this.gltf = new GLTFLoader();

    // DRACO decodifica geometria comprimida. Usamos el decoder de un CDN para no
    // empaquetar binarios; cambiar a ruta local si se requiere offline.
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltf.setDRACOLoader(this.draco);

    this.textureLoader = new THREE.TextureLoader();

    this._modelCache = new Map();
    this._textureCache = new Map();
  }

  /**
   * Carga un GLTF (cacheado). Si falla, devuelve `placeholderFactory()` si se provee.
   * @returns {Promise<THREE.Object3D>}
   */
  async loadModel(url, placeholderFactory = null) {
    if (this._modelCache.has(url)) return this._modelCache.get(url).clone();
    try {
      const gltf = await this.gltf.loadAsync(url);
      this._modelCache.set(url, gltf.scene);
      return gltf.scene.clone();
    } catch (err) {
      console.warn(`[AssetLoader] no se pudo cargar "${url}", usando placeholder.`, err);
      return placeholderFactory ? placeholderFactory() : new THREE.Group();
    }
  }

  /** Carga una textura (cacheada) con colorSpace correcto. */
  loadTexture(url, { srgb = true } = {}) {
    if (this._textureCache.has(url)) return this._textureCache.get(url);
    const tex = this.textureLoader.load(url);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this._textureCache.set(url, tex);
    return tex;
  }

  dispose() {
    this.draco.dispose();
    this._textureCache.forEach((t) => t.dispose());
  }
}
