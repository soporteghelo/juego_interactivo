import * as THREE from 'three';
import { Settings } from '../core/Settings.js';

// Todos los elementos provienen de la carpeta unica src/elementos/ (en espanol).
import { geometriaPerno, materialPerno } from '../elementos/perno.js';
import { geometriaRoca, materialRoca } from '../elementos/roca_suelta.js';
import { crear as crearMalla } from '../elementos/malla.js';
import { crear as crearShotcrete } from '../elementos/shotcrete.js';
import { crear as crearCharco } from '../elementos/charco.js';
import { crear as crearBaliza } from '../elementos/baliza.js';
import { crear as crearVent } from '../elementos/ventilacion.js';
import { crear as crearBandeja } from '../elementos/bandeja_cables.js';
import { crear as crearManguera } from '../elementos/manguera.js';
import { crear as crearTableroElectrico } from '../elementos/tablero_electrico.js';
import { crear as crearTableroGestion } from '../elementos/tablero_gestion.js';
import { crear as crearPizarra } from '../elementos/pizarra_monitoreo.js';
import { crear as crearVentilador } from '../elementos/ventilador.js';
import { crear as crearJumbo } from '../elementos/jumbo.js';
import { crear as crearPanel } from '../elementos/panel_informativo.js';
import { crear as crearNicho, crearVacio as crearNichoVacio } from '../elementos/nicho_electrico.js';
import { crear as crearBahia, BW as BAHIA_W, BH as BAHIA_H, BD as BAHIA_D } from '../elementos/bahia_jumbo.js';
import { crearSenal } from '../elementos/senal.js';
import { crear as crearChevron } from '../elementos/chevron.js';

/**
 * Distribuye los ELEMENTOS sobre cada tramo segun su tipo/flags y las reglas del md:
 * pernos (instanciados, con variante sobresalida), malla (normal y sobresalida/rasgada),
 * shotcrete craquelado, escombros, charcos, balizas, ventilacion + ventiladores, cables,
 * mangueras, senaletica contextual, tableros, pizarra de monitoreo y VEHICULOS pesados.
 *
 * Optimizacion: pernos y escombros usan InstancedMesh. Los objetos animados (ventiladores,
 * balizas de vehiculos) se registran en seg.animated para que el mundo los anime.
 */
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
    this._bahias(seg);
    this._rockBolts(seg, flags);
    this._wireMesh(seg, flags);
    this._shotcreteCracks(seg, flags);
    this._debris(seg, flags);
    this._puddles(seg);
    this._ventilation(seg);
    // Bandeja de cables desactivada a peticion: no se muestra en el juego.
    // this._cables(seg);
    this._hoses(seg);
    this._delineators(seg);
    this._contextSignage(seg, flags);
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
    let seedBase = Math.round(Math.abs(seg.group.position.z) * 100) + 1;
    for (const sign of [-1, 1]) {
      for (let z = -2; z > -seg.length; z -= 3.2) {
        if (this._inNichoZone(seg, sign, z)) { seedBase++; continue; }
        const baseProb = (flags.hazard || flags.barrier) ? 0.40 : 0.12;
        const sobresalida = this.rng.chance(Math.min(0.85, baseProb * Settings.unsafeLevel));
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

  // --- Charcos de agua reflectivos ---
  _puddles(seg) {
    const count = Math.round(this.rng.range(5, 9) * Settings.current.particleDensity) + 4;
    for (let i = 0; i < count; i++) {
      const p = crearCharco({ radio: this.rng.range(0.5, 1.6) });
      p.position.x = this.rng.range(-seg.width / 2 + 0.6, seg.width / 2 - 0.6);
      p.position.z = -this.rng.range(0.4, seg.length - 0.4);
      seg.group.add(p);
    }
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
    seg.group.add(duct);

    // Ventilador axial al inicio del tramo en galerias principales/cruceros.
    // 50% de probabilidad de tener guarda protectora (variante foto real AESA).
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

  _delineators(seg) {
    const side = this.rng.chance(0.5) ? 1 : -1;
    for (let z = -2; z > -seg.length; z -= this.rng.range(3, 5)) {
      const d = crearBaliza();
      d.position.set(side * (seg.width / 2 - 0.7), 0, z);
      seg.group.add(d);
    }
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
    const vacio  = this.rng.chance(0.55); // 55% de nichos son refugios peatonales vacíos
    const seed   = Math.round(Math.abs(seg.group.position.z) * 10) + 1;
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
    const seed = Math.round(Math.abs(seg.group.position.z) * 10) + 7;

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

    // Panel informativo AESA en galerias con señaletica
    if (flags.signage && this.rng.chance(0.6)) {
      const panelInfo = crearPanel();
      // Centro del panel a 2.0 m (panel 1 m de alto → borde inferior a 1.5 m del suelo)
      panelInfo.position.set(halfW - 0.06, 2.0, -this.rng.range(1, seg.length - 1));
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

    addSign('advertencia_aesa', new THREE.Vector3(-1.2, 2.0, z), 0, 'Leer: Advertencia AESA');
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
