import csvText from '../../../prueba/elementos/interseccion_4_vias.csv?raw';
import { buildCsvIntersectionGeometry } from './CsvIntersectionGeometry.js';

let cached = null;

/** Parseo unico: todas las intersecciones comparten exactamente la misma geometria del CSV. */
export function getCsvIntersectionAsset() {
  if (!cached) cached = buildCsvIntersectionGeometry(csvText, { halfSize: 5 });
  return cached;
}
