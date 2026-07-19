import * as THREE from 'three';
import { MineMaterials } from '../materials/MineMaterials.js';
import { addCornerFillets, addMouthJambs, vaultGeo, wallGeo, nodeFloorGeo } from './RockDetail.js';
import { crear as crearRefugioDraeger } from '../../elementos/ssoma/refugio_draeger.js';
import { crear as crearNichoElectrico } from '../../elementos/entorno/nicho_electrico.js';
import { crear as crearRaptor } from '../../elementos/equipos/raptor.js';
import { crear as crearScoop } from '../../elementos/equipos/scoop.js';
import { crear as crearEmpernador } from '../../elementos/equipos/empernador.js';
import { crear as crearDesatador } from '../../elementos/equipos/desatador.js';
import { crear as crearShotcretera } from '../../elementos/equipos/shotcretera.js';
import { crear as crearMixer } from '../../elementos/equipos/mixer.js';
import { crear as crearTelehandler } from '../../elementos/equipos/telehandler.js';
import { crear as crearRocaSuelta } from '../../elementos/entorno/roca_suelta.js';
import { crear as crearPizarra } from '../../elementos/senal/pizarra_monitoreo.js';
import { crear as crearPortaherramientas } from '../../elementos/sostenimiento/portaherramientas.js';
import { crear as crearBarretillas } from '../../elementos/sostenimiento/barretillas.js';
import { crear as crearCordonBloqueo } from '../../elementos/ssoma/cordon_bloqueo.js';
import { crear as crearTablero } from '../../elementos/senal/tablero_electrico.js';
import { crear as crearExtintor } from '../../elementos/ssoma/extintor.js';
import { crear as crearCharco } from '../../elementos/entorno/charco.js';
import { crear as crearTelefonoEmergencia } from '../../elementos/ssoma/telefono_emergencia.js';
import { crear as crearEstacionEmergencia } from '../../elementos/ssoma/estacion_emergencia.js';
import { crear as crearPuntoResiduos } from '../../elementos/ssoma/punto_residuos.js';
import { crear as crearSensorGases } from '../../elementos/ssoma/sensor_gases.js';
import { crear as crearDuchaLavaojos } from '../../elementos/ssoma/ducha_lavaojos.js';
import { crear as crearPilaMineral } from '../../elementos/entorno/pila_mineral.js';
import { crear as crearEstacionTotal } from '../../elementos/entorno/estacion_total.js';
import { crear as crearFrenteCargado } from '../../elementos/entorno/frente_cargado.js';
import { crear as crearMallaNaranja } from '../../elementos/ssoma/malla_naranja.js';
import { crearSenal } from '../../elementos/senal/senal.js';

/** Grosor de los pilares de esquina de la sala (m). */
const POST_T = 1.4;

/**
 * RoomSegment — SALA de una labor especial en fondo de saco (spur): refugio minero,
 * subestacion electrica, bahia de equipos, camara/stope, sala de bombeo, taller o frente de
 * desarrollo. Es un cuadrado amplio abierto SOLO por el lado del acceso (paredes de roca en
 * los otros tres) y AMUEBLADO segun su tipo reutilizando los elementos del catalogo.
 *
 * Alineado a ejes (sin rotacion): el grupo se coloca en la posicion de la sala y sus
 * colisionadores locales se trasladan tal cual.
 */
export class RoomSegment {
  /**
   * @param {object} o
   * @param {number} o.size     lado de la sala (m)
   * @param {number} o.height   alto (m)
   * @param {Array<{x:number,z:number}>} o.openDirs  direccion(es) con acceso (boca abierta)
   * @param {string} o.roomType refugio|subestacion|bahia|camara|bombeo|taller|frente|sostenimiento|shotcrete
   * @param {string} o.label    rotulo del plano
   * @param {object} o.lighting rig de iluminacion
   */
  constructor({ size, height, openDirs, roomType, label, lighting }) {
    this.type = 'room';
    this.roomType = roomType;
    this.label = label;
    this.size = size;
    this.width = size;
    this.length = size;
    this.height = height;
    this.openDirs = openDirs || [];
    this.lighting = lighting;

    this.group = new THREE.Group();
    this.group.name = `room_${roomType}`;
    this.colliders = [];
    this.interactables = [];
    this.hazards = [];
    this.animated = [];
    this.connectors = {
      entry: { position: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, 1) },
      exit:  { position: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, -1) }
    };
  }

  build() {
    const half = this.size / 2;
    const H = this.height;
    const mouth = this.size - 2 * POST_T;
    const matRoca = MineMaterials.roca();
    const matPiso = MineMaterials.barroMojado();

    // Piso + techo.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(this.size + 1, 0.30, this.size + 1), matPiso);
    floor.position.set(0, -0.15, 0); floor.receiveShadow = true; floor.name = 'room_piso';
    this.group.add(floor);
    this.colliders.push({ hx: half + 0.5, hy: 0.15, hz: half + 0.5, pos: [0, -0.15, 0] });

    // Piel de piso IRREGULAR (muck/barro pisado) sobre la losa: mata la cara plana de la sala.
    const floorSkin = new THREE.Mesh(nodeFloorGeo(this.size), matPiso);
    floorSkin.position.set(0, 0.02, 0); floorSkin.receiveShadow = true; floorSkin.name = 'room_piso_relieve';
    this.group.add(floorSkin);

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(this.size + 0.6, 0.35, this.size + 0.6), matRoca);
    ceil.position.set(0, H + 0.17, 0); ceil.name = 'room_techo';
    this.group.add(ceil);
    this.colliders.push({ hx: half, hy: 0.15, hz: half, pos: [0, H + 0.17, 0] });

    // CORONA abovedada visible (roca irregular colgante) bajo la tapa plana.
    const vault = new THREE.Mesh(vaultGeo(this.size, H), matRoca);
    vault.position.set(0, H - 0.02, 0);
    vault.name = 'room_corona';
    this.group.add(vault);

    // ESQUINAS REDONDEADAS: filetes de roca curvos + demarcacion (nada de pilares rectos).
    // El collider conserva la caja historica de cada esquina.
    addCornerFillets(this.group, half, H);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = sx * (half - POST_T / 2), pz = sz * (half - POST_T / 2);
      this.colliders.push({ hx: POST_T / 2, hy: H / 2, hz: POST_T / 2, pos: [px, H / 2, pz] });
    }

    // BOCA ACAMPANADA hacia el acceso (jamba rocosa en abanico a cada lado).
    addMouthJambs(this.group, this.colliders, this.openDirs, half, H);

    // Paredes de cierre ROCOSAS en los lados SIN acceso.
    const sides = [
      { dir: { x:  1, z: 0 }, axis: 'x', sign:  1 },
      { dir: { x: -1, z: 0 }, axis: 'x', sign: -1 },
      { dir: { x: 0, z:  1 }, axis: 'z', sign:  1 },
      { dir: { x: 0, z: -1 }, axis: 'z', sign: -1 },
    ];
    let openDir = { x: 0, z: -1 };
    const muroGeo = wallGeo(H, mouth);
    for (const s of sides) {
      if (this._isOpen(s.dir)) { openDir = s.dir; continue; }
      const wall = new THREE.Mesh(muroGeo, matRoca);
      if (s.axis === 'x') {
        const x = s.sign * half;
        wall.position.set(x, H / 2, 0); this.group.add(wall);
        this.colliders.push({ hx: 0.2, hy: H / 2, hz: mouth / 2, pos: [x, H / 2, 0] });
      } else {
        const z = s.sign * half;
        wall.position.set(0, H / 2, z);
        wall.rotation.y = Math.PI / 2;
        this.group.add(wall);
        this.colliders.push({ hx: mouth / 2, hy: H / 2, hz: 0.2, pos: [0, H / 2, z] });
      }
    }

    // Luz cenital.
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), MineMaterials.ledBlanco());
    panel.position.set(0, H - 0.15, 0); this.group.add(panel);
    if (this.lighting?.canAddLight?.()) {
      const light = new THREE.PointLight(0xf5f8ff, 30, 22, 2);
      light.position.set(0, H - 0.25, 0);
      this.group.add(light);
      this.lighting.noteLight();
    }

    // Mobiliario segun el tipo (el "fondo" es el lado opuesto al acceso).
    this._furnish(openDir);

    // Recolecta los objetos ANIMADOS del mobiliario (p.ej. semaforo del refugio Dräger):
    // WorldRuntime les da tick cuando la sala es visible y los exime del freeze de matrices.
    this.group.traverse((o) => { if (o.userData?.tick) this.animated.push(o); });
    return this;
  }

  _isOpen(dir) {
    return this.openDirs.some(d => d.x * dir.x + d.z * dir.z > 0.7);
  }

  /** Añade el equipamiento caracteristico de la labor. Robusto: nunca rompe el build. */
  _furnish(openDir) {
    const back = { x: -openDir.x, z: -openDir.z };  // hacia el fondo de la sala
    const b = this.size * 0.28;                      // desplazamiento al fondo
    const bx = back.x * b, bz = back.z * b;
    const faceYaw = Math.atan2(openDir.x, openDir.z); // mira hacia el acceso

    const place = (obj, x, y, z, yaw = faceYaw) => {
      if (!obj) return;
      obj.position.set(x, y, z);
      obj.rotation.y = yaw;
      this.group.add(obj);
      // Registra la interaccion y los peligros del mobiliario (telefono, camilla, reja...).
      if (obj.userData?.interactable) this.interactables.push(obj.userData.interactable);
      if (obj.userData?.hazard) this.hazards.push({ object: obj, ...obj.userData.hazard });
    };
    const tryCrear = (fn) => { try { return fn(); } catch { return null; } };

    switch (this.roomType) {
      case 'refugio':
        place(tryCrear(() => crearRefugioDraeger()), bx, 0, bz);
        place(tryCrear(() => crearExtintor()), bx + 2.2, 0, bz, faceYaw);
        // Comunicacion junto al refugio: se reporta ANTES de ingresar (D.S. 024-2016-EM).
        place(tryCrear(() => crearTelefonoEmergencia()), bx - 2.4, 0, bz, faceYaw);
        break;
      case 'subestacion':
        place(tryCrear(() => crearNichoElectrico({ doble: true })), bx, 0, bz);
        place(tryCrear(() => crearTablero()), bx - 2.4, 0, bz);
        place(tryCrear(() => crearPizarra()), 0, 1.6, back.z ? bz * 0.2 : bz, faceYaw);
        place(tryCrear(() => crearTelefonoEmergencia()), bx + 2.6, 0, bz, faceYaw);
        break;
      case 'bahia': // bahia de equipos: el jumbo Raptor estacionado
        place(tryCrear(() => crearRaptor()), bx, 0, bz, faceYaw + Math.PI);
        place(tryCrear(() => crearExtintor()), -this.size * 0.35, 0, 0);
        break;
      case 'camara': // stope / camara de explotacion: pila de mineral que el LHD muck-ea
        // Pila al FONDO; el scoop mira HACIA la pila (faceYaw+PI) para cargarla de frente y
        // tramear en reversa a la boca (HaulCycle). Algunos bolones de derrame en el piso.
        place(tryCrear(() => crearPilaMineral()), bx, 0, bz, 0);
        for (let i = 0; i < 2; i++) {
          place(tryCrear(() => crearRocaSuelta({ mineralizada: true })), bx * 0.45 + (i - 0.5) * 1.3, 0, bz * 0.45, 0);
        }
        place(tryCrear(() => crearScoop()), 0, 0, 0, faceYaw + Math.PI);
        break;
      case 'echadero': { // ore pass: parrilla grizzly sobre el pique + tope de descarga
        const matAcero = MineMaterials.roca ? MineMaterials.plano(0x3a3d42, { rough: 0.5, metal: 0.7 }) : null;
        const matConc = MineMaterials.plano(0x6b6459, { rough: 0.95 });
        const cx = bx * 0.5, cz = bz * 0.5;
        // Pique oscuro (caja negra hundida bajo la parrilla)
        const hueco = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 3.2), MineMaterials.plano(0x040404, { rough: 1 }));
        hueco.position.set(cx, -0.62, cz); this.group.add(hueco);
        // Parrilla grizzly (vigas cruzadas de acero)
        const grizzly = new THREE.Group();
        for (let i = -3; i <= 3; i++) {
          const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 3.3), matAcero); v.position.set(i * 0.46, 0.08, 0); grizzly.add(v);
          const h = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 0.12), matAcero); h.position.set(0, 0.16, i * 0.46); grizzly.add(h);
        }
        grizzly.position.set(cx, 0.14, cz); this.group.add(grizzly);
        // Tope de descarga (muro bajo de concreto contra el que retrocede el equipo)
        const tope = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.75, 0.45), matConc);
        tope.position.set(cx - openDir.x * 2.0, 0.38, cz - openDir.z * 2.0);
        tope.rotation.y = openDir.x ? Math.PI / 2 : 0; this.group.add(tope);
        this.colliders.push({ hx: openDir.x ? 0.22 : 2.0, hy: 0.38, hz: openDir.x ? 2.0 : 0.22,
          pos: [cx - openDir.x * 2.0, 0.38, cz - openDir.z * 2.0] });
        // Señalizacion + zona PROHIBIDA sobre la parrilla (caida al pique)
        place(tryCrear(() => crearSenal('peligro_no_ingresar')), cx + openDir.x * 2.4, 1.9, cz + openDir.z * 2.4, faceYaw);
        const zona = new THREE.Object3D();
        zona.userData.hazard = {
          tipo: 'prohibida', warn: 4,
          aviso: 'ECHADERO — PROHIBIDO PASAR SOBRE LA PARRILLA. Riesgo de caída al pique de traspaso.'
        };
        place(zona, cx, 1, cz, 0);
        break;
      }
      case 'bombeo':
        for (let i = 0; i < 3; i++) place(tryCrear(() => crearCharco({})), (i - 1) * 2.2, 0.02, bz, 0);
        place(tryCrear(() => crearTablero()), bx, 0, bz);
        place(tryCrear(() => crearPizarra()), bx + 2.2, 1.6, bz, faceYaw);
        // Primeros auxilios en la labor humeda/aislada (camilla + botiquin).
        place(tryCrear(() => crearEstacionEmergencia()), bx - 2.4, 0, bz, faceYaw);
        break;
      case 'taller':
        place(tryCrear(() => crearPortaherramientas()), bx, 0, bz);
        place(tryCrear(() => crearBarretillas()), bx + 1.8, 0, bz);
        place(tryCrear(() => crearTelehandler({ variante: 'manitou' })), -this.size * 0.18, 0, 0, faceYaw); // manipulador de servicio
        // Punto de acopio de residuos (el taller genera chatarra/trapos con hidrocarburo).
        place(tryCrear(() => crearPuntoResiduos()), bx - 3.0, 0, bz, faceYaw);
        break;
      case 'frente': { // frente de desarrollo: jumbo perforando + topografia + FRENTE CARGADO (voladura)
        place(tryCrear(() => crearRaptor()), bx, 0, bz, faceYaw + Math.PI);
        for (let i = 0; i < 3; i++) place(tryCrear(() => crearRocaSuelta({ mineralizada: true })), bx + (i - 1) * 1.4, 0, bz - back.z * 2, 0);
        // Estación total hacia la boca, a un costado (el topógrafo de la cuadrilla la usa).
        const px = openDir.z, pz = -openDir.x;                 // perpendicular al acceso
        place(tryCrear(() => crearEstacionTotal()), openDir.x * 1.6 + px * 2.3, 0, openDir.z * 1.6 + pz * 2.3, faceYaw);
        // FRENTE CARGADO: una sección de la caja ya perforada y cargada (fase de voladura), a un
        // costado del jumbo, mirando a la cuadrilla (+Z→acceso).
        place(tryCrear(() => crearFrenteCargado()),
          back.x * this.size * 0.4 - px * 2.6, 0, back.z * this.size * 0.4 - pz * 2.6, faceYaw);
        // Bloqueo de acceso por voladura en la boca: cordón + señal + hazard 'prohibida'.
        const mouth = this.size - 2 * POST_T;
        const cordon = tryCrear(() => crearCordonBloqueo({ ancho: mouth, nombre: 'VOLADURA' }));
        if (cordon) cordon.userData.hazard = {
          tipo: 'prohibida', warn: 6,
          aviso: 'FRENTE CARGADO — VOLADURA. Prohibido cruzar el cordón: área bloqueada hasta autorización del supervisor.'
        };
        place(cordon, openDir.x * this.size * 0.40, 0, openDir.z * this.size * 0.40, faceYaw);
        place(tryCrear(() => crearSenal('voladura')), openDir.x * this.size * 0.42, 2.0, openDir.z * this.size * 0.42, faceYaw + Math.PI);
        break;
      }
      case 'sostenimiento': // ciclo de sostenimiento: desatador (desate) + empernador (pernos/malla)
        place(tryCrear(() => crearDesatador()), bx, 0, bz, faceYaw + Math.PI);
        place(tryCrear(() => crearEmpernador()), -this.size * 0.20, 0, 0, faceYaw);
        for (let i = 0; i < 3; i++) place(tryCrear(() => crearRocaSuelta({ mineralizada: false })), bx + (i - 1) * 1.3, 0, bz - back.z * 2.2, 0);
        break;
      case 'shotcrete': // sostenimiento con concreto lanzado: shotcretera + mixer que la alimenta
        place(tryCrear(() => crearShotcretera()), bx, 0, bz, faceYaw + Math.PI);
        place(tryCrear(() => crearMixer()), -this.size * 0.20, 0, 0, faceYaw);
        for (let i = 0; i < 2; i++) place(tryCrear(() => crearCharco({})), (i - 0.5) * 2.0, 0.02, bz * 0.4, 0);
        // Quimicos (acelerante) → ducha lavaojos; diesel en labor ciega → sensor de gases.
        place(tryCrear(() => crearDuchaLavaojos()), this.size * 0.34, 0, 0, faceYaw);
        place(tryCrear(() => crearSensorGases()), -this.size * 0.34, 0, bz * 0.5, faceYaw);
        break;
      case 'polvorin': { // almacen de explosivos: reja cerrada + cajones + zona prohibida
        const matReja = MineMaterials.plano(0x2f3338, { rough: 0.55, metal: 0.7 });
        // Reja de barrotes que cierra el fondo de la sala (explosivos detras, inalcanzables).
        const reja = new THREE.Group();
        const rw = this.size * 0.62;
        for (let i = 0; i <= 12; i++) {
          const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), matReja);
          barra.position.set(-rw / 2 + (rw * i) / 12, 1.3, 0);
          reja.add(barra);
        }
        for (const yb of [0.35, 1.3, 2.45]) {
          const trav = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.1, 0.06, 0.05), matReja);
          trav.position.set(0, yb, 0);
          reja.add(trav);
        }
        const candado = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.08),
          MineMaterials.plano(0xf5c400, { rough: 0.5, metal: 0.4 }));
        candado.position.set(0.3, 1.25, 0.06);
        reja.add(candado);
        // Zona PROHIBIDA delante de la reja (banner ambar del HazardSystem, sin muerte).
        reja.userData.hazard = {
          tipo: 'prohibida',
          warn: 7,
          aviso: 'POLVORÍN — EXPLOSIVOS. Prohibido el ingreso: solo personal con licencia SUCAMEC y vale de salida autorizado.'
        };
        place(reja, bx * 0.45, 0, bz * 0.45, faceYaw);

        // Cajones de explosivos apilados DETRAS de la reja (madera rotulada).
        const matCaja = MineMaterials.plano(0x8a6a3a, { rough: 0.95 });
        for (const [cx, cy2, cz] of [[-1.2, 0.25, 0], [0.2, 0.25, 0.3], [1.3, 0.25, -0.2], [-0.5, 0.75, 0.15]]) {
          const caja = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.6), matCaja);
          caja.position.set(bx + cx * (back.x ? 0.4 : 1), cy2, bz + cz + back.z * 0.8);
          this.group.add(caja);
        }
        // Señalizacion reglamentaria + iluminacion de advertencia.
        const s1 = tryCrear(() => crearSenal('polvorin'));
        place(s1, 0, 1.9, back.z ? bz * 0.30 : bz * 0.30, faceYaw);
        const s2 = tryCrear(() => crearSenal('peligro_no_ingresar'));
        place(s2, this.size * 0.28, 1.8, bz * 0.30, faceYaw);
        // Telefono en la boca (control de acceso se comunica con superficie).
        place(tryCrear(() => crearTelefonoEmergencia()), -this.size * 0.34, 0, -bz * 0.4, faceYaw);
        break;
      }
      case 'desatado': { // DESATADO MANUAL: frente en desate — barretillas, roca caída, herramientas
        const half = this.size / 2;                     // semilado de la sala (build() lo tiene local)
        const perpx = openDir.z, perpz = -openDir.x;   // unit perpendicular al acceso
        // Juego de barretillas + porta, colgado en un hastial lateral (a la mano de la cuadrilla).
        place(tryCrear(() => crearBarretillas()), perpx * (half - 0.25), 1.45, perpz * (half - 0.25),
          Math.atan2(-perpx, -perpz));
        // Porta-herramientas en el hastial opuesto (cerca de la boca).
        place(tryCrear(() => crearPortaherramientas()), -perpx * (half - 0.35), 0, -perpz * (half - 0.35),
          Math.atan2(perpx, perpz));
        // Roca recién DESATADA acumulada al pie del frente (lo que la cuadrilla acaba de bajar).
        for (let i = 0; i < 4; i++) {
          place(tryCrear(() => crearRocaSuelta({ mineralizada: false })),
            bx + (i - 1.5) * 1.1, 0, bz - back.z * 1.4 - back.x * 0.0, 0);
        }
        // BLOQUEO DE ACCESO en la boca (PETS: cordón rojo + bastón luminoso + nombre del maestro).
        const mouthW = this.size - 2 * POST_T;
        const bocaYaw = openDir.x ? Math.PI / 2 : 0;   // el cordón (span X) cruza la boca
        place(tryCrear(() => crearCordonBloqueo({ ancho: mouthW, baston: true, nombre: 'J. QUISPE' })),
          openDir.x * (half - 0.4), 0, openDir.z * (half - 0.4), bocaYaw);
        break;
      }
      default:
        break;
    }

    // ── MALLA PLÁSTICA NARANJA delimitando la boca de las labores ACTIVAS ──
    // (base de conocimiento §4: "mallas plásticas naranjas delimitando frentes"). En el frente
    // queda por DENTRO del cordón de voladura: primero la cinta, luego la malla.
    if (['frente', 'sostenimiento', 'shotcrete', 'desatado'].includes(this.roomType)) {
      const vano = this.size - 2 * POST_T;
      place(tryCrear(() => crearMallaNaranja({ ancho: vano * 0.86 })),
        openDir.x * this.size * 0.30, 0, openDir.z * this.size * 0.30, faceYaw);
    }

    // ── Sensores fijos de gases en labores con fuentes diesel/gases (PETS: monitoreo de gases) ──
    if (this.roomType === 'frente' || this.roomType === 'bombeo' || this.roomType === 'desatado') {
      place(tryCrear(() => crearSensorGases()), this.size * 0.34, 0, 0, faceYaw);
    }
    // Ducha lavaojos tambien en la subestacion (electrolito de baterias).
    if (this.roomType === 'subestacion') {
      place(tryCrear(() => crearDuchaLavaojos()), -this.size * 0.34, 0, 0, faceYaw);
    }
  }
}
