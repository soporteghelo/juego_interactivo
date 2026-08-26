import * as THREE from 'three';
import { PALETTE } from '../world/materials/MineMaterials.js';
import { crearVeloHeadlamp, hayHaz } from '../lighting/haz_luz.js';
import { Settings } from '../core/Settings.js';

/**
 * Linterna de casco (headlamp) con 5 estados ciclicos:
 *   OFF → L1 → L2 → L3 → L4 (maximo) → OFF …
 *
 * Se activa con la tecla F o CLIC DERECHO (anticlick). El estado actual se
 * emite via EventBus ('headlamp:changed') para que el HUD actualice el indicador.
 */

const NIVELES = [
  { label: 'OFF', intensity: 0,   distance: 0,  haz: 0     },
  { label: 'L1',  intensity: 5,   distance: 20, haz: 0.045 },
  { label: 'L2',  intensity: 12,  distance: 38, haz: 0.070 },
  { label: 'L3',  intensity: 24,  distance: 56, haz: 0.095 },
  { label: 'L4',  intensity: 42,  distance: 80, haz: 0.120 },
];

// Semiangulo del cono del headlamp: el mismo que el SpotLight, para que el haz VISIBLE coincida
// con lo que de verdad esta iluminado (si el cono dibujado fuera mas ancho, se veria polvo
// encendido sobre roca a oscuras).
const ANGULO = Math.PI / 6.5;
// El velo de polvo se coloca justo delante de la camara (sus dos laminas van a 1.7 y 3.4 m en
// espacio LOCAL del grupo), asi que el grupo se pega a la posicion y orientacion de la camara.

export class Headlamp {
  constructor(camera, scene, bus) {
    this.camera = camera;
    this._bus = bus;
    this._level = 3;  // arranca en L3 (brillo maximo)
    this.on = true;

    this.light = new THREE.SpotLight(
      PALETTE.headlampFrio,
      NIVELES[3].intensity,
      NIVELES[3].distance,
      ANGULO, 0.4, 1.2
    );
    this.light.castShadow = false;

    this.target = new THREE.Object3D();
    scene.add(this.light);
    scene.add(this.target);
    this.light.target = this.target;

    // POLVO ENCENDIDO del headlamp (md: "cono de luz duro y dirigido" + "dense dust particles
    // visible in light beams"). Gateado por preset, pero se mantiene incluso en celular: es la
    // unica fuente que el jugador lleva siempre encima y sin ella, a oscuras, no hay forma de
    // leer la profundidad de la labor. Ver `crearVeloHeadlamp` para por que no es un cono.
    this.haz = null;
    if (hayHaz(false)) {
      // En celular una sola lamina: cada una es overdraw aditivo de casi toda la pantalla, y es
      // el mismo coste que obliga a apagar `Mist` en tactil. `hazLuzFijas` sirve de proxy del
      // presupuesto de fill-rate del preset (solo esta en alto/medio).
      this.haz = crearVeloHeadlamp({
        color: PALETTE.headlampFrio,
        capas: Settings.current.hazLuzFijas ? 2 : 1
      });
      this.haz.userData.ajustar({ radio: this._radioVelo(3), intensidad: NIVELES[3].haz });
      scene.add(this.haz);
    }
    // Cambiar de preset en caliente (PerfMonitor) debe poder apagarlo/encenderlo.
    Settings.onChange(() => {
      if (this.haz) this.haz.visible = this.on && hayHaz(false);
    });

    this._dir = new THREE.Vector3();
    this._q = new THREE.Quaternion();   // reusado cada frame: sin basura por frame
  }

  /**
   * Ciclo ASCENDENTE: OFF → L1 → L2 → L3 → L4 → OFF → …
   * Cada anticlick (clic derecho) sube un nivel; al llegar a L4 se apaga.
   */
  cycle() {
    this._level = (this._level + 1) % 5;
    this._apply();
  }

  /** Toggle on/off directo (sin pasar por los niveles intermedios). */
  toggle() {
    this._level = this.on ? 0 : 3;
    this._apply();
  }

  /**
   * Radio del velo de polvo a la distancia de la capa cercana (1.7 m), es decir el ancho REAL del
   * cono del SpotLight ahi. Asi el polvo encendido coincide con lo que de verdad esta iluminado.
   * Los niveles bajos abren un pelin menos: una lampara floja no "llena" todo su cono de polvo.
   */
  _radioVelo(nivel) {
    return Math.tan(ANGULO) * 1.7 * (0.7 + 0.075 * nivel);
  }

  _apply() {
    const n = NIVELES[this._level];
    this.on = this._level > 0;
    this.light.intensity = n.intensity;
    if (this._level > 0) this.light.distance = n.distance;
    if (this.haz) {
      // El velo se densifica con el nivel: en L1 apenas se intuye el polvo, en L4 el haz es un
      // tubo de luz nitido. Es lo mismo que hace una lampara real al subir de potencia.
      this.haz.visible = this.on && hayHaz(false);
      if (this.on) this.haz.userData.ajustar({ radio: this._radioVelo(this._level), intensidad: n.haz });
    }
    this._bus?.emit('headlamp:changed', { level: this._level, label: n.label });
  }

  /** Sigue a la camara cada frame (la luz sale desde la cabeza hacia donde se mira). */
  update() {
    this.camera.getWorldDirection(this._dir);
    this.light.position.copy(this.camera.position);
    // `_dir` queda escalado por el multiplyScalar de abajo, asi que el haz se coloca ANTES.
    if (this.haz?.visible) {
      // Las laminas del velo cuelgan sobre -Z local, igual que la direccion de vista: basta pegar
      // el grupo a la camara. `getWorldQuaternion` (y no `camera.quaternion`) por si cuelga de un rig.
      this.haz.quaternion.copy(this.camera.getWorldQuaternion(this._q));
      this.haz.position.copy(this.camera.position);
    }
    this.target.position.copy(this.camera.position).add(this._dir.multiplyScalar(10));
  }

  /** Intensidad maxima (L4). */
  get onIntensity() { return NIVELES[4].intensity; }
}
