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

import * as perno from './sostenimiento/perno.js';
import * as malla from './sostenimiento/malla.js';
import * as shotcrete from './sostenimiento/shotcrete.js';
import * as rocaSuelta from './entorno/roca_suelta.js';
import * as charco from './entorno/charco.js';
import * as baliza from './entorno/baliza.js';
import * as senal from './senal/senal.js';
import * as chevron from './senal/chevron.js';
import * as ventilacion from './servicios/ventilacion.js';
import * as bandejaCables from './servicios/bandeja_cables.js';
import * as manguera from './servicios/manguera.js';
import * as alcayata from './entorno/alcayata.js';
import * as cableElectrico from './servicios/cable_electrico.js';
import * as tableroElectrico from './senal/tablero_electrico.js';
import * as tableroGestion from './senal/tablero_gestion.js';
import * as pizarraMonitoreo from './senal/pizarra_monitoreo.js';
import * as ventilador from './servicios/ventilador.js';
import * as camion from './equipos/camion.js';
import * as camioneta from './equipos/camioneta.js';
import * as jumbo from './equipos/jumbo.js';
import * as raptor from './equipos/raptor.js';
import * as scoop from './equipos/scoop.js';
import * as empernador from './equipos/empernador.js';
import * as shotcretera from './equipos/shotcretera.js';
import * as mixer from './equipos/mixer.js';
import * as desatador from './equipos/desatador.js';
import * as telehandler from './equipos/telehandler.js';
import * as panelInformativo from './senal/panel_informativo.js';
import * as ptTag from './ssoma/pt_tag.js';
import * as refugio from './ssoma/refugio.js';
import * as refugioDraeger from './ssoma/refugio_draeger.js';
import * as nichoRefugio from './ssoma/nicho_refugio.js';
import * as persona from './personas/persona.js';
import * as minero from './personas/minero.js';
import * as operadorSentado from './equipos/operador_sentado.js';
import * as estacionEmergencia from './ssoma/estacion_emergencia.js';
import * as telefonoEmergencia from './ssoma/telefono_emergencia.js';
import * as puntoResiduos from './ssoma/punto_residuos.js';
import * as espejoConvexo from './ssoma/espejo_convexo.js';
import * as chimeneaEscape from './ssoma/chimenea_escape.js';
import * as duchaLavaojos from './ssoma/ducha_lavaojos.js';
import * as sensorGases from './ssoma/sensor_gases.js';
import * as pilaMineral from './entorno/pila_mineral.js';
import * as nichoElectrico from './entorno/nicho_electrico.js';
import * as extintor from './ssoma/extintor.js';
import * as mallaSobresalida from './sostenimiento/malla_sobresalida.js';
import * as cordonBloqueo from './ssoma/cordon_bloqueo.js';
import * as basura from './entorno/basura.js';
import * as barretillas from './sostenimiento/barretillas.js';
import * as portaherramientas from './sostenimiento/portaherramientas.js';
import * as punteraAgua from './servicios/puntera_agua.js';
import * as estacionTotal from './entorno/estacion_total.js';
import * as frenteCargado from './entorno/frente_cargado.js';
import * as mallaNaranja from './ssoma/malla_naranja.js';

// Reexporta los modulos por si se quieren importar directamente.
export {
  perno, malla, shotcrete, rocaSuelta, charco, baliza, senal, chevron, ventilacion,
  bandejaCables, manguera, tableroElectrico, tableroGestion, pizarraMonitoreo,
  ventilador, camion, camioneta, jumbo, raptor, scoop, empernador, shotcretera, mixer, desatador,
  telehandler, panelInformativo, ptTag, refugio, refugioDraeger,
  nichoRefugio, persona, nichoElectrico, extintor, mallaSobresalida, cordonBloqueo, basura,
  barretillas, portaherramientas, punteraAgua, estacionTotal, frenteCargado, mallaNaranja
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
  { id: 'ventilador_protegido', nombre: 'Ventilador CON GUARDA protectora', descripcion: 'Ventilador con grilla circular de proteccion (segun foto real).', crear: () => ventilador.crear({ conProteccion: true }) },
  { id: 'bandeja_cables', nombre: 'Bandeja de cables', descripcion: bandejaCables.meta.descripcion, crear: () => bandejaCables.crear({ height: 0 }) },
  { id: 'alcayata', nombre: 'Alcayata (gancho para cable)', descripcion: alcayata.meta.descripcion, crear: () => alcayata.crear() },
  { id: 'cable_electrico', nombre: 'Cable eléctrico en alcayatas', descripcion: cableElectrico.meta.descripcion, crear: () => cableElectrico.crear({ length: 10 }) },
  { id: 'manguera_agua', nombre: 'Manguera de agua', descripcion: 'Manguera VERDE de agua (estandar minero).', crear: () => manguera.crear({ agua: true }) },
  { id: 'manguera_aire', nombre: 'Manguera de aire', descripcion: 'Manguera AZUL de aire comprimido (estandar minero).', crear: () => manguera.crear({ agua: false }) },
  { id: 'puntera_agua', nombre: punteraAgua.meta.nombre, descripcion: punteraAgua.meta.descripcion, crear: () => punteraAgua.crear() },
  { id: 'tablero_electrico', nombre: 'Tablero electrico', descripcion: tableroElectrico.meta.descripcion, crear: () => tableroElectrico.crear() },
  { id: 'tablero_gestion', nombre: 'Tablero de gestion (SSOMA)', descripcion: tableroGestion.meta.descripcion, crear: () => tableroGestion.crear() },
  { id: 'pizarra_monitoreo', nombre: 'Pizarra de monitoreo', descripcion: pizarraMonitoreo.meta.descripcion, crear: () => pizarraMonitoreo.crear() },

  // --- Equipos / vehiculos ---
  { id: 'camion', nombre: 'Camion / volquete', descripcion: camion.meta.descripcion, crear: () => camion.crear() },
  { id: 'camioneta', nombre: 'Camioneta utilitaria', descripcion: camioneta.meta.descripcion, crear: () => camioneta.crear() },
  { id: 'jumbo', nombre: 'Jumbo de perforacion', descripcion: jumbo.meta.descripcion, crear: () => jumbo.crear() },
  { id: 'raptor', nombre: raptor.meta.nombre, descripcion: raptor.meta.descripcion, crear: () => raptor.crear() },
  { id: 'scoop', nombre: scoop.meta.nombre, descripcion: scoop.meta.descripcion, crear: () => scoop.crear() },
  { id: 'empernador', nombre: empernador.meta.nombre, descripcion: empernador.meta.descripcion, crear: () => empernador.crear() },
  { id: 'desatador', nombre: desatador.meta.nombre, descripcion: desatador.meta.descripcion, crear: () => desatador.crear() },
  { id: 'shotcretera', nombre: shotcretera.meta.nombre, descripcion: shotcretera.meta.descripcion, crear: () => shotcretera.crear() },
  { id: 'mixer', nombre: mixer.meta.nombre, descripcion: mixer.meta.descripcion, crear: () => mixer.crear() },
  { id: 'telehandler', nombre: telehandler.meta.nombre, descripcion: telehandler.meta.descripcion, crear: () => telehandler.crear({ variante: 'manitou' }) },
  { id: 'telehandler_paus', nombre: 'Utilitario PAUS 853-S8 (plataforma tijera)', descripcion: 'Variante PAUS: mismo chasis utilitario con PLATAFORMA ELEVADORA DE TIJERA y canasta para trabajo en altura.', crear: () => telehandler.crear({ variante: 'paus' }) },
  { id: 'extintor', nombre: extintor.meta.nombre, descripcion: extintor.meta.descripcion, crear: () => extintor.crear() },

  // --- Seguridad / emergencia (D.S. 024-2016-EM) ---
  { id: 'estacion_emergencia', nombre: estacionEmergencia.meta.nombre, descripcion: estacionEmergencia.meta.descripcion, crear: () => estacionEmergencia.crear() },
  { id: 'telefono_emergencia', nombre: telefonoEmergencia.meta.nombre, descripcion: telefonoEmergencia.meta.descripcion, crear: () => telefonoEmergencia.crear() },
  { id: 'punto_residuos', nombre: puntoResiduos.meta.nombre, descripcion: puntoResiduos.meta.descripcion, crear: () => puntoResiduos.crear() },
  { id: 'espejo_convexo', nombre: espejoConvexo.meta.nombre, descripcion: espejoConvexo.meta.descripcion, crear: () => espejoConvexo.crear() },
  { id: 'chimenea_escape', nombre: chimeneaEscape.meta.nombre, descripcion: chimeneaEscape.meta.descripcion, crear: () => chimeneaEscape.crear() },
  { id: 'ducha_lavaojos', nombre: duchaLavaojos.meta.nombre, descripcion: duchaLavaojos.meta.descripcion, crear: () => duchaLavaojos.crear() },
  { id: 'sensor_gases', nombre: sensorGases.meta.nombre, descripcion: sensorGases.meta.descripcion, crear: () => sensorGases.crear() },
  { id: 'pila_mineral', nombre: pilaMineral.meta.nombre, descripcion: pilaMineral.meta.descripcion, crear: () => pilaMineral.crear() },
  { id: 'estacion_total', nombre: estacionTotal.meta.nombre, descripcion: estacionTotal.meta.descripcion, crear: () => estacionTotal.crear() },
  { id: 'frente_cargado', nombre: frenteCargado.meta.nombre, descripcion: frenteCargado.meta.descripcion, crear: () => frenteCargado.crear() },
  { id: 'malla_naranja', nombre: mallaNaranja.meta.nombre, descripcion: mallaNaranja.meta.descripcion, crear: () => mallaNaranja.crear({ ancho: 4.0 }) },

  // --- Tableros / paneles ---
  { id: 'panel_informativo', nombre: 'Panel informativo', descripcion: panelInformativo.meta.descripcion, crear: () => panelInformativo.crear() },
  { id: 'pt_tag', nombre: 'PT-TAG (dispositivo personal)', descripcion: 'Dispositivo de rastreo personal. LED verde = bateria OK, ambar/rojo = bateria baja.', crear: () => ptTag.crearPtTag({ bateria: 'ok' }) },
  { id: 'pt_tag_baja', nombre: 'PT-TAG bateria baja', descripcion: 'PT-TAG con LED ambar parpadeante.', crear: () => ptTag.crearPtTag({ bateria: 'baja' }) },

  // --- Personas (EPP por rol) ---
  { id: 'operador_sentado', nombre: operadorSentado.meta.nombre, descripcion: operadorSentado.meta.descripcion, crear: () => operadorSentado.crear() },
  { id: 'minero_operador', nombre: 'Minero FBX — operador (Mixamo, animado)', descripcion: 'Personaje rigged Mixamo con coverall naranja, EPP en huesos y animación de caminar. Requiere carga del FBX.', crear: () => minero.crear({ rol: 'operador' }) },
  { id: 'minero_supervisor', nombre: 'Minero FBX — supervisor (Mixamo, animado)', descripcion: 'Personaje rigged Mixamo (casco blanco) con EPP y caminar.', crear: () => minero.crear({ rol: 'supervisor' }) },
  { id: 'minero_geomecanica', nombre: 'Minero FBX — geomecanica (Mixamo, animado)', descripcion: 'Personaje rigged Mixamo (casco verde) con EPP y caminar.', crear: () => minero.crear({ rol: 'geomecanica' }) },
  { id: 'persona_operador', nombre: 'Persona procedural — operador (casco amarillo)', descripcion: persona.meta.descripcion, crear: () => persona.crear({ rol: 'operador' }) },
  { id: 'persona_supervisor', nombre: 'Persona procedural — supervisor (casco blanco)', descripcion: persona.meta.descripcion, crear: () => persona.crear({ rol: 'supervisor' }) },
  { id: 'persona_geomecanica', nombre: 'Persona procedural — geomecanica (casco verde)', descripcion: persona.meta.descripcion, crear: () => persona.crear({ rol: 'geomecanica' }) },

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

  // --- Herramientas ---
  { id: 'portaherramientas', nombre: portaherramientas.meta.nombre, descripcion: portaherramientas.meta.descripcion, crear: () => portaherramientas.crear() },
  { id: 'barretillas', nombre: barretillas.meta.nombre, descripcion: barretillas.meta.descripcion, crear: () => barretillas.crear() },
  ...barretillas.LARGOS_PIES.map((pies) => ({
    id: `barretilla_${pies}ft`,
    nombre: `Barretilla ${pies} pies`,
    descripcion: `Barra de desatado de roca de ${pies} pies (punta cónica + bisel de palanca).`,
    crear: () => barretillas.crearBarretilla(pies)
  })),

  // --- Seguridad / delimitacion ---
  { id: 'cordon_bloqueo', nombre: cordonBloqueo.meta.nombre, descripcion: cordonBloqueo.meta.descripcion, crear: () => cordonBloqueo.crear({ ancho: 4.0 }) },

  // --- Basura / residuos (3 variantes) ---
  { id: 'basura_chatarra', nombre: 'Basura — chatarra metalica', descripcion: 'Malla vieja, cables y varillas en el piso.', crear: () => basura.crear({ variante: 'chatarra' }) },
  { id: 'basura_embalaje', nombre: 'Basura — materiales de embalaje', descripcion: 'Cajas de carton, bolsas plasticas y papel disperso.', crear: () => basura.crear({ variante: 'embalaje' }) },
  { id: 'basura_mixta',    nombre: 'Basura — mixta con lona (tipica)', descripcion: 'Lona roja + cajas + cables + malla. La mas comun en mina.', crear: () => basura.crear({ variante: 'mixta' }) }
];
