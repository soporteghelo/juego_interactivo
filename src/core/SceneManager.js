import * as THREE from 'three';
import { Settings } from './Settings.js';

/**
 * Crea y gestiona la escena y su atmosfera.
 *
 * "Regla de oro" del md: NO hay luz ambiental difusa; el fondo se pierde en negro puro
 * a 10-15m. Eso se logra con un fondo negro y niebla densa (FogExp2/Fog) ajustada por
 * el preset de calidad. La iluminacion real la aporta lighting/ (solo fuentes puntuales).
 */
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();

    const black = new THREE.Color(0x000000);
    this.scene.background = black;

    // Niebla lineal: controla a que distancia se traga el fondo. Valores del preset.
    this.scene.fog = new THREE.Fog(
      0x000000,
      Settings.current.fogNear,
      Settings.current.fogFar
    );

    // Luz ambiental (luminarias generales de la mina): piso de visibilidad. Duplicada.
    this._ambientBase = 1.15;
    this.ambient = new THREE.AmbientLight(0x8390a0, this._ambientBase);
    this.scene.add(this.ambient);

    // Hemisferica: da volumen a las paredes. OJO: en un tunel el TECHO tiene su normal
    // apuntando hacia abajo, asi que recibe el color de SUELO (ground) de esta luz. Por eso
    // el ground se sube a un tono terroso claro (0x6a6252) para que la CORONA (techo de la
    // labor) se vea con su textura terrosa al mirar arriba, en vez de perderse en negro.
    this._hemiBase = 1.3;
    this.hemi = new THREE.HemisphereLight(0xa8b6c8, 0x6a6252, this._hemiBase);
    this.scene.add(this.hemi);

    Settings.onChange((q) => {
      this.scene.fog.near = q.fogNear;
      this.scene.fog.far = q.fogFar;
    });

    // Luminosidad: escala ambient+hemi sin tocar materiales emisivos (cintas, LEDs).
    Settings.onBrightness((v) => {
      this.ambient.intensity = this._ambientBase * v;
      this.hemi.intensity    = this._hemiBase * v;
    });
  }

  add(obj) {
    this.scene.add(obj);
  }

  remove(obj) {
    this.scene.remove(obj);
  }
}
