import * as THREE from 'three';

/**
 * RECORRIDO GUIADO — presentación animada, paso a paso, de un elemento complejo.
 *
 * Toma un elemento del visor (p. ej. el refugio minero Dräger) y va mostrando
 * SUS SUBELEMENTOS uno por uno:
 *
 *   · la pieza del paso queda a plena opacidad y por delante de todo (renderOrder),
 *   · el resto del elemento se atenúa a un "fantasma" translúcido tipo radiografía,
 *     de modo que se ven las piezas INTERIORES sin quitar el casco,
 *   · la cámara VUELA en arco esférico hasta encuadrar la pieza (nunca salta),
 *   · la pieza entra con un pequeño "pop" de escala sobre su propio centro,
 *   · un marcador de esquinas verde enmarca la pieza mientras se explica,
 *   · terminado el tiempo de lectura, se pasa solo al siguiente paso.
 *
 * NO altera la geometría del elemento: solo intercambia los materiales por CLONES
 * temporales (uno por pieza y material, para poder atenuar cada parte por separado
 * aunque `MineMaterials` cachee y comparta los originales) y los restaura al salir.
 * Los clones copian cada cuadro color/emisivo del material original, así las
 * animaciones propias del elemento (semáforo, balizas) siguen vivas durante el tour.
 */

const ARRIBA = new THREE.Vector3(0, 1, 0);

const FANTASMA  = 0.085;  // opacidad de las piezas en segundo plano
const T_TRANS   = 1.25;   // s de vuelo de cámara entre pasos
const T_ESPERA  = 4.6;    // s de lectura por defecto en cada paso
const T_POP     = 0.55;   // s de la entrada (escala) de la pieza
const VEL_MEZCLA = 5.5;   // rapidez del fundido de opacidades (1/s)
const VEL_ORBITA = 0.085; // rad/s de la órbita lenta mientras se lee
const HOLGURA    = 1.15;  // margen del encuadre: la pieza no llega a tocar los bordes
const SESGO_Y    = 0.14;  // baja el punto de mira ⇒ la pieza sube y libera el panel de texto

/** smootherstep: arranque y frenado suaves del vuelo de cámara. */
const suave = (x) => x * x * x * (x * (x * 6 - 15) + 10);

/** easeOutBack: la pieza entra con un ligero rebote. */
function rebote(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export class RecorridoGuiado {
  /**
   * @param {{
   *   scene: THREE.Scene,
   *   camera: THREE.PerspectiveCamera,
   *   controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
   *   onPaso?: (i:number, total:number, paso:object) => void,
   *   onProgreso?: (frac:number) => void,
   *   onFin?: (completado:boolean) => void
   * }} opts
   */
  constructor({ scene, camera, controls, onPaso, onProgreso, onFin }) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.onPaso = onPaso;
    this.onProgreso = onProgreso;
    this.onFin = onFin;

    this._activo = false;
    this._pausado = false;
    this.i = 0;

    // Estado interno del vuelo de cámara
    this._camIni = new THREE.Vector3();
    this._camFin = new THREE.Vector3();
    this._tgtIni = new THREE.Vector3();
    this._tgtFin = new THREE.Vector3();
    this._sphIni = new THREE.Spherical();
    this._sphFin = new THREE.Spherical();
    this._sph    = new THREE.Spherical();
    this._tmpA   = new THREE.Vector3();
    this._tmpB   = new THREE.Vector3();
    this._popCentro = new THREE.Vector3();

    this._registro = [];   // clones de material: { orig, clon, baseOp, baseDepth, b }
    this._mallas   = [];   // { malla, baseRO, b }
    this._luces    = [];   // { luz, base, b }
    this._marcador = null;
    this._tMarcador = 0;

    // El usuario puede tomar el control: se corta la órbita lenta y, mientras
    // arrastra, el cronómetro del paso se detiene (no se le escapa la lectura).
    this._arrastrando = false;
    this._usuarioMovio = false;
    this._onArrastreIni = () => { this._arrastrando = true; this._usuarioMovio = true; };
    this._onArrastreFin = () => { this._arrastrando = false; };
  }

  get activo() { return this._activo; }
  get pausado() { return this._pausado; }

  // ══════════════════════════════════════════════════════════════════════
  //  CICLO DE VIDA
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Arranca el recorrido.
   * @param {THREE.Object3D} root  elemento completo (raíz del objeto del visor)
   * @param {Array<{grupo:THREE.Object3D|null, titulo:string, texto:string,
   *                yaw?:number, pitch?:number, dist?:number, dur?:number}>} pasos
   * @returns {boolean} `false` si no hay nada que recorrer
   */
  iniciar(root, pasos) {
    if (this._activo) this.detener(false);
    if (!root || !Array.isArray(pasos) || !pasos.length) return false;

    this.root = root;
    this.pasos = pasos;
    this._activo = true;
    this._pausado = false;

    // El recorrido es una vista fija y medida: sin la rotación acumulada del visor.
    root.rotation.y = 0;
    root.updateMatrixWorld(true);

    this._nearPrev = this.camera.near;
    this._farPrev  = this.camera.far;
    this.camera.near = 0.05;
    this.camera.far  = 500;
    this.camera.updateProjectionMatrix();

    this._prepararMateriales();
    this._crearMarcador();

    this.controls.addEventListener('start', this._onArrastreIni);
    this.controls.addEventListener('end',   this._onArrastreFin);

    this._irA(0);
    return true;
  }

  /** Termina el recorrido y devuelve el elemento y la cámara a su estado normal. */
  detener(completado = false) {
    if (!this._activo) return;
    this._activo = false;
    this._pausado = false;

    this._restaurarEscala();
    this._restaurarMateriales();
    this._quitarMarcador();

    this.controls.removeEventListener('start', this._onArrastreIni);
    this.controls.removeEventListener('end',   this._onArrastreFin);
    this.controls.enabled = true;

    this.camera.near = this._nearPrev ?? 0.05;
    this.camera.far  = this._farPrev ?? 500;
    this.camera.updateProjectionMatrix();

    this.root = null;
    this.pasos = null;
    this.onFin?.(completado);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  NAVEGACIÓN
  // ══════════════════════════════════════════════════════════════════════

  siguiente() {
    if (!this._activo) return;
    this._irA((this.i + 1) % this.pasos.length);
  }

  anterior() {
    if (!this._activo) return;
    this._irA((this.i - 1 + this.pasos.length) % this.pasos.length);
  }

  irA(i) {
    if (!this._activo) return;
    this._irA(Math.max(0, Math.min(this.pasos.length - 1, i)));
  }

  alternarPausa() {
    if (!this._activo) return this._pausado;
    this._pausado = !this._pausado;
    return this._pausado;
  }

  /**
   * Fija el estado de pausa (a diferencia de `alternarPausa`, que lo invierte).
   * Lo usa la selección por doble clic: si el usuario pide ver una pieza, el
   * recorrido debe quedarse en ella y no seguir avanzando solo.
   * @param {boolean} valor
   */
  pausar(valor = true) {
    if (!this._activo) return false;
    this._pausado = !!valor;
    return this._pausado;
  }

  /** Índice del paso que presenta ese grupo, o −1. */
  indiceDe(grupo) {
    if (!this._activo || !grupo) return -1;
    return this.pasos.findIndex((p) => p.grupo === grupo);
  }

  /** Grupo que se está presentando ahora mismo (null en las vistas generales). */
  get grupoActual() {
    return this._activo ? (this.pasos[this.i]?.grupo ?? null) : null;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  BUCLE
  // ══════════════════════════════════════════════════════════════════════

  /** Llamar una vez por cuadro ANTES de `controls.update()`. */
  actualizar(dt) {
    if (!this._activo) return;
    dt = Math.min(dt, 0.05);                    // pestaña en segundo plano: sin saltos

    // Fundido de opacidades hacia el objetivo del paso actual
    const k = 1 - Math.exp(-dt * VEL_MEZCLA);
    for (let b = 0; b < this._nBuckets; b++) {
      this._mezclas[b] += (this._destinos[b] - this._mezclas[b]) * k;
    }
    this._aplicarMezclas();

    const paso = this.pasos[this.i];
    const dur  = paso.dur ?? T_ESPERA;

    if (this._fase === 'transicion') {
      this._tTrans += dt;
      const u = Math.min(1, this._tTrans / this._durTrans);
      this._volarCamara(suave(u));
      if (u >= 1) {
        this._fase = 'espera';
        this._tEspera = 0;
        this._tPop = 0;
        this.controls.enabled = true;           // a partir de aquí se puede orbitar a mano
      }
    } else {
      // Entrada de la pieza (escala sobre su propio centro)
      if (this._tPop < T_POP) {
        this._tPop = Math.min(T_POP, this._tPop + dt);
        this._aplicarPop(this._tPop / T_POP);
      }
      // Órbita lenta de presentación (se corta en cuanto el usuario toca la escena)
      if (!this._usuarioMovio && !this._pausado) this._orbitar(dt);

      if (!this._pausado && !this._arrastrando) {
        this._tEspera += dt;
        if (this._tEspera >= dur) {
          if (this.i === this.pasos.length - 1) { this.detener(true); return; }
          this._irA(this.i + 1);
        }
      }
    }

    this._animarMarcador(dt);

    // Progreso del paso (transición + lectura) para la barra de la interfaz
    const frac = this._fase === 'transicion'
      ? (this._tTrans / this._durTrans) * 0.25
      : 0.25 + Math.min(1, this._tEspera / dur) * 0.75;
    this.onProgreso?.(Math.min(1, frac));
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PASOS
  // ══════════════════════════════════════════════════════════════════════

  _irA(i) {
    this._restaurarEscala();
    this.i = i;
    const paso = this.pasos[i];

    // Opacidad objetivo por pieza: la del paso al 100 %, las demás en fantasma.
    // Un paso sin grupo (vista general) deja TODO el elemento a plena vista.
    const bAct = paso.grupo ? this._buckets.get(paso.grupo) : -1;
    for (let b = 0; b < this._nBuckets; b++) {
      this._destinos[b] = (bAct < 0 || b === bAct) ? 1 : FANTASMA;
    }
    // La pieza enfocada se dibuja por delante del fantasma (nunca queda tapada).
    for (const m of this._mallas) m.malla.renderOrder = (bAct >= 0 && m.b === bAct) ? 2 : m.baseRO;

    // Encuadre destino
    const { centro, mira, pos } = this._encuadre(paso);
    this._camIni.copy(this.camera.position);
    this._tgtIni.copy(this.controls.target);
    this._camFin.copy(pos);
    this._tgtFin.copy(mira);
    this._tTrans = 0;
    this._durTrans = paso.tTrans ?? T_TRANS;
    this._fase = 'transicion';
    this._tEspera = 0;
    this._tPop = T_POP;                         // el pop arranca al llegar
    this._usuarioMovio = false;
    this.controls.enabled = false;              // el vuelo manda mientras dura

    // Centro de la pieza en coordenadas del padre, para escalar sobre sí misma
    if (paso.grupo) {
      this._popCentro.copy(centro);
      paso.grupo.parent.worldToLocal(this._popCentro);
    }

    this._colocarMarcador(paso);
    this.onPaso?.(this.i, this.pasos.length, paso);
  }

  /**
   * Caja envolvente de la pieza + posición de cámara según los ángulos del paso.
   *
   * La distancia se calcula para que la ESFERA envolvente entre justa en el
   * encuadre (se toma el lado más restrictivo del frustum: vertical u
   * horizontal). Así `dist` es un simple factor de holgura —1 = ajustada, 1.5 =
   * con contexto alrededor— y funciona igual en una pieza alargada que en una
   * pequeña, sin retocar números al cambiar de pantalla.
   */
  _encuadre(paso) {
    const obj = paso.grupo || this.root;
    const caja = new THREE.Box3().setFromObject(obj);
    if (caja.isEmpty()) caja.setFromObject(this.root);

    const centro = caja.getCenter(new THREE.Vector3());
    const tam    = caja.getSize(new THREE.Vector3());
    const radio  = Math.max(tam.length() * 0.5, 0.12);

    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const dAjuste = radio / Math.sin(Math.min(fovV, fovH) / 2);

    const yaw   = THREE.MathUtils.degToRad(paso.yaw ?? 38);
    const pitch = THREE.MathUtils.degToRad(paso.pitch ?? 18);
    const d = Math.max(
      dAjuste * HOLGURA * (paso.dist ?? 0.95),
      radio + 0.15,                        // nunca con la cámara dentro de la pieza
      this.controls.minDistance + 0.05
    );

    // Se apunta un poco por DEBAJO del centro: la pieza queda en la mitad alta
    // del lienzo, despejada del panel de texto del recorrido.
    const mira = centro.clone();
    mira.y -= radio * SESGO_Y;

    const pos = new THREE.Vector3(
      mira.x + d * Math.cos(pitch) * Math.cos(yaw),
      mira.y + d * Math.sin(pitch),
      mira.z + d * Math.cos(pitch) * Math.sin(yaw)
    );
    return { centro, mira, pos };
  }

  /** Interpola la cámara en ARCO (esféricas) para que el vuelo rodee la pieza. */
  _volarCamara(u) {
    this._sphIni.setFromVector3(this._tmpA.subVectors(this._camIni, this._tgtIni));
    this._sphFin.setFromVector3(this._tmpB.subVectors(this._camFin, this._tgtFin));

    let dTheta = this._sphFin.theta - this._sphIni.theta;
    while (dTheta >  Math.PI) dTheta -= Math.PI * 2;   // siempre por el lado corto
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;

    this._sph.radius = THREE.MathUtils.lerp(this._sphIni.radius, this._sphFin.radius, u);
    this._sph.phi    = THREE.MathUtils.lerp(this._sphIni.phi,    this._sphFin.phi,    u);
    this._sph.theta  = this._sphIni.theta + dTheta * u;

    this.controls.target.lerpVectors(this._tgtIni, this._tgtFin, u);
    this.camera.position.copy(this.controls.target).add(this._tmpA.setFromSpherical(this._sph));
    this.camera.lookAt(this.controls.target);
  }

  /** Órbita lenta alrededor de la pieza mientras se lee el texto. */
  _orbitar(dt) {
    this._tmpA.subVectors(this.camera.position, this.controls.target);
    this._tmpA.applyAxisAngle(ARRIBA, dt * VEL_ORBITA);
    this.camera.position.copy(this.controls.target).add(this._tmpA);
    this.camera.lookAt(this.controls.target);
  }

  /** Escala la pieza sobre su propio centro (no la desplaza al terminar). */
  _aplicarPop(u) {
    const grupo = this.pasos[this.i].grupo;
    if (!grupo) return;
    const s = 0.90 + 0.10 * rebote(u);
    grupo.scale.setScalar(s);
    grupo.position.copy(this._popCentro).multiplyScalar(1 - s);
  }

  _restaurarEscala() {
    const grupo = this.pasos?.[this.i]?.grupo;
    if (!grupo) return;
    grupo.scale.set(1, 1, 1);
    grupo.position.set(0, 0, 0);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MATERIALES (clones temporales para poder atenuar pieza por pieza)
  // ══════════════════════════════════════════════════════════════════════

  _prepararMateriales() {
    this._registro = [];
    this._mallas = [];
    this._luces = [];
    this._buckets = new Map();

    let n = 1;                                   // bucket 0 = piezas sin subelemento
    for (const p of this.pasos) {
      if (p.grupo && !this._buckets.has(p.grupo)) this._buckets.set(p.grupo, n++);
    }
    this._nBuckets = n;
    this._mezclas  = new Float32Array(n).fill(1);
    this._destinos = new Float32Array(n).fill(1);

    const bucketDe = (obj) => {
      for (let p = obj; p; p = p.parent) {
        const b = this._buckets.get(p);
        if (b !== undefined) return b;
        if (p === this.root) break;
      }
      return 0;
    };

    const cache = new Map();                     // `${bucket}|${uuid}` -> clon
    this.root.traverse((o) => {
      if (o.isLight) { this._luces.push({ luz: o, base: o.intensity, b: bucketDe(o) }); return; }
      if (!o.material) return;

      const b = bucketDe(o);
      this._mallas.push({ malla: o, baseRO: o.renderOrder, b });

      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const clones = mats.map((m) => {
        const clave = `${b}|${m.uuid}`;
        let c = cache.get(clave);
        if (!c) {
          c = m.clone();
          // `transparent` queda FIJO en true durante todo el recorrido: alternarlo
          // por cuadro obligaría a recompilar el shader en cada fundido.
          c.transparent = true;
          if (m.onBeforeCompile) c.onBeforeCompile = m.onBeforeCompile;
          if (m.customProgramCacheKey) c.customProgramCacheKey = m.customProgramCacheKey;
          cache.set(clave, c);
          this._registro.push({ orig: m, clon: c, baseOp: m.opacity, baseDepth: m.depthWrite, b });
        }
        return c;
      });

      o.userData.__matRecorrido = o.material;
      o.material = Array.isArray(o.material) ? clones : clones[0];
    });
  }

  _aplicarMezclas() {
    for (const r of this._registro) {
      const mix = this._mezclas[r.b];
      const c = r.clon, o = r.orig;
      // El elemento puede animar sus propios materiales (semáforo, balizas):
      // se replican los cambios del original sobre el clon.
      if (c.color && o.color) c.color.copy(o.color);
      if (c.emissive && o.emissive) {
        c.emissive.copy(o.emissive);
        c.emissiveIntensity = o.emissiveIntensity;
      }
      c.opacity = r.baseOp * mix;
      // El fantasma no escribe profundidad: así se ve el interior a través del casco.
      c.depthWrite = mix > 0.9 ? r.baseDepth : false;
    }
    for (const l of this._luces) l.luz.intensity = l.base * (0.2 + 0.8 * this._mezclas[l.b]);
  }

  _restaurarMateriales() {
    this.root?.traverse((o) => {
      if (o.userData?.__matRecorrido) {
        o.material = o.userData.__matRecorrido;
        delete o.userData.__matRecorrido;
      }
    });
    for (const m of this._mallas) m.malla.renderOrder = m.baseRO;
    // Los clones no poseen sus texturas (las comparten con el original): al
    // liberarlos NO se toca ninguna textura viva.
    for (const r of this._registro) r.clon.dispose();
    for (const l of this._luces) l.luz.intensity = l.base;
    this._registro = [];
    this._mallas = [];
    this._luces = [];
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MARCADOR DE ESQUINAS
  // ══════════════════════════════════════════════════════════════════════

  _crearMarcador() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 2 * 3), 3));
    this._marcador = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.9, depthTest: false })
    );
    this._marcador.renderOrder = 999;
    this._marcador.frustumCulled = false;
    this._marcador.visible = false;
    this.scene.add(this._marcador);
  }

  /** Dibuja 8 escuadras (3 aristas cortas por vértice) sobre la caja de la pieza. */
  _colocarMarcador(paso) {
    if (!this._marcador) return;
    if (!paso.grupo) { this._marcador.visible = false; return; }

    const caja = new THREE.Box3().setFromObject(paso.grupo);
    if (caja.isEmpty()) { this._marcador.visible = false; return; }
    caja.expandByScalar(Math.max(caja.getSize(this._tmpA).length() * 0.012, 0.008));

    const min = caja.min, max = caja.max;
    const tam = caja.getSize(new THREE.Vector3());
    const lar = [
      Math.min(tam.x * 0.26, 0.42),
      Math.min(tam.y * 0.26, 0.42),
      Math.min(tam.z * 0.26, 0.42)
    ];
    const pos = this._marcador.geometry.attributes.position;
    let k = 0;
    const punto = (x, y, z) => { pos.setXYZ(k++, x, y, z); };

    for (const sx of [0, 1]) for (const sy of [0, 1]) for (const sz of [0, 1]) {
      const x = sx ? max.x : min.x;
      const y = sy ? max.y : min.y;
      const z = sz ? max.z : min.z;
      const dx = sx ? -lar[0] : lar[0];
      const dy = sy ? -lar[1] : lar[1];
      const dz = sz ? -lar[2] : lar[2];
      punto(x, y, z); punto(x + dx, y, z);
      punto(x, y, z); punto(x, y + dy, z);
      punto(x, y, z); punto(x, y, z + dz);
    }
    pos.needsUpdate = true;
    this._marcador.geometry.computeBoundingSphere();
    this._marcador.visible = true;
    this._marcador.scale.setScalar(1);
    this._tMarcador = 0;
  }

  _animarMarcador(dt) {
    if (!this._marcador?.visible) return;
    this._tMarcador += dt;
    // Aparece con un breve destello y luego late suavemente.
    const entrada = Math.min(1, this._tMarcador / 0.45);
    this._marcador.material.opacity =
      (0.35 + 0.30 * Math.sin(this._tMarcador * 2.6)) * suave(entrada) + 0.25 * suave(entrada);
  }

  _quitarMarcador() {
    if (!this._marcador) return;
    this.scene.remove(this._marcador);
    this._marcador.geometry.dispose();
    this._marcador.material.dispose();
    this._marcador = null;
  }
}
