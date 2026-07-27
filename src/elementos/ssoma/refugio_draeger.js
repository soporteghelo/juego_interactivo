import * as THREE from 'three';
import { MineMaterials, PALETTE } from '../../world/materials/MineMaterials.js';
import { sub } from '../_comun/subelemento.js';

/**
 * REFUGIO MINERO DRÄGER (cámara de rescate, capacidad 20 personas).
 *
 * Reconstrucción a partir de fotos reales (Dräger | SIMSA — NEXA):
 *
 *  EXTERIOR ─ Contenedor de acero blanco sobre patín (skid), franjas reflectivas
 *  rojo/blanco en zócalo y esquinas, logo azul "Dräger" en el costado, cáncamos de
 *  izaje en las 4 esquinas superiores, rejilla de ventilación lateral, y en la cara
 *  frontal: puerta estanca con ojo de buey, manijas/volante, y columna semáforo
 *  rojo/ámbar/verde con placas de señalización. Ruedas/rodillos en la base.
 *
 *  INTERIOR ─ Anatomía según diagrama Dräger (5 zonas):
 *   1. PRECÁMARA (esclusa): área de transición tras la puerta exterior, separada de
 *      la cámara principal por un mamparo con segunda puerta estanca (ojo de buey).
 *   2. BPU "Dräger | SIMSA": unidad azul que purifica el aire — pantalla, paro de
 *      emergencia rojo y botón verde.
 *   3. BANCO DE BATERÍAS: estantería al fondo con cajas de baterías (energía
 *      ininterrumpida para iluminación y A/C).
 *   4. CILINDROS DE O2: blancos (correa naranja), azules Dräger junto a la BPU y
 *      negros de alta presión junto al mamparo de la esclusa.
 *   5. ASIENTOS Y ALMACENAMIENTO: bancas-cajón con cojín y respaldo acolchado.
 *   + Techo abovedado con LED lineal, split A/C, manómetros, tubería y señalética.
 *
 *  Convención de ejes LOCAL (antes de colocar en escena):
 *    +X = largo (frente/puerta en +X, BPU al fondo en -X)
 *    +Z = ancho (costado del logo Dräger en +Z)
 *     Y = altura
 *
 *  El descriptor de interacción queda en group.userData.interactable.
 */

export const meta = {
  id: 'refugio_draeger',
  nombre: 'Refugio minero Dräger (20 personas)',
  descripcion:
    'Cámara de rescate Dräger|SIMSA, cap. 20. Exterior con franjas reflectivas, ' +
    'semáforo y puerta estanca; interior con precámara (esclusa), BPU, banco de ' +
    'baterías, cilindros de O2, bancas con respaldo, A/C y señalética. Interactuable.'
};

/**
 * GUION DEL RECORRIDO GUIADO (visor → "▶ Recorrido guiado").
 *
 * Presentación animada paso a paso del refugio: la pieza del paso queda a plena
 * vista, el resto se atenúa como radiografía y la cámara vuela hasta encuadrarla.
 * El orden sigue la secuencia real de uso: se llega al refugio, se reconoce por
 * fuera, se entra por la esclusa, se activan los sistemas de vida y, al final, se
 * revisa la habitabilidad para las 36 h de autonomía.
 *
 * Cada paso:
 *   sub    id del subelemento (`sub(g, id, …)`); `null` = vista general del conjunto
 *   yaw    azimut de cámara en grados — 0° = de frente (lado de la puerta, +X),
 *          90° = costado del logo (+Z), 180° = por detrás (gabinete, -X)
 *   pitch  elevación en grados sobre la horizontal
 *   dist   holgura del encuadre: 1 = la pieza entra justa en pantalla,
 *          >1 deja contexto alrededor (útil en piezas pequeñas)
 *   dur    segundos de lectura antes de pasar solo al siguiente
 */
export const recorrido = {
  titulo: 'Refugio minero Dräger — 20 personas',
  pasos: [
    {
      sub: null, yaw: 34, pitch: 16, dist: 1.05, dur: 7,
      titulo: 'Cámara de rescate Dräger | SIMSA',
      texto:
        'Refugio minero presurizado para 20 personas y 36 horas de autonomía. Es el ' +
        'punto de reunión obligatorio ante incendio, irrupción de gases o colapso de la ' +
        'ventilación. Recorreremos su anatomía: primero el exterior, luego la esclusa y ' +
        'finalmente los sistemas que mantienen la vida dentro.'
    },
    {
      sub: 'skid', yaw: 48, pitch: 7, dist: 0.95, dur: 5,
      titulo: '1 · Patín (skid) y rodillos',
      texto:
        'Bastidor de acero sobre el que va montado todo el contenedor. Permite arrastrar ' +
        'o izar el refugio y reubicarlo cuando la labor avanza: el refugio SIEMPRE debe ' +
        'quedar a menos de 500 m del frente de trabajo.'
    },
    {
      sub: 'casco', yaw: 128, pitch: 24, dist: 1.05, dur: 6,
      titulo: '2 · Casco exterior estanco',
      texto:
        'Contenedor de acero con techo abovedado y cáncamos de izaje en las cuatro ' +
        'esquinas superiores. Las paredes son herméticas: junto con las dos puertas ' +
        'estancas sostienen la SOBREPRESIÓN interior que impide que entren gases.'
    },
    {
      sub: 'franjas_logos', yaw: 92, pitch: 9, dist: 1.0, dur: 5,
      titulo: '3 · Franjas reflectivas y logos',
      texto:
        'Cinta reflectiva naranja/blanco en zócalo y esquinas. En una labor con humo o ' +
        'sin energía, el reflejo de la lámpara de casco es lo primero que se ve: marca la ' +
        'silueta del refugio a distancia.'
    },
    {
      sub: 'puerta_exterior', yaw: 12, pitch: 4, dist: 0.85, dur: 7,
      titulo: '4 · Puerta estanca exterior',
      texto:
        'Hoja con ojo de buey y palancas de cierre sobre marco con sello de junta. ' +
        'Rotulada "REFUGIO MINERO — ENTRADA / ENTRY" y con la capacidad (20). Es la ' +
        'primera de las DOS puertas: nunca deben quedar ambas abiertas a la vez.'
    },
    {
      sub: 'semaforo', yaw: 24, pitch: 12, dist: 1.55, dur: 6,
      titulo: '5 · Semáforo de estado',
      texto:
        'Columna de luces visible desde la galería. VERDE fija: el refugio está ' +
        'alimentado por la red eléctrica de mina. ROJA fija: está corriendo con sus ' +
        'propias baterías. ÁMBAR intermitente: baliza de localización, siempre activa.'
    },
    {
      sub: 'senaletica_frontal', yaw: 26, pitch: 5, dist: 1.25, dur: 6,
      titulo: '6 · Señalética frontal',
      texto:
        'Placa con el número de refugio, instrucciones de ingreso y porta-documentos con ' +
        'el procedimiento de emergencia y los planos de escape del nivel. Se lee ANTES ' +
        'de abrir, sin quitarse los guantes.'
    },
    {
      sub: 'extintor_frontal', yaw: 42, pitch: 2, dist: 1.7, dur: 4.5,
      titulo: '7 · Extintor exterior',
      texto:
        'Extintor PQS montado en el frente, fuera de la cámara. Permite atacar un amago ' +
        'de fuego en la galería sin contaminar la atmósfera interior del refugio.'
    },
    {
      sub: 'precamara', yaw: 24, pitch: 8, dist: 0.95, dur: 7,
      titulo: '8 · Precámara (esclusa)',
      texto:
        'Área de transición entre las dos puertas estancas. Se entra, se CIERRA la puerta ' +
        'exterior y recién entonces se abre la interior: la esclusa purga el aire ' +
        'contaminado y evita que el gas de la labor pase a la cámara principal.'
    },
    {
      sub: 'bpu', yaw: -38, pitch: 8, dist: 1.0, dur: 8,
      titulo: '9 · BPU — unidad de protección respiratoria',
      texto:
        'El corazón del refugio. La Breathing Protection Unit Dräger | SIMSA hace ' +
        'recircular el aire: absorbe el CO2 con cal sodada, dosifica oxígeno y mantiene la ' +
        'sobrepresión. Su panel muestra O2, CO2, CO y presión; el pulsador rojo es el paro ' +
        'de emergencia.'
    },
    {
      sub: 'cilindros_o2', yaw: 18, pitch: 4, dist: 1.05, dur: 7,
      titulo: '10 · Batería de cilindros de O2',
      texto:
        'Reserva de oxígeno de alta presión que alimenta a la BPU y regenera la atmósfera. ' +
        'Junto a ellos va el cartel del procedimiento de suministro: se abren en el orden ' +
        'indicado y se controla el caudal según el número de ocupantes.'
    },
    {
      sub: 'banco_baterias', yaw: 168, pitch: 12, dist: 1.0, dur: 7,
      titulo: '11 · Gabinete de baterías de respaldo',
      texto:
        'Anexo adosado al testero, con rejillas louver para disipar calor y etiqueta de ' +
        'riesgo eléctrico. Da energía ininterrumpida a la BPU, la iluminación y el aire ' +
        'acondicionado cuando cae la red de mina — el caso para el que existe el refugio.'
    },
    {
      sub: 'equipos_baterias', yaw: 150, pitch: 30, dist: 1.25, dur: 5.5,
      titulo: '12 · Equipos sobre el gabinete',
      texto:
        'Rectificador/cargador y accesorios montados sobre el anexo, fuera del alcance del ' +
        'agua de escorrentía de la labor y del tránsito de equipo pesado.'
    },
    {
      sub: 'delineador_gabinete', yaw: -155, pitch: 10, dist: 1.5, dur: 4.5,
      titulo: '13 · Poste delineador de esquina',
      texto:
        'Delineador reflectivo en la esquina saliente del gabinete: protege la instalación ' +
        'de un golpe de scoop o dumper y da referencia de gálibo al operador.'
    },
    {
      sub: 'instrumentacion', yaw: -52, pitch: 18, dist: 0.9, dur: 7,
      titulo: '14 · Instrumentación y aire acondicionado',
      texto:
        'Monitores fijos de gases (tipo Dräger Polytron), manómetros de la línea de O2 y ' +
        'split de climatización. Con 20 personas encerradas, controlar temperatura y ' +
        'humedad es tan crítico como el propio oxígeno.'
    },
    {
      sub: 'tuberia', yaw: 62, pitch: 32, dist: 0.95, dur: 5,
      titulo: '15 · Tubería aérea de servicios',
      texto:
        'Líneas de aire y agua tendidas bajo la bóveda con abrazaderas. La conexión a la ' +
        'línea de aire comprimido de mina es el respaldo externo de la atmósfera del ' +
        'refugio.'
    },
    {
      sub: 'iluminacion_interior', yaw: 42, pitch: 28, dist: 0.95, dur: 5.5,
      titulo: '16 · Iluminación interior',
      texto:
        'LED lineal corrido en la bóveda más luminarias en la precámara, todo alimentado ' +
        'por las baterías. Luz permanente y sin calor: reduce el pánico y permite leer los ' +
        'instructivos durante toda la espera.'
    },
    {
      sub: 'asientos', yaw: 56, pitch: 16, dist: 0.95, dur: 7,
      titulo: '17 · Asientos y almacenamiento',
      texto:
        'Bancas-cajón con cojín y respaldo a ambos costados: 20 plazas sentadas y, bajo ' +
        'ellas, el almacenamiento de raciones de supervivencia, agua, botiquín, frazadas y ' +
        'el baño químico.'
    },
    {
      sub: 'acabados_interiores', yaw: 30, pitch: 20, dist: 1.0, dur: 5,
      titulo: '18 · Acabados interiores',
      texto:
        'Piso antideslizante, costillas de los paneles de pared y sensores de bóveda. ' +
        'Superficies claras y lavables: facilitan la limpieza y la inspección periódica ' +
        'exigida al refugio.'
    },
    {
      sub: 'senaletica_interior', yaw: 72, pitch: 8, dist: 0.95, dur: 6,
      titulo: '19 · Señalética interior',
      texto:
        'Instructivos de uso del baño químico y de los consumibles, planos de rescate del ' +
        'nivel, rotulación de SALIDA / EXIT en la puerta y prohibición de fuego. Todo el ' +
        'procedimiento queda a la vista de los 20 ocupantes.'
    },
    {
      sub: null, yaw: -142, pitch: 26, dist: 1.15, dur: 8,
      titulo: 'Conjunto — procedimiento de uso',
      texto:
        'Resumen: ingresar por la esclusa, cerrar ambas puertas estancas, activar la BPU, ' +
        'abrir el oxígeno según el cartel de procedimiento y comunicar por la línea de ' +
        'vida. Racionar consumibles y esperar al equipo de rescate: 36 horas de autonomía ' +
        'para 20 personas.'
    }
  ]
};

// ════════════════════════════════════════════════════════════════════════
//  UTILIDADES DE TEXTURA (CanvasTexture)
// ════════════════════════════════════════════════════════════════════════

function _lienzo(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function _aTextura(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeatX !== 1 || repeatY !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
  }
  return t;
}

/** Franjas diagonales NARANJA/blanco (cinta reflectiva, foto real). Se repite a lo largo. */
function _texturaRayas() {
  const { canvas, ctx } = _lienzo(128, 128);
  ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e05a12';
  ctx.lineWidth = 0;
  // franjas a 45°
  for (let i = -128; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 0);
    ctx.lineTo(i + 64 - 128, 128);
    ctx.lineTo(i - 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

/** Logo azul "Dräger" sobre fondo transparente. */
function _texturaLogo() {
  const { canvas, ctx } = _lienzo(512, 200);
  ctx.clearRect(0, 0, 512, 200);
  ctx.fillStyle = '#12307e';
  ctx.font = 'bold 150px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Dräger', 256, 108);
  return canvas;
}

/**
 * Rotulación de la puerta exterior (foto real): "REFUGIO MINERO" arriba,
 * flechas curvas amarillas de ingreso, "ENTRADA / ENTRY" y capacidad "20 + icono".
 * Deja libre la zona del ojo de buey y del volante (elementos 3D superpuestos).
 */
function _texturaPuerta() {
  const { canvas, ctx } = _lienzo(512, 1024);
  ctx.clearRect(0, 0, 512, 1024);
  // BORDE NEGRO REDONDEADO de la puerta (junta/sello, foto real)
  const r = 70, bx = 14, by = 14, bw = 512 - 28, bh = 1024 - 28;
  ctx.strokeStyle = '#1c1c1a';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#20241f';
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px Arial, sans-serif';
  ctx.fillText('REFUGIO', 256, 78);
  ctx.fillText('MINERO', 256, 128);
  // flecha curva NEGRA (↰) de ingreso, como la foto
  const flecha = (cx, cy, s) => {
    ctx.strokeStyle = '#1c1c1a';
    ctx.lineWidth = 15 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 62 * s);
    ctx.lineTo(cx, cy + 8 * s);
    ctx.quadraticCurveTo(cx, cy - 32 * s, cx - 42 * s, cy - 32 * s);
    ctx.stroke();
    ctx.fillStyle = '#1c1c1a';
    ctx.beginPath();
    ctx.moveTo(cx - 42 * s, cy - 58 * s);
    ctx.lineTo(cx - 42 * s, cy - 6 * s);
    ctx.lineTo(cx - 84 * s, cy - 32 * s);
    ctx.closePath();
    ctx.fill();
  };
  flecha(190, 470, 1.0);
  flecha(160, 830, 0.85);
  // ENTRADA / ENTRY
  ctx.fillStyle = '#20241f';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillText('ENTRADA', 330, 442);
  ctx.font = '34px Arial, sans-serif';
  ctx.fillText('ENTRY', 330, 486);
  // 20 + icono persona
  ctx.font = 'bold 74px Arial, sans-serif';
  ctx.fillText('20', 300, 668);
  ctx.beginPath(); ctx.arc(392, 614, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(380, 634, 24, 42);
  return canvas;
}

/**
 * Rotulación de la cara INTERIOR de la puerta de salida (foto real):
 * borde negro redondeado, "SALIDA" arriba, "EXIT" bajo el ojo de buey,
 * flechas curvas negras y pictograma rojo de PROHIBIDO FUEGO.
 */
function _texturaPuertaSalida() {
  const { canvas, ctx } = _lienzo(512, 1024);
  ctx.clearRect(0, 0, 512, 1024);
  ctx.fillStyle = '#1c1c1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // "SALIDA" arriba y "EXIT" bajo el ojo de buey
  ctx.font = 'bold 62px Arial, sans-serif';
  ctx.fillText('SALIDA', 256, 74);
  ctx.font = 'bold 58px Arial, sans-serif';
  ctx.fillText('EXIT', 256, 378);
  // Flechas negras de GIRO DE LA MANIJA: cola a la izquierda, codo y punta
  // hacia arriba (indican el sentido para desenclavar).
  const flechaGiro = (cx, cy, s) => {
    ctx.strokeStyle = '#141410';
    ctx.lineWidth = 18 * s;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 56 * s, cy + 64 * s);
    ctx.quadraticCurveTo(cx, cy + 64 * s, cx, cy + 6 * s);
    ctx.stroke();
    ctx.fillStyle = '#141410';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 52 * s);
    ctx.lineTo(cx + 30 * s, cy + 14 * s);
    ctx.lineTo(cx - 30 * s, cy + 14 * s);
    ctx.closePath();
    ctx.fill();
  };
  flechaGiro(368, 516, 1.0);
  flechaGiro(368, 800, 1.0);
  return canvas;
}

/**
 * Póster de plano/mapa de mina a color (fotos reales: esquemas NEXA junto a
 * la puerta). Red de galerías en rojo/naranja/verde sobre fondo claro.
 */
function _texturaMapa(sem = 1) {
  const { canvas, ctx } = _lienzo(360, 270);
  ctx.fillStyle = '#f4f2ea'; ctx.fillRect(0, 0, 360, 270);
  ctx.fillStyle = '#12307e'; ctx.fillRect(0, 0, 360, 30);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(sem === 1 ? 'ESQUEMA DE RESCATE — NV-1600' : 'UBICACIÓN DE REFUGIOS', 180, 21);
  const cols = ['#c22222', '#e07000', '#1a8f3c', '#666660'];
  let s = sem * 7919;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = cols[i % 4];
    ctx.beginPath();
    const x0 = 20 + rnd() * 320, yy = 45 + rnd() * 200;
    ctx.moveTo(x0, yy);
    ctx.lineTo(x0 + (rnd() - 0.3) * 120, yy + (rnd() - 0.5) * 80);
    ctx.lineTo(x0 + (rnd() - 0.3) * 160, yy + (rnd() - 0.5) * 110);
    ctx.stroke();
  }
  // punto rojo: "USTED ESTÁ AQUÍ" (refugio)
  ctx.fillStyle = '#c22222';
  ctx.beginPath(); ctx.arc(200, 150, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c22222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(200, 150, 14, 0, Math.PI * 2); ctx.stroke();
  return canvas;
}

/** Logo "Dräger | SIMSA — Breathing Protection Unit" para el frente de la BPU. */
function _texturaBPU() {
  const { canvas, ctx } = _lienzo(512, 160);
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Dräger', 24, 58);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(240, 20); ctx.lineTo(240, 92); ctx.stroke();
  ctx.font = '44px Arial, sans-serif';
  ctx.fillText('SIMSA', 260, 56);
  ctx.font = '30px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Breathing Protection Unit', 24, 122);
  return canvas;
}

/**
 * Cara del panel de control de la BPU (render Dräger): panel blanco con
 * indicadores verdes/rojos, dial y diagrama de flujo del sistema.
 */
function _texturaPanelBPU() {
  const { canvas, ctx } = _lienzo(360, 240);
  ctx.fillStyle = '#f2f2ec'; ctx.fillRect(0, 0, 360, 240);
  ctx.strokeStyle = '#9a9a92'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 352, 232);
  // título
  ctx.fillStyle = '#12307e'; ctx.font = 'bold 20px Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Dräger', 16, 30);
  ctx.fillStyle = '#333'; ctx.font = '13px Arial, sans-serif';
  ctx.fillText('Breathing Protection Unit', 92, 30);
  // indicadores (2 filas de pilotos verdes/rojos/ámbar)
  const cols = ['#1db93c', '#1db93c', '#d21f1f', '#1db93c', '#d8a11a', '#1db93c'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.arc(36 + (i % 3) * 44, 78 + Math.floor(i / 3) * 44, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
  }
  // diagrama de flujo (derecha)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
  ctx.strokeRect(190, 56, 152, 156);
  ctx.beginPath(); ctx.arc(230, 108, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(302, 162, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(252, 108); ctx.lineTo(302, 108); ctx.lineTo(302, 144); ctx.stroke();
  // dial inferior
  ctx.beginPath(); ctx.arc(80, 182, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(80, 182); ctx.lineTo(96, 166); ctx.stroke();
  return canvas;
}

/** Placa de señalética gris con líneas de texto simuladas + título opcional. */
function _texturaPlaca(titulo, colorTitulo = '#1a1a1a') {
  const { canvas, ctx } = _lienzo(256, 340);
  ctx.fillStyle = '#dcdcd6'; ctx.fillRect(0, 0, 256, 340);
  ctx.strokeStyle = '#9a9a92'; ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 332);
  if (titulo) {
    ctx.fillStyle = colorTitulo;
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titulo, 128, 34);
  }
  // renglones de "texto" simulados
  ctx.fillStyle = '#5a5a54';
  for (let y = 64; y < 320; y += 18) {
    const w = 200 - Math.floor(Math.random() * 70);
    ctx.fillRect(28, y, w, 6);
  }
  return canvas;
}

/** Flecha roja de señalización (apunta hacia abajo, fotos reales del interior). */
function _texturaFlecha() {
  const { canvas, ctx } = _lienzo(128, 200);
  ctx.clearRect(0, 0, 128, 200);
  ctx.fillStyle = '#d21f1f';
  ctx.beginPath();
  ctx.moveTo(40, 8); ctx.lineTo(88, 8); ctx.lineTo(88, 118);
  ctx.lineTo(118, 118); ctx.lineTo(64, 193); ctx.lineTo(10, 118);
  ctx.lineTo(40, 118); ctx.closePath();
  ctx.fill();
  return canvas;
}

// ── Utilidades de composición de texto sobre canvas ─────────────────────

/** Dibuja `txt` centrado en `cx` con espaciado entre letras `esp` (tracking). */
function _textoEspaciado(ctx, txt, cx, cy, esp) {
  const anchos = [...txt].map((c) => ctx.measureText(c).width);
  const total = anchos.reduce((a, b) => a + b, 0) + esp * Math.max(0, txt.length - 1);
  let x = cx - total / 2;
  const alinPrev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < txt.length; i++) {
    ctx.fillText(txt[i], x, cy);
    x += anchos[i] + esp;
  }
  ctx.textAlign = alinPrev;
  return total;
}

/** Escribe `txt` con salto de línea automático. Devuelve la Y de la línea siguiente. */
function _parrafo(ctx, txt, x, y, maxW, lh) {
  let linea = '', yy = y;
  for (const palabra of txt.split(' ')) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (linea && ctx.measureText(prueba).width > maxW) {
      ctx.fillText(linea, x, yy); yy += lh; linea = palabra;
    } else {
      linea = prueba;
    }
  }
  if (linea) { ctx.fillText(linea, x, yy); yy += lh; }
  return yy;
}

/**
 * Tira rotulada de los paneles interiores (fotos reales): placa blanca con
 * filete negro y texto en mayúsculas muy espaciadas. El canvas se dimensiona
 * según el texto, así que el plano 3D debe tomar su relación de aspecto.
 * @param {string} texto
 * @param {{ tab?: string }} opts  `tab` = color del cuadrito lateral (p. ej. azul)
 */
function _texturaLetrero(texto, { tab = null } = {}) {
  const FUENTE = 'bold 64px Arial, sans-serif';
  const ESP = 13;
  const medidor = document.createElement('canvas').getContext('2d');
  medidor.font = FUENTE;
  const anchoTxt = [...texto].reduce((a, c) => a + medidor.measureText(c).width, 0)
    + ESP * Math.max(0, texto.length - 1);
  const W = Math.ceil(anchoTxt + 96 + (tab ? 44 : 0)), Hh = 128;
  const { canvas, ctx } = _lienzo(W, Hh);
  ctx.fillStyle = '#f4f3ee'; ctx.fillRect(0, 0, W, Hh);
  ctx.strokeStyle = '#171714'; ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, Hh - 6);
  ctx.fillStyle = '#141412';
  ctx.font = FUENTE;
  ctx.textBaseline = 'middle';
  _textoEspaciado(ctx, texto, (W - (tab ? 44 : 0)) / 2, Hh / 2 + 3, ESP);
  if (tab) { ctx.fillStyle = tab; ctx.fillRect(W - 46, 10, 34, Hh - 20); }
  return canvas;
}

/**
 * Placa instructiva de consumibles de emergencia (fotos reales del refugio):
 * título centrado con tracking, lista numerada, subtítulo "INSTRUCCIONES DE USO"
 * y segunda lista numerada, todo sobre placa clara con filete.
 * @param {string} titulo
 * @param {string[]} datos  puntos del bloque superior
 * @param {string[]} uso    puntos de "INSTRUCCIONES DE USO"
 */
function _texturaInstructivo(titulo, datos, uso) {
  const W = 560, Hh = 780;
  const { canvas, ctx } = _lienzo(W, Hh);
  ctx.fillStyle = '#edebe4'; ctx.fillRect(0, 0, W, Hh);
  ctx.strokeStyle = '#2a2a26'; ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, W - 8, Hh - 8);
  ctx.fillStyle = '#141412';
  ctx.textBaseline = 'alphabetic';

  // título (centrado, espaciado, con salto de línea manual por palabras)
  ctx.font = 'bold 30px Arial, sans-serif';
  const palabras = titulo.split(' ');
  const lineas = [];
  let ln = '';
  for (const p of palabras) {
    const prueba = ln ? `${ln} ${p}` : p;
    // el tracking añade ~4 px por carácter al medir
    if (ln && ctx.measureText(prueba).width + prueba.length * 4 > W - 90) { lineas.push(ln); ln = p; }
    else ln = prueba;
  }
  if (ln) lineas.push(ln);
  let y = 64;
  for (const l of lineas) { _textoEspaciado(ctx, l, W / 2, y, 4); y += 38; }

  // bloques numerados con sangría francesa
  const lista = (items, y0b) => {
    let yy = y0b;
    ctx.font = '21px Arial, sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < items.length; i++) {
      ctx.font = 'bold 21px Arial, sans-serif';
      ctx.fillText(`${i + 1}.`, 46, yy);
      ctx.font = '21px Arial, sans-serif';
      yy = _parrafo(ctx, items[i], 84, yy, W - 130, 29) + 10;
    }
    return yy;
  };
  y = lista(datos, y + 22);

  ctx.font = 'bold 27px Arial, sans-serif';
  y += 30;
  _textoEspaciado(ctx, 'INSTRUCCIONES DE USO', W / 2, y, 4);
  y = lista(uso, y + 40);
  return canvas;
}

/**
 * Cartel "INSTRUCCIONES PARA EL USO DEL BAÑO QUÍMICO" de la PRECÁMARA
 * (foto real): título, retícula de 6 viñetas Fig.1–Fig.6 con el esquema de
 * operación del inodoro portátil y cuatro bloques de texto —preparación,
 * antes de usarlo, luego de usarlo y vaciado.
 */
function _texturaBanoQuimico() {
  const W = 900, Hh = 1495;
  const { canvas, ctx } = _lienzo(W, Hh);
  ctx.fillStyle = '#f6f5ef'; ctx.fillRect(0, 0, W, Hh);
  ctx.strokeStyle = '#33332e'; ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, W - 10, Hh - 10);
  ctx.fillStyle = '#15150f';
  ctx.textBaseline = 'alphabetic';

  // ── título ──
  ctx.font = 'bold 25px Arial, sans-serif';
  _textoEspaciado(ctx, 'INSTRUCCIONES PARA EL USO DEL BAÑO QUIMICO', W / 2, 62, 1.2);

  // ── retícula de 6 viñetas ──
  const MG = 40, GAP = 14;
  const bw = (W - 2 * MG - 2 * GAP) / 3, bh = 218;
  for (let i = 0; i < 6; i++) {
    const bx = MG + (i % 3) * (bw + GAP);
    const by = 92 + Math.floor(i / 3) * (bh + GAP);
    ctx.strokeStyle = '#33332e'; ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#15150f';
    ctx.font = 'italic bold 19px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Fig. ${i + 1}`, bx + 12, by + 30);
    _figuraBanoQuimico(ctx, bx + bw * 0.53, by + bh * 0.60, bh / 140, i + 1);
  }

  // ── bloques de texto ──
  let y = 92 + 2 * (bh + GAP) + 52;
  const anchoTxt = W - 2 * MG - 40;
  const bloque = (titulo, items) => {
    ctx.fillStyle = '#15150f';
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(titulo, MG + 6, y);
    y += 35;
    ctx.font = '19px Arial, sans-serif';
    for (const it of items) {
      const m = it.match(/^([A-F])\.\s(.*)$/);
      if (m) {
        ctx.font = 'bold 19px Arial, sans-serif';
        ctx.fillText(`${m[1]}.`, MG + 14, y);
        ctx.font = '19px Arial, sans-serif';
        y = _parrafo(ctx, m[2], MG + 42, y, anchoTxt - 2, 27);
      } else {
        y = _parrafo(ctx, it, MG + 14, y, anchoTxt + 26, 27);
      }
    }
    y += 26;
  };

  bloque('Preparación para la unidad', [
    'A. Abra la válvula del tanque séptico, añada el desodorante contenido en la botella ' +
    'que se encuentra en su interior y posteriormente agregue la misma cantidad de agua ' +
    'destilada en el tanque séptico. (Fig. 1)',
    'B. Cierre la válvula.',
    'C. Retire la tapa ubicada en la parte superior y agregue agua destilada hasta que la ' +
    'línea indicadora frontal del tanque superior llegue al máximo. Vuelva a colocar la ' +
    'tapa y apriétela. (Fig. 2)'
  ]);
  bloque('Antes de usarlo', [
    'Levante la tapa para dejar escapar la presión que se haya acumulado debido al calor ' +
    'o a la altura y posteriormente cierre la tapa. Abra y cierre la válvula del tanque ' +
    'séptico teniendo precaución con las salpicaduras de desodorante. Deje abierta la ' +
    'válvula antes de usar el baño. (Fig. 3)'
  ]);
  bloque('Luego de usarlo', [
    'A. Cierre la válvula del tanque séptico para evitar los malos olores. (Fig. 4)',
    'B. Abra y cierre la bomba de pistón para lavar el recipiente superior. (Fig. 5)'
  ]);
  bloque('Para vaciar el baño', [
    'A. Vacíe el baño cuando la línea indicadora frontal del tanque séptico llegue al máximo.',
    'B. Verifique que el asa de la válvula esté cerrada. Separe los tanques jalándolos por los costados.',
    'C. Levante la perilla roja del tanque séptico para descargar el aire y evitar salpicaduras.',
    'D. Lleve el tanque séptico a un inodoro.',
    'E. Saque el caño de vertido de la base del tanque séptico, insértelo y vierta el ' +
    'contenido en el inodoro. (Fig. 6)',
    'F. Lave y vuelva a armar el baño químico.'
  ]);
  return canvas;
}

/** Viñeta esquemática del baño químico portátil para `_texturaBanoQuimico`. */
function _figuraBanoQuimico(ctx, cx, cy, s, n) {
  ctx.save();
  ctx.strokeStyle = '#22221c';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  // cuerpo: tanque superior (asiento) sobre tanque séptico
  const caja = (y0f, hf, wf) => {
    ctx.beginPath();
    ctx.moveTo(cx - wf * s, cy + y0f * s);
    ctx.lineTo(cx + wf * s, cy + y0f * s);
    ctx.lineTo(cx + (wf - 3) * s, cy + (y0f + hf) * s);
    ctx.lineTo(cx - (wf - 3) * s, cy + (y0f + hf) * s);
    ctx.closePath();
    ctx.stroke();
  };
  caja(-6, 26, 44);   // tanque séptico (base)
  caja(-30, 24, 40);  // tanque superior
  // tapa/asiento
  ctx.beginPath();
  ctx.moveTo(cx - 40 * s, cy - 30 * s);
  ctx.lineTo(cx + 40 * s, cy - 30 * s);
  ctx.stroke();
  // válvula del tanque séptico (costado izquierdo)
  ctx.beginPath();
  ctx.rect(cx - 50 * s, cy + 2 * s, 8 * s, 12 * s);
  ctx.stroke();

  if (n === 1) {                       // botella vertiendo desodorante
    ctx.beginPath();
    ctx.rect(cx - 12 * s, cy - 74 * s, 20 * s, 30 * s);
    ctx.moveTo(cx - 4 * s, cy - 44 * s);
    ctx.lineTo(cx - 4 * s, cy - 34 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 2 * s, cy - 30 * s, 3 * s, 0, Math.PI * 2);
    ctx.stroke();
  } else if (n === 2) {                // tapa retirada + llenado y línea de nivel
    ctx.beginPath();
    ctx.ellipse(cx + 18 * s, cy - 48 * s, 13 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.moveTo(cx + 18 * s, cy - 43 * s);
    ctx.lineTo(cx + 18 * s, cy - 32 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 34 * s, cy - 16 * s);
    ctx.lineTo(cx + 34 * s, cy - 16 * s);
    ctx.stroke();
  } else if (n === 3) {                // alivio de presión: flecha saliendo
    ctx.beginPath();
    ctx.moveTo(cx, cy - 34 * s);
    ctx.lineTo(cx, cy - 62 * s);
    ctx.moveTo(cx - 7 * s, cy - 54 * s);
    ctx.lineTo(cx, cy - 64 * s);
    ctx.lineTo(cx + 7 * s, cy - 54 * s);
    ctx.stroke();
  } else if (n === 4) {                // mano cerrando la válvula
    ctx.beginPath();
    ctx.arc(cx - 46 * s, cy + 8 * s, 11 * s, 0, Math.PI * 2);
    ctx.moveTo(cx - 46 * s, cy + 8 * s);
    ctx.lineTo(cx - 62 * s, cy + 18 * s);
    ctx.stroke();
  } else if (n === 5) {                // bomba de pistón con recorrido
    ctx.beginPath();
    ctx.rect(cx + 26 * s, cy - 58 * s, 9 * s, 26 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 30 * s, cy - 70 * s);
    ctx.lineTo(cx + 30 * s, cy - 58 * s);
    ctx.moveTo(cx + 24 * s, cy - 64 * s);
    ctx.lineTo(cx + 30 * s, cy - 72 * s);
    ctx.lineTo(cx + 36 * s, cy - 64 * s);
    ctx.stroke();
  } else if (n === 6) {                // tanque séptico separado + caño de vertido
    ctx.beginPath();
    ctx.moveTo(cx + 44 * s, cy + 6 * s);
    ctx.lineTo(cx + 66 * s, cy - 4 * s);
    ctx.stroke();
    ctx.fillStyle = '#c02020';         // perilla roja de descarga de aire
    ctx.beginPath();
    ctx.arc(cx + 20 * s, cy + 2 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Etiqueta adhesiva "PRECAUCIÓN — RIESGO ELÉCTRICO / ELECTRICAL HAZARD"
 * (foto real: pegatina amarilla con banda superior ámbar, triángulo con rayo
 * y texto bilingüe). Se dibuja dentro de un canvas ya existente.
 */
function _etiquetaRiesgo(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f0c200'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#17170f'; ctx.lineWidth = Math.max(2, h * 0.05);
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  // banda superior "PRECAUCIÓN" (rojo-naranja de la pegatina real)
  ctx.fillStyle = '#dd6a12'; ctx.fillRect(x + 6, y + 6, w - 12, h * 0.30);
  ctx.fillStyle = '#17170f';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${h * 0.21}px Arial, sans-serif`;
  ctx.fillText('PRECAUCIÓN', x + w / 2, y + 6 + h * 0.15);
  // triángulo negro con rayo amarillo
  const tcx = x + w * 0.21, tcy = y + h * 0.68, tr = h * 0.25;
  ctx.fillStyle = '#17170f';
  ctx.beginPath();
  ctx.moveTo(tcx, tcy - tr);
  ctx.lineTo(tcx + tr * 0.95, tcy + tr * 0.74);
  ctx.lineTo(tcx - tr * 0.95, tcy + tr * 0.74);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0c200';
  ctx.beginPath();
  ctx.moveTo(tcx + tr * 0.22, tcy - tr * 0.46);
  ctx.lineTo(tcx - tr * 0.26, tcy + tr * 0.12);
  ctx.lineTo(tcx + tr * 0.02, tcy + tr * 0.12);
  ctx.lineTo(tcx - tr * 0.14, tcy + tr * 0.58);
  ctx.lineTo(tcx + tr * 0.30, tcy - tr * 0.04);
  ctx.lineTo(tcx + tr * 0.02, tcy - tr * 0.04);
  ctx.closePath(); ctx.fill();
  // texto bilingüe
  ctx.fillStyle = '#17170f';
  ctx.textAlign = 'left';
  ctx.font = `bold ${h * 0.155}px Arial, sans-serif`;
  ctx.fillText('RIESGO ELÉCTRICO', x + w * 0.40, y + h * 0.60);
  ctx.font = `bold ${h * 0.135}px Arial, sans-serif`;
  ctx.fillText('ELECTRICAL HAZARD', x + w * 0.40, y + h * 0.80);
  ctx.restore();
}

/** La etiqueta de riesgo eléctrico como textura suelta (tableros, cajas). */
function _texturaEtiquetaRiesgo() {
  const { canvas, ctx } = _lienzo(192, 128);
  _etiquetaRiesgo(ctx, 0, 0, 192, 128);
  return canvas;
}

/**
 * Cara exterior de UNA hoja del gabinete "BATERÍAS DE RESPALDO" (fotos reales
 * del anexo trasero, mina NEXA):
 *   · chapa crema envejecida con escurrimientos y barro en el zócalo,
 *   · dos bandas de rejilla LOUVER en los cantos (ranuras con labio iluminado),
 *   · rótulo negro a tres líneas "BATERÍAS / DE / RESPALDO",
 *   · etiqueta amarilla de riesgo eléctrico bajo el rótulo.
 * `seed` desincroniza la suciedad entre las dos hojas.
 */
function _texturaPuertaBaterias(seed = 1) {
  const { canvas, ctx } = _lienzo(512, 512);
  let s = seed * 7907 + 13;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

  // chapa crema
  ctx.fillStyle = '#d6d2c4';
  ctx.fillRect(0, 0, 512, 512);
  // veladuras de polvo/óxido
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 18 + rnd() * 74;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(122,108,82,${0.03 + rnd() * 0.055})`);
    gr.addColorStop(1, 'rgba(122,108,82,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // escurrimientos verticales desde el borde inferior
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512, h = 70 + rnd() * 240, w = 2 + rnd() * 8;
    const gr = ctx.createLinearGradient(0, 512 - h, 0, 512);
    gr.addColorStop(0, 'rgba(90,78,58,0)');
    gr.addColorStop(1, `rgba(90,78,58,${0.10 + rnd() * 0.15})`);
    ctx.fillStyle = gr;
    ctx.fillRect(x, 512 - h, w, h);
  }
  // barro acumulado en el zócalo
  const gm = ctx.createLinearGradient(0, 424, 0, 512);
  gm.addColorStop(0, 'rgba(74,60,42,0)');
  gm.addColorStop(1, 'rgba(74,60,42,0.52)');
  ctx.fillStyle = gm; ctx.fillRect(0, 424, 512, 88);

  // bandas de rejilla (louver) en ambos cantos: 2 grupos de 8 ranuras
  const banda = (bx, bw) => {
    for (const gy of [92, 262]) {
      for (let i = 0; i < 8; i++) {
        const yy = gy + i * 17;
        ctx.fillStyle = '#403f37';                    // ranura en sombra
        ctx.fillRect(bx, yy, bw, 8);
        ctx.fillStyle = 'rgba(252,250,242,0.34)';     // labio inferior iluminado
        ctx.fillRect(bx, yy + 8, bw, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';           // sombra proyectada
        ctx.fillRect(bx, yy + 11, bw, 2);
      }
    }
  };
  banda(32, 52);
  banda(428, 52);

  // rótulo estarcido a tres líneas (sin tilde, como el letrero real)
  ctx.fillStyle = '#1a1a16';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 41px Arial, sans-serif';
  ctx.fillText('BATERIAS', 256, 182);
  ctx.fillText('DE', 256, 227);
  ctx.fillText('RESPALDO', 256, 272);

  // etiqueta amarilla de riesgo eléctrico
  _etiquetaRiesgo(ctx, 190, 312, 132, 88);
  return canvas;
}

/**
 * Chapa sucia genérica del gabinete (dintel, repisa y fondo del hueco): crema
 * con polvo, veladuras y escurrimientos, para que la estructura no quede más
 * limpia que las hojas rotuladas.
 */
function _texturaChapaSucia(seed = 1, base = '#d4d0c2') {
  const { canvas, ctx } = _lienzo(256, 256);
  let s = seed * 6421 + 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 48; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 44;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(116,102,78,${0.04 + rnd() * 0.06})`);
    gr.addColorStop(1, 'rgba(116,102,78,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 256, h = 40 + rnd() * 120;
    const gr = ctx.createLinearGradient(0, 256 - h, 0, 256);
    gr.addColorStop(0, 'rgba(88,76,56,0)');
    gr.addColorStop(1, `rgba(88,76,56,${0.08 + rnd() * 0.12})`);
    ctx.fillStyle = gr;
    ctx.fillRect(x, 256 - h, 2 + rnd() * 5, h);
  }
  return canvas;
}

/** Etiqueta de eficiencia energética del split (barras verde→rojo, foto real). */
function _texturaEtiquetaEnergia() {
  const { canvas, ctx } = _lienzo(128, 176);
  ctx.fillStyle = '#f7f7f3'; ctx.fillRect(0, 0, 128, 176);
  ctx.fillStyle = '#123f8f'; ctx.fillRect(0, 0, 128, 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EFICIENCIA', 64, 17);
  const barras = ['#0a8a34', '#4ea62a', '#93bb1e', '#dcc800', '#f0a000', '#e56a10', '#d01515'];
  for (let i = 0; i < barras.length; i++) {
    const y = 32 + i * 19;
    ctx.fillStyle = barras[i];
    ctx.fillRect(8, y, 44 + i * 9, 15);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String.fromCharCode(65 + i), 13, y + 12);
  }
  return canvas;
}

/**
 * Carcasa del condensador split: blanco de fábrica ya ensuciado por el polvo de
 * labor, con junta horizontal de la tapa (foto real: la unidad está manchada,
 * no es blanco limpio).
 */
function _texturaCarcasaAC() {
  const { canvas, ctx } = _lienzo(256, 256);
  let s = 4241;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = '#eceae4'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 12 + rnd() * 50;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(126,114,92,${0.035 + rnd() * 0.055})`);
    gr.addColorStop(1, 'rgba(126,114,92,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // escurrimientos desde el borde inferior
  for (let i = 0; i < 12; i++) {
    const x = rnd() * 256, h = 30 + rnd() * 90;
    const gr = ctx.createLinearGradient(0, 256 - h, 0, 256);
    gr.addColorStop(0, 'rgba(96,84,62,0)');
    gr.addColorStop(1, `rgba(96,84,62,${0.10 + rnd() * 0.14})`);
    ctx.fillStyle = gr;
    ctx.fillRect(x, 256 - h, 2 + rnd() * 4, h);
  }
  // junta horizontal de la tapa
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 44, 256, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(0, 47, 256, 2);
  return canvas;
}

/** Rótulo de una línea sobre placa (marcas de equipo, letreros de tablero). */
function _texturaRotulo(texto, { fondo = 'transparent', tinta = '#1b4a8f', tam = 34 } = {}) {
  const { canvas, ctx } = _lienzo(256, 64);
  if (fondo === 'transparent') ctx.clearRect(0, 0, 256, 64);
  else { ctx.fillStyle = fondo; ctx.fillRect(0, 0, 256, 64); }
  ctx.fillStyle = tinta;
  ctx.font = `bold ${tam}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 128, 34);
  return canvas;
}

/**
 * Carátula de un DRÄGER POLYTRON 5000 (transmisor fijo de gas; fotos reales
 * de la pared del fondo del refugio): disco claro con marca "Dräger /
 * Polytron 5000", LCD verde con la lectura, teclas ▲/▼ azules, tecla OK
 * amarillo-verde y LED de estado.
 */
function _texturaPolytron(valor = '19.7', unidad = 'Vol%') {
  const { canvas, ctx } = _lienzo(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#d7d7d0';
  ctx.beginPath(); ctx.arc(128, 128, 127, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a6a69e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#12307e';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Dräger', 128, 60);
  ctx.fillStyle = '#3a3a36';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Polytron 5000', 128, 84);
  // LCD verde con la lectura
  ctx.fillStyle = '#1e2a16'; ctx.fillRect(58, 100, 140, 62);
  ctx.fillStyle = '#8de24c'; ctx.fillRect(62, 104, 132, 54);
  ctx.fillStyle = '#16220c';
  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText(valor, 130, 126);
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(unidad, 94, 150);
  // teclas ▲ / ▼ / OK
  const tecla = (bx, by, col, txt, tinta = '#ffffff') => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(bx, by, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tinta;
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText(txt, bx, by + 1);
  };
  tecla(38, 118, '#1f5fbf', '▲');
  tecla(38, 168, '#1f5fbf', '▼');
  tecla(214, 168, '#c6d322', 'OK', '#1c1c14');
  // LED de estado verde + franja de etiqueta bajo el display
  ctx.fillStyle = '#2ee04a'; ctx.fillRect(118, 176, 20, 7);
  ctx.fillStyle = '#8d8d86'; ctx.fillRect(74, 194, 108, 16);
  return canvas;
}

/** Cuerpo de la baliza sonora: negro con segmentos claros (foto real). */
function _texturaBalizaSonora() {
  const { canvas, ctx } = _lienzo(256, 64);
  ctx.fillStyle = '#1b1b1e'; ctx.fillRect(0, 0, 256, 64);
  for (const bx of [10, 96, 182]) {
    ctx.fillStyle = '#e4e4de'; ctx.fillRect(bx, 0, 40, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx + 40, 0, 5, 64);
  }
  return canvas;
}

/**
 * Chapa del cilindro de O2 (fotos reales): crema mate envejecido con las
 * marcas de fabricación estarcidas en el hombro (norma, número de serie y
 * fecha de prueba hidrostática) y una cinta verde de identificación de gas.
 */
function _texturaCilindroO2(seed = 1) {
  const W = 512, Hh = 1024;
  const { canvas, ctx } = _lienzo(W, Hh);
  let s = seed * 5387 + 3;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = '#ddd5c2'; ctx.fillRect(0, 0, W, Hh);
  // veladuras de polvo y roce
  for (let i = 0; i < 54; i++) {
    const x = rnd() * W, y = rnd() * Hh, r = 26 + rnd() * 92;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(120,106,80,${0.03 + rnd() * 0.05})`);
    gr.addColorStop(1, 'rgba(120,106,80,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // marcas estarcidas: se repiten 2 veces alrededor del cilindro
  const linea1 = `ISO 9809-1  ${1400 + Math.floor(rnd() * 8000)}-${Math.floor(rnd() * 90 + 10)}`;
  const linea2 = `WC 50.0 L   PW 200 BAR   ${Math.floor(rnd() * 12 + 1)}/26`;
  // estampadas UNA sola vez (no envuelven el cilindro) y muy tenues, como
  // el troquelado real: apenas más oscuras que la chapa
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(72,62,46,0.40)';
  ctx.font = 'bold 19px "Courier New", monospace';
  ctx.fillText(linea1, W / 2, 96);
  ctx.font = 'bold 17px "Courier New", monospace';
  ctx.fillText(linea2, W / 2, 124);
  // tiras cortas de cinta verde de identificación de gas
  ctx.fillStyle = '#2f9f4a';
  for (const [tx, ty] of [[92, 620], [318, 596]]) ctx.fillRect(tx, ty, 16, 54);
  return canvas;
}

/**
 * Carátula del manómetro de alta del regulador de oxígeno (foto real):
 * dial blanco con "USE NO OIL" en rojo, escala interior en bar (0–250),
 * exterior en psi (0–3000) y aguja en reposo.
 */
function _texturaDialO2() {
  const { canvas, ctx } = _lienzo(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  const cx = 128, cy = 128;
  ctx.fillStyle = '#f6f5f0';
  ctx.beginPath(); ctx.arc(cx, cy, 126, 0, Math.PI * 2); ctx.fill();
  // ángulo de la escala: 0 abajo-izquierda → fondo abajo-derecha (270°)
  const ang = (u) => Math.PI * (0.75 + 1.5 * u);
  const punto = (u, r) => [cx + Math.cos(ang(u)) * r, cy + Math.sin(ang(u)) * r];
  // graduaciones
  for (let i = 0; i <= 50; i++) {
    const u = i / 50, mayor = i % 10 === 0;
    const [x1, y1] = punto(u, mayor ? 92 : 100);
    const [x2, y2] = punto(u, 108);
    ctx.strokeStyle = '#1c1c18';
    ctx.lineWidth = mayor ? 3.5 : 1.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // escala interior en BAR (negra)
  ctx.fillStyle = '#1c1c18';
  ctx.font = 'bold 19px Arial, sans-serif';
  for (let i = 0; i <= 5; i++) {
    const [x, y] = punto(i / 5, 74);
    ctx.fillText(String(i * 50), x, y);
  }
  // escala exterior en PSI (roja)
  ctx.fillStyle = '#c01818';
  ctx.font = 'bold 14px Arial, sans-serif';
  for (let i = 0; i <= 6; i++) {
    const [x, y] = punto(i / 6, 116);
    ctx.fillText(String(i * 500), x, y);
  }
  // leyenda de seguridad y unidad
  ctx.fillStyle = '#c01818';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText('USE NO OIL', cx, 92);
  ctx.fillStyle = '#1c1c18';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('bar', cx + 34, 150);
  // aguja en reposo (cerca del cero) y eje
  ctx.strokeStyle = '#1c1c18'; ctx.lineWidth = 4;
  const [ax, ay] = punto(0.03, 88);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke();
  ctx.fillStyle = '#2a2a24';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  // dos tornillos de la carátula
  ctx.fillStyle = '#8f8d84';
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.arc(cx + sx * 26, 186, 6, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

/** Calcomanía envolvente del regulador de oxígeno: banda azul + banda amarilla. */
function _texturaDecalRegulador() {
  const W = 512, Hh = 256;
  const { canvas, ctx } = _lienzo(W, Hh);
  ctx.fillStyle = '#1a4fa0'; ctx.fillRect(0, 0, W, 108);
  ctx.fillStyle = '#d8d8d2'; ctx.fillRect(0, 108, W, 26);
  ctx.fillStyle = '#e8c218'; ctx.fillRect(0, 134, W, Hh - 134);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Arial, sans-serif';
  for (let r = 0; r < 2; r++) ctx.fillText('OXYGEN', W / 4 + r * (W / 2), 60);
  ctx.fillStyle = '#1c1c14';
  ctx.font = 'bold 32px Arial, sans-serif';
  for (let r = 0; r < 2; r++) ctx.fillText('REGULATOR', W / 4 + r * (W / 2), 186);
  return canvas;
}

/** Escala impresa del flujómetro (l/min) que va tras el tubo transparente. */
function _texturaEscalaFlujo() {
  const W = 96, Hh = 384;
  const { canvas, ctx } = _lienzo(W, Hh);
  ctx.fillStyle = '#eceae2'; ctx.fillRect(0, 0, W, Hh);
  ctx.strokeStyle = '#1f3f2a';
  ctx.fillStyle = '#1f3f2a';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('O₂', 8, 22);
  ctx.font = '17px Arial, sans-serif';
  for (let i = 0; i <= 15; i++) {
    const y = 54 + (i / 15) * (Hh - 86);
    const mayor = i % 5 === 0;
    ctx.lineWidth = mayor ? 2.6 : 1.4;
    ctx.beginPath();
    ctx.moveTo(W - 8, y); ctx.lineTo(W - (mayor ? 40 : 26), y);
    ctx.stroke();
    if (mayor) ctx.fillText(String(15 - i), 8, y);
  }
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('l/min', 8, Hh - 14);
  return canvas;
}

/**
 * Cara de una caja de cartón de raciones guardada bajo los asientos
 * (fotos reales): kraft con pictogramas de manipulación, etiqueta blanca de
 * lote y las marcas rojas a mano del control de inventario.
 */
function _texturaCajaRacion(seed = 1) {
  const { canvas, ctx } = _lienzo(256, 256);
  let s = seed * 4133 + 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = '#c6a67e'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 12 + rnd() * 48;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(140,108,70,${0.04 + rnd() * 0.07})`);
    gr.addColorStop(1, 'rgba(140,108,70,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // pictogramas de manipulación en fila
  ctx.strokeStyle = '#33302a'; ctx.fillStyle = '#33302a'; ctx.lineWidth = 3;
  // «este lado arriba»: dos flechas sobre una línea
  for (const fx of [40, 66]) {
    ctx.beginPath();
    ctx.moveTo(fx, 96); ctx.lineTo(fx, 58);
    ctx.moveTo(fx - 8, 68); ctx.lineTo(fx, 56); ctx.lineTo(fx + 8, 68);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(28, 104); ctx.lineTo(78, 104); ctx.stroke();
  // «frágil»: copa
  ctx.beginPath();
  ctx.moveTo(108, 58); ctx.lineTo(112, 82);
  ctx.quadraticCurveTo(124, 92, 136, 82); ctx.lineTo(140, 58);
  ctx.moveTo(124, 90); ctx.lineTo(124, 100);
  ctx.moveTo(112, 102); ctx.lineTo(136, 102);
  ctx.stroke();
  // «proteger de la lluvia»: paraguas con gotas
  ctx.beginPath();
  ctx.arc(184, 84, 26, Math.PI, 0, true);   // media caña HACIA ARRIBA (toldo)
  ctx.moveTo(184, 84); ctx.lineTo(184, 106);
  ctx.stroke();
  for (const gx of [166, 202]) {
    ctx.beginPath(); ctx.arc(gx, 48, 4, 0, Math.PI * 2); ctx.fill();
  }
  // etiqueta blanca de lote
  ctx.fillStyle = '#f2f0e8'; ctx.fillRect(150, 168, 78, 34);
  ctx.strokeStyle = '#9a968c'; ctx.lineWidth = 2; ctx.strokeRect(150, 168, 78, 34);
  ctx.fillStyle = '#3a3730';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LOTE', 189, 184);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(`${Math.floor(rnd() * 900 + 100)}-26`, 189, 198);
  // marca roja a mano del inventario
  ctx.strokeStyle = '#b02a1c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(44, 176); ctx.lineTo(62, 214); ctx.lineTo(82, 176);
  ctx.moveTo(96, 176); ctx.lineTo(96, 214);
  ctx.stroke();
  return canvas;
}

/**
 * Cartel "PROCEDIMIENTO PARA SUMINISTRO DE OXÍGENO" que va junto a la batería
 * de cilindros (foto real): los tres pasos de operación y el cuadro de
 * regulación de caudal según el número de ocupantes del refugio.
 */
function _texturaProcedimientoO2() {
  const W = 1100, Hh = 634;
  const { canvas, ctx } = _lienzo(W, Hh);
  ctx.fillStyle = '#e9e7df'; ctx.fillRect(0, 0, W, Hh);
  ctx.strokeStyle = '#3a3a34'; ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, Hh - 12);
  ctx.fillStyle = '#17170f';
  ctx.textBaseline = 'alphabetic';

  ctx.font = 'bold 27px Arial, sans-serif';
  _textoEspaciado(ctx, 'PROCEDIMIENTO PARA SUMINISTRO DE OXÍGENO', W / 2, 50, 2.5);

  // ── pasos 1 y 2 ──
  const MG = 46, anchoTxt = W - 2 * MG - 34;
  let y = 96;
  ctx.textAlign = 'left';
  const paso = (n, txt) => {
    ctx.font = 'bold 17px Arial, sans-serif';
    ctx.fillText(`${n}.-`, MG, y);
    ctx.font = '17px Arial, sans-serif';
    y = _parrafo(ctx, txt, MG + 32, y, anchoTxt, 25) + 8;
  };
  paso(1, 'Abra lentamente la válvula de uno de los cilindros de oxígeno. El manómetro ' +
    'indicará la presión del oxígeno contenido en el cilindro.');
  paso(2, 'Proceda a abrir la válvula del rotámetro y fije el caudal de oxígeno de acuerdo ' +
    'a la cantidad de personas que se encuentran al interior del refugio a razón de 0,5 ' +
    'litros por minuto (LPM) por persona o de acuerdo al siguiente cuadro.');

  // ── cuadro de regulación ──
  const tx = MG - 10, tw = W - 2 * (MG - 10);
  const fr = [0.21, 0.28, 0.27, 0.24];
  const colX = [tx];
  for (const f of fr) colX.push(colX[colX.length - 1] + f * tw);
  let ty = y + 16;
  ctx.lineWidth = 2.5;
  ctx.textAlign = 'center';

  const hAlt = 56;
  ctx.strokeRect(tx, ty, tw, hAlt);
  ctx.font = 'bold 18px Arial, sans-serif';
  _textoEspaciado(ctx, 'REGULACIÓN DEL FLUJO DE OXÍGENO DE ACUERDO AL', tx + tw / 2, ty + 24, 1.5);
  _textoEspaciado(ctx, 'NÚMERO DE USUARIOS DEL REFUGIO', tx + tw / 2, ty + 47, 1.5);
  ty += hAlt;

  const FILAS = [
    ['1 - 2', '1 LPM', '11 - 12', '6 LPM'],
    ['3 - 4', '2 LPM', '13 - 14', '7 LPM'],
    ['5 - 6', '3 LPM', '15 - 16', '8 LPM'],
    ['7 - 8', '4 LPM', '17 - 18', '9 LPM'],
    ['9 - 10', '5 LPM', '19 - 20', '10 LPM']
  ];
  const cAlt = 60, fAlt = 38;
  ctx.strokeRect(tx, ty, tw, cAlt);
  // divisorias verticales, continuas hasta el pie del cuadro
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(colX[i], ty);
    ctx.lineTo(colX[i], ty + cAlt + FILAS.length * fAlt);
    ctx.stroke();
  }
  const CAB = [
    ['Número de personas'],
    ['Flujo de Oxígeno en', 'Litros por minuto', 'LPM'],
    ['Número de personas'],
    ['Flujo de Oxígeno en', 'Litros por minuto', 'LPM']
  ];
  ctx.font = 'bold 14px Arial, sans-serif';
  for (let i = 0; i < 4; i++) {
    const cxc = (colX[i] + colX[i + 1]) / 2;
    const yIni = ty + cAlt / 2 - (CAB[i].length - 1) * 9 + 5;
    CAB[i].forEach((l, k) => ctx.fillText(l, cxc, yIni + k * 18));
  }
  ty += cAlt;
  ctx.font = '17px Arial, sans-serif';
  for (const fila of FILAS) {
    ctx.strokeRect(tx, ty, tw, fAlt);
    fila.forEach((v, i) => ctx.fillText(v, (colX[i] + colX[i + 1]) / 2, ty + 25));
    ty += fAlt;
  }

  // ── paso 3 bajo el cuadro ──
  y = ty + 32;
  ctx.textAlign = 'left';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText('3.-', MG, y);
  ctx.font = '17px Arial, sans-serif';
  _parrafo(ctx, 'Cuando la presión del cilindro sea de 50 kilos por centímetro cuadrado ' +
    '(Kg/cm²), proceda a cerrarlo y abrir el siguiente cilindro.', MG + 32, y, anchoTxt, 25);
  return canvas;
}

/** Mancha de humedad/óxido para la chapa del fondo (fotos reales). */
function _texturaMancha() {
  const { canvas, ctx } = _lienzo(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  let s = 3319;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = 74 + rnd() * 108, y = 74 + rnd() * 108, r = 24 + rnd() * 52;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(150,112,66,${0.10 + rnd() * 0.14})`);
    gr.addColorStop(0.65, `rgba(150,112,66,${0.04 + rnd() * 0.06})`);
    gr.addColorStop(1, 'rgba(150,112,66,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // máscara radial: garantiza que el parche no deje un borde recto visible
  const mask = ctx.createRadialGradient(128, 128, 40, 128, 128, 126);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.7, 'rgba(0,0,0,0.7)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = mask; ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

// ════════════════════════════════════════════════════════════════════════
//  SUBCONJUNTOS
// ════════════════════════════════════════════════════════════════════════

/** Manómetro circular (dial blanco con aguja) montado sobre soporte. */
function _manometro(radio = 0.07) {
  const grp = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(radio, radio, 0.03, 16),
    MineMaterials.plano(0x2a2a2a, { rough: 0.5, metal: 0.6 })
  );
  cuerpo.rotation.x = Math.PI / 2;
  grp.add(cuerpo);
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(radio * 0.86, 16),
    MineMaterials.plano(0xf4f4ee, { rough: 0.4 })
  );
  dial.position.z = 0.017;
  grp.add(dial);
  const aguja = new THREE.Mesh(
    new THREE.BoxGeometry(radio * 0.7, 0.006, 0.003),
    MineMaterials.plano(0xcc1111, { rough: 0.4 })
  );
  aguja.position.set(radio * 0.2, radio * 0.15, 0.02);
  aguja.rotation.z = 0.9;
  grp.add(aguja);
  return grp;
}

/**
 * DRÄGER POLYTRON 5000 — transmisor fijo de gas a prueba de explosión.
 * Carcasa de acero inoxidable cilíndrica con aletas de fundición, bisel y
 * carátula con LCD; opcionalmente cuelga el DrägerSensor (capuchón negro con
 * banda de color del gas). Se construye mirando a +X (hacia la sala).
 *
 * @param {{ valor?:string, unidad?:string, gas?:string, colorGas?:number }} opts
 */
function _polytron5000({ valor = '19.7', unidad = 'Vol%', gas = null, colorGas = 0x1f5fbf } = {}) {
  const grp = new THREE.Group();
  const mInox = MineMaterials.plano(0xa9a9a2, { rough: 0.32, metal: 0.8 });
  const mNegroCap = MineMaterials.plano(0x18181a, { rough: 0.55, metal: 0.15 });
  const R = 0.064;

  // cuerpo cilíndrico (eje a lo largo de X)
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.085, 18), mInox);
  cuerpo.rotation.z = Math.PI / 2;
  cuerpo.castShadow = true;
  grp.add(cuerpo);
  // bisel roscado de la tapa
  const bisel = new THREE.Mesh(new THREE.TorusGeometry(R - 0.004, 0.011, 8, 20), mInox);
  bisel.rotation.y = Math.PI / 2;
  bisel.position.x = 0.043;
  grp.add(bisel);
  // aletas/orejas de fundición cada 45°
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const oreja = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.019, 0.011), mInox);
    oreja.position.set(0.008, Math.sin(ang) * (R + 0.002), Math.cos(ang) * (R + 0.002));
    oreja.rotation.x = -ang;
    grp.add(oreja);
  }
  // carátula con LCD
  const cara = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.008, 22),
    new THREE.MeshStandardMaterial({
      map: _aTextura(_texturaPolytron(valor, unidad)), transparent: true, roughness: 0.35, metalness: 0.1
    })
  );
  cara.rotation.y = Math.PI / 2;
  cara.position.x = 0.05;
  grp.add(cara);

  // capuchón DrägerSensor colgando, con banda del gas
  if (gas) {
    const cuelloS = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.03, 10), mInox);
    cuelloS.position.y = -R - 0.012;
    grp.add(cuelloS);
    const tuercaS = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 6), mInox);
    tuercaS.position.y = -R - 0.036;
    grp.add(tuercaS);
    const capuchon = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.115, 14), mNegroCap);
    capuchon.position.y = -R - 0.105;
    capuchon.castShadow = true;
    grp.add(capuchon);
    const bandaGas = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0325, 0.0325, 0.026, 14),
      MineMaterials.plano(colorGas, { rough: 0.5, metal: 0.1 })
    );
    bandaGas.position.y = -R - 0.062;
    grp.add(bandaGas);
    const etqGas = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 0.02),
      new THREE.MeshStandardMaterial({
        map: _aTextura(_texturaRotulo(gas, { tinta: '#ffffff', tam: 40 })), transparent: true, roughness: 0.6
      })
    );
    etqGas.rotation.y = Math.PI / 2;
    etqGas.position.set(0.0335, -R - 0.062, 0);
    grp.add(etqGas);
  }
  return grp;
}

/**
 * Cilindro de O2 de alta presión (fotos reales del refugio): cuerpo CREMA mate
 * con las marcas de fabricación estarcidas en el hombro y cinta verde de gas;
 * ojiva del mismo color (no lleva capa verde), pie reforzado y cuello roscado.
 * Sigue siendo parametrizable para las variantes del diagrama Dräger
 * (negros de alta presión, azules de la BPU).
 *
 * @param {number} alto   altura del tramo cilíndrico
 * @param {number} radio  radio del cilindro
 */
function _cilindroO2(alto = 1.15, radio = 0.115, {
  cuerpo: cCuerpo = null, ojiva: cOjiva = null, metal = 0.2, seed = 1
} = {}) {
  const grp = new THREE.Group();
  // por defecto usa la chapa crema texturizada; si se pide un color plano
  // (variantes negra/azul) se cae al material liso de siempre
  const matCuerpo = cCuerpo === null
    ? new THREE.MeshStandardMaterial({
        map: _aTextura(_texturaCilindroO2(seed)), roughness: 0.55, metalness: metal
      })
    : MineMaterials.plano(cCuerpo, { rough: 0.45, metal });
  const matOjiva = cOjiva === null
    ? MineMaterials.plano(0xddd5c2, { rough: 0.55, metal })
    : MineMaterials.plano(cOjiva, { rough: 0.5, metal: metal * 0.8 });

  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, alto, 24), matCuerpo);
  cuerpo.position.y = alto / 2;
  cuerpo.castShadow = true;
  grp.add(cuerpo);
  // pie reforzado (anillo de apoyo)
  const pie = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 1.02, radio * 1.02, 0.05, 24),
    MineMaterials.plano(0xc9c2b0, { rough: 0.7, metal: 0.15 })
  );
  pie.position.y = 0.025;
  grp.add(pie);
  // ojiva (hombro) achatada, como los cilindros de la foto
  const ojiva = new THREE.Mesh(
    new THREE.SphereGeometry(radio, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    matOjiva
  );
  ojiva.scale.y = 0.78;
  ojiva.position.y = alto;
  ojiva.castShadow = true;
  grp.add(ojiva);
  // cuello roscado + contratuerca
  const cuello = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.24, radio * 0.27, 0.075, 12),
    MineMaterials.plano(0x9a948a, { rough: 0.45, metal: 0.6 })
  );
  cuello.position.y = alto + radio * 0.72;
  grp.add(cuello);
  const collarin = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.33, radio * 0.33, 0.022, 12),
    MineMaterials.plano(0x8a857b, { rough: 0.45, metal: 0.65 })
  );
  collarin.position.y = alto + radio * 0.62;
  grp.add(collarin);
  return grp;
}

/**
 * CABEZAL de un cilindro de oxígeno (foto real de detalle): válvula de bronce
 * con volante oscuro, regulador cromado con calcomanía azul/amarilla "OXYGEN",
 * manómetro de alta (bar/psi, "USE NO OIL"), flujómetro de tubo con flotador y
 * escala l/min, perilla verde OPEN/SHUT y espiga de salida.
 * Se construye con la cara de lectura mirando a +X.
 */
function _cabezalO2() {
  const grp = new THREE.Group();
  const mBronce = MineMaterials.plano(0xb08a3a, { rough: 0.34, metal: 0.82 });
  const mCromoR = MineMaterials.plano(0xcccbc6, { rough: 0.3, metal: 0.7 });
  const mVolante = MineMaterials.plano(0x2e2a22, { rough: 0.5, metal: 0.45 });

  // ── válvula de bronce con volante oscuro ──
  const cuerpoV = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.085, 10), mBronce);
  cuerpoV.position.y = 0.042;
  grp.add(cuerpoV);
  const ejeV = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.032, 8), mCromoR);
  ejeV.position.y = 0.098;
  grp.add(ejeV);
  const volante = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.041, 0.012, 18), mVolante);
  volante.position.y = 0.116;
  grp.add(volante);
  const llanta = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.008, 8, 20), mVolante);
  llanta.rotation.x = Math.PI / 2;
  llanta.position.y = 0.118;
  grp.add(llanta);
  const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 10), mVolante);
  cubo.position.y = 0.126;
  grp.add(cubo);

  // ── salida lateral hacia el regulador (+X) ──
  const salida = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.055, 10), mBronce);
  salida.rotation.z = Math.PI / 2;
  salida.position.set(0.045, 0.045, 0);
  grp.add(salida);
  const tuercaU = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.022, 6), mBronce);
  tuercaU.rotation.z = Math.PI / 2;
  tuercaU.position.set(0.078, 0.045, 0);
  grp.add(tuercaU);

  // ── cuerpo del regulador con calcomanía envolvente ──
  const reg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.037, 0.037, 0.072, 20),
    new THREE.MeshStandardMaterial({
      map: _aTextura(_texturaDecalRegulador()), roughness: 0.3, metalness: 0.55
    })
  );
  reg.rotation.z = Math.PI / 2;
  reg.position.set(0.126, 0.045, 0);
  reg.castShadow = true;
  grp.add(reg);
  // perilla cromada de ajuste al frente
  const perilla = new THREE.Mesh(
    new THREE.SphereGeometry(0.021, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mCromoR
  );
  perilla.rotation.z = -Math.PI / 2;
  perilla.position.set(0.161, 0.045, 0);
  grp.add(perilla);
  const arandelaP = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 18), mCromoR);
  arandelaP.rotation.z = Math.PI / 2;
  arandelaP.position.set(0.16, 0.045, 0);
  grp.add(arandelaP);

  // ── manómetro de alta sobre vástago ──
  const vastago = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8), mCromoR);
  vastago.position.set(0.126, 0.095, 0);
  grp.add(vastago);
  const cajaMan = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.026, 20), mCromoR);
  cajaMan.rotation.z = Math.PI / 2;
  cajaMan.position.set(0.128, 0.152, 0);
  grp.add(cajaMan);
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.037, 24),
    new THREE.MeshStandardMaterial({
      map: _aTextura(_texturaDialO2()), transparent: true, roughness: 0.25, metalness: 0.05
    })
  );
  dial.rotation.y = Math.PI / 2;
  dial.position.set(0.142, 0.152, 0);
  grp.add(dial);
  const bisel = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 22), mCromoR);
  bisel.rotation.y = Math.PI / 2;
  bisel.position.set(0.143, 0.152, 0);
  grp.add(bisel);

  // ── flujómetro de tubo con flotador (costado +Z) ──
  const flu = new THREE.Group();
  flu.position.set(0.118, 0.035, 0.072);
  grp.add(flu);
  const escala = new THREE.Mesh(
    new THREE.PlaneGeometry(0.032, 0.128),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaEscalaFlujo()), roughness: 0.6 })
  );
  escala.rotation.y = Math.PI / 2;
  escala.position.set(-0.014, 0.128, 0);
  flu.add(escala);
  const tubo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.13, 14, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xdff0ea, roughness: 0.08, metalness: 0.05,
      transparent: true, opacity: 0.32, side: THREE.DoubleSide
    })
  );
  tubo.position.y = 0.128;
  flu.add(tubo);
  const flotador = new THREE.Mesh(
    new THREE.SphereGeometry(0.0105, 10, 8),
    MineMaterials.plano(0x1c1c1a, { rough: 0.35, metal: 0.5 })
  );
  flotador.position.y = 0.082;
  flu.add(flotador);
  for (const fy of [0.062, 0.196]) {
    const casq = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.024, 12), mCromoR);
    casq.position.y = fy;
    flu.add(casq);
  }
  // perilla verde OPEN/SHUT y espiga de salida
  const perillaV = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.024, 18),
    MineMaterials.plano(0x1e8a46, { rough: 0.55, metal: 0.1 })
  );
  perillaV.rotation.z = Math.PI / 2;
  perillaV.position.set(0.028, 0.046, 0);
  flu.add(perillaV);
  const ejeVerde = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 8), mCromoR);
  ejeVerde.rotation.z = Math.PI / 2;
  ejeVerde.position.set(0.014, 0.046, 0);
  flu.add(ejeVerde);
  const cuelloF = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 10), mCromoR);
  cuelloF.position.y = 0.028;
  flu.add(cuelloF);
  const espiga = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.011, 0.026, 10),
    MineMaterials.plano(0x2a2a26, { rough: 0.7, metal: 0.1 })
  );
  espiga.position.y = 0.004;
  flu.add(espiga);

  // ── manguera amarilla enrollada al cuello (foto real) ──
  for (let i = 0; i < 3; i++) {
    const lazo = new THREE.Mesh(
      new THREE.TorusGeometry(0.038 + i * 0.004, 0.006, 6, 18),
      MineMaterials.plano(0xd8b81c, { rough: 0.6, metal: 0.05 })
    );
    lazo.rotation.x = Math.PI / 2 + i * 0.12;
    lazo.position.set(0.004, 0.018 + i * 0.011, 0.006);
    grp.add(lazo);
  }
  return grp;
}

/**
 * BAÑO QUÍMICO PORTÁTIL de la precámara — el que describe el cartel de
 * instrucciones: dos cuerpos acoplados (tanque superior de agua limpia con
 * asiento y tapa, tanque séptico inferior), válvula de guillotina entre ambos
 * con su asa, bomba de pistón, indicadores de nivel y perilla roja de
 * descarga de aire del tanque séptico. Origen en el suelo, frente hacia +X.
 * @returns {THREE.Group}
 */
function _banoQuimico() {
  const g = new THREE.Group();
  g.name = 'bano_quimico';
  const W = 0.40, D = 0.38;                       // planta
  const hSep = 0.21, hSup = 0.20;                 // altura de cada tanque
  const mSeptico = MineMaterials.plano(0x8e9296, { rough: 0.5, metal: 0.05 });
  const mSuperior = MineMaterials.plano(0xdedbd2, { rough: 0.45, metal: 0.05 });
  const mGris = MineMaterials.plano(0x5c5f62, { rough: 0.5, metal: 0.1 });

  // tanque séptico (base) con faldón de apoyo
  const septico = new THREE.Mesh(new THREE.BoxGeometry(D, hSep, W), mSeptico);
  septico.position.y = hSep / 2;
  septico.castShadow = true;
  g.add(septico);
  const faldon = new THREE.Mesh(new THREE.BoxGeometry(D - 0.04, 0.03, W - 0.04), mGris);
  faldon.position.y = 0.015;
  g.add(faldon);
  // junta de acople entre tanques
  const junta = new THREE.Mesh(new THREE.BoxGeometry(D + 0.012, 0.018, W + 0.012), mGris);
  junta.position.y = hSep;
  g.add(junta);
  // tanque superior (agua limpia + taza) y tapa abatible
  const superior = new THREE.Mesh(new THREE.BoxGeometry(D - 0.02, hSup, W - 0.02), mSuperior);
  superior.position.y = hSep + 0.009 + hSup / 2;
  superior.castShadow = true;
  g.add(superior);
  const tapa = new THREE.Mesh(new THREE.BoxGeometry(D - 0.03, 0.028, W - 0.03), mSuperior);
  tapa.position.y = hSep + 0.009 + hSup + 0.014;
  g.add(tapa);
  const aroTaza = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.016, 8, 20),
    MineMaterials.plano(0xf0eee6, { rough: 0.4 })
  );
  aroTaza.rotation.x = Math.PI / 2;
  aroTaza.scale.set(1.0, 0.82, 1.0);
  aroTaza.position.set(-0.01, hSep + 0.009 + hSup + 0.03, 0);
  g.add(aroTaza);

  // válvula de guillotina entre tanques, con asa al frente
  const asaValvula = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.05), mGris);
  asaValvula.position.set(D / 2 + 0.03, hSep - 0.03, -0.10);
  g.add(asaValvula);
  const vastagoVal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.03), mGris);
  vastagoVal.position.set(D / 2 - 0.005, hSep - 0.03, -0.10);
  g.add(vastagoVal);

  // bomba de pistón en la esquina superior
  const cuerpoBomba = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.07, 12), mGris);
  cuerpoBomba.position.set(D / 2 - 0.06, hSep + 0.009 + hSup + 0.035, W / 2 - 0.07);
  g.add(cuerpoBomba);
  const embolo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.030, 0.026, 12),
    MineMaterials.plano(0x3a3d40, { rough: 0.5 })
  );
  embolo.position.set(D / 2 - 0.06, hSep + 0.009 + hSup + 0.082, W / 2 - 0.07);
  g.add(embolo);

  // perilla ROJA de descarga de aire del séptico (paso C del cartel)
  const perillaAire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.019, 0.018, 12),
    MineMaterials.plano(0xc2261c, { rough: 0.45 })
  );
  perillaAire.rotation.z = Math.PI / 2;
  perillaAire.position.set(D / 2 + 0.008, hSep - 0.075, 0.10);
  g.add(perillaAire);

  // ventanillas indicadoras de nivel de cada tanque
  for (const [ny, nc] of [[hSep - 0.055, 0xb8bcc0], [hSep + 0.009 + hSup - 0.05, 0xcfd4d8]]) {
    const nivel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.022),
      MineMaterials.plano(nc, { rough: 0.25, metal: 0.2 })
    );
    nivel.rotation.y = Math.PI / 2;
    nivel.position.set(D / 2 + 0.002, ny, -0.02);
    g.add(nivel);
  }
  // caño de vertido plegado en la trasera del séptico
  const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.10, 10), mGris);
  cano.rotation.z = Math.PI / 2;
  cano.position.set(-D / 2 - 0.02, hSep - 0.06, 0.02);
  g.add(cano);
  return g;
}

/** Film transparente que envuelve la mercadería estibada (fotos reales). */
function _matFilm() {
  return new THREE.MeshStandardMaterial({
    color: 0xeaf2ee, roughness: 0.12, metalness: 0.02,
    transparent: true, opacity: 0.22, side: THREE.DoubleSide
  });
}

/**
 * Balde plástico blanco con tapa y punto naranja de identificación, envuelto
 * en film (fotos reales del pañol bajo los asientos).
 */
function _baldeRefugio(radio = 0.13, alto = 0.22, colorPunto = 0xe86a18) {
  const grp = new THREE.Group();
  const mBlanco = MineMaterials.plano(0xf0efe8, { rough: 0.55, metal: 0.05 });
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 0.88, alto, 20), mBlanco);
  cuerpo.position.y = alto / 2;
  cuerpo.castShadow = true;
  grp.add(cuerpo);
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(radio * 1.04, radio * 1.04, 0.022, 20), mBlanco);
  tapa.position.y = alto + 0.011;
  grp.add(tapa);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(radio * 1.0, 0.008, 6, 20), mBlanco);
  aro.rotation.x = Math.PI / 2;
  aro.position.y = alto + 0.004;
  grp.add(aro);
  const punto = new THREE.Mesh(
    new THREE.CircleGeometry(radio * 0.26, 16),
    MineMaterials.plano(colorPunto, { rough: 0.5 })
  );
  punto.rotation.x = -Math.PI / 2;
  punto.position.y = alto + 0.023;
  grp.add(punto);
  // film de embalaje
  const film = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 1.07, radio * 0.93, alto + 0.05, 20, 1, true), _matFilm()
  );
  film.position.y = (alto + 0.05) / 2;
  grp.add(film);
  return grp;
}

/**
 * Banca-cajón del refugio: pañol de almacenamiento con tapas abatibles y
 * cojín. Con `segAbierto` una de las tapas queda levantada contra la pared y
 * el compartimento se ve por dentro (estado de inspección de las fotos).
 *
 * @param {number} largo
 * @param {number} prof
 * @param {number} alto
 * @param {{ sz?:number, segAbierto?:number }} opts  `sz` = costado del refugio
 *   donde se apoya (+1/−1); marca el canto de bisagra contra la pared.
 * @returns {THREE.Group} con `userData.hueco` = datos del compartimento abierto
 */
function _banca(largo, prof = 0.42, alto = 0.44, { sz = 1, segAbierto = -1 } = {}) {
  const grp = new THREE.Group();
  const mCajon = MineMaterials.plano(0xeceae2, { rough: 0.6, metal: 0.15 });
  const mInterior = MineMaterials.plano(0xdedbcf, { rough: 0.85, metal: 0.05 });
  const mCojin = MineMaterials.plano(0x63625c, { rough: 0.35, metal: 0.05 });
  const e = 0.02;                                     // espesor de tablero
  const nSeg = Math.max(2, Math.round(largo / 0.95));
  const segL = largo / nSeg;

  // ── caja: fondo, frentes y testeros (hueca, para ver el interior) ──
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.025, prof), mInterior);
  fondo.position.y = 0.0125;
  fondo.receiveShadow = true;
  grp.add(fondo);
  for (const sf of [-1, 1]) {
    const cara = new THREE.Mesh(new THREE.BoxGeometry(largo, alto, e), mCajon);
    cara.position.set(0, alto / 2, sf * (prof / 2 - e / 2));
    cara.castShadow = true;
    grp.add(cara);
  }
  for (const st of [-1, 1]) {
    const testero = new THREE.Mesh(new THREE.BoxGeometry(e, alto, prof), mCajon);
    testero.position.set(st * (largo / 2 - e / 2), alto / 2, 0);
    grp.add(testero);
  }
  // tabiques entre compartimentos
  for (let i = 1; i < nSeg; i++) {
    const tabique = new THREE.Mesh(new THREE.BoxGeometry(0.018, alto - 0.03, prof - 2 * e), mInterior);
    tabique.position.set(-largo / 2 + i * segL, (alto - 0.03) / 2, 0);
    grp.add(tabique);
  }

  // ── tapas + cojines, una por compartimento ──
  // La tapa del compartimento abierto NO se abate: el respaldo de pared se lo
  // impediría. Como en las fotos, se retira y queda apoyada de canto sobre el
  // asiento contiguo.
  const armarTapa = (cxT) => {
    const tg = new THREE.Group();
    const tapa = new THREE.Mesh(new THREE.BoxGeometry(segL - 0.012, 0.022, prof - 0.014), mCajon);
    tapa.castShadow = true;
    tg.add(tapa);
    const cojin = new THREE.Mesh(new THREE.BoxGeometry(segL - 0.03, 0.085, prof - 0.03), mCojin);
    cojin.position.y = 0.053;
    tg.add(cojin);
    // film que envuelve el cojín (fotos: acolchado forrado en plástico)
    const forro = new THREE.Mesh(new THREE.BoxGeometry(segL - 0.022, 0.095, prof - 0.022), _matFilm());
    forro.position.y = 0.053;
    tg.add(forro);
    // tirador embutido en el canto delantero
    const tirador = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.014, 0.02),
      MineMaterials.plano(0x8f8d84, { rough: 0.45, metal: 0.6 })
    );
    tirador.position.set(0, 0.002, -sz * (prof / 2 - 0.03));
    tg.add(tirador);
    tg.position.set(cxT, alto + 0.011, 0);
    return tg;
  };

  for (let i = 0; i < nSeg; i++) {
    const cx = -largo / 2 + segL * (i + 0.5);
    if (i !== segAbierto) { grp.add(armarTapa(cx)); continue; }

    // tapa retirada, apoyada y ladeada sobre el compartimento vecino
    const vecino = i > 0 ? -1 : 1;
    const suelta = armarTapa(cx + vecino * segL);
    suelta.position.y = alto + 0.135;
    suelta.position.z = sz * 0.03;
    suelta.rotation.set(sz * 0.17, 0, vecino * 0.07);
    grp.add(suelta);

    // tira LED del interior del pañol (fotos: el hueco va iluminado)
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(segL - 0.10, 0.012, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0xfff4e0, emissive: 0xffe8bc, emissiveIntensity: 2.2, roughness: 0.4
      })
    );
    led.position.set(cx, alto - 0.035, sz * (prof / 2 - 0.035));
    grp.add(led);
    grp.userData.hueco = { cx, segL, prof, alto, interior: prof - 2 * e - 0.01 };
  }
  return grp;
}

/**
 * Contenido estibado de un compartimento abierto (fotos reales):
 *  · `variante: 'quimicos'` → baldes blancos con punto naranja, tarro con
 *    banda verde y bidón translúcido de agua con tapones azules;
 *  · `variante: 'raciones'` → cajas de cartón de raciones con pictogramas,
 *    marcas rojas de inventario y film de embalaje.
 */
function _contenidoBanca(hueco, variante = 'quimicos') {
  const grp = new THREE.Group();
  const yBase = 0.025;
  if (variante === 'quimicos') {
    // baldes de 20 L: llenan el pañol casi hasta el borde, como en las fotos
    for (const dx of [-0.12, 0.15]) {
      const balde = _baldeRefugio(0.125, 0.32);
      balde.position.set(hueco.cx + dx, yBase, 0.005);
      grp.add(balde);
    }
    // tarro menor con banda verde de identificación
    const tarro = _baldeRefugio(0.075, 0.20, 0x1c6b3a);
    tarro.position.set(hueco.cx + 0.37, yBase, -0.03);
    grp.add(tarro);
    // bidón translúcido de agua con dos tapones azules
    const bidon = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.30, 0.19),
      new THREE.MeshStandardMaterial({
        color: 0xdfe8e0, roughness: 0.2, metalness: 0.02, transparent: true, opacity: 0.55
      })
    );
    bidon.position.set(hueco.cx - 0.35, yBase + 0.15, 0.0);
    grp.add(bidon);
    for (const tz of [-0.05, 0.05]) {
      const tapon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.032, 12),
        MineMaterials.plano(0x1e2a68, { rough: 0.5, metal: 0.1 })
      );
      tapon.position.set(hueco.cx - 0.35, yBase + 0.315, tz);
      grp.add(tapon);
    }
  } else {
    // dos hileras de cajas de raciones, la de arriba envuelta en film
    const matCaja = [1, 2, 3].map((k) => new THREE.MeshStandardMaterial({
      map: _aTextura(_texturaCajaRacion(k)), roughness: 0.85, metalness: 0.02
    }));
    let k = 0;
    for (let fila = 0; fila < 2; fila++) {
      for (const dx of [-0.175, 0.175]) {
        const caja = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.185, 0.27), matCaja[k % 3]);
        caja.position.set(hueco.cx + dx, yBase + 0.095 + fila * 0.192, 0);
        caja.rotation.y = (k % 2 ? 1 : -1) * 0.03;
        caja.castShadow = true;
        grp.add(caja);
        k++;
      }
    }
    // film sobre la estiba + cintas azules de precinto
    const film = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.40, 0.30), _matFilm());
    film.position.set(hueco.cx, yBase + 0.19, 0);
    grp.add(film);
    for (const dx of [-0.175, 0.175]) {
      const cinta = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.385, 0.006),
        MineMaterials.plano(0x2a55a8, { rough: 0.6 })
      );
      cinta.position.set(hueco.cx + dx, yBase + 0.19, -0.152);
      grp.add(cinta);
    }
  }
  return grp;
}

// ════════════════════════════════════════════════════════════════════════
//  REFUGIO
// ════════════════════════════════════════════════════════════════════════

/**
 * @param {{ ocupado?:boolean, numero?:number }} opts
 * @returns {THREE.Group}
 */
export function crear({ ocupado = false, numero = 2 } = {}) {
  const g = new THREE.Group();
  g.name = 'refugio_draeger';

  // ── Dimensiones del contenedor ───────────────────────────────────
  const L = 6.0;   // largo (X)
  const A = 2.94;  // ancho (Z) — ampliado +20% (pedido de diseño)
  const H = 2.45;  // alto de paredes (Y)
  const t = 0.06;  // espesor de panel
  const hSkid = 0.18; // altura del patín/skid

  // Materiales
  // Casco exterior verde pálido/crema (foto real en mina: Dräger N°2)
  const mAcero   = MineMaterials.plano(0xd9dfc9, { rough: 0.5, metal: 0.4 });
  const mAceroIn = MineMaterials.plano(0xf3f2ec, { rough: 0.7, metal: 0.15 }); // interior mate
  const mMarco   = MineMaterials.plano(0x9a9a96, { rough: 0.5, metal: 0.6 });
  const mBPU     = MineMaterials.plano(0x1559ad, { rough: 0.45, metal: 0.35 }); // azul Dräger
  const mNegro   = MineMaterials.plano(0x1a1a1a, { rough: 0.6, metal: 0.3 });
  const mCromo   = MineMaterials.plano(0xb8b8b8, { rough: 0.3, metal: 0.85 });

  const y0 = hSkid; // piso interior arranca sobre el patín

  // ════════════════════════════════════════════════════════════════
  //  PATÍN / SKID + RUEDAS
  // ════════════════════════════════════════════════════════════════
  // `S` es el grupo del SUBELEMENTO activo: cada sección agrupa sus piezas
  // para poder inspeccionarla/aislarla en el visor (discretización).
  let S = sub(g, 'skid', 'Patín (skid) y ruedas', 'Bastidor de acero sobre el que va montado el contenedor, con rodillos en las 4 esquinas.');
  const skid = new THREE.Mesh(new THREE.BoxGeometry(L + 0.1, hSkid, A + 0.1), mMarco);
  skid.position.y = hSkid / 2;
  skid.castShadow = true;
  S.add(skid);

  // largueros longitudinales
  for (const sz of [-1, 1]) {
    const larguero = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.1, 0.12), mMarco);
    larguero.position.set(0, hSkid * 0.5, sz * (A / 2 - 0.02));
    S.add(larguero);
  }
  // rodillos/ruedas en las 4 esquinas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const rueda = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12),
      MineMaterials.plano(0x2b2b2b, { rough: 0.7, metal: 0.2 })
    );
    rueda.rotation.x = Math.PI / 2;
    rueda.position.set(sx * (L / 2 - 0.2), 0.09, sz * (A / 2 - 0.05));
    S.add(rueda);
  }

  // ════════════════════════════════════════════════════════════════
  //  CASCO EXTERIOR (paredes, piso, techo abovedado)
  // ════════════════════════════════════════════════════════════════
  S = sub(g, 'casco', 'Casco exterior', 'Paredes, piso, techo abovedado, cáncamos de izaje y rejilla de ventilación.');
  // Piso
  const piso = new THREE.Mesh(new THREE.BoxGeometry(L, t, A), MineMaterials.plano(0x8f8a80, { rough: 0.95 }));
  piso.position.set(0, y0 + t / 2, 0);
  piso.receiveShadow = true;
  S.add(piso);

  // Pared trasera (-X, fondo donde va la BPU)
  const parTras = new THREE.Mesh(new THREE.BoxGeometry(t, H, A), mAcero);
  parTras.position.set(-L / 2, y0 + H / 2, 0);
  parTras.castShadow = true;
  S.add(parTras);
  // cara interior
  const parTrasIn = new THREE.Mesh(new THREE.PlaneGeometry(A, H), mAceroIn);
  parTrasIn.position.set(-L / 2 + t / 2 + 0.001, y0 + H / 2, 0);
  parTrasIn.rotation.y = Math.PI / 2;
  S.add(parTrasIn);

  // Paredes laterales (±Z)
  for (const sz of [-1, 1]) {
    const lat = new THREE.Mesh(new THREE.BoxGeometry(L, H, t), mAcero);
    lat.position.set(0, y0 + H / 2, sz * (A / 2));
    lat.castShadow = true;
    S.add(lat);
    // corrugado/paneles: líneas verticales sutiles
    for (let i = 1; i < 8; i++) {
      const ranura = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, H - 0.1, 0.008),
        MineMaterials.plano(0xcfcfca, { rough: 0.6, metal: 0.3 })
      );
      ranura.position.set(-L / 2 + (i * L) / 8, y0 + H / 2, sz * (A / 2 + t / 2 + 0.004));
      S.add(ranura);
    }
    // cara interior
    const latIn = new THREE.Mesh(new THREE.PlaneGeometry(L, H), mAceroIn);
    latIn.position.set(0, y0 + H / 2, sz * (A / 2 - t / 2 - 0.001));
    latIn.rotation.y = sz > 0 ? Math.PI : 0;
    S.add(latIn);
  }

  // Techo con ARCO SUTIL (foto real: flecha ~0.28 m, NO medio círculo).
  // Se usa un cilindro de radio grande y ángulo pequeño centrado en el ápice.
  const sArco = 0.28;                                        // flecha (altura del arco)
  const wArco = A / 2 + 0.05;                                // semi-ancho
  const rArco = (wArco * wArco + sArco * sArco) / (2 * sArco); // radio del arco
  const thArco = Math.asin(wArco / rArco);                   // semi-ángulo
  const cyArco = y0 + H - 0.02 - rArco * Math.cos(thArco);   // centro del círculo
  const arco = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco, rArco, L, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    mAcero
  );
  arco.rotation.z = Math.PI / 2;
  arco.position.set(0, cyArco, 0);
  arco.castShadow = true;
  S.add(arco);
  // cara interior del arco (clara)
  const arcoIn = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco - 0.03, rArco - 0.03, L - 0.02, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    new THREE.MeshStandardMaterial({ color: 0xf4f3ed, roughness: 0.85, metalness: 0.1, side: THREE.BackSide })
  );
  arcoIn.rotation.z = Math.PI / 2;
  arcoIn.position.set(0, cyArco + 0.03, 0);
  S.add(arcoIn);
  // tapas de creciente en los extremos (cierran el arco contra las paredes)
  const capShape = new THREE.Shape();
  capShape.absarc(0, -rArco * Math.cos(thArco), rArco, Math.PI / 2 - thArco, Math.PI / 2 + thArco, false);
  capShape.closePath();
  const capGeo = new THREE.ShapeGeometry(capShape, 16);
  const mCap = MineMaterials.plano(0xd9dfc9, { rough: 0.5, metal: 0.4 });
  mCap.side = THREE.DoubleSide;
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, mCap);
    cap.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    cap.position.set(sx * (L / 2 - 0.005), y0 + H - 0.02, 0);
    S.add(cap);
  }

  // ── Cáncamos de izaje (4 esquinas superiores) ────────────────────
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.018, 8, 14),
      mMarco
    );
    anillo.position.set(sx * (L / 2 - 0.35), y0 + H + 0.12, sz * (A / 2 - 0.2));
    S.add(anillo);
  }

  // ── Rejilla de ventilación lateral (costado -Z, cerca del frente) ─
  const rejilla = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 0.03),
    MineMaterials.plano(0xbdbdb8, { rough: 0.6, metal: 0.5 })
  );
  rejilla.position.set(L / 2 - 1.1, y0 + H - 0.55, -(A / 2 + t / 2 + 0.01));
  S.add(rejilla);
  for (let i = 0; i < 6; i++) {
    const lama = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.03, 0.04),
      MineMaterials.plano(0x77776f, { rough: 0.6, metal: 0.5 })
    );
    lama.position.set(L / 2 - 1.1, y0 + H - 0.72 + i * 0.06, -(A / 2 + t / 2 + 0.02));
    S.add(lama);
  }

  // ════════════════════════════════════════════════════════════════
  //  FRANJAS REFLECTIVAS ROJO/BLANCO (zócalo + esquinas)
  // ════════════════════════════════════════════════════════════════
  S = sub(g, 'franjas_logos', 'Franjas reflectivas y logos Dräger', 'Cinta reflectiva naranja/blanco en zócalo y esquinas + logos "Dräger".');
  const matRayasZ = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRayas(), L / 0.5, 1), roughness: 0.4, metalness: 0.2 });
  const matRayasX = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRayas(), A / 0.5, 1), roughness: 0.4, metalness: 0.2 });
  const matRayasV = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRayas(), 1, 4), roughness: 0.4, metalness: 0.2 });
  const zocaloH = 0.22;
  // zócalos longitudinales
  for (const sz of [-1, 1]) {
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(L, zocaloH), matRayasZ);
    fr.position.set(0, y0 + zocaloH / 2 + 0.02, sz * (A / 2 + t / 2 + 0.006));
    fr.rotation.y = sz > 0 ? 0 : Math.PI;
    S.add(fr);
  }
  // zócalo frontal (bajo la puerta, a los lados)
  const frFrente = new THREE.Mesh(new THREE.PlaneGeometry(A, zocaloH), matRayasX);
  frFrente.position.set(L / 2 + t / 2 + 0.006, y0 + zocaloH / 2 + 0.02, 0);
  frFrente.rotation.y = Math.PI / 2;
  S.add(frFrente);
  // franjas verticales en las 4 esquinas frontales/traseras
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fv = new THREE.Mesh(new THREE.PlaneGeometry(0.16, H - 0.1), matRayasV);
    fv.position.set(sx * (L / 2 + t / 2 + 0.006), y0 + (H - 0.1) / 2 + 0.05, sz * (A / 2 - 0.12));
    fv.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    S.add(fv);
  }

  // ── Logo "Dräger" en el costado +Z ───────────────────────────────
  const logoMat = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaLogo()), transparent: true, roughness: 0.5, metalness: 0.1 });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), logoMat);
  logo.position.set(0.6, y0 + H - 0.7, A / 2 + t / 2 + 0.006);
  S.add(logo);

  // ════════════════════════════════════════════════════════════════
  //  FRENTE: PUERTA ESTANCA + SEMÁFORO + PLACAS
  // ════════════════════════════════════════════════════════════════
  S = sub(g, 'puerta_exterior', 'Frente y puerta estanca exterior', 'Pared frontal, marco negro, hoja con ojo de buey, bisagras y palancas de apertura.');
  const xF = L / 2;   // plano frontal
  // Pared frontal con hueco de puerta: la construimos con 3 paneles (izq, der, dintel)
  const puertaW = 0.95, puertaH = 1.95;
  const doorZ = 0; // puerta CENTRADA en el ancho (igual que la puerta interna)
  const izqW = A / 2 + doorZ - puertaW / 2; // panel entre esquina -Z y puerta
  const derW = A / 2 - doorZ - puertaW / 2; // panel entre puerta y esquina +Z
  // panel lado -Z
  const pFrenteA = new THREE.Mesh(new THREE.BoxGeometry(t, H, izqW), mAcero);
  pFrenteA.position.set(xF, y0 + H / 2, -A / 2 + izqW / 2);
  S.add(pFrenteA);
  // panel lado +Z (aquí va el semáforo)
  const pFrenteB = new THREE.Mesh(new THREE.BoxGeometry(t, H, derW), mAcero);
  pFrenteB.position.set(xF, y0 + H / 2, A / 2 - derW / 2);
  S.add(pFrenteB);
  // dintel sobre la puerta
  const dintel = new THREE.Mesh(new THREE.BoxGeometry(t, H - puertaH, puertaW), mAcero);
  dintel.position.set(xF, y0 + puertaH + (H - puertaH) / 2, doorZ);
  S.add(dintel);

  // Marco de puerta NEGRO (junta/sello redondeado de la foto)
  const marco = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, puertaH + 0.12, puertaW + 0.12),
    MineMaterials.plano(0x1f1f1c, { rough: 0.6, metal: 0.3 })
  );
  marco.position.set(xF + 0.01, y0 + puertaH / 2, doorZ);
  S.add(marco);

  // Puerta con bisagras en +Z (izquierda del observador, como la foto) — pivote
  const puertaPivote = new THREE.Group();
  puertaPivote.position.set(xF + 0.03, y0, doorZ + puertaW / 2);
  S.add(puertaPivote);
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.07, puertaH, puertaW), mAceroIn);
  hoja.position.set(0, puertaH / 2, -puertaW / 2);
  hoja.castShadow = true;
  puertaPivote.add(hoja);
  // rotulación de la puerta (borde negro redondeado / REFUGIO MINERO / flechas / 20)
  const rotulo = new THREE.Mesh(
    new THREE.PlaneGeometry(puertaW - 0.06, puertaH - 0.06),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPuerta()), transparent: true, roughness: 0.6 })
  );
  rotulo.rotation.y = Math.PI / 2;
  rotulo.position.set(0.037, puertaH / 2, -puertaW / 2);
  puertaPivote.add(rotulo);
  // ojo de buey (porthole)
  const anilloVentana = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 10, 20), mMarco);
  anilloVentana.rotation.y = Math.PI / 2;
  anilloVentana.position.set(0.04, puertaH - 0.5, -puertaW / 2);
  puertaPivote.add(anilloVentana);
  const vidrio = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 20),
    new THREE.MeshStandardMaterial({ color: 0x0c1a22, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.75 })
  );
  vidrio.rotation.y = -Math.PI / 2;
  vidrio.position.set(0.045, puertaH - 0.5, -puertaW / 2);
  puertaPivote.add(vidrio);
  // 3 BISAGRAS en el canto de pivote (foto: lado izquierdo)
  for (const hy of [0.32, 0.98, 1.62]) {
    const bisagra = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), mAceroIn);
    bisagra.position.set(0.05, hy, -0.02);
    puertaPivote.add(bisagra);
  }
  // 2 PALANCAS largas de apertura con pomo (foto: cruzan el borde derecho)
  for (const hy of [puertaH - 0.68, puertaH - 1.42]) {
    const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), mCromo);
    brazo.rotation.x = Math.PI / 2; // a lo largo de Z
    brazo.position.set(0.075, hy, -puertaW + 0.1);
    puertaPivote.add(brazo);
    const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mCromo);
    pomo.position.set(0.075, hy, -puertaW + 0.1 - 0.31);
    puertaPivote.add(pomo);
    // eje/soporte de la palanca sobre la hoja
    const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mCromo);
    eje.rotation.z = Math.PI / 2;
    eje.position.set(0.05, hy, -puertaW + 0.22);
    puertaPivote.add(eje);
  }

  // ── PANEL DE LUCES 2×2 (foto real: ámbar/rojo arriba, verde abajo) ─
  S = sub(g, 'semaforo', 'Semáforo (panel de luces 2×2)', 'Luces roja/ámbar/verde de estado: verde=red de mina, rojo=baterías, ámbar=intermitente.');
  const panelLuz = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.56, 0.52),
    MineMaterials.plano(0xd6d3c4, { rough: 0.55, metal: 0.25 })
  );
  panelLuz.position.set(xF + t / 2 + 0.03, y0 + H - 0.6, A / 2 - 0.38);
  S.add(panelLuz);
  const lamparas = {};
  // Fila superior: ROJA a la izquierda del observador (+Z) y ÁMBAR/naranja
  // a la derecha (-Z); abajo verde + bisel de reserva.
  const defsLuz = [
    { id: 'rojo',    color: 0xcc1111, on: ocupado,  dy:  0.13, dz:  0.115 },
    { id: 'ambar',   color: 0xe08a00, on: true,     dy:  0.13, dz: -0.115 },
    { id: 'verde',   color: 0x28c838, on: !ocupado, dy: -0.13, dz:  0.115 },
    { id: 'reserva', color: 0x2a2a26, on: false,    dy: -0.13, dz: -0.115 }, // bisel vacío
  ];
  for (const d of defsLuz) {
    // bisel negro
    const bisel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.05, 16),
      MineMaterials.plano(0x1d1d1a, { rough: 0.5, metal: 0.4 })
    );
    bisel.rotation.z = Math.PI / 2;
    bisel.position.set(xF + t / 2 + 0.06, y0 + H - 0.6 + d.dy, A / 2 - 0.38 + d.dz);
    S.add(bisel);
    if (d.id === 'reserva') continue;
    const foco = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 10),
      MineMaterials.plano(d.on ? d.color : 0x201f1c, { emissive: d.color, emissiveIntensity: d.on ? 3.2 : 0 })
    );
    foco.position.set(xF + t / 2 + 0.09, y0 + H - 0.6 + d.dy, A / 2 - 0.38 + d.dz);
    S.add(foco);
    lamparas[d.id] = foco;
  }
  // luz puntual verde/roja de estado (halo/bloom)
  const luzEstado = new THREE.PointLight(ocupado ? 0xff2200 : 0x33ff44, 2.2, 3.5, 2);
  luzEstado.position.set(xF + 0.2, y0 + H - 0.6, A / 2 - 0.38);
  luzEstado.userData.staticLight = true; // indicador de estado: no lo gestiona el pool
  S.add(luzEstado);

  // ── Placas de señalética junto a la puerta (panel izquierdo) ─────
  S = sub(g, 'senaletica_frontal', 'Señalética frontal', 'Placas "REFUGIO N°" e instrucciones + porta-documentos de emergencia.');
  const placaMat = new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca(`REFUGIO N°${numero}`, '#12307e')), roughness: 0.6 });
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.45), placaMat);
  placa.position.set(xF + t / 2 + 0.02, y0 + H - 0.45, -A / 2 + izqW * 0.5);
  placa.rotation.y = Math.PI / 2;
  S.add(placa);
  const placa2 = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('INSTRUCCIONES')), roughness: 0.6 })
  );
  placa2.position.set(xF + t / 2 + 0.02, y0 + H - 1.05, -A / 2 + izqW * 0.5);
  placa2.rotation.y = Math.PI / 2;
  S.add(placa2);

  // ── Porta-documentos bajo las luces (marco metálico + hoja, foto) ─
  const cajaDoc = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.4, 0.32),
    MineMaterials.plano(0x8f8d82, { rough: 0.55, metal: 0.35 })
  );
  cajaDoc.position.set(xF + t / 2 + 0.03, y0 + H - 1.2, A / 2 - 0.38);
  S.add(cajaDoc);
  const docPlano = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.32),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('EMERGENCIA', '#c01818')), roughness: 0.8 })
  );
  docPlano.rotation.y = Math.PI / 2;
  docPlano.position.set(xF + t / 2 + 0.065, y0 + H - 1.2, A / 2 - 0.38);
  S.add(docPlano);

  // ── Extintor rojo montado en el frente (foto real, lado derecho) ─
  S = sub(g, 'extintor_frontal', 'Extintor frontal', 'Extintor rojo montado en el frente del contenedor.');
  const extFrente = new THREE.Group();
  extFrente.position.set(xF + 0.11, y0, A / 2 - 0.72);
  S.add(extFrente);
  const extCuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.46, 12),
    MineMaterials.plano(0xc41414, { rough: 0.45, metal: 0.25 })
  );
  extCuerpo.position.y = 0.72;
  extCuerpo.castShadow = true;
  extFrente.add(extCuerpo);
  const extCuello = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.07, 8),
    mCromo
  );
  extCuello.position.y = 0.985;
  extFrente.add(extCuello);
  const extManija = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.03, 0.02),
    MineMaterials.plano(0x1a1a1a, { rough: 0.5, metal: 0.4 })
  );
  extManija.position.y = 1.03;
  extFrente.add(extManija);
  // soporte al casco
  const extSoporte = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.05, 0.04),
    mMarco
  );
  extSoporte.position.set(-0.06, 0.85, 0);
  extFrente.add(extSoporte);

  // ── Logo "Dräger" también en el frente (zócalo, foto real) ───────
  S = sub(g, 'franjas_logos', 'Franjas reflectivas y logos Dräger');
  const logoFrente = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.23),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaLogo()), transparent: true, roughness: 0.5, metalness: 0.1 })
  );
  logoFrente.rotation.y = Math.PI / 2;
  logoFrente.position.set(xF + t / 2 + 0.008, y0 + 0.42, -(A / 2 - 0.72));
  S.add(logoFrente);

  // ════════════════════════════════════════════════════════════════
  //  1. PRECÁMARA (ESCLUSA) — área de transición contra gases tóxicos
  // ════════════════════════════════════════════════════════════════
  // Mamparo interior a ~1.05 m de la puerta exterior, con segunda puerta
  // estanca (ojo de buey + volante), alineada con la exterior.
  S = sub(g, 'precamara', 'Precámara (esclusa)', 'Mamparo con segunda puerta estanca, lámparas de emergencia, piso de rejilla y placa "PRECÁMARA".');
  const xBulk = L / 2 - 1.05;
  const mMamparo = MineMaterials.plano(0xeeede6, { rough: 0.65, metal: 0.2 });

  // panel lado -Z, panel lado +Z y dintel (mismo despiece que el frente)
  const mamA = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, izqW), mMamparo);
  mamA.position.set(xBulk, y0 + H / 2, -A / 2 + izqW / 2);
  S.add(mamA);
  const mamB = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, derW), mMamparo);
  mamB.position.set(xBulk, y0 + H / 2, A / 2 - derW / 2);
  S.add(mamB);
  const mamDintel = new THREE.Mesh(new THREE.BoxGeometry(0.05, H - puertaH, puertaW), mMamparo);
  mamDintel.position.set(xBulk, y0 + puertaH + (H - puertaH) / 2, doorZ);
  S.add(mamDintel);
  // tapa del hueco de la bóveda sobre el mamparo
  const mamTapa = new THREE.Mesh(new THREE.BoxGeometry(0.05, sArco + 0.12, A), mMamparo);
  mamTapa.position.set(xBulk, y0 + H + (sArco + 0.12) / 2 - 0.02, 0);
  S.add(mamTapa);

  // marco + puerta interior estanca (pivote en -Z, como la exterior)
  const marcoInt = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, puertaH + 0.12, puertaW + 0.12), mMarco
  );
  marcoInt.position.set(xBulk - 0.01, y0 + puertaH / 2, doorZ);
  S.add(marcoInt);
  const puertaIntPivote = new THREE.Group();
  puertaIntPivote.position.set(xBulk - 0.04, y0, doorZ + puertaW / 2);
  S.add(puertaIntPivote);
  const hojaInt = new THREE.Mesh(new THREE.BoxGeometry(0.06, puertaH, puertaW), mAceroIn);
  hojaInt.position.set(0, puertaH / 2, -puertaW / 2);
  hojaInt.castShadow = true;
  puertaIntPivote.add(hojaInt);
  // rotulación "SALIDA / EXIT" en la cara que mira a la cámara principal
  const rotuloSalida = new THREE.Mesh(
    new THREE.PlaneGeometry(puertaW - 0.06, puertaH - 0.06),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPuertaSalida()), transparent: true, roughness: 0.6 })
  );
  rotuloSalida.rotation.y = -Math.PI / 2;
  rotuloSalida.position.set(-0.032, puertaH / 2, -puertaW / 2);
  puertaIntPivote.add(rotuloSalida);
  // ── OJO DE BUEY (foto real): brida blanca atornillada con 12 pernos,
  //    aro interior de bronce y vidrio oscuro apenas velado por la luz
  //    de la precámara al otro lado ─────────────────────────────────
  const yOjo = puertaH - 0.42;
  const zOjo = -puertaW / 2;
  const bridaOjo = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.030, 10, 24), mAceroIn);
  bridaOjo.rotation.y = Math.PI / 2;
  bridaOjo.position.set(-0.036, yOjo, zOjo);
  puertaIntPivote.add(bridaOjo);
  const aroBronce = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.011, 8, 22),
    MineMaterials.plano(0x9a7a32, { rough: 0.4, metal: 0.75 }));
  aroBronce.rotation.y = Math.PI / 2;
  aroBronce.position.set(-0.038, yOjo, zOjo);
  puertaIntPivote.add(aroBronce);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const perno = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.016, 8), mCromo);
    perno.rotation.z = Math.PI / 2;
    perno.position.set(-0.050, yOjo + Math.sin(ang) * 0.172, zOjo + Math.cos(ang) * 0.172);
    puertaIntPivote.add(perno);
  }
  const vidrioInt = new THREE.Mesh(
    new THREE.CircleGeometry(0.122, 22),
    new THREE.MeshStandardMaterial({
      color: 0x262e2a, emissive: 0x4a4028, emissiveIntensity: 0.22,
      roughness: 0.5, metalness: 0.08, transparent: true, opacity: 0.96, side: THREE.DoubleSide
    })
  );
  vidrioInt.rotation.y = Math.PI / 2;
  vidrioInt.position.set(-0.038, yOjo, zOjo);
  puertaIntPivote.add(vidrioInt);

  // ── TRAVESAÑOS EN RELIEVE de la hoja (foto real: refuerzos que la
  //    dividen en tres paños, con el marco perimetral) ──────────────
  for (const ty of [1.11, 0.60]) {
    const trav = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.035, puertaW - 0.06), mAceroIn);
    trav.position.set(-0.041, ty, zOjo);
    puertaIntPivote.add(trav);
  }
  for (const [mw, mh, my, mz] of [
    [puertaW - 0.06, 0.026, puertaH - 0.035, zOjo],
    [puertaW - 0.06, 0.026, 0.035, zOjo],
    [0.026, puertaH - 0.09, puertaH / 2, -0.035],
    [0.026, puertaH - 0.09, puertaH / 2, -puertaW + 0.035]
  ]) {
    const marcoRel = new THREE.Mesh(new THREE.BoxGeometry(0.018, mh, mw), mAceroIn);
    marcoRel.position.set(-0.039, my, mz);
    puertaIntPivote.add(marcoRel);
  }

  // ── MANIJA DE PALANCA del lado del cierre (opuesto a las bisagras):
  //    cubo redondo, brazo horizontal, uñas de enclavamiento y retén ──
  const yMan = 1.03, zCubo = -puertaW + 0.13;
  const cuboMan = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.058, 20), mAceroIn);
  cuboMan.rotation.z = Math.PI / 2;
  cuboMan.position.set(-0.062, yMan, zCubo);
  cuboMan.castShadow = true;
  puertaIntPivote.add(cuboMan);
  // tornillo central del cubo
  const ejeMan = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 8), mCromo);
  ejeMan.rotation.z = Math.PI / 2;
  ejeMan.position.set(-0.094, yMan, zCubo);
  puertaIntPivote.add(ejeMan);
  // brazo hacia el canto de bisagras
  const brazoMan = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.46, 12), mAceroIn);
  brazoMan.rotation.x = Math.PI / 2;
  brazoMan.position.set(-0.072, yMan, zCubo + 0.25);
  brazoMan.castShadow = true;
  puertaIntPivote.add(brazoMan);
  const puntaMan = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 8), mAceroIn);
  puntaMan.position.set(-0.072, yMan, zCubo + 0.48);
  puertaIntPivote.add(puntaMan);
  // dos uñas colgando del cubo (enganchan los retenes del marco)
  // cuelgan por DEBAJO del cubo, sin solaparlo (evita el z-fighting). Van en
  // acero desnudo: pintadas del crema de la hoja se perderían contra ella.
  for (const [uz, ua] of [[-0.038, 0.22], [0.058, -0.14]]) {
    const una = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.15, 0.040), mMarco);
    una.position.set(-0.072, yMan - 0.145, zCubo + uz);
    una.rotation.x = ua;
    una.castShadow = true;
    puertaIntPivote.add(una);
  }
  // retén cuadrado atornillado a la hoja, bajo el brazo
  const retenMan = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.038, 0.04), mMarco);
  retenMan.position.set(-0.048, yMan - 0.035, zCubo + 0.30);
  puertaIntPivote.add(retenMan);
  // 3 bisagras en el canto de pivote (foto: bloques crema)
  for (const hy of [0.32, 0.98, 1.62]) {
    const bisInt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), mAceroIn);
    bisInt.position.set(-0.045, hy, -0.015);
    puertaIntPivote.add(bisInt);
  }
  // ── Lámparas DORADAS de emergencia flanqueando la puerta (foto) ───
  for (const szL of [-1, 1]) {
    const lampara = new THREE.Group();
    lampara.position.set(xBulk - 0.1, y0 + H - 0.38, doorZ + szL * 0.78);
    lampara.rotation.z = 0.5; // inclinadas hacia la cámara
    S.add(lampara);
    const cuerpoLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.17, 10),
      MineMaterials.plano(0xb08a2a, { rough: 0.35, metal: 0.7 })
    );
    lampara.add(cuerpoLamp);
    const focoLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      MineMaterials.plano(0xffe9b0, { rough: 0.3, emissive: 0xffcc55, emissiveIntensity: 1.6 })
    );
    focoLamp.position.y = -0.1;
    lampara.add(focoLamp);
  }
  // etiquetas blancas pequeñas sobre el dintel (foto: "VÁLVULA DE SOBREPRESIÓN")
  for (const szE of [-1, 1]) {
    const etiq = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.07),
      MineMaterials.plano(0xf4f4ee, { rough: 0.8 })
    );
    etiq.rotation.y = -Math.PI / 2;
    etiq.position.set(xBulk - 0.045, y0 + H - 0.22, doorZ + szE * 0.72);
    S.add(etiq);
  }

  // piso de rejilla antideslizante de la esclusa + placa "PRECÁMARA"
  const grating = new THREE.Mesh(
    new THREE.BoxGeometry(L / 2 - xBulk - 0.1, 0.02, A - 0.16),
    MineMaterials.plano(0x6f6e66, { rough: 0.9, metal: 0.3 })
  );
  grating.position.set((xBulk + L / 2) / 2, y0 + t + 0.011, 0);
  S.add(grating);
  const placaPre = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca('PRECÁMARA', '#12307e')), roughness: 0.7 })
  );
  placaPre.position.set(xBulk + 0.03, y0 + H - 0.55, A / 2 - derW * 0.5);
  placaPre.rotation.y = Math.PI / 2;
  S.add(placaPre);

  // ── Cartel "INSTRUCCIONES PARA EL USO DEL BAÑO QUÍMICO" (foto real) ──
  //  Va en el costado +Z de la esclusa, bajo la tubería aérea, plastificado
  //  y sujeto por cuatro remaches en las esquinas.
  const lienzoBano = _texturaBanoQuimico();
  const anchoBano = 0.44;
  const altoBano = anchoBano * (lienzoBano.height / lienzoBano.width);
  const zPre = A / 2 - t / 2 - 0.006;
  const carBano = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoBano, altoBano),
    new THREE.MeshStandardMaterial({ map: _aTextura(lienzoBano), roughness: 0.45, metalness: 0.05 })
  );
  carBano.position.set((xBulk + L / 2) / 2 - 0.03, y0 + 1.36, zPre);
  carBano.rotation.y = Math.PI;
  S.add(carBano);
  for (const rx of [-1, 1]) for (const ry of [-1, 1]) {
    const remache = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.006, 8),
      MineMaterials.plano(0x8f8e86, { rough: 0.45, metal: 0.6 })
    );
    remache.rotation.x = Math.PI / 2;
    remache.position.set(
      (xBulk + L / 2) / 2 - 0.03 + rx * (anchoBano / 2 - 0.022),
      y0 + 1.36 + ry * (altoBano / 2 - 0.022),
      zPre - 0.004
    );
    S.add(remache);
  }
  // ── El BAÑO QUÍMICO al que remite el cartel, en el suelo justo debajo ──
  const banoQ = _banoQuimico();
  banoQ.position.set((xBulk + L / 2) / 2 - 0.03, y0 + t + 0.022, zPre - 0.24);
  banoQ.rotation.y = Math.PI / 2;    // frente (asa, niveles y perilla) al pasillo
  S.add(banoQ);
  // rodapié de goma que lo mantiene en sitio
  const tacoBano = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.02, 0.06),
    MineMaterials.plano(0x2e2e2a, { rough: 0.9 })
  );
  tacoBano.position.set((xBulk + L / 2) / 2 - 0.03, y0 + t + 0.032, zPre - 0.045);
  S.add(tacoBano);

  // ════════════════════════════════════════════════════════════════
  //  INTERIOR — cámara principal
  // ════════════════════════════════════════════════════════════════
  // ── Luminaria LED lineal en el vértice de la bóveda ──────────────
  S = sub(g, 'iluminacion_interior', 'Iluminación interior', 'LED lineal de la bóveda, LED de precámara y luces puntuales.');
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4, roughness: 0.3 })
  );
  led.position.set(-0.5, y0 + H + 0.12, 0);
  S.add(led);
  // LED corto de la precámara
  const ledPre = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.3 })
  );
  ledPre.position.set((xBulk + L / 2) / 2, y0 + H + 0.12, 0);
  S.add(ledPre);
  const luzInt1 = new THREE.PointLight(0xf0f4ff, 6, 6, 2);
  luzInt1.position.set(1.0, y0 + H, 0);
  S.add(luzInt1);
  const luzInt2 = new THREE.PointLight(0xf0f4ff, 6, 6, 2);
  luzInt2.position.set(-1.4, y0 + H, 0);
  S.add(luzInt2);
  const luzPre = new THREE.PointLight(0xf0f4ff, 3, 3.5, 2);
  luzPre.position.set((xBulk + L / 2) / 2, y0 + H - 0.1, 0);
  S.add(luzPre);

  // ════════════════════════════════════════════════════════════════
  //  5. ASIENTOS Y ALMACENAMIENTO — bancas-cajón con cojín y respaldo
  // ════════════════════════════════════════════════════════════════
  // Bancas ampliadas HASTA EL FONDO: la +Z llega a la pared trasera; la -Z
  // deja el hueco de los balones de O2 blancos (grupo 2×2 junto a la BPU)
  S = sub(g, 'asientos', 'Asientos y almacenamiento',
    'Bancas-pañol con tapas abatibles, cojín forrado y respaldo. Un compartimento ' +
    'abierto por costado muestra la estiba real: baldes de químicos con punto ' +
    'naranja, bidón de agua y cajas de raciones envueltas en film.');
  const bancas = [
    // `segAbierto`: índice de la tapa levantada (estado de inspección)
    { sz:  1, largo: 4.55, cx: -0.625, segAbierto: 3, carga: 'quimicos' },
    { sz: -1, largo: 3.35, cx:  0.0,   segAbierto: 1, carga: 'raciones' },
  ];
  for (const { sz, largo, cx, segAbierto, carga } of bancas) {
    const banca = _banca(largo, 0.42, 0.44, { sz, segAbierto });
    banca.position.set(cx, y0 + t, sz * (A / 2 - 0.24));
    S.add(banca);
    // estiba visible dentro del compartimento abierto
    if (banca.userData.hueco) banca.add(_contenidoBanca(banca.userData.hueco, carga));
    // respaldo acolchado sobre la pared (fotos reales: rollo gris envuelto)
    const respaldo = new THREE.Mesh(
      new THREE.BoxGeometry(largo - 0.06, 0.30, 0.07),
      MineMaterials.plano(0x6b6a64, { rough: 0.4, metal: 0.05 })
    );
    respaldo.position.set(cx, y0 + 0.84, sz * (A / 2 - t - 0.055));
    S.add(respaldo);
  }

  // ── Piso interior de triplay (madera clara, fotos reales) ─────────
  S = sub(g, 'acabados_interiores', 'Acabados interiores', 'Piso de triplay, costillas de los paneles de pared y sensor/cámara de bóveda.');
  const pisoInt = new THREE.Mesh(
    new THREE.BoxGeometry(xBulk + L / 2 - 2 * t, 0.012, A - 2 * t),
    MineMaterials.plano(0x8a7358, { rough: 0.95 })
  );
  pisoInt.position.set((xBulk - L / 2) / 2, y0 + t + 0.007, 0);
  S.add(pisoInt);

  // ── Costillas verticales de los paneles de pared (fotos reales) ───
  const mCostilla = MineMaterials.plano(0xf0efe8, { rough: 0.55, metal: 0.15 });
  for (const szr of [-1, 1]) {
    for (const rx of [-2.45, -1.75, -0.85, 0.55, 1.75]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, H - 0.75, 0.04), mCostilla);
      rib.position.set(rx, y0 + 0.5 + (H - 0.75) / 2, szr * (A / 2 - t - 0.021));
      S.add(rib);
    }
  }

  // ── Sensor/cámara negro colgado de la bóveda, pegado al fondo (foto) ──
  const sensorTecho = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.12, 0.09),
    MineMaterials.plano(0x15151a, { rough: 0.4, metal: 0.3 })
  );
  sensorTecho.position.set(-2.25, y0 + H + 0.1, 0);
  S.add(sensorTecho);
  const lente = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 6),
    MineMaterials.plano(0x0a0a10, { rough: 0.2, metal: 0.5 })
  );
  lente.position.set(-2.25, y0 + H + 0.03, 0);
  S.add(lente);

  // ── Unidad de Protección Respiratoria (BPU) "Dräger | SIMSA" ──────
  S = sub(g, 'bpu', 'BPU Dräger | SIMSA', 'Unidad de protección respiratoria: gabinete azul, panel de control, paro de emergencia y torretas.');
  const bpu = new THREE.Group();
  bpu.position.set(-L / 2 + 0.55, y0 + t, 0); // contra el fondo (las baterías van en la recámara exterior)
  S.add(bpu);
  const gabAlto = 1.55, gabW = 0.62, gabD = 0.7;
  const gabinete = new THREE.Mesh(new THREE.BoxGeometry(gabD, gabAlto, gabW), mBPU);
  gabinete.position.set(0, gabAlto / 2, 0);
  gabinete.castShadow = true;
  bpu.add(gabinete);
  // rejilla de ventilación frontal NEGRA perforada (foto real)
  const grid = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.52, 0.46),
    MineMaterials.plano(0x14181c, { rough: 0.75, metal: 0.3 })
  );
  grid.position.set(gabD / 2 + 0.001, 0.82, 0);
  bpu.add(grid);
  // manguera negra enrollada colgada al costado frontal-izquierdo (foto)
  for (let i = 0; i < 3; i++) {
    const rollo = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.013, 8, 18),
      MineMaterials.plano(0x101012, { rough: 0.7 })
    );
    rollo.rotation.y = Math.PI / 2;
    rollo.position.set(gabD / 2 + 0.03 + i * 0.018, 0.72, -gabW / 2 + 0.1);
    bpu.add(rollo);
  }
  // panel de control INCLINADO (render Dräger): cara blanca con indicadores,
  // diagrama de flujo y dial + paro de emergencia y botón verde 3D
  const panelGrupo = new THREE.Group();
  panelGrupo.position.set(gabD / 2 - 0.07, gabAlto - 0.13, 0);
  panelGrupo.rotation.z = -0.38; // inclinado hacia el operador
  bpu.add(panelGrupo);
  const panelCtrl = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.3, 0.56),
    MineMaterials.plano(0x0f4a90, { rough: 0.5, metal: 0.3 })
  );
  panelGrupo.add(panelCtrl);
  const caraPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.26),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPanelBPU()), roughness: 0.5 })
  );
  caraPanel.rotation.y = Math.PI / 2;
  caraPanel.position.set(0.026, 0, 0);
  panelGrupo.add(caraPanel);
  const paro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14),
    MineMaterials.plano(0xd01111, { rough: 0.4, emissive: 0x400000, emissiveIntensity: 0.4 })
  );
  paro.rotation.z = Math.PI / 2;
  paro.position.set(0.04, -0.09, -0.21);
  panelGrupo.add(paro);
  const btnVerde = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.025, 12),
    MineMaterials.plano(0x18b038, { rough: 0.4, emissive: 0x0a4015, emissiveIntensity: 0.6 })
  );
  btnVerde.rotation.z = Math.PI / 2;
  btnVerde.position.set(0.038, -0.09, 0.21);
  panelGrupo.add(btnVerde);
  // dos TORRETAS superiores con letreros blancos (foto real: control de
  // oxígeno y esclusa de agua sobre el gabinete)
  for (const [tz, txt] of [[-0.17, 'CONTROL DE OXÍGENO'], [0.17, 'ESCLUSA DE AGUA']]) {
    const torre = new THREE.Mesh(new THREE.BoxGeometry(gabD * 0.8, 0.3, 0.26), mBPU);
    torre.position.set(-0.03, gabAlto + 0.15, tz);
    torre.castShadow = true;
    bpu.add(torre);
    const letrero = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.13),
      new THREE.MeshStandardMaterial({ map: _aTextura(_texturaPlaca(txt, '#444')), roughness: 0.7 })
    );
    letrero.rotation.y = Math.PI / 2;
    letrero.position.set(-0.03 + gabD * 0.4 + 0.002, gabAlto + 0.15, tz);
    bpu.add(letrero);
  }
  // etiqueta amarilla de advertencia (render: frontal inferior)
  const etiqueta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.07),
    MineMaterials.plano(0xf5c300, { rough: 0.6 })
  );
  etiqueta.rotation.y = Math.PI / 2;
  etiqueta.position.set(gabD / 2 + 0.002, 0.2, -0.18);
  bpu.add(etiqueta);
  // logo Dräger | SIMSA — Breathing Protection Unit
  const bpuLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.16),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaBPU()), transparent: true, roughness: 0.5 })
  );
  bpuLogo.rotation.y = Math.PI / 2;
  bpuLogo.position.set(gabD / 2 + 0.022, 0.46, 0);
  bpu.add(bpuLogo);

  // ── GRUPO de cilindros de O2 BLANCOS (2×2) junto a la BPU, con
  //    correa naranja y manifold de bronce con mini-manómetros ────────
  S = sub(g, 'cilindros_o2', 'Cilindros de O2',
    'Batería 2×2 de cilindros crema con marcas estarcidas y cinta verde, cabezal ' +
    'de bronce con volante, regulador "OXYGEN" con manómetro bar/psi, flujómetro ' +
    'de tubo y perilla verde, correa de sujeción y manifold de pared.');
  const o2Blancos = new THREE.Group();
  o2Blancos.position.set(-1.98, y0 + t, -A / 2 + 0.41);
  S.add(o2Blancos);
  const O2_ALTO = 1.6, O2_RADIO = 0.115;
  const posO2 = [];
  for (let i = 0; i < 4; i++) {
    const px = 0.13 - (i % 2) * 0.26, pz = -0.13 + Math.floor(i / 2) * 0.26;
    posO2.push([px, pz]);
    const cil = _cilindroO2(O2_ALTO, O2_RADIO, { seed: i + 1 });
    cil.position.set(px, 0, pz);
    o2Blancos.add(cil);
  }
  // ── Cabezal completo por cilindro, mirando al pasillo (+X) ──
  const yCabezal = O2_ALTO + O2_RADIO * 0.78 + 0.03;
  for (const [px, pz] of posO2) {
    const cab = _cabezalO2();
    cab.position.set(px, yCabezal, pz);
    o2Blancos.add(cab);
  }
  // ── Correa de sujeción con hebilla (D.S. 024: cilindros asegurados) ──
  const mCorrea = MineMaterials.plano(0xd86a10, { rough: 0.78, metal: 0.05 });
  const semiX = 0.13 + O2_RADIO, semiZ = 0.13 + O2_RADIO;  // tangente al grupo
  for (const cz of [-semiZ, semiZ]) {
    const tramo = new THREE.Mesh(new THREE.BoxGeometry(2 * semiX, 0.05, 0.012), mCorrea);
    tramo.position.set(0, 1.02, cz);
    o2Blancos.add(tramo);
  }
  for (const cx of [-semiX, semiX]) {
    const tramo = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 2 * semiZ), mCorrea);
    tramo.position.set(cx, 1.02, 0);
    o2Blancos.add(tramo);
  }
  const hebilla = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.062, 0.02),
    MineMaterials.plano(0x8a8880, { rough: 0.4, metal: 0.7 })
  );
  hebilla.position.set(0.07, 1.02, semiZ + 0.004);
  o2Blancos.add(hebilla);

  // ── Manifold de pared: dos tubos horizontales con abrazaderas y las
  //    latiguillos de cada cabezal subiendo hasta ellos (foto real) ──
  const mTuboO2 = MineMaterials.plano(0xa8a49a, { rough: 0.32, metal: 0.78 });
  for (const [ty, tz] of [[2.24, -0.33], [2.16, -0.33]]) {
    const tuboO2 = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.92, 12), mTuboO2);
    tuboO2.rotation.z = Math.PI / 2;
    tuboO2.position.set(0, ty, tz);
    o2Blancos.add(tuboO2);
  }
  for (const bx of [-0.34, 0.16]) {
    const abraz = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.15, 0.05),
      MineMaterials.plano(0x77746c, { rough: 0.5, metal: 0.55 })
    );
    abraz.position.set(bx, 2.20, -0.35);
    o2Blancos.add(abraz);
  }
  const mLatiguillo = MineMaterials.plano(0x8e8b82, { rough: 0.35, metal: 0.7 });
  for (const [px, pz] of posO2) {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px + 0.118, yCabezal + 0.20, pz + 0.072),
      new THREE.Vector3(px + 0.09, yCabezal + 0.30, pz + 0.02),
      new THREE.Vector3(px + 0.02, yCabezal + 0.38, pz - 0.14),
      new THREE.Vector3(px, 2.16, -0.31)
    ]);
    o2Blancos.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 20, 0.010, 6, false), mLatiguillo));
  }


  // ════════════════════════════════════════════════════════════════
  //  3. BANCO DE BATERÍAS — GABINETE EXTERIOR "BATERÍAS DE RESPALDO"
  //  Recámara adosada al testero trasero (diagrama Dräger, punto 3),
  //  reconstruida sobre fotos reales del anexo en labor:
  //    · testero con DOS hojas crema envejecidas, rotulado negro a tres
  //      líneas, bandas de louver en los cantos y etiqueta amarilla de
  //      riesgo eléctrico; manijas de barra junto a la junta central;
  //    · REPISA DE SERVICIO sobre las hojas, retranqueada bajo la visera
  //      abovedada: condensador split, tablero de alimentación con piloto
  //      ámbar, manguera enrollada, columna de válvulas y cableado;
  //    · poste delineador naranja/blanco en la esquina expuesta.
  // ════════════════════════════════════════════════════════════════
  S = sub(g, 'banco_baterias', 'Gabinete de baterías de respaldo',
    'Anexo exterior trasero: rack de baterías Dräger tras dos hojas rotuladas ' +
    '"BATERÍAS DE RESPALDO" con louvers y etiquetas de riesgo eléctrico, ' +
    'bajo visera abovedada con repisa de servicio.');

  const batD    = 0.62;                    // profundidad del anexo
  const xAnFin  = -L / 2 - batD;           // testero: plano del rotulado
  const xAnC    = -L / 2 - batD / 2;       // centro del anexo
  const yTopAn  = y0 + H - 0.02;           // cota del techo del anexo
  const yPta0   = y0 + 0.10;               // arranque de las hojas
  const ptaBatH = 1.30;                    // alto de hoja
  const yDeck   = yPta0 + ptaBatH + 0.04;  // cota de la repisa de equipos
  const yDintel = yDeck + 0.72;            // cierre superior del hueco
  const deckD   = 0.42;                    // profundidad útil del hueco
  const anPW    = (A - 0.14) / 2;          // ancho de cada hoja

  const mChapaBat = new THREE.MeshStandardMaterial({
    map: _aTextura(_texturaChapaSucia(1), 2, 1), roughness: 0.72, metalness: 0.2
  });
  // fondo y mejillas del hueco: chapa más apagada, para que los equipos se
  // recorten contra sombra como en las fotos
  const mChapaHueco = new THREE.MeshStandardMaterial({
    map: _aTextura(_texturaChapaSucia(3, '#8f8b7e'), 2, 1), roughness: 0.85, metalness: 0.12
  });
  const mZocaloBat = MineMaterials.plano(0x4a4238, { rough: 0.95, metal: 0.05 });
  const mSombra = MineMaterials.plano(0x2b2b26, { rough: 0.9, metal: 0.08 });

  // ── Cajón estructural del anexo ──────────────────────────────────
  const anPiso = new THREE.Mesh(new THREE.BoxGeometry(batD, t, A), mAcero);
  anPiso.position.set(xAnC, y0 + t / 2, 0);
  S.add(anPiso);
  const anTecho = new THREE.Mesh(new THREE.BoxGeometry(batD + 0.02, t, A), mAcero);
  anTecho.position.set(xAnC, yTopAn, 0);
  anTecho.castShadow = true;
  S.add(anTecho);
  for (const szn of [-1, 1]) {
    const anLat = new THREE.Mesh(new THREE.BoxGeometry(batD, H, t), mAcero);
    anLat.position.set(xAnC, y0 + H / 2, szn * (A / 2 - t / 2));
    S.add(anLat);
  }

  // ── Testero: zócalo embarrado, repisa retranqueada y dintel ──────
  const anZoc = new THREE.Mesh(new THREE.BoxGeometry(t, yPta0 - y0, A), mZocaloBat);
  anZoc.position.set(xAnFin, (y0 + yPta0) / 2, 0);
  S.add(anZoc);
  // fondo y mejillas del hueco de equipos (retranqueado deckD hacia adentro)
  const anFondo = new THREE.Mesh(new THREE.BoxGeometry(t, yDintel - yDeck, A - 2 * t), mChapaHueco);
  anFondo.position.set(xAnFin + deckD, (yDeck + yDintel) / 2, 0);
  S.add(anFondo);
  for (const szh of [-1, 1]) {
    const mejilla = new THREE.Mesh(
      new THREE.BoxGeometry(deckD, yDintel - yDeck, 0.03), mChapaHueco
    );
    mejilla.position.set(xAnFin + deckD / 2, (yDeck + yDintel) / 2, szh * (A / 2 - t - 0.015));
    S.add(mejilla);
  }
  // losa de la repisa, con labio que vuela sobre las hojas
  const anRepisa = new THREE.Mesh(new THREE.BoxGeometry(deckD + 0.09, 0.05, A - 2 * t), mChapaBat);
  anRepisa.position.set(xAnFin + deckD / 2 - 0.045, yDeck - 0.025, 0);
  anRepisa.receiveShadow = true;
  S.add(anRepisa);
  // sofito oscuro del hueco (la repisa queda en sombra bajo la visera)
  const anSofito = new THREE.Mesh(new THREE.BoxGeometry(deckD, 0.03, A - 2 * t), mSombra);
  anSofito.position.set(xAnFin + deckD / 2, yDintel - 0.015, 0);
  S.add(anSofito);
  // dintel de chapa entre el hueco y el techo
  const anDintel = new THREE.Mesh(new THREE.BoxGeometry(t, yTopAn - yDintel, A), mChapaBat);
  anDintel.position.set(xAnFin, (yDintel + yTopAn) / 2, 0);
  S.add(anDintel);
  // jamba central y montantes laterales del vano de las hojas
  const anMullion = new THREE.Mesh(new THREE.BoxGeometry(t, ptaBatH + 0.04, 0.05), mChapaBat);
  anMullion.position.set(xAnFin, yPta0 + ptaBatH / 2, 0);
  S.add(anMullion);
  for (const szj of [-1, 1]) {
    const jamba = new THREE.Mesh(new THREE.BoxGeometry(t, ptaBatH + 0.04, 0.05), mChapaBat);
    jamba.position.set(xAnFin, yPta0 + ptaBatH / 2, szj * (A / 2 - 0.024));
    S.add(jamba);
  }

  // ── Hojas rotuladas "BATERÍAS DE RESPALDO" (ambas cerradas) ──────
  const xPtaBat = xAnFin - 0.025;   // eje de la hoja; cara vista en xAnFin-0.05
  for (const [iHoja, szp] of [[0, -1], [1, 1]]) {
    const cz = szp * (0.025 + anPW / 2);
    const hojaBat = new THREE.Mesh(new THREE.BoxGeometry(0.05, ptaBatH, anPW), mChapaBat);
    hojaBat.position.set(xPtaBat, yPta0 + ptaBatH / 2, cz);
    hojaBat.castShadow = true;
    S.add(hojaBat);
    // cara vista: rotulado, louvers, etiqueta de riesgo y suciedad
    const caraBat = new THREE.Mesh(
      new THREE.PlaneGeometry(anPW, ptaBatH),
      new THREE.MeshStandardMaterial({
        map: _aTextura(_texturaPuertaBaterias(iHoja + 1)), roughness: 0.72, metalness: 0.18
      })
    );
    caraBat.rotation.y = -Math.PI / 2;
    caraBat.position.set(xPtaBat - 0.026, yPta0 + ptaBatH / 2, cz);
    S.add(caraBat);
    // manija de barra junto a la junta central + cerradura bajo ella
    const yMan = yPta0 + ptaBatH * 0.63;
    const zMan = szp * 0.18;
    const manijaBat = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.24, 8), mCromo);
    manijaBat.rotation.x = Math.PI / 2;
    manijaBat.position.set(xPtaBat - 0.075, yMan, zMan);
    S.add(manijaBat);
    for (const so of [-1, 1]) {
      const sopMan = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.035), mMarco);
      sopMan.position.set(xPtaBat - 0.048, yMan, zMan + so * 0.10);
      S.add(sopMan);
    }
    const cerradura = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), mMarco);
    cerradura.rotation.z = Math.PI / 2;
    cerradura.position.set(xPtaBat - 0.033, yMan - 0.17, zMan);
    S.add(cerradura);
    // bisagras en el canto exterior
    for (const hy of [yPta0 + 0.18, yPta0 + ptaBatH - 0.18]) {
      const bisBat = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.05), mMarco);
      bisBat.position.set(xPtaBat - 0.018, hy, szp * (A / 2 - 0.06));
      S.add(bisBat);
    }
  }

  // ── Rack de baterías tras las hojas (zona baja del anexo) ────────
  const rack = new THREE.Group();
  rack.position.set(xAnFin + 0.31, y0 + t, 0);
  rack.rotation.y = -Math.PI / 2; // el ancho del rack corre a lo largo de Z
  S.add(rack);
  const mRack = MineMaterials.plano(0xe3e1d9, { rough: 0.6, metal: 0.25 });
  const rackH = 1.24, rackW = 2.3, rackD = 0.36;
  for (const sxr of [-1, 1]) {
    const lateral = new THREE.Mesh(new THREE.BoxGeometry(0.04, rackH, rackD), mRack);
    lateral.position.set(sxr * (rackW / 2), rackH / 2, 0);
    rack.add(lateral);
  }
  // repisas + cajas de baterías azules Dräger con tapa de bornes negra
  const niveles = [0.06, 0.44, 0.82, 1.20];
  for (let n = 0; n < niveles.length; n++) {
    const repisa = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.035, rackD - 0.02), mRack);
    repisa.position.set(0, niveles[n], 0);
    rack.add(repisa);
    if (n === niveles.length - 1) continue; // la superior queda de tapa
    for (let b = 0; b < 4; b++) {
      const esNegra = n === 1 && b === 2;
      const bateria = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.28),
        MineMaterials.plano(esNegra ? 0x24241f : 0x2a5fb0, { rough: 0.5, metal: 0.2 })
      );
      bateria.position.set(-0.72 + b * 0.48, niveles[n] + 0.17, 0.02);
      rack.add(bateria);
      const tapa = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.04, 0.2),
        MineMaterials.plano(0x14140f, { rough: 0.5 })
      );
      tapa.position.set(-0.72 + b * 0.48, niveles[n] + 0.34, 0.02);
      rack.add(tapa);
    }
  }

  // ── Visera abovedada: prolongación del techo sobre el gabinete ────
  const viseraL = batD + 0.16;
  const xViseraC = (-L / 2 + 0.02 + xAnFin - 0.14) / 2;
  const visera = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco, rArco, viseraL, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    mAcero
  );
  visera.rotation.z = Math.PI / 2;
  visera.position.set(xViseraC, cyArco, 0);
  visera.castShadow = true;
  S.add(visera);
  const viseraIn = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco - 0.035, rArco - 0.035, viseraL - 0.01, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    new THREE.MeshStandardMaterial({ color: 0x3b3b34, roughness: 0.92, metalness: 0.1, side: THREE.BackSide })
  );
  viseraIn.rotation.z = Math.PI / 2;
  viseraIn.position.set(xViseraC, cyArco + 0.03, 0);
  S.add(viseraIn);
  // canto oscuro y tímpano de cierre del vuelo
  const cantoVisera = new THREE.Mesh(
    new THREE.CylinderGeometry(rArco + 0.012, rArco + 0.012, 0.05, 24, 1, true, Math.PI / 2 - thArco, 2 * thArco),
    mSombra
  );
  cantoVisera.rotation.z = Math.PI / 2;
  cantoVisera.position.set(xAnFin - 0.115, cyArco, 0);
  S.add(cantoVisera);
  const capVisera = new THREE.Mesh(capGeo, mSombra);
  capVisera.rotation.y = -Math.PI / 2;
  capVisera.position.set(xAnFin - 0.142, yTopAn, 0);
  S.add(capVisera);

  // franja reflectiva vertical en el costado -Z del anexo
  S = sub(g, 'franjas_logos', 'Franjas reflectivas y logos Dräger');
  const fvAn = new THREE.Mesh(new THREE.PlaneGeometry(0.16, H - 0.1), matRayasV);
  fvAn.position.set(xAnFin + 0.16, y0 + (H - 0.1) / 2 + 0.05, -(A / 2 + t / 2 + 0.006));
  fvAn.rotation.y = Math.PI;
  S.add(fvAn);

  // ════════════════════════════════════════════════════════════════
  //  REPISA DE SERVICIO — split A/C, tablero, manguera y válvulas
  //  (foto real: todo alojado en el hueco, en sombra bajo la visera)
  // ════════════════════════════════════════════════════════════════
  S = sub(g, 'equipos_baterias', 'Equipos sobre el gabinete de baterías',
    'Condensador split, tablero de alimentación con piloto ámbar, manguera ' +
    'enrollada, columna de válvulas y cableado colgante bajo la visera.');
  // Grupo local: +x = hacia adentro del gabinete, y = sobre la repisa.
  const eq = new THREE.Group();
  eq.position.set(xAnFin, yDeck, 0);
  S.add(eq);

  // ── Condensador split (unidad exterior) ──────────────────────────
  const mAcCarcasa = new THREE.MeshStandardMaterial({
    map: _aTextura(_texturaCarcasaAC()), roughness: 0.5, metalness: 0.15
  });
  const mGuardaAc = MineMaterials.plano(0x8d8d86, { rough: 0.4, metal: 0.65 });
  const acW = 0.82, acAlto = 0.54, acD = 0.32, acZ = -0.10;
  const acX = acD / 2 - 0.01;             // frente casi enrasado con las hojas
  const xAcFrente = acX - acD / 2;
  const yAcC = 0.05 + acAlto / 2;
  for (const so of [-1, 1]) {
    const patin = new THREE.Mesh(
      new THREE.BoxGeometry(acD - 0.02, 0.05, 0.06),
      MineMaterials.plano(0x3a3a34, { rough: 0.7, metal: 0.3 })
    );
    patin.position.set(acX, 0.025, acZ + so * (acW / 2 - 0.09));
    eq.add(patin);
  }
  const acCuerpo = new THREE.Mesh(new THREE.BoxGeometry(acD, acAlto, acW), mAcCarcasa);
  acCuerpo.position.set(acX, yAcC, acZ);
  acCuerpo.castShadow = true;
  eq.add(acCuerpo);
  const acTapa = new THREE.Mesh(new THREE.BoxGeometry(acD + 0.014, 0.025, acW + 0.014), mAcCarcasa);
  acTapa.position.set(acX, 0.05 + acAlto - 0.012, acZ);
  eq.add(acTapa);

  // rejilla circular del ventilador (mitad izquierda del frente)
  const zFan = acZ - 0.17, rFan = 0.20;
  const bocaFan = new THREE.Mesh(
    new THREE.CircleGeometry(rFan, 24),
    MineMaterials.plano(0x14140f, { rough: 0.85 })
  );
  bocaFan.rotation.y = -Math.PI / 2;
  bocaFan.position.set(xAcFrente - 0.004, yAcC, zFan);
  eq.add(bocaFan);
  // aspas insinuadas al fondo de la boca
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const aspa = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.075, rFan * 0.86),
      MineMaterials.plano(0x33332c, { rough: 0.6 })
    );
    aspa.position.set(xAcFrente + 0.03, yAcC + Math.sin(ang) * rFan * 0.42, zFan + Math.cos(ang) * rFan * 0.42);
    aspa.rotation.x = -ang;
    eq.add(aspa);
  }
  const bujeFan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12),
    MineMaterials.plano(0x2a2a25, { rough: 0.5, metal: 0.3 })
  );
  bujeFan.rotation.z = Math.PI / 2;
  bujeFan.position.set(xAcFrente + 0.02, yAcC, zFan);
  eq.add(bujeFan);
  // guarda de alambre: anillos concéntricos + radios
  for (const rr of [0.055, 0.105, 0.155, 0.198]) {
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.005, 6, 26), mGuardaAc);
    anillo.rotation.y = Math.PI / 2;
    anillo.position.set(xAcFrente - 0.012, yAcC, zFan);
    eq.add(anillo);
  }
  for (let i = 0; i < 6; i++) {
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, rFan * 2), mGuardaAc);
    radio.position.set(xAcFrente - 0.012, yAcC, zFan);
    radio.rotation.x = (i / 6) * Math.PI;
    eq.add(radio);
  }
  const bisFan = new THREE.Mesh(new THREE.TorusGeometry(rFan + 0.012, 0.008, 8, 26), mGuardaAc);
  bisFan.rotation.y = Math.PI / 2;
  bisFan.position.set(xAcFrente - 0.006, yAcC, zFan);
  eq.add(bisFan);
  // marca y etiqueta de eficiencia energética (mitad derecha del frente)
  const marcaAc = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.043),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaRotulo('COLDPOINT')), transparent: true, roughness: 0.5 })
  );
  marcaAc.rotation.y = -Math.PI / 2;
  marcaAc.position.set(xAcFrente - 0.004, yAcC + 0.20, acZ + 0.21);
  eq.add(marcaAc);
  const etqEnergia = new THREE.Mesh(
    new THREE.PlaneGeometry(0.085, 0.118),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaEtiquetaEnergia()), roughness: 0.6 })
  );
  etqEnergia.rotation.y = -Math.PI / 2;
  etqEnergia.position.set(xAcFrente - 0.004, yAcC - 0.02, acZ + 0.23);
  eq.add(etqEnergia);

  // ── Tablero de alimentación con piloto ámbar (izquierda) ─────────
  const tabW = 0.36, tabH = 0.32, tabD = 0.19, tabZ = -0.82, xTabF = 0.01;
  const tablero = new THREE.Mesh(
    new THREE.BoxGeometry(tabD, tabH, tabW),
    MineMaterials.plano(0xb9b8b0, { rough: 0.5, metal: 0.45 })
  );
  tablero.position.set(xTabF + tabD / 2, 0.04 + tabH / 2, tabZ);
  tablero.castShadow = true;
  eq.add(tablero);
  const pilotoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.02, 10), mSombra);
  pilotoBase.rotation.z = Math.PI / 2;
  pilotoBase.position.set(xTabF - 0.008, 0.04 + tabH - 0.06, tabZ - 0.13);
  eq.add(pilotoBase);
  const pilotoTablero = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff8c10, emissive: 0xff7a00, emissiveIntensity: 2.6, roughness: 0.3 })
  );
  pilotoTablero.position.set(xTabF - 0.022, 0.04 + tabH - 0.06, tabZ - 0.13);
  eq.add(pilotoTablero);
  const rotTablero = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.042),
    new THREE.MeshStandardMaterial({
      map: _aTextura(_texturaRotulo('ALIMENTACIÓN 220 VAC', { fondo: '#e8e6dc', tinta: '#1b1b16', tam: 22 })),
      roughness: 0.7
    })
  );
  rotTablero.rotation.y = -Math.PI / 2;
  rotTablero.position.set(xTabF - 0.004, 0.04 + tabH - 0.13, tabZ - 0.05);
  eq.add(rotTablero);
  // etiqueta amarilla de riesgo eléctrico también en el tablero
  const etqTablero = new THREE.Mesh(
    new THREE.PlaneGeometry(0.10, 0.068),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaEtiquetaRiesgo()), roughness: 0.7 })
  );
  etqTablero.rotation.y = -Math.PI / 2;
  etqTablero.position.set(xTabF - 0.004, 0.04 + 0.09, tabZ + 0.09);
  eq.add(etqTablero);
  for (const so of [-1, 1]) {
    const cierre = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.02), mCromo);
    cierre.position.set(xTabF - 0.006, 0.04 + tabH / 2 + so * 0.09, tabZ + tabW / 2 - 0.03);
    eq.add(cierre);
  }

  // ── Manguera enrollada colgada del gancho (derecha del split) ────
  const mManguera = MineMaterials.plano(0x141416, { rough: 0.75, metal: 0.05 });
  const rolloMang = new THREE.Group();
  rolloMang.position.set(0.17, 0.33, 0.62);
  eq.add(rolloMang);
  for (let i = 0; i < 6; i++) {
    const vuelta = new THREE.Mesh(new THREE.TorusGeometry(0.155 - i * 0.007, 0.017, 7, 22), mManguera);
    vuelta.rotation.set(i * 0.06, Math.PI / 2, 0);
    vuelta.position.set(i * 0.016, -i * 0.007, i * 0.004);
    rolloMang.add(vuelta);
  }
  const ganchoMang = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI * 1.3), mCromo);
  ganchoMang.rotation.y = Math.PI / 2;
  ganchoMang.position.set(0.21, 0.52, 0.62);
  eq.add(ganchoMang);

  // ── Columna de válvulas de servicio (extremo derecho) ────────────
  const mAzulVal = MineMaterials.plano(0x1b2f52, { rough: 0.45, metal: 0.55 });
  const zVal = 1.02;
  const tuboVal = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.62, 12), mAzulVal);
  tuboVal.position.set(0.16, 0.34, zVal);
  eq.add(tuboVal);
  const cuerpoVal = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), mAzulVal);
  cuerpoVal.position.set(0.16, 0.50, zVal);
  eq.add(cuerpoVal);
  const volanteVal = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.011, 6, 16), mCromo);
  volanteVal.rotation.y = Math.PI / 2;
  volanteVal.position.set(0.09, 0.50, zVal);
  eq.add(volanteVal);
  const bridaVal = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 12), mMarco);
  bridaVal.position.set(0.16, 0.045, zVal);
  eq.add(bridaVal);

  // ── Cableado grueso colgante y conducto del split (fotos reales) ──
  const mCableGrueso = MineMaterials.plano(0x121214, { rough: 0.8 });
  for (const [cy, cs, cr] of [[0.62, 0.10, 0.020], [0.58, 0.14, 0.016], [0.66, 0.07, 0.013]]) {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.34, cy + 0.04, -A / 2 + 0.10),
      new THREE.Vector3(0.10, cy - cs, -0.55),
      new THREE.Vector3(0.05, cy - cs * 1.25, 0.10),
      new THREE.Vector3(0.14, cy - cs * 0.6, 0.72),
      new THREE.Vector3(0.34, cy + 0.02, A / 2 - 0.10)
    ]);
    eq.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 28, cr, 7, false), mCableGrueso));
  }
  const curvaCond = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, 0.44, acZ + acW / 2 - 0.04),
    new THREE.Vector3(0.05, 0.52, 0.42),
    new THREE.Vector3(0.22, 0.34, 0.78),
    new THREE.Vector3(0.36, 0.10, 0.92)
  ]);
  eq.add(new THREE.Mesh(new THREE.TubeGeometry(curvaCond, 24, 0.022, 7, false), mCableGrueso));
  // pasamuros del cable de fuerza hacia la BPU
  const pasamuros = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), mMarco);
  pasamuros.rotation.z = Math.PI / 2;
  pasamuros.position.set(deckD - 0.02, 0.34, -1.30);
  eq.add(pasamuros);

  // ── Poste delineador naranja/blanco en la esquina expuesta (+Z) ───
  S = sub(g, 'delineador_gabinete', 'Poste delineador de esquina',
    'Poste de bandas reflectivas naranja/blanco que protege la esquina expuesta del gabinete.');
  const posteX = xAnFin - 0.06, posteZ = A / 2 + 0.07, bandaH = 0.21;
  const basePoste = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.05, 0.20),
    MineMaterials.plano(0x55534a, { rough: 0.9, metal: 0.2 })
  );
  basePoste.position.set(posteX, 0.025, posteZ);
  S.add(basePoste);
  for (let i = 0; i < 11; i++) {
    const col = i % 2 === 0 ? 0xd8500f : 0xeeeae0;
    const banda = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, bandaH, 0.10),
      MineMaterials.plano(col, { rough: 0.45, metal: 0.1, emissive: col, emissiveIntensity: 0.22 })
    );
    banda.position.set(posteX, 0.05 + bandaH / 2 + i * bandaH, posteZ);
    banda.castShadow = true;
    S.add(banda);
  }

  // ── PLACA DE MONTAJE crema en la pared del fondo (fotos reales):
  //    porta el split A/C, 4 manómetros con campanas y el termómetro ──
  S = sub(g, 'instrumentacion', 'Instrumentación y A/C',
    'Placa de montaje, split de aire acondicionado con su control remoto, estación ' +
    'de gases con tres Dräger Polytron 5000 (CO2/O2/CO), baliza sonora y válvula ' +
    'de alivio con cartucho filtro-silenciador en el rincón.');
  // La placa NO llega hasta los transmisores: en la foto arranca a su derecha
  // y llega hasta el split, dejando la estación de gases sobre chapa desnuda.
  const zPlaca = -0.17;
  const placaMont = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.05, 1.05),
    MineMaterials.plano(0xe9e7db, { rough: 0.6, metal: 0.15 })
  );
  placaMont.position.set(-L / 2 + t + 0.03, y0 + H - 0.62, zPlaca);
  S.add(placaMont);
  // pernos de fijación en las esquinas de la placa
  const mPerno = MineMaterials.plano(0x55544e, { rough: 0.45, metal: 0.6 });
  for (const [py, pz] of [[0.46, 0.45], [0.46, -0.45], [-0.46, 0.45], [-0.46, -0.45]]) {
    const perno = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 8), mPerno);
    perno.rotation.z = Math.PI / 2;
    perno.position.set(-L / 2 + t + 0.06, y0 + H - 0.62 + py, zPlaca + pz);
    S.add(perno);
  }
  // columna de 3 tornillos vistos en el canto izquierdo de la placa (foto)
  for (let i = 0; i < 3; i++) {
    const tornillo = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.007, 8), mPerno);
    tornillo.rotation.z = Math.PI / 2;
    tornillo.position.set(-L / 2 + t + 0.065, y0 + H - 0.30 - i * 0.17, zPlaca + 0.46);
    S.add(tornillo);
  }
  // letreros grises pequeños en las esquinas altas de la pared del fondo
  for (const szEsq of [-1, 1]) {
    const letEsq = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.055),
      MineMaterials.plano(0x8a8a84, { rough: 0.6, metal: 0.2 })
    );
    letEsq.rotation.y = Math.PI / 2;
    letEsq.rotation.z = szEsq * 0.04;
    letEsq.position.set(-L / 2 + t + 0.012, y0 + H - 0.14, szEsq * 1.08);
    S.add(letEsq);
  }
  // control remoto del A/C en su soporte blanco (derecha del split, foto)
  const soporteCtrl = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.17, 0.09),
    MineMaterials.plano(0xf2f2ec, { rough: 0.55 })
  );
  soporteCtrl.position.set(-L / 2 + t + 0.075, y0 + H - 0.72, -0.62);
  S.add(soporteCtrl);
  const remoto = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.13, 0.055),
    MineMaterials.plano(0xffffff, { rough: 0.45 })
  );
  remoto.position.set(-L / 2 + t + 0.095, y0 + H - 0.7, -0.62);
  S.add(remoto);

  // split de aire acondicionado montado sobre la placa (centro-derecha del
  // observador; deja el costado izquierdo de la placa a la instrumentación)
  const acBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.3, 0.95),
    MineMaterials.plano(0xf6f6f2, { rough: 0.5, metal: 0.1 })
  );
  acBody.position.set(-L / 2 + t + 0.18, y0 + H - 0.32, -0.2);
  S.add(acBody);
  const acRej = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.06, 0.9),
    MineMaterials.plano(0xd8d8d2, { rough: 0.6 })
  );
  acRej.position.set(-L / 2 + t + 0.30, y0 + H - 0.43, -0.2);
  S.add(acRej);

  // ── ESTACIÓN DE MONITOREO DE GASES (foto real de la pared del fondo) ──
  //  Tres DRÄGER POLYTRON 5000 encadenados por uniones de conduit inoxidable:
  //  arriba el de CO2 (con brazo y cáncamo), abajo el de O2 y el de CO, cada
  //  uno con su DrägerSensor colgando. A la izquierda, la baliza sonora con
  //  LEDs verdes. Todo sobre la chapa manchada de humedad, NO sobre la placa.
  const instr = new THREE.Group();
  // pegado a la cara interior del testero, a la IZQUIERDA del observador
  instr.position.set(-L / 2 + t / 2 + 0.004, y0 + H - 0.62, 0.88);
  S.add(instr);
  const mNegroMate = MineMaterials.plano(0x17171a, { rough: 0.5, metal: 0.2 });
  const mInoxUnion = MineMaterials.plano(0xa9a9a2, { rough: 0.32, metal: 0.8 });

  // manchas de humedad de la chapa alrededor de los transmisores
  const mancha = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.66),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaMancha()), transparent: true, roughness: 0.9 })
  );
  mancha.rotation.y = Math.PI / 2;
  mancha.position.set(0.003, 0.05, -0.02);
  instr.add(mancha);

  // los tres transmisores: [dy, dz, lectura, unidad, gas, color de banda]
  const TRANSMISORES = [
    { dy:  0.175, dz:  0.000, valor: '026',  unidad: 'ppm',  gas: null,  col: 0x1f5fbf }, // CO2
    { dy:  0.000, dz:  0.015, valor: '19.7', unidad: 'Vol%', gas: 'O2',  col: 0x1f6fd0 },
    { dy: -0.010, dz: -0.170, valor: '7',    unidad: 'ppm',  gas: 'CO',  col: 0x3a3a34 }
  ];
  const posPoly = [];
  for (const tr of TRANSMISORES) {
    const p = _polytron5000({ valor: tr.valor, unidad: tr.unidad, gas: tr.gas, colorGas: tr.col });
    p.position.set(0.055, tr.dy, tr.dz);
    instr.add(p);
    posPoly.push(new THREE.Vector3(0.055, tr.dy, tr.dz));
  }
  // uniones de conduit inoxidable entre carcasas (nipple + dos tuercas hex)
  const unir = (a, b) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const medio = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const eje = dir.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), eje);
    const nipple = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, len - 0.1, 10), mInoxUnion);
    nipple.position.copy(medio);
    nipple.quaternion.copy(quat);
    instr.add(nipple);
    for (const s of [-1, 1]) {
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 6), mInoxUnion);
      hex.position.copy(medio).addScaledVector(eje, s * (len / 2 - 0.062));
      hex.quaternion.copy(quat);
      instr.add(hex);
    }
  };
  unir(posPoly[0], posPoly[1]);
  unir(posPoly[1], posPoly[2]);

  // brazo lateral con CÁNCAMO a la derecha del transmisor superior (foto)
  const brazoCanc = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.085, 8), mInoxUnion);
  brazoCanc.rotation.x = Math.PI / 2;
  brazoCanc.position.set(0.055, 0.175, -0.105);
  instr.add(brazoCanc);
  const cancamo = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.007, 6, 14), mInoxUnion);
  cancamo.position.set(0.055, 0.175, -0.155);
  instr.add(cancamo);

  // ── BALIZA SONORA con LEDs verdes (izquierda del transmisor superior) ──
  const baliza = new THREE.Group();
  baliza.position.set(0.025, 0.145, 0.175);
  baliza.rotation.z = -0.12;
  instr.add(baliza);
  const balBase = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 12), mInoxUnion);
  balBase.rotation.z = Math.PI / 2;
  baliza.add(balBase);
  const balCuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.105, 16),
    new THREE.MeshStandardMaterial({ map: _aTextura(_texturaBalizaSonora()), roughness: 0.5, metalness: 0.25 })
  );
  balCuerpo.rotation.z = Math.PI / 2;
  balCuerpo.position.x = 0.07;
  balCuerpo.castShadow = true;
  baliza.add(balCuerpo);
  const balTapa = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.02, 16), mNegroMate);
  balTapa.rotation.z = Math.PI / 2;
  balTapa.position.x = 0.132;
  baliza.add(balTapa);
  // dos LEDs verdes encendidos en el costado visible
  for (const lx of [0.048, 0.076]) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.016, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x2ee04a, emissive: 0x22ff44, emissiveIntensity: 2.6, roughness: 0.3 })
    );
    led.position.set(lx, 0.008, -0.034);
    baliza.add(led);
  }
  // cable negro de la baliza bajando en curva hacia el pasamuros
  const curvaBal = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.030, 0.112, 0.192),
    new THREE.Vector3(0.058, 0.055, 0.202),
    new THREE.Vector3(0.040, -0.05, 0.13),
    new THREE.Vector3(0.022, -0.30, 0.02),
    new THREE.Vector3(0.018, -0.72, -0.05)
  ]);
  instr.add(new THREE.Mesh(new THREE.TubeGeometry(curvaBal, 26, 0.008, 6, false), mNegroMate));
  const cajaPaso = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.07), mNegroMate);
  cajaPaso.position.set(0.024, -0.82, -0.05);
  instr.add(cajaPaso);
  // pasamuros del cable del transmisor de CO2 hacia la pared
  const pasoPoly = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 10), mInoxUnion);
  pasoPoly.rotation.z = Math.PI / 2;
  pasoPoly.position.set(0.008, 0.245, 0.09);
  instr.add(pasoPoly);
  const curvaPoly = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.022, 0.245, 0.09),
    new THREE.Vector3(0.058, 0.228, 0.10),
    new THREE.Vector3(0.066, 0.182, 0.075)
  ]);
  instr.add(new THREE.Mesh(new THREE.TubeGeometry(curvaPoly, 14, 0.007, 6, false), mNegroMate));

  // ── VÁLVULA DE ALIVIO con CARTUCHO FILTRO-SILENCIADOR en el rincón ──
  //  Remata la tubería aérea contra la esquina fondo/+Z, inclinada como en
  //  la foto: codo + cuerpo de bronce con perilla negra + cartucho inoxidable.
  const alivio = new THREE.Group();
  alivio.position.set(-L / 2 + t / 2 + 0.02, y0 + H - 0.28, A / 2 - 0.30);
  // el eje local +X sigue la línea del cartucho: sale de la pared, sube y se
  // mete en el rincón hacia +Z (misma pose que la foto)
  alivio.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0.36, 0.58, 0.73).normalize()
  );
  S.add(alivio);
  const mBronceVal = MineMaterials.plano(0xbfa05c, { rough: 0.34, metal: 0.8 });
  // brida de anclaje contra la chapa del testero
  const bridaAlivio = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 12), mInoxUnion);
  bridaAlivio.rotation.z = Math.PI / 2;
  bridaAlivio.position.x = -0.03;
  alivio.add(bridaAlivio);
  const codoAlivio = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.07, 10), mBronceVal);
  codoAlivio.rotation.z = Math.PI / 2;
  alivio.add(codoAlivio);
  const cuerpoAlivio = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), mBronceVal);
  cuerpoAlivio.position.x = 0.07;
  alivio.add(cuerpoAlivio);
  const perillaAlivio = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.05, 12), mNegroMate);
  perillaAlivio.rotation.x = Math.PI / 2;
  perillaAlivio.position.set(0.07, 0.005, -0.06);
  alivio.add(perillaAlivio);
  const cuelloAlivio = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10), mInoxUnion);
  cuelloAlivio.rotation.z = Math.PI / 2;
  cuelloAlivio.position.x = 0.125;
  alivio.add(cuelloAlivio);
  // cartucho filtro-silenciador (malla inoxidable + casquillos)
  const cartucho = new THREE.Mesh(
    new THREE.CylinderGeometry(0.037, 0.037, 0.15, 16),
    MineMaterials.plano(0x8e8377, { rough: 0.72, metal: 0.55 })
  );
  cartucho.rotation.z = Math.PI / 2;
  cartucho.position.x = 0.222;
  cartucho.castShadow = true;
  alivio.add(cartucho);
  for (const cx of [0.152, 0.292]) {
    const casquillo = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.026, 16), mInoxUnion);
    casquillo.rotation.z = Math.PI / 2;
    casquillo.position.x = cx;
    alivio.add(casquillo);
  }
  const tapaCart = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.034, 0.022, 16), mInoxUnion);
  tapaCart.rotation.z = Math.PI / 2;
  tapaCart.position.x = 0.313;
  alivio.add(tapaCart);
  // banda verde de identificación + etiqueta colgante de inspección
  const bandaCart = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0385, 0.0385, 0.018, 16),
    MineMaterials.plano(0x2a9d4a, { rough: 0.5 })
  );
  bandaCart.rotation.z = Math.PI / 2;
  bandaCart.position.x = 0.19;
  alivio.add(bandaCart);
  // tarjeta de inspección atada con alambre al casquillo del extremo
  const alambreTarj = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0025, 5, 12), mInoxUnion);
  alambreTarj.position.set(0.298, -0.032, 0);
  alivio.add(alambreTarj);
  const tarjeta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.042, 0.028),
    new THREE.MeshStandardMaterial({
      map: _aTextura(_texturaRotulo('0111', { fondo: '#e8e4d6', tinta: '#232320', tam: 36 })),
      roughness: 0.85, side: THREE.DoubleSide
    })
  );
  tarjeta.position.set(0.298, -0.062, 0.001);
  alivio.add(tarjeta);

  // ── Tubería aérea de aire/agua a lo largo del techo (costado +Z) ─
  S = sub(g, 'tuberia', 'Tubería aérea', 'Tubería de aire/agua a lo largo del techo con abrazaderas de soporte.');
  const mTubo = MineMaterials.plano(0x9a9a94, { rough: 0.4, metal: 0.7 });
  const tubo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, L - 0.6, 10),
    mTubo
  );
  tubo.rotation.z = Math.PI / 2;
  tubo.position.set(0.1, y0 + H - 0.12, A / 2 - 0.14);
  S.add(tubo);
  // abrazaderas de soporte a la pared (foto real)
  for (const cxT of [-1.9, 0.1, 2.0]) {
    const abraz = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.09, 0.03),
      MineMaterials.plano(0x77766e, { rough: 0.5, metal: 0.5 })
    );
    abraz.position.set(cxT, y0 + H - 0.1, A / 2 - t - 0.02);
    S.add(abraz);
  }

  // ── Placas de señalética + flechas rojas en las paredes ──────────
  S = sub(g, 'senaletica_interior', 'Señalética interior',
    'Estaciones de consumibles: tira rotulada, flecha roja de ubicación y placa ' +
    'instructiva (raciones alimenticias y de agua), más pósters de plano de mina.');

  // Cada PANEL de pared entre costillas lleva una estación de consumibles con
  // el mismo lenguaje de las fotos: tira blanca rotulada arriba, flecha roja
  // señalando el pañol de abajo y, cuando corresponde, la placa instructiva.
  const INSTRUCTIVO_ALIMENTOS = _texturaInstructivo(
    'RACIONES ALIMENTICIAS DE EMERGENCIA',
    [
      'Cada paquete contiene 18 barras de 38 gramos cada una.',
      'Consumir un mínimo de una barra cada 6 horas equivalente a 800 Kcal ' +
      'diario (4 barras diarias) y un máximo de una barra cada 3 horas ' +
      'equivalente a 1600 Kcal diario (8 barras diarias).'
    ],
    [
      'Verifique que el paquete se encuentre en buenas condiciones y sellado ' +
      'al vacío. En caso contrario deséchelo.',
      'Verifique la fecha de vencimiento impresa en el paquete.',
      'Abra el paquete rompiendo la parte superior donde aparece la palabra TEAR HERE.'
    ]
  );
  const INSTRUCTIVO_AGUA = _texturaInstructivo(
    'RACIONES DE AGUA POTABLE DE EMERGENCIA',
    [
      'Cada sobre contiene 125 ml de agua.',
      'Consumir un mínimo de 2 sobres equivalente a 250 ml de agua diario por ' +
      'persona y un máximo de 4 sobres equivalentes a 500 ml de agua diarios por persona.'
    ],
    [
      'Verifique que el sobre se encuentre en buenas condiciones y sellado al ' +
      'vacío. En caso contrario deséchelo.',
      'Verifique la fecha de vencimiento impresa en el paquete.',
      'Abra el sobre rompiendo la parte superior donde aparece la palabra TEAR.'
    ]
  );

  // sz: pared (+1 = costado del logo, -1 = costado de la puerta de acceso)
  const ESTACIONES = [
    { sz:  1, x: -2.10, texto: 'TANQUE DE MONOXIDO' },
    { sz:  1, x: -1.30, texto: 'CATALIZADOR DE CO' },
    { sz:  1, x: -0.15, texto: 'RACIONES ALIMENTICIAS', tab: '#1c4fa8', placa: INSTRUCTIVO_ALIMENTOS },
    { sz:  1, x:  1.15, texto: 'RACIONES DE AGUA',                      placa: INSTRUCTIVO_AGUA },
    // en la pared -Z los dos primeros paneles los ocupan los cilindros de O2
    // (x≈-2.10) y su cartel de procedimiento (x≈-1.30)
    { sz: -1, x: -0.15, texto: 'DIAGRAMA DE AGUA' },
    { sz: -1, x:  1.15, texto: 'PROCEDIMIENTO DE INGRESO' }
  ];
  const flechaMat = new THREE.MeshStandardMaterial({
    map: _aTextura(_texturaFlecha()), transparent: true, roughness: 0.7
  });
  const H_TIRA = 0.072;                       // alto de la tira rotulada
  for (const e of ESTACIONES) {
    const zPared = e.sz * (A / 2 - t - 0.012);
    const rotPared = e.sz > 0 ? Math.PI : 0;
    // en la pared +Z la derecha de pantalla es -X: refleja los desplazamientos
    const dirX = e.sz > 0 ? -1 : 1;

    const lienzoTira = _texturaLetrero(e.texto, { tab: e.tab || null });
    const tira = new THREE.Mesh(
      new THREE.PlaneGeometry((lienzoTira.width / lienzoTira.height) * H_TIRA, H_TIRA),
      new THREE.MeshStandardMaterial({ map: _aTextura(lienzoTira), roughness: 0.65 })
    );
    tira.position.set(e.x, y0 + H - 0.50, zPared);
    tira.rotation.y = rotPared;
    S.add(tira);

    // flecha roja: a la derecha del instructivo (o centrada si no lo hay)
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.135, 0.30), flechaMat);
    fl.position.set(e.x + dirX * (e.placa ? 0.17 : 0), y0 + H - 0.82, zPared);
    fl.rotation.y = rotPared;
    S.add(fl);

    if (!e.placa) continue;
    const placa = new THREE.Mesh(
      new THREE.PlaneGeometry(0.30, 0.30 * (e.placa.height / e.placa.width)),
      new THREE.MeshStandardMaterial({ map: _aTextura(e.placa), roughness: 0.7 })
    );
    placa.position.set(e.x - dirX * 0.175, y0 + H - 0.86, zPared);
    placa.rotation.y = rotPared;
    S.add(placa);
  }
  // pósters de plano/mapa a color junto a la puerta (fotos reales, pared -Z)
  for (let i = 0; i < 2; i++) {
    const mapa = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.33),
      new THREE.MeshStandardMaterial({ map: _aTextura(_texturaMapa(i + 1)), roughness: 0.75 })
    );
    mapa.position.set(0.85 + i * 0.52, y0 + H - 1.25, -(A / 2 - t - 0.012));
    S.add(mapa);
  }

  // ── Cartel "PROCEDIMIENTO PARA SUMINISTRO DE OXÍGENO" junto a la
  //    batería de cilindros, a la altura de lectura del operador ──────
  const lienzoProcO2 = _texturaProcedimientoO2();
  const anchoProcO2 = 0.62;
  const procO2 = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoProcO2, anchoProcO2 * (lienzoProcO2.height / lienzoProcO2.width)),
    new THREE.MeshStandardMaterial({ map: _aTextura(lienzoProcO2), roughness: 0.55 })
  );
  procO2.position.set(-1.30, y0 + 1.44, -(A / 2 - t - 0.012));
  S.add(procO2);
  // placa de respaldo metálica que hace de marco
  const marcoProc = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoProcO2 + 0.026, anchoProcO2 * (lienzoProcO2.height / lienzoProcO2.width) + 0.026),
    MineMaterials.plano(0x9a988e, { rough: 0.45, metal: 0.55 })
  );
  marcoProc.position.set(-1.30, y0 + 1.44, -(A / 2 - t - 0.012) - 0.004);
  S.add(marcoProc);

  // ════════════════════════════════════════════════════════════════
  //  INTERACCIÓN
  // ════════════════════════════════════════════════════════════════
  let abierto = ocupado;
  g.userData._doorOpen = abierto;   // lo lee PropSolids para habilitar/deshabilitar el collider de la puerta
  // Las luces ya NO dependen de ocupado/disponible: indican la FUENTE DE
  // ENERGÍA (ver tick más abajo). El estado solo abre/cierra las puertas.
  const setEstado = (ocup) => {
    puertaPivote.rotation.y = ocup ? -Math.PI * 0.62 : 0;
    puertaIntPivote.rotation.y = ocup ? Math.PI * 0.55 : 0;
    // Sincroniza la COLISIÓN de la puerta con su estado visual (si ya está cableada por
    // PropSolids): abierta ⇒ el hueco deja pasar; cerrada ⇒ bloquea el único acceso.
    g.userData._doorOpen = ocup;
    if (g.userData._doorColliders) {
      for (const c of g.userData._doorColliders) c.setEnabled(!ocup);
    }
  };
  setEstado(abierto);

  // ── COLISIÓN DEL CASCO (solo se entra/sale por la puerta) ─────────
  // Cajas LOCALes que PropSolids convierte en colisionadores estáticos del mundo. El casco es
  // macizo por los 4 costados + techo + piso; el frente tiene los paneles a los lados del vano
  // y una HOJA de puerta togglable en el hueco. Sin dintel de colisión: deja gálibo de cabeza
  // para que el jugador (cápsula ~2.1 m) cruce el vano de 1.95 m.
  {
    const top = y0 + H;                 // 2.63
    const wy = top / 2, why = top / 2;  // pared de 0..top
    const doorHz = puertaW / 2;         // 0.475
    const sidePanelHz = (A / 2 - doorHz) / 2;
    const sidePanelCz = doorHz + sidePanelHz;
    g.userData.solids = [
      { hx: 0.09, hy: why, hz: A / 2,   pos: [-L / 2, wy, 0] },           // fondo (-X)
      { hx: L / 2, hy: why, hz: 0.09,   pos: [0, wy,  A / 2] },           // costado +Z
      { hx: L / 2, hy: why, hz: 0.09,   pos: [0, wy, -A / 2] },           // costado -Z
      { hx: L / 2, hy: 0.09, hz: A / 2, pos: [0, top, 0] },               // techo
      { hx: L / 2, hy: y0 / 2, hz: A / 2, pos: [0, y0 / 2, 0] },          // piso/patín (0..y0)
      { hx: 0.09, hy: why, hz: sidePanelHz, pos: [L / 2, wy, -sidePanelCz] }, // panel frontal -Z
      { hx: 0.09, hy: why, hz: sidePanelHz, pos: [L / 2, wy,  sidePanelCz] }, // panel frontal +Z
      // GABINETE DE BATERÍAS adosado al testero: macizo, no se atraviesa
      { hx: batD / 2 + 0.04, hy: why, hz: A / 2, pos: [xAnC, wy, 0] },
      // HOJA de la puerta exterior (bloquea el vano cuando está cerrada)
      { hx: 0.09, hy: puertaH / 2, hz: doorHz, pos: [L / 2 + 0.03, y0 + puertaH / 2, doorZ], door: true }
    ];
  }

  // ── ANIMACIÓN DE LUCES (userData.tick) ───────────────────────────
  //  1. VERDE fija  = refugio alimentado por la RED ELÉCTRICA de mina.
  //  2. ROJA  fija  = refugio usando sus PROPIAS BATERÍAS.
  //     Alternan cada 60 s y son EXCLUYENTES (nunca ambas a la vez).
  //  3. ÁMBAR: SIEMPRE parpadeando (1 Hz), independiente de las demás.
  let tLuces = 0;
  g.userData.tick = (dt) => {
    tLuces += dt;
    const enRed = (tLuces % 120) < 60; // 1 min red de mina ↔ 1 min baterías
    lamparas.verde.material.emissiveIntensity = enRed ? 3.2 : 0;
    lamparas.verde.material.color.set(enRed ? 0x28c838 : 0x201f1c);
    lamparas.rojo.material.emissiveIntensity = enRed ? 0 : 3.2;
    lamparas.rojo.material.color.set(enRed ? 0x201f1c : 0xcc1111);
    luzEstado.color.set(enRed ? 0x33ff44 : 0xff2200);
    // ámbar intermitente
    const blink = (tLuces % 1.0) < 0.5;
    lamparas.ambar.material.emissiveIntensity = blink ? 3.2 : 0.12;
    lamparas.ambar.material.color.set(blink ? 0xe08a00 : 0x2a2418);
  };
  g.userData.tick(0); // estado inicial coherente (verde encendida)

  // Objeto interactuable = MARCO/frente de la puerta: con el casco ya sólido, el jugador debe
  // poder abrir desde AFUERA (el gabinete BPU del fondo quedaría fuera del alcance del rayo).
  g.userData.interactable = {
    object: marco,
    descriptor: {
      label: `Ingresar al Refugio Minero Dräger N°${numero}`,
      onInteract: () => {
        abierto = !abierto;
        setEstado(abierto);
        window.__mina?.bus.emit('ui:read', {
          title: `REFUGIO MINERO DRÄGER N°${numero} — NEXA`,
          body:
            (abierto ? 'Estado: OCUPADO (semáforo rojo). ' : 'Estado: DISPONIBLE (semáforo verde). ') +
            'Cámara de rescate Dräger | SIMSA. Capacidad: 20 personas. ' +
            'ANATOMÍA: 1) PRECÁMARA (esclusa) — área de transición que evita el ingreso de ' +
            'gases tóxicos; 2) BPU — unidad de protección respiratoria que purifica el aire; ' +
            '3) BANCO DE BATERÍAS — energía ininterrumpida para iluminación y A/C; ' +
            '4) CILINDROS DE O2 — reservas de alta presión para regenerar la atmósfera; ' +
            '5) ASIENTOS Y ALMACENAMIENTO — raciones de supervivencia, agua y botiquín. ' +
            'PROCEDIMIENTO: ingresar por la esclusa, sellar ambas puertas estancas, activar la ' +
            'BPU, abrir el O2 y comunicar por la línea de vida hasta el rescate. Autonomía: 36 h.'
        });
      }
    }
  };

  return g;
}
