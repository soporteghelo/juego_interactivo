import * as THREE from 'three';
import { createTunnelShell } from './TunnelGeometry.js';
import { MineMaterials } from '../materials/MineMaterials.js';
import { Settings } from '../../core/Settings.js';

/**
 * Clase base de todos los tramos de galeria.
 *
 * Construye lo ESTRUCTURAL comun: carcasa (paredes+arco), piso de barro y canal de
 * drenaje central (segun el md: "canal central de drenaje con agua"). Expone:
 *  - group: THREE.Group con la geometria
 *  - colliders: cajas estaticas (en espacio LOCAL) para la fisica
 *  - interactables: lista de {object, descriptor}
 *  - lightCount: presupuesto de luces que aporta el tramo
 *  - connectors: puntos de conexion {position, dir} para encadenar tramos
 *
 * Las subclases (GallerySegment, MainGallerySegment, ...) anaden su identidad visual
 * (LED verde, anchura, refugio, etc.). PropScatter agrega pernos/malla/senales/charcos.
 */
export class BaseSegment {
  constructor({ width, height, length, rng, shotcrete = true }) {
    this.width = width;
    this.height = height;
    this.length = length;
    this.rng = rng;
    this.shotcrete = shotcrete;

    this.group = new THREE.Group();
    this.colliders = [];
    this.interactables = [];
    this.animated = [];      // objetos con userData.tick(dt,elapsed) (ventiladores, balizas, equipos)
    this.hazards = [];       // peligros {object, ...descriptor} para el HazardSystem
    this.lightCount = 0;

    // Conectores en espacio local: entrada en z=0, salida en z=-length.
    this.connectors = {
      entry: { position: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, 1) },
      exit: { position: new THREE.Vector3(0, 0, -length), dir: new THREE.Vector3(0, 0, -1) }
    };
  }

  /** Construye la estructura base. Las subclases llaman a super.build() y agregan lo suyo. */
  build() {
    this._buildShell();
    this._buildFloor();
    this._buildColliders();
    return this;
  }

  _buildShell() {
    const rng = () => this.rng.next();
    const geo = createTunnelShell({
      width:     this.width,
      height:    this.height,
      length:    this.length,
      segmentsZ: Math.max(12, Math.round(this.length)),  // densidad moderada, suficiente para fBM
      jitter:    0.35,  // jitter fBm amplio: roca excavada con ondulaciones visibles
      rng
    });
    // Base siempre en roca oscura; los parches de shotcrete van por encima.
    const shell = new THREE.Mesh(geo, MineMaterials.rocaTunel());
    shell.receiveShadow = true;
    shell.name = 'shell';
    this.group.add(shell);
    this.shell = shell;

    if (this.shotcrete) this._buildShotcretePatches();
  }

  /** Parches irregulares de hormigon proyectado (shotcrete) sobre la roca oscura. */
  _buildShotcretePatches() {
    const mat     = MineMaterials.shotcrete(true);
    const halfW   = this.width / 2;
    const wallTop = this.height * 0.6;
    const archH   = this.height - wallTop;
    const n = this.rng.int(5, 11);

    for (let i = 0; i < n; i++) {
      const z  = -this.rng.range(0.4, this.length - 0.4);
      const t  = this.rng.range(0.08, 0.92) * Math.PI; // angulo del arco
      const cx = halfW * Math.cos(t);
      const cy = wallTop + archH * Math.sin(t);

      const r   = this.rng.range(0.35, 1.5);
      const geo = new THREE.CircleGeometry(r, 7);
      const patch = new THREE.Mesh(geo, mat);
      patch.position.set(cx, cy, z);
      patch.scale.set(this.rng.range(0.5, 2.2), this.rng.range(0.4, 1.6), 1);
      patch.lookAt(new THREE.Vector3(0, wallTop * 0.5, z));
      patch.translateZ(0.06); // ligeramente hacia el interior para evitar z-fighting
      patch.name = 'shotcrete_patch';
      this.group.add(patch);
    }
  }

  _buildFloor() {
    const rng = this.rng;

    // --- Piso IRREGULAR de mina: malla subdividida con relieve (baches, surcos, huecos) ---
    const segX = Math.max(6, Math.round(this.width * 1.6));
    const segZ = Math.max(10, Math.round(this.length * 1.6));
    const floorGeo = new THREE.PlaneGeometry(this.width, this.length, segX, segZ);

    // Surcos de neumatico (dos carriles donde pasan los equipos).
    const rut = this.width * 0.2;
    const pos = floorGeo.attributes.position;
    const huecos = []; // centros de huecos puntuales
    // La cantidad de huecos escala con el nivel de condiciones inseguras.
    const nHuecos = Math.max(1, Math.round(rng.int(2, 5) * Settings.unsafeLevel));
    for (let i = 0; i < nHuecos; i++) {
      huecos.push({
        x: rng.range(-this.width / 2 + 0.5, this.width / 2 - 0.5),
        y: rng.range(-this.length / 2 + 0.5, this.length / 2 - 0.5),
        r: rng.range(0.3, 0.7),
        prof: rng.range(0.08, 0.18)
      });
    }

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // a lo largo del tramo (mapea a -Z mundo)
      // Rugosidad general (baches suaves, varias frecuencias).
      let h =
        Math.sin(x * 1.7 + y * 0.6) * 0.035 +
        Math.sin(x * 0.5 - y * 1.3) * 0.045 +
        (rng.next() - 0.5) * 0.03;
      // Surcos de neumatico: leve depresion en dos carriles.
      h -= Math.exp(-((x - rut) ** 2) / 0.05) * 0.06;
      h -= Math.exp(-((x + rut) ** 2) / 0.05) * 0.06;
      // Huecos puntuales (depresiones).
      for (const hu of huecos) {
        const d2 = (x - hu.x) ** 2 + (y - hu.y) ** 2;
        h -= Math.exp(-d2 / (hu.r * hu.r)) * hu.prof;
      }
      pos.setZ(i, h);
    }
    floorGeo.computeVertexNormals();

    const floor = new THREE.Mesh(floorGeo, MineMaterials.barroMojado());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, -this.length / 2);
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.group.add(floor);

    // --- Parches de BARRO / LODO espeso en zonas del piso ---
    const nLodo = Math.max(1, Math.round(rng.int(2, 5) * Settings.unsafeLevel));
    for (let i = 0; i < nLodo; i++) {
      const r = rng.range(0.8, 2.2);
      const lodo = new THREE.Mesh(new THREE.CircleGeometry(r, 14), MineMaterials.lodo());
      lodo.rotation.x = -Math.PI / 2;
      lodo.scale.set(1, rng.range(0.6, 1.4), 1);
      lodo.position.set(
        rng.range(-this.width / 2 + 0.8, this.width / 2 - 0.8),
        0.018,
        -rng.range(0.8, this.length - 0.8)
      );
      lodo.name = 'lodo';
      this.group.add(lodo);
    }

    // --- Canal de drenaje con agua reflectiva (surco a un costado del carril) ---
    const channelGeo = new THREE.PlaneGeometry(0.7, this.length);
    const channel = new THREE.Mesh(channelGeo, MineMaterials.charco());
    channel.rotation.x = -Math.PI / 2;
    channel.position.set(this.width * 0.28, 0.03, -this.length / 2);
    channel.name = 'drainage';
    this.group.add(channel);

    // --- CUNETAS: canales de drenaje laterales a ambos lados de la via ---
    // Perfil: solera de agua + bordillo interior de hormigon.
    const halfW = this.width / 2;
    const matCuneta = MineMaterials.charco();           // agua oscura/reflectiva en la cuneta
    const matBordillo = MineMaterials.shotcrete(false); // bordillo gris hormigon

    for (const sign of [-1, 1]) {
      const cunetaX = sign * (halfW - 0.28); // 0.28 m desde la pared

      // Solera de agua (fondo de la cuneta, ligeramente hundida)
      const solera = new THREE.Mesh(
        new THREE.PlaneGeometry(0.36, this.length),
        matCuneta
      );
      solera.rotation.x = -Math.PI / 2;
      solera.position.set(cunetaX, -0.06, -this.length / 2);
      solera.name = 'cuneta_solera';
      this.group.add(solera);

      // Bordillo interior: separa la via de la cuneta (reborde de 10 cm)
      const bordillo = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.09, this.length),
        matBordillo
      );
      bordillo.position.set(sign * (halfW - 0.52), 0.045, -this.length / 2);
      bordillo.name = 'cuneta_bordillo';
      this.group.add(bordillo);
    }
  }

  _buildColliders() {
    const halfW = this.width / 2;
    const halfL = this.length / 2;
    const wallH = this.height;
    // Piso: hz extendido 0.4 m mas alla de cada extremo para que los pisos de tramos
    // adyacentes SE SOLAPEN en la costura y el jugador no pueda caer por el hueco.
    this.colliders.push({ hx: halfW + 0.5, hy: 0.1, hz: halfL + 0.4, pos: [0, -0.1, -halfL] });
    // Paredes derecha e izquierda.
    // Las cajas bajan 0.20 m por debajo del suelo para que no haya una arista de 90°
    // exacta en (x=±halfW, y=0) donde la cápsula del jugador se puede enganchar.
    const wallHalfH = wallH / 2 + 0.20;   // +0.20 m por debajo del piso
    const wallCY    = wallH / 2 - 0.20;   // centro desplazado hacia abajo
    this.colliders.push({ hx: 0.1, hy: wallHalfH, hz: halfL, pos: [halfW,  wallCY, -halfL], tag: 'wallR' });
    this.colliders.push({ hx: 0.1, hy: wallHalfH, hz: halfL, pos: [-halfW, wallCY, -halfL], tag: 'wallL' });
    // Techo (caja a la altura de la clave)
    this.colliders.push({ hx: halfW, hy: 0.1, hz: halfL, pos: [0, wallH, -halfL] });
  }
}
