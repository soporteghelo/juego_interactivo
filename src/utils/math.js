/**
 * Utilidades matematicas compartidas por todo el simulador.
 * Mantener aqui las funciones puras y sin dependencias de Three.js.
 */

/** Limita `v` al rango [min, max]. */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Interpolacion lineal entre a y b segun t (0..1). */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Interpolacion exponencial estable por frame (independiente del framerate). */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Remapea x del rango [inMin,inMax] al rango [outMin,outMax]. */
export const remap = (x, inMin, inMax, outMin, outMax) =>
  outMin + ((x - inMin) * (outMax - outMin)) / (inMax - inMin);

/** Grados a radianes. */
export const degToRad = (deg) => (deg * Math.PI) / 180;

/** Numero aleatorio en [min, max) usando un generador opcional (def: Math.random). */
export const randRange = (min, max, rng = Math.random) => min + rng() * (max - min);

/** Elemento aleatorio de un arreglo. */
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
