import * as THREE from 'three';
import { Settings } from '../core/Settings.js';

// Todos los elementos provienen de la carpeta unica src/elementos/ (en espanol).
import { geometriaPerno, materialPerno } from '../elementos/sostenimiento/perno.js';
import { geometriaRoca, materialRoca } from '../elementos/entorno/roca_suelta.js';
import { crear as crearMalla } from '../elementos/sostenimiento/malla.js';
import { crear as crearShotcrete } from '../elementos/sostenimiento/shotcrete.js';
import { geometriaCharco, materialCharco } from '../elementos/entorno/charco.js';
import { geometriaBaliza, materialBaliza } from '../elementos/entorno/baliza.js';
import { crear as crearVent } from '../elementos/servicios/ventilacion.js';
import { crear as crearBandeja } from '../elementos/servicios/bandeja_cables.js';
import { crear as crearManguera } from '../elementos/servicios/manguera.js';
import { crear as crearTableroElectrico } from '../elementos/senal/tablero_electrico.js';
import { crear as crearTableroGestion } from '../elementos/senal/tablero_gestion.js';
import { crear as crearPizarra } from '../elementos/senal/pizarra_monitoreo.js';
import { crear as crearVentilador } from '../elementos/servicios/ventilador.js';
import { crear as crearJumbo } from '../elementos/equipos/jumbo.js';
import { crear as crearPanel } from '../elementos/senal/panel_informativo.js';
import { crear as crearCableElectrico } from '../elementos/servicios/cable_electrico.js';
import { crear as crearNicho, crearVacio as crearNichoVacio } from '../elementos/entorno/nicho_electrico.js';
import { crear as crearBahia, BW as BAHIA_W, BH as BAHIA_H, BD as BAHIA_D } from '../elementos/entorno/bahia_jumbo.js';
import { crearSenal } from '../elementos/senal/senal.js';
import { crear as crearChevron } from '../elementos/senal/chevron.js';
import { crear as crearBasura } from '../elementos/entorno/basura.js';
import { crear as crearExtintor } from '../elementos/ssoma/extintor.js';
import { crear as crearEstacionEmergencia } from '../elementos/ssoma/estacion_emergencia.js';
import { crear as crearTelefonoEmergencia } from '../elementos/ssoma/telefono_emergencia.js';

/**
 * Distribuye los ELEMENTOS sobre cada tramo segun su tipo/flags y las reglas del md:
 * pernos (instanciados, con variante sobresalida), malla (normal y sobresalida/rasgada),
 * shotcrete craquelado, escombros, charcos, balizas, ventilacion + ventiladores, cables,
 * mangueras, senaletica contextual, tableros, pizarra de monitoreo y VEHICULOS pesados.
 *
 * Optimizacion: pernos y escombros usan InstancedMesh. Los objetos animados (ventiladores,
 * balizas de vehiculos) se registran en seg.animated para que el mundo los anime.
 */
// Recursos COMPARTIDOS de la marca del refugio peatonal (baliza emisiva + jambas reflectivas):
// geometria y material unicos → coste de GPU minimo aunque haya muchos nichos por la mina.
let _beaconGeo = null, _beaconMat = null, _jambGeo = null, _jambMat = null;
function _refugeBeacon() {
  if (!_beaconGeo) _beaconGeo = new THREE.SphereGeometry(0.07, 8, 8);
  if (!_beaconMat) _beaconMat = new THREE.MeshStandardMaterial({ color: 0x0a3d1a, emissive: 0x35ff55, emissiveIntensity: 2.8, roughness: 0.5, metalness: 0 });
  return new THREE.Mesh(_beaconGeo, _beaconMat);
}
function _refugeJamb() {
  if (!_jambGeo) _jambGeo = new THREE.BoxGeometry(0.05, 2.0, 0.09);
  if (!_jambMat) _jambMat = new THREE.MeshStandardMaterial({ color: 0xc25a10, emissive: 0xe06010, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.1 });
  return new THREE.Mesh(_jambGeo, _jambMat);
}

// Recursos COMPARTIDOS de la BERMA PEATONAL (linea pintada reflectiva + postes delineadores):
// materiales unicos → coste GPU minimo aunque toda galeria lleve su berma demarcada.
let _bermMat = null, _postGeo = null, _postMat = null;
function _bermLineMat() {
  if (!_bermMat) _bermMat = new THREE.MeshStandardMaterial({ color: 0xd8c020, emissive: 0xb8a018, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.1 });
  return _bermMat;
}
function _bermPost() {
  if (!_postGeo) _postGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.5, 6);
  if (!_postMat) _postMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, emissive: 0xd07018, emissiveIntensity: 0.7, roughness: 0.5, metalness: 0.1 });
  return new THREE.Mesh(_postGeo, _postMat);
}

export class PropScatter {
  constructor(rng) {
    this.rng = rng;
  }

  /** Devuelve true si la posicion (side, z) cae dentro de una zona reservada por un nicho/bahía. */
  _inNichoZone(seg, side, z) {
    if (!seg.nichoZones) return false;
    return seg.nichoZones.some(zone => zone.side === side && z >= zone.zMin && z <= zone.zMax);
  }

  /** Helper: agrega un objeto y registra interaccion / animacion / peligro si los tiene. */
  _add(seg, obj) {
    seg.group.add(obj);
    if (obj.userData?.interactable) seg.interactables.push(obj.userData.interactable);
    if (obj.userData?.tick) seg.animated.push(obj);
    if (obj.userData?.hazard) seg.hazards.push({ object: obj, ...obj.userData.hazard });
    return obj;
  }

  /** @param {import('../world/segments/BaseSegment.js').BaseSegment} seg */
  scatter(seg, flags = {}) {
    // Nichos y bahías primero: registran las zonas ocupadas (seg.nichoZones)
    // para que _rockBolts y _wireMesh no coloquen objetos encima.
    this._nichos(seg, flags);
    this._pedestrianRefuges(seg);
    this._pedestrianBerm(seg);
    this._bahias(seg);
    this._rockBolts(seg, flags);
    this._wireMesh(seg, flags);
    this._shotcreteCracks(seg, flags);
    this._debris(seg, flags);
    this._trash(seg, flags);
    this._puddles(seg);
    this._ventilation(seg);
    // Bandeja de cables desactivada a peticion: no se muestra en el juego.
    // this._cables(seg);
    this._hoses(seg);
    this._delineators(seg);
    this._cableRun(seg);
    this._contextSignage(seg, flags);
    this._safetyStations(seg);
  }

  /**
   * ESTACIONES DE SEGURIDAD al hastial (D.S. 024-2016-EM): alterna a lo largo de galerias y
   * via principal — estacion CONTRA INCENDIO (extintor + señal), TELEFONO de emergencia y
   * ESTACION DE EMERGENCIA (camilla + botiquin). En la via principal agrega ademas la señal
   * de VELOCIDAD MAXIMA 20 km/h. Gated por heavyDetail (en 'bajo' se omiten).
   */
  _safetyStations(seg) {
    if ((Settings.current.heavyDetail ?? 1) < 0.4) return;
    if (seg.type !== 'gallery' && seg.type !== 'mainGallery' && seg.type !== 'mainRoad') return;
    if (seg.length < 14) return;

    const halfW = seg.width / 2;
    // En movil (heavyDetail 0.4-0.74) las estaciones van mas espaciadas.
    const paso = (Settings.current.heavyDetail ?? 1) >= 0.75 ? 18 : 26;
    // Cicla los tres tipos con arranque aleatorio por tramo (variedad entre galerias).
    let tipo = Math.floor(this.rng.next() * 3);

    for (let z = -7; z > -(seg.length - 4); z -= paso) {
      const side = this.rng.chance(0.5) ? 1 : -1;
      if (this._inNichoZone(seg, side, z)) continue;   // no invadir nichos/bahias

      let est = null;
      if (tipo === 0) {
        // Estacion contra incendio: señal EXTINTOR + extintor colgado debajo.
        est = new THREE.Group();
        est.name = 'estacion_extintor';
        const s = crearSenal('extintor');
        s.position.set(0, 1.95, 0.06);
        est.add(s);
        est.add(crearExtintor({ x: 0, y: 0.72, z: 0.14 }));
      } else if (tipo === 1) {
        est = crearTelefonoEmergencia();
      } else {
        est = crearEstacionEmergencia();
      }
      tipo = (tipo + 1) % 3;

      est.position.set(side * (halfW - 0.16), 0, z);
      est.rotation.y = -side * Math.PI / 2;   // de cara a la via
      this._add(seg, est);
    }

    // Señal de VELOCIDAD MAXIMA en la via principal (transito de volquetes).
    if (seg.type === 'mainRoad' && this.rng.chance(0.6)) {
      const side = 1;
      const z = -(3 + this.rng.next() * 4);
      if (!this._inNichoZone(seg, side, z)) {
        const s = crearSenal('limite_velocidad');
        s.position.set(side * (halfW - 0.12), 2.0, z);
        s.rotation.y = -side * Math.PI / 2;
        seg.group.add(s);
      }
    }
  }

  // --- Cable eléctrico colgado en alcayatas a lo largo de UN hastial (~1.5 m) ---
  _cableRun(seg) {
    if (!this.rng.chance(0.55)) return;              // no en todas las galerías
    const halfW = seg.width / 2;
    const side = this.rng.chance(0.5) ? 1 : -1;      // pared derecha o izquierda
    const largo = Math.min(seg.length - 1.6, 16);
    if (largo < 4) return;
    const cable = crearCableElectrico({
      length: largo, alturaHook: 1.5, spacing: 2.0, side
    });
    cable.position.set(side * (halfW - 0.02), 0, -0.8); // pegado al hastial
    seg.group.add(cable);
  }

  // --- Pernos de roca instanciados (con algunos "sobresalidos" en zonas de peligro) ---
  _rockBolts(seg, flags) {
    const halfW = seg.width / 2;
    const wallTop = seg.height * 0.6;
    const stepZ = 1.3;
    const stepY = 1.3;

    // Lote normal + lote "sobresalido" cuya probabilidad escala con el nivel de inseguridad.
    const lotes = [{ sobresalido: false, prob: 1 }];
    const probSobre = ((flags.hazard || flags.barrier) ? 0.18 : 0.05) * Settings.unsafeLevel;
    if (probSobre > 0.02) lotes.push({ sobresalido: true, prob: Math.min(0.6, probSobre) });

    for (const lote of lotes) {
      const matrices = [];
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 0, 1);
      const scl = new THREE.Vector3(1, 1, 1);
      const pos = new THREE.Vector3();

      for (const sign of [-1, 1]) {
        const normal = new THREE.Vector3(-sign, 0, 0);
        q.setFromUnitVectors(up, normal);
        for (let z = -0.8; z > -seg.length; z -= stepZ) {
          if (this._inNichoZone(seg, sign, z)) continue;
          for (let y = 1.0; y < wallTop; y += stepY) {
            if (lote.sobresalido && this.rng.next() > lote.prob) continue;
            pos.set(sign * halfW, y, z);
            matrices.push(new THREE.Matrix4().compose(pos, q, scl));
          }
        }
      }
      if (matrices.length === 0) continue;
      const inst = new THREE.InstancedMesh(
        geometriaPerno({ sobresalido: lote.sobresalido }),
        materialPerno(),
        matrices.length
      );
      matrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.name = lote.sobresalido ? 'pernos_sobresalidos' : 'pernos';
      seg.group.add(inst);
    }
  }

  // --- Malla de acero en paredes (sobresalidas/rasgadas en zonas inestables) ---
  // Las mallas SOBRESALIDAS se registran con _add() para que el HazardSystem
  // recoja su userData.hazard (tipo:'corte') y genere heridas al contacto.
  _wireMesh(seg, flags) {
    const halfW = seg.width / 2;
    const panelH = Math.min(2.4, seg.height * 0.5);
    // Semilla por tramo: incluye X ademas de Z para que las galerias PARALELAS de la
    // retICula (misma Z, distinta X) no repitan el mismo patron. En lineal x=0 → identico.
    let seedBase = Math.round((Math.abs(seg.group.position.z) + Math.abs(seg.group.position.x)) * 100) + 1;
    // Paso entre paneles de malla. En el modo retICula (flags.light) se espacian mas: hay
    // decenas de tramos visibles a la vez y cada panel es un mesh aparte.
    const stepZ = flags.light ? 5.5 : 3.2;
    // OPTIMIZACION (solo modo aligerado): los paneles PLANOS se acumulan y se dibujan como
    // UNA InstancedMesh por tramo (1 draw call en vez de ~8). Los SOBRESALIDOS siguen siendo
    // meshes individuales: tienen geometria unica por seed y registran hazard de corte.
    const planos = flags.light ? [] : null;
    for (const sign of [-1, 1]) {
      for (let z = -2; z > -seg.length; z -= stepZ) {
        if (this._inNichoZone(seg, sign, z)) { seedBase++; continue; }
        // Mas mallas SOBRESALIDAS (obstaculo/enganche): antes 0.12 en zona normal → 0.24.
        // Escaladas por heavyDetail: en celular son meshes individuales (con hazard) caros, se
        // reducen fuerte para no lagear.
        const baseProb = (flags.hazard || flags.barrier) ? 0.45 : 0.24;
        const sobresalida = this.rng.chance(Math.min(0.9, baseProb * Settings.unsafeLevel * Settings.current.heavyDetail));
        if (!sobresalida && planos) {
          planos.push({ sign, z });
          seedBase++;
          continue;
        }
        const panel = crearMalla({ width: 1, height: panelH, sobresalida, seed: seedBase++ });
        panel.position.set(sign * (halfW - 0.05), 1.4, z);
        panel.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
        if (sobresalida) {
          this._add(seg, panel);
        } else {
          seg.group.add(panel);
        }
      }
    }

    if (planos && planos.length) {
      // Plantilla: un panel plano cualquiera aporta geometria + material compartidos.
      const plantilla = crearMalla({ width: 1, height: panelH, sobresalida: false, seed: 1 });
      const inst = new THREE.InstancedMesh(plantilla.geometry, plantilla.material, planos.length);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
      const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
      planos.forEach((it, i) => {
        q.setFromAxisAngle(up, it.sign > 0 ? -Math.PI / 2 : Math.PI / 2);
        p.set(it.sign * (halfW - 0.05), 1.4, it.z);
        inst.setMatrixAt(i, m.compose(p, q, s));
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.name = 'mallas_planas';
      seg.group.add(inst);
    }
  }

  // --- Shotcrete craquelado (siempre >=1 seccion por tramo con shotcrete) ---
  // En zonas de riesgo: mas paneles craquelados. En roca expuesta: ningun panel.
  _shotcreteCracks(seg, flags) {
    // Sin shotcrete = roca expuesta: no hay shotcrete que craquelarse.
    if (seg.shotcrete === false) return;
    const u = Settings.unsafeLevel;
    const halfW = seg.width / 2;
    // Siempre al menos 1 seccion craquelada (requisito visual).
    const base  = (flags.hazard || flags.barrier) ? 3 : 1;
    const extra = Math.round(this.rng.range(0, flags.hazard ? 2 : 1) * u);
    const n     = base + extra;
    for (let i = 0; i < n; i++) {
      const sign = this.rng.chance(0.5) ? 1 : -1;
      const z    = -this.rng.range(0.5, seg.length - 0.5);
      // No colocar parches de shotcrete encima de nichos ni bahías.
      if (this._inNichoZone(seg, sign, z)) continue;
      const panel = crearShotcrete({
        width: this.rng.range(1.8, 3.4),
        height: this.rng.range(1.6, 2.8),
        craquelado: true
      });
      panel.position.set(sign * (halfW - 0.04), this.rng.range(1.2, 2.6), z);
      panel.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
      seg.group.add(panel);
    }
    // Seccion craquelada en el TECHO (1 por tramo, en zonas normales)
    if (this.rng.chance(0.55)) {
      const ceilCrack = crearShotcrete({
        width: this.rng.range(2.0, 3.8),
        height: this.rng.range(1.5, 2.5),
        craquelado: true
      });
      ceilCrack.rotation.x = -Math.PI / 2;
      ceilCrack.position.set(
        this.rng.range(-halfW * 0.6, halfW * 0.6),
        seg.height - 0.08,
        -this.rng.range(1, seg.length - 1)
      );
      seg.group.add(ceilCrack);
    }
  }

  // --- Escombros / roca suelta (instanciados) ---
  _debris(seg, flags) {
    const density = Settings.current.particleDensity;
    // El "desorden" (material botado en el piso) escala con el nivel de inseguridad.
    const count = Math.round((flags.hazard ? 46 : 28) * density * Settings.unsafeLevel) + 8;
    if (count <= 0) return;
    const inst = new THREE.InstancedMesh(geometriaRoca(), materialRoca(Boolean(flags.hazard)), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const halfW = seg.width / 2;
    for (let i = 0; i < count; i++) {
      const side = this.rng.chance(0.5) ? 1 : -1;
      const toWall = this.rng.next() ** 1.6;
      const p = new THREE.Vector3(
        side * (halfW - this.rng.range(0.1, 0.4) - toWall * (halfW - 1.2)),
        0.1,
        -this.rng.range(0.4, seg.length - 0.4)
      );
      q.setFromEuler(new THREE.Euler(this.rng.range(0, 3), this.rng.range(0, 3), this.rng.range(0, 3)));
      const s = this.rng.range(0.4, 1.8);
      m.compose(p, q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.name = 'escombros';
    seg.group.add(inst);
  }

  // --- Basura / residuos acumulados al pie del hastial (obstaculo + aviso de orden y aseo) ---
  // Se registra con _add() para que el HazardSystem recoja su userData.hazard (tipo 'ordenAseo',
  // solo aviso — no lesiona). El desorden escala con el nivel de condiciones inseguras.
  _trash(seg) {
    // Escala con inseguridad y con heavyDetail: en celular casi no aparece (grupos con muchas
    // piezas + Box3 de hazard por cada pila).
    const prob = Math.min(0.85, 0.32 * Settings.unsafeLevel * Settings.current.heavyDetail);
    if (!this.rng.chance(prob)) return;
    const halfW = seg.width / 2;
    const variantes = ['mixta', 'chatarra', 'embalaje'];
    const n = this.rng.chance(0.35) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const side = this.rng.chance(0.5) ? 1 : -1;
      const z = -this.rng.range(1.2, seg.length - 1.2);
      if (this._inNichoZone(seg, side, z)) continue;
      const pila = crearBasura({ variante: variantes[this.rng.int(0, variantes.length - 1)] });
      // Pegada al hastial, dentro de la cuneta/borde, fuera de la calzada central.
      pila.position.set(side * (halfW - this.rng.range(0.6, 1.1)), 0, z);
      pila.rotation.y = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(0.85, 1.2);
      pila.scale.setScalar(s);
      this._add(seg, pila);
    }
  }

  // --- Charcos de agua reflectivos (instanciados: 1 draw call por tramo) ---
  _puddles(seg) {
    const count = Math.round(this.rng.range(5, 9) * Settings.current.particleDensity) + 4;
    if (count <= 0) return;
    const inst = new THREE.InstancedMesh(geometriaCharco(), materialCharco(), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion(); // sin rotacion (ya horneada en la geometria)
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const radio = this.rng.range(0.5, 1.6);
      p.set(
        this.rng.range(-seg.width / 2 + 0.6, seg.width / 2 - 0.6),
        0.015,
        -this.rng.range(0.4, seg.length - 0.4)
      );
      // Elipse irregular: escala en Z distinta (como el scale.y original tras rotar).
      s.set(radio, 1, radio * (0.6 + this.rng.next() * 0.8));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.name = 'charcos';
    seg.group.add(inst);
  }

  // --- Manga de ventilacion + ventilador secundario ocasional ---
  _ventilation(seg) {
    const side = this.rng.chance(0.5) ? 1 : -1;
    const duct = crearVent({
      length: seg.length,
      radius: this.rng.range(0.3, 0.5),
      aged: this.rng.chance(0.3),
      side,
      height: seg.height
    });
    // _add (no group.add): registra el tick de ondulacion en seg.animated (se anima si visible).
    this._add(seg, duct);

    // Ventilador axial al inicio del tramo en galerias principales/cruceros.
    // 50% de probabilidad de tener guarda protectora (variante segun foto real).
    if ((seg.type === 'mainGallery' || seg.type === 'intersection') && this.rng.chance(0.6)) {
      const conProteccion = this.rng.chance(0.5);
      const fan = crearVentilador({ radio: 0.6, conProteccion });
      fan.position.set(side * (seg.width / 2 - 1.0), 0, -this.rng.range(1, 3));
      fan.rotation.y = -side * Math.PI / 2;
      this._add(seg, fan);
    }
  }

  _cables(seg) {
    seg.group.add(crearBandeja({ length: seg.length, side: -1, height: Math.min(2.4, seg.height - 0.5) }));
  }

  _hoses(seg) {
    if (this.rng.chance(0.7)) {
      seg.group.add(crearManguera({ length: seg.length, agua: this.rng.chance(0.6), baseX: this.rng.range(-2, 2) }));
    }
  }

  // --- Balizas / delineadores (geometria fusionada + instanciado: 1 draw call) ---
  _delineators(seg) {
    const side = this.rng.chance(0.5) ? 1 : -1;
    const zs = [];
    for (let z = -2; z > -seg.length; z -= this.rng.range(3, 5)) zs.push(z);
    if (zs.length === 0) return;
    const inst = new THREE.InstancedMesh(geometriaBaliza(), materialBaliza(), zs.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    zs.forEach((z, i) => {
      p.set(side * (seg.width / 2 - 0.7), 0, z);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.name = 'balizas';
    seg.group.add(inst);
  }

  // --- Nichos electricos empotrados en el hastial (tablero a 1m del suelo) ---
  // Aparecen en galerias, galeria principal y cruceros con ~78% de probabilidad (mapa ampliado).
  // La variante doble (2 tableros) sale con un 30% de probabilidad.
  _nichos(seg) {
    const tipos = ['gallery', 'mainGallery', 'intersection'];
    if (!tipos.includes(seg.type)) return;
    if (!this.rng.chance(0.78)) return;

    const halfW  = seg.width / 2;
    const side   = this.rng.chance(0.5) ? 1 : -1;
    const doble  = this.rng.chance(0.30);
    // Los refugios peatonales VACÍOS ahora se colocan de forma regular en _pedestrianRefuges
    // (cada ~10 m). Este método deja solo los nichos ELÉCTRICOS (con tableros).
    const vacio  = false;
    // Semilla con X+Z: evita nichos identicos en galerias paralelas (lineal: x=0, sin cambio).
    const seed   = Math.round((Math.abs(seg.group.position.z) + Math.abs(seg.group.position.x)) * 10) + 1;
    const zPos   = -this.rng.range(2, seg.length - 2);

    const nicho  = vacio
      ? crearNichoVacio({ seed })
      : crearNicho({ doble, seed });

    // Offset 0.40m DENTRO de la roca: garantiza que el shell del tunel (jitter max 0.35m)
    // quede completamente del lado del tunel. Desde dentro del nicho, la cara trasera
    // del shell es culled → transparente → el jugador ve la via sin obstruccion.
    nicho.position.set(side * (halfW + 0.40), 0, zPos);
    nicho.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    // Registrar zona libre de obstrucciones (malla, pernos)
    if (!seg.nichoZones) seg.nichoZones = [];
    seg.nichoZones.push({ side, zMin: zPos - 0.85, zMax: zPos + 0.85 });

    seg.group.add(nicho);

    if (nicho.userData?._tableroInteractable) {
      seg.interactables.push(nicho.userData._tableroInteractable);
    }

    // Nicho vacio → el jugador puede entrar: abrir un hueco en el colisionador de pared.
    if (vacio) this._punchNichoHole(seg, side, zPos);
  }

  // Sustituye el colisionador de pared completo por piezas con hueco donde esta el nicho,
  // permitiendo que el jugador entre fisicamente al nicho vacio.
  _punchNichoHole(seg, side, zPos) {
    const tag = side > 0 ? 'wallR' : 'wallL';
    const idx = seg.colliders.findIndex(c => c.tag === tag);
    if (idx === -1) return;
    const wall = seg.colliders[idx];
    const halfW   = Math.abs(wall.pos[0]);
    const wallH   = seg.height;   // altura real del segmento (no del collider extendido)
    const halfL   = wall.hz;

    const W = 1.55, H = 2.30, D = 1.55;

    seg.colliders.splice(idx, 1); // quitar la pared completa

    // 1. Franja SUPERIOR: por encima del nicho, ancho completo
    const topH = wallH - H;
    if (topH > 0.05) {
      seg.colliders.push({
        hx: 0.1, hy: topH / 2, hz: halfL,
        pos: [side * halfW, H + topH / 2, -halfL]
      });
    }

    // 2. ANTES del nicho (z=0 → zPos+W/2): altura baja (0..H)
    const z1 = zPos + W / 2; // mas cercano a z=0 (menos negativo)
    const beforeLen = Math.abs(z1);
    if (beforeLen > 0.05) {
      seg.colliders.push({
        hx: 0.1, hy: H / 2, hz: beforeLen / 2,
        pos: [side * halfW, H / 2, z1 / 2]
      });
    }

    // 3. DESPUES del nicho (zPos-W/2 → -seg.length): altura baja (0..H)
    const z2 = zPos - W / 2; // mas lejos de z=0 (mas negativo)
    const endZ = -halfL * 2; // = -seg.length
    const afterLen = Math.abs(endZ - z2);
    if (afterLen > 0.05) {
      seg.colliders.push({
        hx: 0.1, hy: H / 2, hz: afterLen / 2,
        pos: [side * halfW, H / 2, (z2 + endZ) / 2]
      });
    }

    // Muros del interior: nicho desplazado 0.40m dentro de la roca desde el shell.
    const VISUAL_OFFSET = 0.40;
    const nichoHx    = D / 2;
    const nichoCX    = side * (halfW + VISUAL_OFFSET + D / 2);
    const nichoBackX = side * (halfW + VISUAL_OFFSET + D);

    // Pared del fondo
    seg.colliders.push({ hx: 0.1, hy: H / 2, hz: W / 2, pos: [nichoBackX, H / 2, zPos] });
    // Paredes laterales (perpendiculares al tunel)
    seg.colliders.push({ hx: nichoHx, hy: H / 2, hz: 0.1, pos: [nichoCX, H / 2, zPos + W / 2] });
    seg.colliders.push({ hx: nichoHx, hy: H / 2, hz: 0.1, pos: [nichoCX, H / 2, zPos - W / 2] });
    // Techo del nicho
    seg.colliders.push({ hx: nichoHx, hy: 0.1, hz: W / 2, pos: [nichoCX, H, zPos] });
    // Suelo del nicho — sin esta caja el jugador cae al entrar y queda atrapado
    seg.colliders.push({ hx: nichoHx, hy: 0.1, hz: W / 2, pos: [nichoCX, 0, zPos] });
  }

  // --- REFUGIOS DE NICHO PEATONAL cada ~10 m (resguardo del peaton al pasar un vehiculo) ---
  // Se alternan de hastial, sin foco propio (crearNichoVacio) y con forma irregular. Son
  // ENTRABLES: perforan la pared para que el jugador pueda meterse. Se colocan a lo largo de
  // las vias transitables (galerias, cruceros y via principal).
  _pedestrianRefuges(seg) {
    const tipos = ['gallery', 'crucero', 'mainRoad'];
    if (!tipos.includes(seg.type)) return;

    // Espaciado ALEATORIO (ya NO metronomico): las hornacinas se reparten de forma natural por
    // toda la via, con gaps y lado variables (seeded → reproducible). Media ~baseGap; en celular
    // (heavyDetail bajo) van mas separadas para bajar el numero de nichos (draw calls).
    const baseGap  = Settings.current.heavyDetail >= 0.7 ? 10 : 18;
    const halfW    = seg.width / 2;
    const seedBase = Math.round((Math.abs(seg.group.position.z) + Math.abs(seg.group.position.x)) * 10) + 3;

    const holesL = [], holesR = [];   // z de las aperturas por hastial (izq / der)
    let idx = 0;

    // Primer nicho a distancia aleatoria de la boca; luego gaps aleatorios (0.55x–1.6x baseGap).
    for (let d = 4 + this.rng.range(0, 5); d <= seg.length - 4; d += baseGap * this.rng.range(0.55, 1.6)) {
      let side = this.rng.chance(0.5) ? 1 : -1;   // hastial aleatorio (no alterna estricto)
      const zPos = -d;
      // No pisar un nicho electrico / bahía ya registrado en ese hastial: prueba el otro lado.
      if (this._inNichoZone(seg, side, zPos)) { side = -side; if (this._inNichoZone(seg, side, zPos)) continue; }

      const nicho = crearNichoVacio({ seed: seedBase + idx });
      nicho.position.set(side * (halfW + 0.40), 0, zPos);
      nicho.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      seg.group.add(nicho);

      if (!seg.nichoZones) seg.nichoZones = [];
      seg.nichoZones.push({ side, zMin: zPos - 0.85, zMax: zPos + 0.85 });
      (side > 0 ? holesR : holesL).push(zPos);

      // Marca VISIBLE (señal + baliza + jambas) y registro como punto de refugio para los NPC.
      this._markPedestrianRefuge(seg, side, zPos, halfW);
      if (!seg.refugeNiches) seg.refugeNiches = [];
      seg.refugeNiches.push({ x: side * (halfW + 0.9), z: zPos });   // objetivo DENTRO del nicho

      idx++;
    }

    if (holesR.length) this._punchWallHoles(seg, 1, holesR);
    if (holesL.length) this._punchWallHoles(seg, -1, holesL);
  }

  /**
   * Hace VISIBLE un nicho peatonal en la mina oscura: señal verde "REFUGIO" + baliza emisiva
   * (bloom) sobre la boca + jambas reflectivas (delineador) a los lados. Así se reconoce como
   * refugio y "se ve" aunque no tenga luz propia. Detalle fino gateado por heavyDetail.
   */
  _markPedestrianRefuge(seg, side, zPos, halfW) {
    const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;   // de cara a la via
    const xIn  = side * (halfW - 0.03);                    // apenas dentro del tunel

    // Señal "REFUGIO" sobre la boca.
    const sign = crearSenal('refugio_peatonal');
    sign.scale.setScalar(0.85);
    sign.position.set(xIn, 2.45, zPos);
    sign.rotation.y = rotY;
    seg.group.add(sign);

    // Baliza emisiva (verde) en el dintel: la hace destacar en la oscuridad vía bloom.
    const beacon = _refugeBeacon();
    beacon.position.set(side * (halfW - 0.06), 2.18, zPos);
    seg.group.add(beacon);

    // Jambas reflectivas (delineador) a los lados de la boca — solo con detalle suficiente.
    if ((Settings.current.heavyDetail ?? 1) >= 0.7) {
      for (const dz of [-0.78, 0.78]) {
        const jamb = _refugeJamb();
        jamb.position.set(side * (halfW - 0.02), 1.15, zPos + dz);
        seg.group.add(jamb);
      }
    }
  }

  // --- BERMA PEATONAL demarcada: la vía por la que circula el personal (un costado, fuera de la
  // calzada de equipos). Línea pintada reflectiva continua + postes delineadores + señal "VÍA
  // PEATONAL". Registra `seg.bermLocalX` para que los NPC caminen EXACTAMENTE sobre ella. Reglamento
  // SSOMA: separación peatón/equipo. ---
  _pedestrianBerm(seg) {
    const tipos = ['gallery', 'crucero', 'mainRoad'];
    if (!tipos.includes(seg.type)) return;
    if (seg.length < 6) return;

    const halfW = seg.width / 2;
    const side  = this.rng.chance(0.5) ? 1 : -1;     // costado peatonal (deterministico por seed)
    const inset = 1.05;                               // junto al bordillo de la cuneta, lado calzada
    const x = side * (halfW - inset);
    seg.bermSide = side;
    seg.bermLocalX = x;                               // lo lee NPCManager para alinear el carril

    // Línea reflectiva pintada en el piso (1 mesh por tramo).
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, seg.length - 0.4), _bermLineMat());
    line.position.set(x, 0.05, -seg.length / 2);
    line.name = 'berma_linea';
    seg.group.add(line);

    // Postes delineadores reflectivos cada ~5 m (gateados por heavyDetail).
    if ((Settings.current.heavyDetail ?? 1) >= 0.5) {
      for (let z = -2; z > -seg.length + 1; z -= 5) {
        const post = _bermPost();
        post.position.set(x - side * 0.04, 0.25, z);
        seg.group.add(post);
      }
    }

    // Señal "VÍA PEATONAL" al hastial de la boca, de cara a la vía.
    const sign = crearSenal('peatones');
    sign.scale.setScalar(0.85);
    sign.position.set(side * (halfW - 0.06), 1.85, -1.4);
    sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    seg.group.add(sign);
  }

  // Rehace UN hastial completo dejando VARIAS aperturas de refugio (colisiones entrables).
  // Generaliza _punchNichoHole a N huecos en una sola pasada, para no romper la logica de
  // remover el collider de pared una unica vez.
  _punchWallHoles(seg, side, zPositions) {
    const tag = side > 0 ? 'wallR' : 'wallL';
    const idx = seg.colliders.findIndex(c => c.tag === tag);
    if (idx === -1) return;
    const wall   = seg.colliders[idx];
    const halfW  = Math.abs(wall.pos[0]);
    const wallH  = seg.height;
    const halfL  = wall.hz;
    const length = halfL * 2;            // la pared cubre z ∈ [-length, 0]
    const W = 1.55, H = 2.30, D = 1.55;

    seg.colliders.splice(idx, 1);

    // Franja SUPERIOR por encima de TODAS las aperturas (ancho completo).
    const topH = wallH - H;
    if (topH > 0.05) {
      seg.colliders.push({ hx: 0.1, hy: topH / 2, hz: halfL, pos: [side * halfW, H + topH / 2, -halfL] });
    }

    const VISUAL_OFFSET = 0.40;
    const nichoHx    = D / 2;
    const nichoCX    = side * (halfW + VISUAL_OFFSET + D / 2);
    const nichoBackX = side * (halfW + VISUAL_OFFSET + D);

    // Aperturas ordenadas de la boca (0) hacia el fondo (-length).
    const zs = [...zPositions].sort((a, b) => b - a);
    let cursor = 0;
    for (const z of zs) {
      const zStart = z + W / 2;               // borde de la apertura mas cercano a la boca
      const segLen = cursor - zStart;
      if (segLen > 0.05) {
        seg.colliders.push({ hx: 0.1, hy: H / 2, hz: segLen / 2, pos: [side * halfW, H / 2, (cursor + zStart) / 2] });
      }
      cursor = z - W / 2;                      // avanza al borde lejano de la apertura

      // Colisiones interiores del refugio (fondo, laterales, techo, suelo).
      seg.colliders.push({ hx: 0.1,     hy: H / 2, hz: W / 2, pos: [nichoBackX, H / 2, z] });
      seg.colliders.push({ hx: nichoHx, hy: H / 2, hz: 0.1,   pos: [nichoCX, H / 2, z + W / 2] });
      seg.colliders.push({ hx: nichoHx, hy: H / 2, hz: 0.1,   pos: [nichoCX, H / 2, z - W / 2] });
      seg.colliders.push({ hx: nichoHx, hy: 0.1,   hz: W / 2, pos: [nichoCX, H, z] });
      seg.colliders.push({ hx: nichoHx, hy: 0.1,   hz: W / 2, pos: [nichoCX, 0, z] });
    }

    // Tramo final desde la ultima apertura hasta el fondo de la pared.
    const finalLen = cursor - (-length);
    if (finalLen > 0.05) {
      seg.colliders.push({ hx: 0.1, hy: H / 2, hz: finalLen / 2, pos: [side * halfW, H / 2, (cursor - length) / 2] });
    }
  }

  // --- Bahías de jumbo: excavación 5×5×20m con perforadora + bloqueo LOTO ---
  // Nichos GRANDES para jumbos. Aparecen en galería principal Y cámaras (stopes donde
  // trabajan los jumbos), con ~55% de probabilidad (antes 25% solo en galería principal).
  _bahias(seg) {
    const tipos = ['mainGallery', 'chamber'];
    if (!tipos.includes(seg.type)) return;
    if (!this.rng.chance(0.55)) return;

    const halfW = seg.width / 2;
    const side  = this.rng.chance(0.5) ? 1 : -1;
    const zMin  = BAHIA_W / 2 + 1.5;
    const zMax  = seg.length - BAHIA_W / 2 - 1.5;
    if (zMax <= zMin) return;

    const zPos = -this.rng.range(zMin, zMax);
    const seed = Math.round((Math.abs(seg.group.position.z) + Math.abs(seg.group.position.x)) * 10) + 7;

    const bahia = crearBahia({ seed });
    bahia.position.set(side * (halfW + 0.40), 0, zPos);
    bahia.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    seg.group.add(bahia);

    if (bahia.userData?.interactable) {
      seg.interactables.push(bahia.userData.interactable);
    }

    // Registrar zona libre (ancha, para bahía de 5m)
    if (!seg.nichoZones) seg.nichoZones = [];
    seg.nichoZones.push({ side, zMin: zPos - BAHIA_W / 2 - 1.2, zMax: zPos + BAHIA_W / 2 + 1.2 });

    this._punchBahiaHole(seg, side, zPos);
  }

  // Igual que _punchNichoHole pero con las dimensiones de la bahía (5×4.8m apertura).
  _punchBahiaHole(seg, side, zPos) {
    const tag = side > 0 ? 'wallR' : 'wallL';
    const idx = seg.colliders.findIndex(c => c.tag === tag);
    if (idx === -1) return;
    const wall  = seg.colliders[idx];
    const halfW = Math.abs(wall.pos[0]);
    const wallH = seg.height;   // altura real del segmento
    const halfL = wall.hz;

    seg.colliders.splice(idx, 1);

    // Franja SUPERIOR por encima de la apertura
    const topH = wallH - BAHIA_H;
    if (topH > 0.05) {
      seg.colliders.push({ hx: 0.1, hy: topH / 2, hz: halfL, pos: [side * halfW, BAHIA_H + topH / 2, -halfL] });
    }

    // ANTES de la bahía (hacia z=0)
    const z1 = zPos + BAHIA_W / 2;
    const beforeLen = Math.abs(z1);
    if (beforeLen > 0.05) {
      seg.colliders.push({ hx: 0.1, hy: BAHIA_H / 2, hz: beforeLen / 2, pos: [side * halfW, BAHIA_H / 2, z1 / 2] });
    }

    // DESPUÉS de la bahía (hacia z=-length)
    const z2   = zPos - BAHIA_W / 2;
    const endZ = -halfL * 2;
    const afterLen = Math.abs(endZ - z2);
    if (afterLen > 0.05) {
      seg.colliders.push({ hx: 0.1, hy: BAHIA_H / 2, hz: afterLen / 2, pos: [side * halfW, BAHIA_H / 2, (z2 + endZ) / 2] });
    }

    // Interior de la bahía — misma referencia visual: 0.40m dentro de la roca.
    const VISUAL_OFFSET = 0.40;
    const bahiaCX   = side * (halfW + VISUAL_OFFSET + BAHIA_D / 2);
    const bahiaBack = side * (halfW + VISUAL_OFFSET + BAHIA_D);
    const bahiaHx   = BAHIA_D / 2;

    seg.colliders.push({ hx: 0.1,     hy: BAHIA_H / 2, hz: BAHIA_W / 2, pos: [bahiaBack, BAHIA_H / 2, zPos] });
    seg.colliders.push({ hx: bahiaHx, hy: BAHIA_H / 2, hz: 0.1,         pos: [bahiaCX, BAHIA_H / 2, zPos + BAHIA_W / 2] });
    seg.colliders.push({ hx: bahiaHx, hy: BAHIA_H / 2, hz: 0.1,         pos: [bahiaCX, BAHIA_H / 2, zPos - BAHIA_W / 2] });
    seg.colliders.push({ hx: bahiaHx, hy: 0.1,         hz: BAHIA_W / 2, pos: [bahiaCX, BAHIA_H, zPos] });
    // Suelo de la bahía — sin esta caja el jugador cae al entrar y queda atrapado
    seg.colliders.push({ hx: bahiaHx, hy: 0.1,         hz: BAHIA_W / 2, pos: [bahiaCX, 0, zPos] });
  }

  // --- Senaletica, tableros, pizarra de monitoreo, jumbo y panel informativo ---
  _contextSignage(seg, flags) {
    const addSign = (tipo, position, rotY, label = 'Leer senal') => {
      const sign = crearSenal(tipo);
      sign.position.copy(position);
      sign.rotation.y = rotY;
      seg.group.add(sign);
      seg.interactables.push({
        object: sign,
        descriptor: {
          label,
          onInteract: () => window.__mina?.bus.emit('ui:read', { title: 'SENAL', body: sign.userData.signText })
        }
      });
      return sign;
    };

    const halfW = seg.width / 2;

    if (flags.signage && seg.signAnchor) {
      const base = seg.signAnchor.position;
      addSign('uso_epp', base.clone().add(new THREE.Vector3(0.06, 0.5, 0)), Math.PI / 2, 'Leer: Uso obligatorio EPP');
      addSign('via_escape', base.clone().add(new THREE.Vector3(0.06, -0.1, -1.2)), Math.PI / 2, 'Leer: Via de escape');
      addSign('chevron', base.clone().add(new THREE.Vector3(0.06, -0.2, 1.0)), Math.PI / 2, 'Chevron de direccion');
      addSign('navegacion', base.clone().add(new THREE.Vector3(0.06, 0.6, 1.2)), Math.PI / 2, 'Leer: Navegacion CX/NV');

      // Tablero de gestion + tablero electrico + pizarra de monitoreo en el crucero.
      const board = crearTableroGestion();
      board.position.set(-halfW + 0.1, 0, -seg.length / 2 + 2);
      board.rotation.y = Math.PI / 2;
      this._add(seg, board);

      const panel = crearTableroElectrico();
      panel.position.set(halfW - 0.4, 0, -seg.length / 2 - 2);
      panel.rotation.y = -Math.PI / 2;
      this._add(seg, panel);

      const pizarra = crearPizarra();
      pizarra.position.set(-halfW + 0.6, 0, -seg.length / 2 - 2.5);
      pizarra.rotation.y = Math.PI / 2;
      this._add(seg, pizarra);
    }

    // Panel informativo en galerias con señaletica
    if (flags.signage && this.rng.chance(0.6)) {
      const panelInfo = crearPanel();
      // Pegado al hastial, altura de lectura: origen (borde inferior) a 1.0 m →
      // panel de 1 m de alto → CENTRO a 1.5 m del piso.
      panelInfo.position.set(halfW - 0.05, 1.0, -this.rng.range(1, seg.length - 1));
      panelInfo.rotation.y = -Math.PI / 2;
      this._add(seg, panelInfo);
    }

    // Jumbos solo dentro de bahias (bahia_jumbo.js los incluye con bloqueo LOTO).
    // Barreras rojas eliminadas de la via principal.

    if (flags.hazard) {
      addSign('peligro_caida', new THREE.Vector3(0, 2, -seg.length / 2 + 1), 0, 'Leer: Peligro caida');
      addSign('peligro_no_ingresar', new THREE.Vector3(1.2, 1.8, -seg.length / 2 + 1.2), 0, 'Leer: No ingresar');
    }

    if (seg.type === 'mainGallery') {
      addSign('navegacion', new THREE.Vector3(-halfW + 0.1, 2.4, -seg.length / 2), Math.PI / 2, 'Leer: Navegacion CX/NV');
      // Pizarra de monitoreo arrimada a la pared.
      if (this.rng.chance(0.5)) {
        const pizarra = crearPizarra();
        pizarra.position.set(halfW - 0.6, 0, -this.rng.range(2, seg.length - 2));
        pizarra.rotation.y = -Math.PI / 2;
        this._add(seg, pizarra);
      }
    }

    if (seg.type === 'refuge') {
      addSign('refugio_banner', new THREE.Vector3(0, seg.height - 1.2, -seg.length + 0.5), 0, 'Leer: Refugio Minero');
      addSign('monitoreo_gases', new THREE.Vector3(-halfW + 0.1, 1.8, -seg.length / 2 - 1), Math.PI / 2, 'Leer: Monitoreo de gases');
      addSign('uso_epp', new THREE.Vector3(-halfW + 0.1, 1.9, -seg.length / 2 + 1.5), Math.PI / 2, 'Leer: Uso obligatorio EPP');
    }
  }

  _buildBarrier(seg, addSign) {
    const z = -seg.length / 2;
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, seg.width, 4),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    rope.rotation.z = Math.PI / 2;
    rope.position.set(0, 2.4, z);
    seg.group.add(rope);

    addSign('advertencia', new THREE.Vector3(-1.2, 2.0, z), 0, 'Leer: Advertencia');
    addSign('peligro_no_ingresar', new THREE.Vector3(1.4, 2.0, z), 0, 'Leer: Peligro no ingresar');

    // Zona PROHIBIDA al cruzar la barrera (area restringida sin kill — solo aviso constante).
    const zona = new THREE.Object3D();
    zona.position.set(0, 1, z - 4); // centro de zona ~4 m dentro de la barrera
    zona.userData.hazard = {
      tipo: 'prohibida',
      warn: 12, // radio amplio: se activa desde antes de llegar al banderin
      aviso: 'ZONA PROHIBIDA — Area restringida. No estas autorizado para ingresar sin permiso escrito del supervisor.'
    };
    this._add(seg, zona);
  }
}
