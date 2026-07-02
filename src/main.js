import { Engine } from './core/Engine.js';
import { Settings, QUALITY_PRESETS, NIVELES_INSEGURIDAD } from './core/Settings.js';
import { Device } from './core/Device.js';

/**
 * Punto de entrada del simulador.
 *
 * Flujo:
 *  1. Crea el Engine (renderer/escena/camara sincronos).
 *  2. Muestra el MENU DE CONFIGURACION (nivel de condiciones inseguras + calidad).
 *  3. Al pulsar INGRESAR: aplica la config, construye el mundo (init asincrono) y arranca.
 *
 * La config debe aplicarse ANTES de init() porque el mundo procedural se genera ahi
 * (el nivel de inseguridad cambia el desorden/peligros del entorno).
 */
function construirChips(contenedor, opciones, seleccionInicial, onSelect) {
  let seleccion = seleccionInicial;
  const chips = new Map();
  for (const [key, label] of opciones) {
    const chip = document.createElement('div');
    chip.className = 'cfg-chip' + (key === seleccion ? ' activo' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      seleccion = key;
      chips.forEach((c, k) => c.classList.toggle('activo', k === key));
      onSelect(key);
    });
    chips.set(key, chip);
    contenedor.appendChild(chip);
  }
  onSelect(seleccion);
}

async function bootstrap() {
  const container = document.getElementById('app');
  const bootScreen = document.getElementById('boot-screen');
  const bootStatus = document.getElementById('boot-status');
  const startBtn = document.getElementById('boot-start');

  const engine = new Engine(container);
  window.__mina = engine;

  // --- Chips: nivel de condiciones inseguras ---
  construirChips(
    document.getElementById('cfg-inseguridad'),
    Object.entries(NIVELES_INSEGURIDAD).map(([k, v]) => [k, v.label]),
    'medio',
    (key) => Settings.setUnsafeLevel(key)
  );

  // --- Chips: calidad grafica (preseleccion segun el dispositivo) ---
  construirChips(
    document.getElementById('cfg-calidad'),
    Object.entries(QUALITY_PRESETS).map(([k, v]) => [k, v.label]),
    Device.recommendedQuality,
    (key) => Settings.setQuality(key)
  );

  let iniciando = false;
  startBtn.addEventListener('click', async () => {
    if (iniciando) return;
    iniciando = true;
    startBtn.disabled = true;
    document.querySelector('.config').style.display = 'none';

    try {
      await engine.init((msg) => { bootStatus.textContent = msg; });
    } catch (err) {
      bootStatus.textContent = 'Error al iniciar: ' + (err?.message || err);
      console.error(err);
      return;
    }

    // Pantalla completa + horizontal en celular (best-effort).
    if (engine.input.controlScheme === 'touch') {
      try { await document.documentElement.requestFullscreen?.(); } catch { /* ignorado */ }
      try { await screen.orientation?.lock?.('landscape'); } catch { /* ignorado */ }
    }

    engine.begin();
    bootScreen.classList.add('hidden');
  });
}

bootstrap();
