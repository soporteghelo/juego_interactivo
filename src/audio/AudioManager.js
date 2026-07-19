import * as THREE from 'three';

/**
 * Gestor de audio de la mina — TODO SINTETIZADO con WebAudio (sin archivos), pero con
 * tratamiento realista:
 *
 *  - REVERB DE CAVERNA: bus de eco corto (2 delays cruzados con retroalimentacion filtrada)
 *    por el que pasan todos los one-shots (goteo, claxon, pasos). Es lo que hace que un
 *    sonido "suene a socavon" en vez de a laboratorio.
 *  - VENTILACION VIVA: rumor grave del circuito de ventilacion + capa de "aire en manga"
 *    con vaivenes lentos (LFOs) — deja de ser un ruido plano constante.
 *  - GOTEO real: "ploc" resonante con caida de tono, panorama aleatorio y cola de reverb
 *    (goteras repartidas por la labor, no siempre en el centro de la cabeza).
 *  - CLAXON bitonal industrial ESPACIALIZADO: atenua con la distancia real del vehiculo
 *    que lo toca y panea segun su direccion respecto de la camara.
 *  - PASOS del jugador: pisadas sobre terreno humedo (rafaga filtrada + golpe sordo),
 *    cadencia segun velocidad de marcha, alternando levemente izquierda/derecha.
 *  - MOTOR DIESEL del vehiculo MAS CERCANO: ralenti grave + rodadura que crecen al
 *    acercarse (pitch segun su velocidad real) y panean al pasar. Un solo emisor
 *    persistente (barato); el pool multi-fuente llegara con el WorkSiteSystem.
 *
 * Politica de autoplay: nada suena hasta resume() (gesto del usuario).
 */
export class AudioManager {
  constructor({ camera, settings, bus }) {
    this.camera = camera;
    this.settings = settings;
    this.bus = bus;

    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;

    this._started = false;
    this._dripTimer = 0;

    // Vehiculos para el motor diesel de proximidad (set via setVehicles).
    this._vehicles = [];
    this._dieselAccum = 0;

    // Pasos: velocidad del jugador estimada de los eventos 'player:moved' (tag pie:true).
    this._stepTimer = 0;
    this._stepSide = 1;
    this._pSpeed = 0;
    this._pPrev = null;
    this._pPrevT = 0;

    // Scratch de matematica de camara (posicion + eje derecho para el paneo).
    this._camPos = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._toSrc = new THREE.Vector3();

    this.bus.on('audio:horn', (e) => this._horn(e?.position));
    this.bus.on('audio:reverseBeep', (e) => this._reverseBeep(e?.position));
    this.bus.on('player:moved', (e) => this._onPlayerMoved(e));

    // Equipo conducido por el jugador: su motor esta ENCENDIDO aunque este detenido.
    this._driven = null;
    this.bus.on('drive:enter', (e) => { this._driven = e?.mesh || null; });
    this.bus.on('drive:exit', () => { this._driven = null; });

    // Emisores de LABOR (uno por perfil, creados perezosamente): percusion, hiss, bomba.
    this._workEmitters = {};
  }

  /** Vehiculos cuyo motor debe oirse al acercarse (meshes con userData._speed). */
  setVehicles(meshes) { this._vehicles = meshes || []; }

  /** Debe llamarse tras un gesto del usuario (politica de autoplay). */
  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._started || !this.settings.audioEnabled) return;
    this._started = true;
    this._buildVerb();
    this._startVentilation();
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  /** Buffer de ruido blanco COMPARTIDO (una sola asignacion de memoria). */
  _noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, 2 * ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buffer;
    return buffer;
  }

  /**
   * Distancia y paneo de una posicion de mundo respecto de la camara.
   * @returns {{d:number, pan:number}}
   */
  _spatial(position) {
    this._camPos.setFromMatrixPosition(this.camera.matrixWorld);
    const e = this.camera.matrixWorld.elements;
    this._camRight.set(e[0], e[1], e[2]).normalize();       // columna X = eje derecho
    this._toSrc.copy(position).sub(this._camPos);
    const d = this._toSrc.length();
    const pan = d > 1e-3
      ? THREE.MathUtils.clamp(this._toSrc.divideScalar(d).dot(this._camRight), -1, 1) * 0.8
      : 0;
    return { d, pan };
  }

  /**
   * REVERB DE CAVERNA: dos lineas de retardo con retroalimentacion filtrada (paso-bajo en el
   * lazo = la roca absorbe los agudos en cada rebote). Entrada: this._verb. Barata y estable.
   */
  _buildVerb() {
    const ctx = this.ctx;
    this._verb = ctx.createGain();
    this._verb.gain.value = 1.0;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    for (const t of [0.131, 0.211]) {
      const d = ctx.createDelay(0.5); d.delayTime.value = t;
      const fb = ctx.createGain(); fb.gain.value = 0.34;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      this._verb.connect(d);
      d.connect(lp).connect(fb).connect(d);   // lazo de eco
      d.connect(wet);
    }
    wet.connect(this.listener.gain);
  }

  /** Conecta un nodo al master con una porcion `send` hacia el reverb de caverna. */
  _out(node, send = 0.6) {
    node.connect(this.listener.gain);
    if (this._verb && send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(this._verb);
    }
  }

  // ── Ambiente continuo ──────────────────────────────────────────────────────

  /**
   * Ventilacion VIVA: rumor grave (ruido marron) + capa de "aire en manga" (banda media),
   * ambos con vaivenes lentos e independientes → el aire "respira" en vez de zumbar plano.
   */
  _startVentilation() {
    const ctx = this.ctx;
    // Ruido marron (rumor del circuito de ventilacion principal)
    const buffer = ctx.createBuffer(1, 2 * ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const gRumble = ctx.createGain(); gRumble.gain.value = 0.15;
    src.connect(lp).connect(gRumble).connect(this.listener.gain);
    src.start();

    // Capa de FLUJO DE AIRE (shhh de la manga): mismo ruido por una banda media suave.
    const src2 = ctx.createBufferSource();
    src2.buffer = this._noiseBuffer(); src2.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 760; bp.Q.value = 0.6;
    const gAir = ctx.createGain(); gAir.gain.value = 0.028;
    src2.connect(bp).connect(gAir).connect(this.listener.gain);
    src2.start();

    // Vaivenes lentos (rachas): LFOs sobre las ganancias, fases/frecuencias distintas.
    const lfo1 = ctx.createOscillator(); lfo1.frequency.value = 0.07;
    const lfo1G = ctx.createGain(); lfo1G.gain.value = 0.035;
    lfo1.connect(lfo1G).connect(gRumble.gain); lfo1.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.16;
    const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.012;
    lfo2.connect(lfo2G).connect(gAir.gain); lfo2.start();

    this._vent = { src, src2 };
  }

  // ── One-shots ──────────────────────────────────────────────────────────────

  /**
   * Claxon bitonal industrial (dos armonicos desafinados, como una bocina neumatica real),
   * ESPACIALIZADO: mas lejos = mas bajo y mas "ahogado"; panea hacia el lado del vehiculo.
   */
  _horn(position = null) {
    if (!this._started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    let vol = 0.4, pan = 0, dist = 0;
    if (position) {
      const s = this._spatial(position);
      if (s.d > 55) return;                       // fuera de alcance audible
      vol = Math.pow(1 - Math.min(1, s.d / 55), 1.5) * 0.55;
      pan = s.pan;
      dist = s.d;
    }

    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    // Mas lejos = mas "ahogado" (la roca absorbe los agudos): paso-bajo segun distancia.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 2400 - 30 * dist;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.03);
    env.gain.setValueAtTime(vol, t + 0.42);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    env.connect(lp).connect(panner);
    this._out(panner, 0.8);

    // Dos tonos (bitonal ~285/357 Hz) con vibrato leve — bocina neumatica de camion.
    for (const [f, gv] of [[285, 0.55], [357, 0.45]]) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.985, t + 0.5);
      const og = ctx.createGain(); og.gain.value = gv;
      osc.connect(og).connect(env);
      osc.start(t); osc.stop(t + 0.6);
    }
  }

  /**
   * Alarma de RETROCESO: beep agudo espacializado (lo emite DriveController cada segundo
   * mientras el equipo conducido retrocede).
   */
  _reverseBeep(position = null) {
    if (!this._started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    let vol = 0.16, pan = 0;
    if (position) {
      const s = this._spatial(position);
      if (s.d > 45) return;
      vol = Math.pow(1 - Math.min(1, s.d / 45), 1.4) * 0.2;
      pan = s.pan;
    }
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1250;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + 0.22);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g).connect(panner);
    this._out(panner, 0.7);
    osc.start(t); osc.stop(t + 0.32);
  }

  /**
   * Goteo espacializado disparado por el DripSystem al IMPACTAR una gota visible: sincroniza
   * audio+visual (se ve caer la gota y el "ploc" suena en su posicion). `position` opcional.
   */
  drip(position = null) { if (this._started) this._drip(position); }

  /**
   * Goteo real: "ploc" resonante con caida rapida de tono + chasquido inicial y cola de caverna.
   * Con `position` (gota VISIBLE del DripSystem) panea/atenua segun la camara; sin ella (gotera
   * AMBIENTE) usa panorama aleatorio.
   */
  _drip(position = null) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    let vol = 0.05 + Math.random() * 0.08;
    if (position) {
      const s = this._spatial(position);
      if (s.d > 34) return;                        // fuera de alcance audible
      pan.pan.value = s.pan;
      vol *= 1 - Math.min(1, s.d / 34) * 0.6;      // mas lejos, mas suave
    } else {
      pan.pan.value = (Math.random() * 2 - 1) * 0.85;
    }

    // Cuerpo del "ploc": seno con caida de tono (gota sobre charco).
    const f0 = 700 + Math.random() * 500;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(pan);
    osc.start(t); osc.stop(t + 0.2);

    // Chasquido inicial (impacto): rafaga muy corta de ruido agudo.
    const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuffer();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    nz.connect(hp).connect(ng).connect(pan);
    nz.start(t); nz.stop(t + 0.05);

    this._out(pan, 1.6);   // gotera = casi puro eco de caverna
  }

  /** Pisada sobre terreno humedo: rafaga grave filtrada + golpe sordo del taco de la bota. */
  _step(speed) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this._stepSide *= -1;
    const pan = ctx.createStereoPanner();
    pan.pan.value = this._stepSide * 0.13;
    const vol = Math.min(0.11, 0.045 + speed * 0.012) * (0.85 + Math.random() * 0.3);

    // Rafaga de pisada (grava/barro humedo)
    const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuffer();
    nz.playbackRate.value = 0.8 + Math.random() * 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 520 + Math.random() * 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    nz.connect(lp).connect(g).connect(pan);
    nz.start(t); nz.stop(t + 0.12);

    // Golpe sordo (peso del cuerpo)
    const th = ctx.createOscillator();
    th.frequency.setValueAtTime(95, t);
    th.frequency.exponentialRampToValueAtTime(55, t + 0.05);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(vol * 0.6, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    th.connect(tg).connect(pan);
    th.start(t); th.stop(t + 0.08);

    this._out(pan, 0.35);
  }

  /** Estima la velocidad de MARCHA del jugador (solo eventos a pie, tag `pie`). */
  _onPlayerMoved(e) {
    if (!e?.pie || !e.position) return;
    const now = performance.now() / 1000;
    if (this._pPrev) {
      const dtE = Math.max(0.02, now - this._pPrevT);
      const d = e.position.distanceTo(this._pPrev);
      const v = d / dtE;
      // Suavizado + descarte de teletransportes (respawn/desmontaje del scoop).
      this._pSpeed = v > 12 ? 0 : this._pSpeed * 0.6 + v * 0.4;
    }
    this._pPrev = e.position;
    this._pPrevT = now;
  }

  // ── Motor diesel de proximidad (persistente, un solo emisor) ───────────────

  _ensureDiesel() {
    if (this._diesel) return this._diesel;
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    out.connect(panner);
    this._out(panner, 0.5);

    // Ralenti diesel: dos sierras graves desafinadas (batido de cilindros) filtradas.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    lp.connect(out);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 111;
    const g1 = ctx.createGain(); g1.gain.value = 0.55;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o1.connect(g1).connect(lp); o2.connect(g2).connect(lp);
    o1.start(); o2.start();

    // Rodadura sobre el piso de la labor (ruido grave que crece con la velocidad).
    const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuffer(); nz.loop = true;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 420;
    const ng = ctx.createGain(); ng.gain.value = 0;
    nz.connect(nlp).connect(ng).connect(out);
    nz.start();

    this._diesel = { out, panner, o1, o2, ng };
    return this._diesel;
  }

  /** Acerca el emisor diesel al vehiculo AUDIBLE mas cercano (ganancia/pitch/pan a 10 Hz). */
  _updateDiesel() {
    if (!this._vehicles.length && !this._driven) return;
    let best = null, bestD = Infinity;
    this._camPos.setFromMatrixPosition(this.camera.matrixWorld);
    const considerar = (m) => {
      const d = m.position.distanceTo(this._camPos);
      if (d < bestD) { bestD = d; best = m; }
    };
    // Flota: siempre en marcha. Otros equipos: solo si se MUEVEN (motor bajo carga) —
    // un scoop estacionado con motor apagado no debe zumbar.
    for (const m of this._vehicles) considerar(m);
    if (this._driven) considerar(this._driven);   // conducido: motor encendido aun detenido
    const RANGO = 34;
    const dz = this._ensureDiesel();
    const t = this.ctx.currentTime;
    if (!best || bestD > RANGO) {
      dz.out.gain.setTargetAtTime(0, t, 0.15);
      return;
    }
    const s = this._spatial(best.position);
    const prox = Math.pow(1 - Math.min(1, s.d / RANGO), 1.7);
    const vel = Math.abs(best.userData._speed || 0);
    dz.out.gain.setTargetAtTime(prox * 0.34, t, 0.12);
    dz.panner.pan.setTargetAtTime(s.pan, t, 0.12);
    // Regimen del motor segun velocidad real (ralenti ~52 Hz → carga ~86 Hz).
    const f = 52 + vel * 8;
    dz.o1.frequency.setTargetAtTime(f, t, 0.2);
    dz.o2.frequency.setTargetAtTime(f * 2.02, t, 0.2);
    dz.ng.gain.setTargetAtTime(Math.min(0.5, vel * 0.09) * prox, t, 0.15);
  }

  // ── Emisores de LABOR (WorkSiteSystem) ─────────────────────────────────────

  /**
   * Enciende/posiciona (o apaga) el emisor sintetizado de un perfil de labor. Un emisor por
   * perfil (percusion/hiss/bomba): el WorkSiteSystem elige la labor MAS CERCANA de cada tipo.
   * @param {'percusion'|'hiss'|'bomba'} profile
   * @param {THREE.Vector3|null} position  posicion mundo de la labor (null u off → silencio)
   * @param {boolean} on
   */
  setWorkEmitter(profile, position, on) {
    if (!this._started) return;
    let e = this._workEmitters[profile];
    if (on && position && !e) e = this._workEmitters[profile] = this._makeWorkEmitter(profile);
    if (!e) return;
    const t = this.ctx.currentTime;
    if (!on || !position) { e.gain.gain.setTargetAtTime(0, t, 0.2); return; }
    const s = this._spatial(position);
    if (s.d > e.rango) { e.gain.gain.setTargetAtTime(0, t, 0.2); return; }
    const prox = Math.pow(1 - Math.min(1, s.d / e.rango), 1.6);
    e.gain.gain.setTargetAtTime(prox * e.vol, t, 0.12);
    e.panner.pan.setTargetAtTime(s.pan, t, 0.12);
  }

  /** Construye el grafo WebAudio de un perfil de labor (un buffer de ruido compartido). */
  _makeWorkEmitter(profile) {
    const ctx = this.ctx;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const panner = ctx.createStereoPanner();
    gain.connect(panner);
    this._out(panner, 0.45);
    let rango = 30, vol = 0.5;

    if (profile === 'percusion') {
      // Barreno percutiendo: ruido bandpass PULSADO por un LFO cuadrado + golpe grave.
      const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuffer(); nz.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
      const amp = ctx.createGain(); amp.gain.value = 0.0;
      nz.connect(bp).connect(amp).connect(gain);
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 8.5;
      const lg = ctx.createGain(); lg.gain.value = 0.5;
      const bias = ctx.createConstantSource(); bias.offset.value = 0.5;
      lfo.connect(lg).connect(amp.gain); bias.connect(amp.gain);
      const low = ctx.createOscillator(); low.type = 'sawtooth'; low.frequency.value = 68;
      const lowg = ctx.createGain(); lowg.gain.value = 0.12;
      low.connect(lowg).connect(gain);
      nz.start(); lfo.start(); bias.start(); low.start();
      rango = 30; vol = 0.5;
    } else if (profile === 'hiss') {
      // Shotcrete: siseo de aire/concreto con tremolo lento (barrido de la boquilla).
      const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuffer(); nz.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
      const trem = ctx.createGain(); trem.gain.value = 0.6;
      nz.connect(hp).connect(trem).connect(gain);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 1.6;
      const lg = ctx.createGain(); lg.gain.value = 0.35;
      const bias = ctx.createConstantSource(); bias.offset.value = 0.6;
      lfo.connect(lg).connect(trem.gain); bias.connect(trem.gain);
      nz.start(); lfo.start(); bias.start();
      rango = 28; vol = 0.32;
    } else { // bomba (sala de bombeo)
      const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuffer(); nz.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 180; bp.Q.value = 2.2;
      nz.connect(bp).connect(gain);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 3.2;   // wobble del motor
      const lg = ctx.createGain(); lg.gain.value = 55;
      lfo.connect(lg).connect(bp.frequency);
      const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60;
      const hg = ctx.createGain(); hg.gain.value = 0.06;
      hum.connect(hg).connect(gain);
      nz.start(); lfo.start(); hum.start();
      rango = 24; vol = 0.32;
    }
    return { gain, panner, rango, vol };
  }

  // ── Bucle ──────────────────────────────────────────────────────────────────

  update(dt) {
    if (!this._started) return;

    // Goteras AMBIENTE (cadencia lenta): fallback cuando no hay goteo VISIBLE cerca (lejos del
    // jugador o con particleDensity ~0). Las goteras visibles las dispara el DripSystem via drip().
    this._dripTimer -= dt;
    if (this._dripTimer <= 0) {
      this._drip();
      this._dripTimer = 6 + Math.random() * 8;
    }

    // Pasos: cadencia segun velocidad de marcha (zancada ~1.6 m caminando).
    if (this._pSpeed > 0.5) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        this._step(this._pSpeed);
        this._stepTimer = THREE.MathUtils.clamp(1.15 / this._pSpeed, 0.26, 0.7);
      }
    } else {
      this._stepTimer = 0.05;   // primer paso suena apenas arranca la marcha
    }
    this._pSpeed *= Math.pow(0.5, dt / 0.4);   // decae si dejan de llegar eventos

    // Motor diesel del vehiculo mas cercano (refresco barato a ~10 Hz).
    this._dieselAccum += dt;
    if (this._dieselAccum >= 0.1) {
      this._dieselAccum = 0;
      this._updateDiesel();
    }
  }
}
