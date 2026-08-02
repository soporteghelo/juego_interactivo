import * as THREE from 'three';

import { Settings } from './Settings.js';
import { Device } from './Device.js';
import { EventBus } from './EventBus.js';
import { Renderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { crearEnvMapMina } from './EnvMap.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { AssetLoader } from './AssetLoader.js';
import { InteractionSystem } from './InteractionSystem.js';
import { HazardSystem } from './HazardSystem.js';
import { PostFX } from './PostFX.js';
import { PerfMonitor } from './PerfMonitor.js';
import { Perf } from './Perf.js';

import { Physics } from '../physics/Physics.js';
import { LightingRig } from '../lighting/LightingRig.js';
import { World } from '../world/World.js';
import { GridWorld } from '../world/grid/GridWorld.js';
import { CompleteMineWorld } from '../world/complete/CompleteMineWorld.js';
import { Player } from '../player/Player.js';
import { BoundsGuard } from '../player/BoundsGuard.js';
import { GridBoundsGuard } from '../player/GridBoundsGuard.js';
import { DustSystem } from '../particles/Dust.js';
import { MistSystem } from '../particles/Mist.js';
import { WorkFX } from '../particles/WorkFX.js';
import { VentFlowSystem } from '../particles/VentFlowSystem.js';
import { VaporSystem } from '../particles/VaporSystem.js';
import { DripSystem } from '../particles/DripSystem.js';
import { WorkSiteSystem } from '../world/WorkSiteSystem.js';
import { WorkCrewSystem } from '../world/WorkCrewSystem.js';
import { ActoresLod } from '../world/ActoresLod.js';
import { construirCarcasa } from '../procedural/CarcasaFusionada.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { TouchControls } from '../ui/TouchControls.js';

import { VehicleSystem } from '../world/VehicleSystem.js';
import { DriveController } from '../world/DriveController.js';
import { HaulCycle } from '../world/HaulCycle.js';
import { crear as crearScoop } from '../elementos/equipos/scoop.js';
import { NPCManager } from '../ai/NPCManager.js';
import { precargarMinero } from '../elementos/personas/minero.js';
import { EventDirector } from '../events/EventDirector.js';
import { MissionManager } from '../missions/MissionManager.js';

/**
 * Engine: orquestador central. Crea y conecta todos los subsistemas, los registra en
 * el bucle y expone un contexto comun (this.ctx) que se inyecta a cada sistema.
 *
 * Ciclo de vida:
 *   const engine = new Engine(container);
 *   await engine.init();   // carga fisica (WASM), construye mundo, jugador, UI...
 *   engine.begin();        // habilita input y arranca el gameplay (tras "INGRESAR")
 */
export class Engine {
  constructor(container) {
    this.container = container;

    // --- Aplica recomendaciones del dispositivo ANTES de crear nada visual ---
    Settings.setQuality(Device.recommendedQuality);
    Settings.setControlScheme(Device.controlScheme);

    this.bus = new EventBus();
    this.renderer = new Renderer(container);
    this.sceneManager = new SceneManager();
    this.scene = this.sceneManager.scene;

    // Mapa de entorno OSCURO: reflejos plausibles en charcos/agua y metal (md: charcos que
    // espejan LED/banners). Se hornea una vez aqui (ya existen renderer y escena). No aclara
    // la labor: es casi negro y las superficies matte llevan envMapIntensity bajo.
    this.scene.environment = crearEnvMapMina(this.renderer.instance);

    // FOV vertical ADAPTATIVO a la orientacion: en horizontal 75°; en VERTICAL (portrait) sube
    // a 82° para que el encuadre horizontal no quede "encajonado" (una pantalla alta y estrecha
    // recorta el campo horizontal). Se re-evalua en cada resize/rotacion (ver _onResize).
    const _w = window.innerWidth, _h = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      _w >= _h ? 75 : 82,
      _w / _h,
      0.1,
      Settings.current.drawDistance + 30
    );
    Settings.onChange((quality) => {
      this.camera.far = quality.drawDistance + 30;
      this.camera.updateProjectionMatrix();
    });

    this.input = new Input(this.renderer.domElement);
    this.input.controlScheme = Device.controlScheme;

    this.assets = new AssetLoader();
    this.loop = new Loop((dt) => this._render(dt));

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.visualViewport?.addEventListener('resize', this._onResize);
  }

  /** Inicializacion asincrona (fisica WASM + construccion del mundo). */
  async init(onStatus = () => {}) {
    // Cede el hilo al navegador entre pasos pesados para que muestre el mensaje de estado.
    const tick = () => new Promise(r => setTimeout(r, 0));

    // El FBX del minero es descarga + parseo: NO depende de nada de aqui. Se lanza YA, en
    // paralelo, y se espera mas abajo. Mientras el mundo se construye (que cede el hilo cada
    // ~12 ms) la descarga avanza sola y el parseo se cuela en esos huecos, asi que su coste
    // deja de sumarse al arranque en vez de pagarse entero al final.
    const mineroListo = precargarMinero().catch((e) => {
      console.warn('[Engine] no se pudo precargar el FBX del minero; se usara la persona procedural.', e);
    });

    Perf.marca('fisica (Rapier WASM)');
    onStatus('Inicializando fisica (Rapier)…');
    this.physics = new Physics();
    await this.physics.init();

    await tick();
    Perf.marca('luces');
    onStatus('Encendiendo luces de mina…');
    this.lighting = new LightingRig({ scene: this.scene, settings: Settings });

    await tick();
    const modoGrid = Settings.worldMode === 'grid';
    const modoCompleto = Settings.worldMode === 'complete';
    onStatus(modoCompleto
      ? 'Cargando las 54 labores de la mina completa 3D…'
      : (modoGrid ? 'Trazando el plano de mina (retícula)…' : 'Generando galerias (procedural)…'));
    Perf.marca('construccion del mundo');
    const WorldClass = modoCompleto ? CompleteMineWorld : (modoGrid ? GridWorld : World);
    this.world = new WorldClass({
      scene: this.scene,
      physics: this.physics,
      assets: this.assets,
      bus: this.bus,
      lighting: this.lighting,
      seed: Settings.worldSeed
    });
    await this.world.build((i, total) => {
      onStatus(modoCompleto
        ? `Construyendo mina completa ${Math.min(i, total)} / ${total}…`
        : `Construyendo galeria ${i} / ${total}…`);
    });

    await tick();
    // Vehiculos: en modo lineal recorren el trazado; en modo grid recorren el circuito de la
    // via principal RN 96 (world.vehicleRoutes).
    Perf.marca('vehiculos');
    this.vehicleSystem = new VehicleSystem({
      scene: this.scene, world: this.world, bus: this.bus,
      routes: this.world.vehicleRoutes
    });
    for (const hz of this.vehicleSystem.hazards) this.world.hazards.push(hz);

    await tick();
    Perf.marca('FBX del minero (espera)');
    onStatus('Cargando modelo del minero (FBX)…');
    await mineroListo;   // ya venia cargandose desde el principio; se clona por jugador/NPC

    await tick();
    Perf.marca('jugador + conduccion + peligros');
    onStatus('Equipando al minero…');
    this.player = new Player({
      scene: this.scene,
      camera: this.camera,
      physics: this.physics,
      input: this.input,
      bus: this.bus,
      spawn: this.world.spawnPoint
    });

    // Red de seguridad de contencion: impide que el jugador se quede fuera del mapa.
    // El mundo en retícula expone boundsCheck() (cajas orientadas) → GridBoundsGuard.
    this.boundsGuard = typeof this.world.boundsCheck === 'function'
      ? new GridBoundsGuard({ player: this.player, world: this.world })
      : new BoundsGuard({ player: this.player, world: this.world });

    this.interaction = new InteractionSystem(this.camera, this.input, this.bus);
    this.world.registerInteractables(this.interaction);

    // ── CONDUCCION: todos los vehiculos de la mina son operables con E ──
    this.drive = new DriveController({
      scene: this.scene,
      camera: this.camera,
      input: this.input,
      bus: this.bus,
      interaction: this.interaction,
      player: this.player,
      world: this.world
    });

    // Colision entre equipos: el vehiculo que conduce el jugador NO puede traspasar la flota
    // ni el scoop autonomo del acarreo. Provee sus posiciones (excluye el propio conducido).
    this.drive.setBlockers(() => {
      const activo = this.drive.active?.mesh;
      const arr = [];
      for (const m of this.vehicleSystem.vehicles) if (m !== activo) arr.push(m.position);
      const hp = this.haul?.vehiclePos; if (hp) arr.push(hp);
      return arr;
    });

    // Scoop OPERABLE: estacionado cerca del spawn; el jugador se sube con E y lo conduce.
    // En modo retícula el spawn está al sur de la vía principal y el interior queda al NORTE
    // (+Z), así que aparcamos el scoop hacia dentro (+Z) en vez de -Z (que ahí es pared).
    const scoopPos = this.world.spawnVehiclePoint?.clone?.() || this.world.spawnPoint.clone();
    const scoopYaw = this.world.spawnVehicleYaw ?? (modoGrid ? 0 : Math.PI);
    if (!this.world.spawnVehiclePoint) {
      if (modoGrid) scoopPos.set(scoopPos.x, 0, scoopPos.z + 12);
      else scoopPos.set(scoopPos.x + 1.4, 0, scoopPos.z - 10);
    }
    const scoopSpawn = crearScoop();
    scoopSpawn.position.copy(scoopPos);
    scoopSpawn.rotation.y = scoopYaw; // mira hacia dentro de la mina
    scoopSpawn.userData.scoop.setManual();
    this.scene.add(scoopSpawn);
    this.drive.addVehicle(scoopSpawn, {
      nombre: 'Scoop', maxSpeed: 3.2, halfLen: 3.6, tick: true, alwaysTick: true
    });

    // FLOTA conducible: volquetes y camionetas se ceden al jugador (modo manual) y al
    // soltarlos retoman su circuito suavemente.
    for (const m of this.vehicleSystem.vehicles) {
      const esCamion = m.name === 'camion';
      this.drive.addVehicle(m, {
        nombre: esCamion ? 'Volquete' : 'Camioneta',
        maxSpeed: esCamion ? 4.5 : 6.0,
        turnRate: esCamion ? 0.9 : 1.3,
        halfLen: esCamion ? 4.4 : 3.0,
        camDist: esCamion ? 11.5 : 8.5,
        camUp: esCamion ? 5.8 : 4.4,
        tick: true,
        onBoard: (mesh) => this.vehicleSystem.setManual(mesh, true),
        onExit:  (mesh) => this.vehicleSystem.setManual(mesh, false)
      });
    }

    // EQUIPOS DE LABOR conducibles (salas de la reticula): scoop de la camara, Raptor,
    // desatador, empernador, shotcretera, mixer y telehandler. Los jumbos de las BAHIAS
    // con LOTO se excluyen a proposito: un equipo bloqueado/etiquetado NO se opera.
    const CONDUCIBLES = {
      scoop:            { nombre: 'Scoop',        maxSpeed: 3.2, halfLen: 3.6, tick: false },
      raptor:           { nombre: 'Jumbo Raptor', maxSpeed: 2.0, halfLen: 4.6, camDist: 11.5, camUp: 5.6 },
      desatador:        { nombre: 'Desatador',    maxSpeed: 2.2, halfLen: 4.2, camDist: 10.5, camUp: 5.2 },
      empernador:       { nombre: 'Empernador',   maxSpeed: 2.0, halfLen: 4.4, camDist: 10.5, camUp: 5.2 },
      shotcretera:      { nombre: 'Shotcretera',  maxSpeed: 2.4, halfLen: 4.2, camDist: 10.5, camUp: 5.2 },
      mixer:            { nombre: 'Mixer',        maxSpeed: 2.6, halfLen: 4.0, camDist: 10.5, camUp: 5.2 },
      telehandler:      { nombre: 'Telehandler',  maxSpeed: 2.8, halfLen: 3.2 },
      telehandler_paus: { nombre: 'Telehandler',  maxSpeed: 2.8, halfLen: 3.2 }
    };
    for (const seg of this.world.segments) {
      if (seg.type !== 'room') continue;
      for (const [nombre, cfg] of Object.entries(CONDUCIBLES)) {
        const obj = seg.group.getObjectByName(nombre);
        if (obj && !obj.userData._drivable) {
          obj.userData._drivable = true;
          this.drive.addVehicle(obj, cfg);
        }
      }
    }

    // ── ACARREO REAL: ciclo autonomo del LHD en la camara (muck de la pila) ──
    this.haul = new HaulCycle({ world: this.world, bus: this.bus });

    // Camiones cargados/vacios: puntos de carga (acceso a la camara, c0_r2) y descarga
    // (echadero, c2_r5, perimetro sur) sobre el circuito de la RN 96.
    const nodo = (id) => this.world.segments.find(s => s.nodeId === id);
    const carga = nodo('c0_r2'), descarga = nodo('c2_r5');
    if (carga && descarga) this.vehicleSystem.setCargoPoints(carga.group.position, descarga.group.position);

    // Los NPC se refugian ante el equipo que CONDUCE el jugador Y ante el scoop autonomo del
    // acarreo: el VehicleSystem reparte esas posiciones junto a las de la flota.
    this.vehicleSystem.setExtraPositions(() => {
      const arr = [];
      if (this.drive.active) arr.push(this.drive.active.mesh.position);
      const hp = this.haul.vehiclePos; if (hp) arr.push(hp);
      return arr;
    });

    // Asegura matrices de mundo actualizadas antes de medir las cajas de los peligros.
    this.scene.updateMatrixWorld(true);
    // Sistema de peligros: avisos por proximidad + muerte por contacto (y reinicio).
    this.hazardSystem = new HazardSystem({
      player: this.player,
      world: this.world,
      bus: this.bus,
      input: this.input
    });

    Perf.marca('atmosfera (particulas + audio)');
    onStatus('Preparando atmosfera…');
    this.dust = new DustSystem({ scene: this.scene, camera: this.camera, settings: Settings });
    this.mist = new MistSystem({ scene: this.scene, settings: Settings });
    this.audio = new AudioManager({ camera: this.camera, settings: Settings, bus: this.bus });
    // El motor diesel de proximidad sigue al vehiculo de la flota mas cercano a la camara.
    this.audio.setVehicles(this.vehicleSystem.vehicles);

    // Labores VIVAS: sonido sintetizado (percusion/hiss/bomba) + polvo/spray por distancia.
    this.workFX = new WorkFX({ scene: this.scene });
    // LOD de actores pesados: equipos aparcados y personas. Es lo único caro que no pasa ni por
    // el streaming de tramos ni por la fusión de estáticos (ver ActoresLod.js).
    this.actoresLod = new ActoresLod({ bus: this.bus, construirCarcasa });
    const nEquipos = this.actoresLod.registrarEquiposDeMundo(this.world.segments);
    if (nEquipos) console.info(`[Mina] LOD de equipos aparcados: ${nEquipos} máquinas`);

    this.workSites = new WorkSiteSystem({ world: this.world, bus: this.bus, audio: this.audio, fx: this.workFX });
    // Cuadrillas HUMANAS en las labores activas (perforista, sostenimiento, boquillero, vigia):
    // se crean/retiran por proximidad. Complementa a workSites (que anima solo las maquinas).
    this.workCrews = new WorkCrewSystem({ world: this.world, bus: this.bus, scene: this.scene, lod: this.actoresLod });
    // Flujo de ventilacion VISIBLE: penacho de aire en la boca de la manga mas cercana.
    this.ventFlow = new VentFlowSystem({ scene: this.scene, world: this.world, settings: Settings, bus: this.bus });
    // Vaho/condensacion en las labores calurosas (frente/shotcrete/bombeo).
    this.vapor = new VaporSystem({ scene: this.scene, world: this.world, settings: Settings, bus: this.bus });
    // Goteo VISIBLE de agua desde la boveda (rizo al impactar) sincronizado con el ploc del audio.
    this.drips = new DripSystem({ scene: this.scene, settings: Settings, bus: this.bus, audio: this.audio });

    await tick();
    Perf.marca('interfaz + NPC + postFX');
    onStatus('Preparando interfaz…');
    // --- Interfaz: HUD siempre; controles tactiles solo en celular ---
    this.hud = new HUD({ bus: this.bus, container: document.getElementById('ui-layer') });
    this.minimap = new Minimap({ bus: this.bus, world: this.world, container: document.getElementById('ui-layer') });
    if (Device.isTouch) {
      this.touch = new TouchControls({
        input: this.input,
        container: document.getElementById('ui-layer'),
        bus: this.bus
      });
    }

    // --- Stubs extensibles (cableados al bus, listos para crecer) ---
    this.npcs = new NPCManager({ scene: this.scene, bus: this.bus, world: this.world, lod: this.actoresLod });
    // Conectar NPCs con vehiculos (claxon + evasion + muerte por atropello)
    this.vehicleSystem.setNpcs(this.npcs.npcs);
    this.eventDirector = new EventDirector({ bus: this.bus, world: this.world, lighting: this.lighting });
    this.missions = new MissionManager({ bus: this.bus });

    // --- Postprocesado ---
    this.postfx = new PostFX(this.renderer.instance, this.scene, this.camera);

    await tick();
    onStatus('Compilando materiales y sombras…');
    await this._prewarm(tick);

    Perf.marca('registro en el bucle');
    // --- Registro en el bucle ---
    // ORDEN CLAVE: el jugador fija su movimiento cinematico ANTES del step de Rapier.
    this.loop.add(this.player);        // calcula intencion + setNextKinematicTranslation
    this.loop.add(this.physics);       // world.step() resuelve colisiones
    this.loop.add(this.boundsGuard);   // contencion: reubica si escapo del mapa (tras la fisica)
    this.loop.add(this.world);         // streaming de tramos (update)
    this.loop.add(this.vehicleSystem); // mueve la flota por el mapa completo
    this.loop.add(this.haul);          // ciclo autonomo del LHD en la camara
    this.loop.add(this.npcs);
    this.loop.add(this.eventDirector);
    this.loop.add(this.interaction);
    this.loop.add(this.drive);         // tras interaction: su chase cam pisa la del Player
    this.loop.add(this.hazardSystem);
    this.loop.add(this.dust);
    this.loop.add(this.mist);
    this.loop.add(this.actoresLod);  // LOD/culling de equipos aparcados y personas
    this.loop.add(this.workSites);   // elige emisores de labor por distancia
    this.loop.add(this.workCrews);   // cuadrillas humanas en las labores (spawn por proximidad)
    this.loop.add(this.workFX);      // integra las particulas de las labores
    this.loop.add(this.ventFlow);    // penacho de aire en la boca de la manga mas cercana
    this.loop.add(this.vapor);       // vaho/condensacion en las labores calurosas
    this.loop.add(this.drips);       // goteo visible desde la boveda (dispara el ploc del audio)
    this.loop.add(this.audio);
    this.loop.add(this.hud);
    this.loop.add(this.minimap);

    // Monitor de rendimiento adaptativo: ajusta la calidad al vuelo segun los FPS reales.
    this.perfMonitor = new PerfMonitor({ bus: this.bus });
    this.loop.add(this.perfMonitor);

    // Arranca el render (la escena se ve detras de la pantalla de inicio).
    this.loop.start();
    Perf.tabla();
    this.bus.emit('engine:ready');
  }

  /**
   * Pre-calienta los shaders y hornea las sombras estaticas ANTES de arrancar el bucle.
   *
   * Todo esto ocurre con TODOS los tramos visibles (el culling por distancia aun no corre),
   * de modo que la compilacion de programas y el render de shadow maps se pagan UNA sola vez
   * en la pantalla de carga, y no como tirones (freezes) mientras el jugador recorre.
   *
   * Las sombras quedan en modo estatico (autoUpdate=false): la mina es geometria fija, asi
   * que basta hornearlas una vez; evitamos re-renderizar mapas de cubo en cada frame.
   *
   * Se hace de forma ASINCRONA: `compileAsync` usa la extension KHR_parallel_shader_compile
   * para compilar en hilos del driver SIN congelar la pagina (antes, un `compile` sincrono
   * bloqueaba el hilo principal varios segundos al iniciar). Cedemos el hilo al navegador
   * antes del horneado de sombras para que la pantalla de carga siga respondiendo.
   *
   * CLAVE — hay que precalentar por la MISMA RUTA que usara el bucle. El programa que Three
   * compila para un material depende del ESPACIO DE COLOR DE SALIDA, y ese cambia segun se
   * dibuje al lienzo (`srgb`) o a un render target (`srgb-linear`, que es lo que hace el
   * composer de postprocesado). Compilando contra el lienzo se generaba una familia entera de
   * shaders que el juego NO usa: se compilaba todo DOS veces y el segundo lote caia de golpe
   * en el primer frame real — justo al pulsar INGRESAR (el tiron "antes de jugar"). Aqui se
   * fija el render target del composer antes de compilar y se hornea con un frame del propio
   * composer, de modo que al arrancar el bucle ya esta TODO compilado y no queda nada por
   * compilar en caliente.
   */
  async _prewarm(tick = () => Promise.resolve()) {
    const gl = this.renderer.instance;
    this.scene.updateMatrixWorld(true);
    Perf.censo(this.scene);

    // 1) COMPILAR con el mapa entero todavia enganchado a la escena. `compileAsync` recorre la
    //    escena con `traverse`, asi que solo ve lo que cuelga de ella: si primero aplicaramos
    //    el streaming, los materiales exclusivos de labores lejanas se quedarian sin compilar y
    //    su shader se pagaria de golpe al llegar alli. Mismo render target que usara el bucle.
    const destino = this.postfx.enabled ? this.postfx.composer.renderTarget1 : null;
    await Perf.medir('prewarm: compileAsync', async () => {
      if (destino) gl.setRenderTarget(destino);
      try {
        await gl.compileAsync(this.scene, this.camera);
      } finally {
        if (destino) gl.setRenderTarget(null);
      }
    });
    await tick();

    // 2) Streaming inicial: desengancha de la escena todo lo lejano al spawn. Asi el horneado
    //    de sombras (8 luces × 6 caras del cubo) solo recorre el entorno del jugador.
    Perf.marca('prewarm: streaming inicial');
    try {
      if (this.world._playerPos && this.world.spawnPoint) this.world._playerPos.copy(this.world.spawnPoint);
      this.world.update?.(0, 0);
    } catch { /* no critico */ }
    Perf.fin();

    // 3) Un frame completo POR LA RUTA REAL: hornea los shadow maps y, de paso, calienta los
    //    pases de postprocesado (bloom, viñeta, grano), que tambien compilan shaders propios.
    await Perf.medir('prewarm: horneado de sombras', () => {
      gl.shadowMap.needsUpdate = true;
      if (this.postfx.enabled) this.postfx.render(1 / 60);
      else gl.render(this.scene, this.camera);
    });
    gl.shadowMap.autoUpdate = false;
  }

  /** Habilita la interaccion del jugador (tras pulsar INGRESAR). */
  begin() {
    this.input.enabled = true;
    this.audio.resume();
    this.bus.emit('engine:begin');
  }

  _render(dt) {
    if (this.postfx.enabled) this.postfx.render(dt);
    else this.renderer.instance.render(this.scene, this.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w >= h ? 75 : 82;   // portrait: FOV vertical mayor (mejor encuadre horizontal)
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx?.setSize(w, h);
  }
}
