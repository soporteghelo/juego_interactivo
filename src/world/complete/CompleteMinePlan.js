/**
 * Plano maestro de la mina CSV.
 *
 * Convencion de coordenadas del plano y de los CSV:
 *   X = Este, Y = Norte, Z = cota; una unidad equivale a un metro.
 *
 * Cada labor conserva su geometria 1:1. Solo se traslada y rota alrededor del eje vertical;
 * nunca se escala. Las cotas enlazan superficie, Nivel 160 y Nivel 128 mediante la rampa,
 * cuatro conexiones verticales, pique, echadero y slot.
 */

const BASE = Object.freeze([6000, 4500, -220]);
const SURFACE_ACCESS = Object.freeze([6000, 4500, -22]);
const SOCAVON_ACCESS = Object.freeze([6000, 4500, -18]);
const SHAFT_BASE = Object.freeze([6000, 4500, -320]);

export const COMPLETE_MINE_PLAN = [
  {
    id: 'acceso_bocamina', file: 'bocamina.csv', label: 'Bocamina principal', type: 'Acceso', level: 'Superficie → Nivel 160',
    origin: SURFACE_ACCESS, position: [-140, 0, 20], rotation: 0,
    removeLayers: ['EMPALME_RAMPA']
  },
  {
    id: 'nivel_160_principal', file: 'nivel_principal.csv', label: 'Nivel principal 160', type: 'Transporte', level: 'Nivel 160',
    origin: BASE, position: [-50, 2, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'interseccion_central', file: 'interseccion_4_vias.csv', label: 'Intersección central', type: 'Intersección', level: 'Nivel 160',
    origin: BASE, position: [20, 2, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE', 'BOCA_REFORZADA']
  },
  {
    id: 'crucero_este', file: 'crucero.csv', label: 'Crucero de mineral', type: 'Crucero', level: 'Nivel 160',
    origin: BASE, position: [20, 2, 8], rotation: 0,
    removeLayers: ['PORTAL', 'CONTACTO_CUERPO_MINERAL']
  },
  {
    id: 'galeria_estructura', file: 'galeria.csv', label: 'Galería sobre rumbo', type: 'Desarrollo', level: 'Nivel 160',
    origin: BASE, position: [20, 72, 8], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'acceso_socavon', file: 'socavon.csv', label: 'Socavón secundario', type: 'Acceso', level: 'Superficie → Nivel 160',
    origin: SOCAVON_ACCESS, position: [-100, 72, 8], rotation: 0,
    removeLayers: ['FRENTE']
  },
  {
    id: 'cortada_norte', file: 'cortada.csv', label: 'Cortada norte', type: 'Crucero', level: 'Nivel 160',
    origin: BASE, position: [115, 2, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'bypass_ventilacion', file: 'by_pass.csv', label: 'By-pass doble de ventilación', type: 'Ventilación', level: 'Nivel 160',
    origin: BASE, position: [40, -23, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'ventana_bypass', file: 'ventana.csv', label: 'Ventana al by-pass', type: 'Conexión', level: 'Nivel 160',
    origin: BASE, position: [80, -15.5, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'galeria_hd_sur', file: 'galeria_wireframe_simulada.csv', label: 'Galería irregular sur', type: 'Desarrollo', level: 'Nivel 160',
    origin: BASE, position: [40, -30.5, 8], rotation: -90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'frente_avance', file: 'frente_desarrollo.csv', label: 'Frente de desarrollo', type: 'Producción', level: 'Nivel 160',
    origin: BASE, position: [210, 2, 8], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'rampa_principal', file: 'rampa.csv', label: 'Rampa principal −13%', type: 'Rampa', level: 'Nivel 160 → Nivel 128',
    origin: BASE, position: [210, 2, 8], rotation: -90,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'subnivel_perforacion', file: 'subnivel.csv', label: 'Subnivel de perforación', type: 'Producción', level: 'Nivel 128',
    origin: BASE, position: [234, 24, -23.2], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'tajo_longhole', file: 'tajo_subniveles.csv', label: 'Tajo Sublevel Longhole', type: 'Tajo', level: 'Nivel 128',
    origin: BASE, position: [285, 24, -23.2], rotation: 0,
    removeLayers: []
  },
  {
    id: 'tajo_corte_relleno', file: 'tajo_corte_relleno.csv', label: 'Tajo corte y relleno', type: 'Tajo', level: 'Nivel 128',
    origin: BASE, position: [234, 72, -23.2], rotation: 0,
    removeLayers: ['EXTREMO_TAJO']
  },
  {
    id: 'tolva_drawpoint', file: 'tolva_drawpoint.csv', label: 'Tolva y drawpoint', type: 'Extracción', level: 'Nivel 128',
    origin: BASE, position: [275, -20, -23.2], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'chimenea_convencional', file: 'chimenea.csv', label: 'Chimenea convencional', type: 'Vertical', level: 'Nivel 128 → Nivel 160',
    origin: BASE, position: [40, 72, -52], rotation: 0,
    removeLayers: []
  },
  {
    id: 'chimenea_ventilacion', file: 'chimenea_ventilacion.csv', label: 'Chimenea raise-bored', type: 'Ventilación', level: 'Nivel 112 → Nivel 160',
    origin: BASE, position: [120, 72, -72], rotation: 0,
    removeLayers: []
  },
  {
    id: 'pique_izaje', file: 'pique.csv', label: 'Pique de izaje', type: 'Vertical', level: 'Nivel 48 → Nivel 160',
    origin: SHAFT_BASE, position: [320, 2, -112], rotation: 0,
    removeLayers: []
  },
  {
    id: 'echadero_mineral', file: 'echadero_mineral.csv', label: 'Echadero de mineral', type: 'Extracción', level: 'Nivel 128 → Nivel 160',
    origin: BASE, position: [320, 24, -52], rotation: 0,
    removeLayers: []
  },
  {
    id: 'slot_raise_produccion', file: 'slot_raise.csv', label: 'Slot raise', type: 'Producción', level: 'Nivel 98 → Nivel 128',
    origin: BASE, position: [300, 42, -53.2], rotation: 0,
    removeLayers: []
  },
  {
    id: 'camino_escape', file: 'camino_escape.csv', label: 'Camino de escape', type: 'Seguridad', level: 'Nivel 115 → Nivel 160',
    origin: BASE, position: [170, 72, -37], rotation: 0,
    removeLayers: []
  },
  {
    id: 'camara_carguio', file: 'camara_carguio.csv', label: 'Cámara de carguío', type: 'Infraestructura', level: 'Nivel 160',
    origin: BASE, position: [30, 72, 8], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'taller_subterraneo', file: 'taller_subterraneo.csv', label: 'Taller subterráneo', type: 'Infraestructura', level: 'Nivel 160',
    origin: BASE, position: [70, 72, 8], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'estacion_bombeo', file: 'estacion_bombeo.csv', label: 'Estación de bombeo', type: 'Drenaje', level: 'Nivel 160',
    origin: BASE, position: [115, 72, 8], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'polvorin', file: 'polvorin.csv', label: 'Polvorín', type: 'Infraestructura', level: 'Nivel 160',
    origin: BASE, position: [150, 72, 8], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'refugio_mineros', file: 'refugio_mineros.csv', label: 'Refugio minero', type: 'Seguridad', level: 'Nivel 160',
    origin: BASE, position: [190, 72, 8], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'estacion_nivel', file: 'estacion_nivel.csv', label: 'Estación de nivel', type: 'Infraestructura', level: 'Nivel 160',
    origin: BASE, position: [175, 2, 8], rotation: -90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'grifo_subterraneo', file: 'grifo_subterraneo.csv', label: 'Grifo subterráneo', type: 'Infraestructura', level: 'Nivel 160',
    origin: BASE, position: [10, -30.5, 8], rotation: -90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'subestacion_electrica', file: 'subestacion_electrica.csv', label: 'Subestación eléctrica', type: 'Infraestructura', level: 'Nivel 160',
    origin: BASE, position: [55, -30.5, 8], rotation: -90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'sala_chancado', file: 'sala_chancado.csv', label: 'Sala de chancado', type: 'Proceso', level: 'Nivel 160',
    origin: BASE, position: [100, -30.5, 8], rotation: -90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'poza_sedimentacion', file: 'poza_sedimentacion.csv', label: 'Poza de sedimentación', type: 'Drenaje', level: 'Nivel 160',
    origin: BASE, position: [145, -30.5, 8], rotation: -90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'estocada_carguio', file: 'estocada_carguio.csv', label: 'Estocada de carguío', type: 'Producción', level: 'Nivel 160',
    origin: BASE, position: [150, 2, 8], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'nicho_peatonal', file: 'nicho_refugio_peatonal.csv', label: 'Nicho peatonal', type: 'Seguridad', level: 'Nivel 160',
    origin: BASE, position: [190, 2, 8], rotation: 0,
    removeLayers: ['PORTAL']
  },

  // Ala este del Nivel 160: prolonga transporte, ventilacion y desarrollo sobre rumbo.
  {
    id: 'nivel_160_extension_este', file: 'nivel_principal.csv', label: 'Nivel 160 · extensión este', type: 'Transporte', level: 'Nivel 160',
    origin: BASE, position: [246, 2, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'crucero_este_2', file: 'crucero.csv', label: 'Crucero este 2', type: 'Crucero', level: 'Nivel 160',
    origin: BASE, position: [340, 2, 8], rotation: 0,
    removeLayers: ['PORTAL', 'CONTACTO_CUERPO_MINERAL']
  },
  {
    id: 'galeria_este_2', file: 'galeria.csv', label: 'Galería este 2', type: 'Desarrollo', level: 'Nivel 160',
    origin: BASE, position: [340, 72, 8], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'bypass_este_2', file: 'by_pass.csv', label: 'By-pass este 2', type: 'Ventilación', level: 'Nivel 160',
    origin: BASE, position: [300, -23, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'ventana_bypass_este', file: 'ventana.csv', label: 'Ventana by-pass este', type: 'Conexión', level: 'Nivel 160',
    origin: BASE, position: [340, -15.5, 8], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },

  // Segunda rampa y Nivel 96.
  {
    id: 'rampa_nivel_96', file: 'rampa.csv', label: 'Rampa al Nivel 96 · −13%', type: 'Rampa', level: 'Nivel 128 → Nivel 96',
    origin: BASE, position: [314, 24, -23.2], rotation: -90,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'nivel_96_principal', file: 'nivel_principal.csv', label: 'Nivel principal 96', type: 'Transporte', level: 'Nivel 96',
    origin: BASE, position: [338, 46, -54.4], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'crucero_nivel_96', file: 'crucero.csv', label: 'Crucero Nivel 96', type: 'Crucero', level: 'Nivel 96',
    origin: BASE, position: [380, 46, -54.4], rotation: 0,
    removeLayers: ['PORTAL', 'CONTACTO_CUERPO_MINERAL']
  },
  {
    id: 'galeria_nivel_96', file: 'galeria.csv', label: 'Galería sobre rumbo · Nivel 96', type: 'Desarrollo', level: 'Nivel 96',
    origin: BASE, position: [380, 116, -54.4], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'tajo_longhole_nivel_96', file: 'tajo_subniveles.csv', label: 'Tajo Longhole · Nivel 96', type: 'Tajo', level: 'Nivel 96',
    origin: BASE, position: [470, 116, -54.4], rotation: 0,
    removeLayers: []
  },
  {
    id: 'refugio_nivel_96', file: 'refugio_mineros.csv', label: 'Refugio · Nivel 96', type: 'Seguridad', level: 'Nivel 96',
    origin: BASE, position: [540, 116, -54.4], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'bombeo_nivel_96', file: 'estacion_bombeo.csv', label: 'Bombeo · Nivel 96', type: 'Drenaje', level: 'Nivel 96',
    origin: BASE, position: [570, 116, -54.4], rotation: 90,
    removeLayers: ['PORTAL']
  },
  {
    id: 'chimenea_nivel_96_160', file: 'chimenea.csv', label: 'Chimenea Nivel 96–160', type: 'Vertical', level: 'Nivel 96 → Nivel 160',
    origin: BASE, position: [500, 116, -54.4], rotation: 0,
    removeLayers: []
  },

  // Tercera rampa y Nivel 64 profundo.
  {
    id: 'rampa_nivel_64', file: 'rampa.csv', label: 'Rampa al Nivel 64 · −13%', type: 'Rampa', level: 'Nivel 96 → Nivel 64',
    origin: BASE, position: [598, 46, -54.4], rotation: -90,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'nivel_64_principal', file: 'nivel_principal.csv', label: 'Nivel principal 64', type: 'Transporte', level: 'Nivel 64',
    origin: BASE, position: [622, 68, -85.6], rotation: 0,
    removeLayers: ['PORTAL', 'FRENTE']
  },
  {
    id: 'crucero_nivel_64', file: 'crucero.csv', label: 'Crucero Nivel 64', type: 'Crucero', level: 'Nivel 64',
    origin: BASE, position: [700, 68, -85.6], rotation: 0,
    removeLayers: ['PORTAL', 'CONTACTO_CUERPO_MINERAL']
  },
  {
    id: 'galeria_nivel_64', file: 'galeria.csv', label: 'Galería sobre rumbo · Nivel 64', type: 'Desarrollo', level: 'Nivel 64',
    origin: BASE, position: [700, 138, -85.6], rotation: 0,
    removeLayers: ['PORTAL']
  },
  {
    id: 'tajo_longhole_nivel_64', file: 'tajo_subniveles.csv', label: 'Tajo Longhole · Nivel 64', type: 'Tajo', level: 'Nivel 64',
    origin: BASE, position: [780, 138, -85.6], rotation: 0,
    removeLayers: []
  },
  {
    id: 'camino_escape_nivel_64', file: 'camino_escape.csv', label: 'Escape profundo · Nivel 64', type: 'Seguridad', level: 'Nivel 64 → Nivel 96',
    origin: BASE, position: [720, 138, -130.6], rotation: 0,
    removeLayers: []
  },
  {
    id: 'pique_profundo', file: 'pique.csv', label: 'Pique profundo', type: 'Vertical', level: 'Nivel −56 → Nivel 64',
    origin: SHAFT_BASE, position: [882, 68, -205.6], rotation: 0,
    removeLayers: []
  }
];

export const COMPLETE_MINE_SOURCE_ELEMENTS = 34;
export const COMPLETE_MINE_EXPECTED_PLACEMENTS = 54;
