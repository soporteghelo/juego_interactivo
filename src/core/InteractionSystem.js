import * as THREE from 'three';

/**
 * Sistema de interaccion por raycast desde el centro de la camara.
 *
 * Cualquier objeto puede volverse interactuable registrandolo con un descriptor:
 *   registerInteractable(mesh, { label, onInteract })
 *
 * Cada frame lanza un rayo hacia adelante; si toca un interactuable dentro de rango,
 * publica 'ui:prompt' con la etiqueta (ej: "Leer senal", "Abrir refugio"). Al pulsar
 * la accion de interaccion (tecla E / boton tactil) ejecuta su onInteract.
 *
 * Cumple la feature del plan: abrir puertas, activar equipos, recoger objetos,
 * inspeccionar elementos, leer senaletica, revisar tableros, ejecutar procedimientos.
 *
 * RENDIMIENTO — el rayo solo llega a 3.2 m, pero `intersectObjects` no tiene indice espacial:
 * probaba los 100 interactuables de TODA la mina y, con `recursive`, bajaba por sus subarboles
 * (9.146 objetos; el refugio Dräger solo ya son 1.300 mallas) en cada frame para encontrar,
 * tipicamente, uno. Medido: 3.5 ms por frame. Ahora se descartan primero por distancia con una
 * comparacion de cuadrados —usando el radio envolvente de cada objeto, cacheado— y el raycast
 * real se lanza sobre los poquisimos que quedan al alcance.
 */
export class InteractionSystem {
  constructor(camera, input, eventBus) {
    this.camera = camera;
    this.input = input;
    this.bus = eventBus;

    this.maxDistance = 3.2; // alcance de interaccion en metros
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = this.maxDistance;
    this._targets = [];     // meshes registrados
    this._radios = [];      // radio envolvente de cada target (paralelo a _targets)
    this._cercanos = [];    // buffer reutilizado: targets al alcance en este frame
    this._current = null;   // interactuable enfocado actualmente
    this._center = new THREE.Vector2(0, 0); // centro de pantalla (NDC)
  }

  /**
   * @param {THREE.Object3D} object
   * @param {{label:string, onInteract:Function}} descriptor
   */
  registerInteractable(object, descriptor) {
    object.userData.interactable = descriptor;
    this._targets.push(object);
    this._radios.push(this._radioEnvolvente(object));
  }

  /**
   * Radio de la esfera que envuelve al objeto MEDIDO DESDE SU ORIGEN. Es invariante ante
   * traslacion y rotacion, asi que sirve igual para props fijos y para vehiculos en marcha:
   * basta compararlo contra la distancia a la camara para saber si el rayo puede alcanzarlo.
   */
  _radioEnvolvente(object) {
    object.updateWorldMatrix(true, true);
    const caja = new THREE.Box3().setFromObject(object);
    if (caja.isEmpty()) return 0;
    const centro = caja.getCenter(new THREE.Vector3());
    const origen = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
    // radio alrededor del centro de la caja + cuanto se desplaza ese centro respecto al origen
    return caja.min.distanceTo(caja.max) * 0.5 + centro.distanceTo(origen);
  }

  /** Quita un interactuable (ej: al descargar un segmento). */
  unregister(object) {
    const i = this._targets.indexOf(object);
    if (i >= 0) { this._targets.splice(i, 1); this._radios.splice(i, 1); }
    if (this._current === object) this._setFocus(null);
  }

  update() {
    if (!this.input.enabled) return;

    // Descarte por distancia ANTES del raycast: nada mas lejos que (alcance + su radio) puede
    // ser tocado por el rayo. Sin raices cuadradas ni asignaciones.
    const cam = this.camera.position;
    const cercanos = this._cercanos;
    cercanos.length = 0;
    for (let i = 0; i < this._targets.length; i++) {
      const o = this._targets[i];
      if (!o.visible) continue;
      const m = o.matrixWorld.elements;
      const dx = m[12] - cam.x, dy = m[13] - cam.y, dz = m[14] - cam.z;
      const alcance = this.maxDistance + this._radios[i];
      if (dx * dx + dy * dy + dz * dz <= alcance * alcance) cercanos.push(o);
    }

    if (!cercanos.length) {
      if (this._current) this._setFocus(null);
      return;
    }

    this._raycaster.setFromCamera(this._center, this.camera);
    const hits = this._raycaster.intersectObjects(cercanos, true);

    // Sube por la jerarquia hasta encontrar el descriptor de interaccion.
    let focused = null;
    if (hits.length > 0) {
      let o = hits[0].object;
      while (o && !o.userData.interactable) o = o.parent;
      focused = o || null;
    }

    if (focused !== this._current) this._setFocus(focused);

    if (this._current && this.input.consumePressed('interact')) {
      const desc = this._current.userData.interactable;
      desc.onInteract?.(this._current);
      this.bus.emit('player:interact', { object: this._current, label: desc.label });
    }
  }

  _setFocus(object) {
    this._current = object;
    this.bus.emit('ui:prompt', object ? object.userData.interactable.label : null);
  }
}
