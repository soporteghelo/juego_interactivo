/**
 * CATALOGO DE ELEMENTOS — registro central de todos los elementos editables de la mina.
 *
 * Cada elemento vive en su PROPIO archivo (en espanol) dentro de esta carpeta, para poder
 * editarlo de forma aislada. Aqui se reune todo para:
 *   1. el VISUALIZADOR (visor.html) — inspeccionar/editar cada elemento por separado.
 *   2. el mundo (PropScatter) — colocar los elementos en las galerias.
 *
 * Para AGREGAR un elemento nuevo: crea `mi_elemento.js` con `export function crear()` y
 * `export const meta`, impórtalo aqui y añade una entrada al CATALOGO.
 */

import * as perno from './perno.js';
import * as malla from './malla.js';
import * as shotcrete from './shotcrete.js';
import * as rocaSuelta from './roca_suelta.js';
import * as charco from './charco.js';
import * as baliza from './baliza.js';
import * as senal from './senal.js';
import * as chevron from './chevron.js';
import * as ventilacion from './ventilacion.js';
import * as bandejaCables from './bandeja_cables.js';
import * as manguera from './manguera.js';
import * as tableroElectrico from './tablero_electrico.js';
import * as tableroGestion from './tablero_gestion.js';
import * as pizarraMonitoreo from './pizarra_monitoreo.js';
import * as ventilador from './ventilador.js';
import * as camion from './camion.js';
import * as camioneta from './camioneta.js';
import * as jumbo from './jumbo.js';
import * as panelInformativo from './panel_informativo.js';
import * as ptTag from './pt_tag.js';
import * as refugio from './refugio.js';
import * as refugioDraeger from './refugio_draeger.js';
import * as nichoRefugio from './nicho_refugio.js';
import * as persona from './persona.js';
import * as nichoElectrico from './nicho_electrico.js';
import * as extintor from './extintor.js';
import * as mallaSobresalida from './malla_sobresalida.js';
import * as cordonBloqueo from './cordon_bloqueo.js';
import * as basura from './basura.js';

// Reexporta los modulos por si se quieren importar directamente.
export {
  perno, malla, shotcrete, rocaSuelta, charco, baliza, senal, chevron, ventilacion,
  bandejaCables, manguera, tableroElectrico, tableroGestion, pizarraMonitoreo,
  ventilador, camion, camioneta, jumbo, panelInformativo, ptTag, refugio, refugioDraeger,
  nichoRefugio, persona, nichoElectrico, extintor, mallaSobresalida, cordonBloqueo, basura
};

/**
 * Lista plana de elementos visualizables. Las VARIANTES (sobresalido, antiguo, etc.) y los
 * distintos tipos de senal aparecen como entradas separadas para inspeccionarlas una a una.
 * @type {Array<{id:string, nombre:string, descripcion:string, crear:Function}>}
 */
export const CATALOGO = [
  // --- Sostenimiento ---
  { id: 'perno', nombre: 'Perno de roca', descripcion: perno.meta.descripcion, crear: () => perno.crear({ sobresalido: false }) },
  { id: 'perno_sobresalido', nombre: 'Perno SOBRESALIDO', descripcion: 'Perno mal instalado que sobresale (hallazgo de inspeccion).', crear: () => perno.crear({ sobresalido: true }) },
  { id: 'malla', nombre: 'Malla de acero', descripcion: malla.meta.descripcion, crear: () => malla.crear({ sobresalida: false }) },
  { id: 'malla_sobresalida_plana', nombre: 'Malla SOBRESALIDA / rasgada', descripcion: 'Malla abombada por roca inestable.', crear: () => malla.crear({ sobresalida: true }) },
  { id: 'malla_sobresalida', nombre: mallaSobresalida.meta.nombre, descripcion: mallaSobresalida.meta.descripcion, crear: () => mallaSobresalida.crear({ side: 1, wallX: 0 }) },
  { id: 'shotcrete', nombre: 'Shotcrete craquelado', descripcion: shotcrete.meta.descripcion, crear: () => shotcrete.crear({ craquelado: true }) },

  // --- Piso / entorno ---
  { id: 'roca_suelta', nombre: 'Roca suelta', descripcion: rocaSuelta.meta.descripcion, crear: () => rocaSuelta.crear({ mineralizada: false }) },
  { id: 'roca_mineralizada', nombre: 'Roca mineralizada (sulfuros)', descripcion: 'Escombros con mineralizacion dorada.', crear: () => rocaSuelta.crear({ mineralizada: true }) },
  { id: 'charco', nombre: 'Charco de agua', descripcion: charco.meta.descripcion, crear: () => charco.crear({}) },
  { id: 'baliza', nombre: 'Baliza / delineador', descripcion: baliza.meta.descripcion, crear: () => baliza.crear() },

  // --- Instalaciones ---
  { id: 'ventilacion', nombre: 'Manga de ventilacion', descripcion: ventilacion.meta.descripcion, crear: () => ventilacion.crear({ aged: false }) },
  { id: 'ventilacion_antigua', nombre: 'Manga ventilacion antigua', descripcion: 'Manga oxidada/deformada.', crear: () => ventilacion.crear({ aged: true }) },
  { id: 'ventilador', nombre: 'Ventilador sin guarda (aspas expuestas)', descripcion: ventilador.meta.descripcion, crear: () => ventilador.crear({ conProteccion: false }) },
  { id: 'ventilador_protegido', nombre: 'Ventilador CON GUARDA protectora', descripcion: 'Ventilador con grilla circular de proteccion (foto real AESA).', crear: () => ventilador.crear({ conProteccion: true }) },
  { id: 'bandeja_cables', nombre: 'Bandeja de cables', descripcion: bandejaCables.meta.descripcion, crear: () => bandejaCables.crear({ height: 0 }) },
  { id: 'manguera_agua', nombre: 'Manguera de agua', descripcion: 'Manguera VERDE de agua (estandar AESA).', crear: () => manguera.crear({ agua: true }) },
  { id: 'manguera_aire', nombre: 'Manguera de aire', descripcion: 'Manguera AZUL de aire comprimido (estandar AESA).', crear: () => manguera.crear({ agua: false }) },
  { id: 'tablero_electrico', nombre: 'Tablero electrico', descripcion: tableroElectrico.meta.descripcion, crear: () => tableroElectrico.crear() },
  { id: 'tablero_gestion', nombre: 'Tablero de gestion (SSOMA)', descripcion: tableroGestion.meta.descripcion, crear: () => tableroGestion.crear() },
  { id: 'pizarra_monitoreo', nombre: 'Pizarra de monitoreo', descripcion: pizarraMonitoreo.meta.descripcion, crear: () => pizarraMonitoreo.crear() },

  // --- Equipos / vehiculos ---
  { id: 'camion', nombre: 'Camion / volquete', descripcion: camion.meta.descripcion, crear: () => camion.crear() },
  { id: 'camioneta', nombre: 'Camioneta utilitaria', descripcion: camioneta.meta.descripcion, crear: () => camioneta.crear() },
  { id: 'jumbo', nombre: 'Jumbo de perforacion', descripcion: jumbo.meta.descripcion, crear: () => jumbo.crear() },
  { id: 'extintor', nombre: extintor.meta.nombre, descripcion: extintor.meta.descripcion, crear: () => extintor.crear() },

  // --- Tableros / paneles ---
  { id: 'panel_informativo', nombre: 'Panel informativo AESA', descripcion: panelInformativo.meta.descripcion, crear: () => panelInformativo.crear() },
  { id: 'pt_tag', nombre: 'PT-TAG (dispositivo personal)', descripcion: 'Dispositivo de rastreo personal. LED verde = bateria OK, ambar/rojo = bateria baja.', crear: () => ptTag.crearPtTag({ bateria: 'ok' }) },
  { id: 'pt_tag_baja', nombre: 'PT-TAG bateria baja', descripcion: 'PT-TAG con LED ambar parpadeante.', crear: () => ptTag.crearPtTag({ bateria: 'baja' }) },

  // --- Personas (EPP por rol) ---
  { id: 'persona_operador', nombre: 'Persona — operador (casco amarillo)', descripcion: persona.meta.descripcion, crear: () => persona.crear({ rol: 'operador' }) },
  { id: 'persona_supervisor', nombre: 'Persona — supervisor (casco blanco)', descripcion: persona.meta.descripcion, crear: () => persona.crear({ rol: 'supervisor' }) },
  { id: 'persona_geomecanica', nombre: 'Persona — geomecanica (casco verde)', descripcion: persona.meta.descripcion, crear: () => persona.crear({ rol: 'geomecanica' }) },

  // --- Refugio ---
  { id: 'refugio', nombre: 'Refugio minero (Drager)', descripcion: refugio.meta.descripcion, crear: () => refugio.crear() },
  { id: 'refugio_draeger', nombre: refugioDraeger.meta.nombre, descripcion: refugioDraeger.meta.descripcion, crear: () => refugioDraeger.crear() },
  { id: 'refugio_draeger_ocupado', nombre: 'Refugio Dräger — OCUPADO (semáforo rojo)', descripcion: 'Cámara Dräger con puerta abierta y semáforo en rojo (ocupado).', crear: () => refugioDraeger.crear({ ocupado: true }) },
  { id: 'nicho_refugio', nombre: nichoRefugio.meta.nombre, descripcion: nichoRefugio.meta.descripcion, crear: () => nichoRefugio.crear() },
  { id: 'nicho_electrico', nombre: 'Nicho electrico (simple)', descripcion: nichoElectrico.meta.descripcion, crear: () => nichoElectrico.crear({ doble: false }) },
  { id: 'nicho_electrico_doble', nombre: 'Nicho electrico DOBLE', descripcion: 'Nicho con 2 tableros electricos empotrados en el hastial.', crear: () => nichoElectrico.crear({ doble: true }) },
  { id: 'nicho_vacio', nombre: 'Nicho vacío (refugio peatonal)', descripcion: nichoElectrico.metaVacio.descripcion, crear: () => nichoElectrico.crearVacio({ seed: 7 }) },

  // --- Senaletica (un tipo por entrada) ---
  ...senal.CLAVES_SENAL.map((tipo) => ({
    id: `senal_${tipo}`,
    nombre: `Senal: ${tipo}`,
    descripcion: 'Letrero de seguridad (CanvasTexture).',
    crear: () => senal.crearSenal(tipo)
  })),
  { id: 'chevron', nombre: 'Chevron de direccion', descripcion: chevron.meta.descripcion, crear: () => chevron.crear() },

  // --- Seguridad / delimitacion ---
  { id: 'cordon_bloqueo', nombre: cordonBloqueo.meta.nombre, descripcion: cordonBloqueo.meta.descripcion, crear: () => cordonBloqueo.crear({ ancho: 4.0 }) },

  // --- Basura / residuos (3 variantes) ---
  { id: 'basura_chatarra', nombre: 'Basura — chatarra metalica', descripcion: 'Malla vieja, cables y varillas en el piso.', crear: () => basura.crear({ variante: 'chatarra' }) },
  { id: 'basura_embalaje', nombre: 'Basura — materiales de embalaje', descripcion: 'Cajas de carton, bolsas plasticas y papel disperso.', crear: () => basura.crear({ variante: 'embalaje' }) },
  { id: 'basura_mixta',    nombre: 'Basura — mixta con lona (tipica)', descripcion: 'Lona roja + cajas + cables + malla. La mas comun en mina.', crear: () => basura.crear({ variante: 'mixta' }) }
];
