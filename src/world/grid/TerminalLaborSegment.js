import * as THREE from 'three';
import { BaseSegment } from '../segments/BaseSegment.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { RoomSegment } from './RoomSegment.js';

/**
 * Fondo de saco de una labor especial.
 *
 * Mantiene exactamente el galibo del acceso hasta el frente ciego. Conserva `type = room`,
 * `roomType` y el mobiliario de RoomSegment para no romper cuadrillas, ciclos de equipos,
 * peligros ni minimapa, pero elimina por completo la sala cuadrada/acampanada de 12 x 12 m.
 *
 * El grupo queda centrado en el nodo terminal. El tunel hijo empieza en la boca que mira al
 * acceso y avanza hasta el lado opuesto, donde una cara de roca cierra la excavacion.
 */
export class TerminalLaborSegment extends RoomSegment {
  constructor({ width, height, length, openDirs, roomType, label, lighting, rng, wireframeStyle = false, variant = null }) {
    // RoomSegment usa `size` para distribuir el mobiliario transversalmente. Debe ser el ancho
    // real del acceso, no la longitud del fondo de saco, para que nada presuponga una camara.
    super({ size: width, height, openDirs, roomType, label, lighting });
    this.width = width;
    this.height = height;
    this.length = length;
    this.rng = rng;
    this.wireframeStyle = wireframeStyle;
    this.variant = variant || {};
    this.terminalLabor = true;
    this.group.name = `labor_terminal_${roomType}`;
  }

  build() {
    const openDir = this._accessDirection();          // desde el centro hacia la entrada
    const deepDir = { x: -openDir.x, z: -openDir.z }; // desde el centro hacia el frente ciego
    const yaw = Math.atan2(-deepDir.x, -deepDir.z);

    // Carcasa, piso y colisiones con la MISMA seccion que la via de acceso.
    const tunnel = new BaseSegment({
      width: this.width,
      height: this.height,
      length: this.length,
      rng: this.rng,
      shotcrete: this.variant.shotcrete ?? false,
      detail: 0.7,
      wireframeStyle: this.wireframeStyle,
      variant: this.variant
    });
    tunnel.build();
    tunnel.group.name = 'galibo_continuo_labor';
    tunnel.group.position.set(openDir.x * this.length / 2, 0, openDir.z * this.length / 2);
    tunnel.group.rotation.y = yaw;
    this.group.add(tunnel.group);
    this.shell = tunnel.shell;

    // BaseSegment expresa sus cajas en el espacio local del hijo. Como las labores son
    // cardinales, al girarlas 90 grados basta transformar centros e intercambiar X/Z.
    for (const collider of tunnel.colliders) this.colliders.push(this._toRootCollider(collider, tunnel.group));

    // La carcasa de BaseSegment queda abierta en ambos extremos. Cerramos el extremo de avance
    // con roca de la misma herradura y con una caja fisica: no existe espacio tras el frente.
    this._buildBlindFace(tunnel.group);
    const blind = this._toRootCollider({
      hx: this.width / 2,
      hy: this.height / 2,
      hz: 0.22,
      pos: [0, this.height / 2, -this.length]
    }, tunnel.group);
    blind.tag = 'frente_ciego';
    this.colliders.push(blind);

    // Iluminacion compacta dentro del mismo galibo.
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(1.2, this.width * 0.28), 0.08, 1.2),
      MineMaterials.ledBlanco()
    );
    panel.position.set(0, this.height - 0.15, 0);
    this.group.add(panel);
    if (this.lighting?.canAddLight?.()) {
      const light = new THREE.PointLight(0xf5f8ff, 24, 16, 2);
      light.position.set(0, this.height - 0.25, 0);
      this.group.add(light);
      this.lighting.noteLight();
    }

    // Reutiliza los equipos, senales, interactuables y peligros ya definidos por tipo de labor.
    this._furnish(openDir);

    this.animated.push(...tunnel.animated);
    this.group.traverse((object) => {
      if (object.userData?.tick && !this.animated.includes(object)) this.animated.push(object);
    });
    return this;
  }

  _accessDirection() {
    const d = this.openDirs[0] || { x: 0, z: 1 };
    if (Math.abs(d.x) >= Math.abs(d.z)) return { x: Math.sign(d.x) || 1, z: 0 };
    return { x: 0, z: Math.sign(d.z) || 1 };
  }

  _toRootCollider(collider, child) {
    const p = new THREE.Vector3(...collider.pos).applyEuler(child.rotation).add(child.position);
    const quarterTurn = Math.abs(Math.sin(child.rotation.y)) > 0.5;
    return {
      ...collider,
      hx: quarterTurn ? collider.hz : collider.hx,
      hz: quarterTurn ? collider.hx : collider.hz,
      pos: [p.x, p.y, p.z]
    };
  }

  _buildBlindFace(tunnelGroup) {
    const halfW = this.width / 2;
    // Misma herradura que la carcasa de la labor (archRatio variable): si no, el frente ciego
    // dejaba una media luna abierta contra la corona.
    const wallTop = this.height * (1 - (this.variant.archRatio ?? 0.40));
    const archH = this.height - wallTop;
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, 0);
    shape.lineTo(-halfW, wallTop);
    for (let i = 0; i <= 14; i++) {
      const theta = Math.PI - (Math.PI * i) / 14;
      shape.lineTo(halfW * Math.cos(theta), wallTop + archH * Math.sin(theta));
    }
    shape.lineTo(halfW, 0);
    shape.closePath();

    const material = MineMaterials.rocaTunel().clone();
    material.flatShading = true;
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
    const face = new THREE.Mesh(new THREE.ShapeGeometry(shape, 4), material);
    face.position.z = -this.length - 0.015;
    face.name = 'frente_ciego_rocoso';
    face.receiveShadow = true;
    tunnelGroup.add(face);

    if (this.wireframeStyle) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(face.geometry, 8),
        new THREE.LineBasicMaterial({ color: 0x365164, transparent: true, opacity: 0.32 })
      );
      edges.position.copy(face.position);
      edges.name = 'juntas_frente_ciego';
      tunnelGroup.add(edges);
    }
  }
}
