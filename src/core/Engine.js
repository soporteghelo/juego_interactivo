import * as THREE from 'three';

import { Settings } from './Settings.js';
import { Device } from './Device.js';
import { EventBus } from './EventBus.js';
import { Renderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { AssetLoader } from './AssetLoader.js';
import { InteractionSystem } from './InteractionSystem.js';
import { HazardSystem } from './HazardSystem.js';
import { PostFX } from './PostFX.js';

import { Physics } from '../physics/Physics.js';
import { LightingRig } from '../lighting/LightingRig.js';
import { World } from '../world/World.js';
import { Player } from '../player/Player.js';
import { BoundsGuard } from '../player/BoundsGuard.js';
import { DustSystem } from '../particles/Dust.js';
import { MistSystem } from '../particles/Mist.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { TouchControls } from '../ui/TouchControls.js';

import { VehicleSystem } from '../world/VehicleSystem.js';
import { NPCManager } from '../ai/NPCManager.js';
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

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      Settings.current.drawDistance + 30
    );

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

    onStatus('Inicializando fisica (Rapier)…');
    this.physics = new Physics();
    await this.physics.init();

    await tick();
    onStatus('Encendiendo luces de mina…');
    this.lighting = new LightingRig({ scene: this.scene, settings: Settings });

    await tick();
    onStatus('Generando galerias (procedural)…');
    this.world = new World({
      scene: this.scene,
      physics: this.physics,
      assets: this.assets,
      bus: this.bus,
      lighting: this.lighting,
      seed: Settings.worldSeed
    });
    this.world.build();

    await tick();
    // Vehiculos: recorren el mapa completo en via de un solo sentido (loop continuo).
    this.vehicleSystem = new VehicleSystem({ scene: this.scene, world: this.world, bus: this.bus });
    for (const hz of this.vehicleSystem.hazards) this.world.hazards.push(hz);

    await tick();
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
    this.boundsGuard = new BoundsGuard({ player: this.player, world: this.world });

    this.interaction = new InteractionSystem(this.camera, this.input, this.bus);
    this.world.registerInteractables(this.interaction);

    // Asegura matrices de mundo actualizadas antes de medir las cajas de los peligros.
    this.scene.updateMatrixWorld(true);
    // Sistema de peligros: avisos por proximidad + muerte por contacto (y reinicio).
    this.hazardSystem = new HazardSystem({
      player: this.player,
      world: this.world,
      bus: this.bus,
      input: this.input
    });

    onStatus('Preparando atmosfera…');
    this.dust = new DustSystem({ scene: this.scene, camera: this.camera, settings: Settings });
    this.mist = new MistSystem({ scene: this.scene, settings: Settings });
    this.audio = new AudioManager({ camera: this.camera, settings: Settings, bus: this.bus });

    await tick();
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
    this.npcs = new NPCManager({ scene: this.scene, bus: this.bus, world: this.world });
    // Conectar NPCs con vehiculos (claxon + evasion + muerte por atropello)
    this.vehicleSystem.setNpcs(this.npcs.npcs);
    this.eventDirector = new EventDirector({ bus: this.bus, world: this.world, lighting: this.lighting });
    this.missions = new MissionManager({ bus: this.bus });

    // --- Postprocesado ---
    this.postfx = new PostFX(this.renderer.instance, this.scene, this.camera);

    await tick();
    onStatus('Compilando materiales y sombras…');
    await this._prewarm(tick);

    // --- Registro en el bucle ---
    // ORDEN CLAVE: el jugador fija su movimiento cinematico ANTES del step de Rapier.
    this.loop.add(this.player);        // calcula intencion + setNextKinematicTranslation
    this.loop.add(this.physics);       // world.step() resuelve colisiones
    this.loop.add(this.boundsGuard);   // contencion: reubica si escapo del mapa (tras la fisica)
    this.loop.add(this.world);         // streaming de tramos (update)
    this.loop.add(this.vehicleSystem); // mueve la flota por el mapa completo
    this.loop.add(this.npcs);
    this.loop.add(this.eventDirector);
    this.loop.add(this.interaction);
    this.loop.add(this.hazardSystem);
    this.loop.add(this.dust);
    this.loop.add(this.mist);
    this.loop.add(this.audio);
    this.loop.add(this.hud);
    this.loop.add(this.minimap);

    // Arranca el render (la escena se ve detras de la pantalla de inicio).
    this.loop.start();
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
   */
  async _prewarm(tick = () => Promise.resolve()) {
    const gl = this.renderer.instance;
    this.scene.updateMatrixWorld(true);
    // Compila los programas de material de todo lo visible (con el conteo de luces final),
    // sin bloquear el hilo principal.
    await gl.compileAsync(this.scene, this.camera);
    await tick();
    // Un render completo para hornear los shadow maps, luego los congelamos.
    gl.shadowMap.needsUpdate = true;
    gl.render(this.scene, this.camera);
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
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx?.setSize(w, h);
  }
}
