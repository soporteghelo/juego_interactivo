import * as THREE from 'three';

/**
 * SENALETICA — md: "Senaletica — Sistema completo". Se dibuja con CanvasTexture usando los
 * colores y textos EXACTOS del md (sin imagenes externas). Para editar una senal, modifica
 * su funcion en TIPOS_SENAL.
 *
 * Cada senal lleva userData.signText (para "leerla" en el juego).
 */

export const meta = {
  id: 'senal',
  nombre: 'Senaletica',
  descripcion: 'Letreros del sistema de seguridad (peligro, advertencia, EPP, via de escape, etc.).'
};

const _texCache = new Map();
const _matCache = new Map();

function lienzo(w = 512, h = 340) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function textura(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function textoCentrado(ctx, text, x, y, maxWidth, fontSize, color, weight = 'bold') {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${fontSize}px Arial`;
  const lines = text.split('\n');
  const lh = fontSize * 1.1;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y - ((lines.length - 1) * lh) / 2 + i * lh, maxWidth);
  });
}

/** Definicion de cada tipo de senal (colores literales del md). */
export const TIPOS_SENAL = {
  peligro_no_ingresar() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    textoCentrado(ctx, 'PELIGRO\nNO INGRESAR', canvas.width / 2, canvas.height / 2, 460, 72, '#ffffff');
    return { canvas, text: 'PELIGRO — NO INGRESAR. Zona restringida.' };
  },
  voladura() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    // Estallido (símbolo de voladura)
    ctx.fillStyle = '#ffcc00';
    ctx.save(); ctx.translate(canvas.width / 2, 118);
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = k % 2 ? 22 : 52;
      ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
    textoCentrado(ctx, 'VOLADURA\nPROHIBIDO PASAR', canvas.width / 2, 250, 470, 56, '#ffffff');
    return { canvas, text: 'VOLADURA — Frente cargado con explosivos. PROHIBIDO PASAR. Área bloqueada.' };
  },
  peligro_caida() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'PELIGRO\nCAIDA DE ROCA', canvas.width / 2, canvas.height / 2, 470, 64, '#ffffff');
    return { canvas, text: 'PELIGRO — Caida de roca. Riesgo de desprendimiento.' };
  },
  advertencia() {
    const { canvas, ctx } = lienzo(640, 320);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(40, 70); ctx.lineTo(90, 70); ctx.lineTo(65, 25); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 28px Arial'; ctx.textAlign = 'left'; ctx.fillText('SSOMA', 100, 60);
    textoCentrado(ctx, 'ADVERTENCIA', canvas.width / 2, canvas.height / 2 + 30, 560, 96, '#111');
    return { canvas, text: 'ADVERTENCIA — Proceda con precaucion.' };
  },
  via_escape() {
    const { canvas, ctx } = lienzo();
    ctx.fillStyle = '#1b5e20'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(170, 110, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(150, 140, 40, 80);
    ctx.beginPath();
    ctx.moveTo(300, 170); ctx.lineTo(420, 170); ctx.lineTo(420, 140);
    ctx.lineTo(480, 190); ctx.lineTo(420, 240); ctx.lineTo(420, 210); ctx.lineTo(300, 210);
    ctx.closePath(); ctx.fill();
    textoCentrado(ctx, 'VIA DE ESCAPE', canvas.width / 2, 290, 460, 48, '#fff');
    return { canvas, text: 'VIA DE ESCAPE — Ruta de evacuacion.' };
  },
  peatones() {
    // VÍA PEATONAL: azul informativo, figura caminando — circular por la berma señalizada.
    const { canvas, ctx } = lienzo(360, 300);
    ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, 0, 360, 300);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, 340, 280);
    // Peatón caminando (figura blanca simple)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(180, 92, 22, 0, Math.PI * 2); ctx.fill();     // cabeza
    ctx.fillRect(168, 118, 26, 70);                                        // torso
    ctx.save(); ctx.translate(181, 188); ctx.lineWidth = 14; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-24, 54); ctx.moveTo(0, 0); ctx.lineTo(26, 46); ctx.stroke(); // piernas
    ctx.beginPath(); ctx.moveTo(-13, -50); ctx.lineTo(-40, -12); ctx.moveTo(13, -50); ctx.lineTo(38, -20); ctx.stroke(); // brazos
    ctx.restore();
    textoCentrado(ctx, 'VÍA PEATONAL', 180, 262, 320, 40, '#ffffff');
    return { canvas, text: 'VÍA PEATONAL — Circula por la berma señalizada, fuera de la calzada de equipos.' };
  },
  uso_epp() {
    const { canvas, ctx } = lienzo(420, 540);
    ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'USO OBLIGATORIO\nE.P.P.', canvas.width / 2, 70, 380, 44, '#fff');
    const items = ['CASCO', 'LENTES', 'RESPIRADOR', 'BOTAS', 'GUANTES', 'CHALECO'];
    items.forEach((label, i) => {
      const cx = 110 + (i % 2) * 200;
      const cy = 200 + Math.floor(i / 2) * 120;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 64);
    });
    return { canvas, text: 'USO OBLIGATORIO DE EPP: casco, lentes, respirador, botas, guantes, chaleco.' };
  },
  refugio_peatonal() {
    // Nicho / refugio PEATONAL: verde seguridad, figura resguardada en una hornacina + flecha.
    const { canvas, ctx } = lienzo(360, 300);
    ctx.fillStyle = '#0d6b2a'; ctx.fillRect(0, 0, 360, 300);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, 340, 280);
    // Hornacina (arco) con persona dentro
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(120, 210); ctx.lineTo(120, 120);
    ctx.arc(180, 120, 60, Math.PI, 0); ctx.lineTo(240, 210); ctx.closePath();
    ctx.stroke();
    ctx.beginPath(); ctx.arc(180, 110, 20, 0, Math.PI * 2); ctx.fill();      // cabeza
    ctx.fillRect(165, 132, 30, 66);                                          // torso
    textoCentrado(ctx, 'REFUGIO', 180, 258, 320, 46, '#ffffff');
    return { canvas, text: 'REFUGIO PEATONAL — Resguárdate en el nicho al pasar un equipo.' };
  },
  refugio_banner() {
    const { canvas, ctx } = lienzo(700, 220);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'REFUGIO MINERO N°2', canvas.width / 2, 80, 640, 64, '#111');
    textoCentrado(ctx, 'NEXA · UNIDAD MINERA', canvas.width / 2, 150, 640, 34, '#111', 'normal');
    return { canvas, text: 'REFUGIO MINERO N°2 — NEXA, Unidad Minera.' };
  },
  refugio_entrada() {
    const { canvas, ctx } = lienzo(400, 200);
    ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'ENTRADA / ENTRY', canvas.width / 2, 70, 360, 40, '#fff');
    textoCentrado(ctx, 'CAPACIDAD 20', canvas.width / 2, 140, 360, 36, '#ffcc00');
    return { canvas, text: 'ENTRADA / ENTRY — Capacidad 20 personas.' };
  },
  navegacion() {
    const { canvas, ctx } = lienzo(520, 200);
    ctx.fillStyle = '#1b3a1b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'CX.081 · NV-1600', canvas.width / 2, 80, 480, 56, '#fff');
    textoCentrado(ctx, 'ZONA MINA', canvas.width / 2, 150, 480, 40, '#39ff14');
    return { canvas, text: 'Navegacion: CX.081 / NV-1600.' };
  },
  monitoreo_gases() {
    const { canvas, ctx } = lienzo(440, 320);
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    textoCentrado(ctx, 'MONITOREO DE GASES', canvas.width / 2, 50, 400, 32, '#39ff14');
    const rows = ['O2 .... 20.9%', 'CO ..... 0 ppm', 'CO2 ... 400 ppm', 'NO2 .... 0 ppm'];
    ctx.font = '24px monospace'; ctx.fillStyle = '#cfe8cf'; ctx.textAlign = 'left';
    rows.forEach((r, i) => ctx.fillText(r, 50, 120 + i * 44));
    return { canvas, text: 'Monitoreo de gases: O2 20.9%, CO 0ppm, CO2 400ppm, NO2 0ppm.' };
  },
  chevron() {
    const { canvas, ctx } = lienzo(256, 256);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    for (let k = 0; k < 2; k++) {
      const off = k * 70;
      ctx.beginPath();
      ctx.moveTo(40 + off, 60); ctx.lineTo(120 + off, 128); ctx.lineTo(40 + off, 196);
      ctx.lineTo(70 + off, 196); ctx.lineTo(150 + off, 128); ctx.lineTo(70 + off, 60);
      ctx.closePath(); ctx.fill();
    }
    return { canvas, text: 'Chevron de direccion.' };
  },
  limite_velocidad() {
    // Señal reglamentaria de transito interior mina: circulo rojo, 20 km/h.
    const { canvas, ctx } = lienzo(360, 440);
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(180, 170, 130, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = 'bold 110px Arial'; ctx.textAlign = 'center';
    ctx.fillText('20', 180, 205);
    textoCentrado(ctx, 'km/h · VELOCIDAD MAXIMA', 180, 380, 330, 30, '#111');
    return { canvas, text: 'VELOCIDAD MAXIMA 20 km/h — transito interior mina.' };
  },
  extintor() {
    const { canvas, ctx } = lienzo(300, 400);
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Pictograma: extintor blanco
    ctx.fillStyle = '#fff';
    ctx.fillRect(125, 90, 50, 130);                       // botella
    ctx.fillRect(140, 60, 20, 30);                        // cuello
    ctx.fillRect(105, 60, 50, 14);                        // manija
    ctx.beginPath(); ctx.moveTo(120, 92); ctx.lineTo(80, 130); ctx.lineTo(92, 140); ctx.lineTo(128, 106); ctx.closePath(); ctx.fill(); // manguera
    textoCentrado(ctx, 'EXTINTOR', 150, 290, 260, 44, '#fff');
    textoCentrado(ctx, 'PQS 9 kg', 150, 345, 260, 28, '#fff', 'normal');
    return { canvas, text: 'EXTINTOR PQS 9 kg — Estacion contra incendio.' };
  },
  telefono() {
    const { canvas, ctx } = lienzo(320, 400);
    ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Pictograma: auricular blanco
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(110, 130, 30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(210, 130, 30, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(160, 155); ctx.rotate(0.0);
    ctx.fillRect(-60, -12, 120, 24); ctx.restore();
    textoCentrado(ctx, 'TELEFONO DE\nEMERGENCIA', 160, 280, 280, 40, '#fff');
    return { canvas, text: 'TELEFONO DE EMERGENCIA — Comunicacion con superficie.' };
  },
  primeros_auxilios() {
    const { canvas, ctx } = lienzo(320, 400);
    ctx.fillStyle = '#1b5e20'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Cruz blanca de primeros auxilios
    ctx.fillStyle = '#fff';
    ctx.fillRect(130, 60, 60, 160);
    ctx.fillRect(80, 110, 160, 60);
    textoCentrado(ctx, 'PRIMEROS AUXILIOS\nCAMILLA · BOTIQUIN', 160, 300, 290, 34, '#fff');
    return { canvas, text: 'PRIMEROS AUXILIOS — Camilla rigida y botiquin.' };
  },
  residuos() {
    const { canvas, ctx } = lienzo(560, 200);
    ctx.fillStyle = '#1b5e20'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    textoCentrado(ctx, 'PUNTO DE ACOPIO DE RESIDUOS', 280, 70, 520, 40, '#fff');
    textoCentrado(ctx, 'SEGREGA SEGUN CODIGO DE COLORES', 280, 140, 520, 28, '#ffcc00', 'normal');
    return { canvas, text: 'PUNTO DE ACOPIO — Segregacion de residuos por codigo de colores (NTP 900.058).' };
  },
  rampa() {
    const { canvas, ctx } = lienzo(420, 420);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.strokeRect(10, 10, 400, 400);
    // Pictograma: cuña de pendiente con camion
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(60, 200); ctx.lineTo(360, 200); ctx.lineTo(360, 120); ctx.closePath(); ctx.fill();
    textoCentrado(ctx, 'RAMPA · PENDIENTE 10%', 210, 265, 380, 36, '#111');
    textoCentrado(ctx, 'USE MARCHA BAJA\nVELOCIDAD MAX 15 km/h', 210, 340, 380, 30, '#111', 'normal');
    return { canvas, text: 'RAMPA — Pendiente 10%. Use marcha baja. Velocidad maxima 15 km/h.' };
  },
  polvorin() {
    const { canvas, ctx } = lienzo(520, 340);
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.strokeRect(10, 10, 500, 320);
    // Pictograma: explosion
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 ? 22 : 46;
      ctx[i ? 'lineTo' : 'moveTo'](260 + Math.cos(a) * r, 88 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    textoCentrado(ctx, 'POLVORIN — EXPLOSIVOS', 260, 190, 480, 44, '#fff');
    textoCentrado(ctx, 'PROHIBIDO EL INGRESO\nSOLO PERSONAL AUTORIZADO', 260, 275, 480, 30, '#fff', 'normal');
    return { canvas, text: 'POLVORIN — EXPLOSIVOS. Prohibido el ingreso. Solo personal autorizado con licencia SUCAMEC.' };
  }
};

/**
 * Crea una senal del tipo indicado.
 * @param {keyof typeof TIPOS_SENAL} tipo
 * @returns {THREE.Mesh}
 */
export function crearSenal(tipo) {
  const def = TIPOS_SENAL[tipo];
  if (!def) throw new Error(`[senal] tipo desconocido: ${tipo}`);

  let entry = _texCache.get(tipo);
  if (!entry) {
    const { canvas, text } = def();
    entry = { texture: textura(canvas), text, aspect: canvas.width / canvas.height };
    _texCache.set(tipo, entry);
  }

  let mat = _matCache.get(tipo);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: entry.texture,
      roughness: 0.7,
      metalness: 0,
      emissive: 0x111111,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide
    });
    _matCache.set(tipo, mat);
  }

  const h = 0.6;
  const w = h * entry.aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.signText = entry.text;
  mesh.name = `senal:${tipo}`;
  return mesh;
}

// Cache de letreros parametricos (rotulos/guias): comparten textura + material + geometria por
// clave, y solo se crea un THREE.Mesh nuevo por instancia. Evita subir decenas de CanvasTexture
// distintas a la GPU (critico en celular).
const _rotuloCache = new Map();
const _guiaCache = new Map();

function _matLetrero(canvas, { emisivo = 0x111111, emisivoInt = 0.18 } = {}) {
  return new THREE.MeshStandardMaterial({
    map: textura(canvas),
    roughness: 0.7,
    metalness: 0,
    emissive: emisivo,
    emissiveIntensity: emisivoInt,
    side: THREE.DoubleSide
  });
}

/**
 * RÓTULO DE LABOR — letrero de navegacion que indica el nombre de la galeria/crucero/via y
 * su tipo (GALERÍA, CRUCERO, VÍA PRINCIPAL, RAMPA, NIVEL). Se genera con el texto real del
 * plano de mina, no hardcodeado. Cacheado por (label|subtitulo|color).
 *
 * @param {string} label      rotulo del plano (p.ej. "Ga 220", "Cx 996", "RN 96")
 * @param {string} subtitulo  tipo de labor (p.ej. "GALERÍA", "CRUCERO")
 * @param {{color?:string}} opts  color del subtitulo
 * @returns {THREE.Mesh}
 */
export function crearRotulo(label, subtitulo = '', { color = '#39ff14' } = {}) {
  const key = `${label}|${subtitulo}|${color}`;
  let entry = _rotuloCache.get(key);
  if (!entry) {
    const { canvas, ctx } = lienzo(560, 200);
    ctx.fillStyle = '#11220e'; ctx.fillRect(0, 0, 560, 200);
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 544, 184);
    textoCentrado(ctx, label, 280, subtitulo ? 78 : 100, 520, 78, '#ffffff');
    if (subtitulo) textoCentrado(ctx, subtitulo, 280, 152, 520, 34, color, 'normal');
    const alto = 0.5, aspect = 560 / 200;
    entry = {
      mat: _matLetrero(canvas),
      geo: new THREE.PlaneGeometry(alto * aspect, alto),
      text: `${label}${subtitulo ? ' — ' + subtitulo : ''}`
    };
    _rotuloCache.set(key, entry);
  }
  const mesh = new THREE.Mesh(entry.geo, entry.mat);
  mesh.userData.signText = entry.text;
  mesh.name = `rotulo:${label}`;
  return mesh;
}

/**
 * GUÍA AL REFUGIO — letrero verde de emergencia con chevron que indica el camino hacia el
 * refugio Dräger de 20 personas. Se cuelga sobre la boca del tunel que lleva al refugio; el
 * chevron y (si se da) la distancia refuerzan la direccion. La distancia se redondea a 5 m
 * para compartir textura entre letreros parecidos (cacheado).
 *
 * @param {{metros?:number|null}} opts  distancia aproximada al refugio (m)
 * @returns {THREE.Mesh}
 */
export function crearGuiaRefugio({ metros = null } = {}) {
  const bucket = metros == null ? null : Math.max(5, Math.round(metros / 5) * 5);
  const key = bucket == null ? 'na' : String(bucket);
  let entry = _guiaCache.get(key);
  if (!entry) {
    const { canvas, ctx } = lienzo(360, 300);
    ctx.fillStyle = '#0d6b2a'; ctx.fillRect(0, 0, 360, 300);     // verde seguridad
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, 340, 280);
    textoCentrado(ctx, 'REFUGIO', 180, 58, 320, 54, '#ffffff');
    // Chevron grueso apuntando hacia la boca (▼).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(105, 118); ctx.lineTo(180, 193); ctx.lineTo(255, 118);
    ctx.lineTo(255, 156); ctx.lineTo(180, 231); ctx.lineTo(105, 156);
    ctx.closePath(); ctx.fill();
    const txt = bucket != null ? `≈ ${bucket} m` : '20 PERSONAS';
    textoCentrado(ctx, txt, 180, 266, 320, 40, '#ffdd00');
    const alto = 0.72, aspect = 360 / 300;
    entry = {
      mat: _matLetrero(canvas, { emisivo: 0x0a3315, emisivoInt: 0.28 }),
      geo: new THREE.PlaneGeometry(alto * aspect, alto),
      text: `Guía a refugio Dräger (20 pers.)${bucket != null ? ` — ≈${bucket} m` : ''}`
    };
    _guiaCache.set(key, entry);
  }
  const mesh = new THREE.Mesh(entry.geo, entry.mat);
  mesh.userData.signText = entry.text;
  mesh.name = 'guia_refugio';
  return mesh;
}

export const CLAVES_SENAL = Object.keys(TIPOS_SENAL);

/** Por defecto (para el visualizador): una senal representativa. */
export function crear({ tipo = 'uso_epp' } = {}) {
  return crearSenal(tipo);
}
