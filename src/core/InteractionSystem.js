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
  }

  /** Quita un interactuable (ej: al descargar un segmento). */
  unregister(object) {
    const i = this._targets.indexOf(object);
    if (i >= 0) this._targets.splice(i, 1);
    if (this._current === object) this._setFocus(null);
  }

  update() {
    if (!this.input.enabled) return;

    this._raycaster.setFromCamera(this._center, this.camera);
    const hits = this._raycaster.intersectObjects(this._targets, true);

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
