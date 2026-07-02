import { Settings } from '../core/Settings.js';
import { Device } from '../core/Device.js';

const BRIGHTNESS_STEP  = 0.1;
const BRIGHTNESS_HIDE_MS = 2200;

/**
 * HUD: capa de interfaz en pantalla (DOM sobre el canvas).
 *  - Crosshair central.
 *  - Prompt de interaccion ("[E] Leer senal" / "Interactuar").
 *  - Panel de lectura (senales, tableros, procedimientos) via evento 'ui:read'.
 *  - Contador de FPS + preset de calidad.
 *  - Aviso de rotacion en celular en vertical.
 *  - Indicador de nivel de linterna (F key / 4 estados).
 *  - Flash de herida (cortadura por malla sobresalida — no fatal).
 *
 * Escucha el EventBus; no conoce la logica de juego (desacople).
 */
export class HUD {
  constructor({ bus, container }) {
    this.bus = bus;
    this.root = container;
    this._frames = 0;
    this._fpsTimer = 0;
    this._hurtTimer = null;
    this._brightnessTimer = null;
    this._brightnessEnabled = false;

    this._build();

    this.bus.on('engine:begin', () => { this._brightnessEnabled = true; });
    this.bus.on('ui:prompt',              (label) => this._setPrompt(label));
    this.bus.on('ui:read',                (data)  => this._openReader(data));
    this.bus.on('hazard:warn',            (msg)   => this._setWarning(msg));
    this.bus.on('hazard:zona',            (msg)   => this._setZona(msg));
    this.bus.on('player:death',           (data)  => this._showDeath(data));
    this.bus.on('player:hurt',            (data)  => this._showHurt(data));
    this.bus.on('headlamp:changed',       (data)  => this._updateLamp(data));
    this.bus.on('mission:started',        (data)  => this._missionStart(data));
    this.bus.on('mission:objectiveComplete', (data) => this._missionProgress(data));
  }

  _build() {
    // Crosshair
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'hud-crosshair';
    this.root.appendChild(this.crosshair);

    // Stats (FPS + calidad)
    this.stats = document.createElement('div');
    this.stats.className = 'hud-stats';
    this.root.appendChild(this.stats);

    // Prompt de interaccion
    this.prompt = document.createElement('div');
    this.prompt.className = 'hud-prompt';
    this.root.appendChild(this.prompt);

    // Panel de lectura
    this.reader = document.createElement('div');
    this.reader.className = 'hud-reader';
    this.reader.innerHTML = `
      <div class="reader-card">
        <h2></h2>
        <p></p>
        <button class="reader-close">Cerrar</button>
      </div>`;
    this.root.appendChild(this.reader);
    this.reader.querySelector('.reader-close').addEventListener('click', () => this._closeReader());
    this.reader.addEventListener('click', (e) => { if (e.target === this.reader) this._closeReader(); });

    // Banner de ADVERTENCIA de peligro (proximidad)
    this.warning = document.createElement('div');
    this.warning.className = 'hud-warning';
    this.root.appendChild(this.warning);

    // Banner ZONA PROHIBIDA (ambar constante — sin kill, solo aviso de area restringida)
    this.zonaMsg = document.createElement('div');
    this.zonaMsg.className = 'hud-zona';
    this.root.appendChild(this.zonaMsg);

    // Flash de HERIDA (no fatal — cortadura por malla, etc.)
    this.hurtOverlay = document.createElement('div');
    this.hurtOverlay.className = 'hud-hurt';
    this.root.appendChild(this.hurtOverlay);

    this.hurtMsg = document.createElement('div');
    this.hurtMsg.className = 'hud-hurt-msg';
    this.root.appendChild(this.hurtMsg);

    // Indicador de linterna (esquina inferior derecha)
    this.lampIndicator = document.createElement('div');
    this.lampIndicator.className = 'hud-lamp lamp-l3';
    this.lampIndicator.textContent = 'LAMP L3';
    this.root.appendChild(this.lampIndicator);

    // Pantalla de MUERTE + reflexion + reinicio
    this.death = document.createElement('div');
    this.death.className = 'hud-death';
    this.death.innerHTML = `
      <div class="death-card">
        <h1>HAS FALLECIDO</h1>
        <p class="death-sub">Acto inseguro fatal</p>
        <p class="death-reflexion"></p>
        <p class="death-count"></p>
        <button class="death-restart">REINICIAR</button>
      </div>`;
    this.root.appendChild(this.death);
    this.death.querySelector('.death-restart').addEventListener('click', () => location.reload());

    // Panel de MISION activa (objetivos de induccion / simulacro)
    this.mission = document.createElement('div');
    this.mission.className = 'hud-mission';
    this.root.appendChild(this.mission);
    this._missionObjs = new Map(); // id → {el, done}

    // Aviso de rotacion (celular)
    this.orient = document.createElement('div');
    this.orient.className = 'orientation-hint';
    this.orient.textContent = 'Gira el dispositivo a horizontal para una mejor experiencia.';
    if (Device.isTouch) this.orient.classList.add('enabled');
    this.root.appendChild(this.orient);

    // Panel de LUMINOSIDAD (aparece al pulsar [ o ])
    this.brightnessPanel = document.createElement('div');
    this.brightnessPanel.className = 'hud-brightness';
    this.root.appendChild(this.brightnessPanel);
    this._buildBrightnessPanel();
  }

  _setPrompt(label) {
    if (!label) {
      this.prompt.classList.remove('visible');
      return;
    }
    const keyHint = Settings.controlScheme === 'touch'
      ? ''
      : '<span class="key">E</span>';
    this.prompt.innerHTML = `${keyHint}${label}`;
    this.prompt.classList.add('visible');
  }

  _openReader({ title, body }) {
    this.reader.querySelector('h2').textContent = title || 'Informacion';
    this.reader.querySelector('p').textContent = body || '';
    this.reader.classList.add('visible');
  }

  _closeReader() {
    this.reader.classList.remove('visible');
  }

  _setWarning(msg) {
    if (!msg) { this.warning.classList.remove('visible'); return; }
    this.warning.textContent = '⚠ ' + msg;
    this.warning.classList.add('visible');
  }

  /** Herida no fatal: flash rojo en pantalla + mensaje segun el tipo de lesion por ~3 s. */
  _showHurt({ reflexion, tipo } = {}) {
    // Flash inmediato
    this.hurtOverlay.classList.remove('visible');
    void this.hurtOverlay.offsetWidth; // reflow para reiniciar la animacion
    this.hurtOverlay.classList.add('visible');

    // El titulo del aviso depende del origen de la lesion:
    //  - atropello / equipoPesado -> GOLPE (contacto con equipo en movimiento, no fatal)
    //  - resto (malla, pernos)     -> CORTADURA
    const esGolpe = tipo === 'atropello' || tipo === 'equipoPesado';
    const titulo  = esGolpe ? 'GOLPE' : 'CORTADURA';
    const fallback = esGolpe ? 'Fuiste golpeado por un equipo en movimiento.' : 'Rozaste una malla sobresalida.';

    this.hurtMsg.textContent = titulo + ' — ' + (reflexion ? reflexion.split('.')[0] + '.' : fallback);
    this.hurtMsg.classList.add('visible');

    if (this._hurtTimer) clearTimeout(this._hurtTimer);
    this._hurtTimer = setTimeout(() => {
      this.hurtOverlay.classList.remove('visible');
      this.hurtMsg.classList.remove('visible');
      this._hurtTimer = null;
    }, 2800);
  }

  /** Actualiza el indicador de nivel de linterna. */
  _updateLamp({ level, label }) {
    this.lampIndicator.className = 'hud-lamp';
    if (level === 0) {
      this.lampIndicator.classList.add('lamp-off');
      this.lampIndicator.textContent = 'LAMP OFF';
    } else {
      this.lampIndicator.classList.add(`lamp-${label.toLowerCase()}`);
      this.lampIndicator.textContent = `LAMP ${label}`;
    }
  }

  /** Muestra los objetivos de la mision recien iniciada. */
  _missionStart({ title, objectives = [] } = {}) {
    this.mission.innerHTML = '';
    this._missionObjs.clear();
    const titleEl = document.createElement('div');
    titleEl.className = 'mission-title';
    titleEl.textContent = title || 'MISION';
    this.mission.appendChild(titleEl);
    for (const obj of objectives) {
      const el = document.createElement('div');
      el.className = 'mission-obj';
      el.textContent = obj.text || obj.id;
      this.mission.appendChild(el);
      this._missionObjs.set(obj.id, el);
    }
    this.mission.classList.add('visible');
  }

  /** Marca un objetivo como completado. */
  _missionProgress({ id } = {}) {
    const el = this._missionObjs.get(id);
    if (el) el.classList.add('done');
  }

  /** Zona prohibida: banner ambar constante mientras el jugador esta dentro del area. */
  _setZona(msg) {
    if (!msg) { this.zonaMsg.classList.remove('visible'); return; }
    this.zonaMsg.innerHTML = '⛔ ZONA PROHIBIDA &nbsp;|&nbsp; ' + msg;
    this.zonaMsg.classList.add('visible');
  }

  _showDeath({ reflexion } = {}) {
    this._setWarning(null);
    this.death.querySelector('.death-reflexion').textContent = reflexion || '';
    this.death.classList.add('visible');

    let n = 8;
    const countEl = this.death.querySelector('.death-count');
    const tick = () => {
      countEl.textContent = `El juego se reiniciara en ${n}s…`;
      if (n <= 0) { location.reload(); return; }
      n--;
      this._deathTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  // ── LUMINOSIDAD ────────────────────────────────────────────────────────────

  _buildBrightnessPanel() {
    // [ y ] aumentan/disminuyen la luminosidad. Solo activos durante el juego.
    window.addEventListener('keydown', (e) => {
      if (!this._brightnessEnabled) return;
      if (e.code === 'BracketLeft')  this._changeBrightness(-BRIGHTNESS_STEP);
      if (e.code === 'BracketRight') this._changeBrightness(+BRIGHTNESS_STEP);
    });
    this._refreshBrightnessPanel();
  }

  _changeBrightness(delta) {
    Settings.setBrightness(Settings.brightness + delta);
    this._refreshBrightnessPanel();
    // Muestra el panel brevemente y reinicia el temporizador de ocultado.
    this.brightnessPanel.classList.add('visible');
    if (this._brightnessTimer) clearTimeout(this._brightnessTimer);
    this._brightnessTimer = setTimeout(() => {
      this.brightnessPanel.classList.remove('visible');
      this._brightnessTimer = null;
    }, BRIGHTNESS_HIDE_MS);
  }

  _refreshBrightnessPanel() {
    const pct    = Math.round(Settings.brightness * 100);
    const SEGS   = 10;
    // 10 segmentos: rango 0→200% → cada segmento = 20%. Marcador central = 5 segs (100%).
    const filled = Math.max(0, Math.min(SEGS, Math.round(pct / 20)));
    const atDefault = Settings.brightness === 1.0;

    const hint = Device.isTouch ? '' : '<span class="brightness-hint">[ / ]</span>';
    const bars = Array.from({ length: SEGS }, (_, i) => {
      const cls = i < filled ? (atDefault ? 'bar-on bar-default' : 'bar-on') : 'bar-off';
      return `<span class="${cls}"></span>`;
    }).join('');

    this.brightnessPanel.innerHTML =
      `<span class="brightness-label">LUZ MINA</span>` +
      `<div class="brightness-bar">${bars}</div>` +
      `<span class="brightness-pct">${pct}%</span>` +
      hint;
  }

  update(dt) {
    this._frames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      const fps = Math.round(this._frames / this._fpsTimer);
      this.stats.textContent = `FPS ${fps} · Calidad ${Settings.current.label} · ${Settings.controlScheme}`;
      this._frames = 0;
      this._fpsTimer = 0;
    }
  }
}
