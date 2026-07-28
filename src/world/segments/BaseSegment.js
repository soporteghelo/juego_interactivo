import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTunnelShell, createWireframeLaborShell } from './TunnelGeometry.js';
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
  constructor({ width, height, length, rng, shotcrete = true, detail = 1, wireframeStyle = false, variant = null }) {
    this.width = width;
    this.height = height;
    this.length = length;
    this.rng = rng;
    this.shotcrete = shotcrete;
    // `detail` (0..1) escala la densidad de malla de la carcasa y el piso. 1 = calidad plena
    // (modo lineal, sin cambios). El modo retICula usa <1 para aligerar decenas de tramos.
    this.detail = detail;
    this.wireframeStyle = wireframeStyle;

    // ── VARIANTE DE CAJA (por semilla, ver GridLayoutGenerator._sectionVariant) ──
    // Es lo que hace que dos labores contiguas NO se vean iguales: litologia, forma de la
    // herradura, corona mas o menos desquinchada, cuneta labrada a uno o a los dos lados y
    // cuanta roca suelta quedo sin limpiar. Con valores por defecto = comportamiento historico.
    this.variant    = variant || {};
    this.rockType   = this.variant.rockType   ?? 'caliza';
    this.archRatio  = this.variant.archRatio  ?? 0.40;
    this.crownRough = this.variant.crownRough ?? 0.5;
    this.cuneta     = this.variant.cuneta     ?? 'ambas';
    this.debrisFactor = this.variant.debris   ?? 1;

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
    // CARACTER UNICO por labor: cada tramo saca su propia rugosidad y ensanche de la semilla, de
    // modo que NINGUNA galeria/crucero se ve igual a otra (antes: jitter fijo 0.48 = "copias").
    // El jitter es 0 en las bocas (r=0/rows-1), asi que variarlo no rompe la union con el cruce.
    const jitter     = 0.28 + this.rng.next() * 0.36;   // 0.28-0.64: de casi lisa a muy sobre-excavada
    const breatheAmp = 0.07 + this.rng.next() * 0.14;   // 0.07-0.21: seccion mas o menos ondulante
    const geo = this.wireframeStyle
      ? createWireframeLaborShell({
          width: this.width,
          height: this.height,
          length: this.length,
          // Pocos anillos deliberados: caras grandes y quebradas como el wireframe de referencia.
          segmentsZ: Math.max(6, Math.round(this.length * this.detail * 0.75)),
          jitter: Math.max(0.34, jitter * 0.9),
          rockType: this.rockType,
          rng
        })
      : createTunnelShell({
          width:     this.width,
          height:    this.height,
          length:    this.length,
          // densidad moderada, suficiente para fBM; escalada por `detail` (1 = valor historico).
          segmentsZ: Math.max(Math.round(12 * this.detail), Math.round(this.length * this.detail)),
          jitter, breatheAmp,
          archRatio:  this.archRatio,
          rockType:   this.rockType,
          crownRough: this.crownRough,
          rng
        });
    // Base siempre en roca oscura; los parches de shotcrete van por encima.
    const shellMaterial = this.wireframeStyle ? MineMaterials.rocaTunel().clone() : MineMaterials.rocaTunel();
    if (this.wireframeStyle) {
      shellMaterial.flatShading = true;
      shellMaterial.needsUpdate = true;
    }
    const shell = new THREE.Mesh(geo, shellMaterial);
    shell.receiveShadow = true;
    shell.name = 'shell';
    shell.userData.wireframeLabor = this.wireframeStyle;
    this.group.add(shell);
    this.shell = shell;

    // En estas labores las aristas actúan como juntas/sombras de la roca levantada. Hacen
    // legible la forma triangulada incluso con poca luz, sin convertir la mina en un visor azul.
    if (this.wireframeStyle) {
      const joints = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 7),
        new THREE.LineBasicMaterial({
          color: 0x365164,
          transparent: true,
          opacity: 0.32,
          depthWrite: false
        })
      );
      joints.name = 'wireframe_roca_juntas';
      joints.renderOrder = 2;
      joints.userData.wireframeLabor = true;
      this.group.add(joints);
    }

    if (this.shotcrete) this._buildShotcretePatches();
  }

  /**
   * Parches irregulares de hormigon proyectado (shotcrete) sobre la roca oscura.
   *
   * Los 5-11 parches del tramo se FUSIONAN en una sola malla: comparten material y no se mueven,
   * asi que como mallas sueltas solo aportaban una geometria y una llamada de dibujo cada una
   * (con ~250 tramos eran miles de geometrias). El aspecto es identico.
   */
  _buildShotcretePatches() {
    const mat     = MineMaterials.shotcrete(true);
    const halfW   = this.width / 2;
    // Sigue la MISMA herradura que la carcasa (archRatio variable por labor): con un valor fijo
    // los parches quedaban despegados de la roca en las labores de arco alto o bajo.
    const wallTop = this.height * (1 - this.archRatio);
    const archH   = this.height - wallTop;
    const n = this.rng.int(5, 11);

    const molde = new THREE.Object3D();   // solo para calcular el transform de cada parche
    const geos = [];
    for (let i = 0; i < n; i++) {
      const z  = -this.rng.range(0.4, this.length - 0.4);
      const t  = this.rng.range(0.08, 0.92) * Math.PI; // angulo del arco
      const cx = halfW * Math.cos(t);
      const cy = wallTop + archH * Math.sin(t);

      const r   = this.rng.range(0.35, 1.5);
      molde.position.set(cx, cy, z);
      molde.scale.set(this.rng.range(0.5, 2.2), this.rng.range(0.4, 1.6), 1);
      molde.rotation.set(0, 0, 0);
      molde.lookAt(new THREE.Vector3(0, wallTop * 0.5, z));
      molde.translateZ(0.06); // ligeramente hacia el interior para evitar z-fighting
      molde.updateMatrix();

      const geo = new THREE.CircleGeometry(r, 7);
      geo.applyMatrix4(molde.matrix);
      geos.push(geo);
    }
    if (!geos.length) return;
    const parches = new THREE.Mesh(mergeGeometries(geos), mat);
    for (const g of geos) g.dispose();
    parches.name = 'shotcrete_parches';
    this.group.add(parches);
  }

  _buildFloor() {
    const rng = this.rng;

    // Grado de ENCHARCADO de la via (0..1), VARIABLE POR TRAMO (semilla del tramo): unas vias
    // quedan secas-embarradas, otras con mucho lodo, y las mas bajas MEDIO INUNDADAS. Modela el
    // drenaje desigual real (md: piso muy reflectivo, vias inundadas). Determinista.
    this.encharcado = rng.next();
    const encharcado = this.encharcado;

    // --- Piso IRREGULAR de mina: malla subdividida con relieve (baches, surcos, huecos) ---
    const segX = Math.max(6, Math.round(this.width * 1.6 * this.detail));
    const segZ = Math.max(10, Math.round(this.length * 1.6 * this.detail));
    const floorGeo = new THREE.PlaneGeometry(this.width, this.length, segX, segZ);

    // Surcos de neumatico (dos carriles donde pasan los equipos).
    const rut = this.width * 0.2;
    // CUNETA: cada labor la tiene labrada distinto (a ambos lados, a uno solo o sin cuneta —
    // drenaje por el propio piso). `_cunetaSides` lo consulta tambien el agua y los bordillos.
    const sides = this._cunetaSides();
    // Zanja de drenaje pegada al hastial; su separacion y profundidad tambien varian por labor.
    const cunetaX = this.width / 2 - rng.range(0.5, 0.8);
    const cunetaProf = rng.range(0.13, 0.22);
    const pos = floorGeo.attributes.position;
    const huecos = []; // centros de huecos puntuales
    // La cantidad de huecos escala con el nivel de inseguridad Y con el encharcado: una via
    // anegada tiene mas baches/cunetas-hueco y mas profundos (agua estancada).
    const nHuecos = Math.max(1, Math.round(rng.int(2, 5) * Settings.unsafeLevel * (0.7 + encharcado * 1.1)));
    for (let i = 0; i < nHuecos; i++) {
      huecos.push({
        x: rng.range(-this.width / 2 + 0.5, this.width / 2 - 0.5),
        y: rng.range(-this.length / 2 + 0.5, this.length / 2 - 0.5),
        r: rng.range(0.3, 0.7 + encharcado * 0.5),
        prof: rng.range(0.08, 0.18) * (1 + encharcado * 0.9)
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
      // Cuneta labrada solo en los lados que le tocan a esta labor.
      if ((x > 0 && sides.right) || (x < 0 && sides.left)) {
        h -= Math.exp(-((Math.abs(x) - cunetaX) ** 2) / 0.11) * cunetaProf;
      }
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
    // Mucho mas lodo en las vias embarradas (encharcado alto).
    // Igual que el shotcrete: todas las manchas del tramo van en UNA malla (mismo material,
    // quietas). Antes eran hasta 5 geometrias y 5 llamadas de dibujo por tramo.
    const nLodo = Math.max(1, Math.round(rng.int(2, 5) * Settings.unsafeLevel * (0.6 + encharcado * 1.7)));
    const lodos = [];
    for (let i = 0; i < nLodo; i++) {
      const r = rng.range(0.8, 2.2);
      const geo = new THREE.CircleGeometry(r, 14);
      geo.scale(1, rng.range(0.6, 1.4), 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate(
        rng.range(-this.width / 2 + 0.8, this.width / 2 - 0.8),
        0.018,
        -rng.range(0.8, this.length - 0.8)
      );
      lodos.push(geo);
    }
    if (lodos.length) {
      const lodo = new THREE.Mesh(mergeGeometries(lodos), MineMaterials.lodo());
      for (const g of lodos) g.dispose();
      lodo.name = 'lodo';
      this.group.add(lodo);
    }

    // --- Canal de drenaje central + CUNETAS laterales (solera de agua + bordillo) ---
    // OPTIMIZACION: las 3 laminas de agua (canal + 2 soleras) comparten material (charco) y
    // los 2 bordillos comparten el suyo (shotcrete) → se FUSIONAN en 2 meshes en vez de 5.
    // Mismas dimensiones/posiciones que siempre: visualmente identico, 3 draw calls menos
    // por tramo.
    const halfW = this.width / 2;
    const rotX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const lamina = (w, x, y) => {
      const g = new THREE.PlaneGeometry(w, this.length);
      // UVs a escala METRICA (~1 rizo cada 1.5 m en ambos ejes): tramos de cualquier largo
      // muestran el mismo rizo por metro y el agua "corre" a la misma velocidad en toda la mina.
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * (w / 1.5), uv.getY(i) * (this.length / 1.5));
      }
      g.applyMatrix4(rotX);
      g.translate(x, y, -this.length / 2);
      return g;
    };

    const laminas = [lamina(0.7, this.width * 0.28, 0.03)];   // canal central de drenaje
    // Solera de agua SOLO en las cunetas que existen en esta labor.
    if (sides.right) laminas.push(lamina(0.60, halfW - 0.42, -0.12));
    if (sides.left)  laminas.push(lamina(0.60, -(halfW - 0.42), -0.12));
    const aguaGeo = mergeGeometries(laminas);
    // Agua CORRIENDO (md: "canal central de drenaje con agua"): el tick desplaza el normal
    // map COMPARTIDO del material → un solo offset anima el agua de toda la mina. El offset
    // se calcula desde `elapsed` (absoluto, idempotente), asi que da igual cuantos tramos
    // visibles lo re-fijen en el mismo frame. Los CHARCOS quedan estaticos (agua estancada).
    const agua = new THREE.Mesh(aguaGeo, MineMaterials.aguaCorriente());
    agua.name = 'drenaje_cunetas';
    agua.userData.tick = (dt, elapsed) => {
      const nm = agua.material.normalMap;
      if (nm) nm.offset.y = -((elapsed * 0.22) % 1);   // ~0.33 m/s hacia la poza de bombeo
    };
    this.animated.push(agua);
    this.group.add(agua);

    // Bordillo que separa la calzada de la cuneta: solo donde hay cuneta labrada.
    const bordilloPiezas = [];
    if (sides.right) bordilloPiezas.push(new THREE.BoxGeometry(0.10, 0.11, this.length).translate(halfW - 0.92, 0.055, -this.length / 2));
    if (sides.left)  bordilloPiezas.push(new THREE.BoxGeometry(0.10, 0.11, this.length).translate(-(halfW - 0.92), 0.055, -this.length / 2));
    if (bordilloPiezas.length) {
      const bordillos = new THREE.Mesh(mergeGeometries(bordilloPiezas), MineMaterials.shotcrete(false));
      bordillos.name = 'cuneta_bordillos';
      this.group.add(bordillos);
    }

    // --- VIA MEDIO INUNDADA: en tramos muy encharcados una LAMINA de agua ancha cubre gran
    // parte de la calzada (agua estancada sobre baches y surcos). Reusa el material de agua
    // corriente (su normalMap COMPARTIDO ya lo anima el tick del drenaje → ondula y refleja el
    // env-map). 1 draw call, material compartido, sin tick propio. Solo sobre un umbral. ---
    if (encharcado > 0.6) {
      const cobertura = THREE.MathUtils.lerp(0.45, 0.9, (encharcado - 0.6) / 0.4); // fraccion del ancho
      const w = this.width * cobertura;
      const g = new THREE.PlaneGeometry(w, this.length - 0.6);
      const uvF = g.attributes.uv;
      for (let i = 0; i < uvF.count; i++) uvF.setXY(i, uvF.getX(i) * (w / 1.5), uvF.getY(i) * (this.length / 1.5));
      g.applyMatrix4(rotX);
      g.translate(rng.range(-0.4, 0.4), 0.06, -this.length / 2);   // por encima de surcos/baches
      const flood = new THREE.Mesh(g, MineMaterials.aguaCorriente());
      flood.name = 'via_inundada';
      this.group.add(flood);
    }
  }

  /** Lados en los que esta labor lleva cuneta labrada (`variant.cuneta`). */
  _cunetaSides() {
    switch (this.cuneta) {
      case 'derecha':   return { right: true,  left: false };
      case 'izquierda': return { right: false, left: true  };
      case 'ninguna':   return { right: false, left: false };
      default:          return { right: true,  left: true  };
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
