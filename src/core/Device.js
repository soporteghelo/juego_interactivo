/**
 * Deteccion de dispositivo y eleccion del esquema de control + preset de calidad.
 *
 * Decide si el jugador esta en celular/tablet (controles tactiles) o en escritorio
 * (teclado/raton), y recomienda un preset de calidad inicial razonable. El usuario
 * puede sobreescribirlo despues desde el HUD.
 */

/** True si el dispositivo principal es tactil de baja precision (dedo). */
function detectTouch() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return Boolean(coarse && hasTouch);
}

/** Heuristica de movil por userAgent (respaldo del media query). */
function detectMobileUA() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

/**
 * Inspecciona la GPU via WEBGL_debug_renderer_info para detectar hardware integrado/movil.
 * Devuelve una cadena en minusculas o '' si no esta disponible.
 */
function detectGPU() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return '';
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  } catch {
    return '';
  }
}

export const Device = (() => {
  const isTouch = detectTouch() || detectMobileUA();
  const gpu = detectGPU();
  const isIntegratedGPU = /intel|adreno|mali|powervr|apple gpu|swiftshader/i.test(gpu);
  const cores = navigator.hardwareConcurrency || 4;
  const lowEnd = cores <= 4;

  // Preset recomendado: movil > bajo (GPU debil) > medio (default) > alto (potente).
  let recommendedQuality;
  if (isTouch) recommendedQuality = 'movil';
  else if (isIntegratedGPU && lowEnd) recommendedQuality = 'bajo';
  else if (isIntegratedGPU) recommendedQuality = 'medio';
  else recommendedQuality = 'alto';

  return {
    isTouch,
    gpu,
    isIntegratedGPU,
    cores,
    recommendedQuality,
    controlScheme: isTouch ? 'touch' : 'desktop'
  };
})();
