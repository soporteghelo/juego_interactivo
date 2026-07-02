import * as THREE from 'three';

/**
 * Gestor de audio espacial.
 *
 * Usa THREE.AudioListener montado en la camara. Como en esta entrega NO hay archivos de
 * audio, los ambientes se SINTETIZAN proceduralmente con WebAudio (ruido filtrado para la
 * ventilacion, goteo de agua), cumpliendo el requisito de placeholders sin assets.
 *
 * Expone playSpatial(buffer/positions...) como punto de extension para sonidos reales:
 * pasos, maquinaria, agua, alarmas, etc. (cargados via AssetLoader + PositionalAudio).
 */
export class AudioManager {
  constructor({ camera, settings, bus }) {
    this.settings = settings;
    this.bus = bus;

    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;

    this._started = false;
    this._dripTimer = 0;

    this.bus.on('audio:horn', () => this._horn());
  }

  /** Debe llamarse tras un gesto del usuario (politica de autoplay). */
  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._started || !this.settings.audioEnabled) return;
    this._started = true;
    this._startVentilation();
  }

  /** Zumbido continuo de ventilacion: ruido marron filtrado a bajo volumen. */
  _startVentilation() {
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // ruido marron (low-rumble)
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;

    const gain = ctx.createGain();
    gain.gain.value = 0.18;

    src.connect(filter).connect(gain).connect(this.listener.gain);
    src.start();
    this._vent = { src, gain };
  }

  /** Claxon de equipo pesado: bocina grave + beep agudo en secuencia rapida. */
  _horn() {
    if (!this._started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Tono grave de bocina (170 Hz, 0.25 s)
    const osc1 = ctx.createOscillator();
    const g1   = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(170, t);
    osc1.frequency.exponentialRampToValueAtTime(155, t + 0.25);
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.linearRampToValueAtTime(0.35, t + 0.02);
    g1.gain.setValueAtTime(0.35, t + 0.20);
    g1.gain.linearRampToValueAtTime(0.0001, t + 0.28);
    osc1.connect(g1).connect(this.listener.gain);
    osc1.start(t); osc1.stop(t + 0.30);

    // Beep de advertencia (440 Hz, corto, despues del grave)
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(440, t + 0.32);
    g2.gain.setValueAtTime(0.0001, t + 0.32);
    g2.gain.linearRampToValueAtTime(0.18, t + 0.34);
    g2.gain.setValueAtTime(0.18, t + 0.44);
    g2.gain.linearRampToValueAtTime(0.0001, t + 0.48);
    osc2.connect(g2).connect(this.listener.gain);
    osc2.start(t + 0.32); osc2.stop(t + 0.50);
  }

  /** Goteo de agua ocasional (oscilador corto con caida exponencial). */
  _drip() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(900 + Math.random() * 400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(this.listener.gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  update(dt) {
    if (!this._started) return;
    this._dripTimer -= dt;
    if (this._dripTimer <= 0) {
      this._drip();
      this._dripTimer = 2 + Math.random() * 5; // goteo cada 2-7s
    }
  }
}
