import * as THREE from 'three';

/**
 * TEXTURAS PROCEDURALES — genera mapas (CanvasTexture) para dar realismo a los materiales
 * sin necesidad de imagenes externas (placeholders por codigo). Cada textura se cachea y se
 * configura con repeticion (tiling). Para editar el aspecto de una superficie, modifica su
 * funcion aqui.
 *
 * Nota: en MeshStandardMaterial, `map` se MULTIPLICA por `color`; por eso las texturas de
 * equipos (metal/grunge) son claras con vetas/manchas oscuras: tinen sin perder el color.
 */

const _cache = new Map();

/**
 * ESCALA METRICA DE LA ROCA DE LABOR — metros de mina que cubre UNA baldosa de
 * `texturaRocaTunel` / `…Normal` / `…Rough`.
 *
 * Las tres texturas van con `repeat(1,1)`: la escala la fija la UV de cada malla, que se
 * calcula en METROS y se divide por esta constante. Antes cada malla usaba su propio criterio
 * (la galeria normalizaba la UV sobre su largo, el cruce del CSV y el collar de boca dividian
 * por 2.4 y encima se multiplicaba por `repeat(3,4)`), asi que el grano de la roca cambiaba de
 * tamaño de una labor a otra y era ~6x mas fino en el cruce que en la galeria que entraba en el.
 * Con una sola escala, la piel de roca es CONTINUA de la via al cruce y de un tramo al siguiente.
 *
 * 2.4 m es ademas el avance de un DISPARO de 8 pies, asi que una baldosa = una tanda: la junta
 * entre disparos y las medias cañas del contorno caen donde caen en la labor real.
 */
export const ESCALA_TEXTURA_ROCA = 2.4;

/** Espaciamiento de los taladros de contorno (m). 4 cañas por baldosa de 2.4 m. */
const CANA_ESPACIADO = ESCALA_TEXTURA_ROCA / 4;

function lienzo(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}

function manchas(ctx, size, n, colorFn, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.fillStyle = colorFn();
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** PRNG determinista (mulberry32) — la roca sale IDENTICA en cada carga, sin parpadeos. */
function _prng(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * MEDIAS CAÑAS DE VOLADURA — el rasgo que distingue una labor DISPARADA de una cueva.
 *
 * Los taladros de contorno (Ø45 mm cada ~0.6 m) dejan impresa su mitad en la roca: canales
 * semicilindricos PARALELOS AL EJE de la labor, con la roca desprendida ensanchando el surco a
 * 7-13 cm. El % de cañas visibles es el criterio de calidad del disparo, asi que ~1 de cada 4 no
 * sobrevive y las que quedan van interrumpidas.
 *
 * Convencion de UV de la roca de labor (ver ESCALA_TEXTURA_ROCA):
 *   U (eje X del lienzo) = arco RECORRIDO SOBRE EL PERFIL de herradura (piso→hastial→corona)
 *   V (eje Y del lienzo) = distancia A LO LARGO de la labor
 * Por tanto una caña es una linea de U constante = una franja VERTICAL en el lienzo, y la junta
 * entre disparos es una franja HORIZONTAL (que ademas cae cada 2.4 m = avance de un disparo de 8').
 *
 * Llama a `pintar(x, ancho, yIni, yFin)` por cada tramo de caña, en pixeles del lienzo.
 */
function recorrerMediasCanas(size, pintar) {
  const rnd = _prng(0xCA5A5);
  const M = size / ESCALA_TEXTURA_ROCA;              // pixeles por metro
  const paso = CANA_ESPACIADO * M;
  const junta = 0.09 * M;                            // franja muerta en la junta entre disparos
  const n = Math.round(ESCALA_TEXTURA_ROCA / CANA_ESPACIADO);
  for (let k = 0; k < n; k++) {
    if (rnd() < 0.25) continue;                      // taladro sin caña visible (roca rota entera)
    const x = k * paso + (rnd() - 0.5) * paso * 0.20;
    const w = (0.07 + rnd() * 0.06) * M;             // ancho del surco con desprendimiento
    // La caña va interrumpida: 1-3 tramos entre juntas de disparo.
    let y = junta;
    const yTope = size - junta;
    while (y < yTope) {
      const largo = (0.35 + rnd() * 0.9) * M;
      const fin = Math.min(yTope, y + largo);
      if (fin - y > 0.12 * M) {
        // La textura se repite: una caña que cae sobre el borde se pinta TAMBIEN desplazada un
        // ancho de lienzo, o su otra mitad faltaria y el mosaico enseñaria la costura.
        pintar(x, w, y, fin);
        if (x - w / 2 < 0) pintar(x + size, w, y, fin);
        else if (x + w / 2 > size) pintar(x - size, w, y, fin);
      }
      y = fin + (0.05 + rnd() * 0.30) * M;           // hueco donde la roca se llevo la caña
    }
  }
}

function crearTextura(id, dibujar, { repeat = [4, 4], size = 256 } = {}) {
  if (_cache.has(id)) return _cache.get(id);
  const { c, ctx } = lienzo(size);
  dibujar(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  _cache.set(id, tex);
  return tex;
}

/** Roca dura oscura, granulada e irregular. */
export const texturaRoca = () => crearTextura('roca', (ctx, s) => {
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 260, () => `rgba(${10 + Math.random() * 30 | 0},${10 + Math.random() * 30 | 0},${10 + Math.random() * 28 | 0},0.5)`, 2, 14);
  manchas(ctx, s, 120, () => `rgba(${70 + Math.random() * 40 | 0},${68 + Math.random() * 38 | 0},${62 + Math.random() * 34 | 0},0.35)`, 1, 6);
}, { repeat: [5, 5] });

/**
 * Roca de TÚNEL (caliza gris de mina, según el escaneo real): base gris clara con
 * grietas oscuras, salientes blancas, motas minerales/ocre y grano fino. Centrada en un gris
 * medio-alto para MODULAR (no oscurecer) el color por vértice del shell. 512px para detalle.
 *
 * Encima lleva la firma de la VOLADURA: la sombra en el fondo de cada media caña y el reborde
 * claro de roca fresca entre ellas. Es un tinte SUAVE — el relieve de verdad lo pone el
 * normalMap; aquí solo se acompaña para que la caña se lea también con luz rasante.
 *
 * `repeat(1,1)`: la escala la fija la UV métrica de cada malla (ver ESCALA_TEXTURA_ROCA).
 */
export const texturaRocaTunel = () => crearTextura('rocaTunel', (ctx, s) => {
  ctx.fillStyle = '#a9a59d'; ctx.fillRect(0, 0, s, s);                                                       // base caliza
  manchas(ctx, s, 240, () => `rgba(${40 + Math.random() * 28 | 0},${38 + Math.random() * 26 | 0},${34 + Math.random() * 22 | 0},0.45)`, 3, 18); // grietas oscuras
  manchas(ctx, s, 190, () => `rgba(${196 + Math.random() * 45 | 0},${193 + Math.random() * 42 | 0},${186 + Math.random() * 40 | 0},0.42)`, 2, 13); // salientes claras
  manchas(ctx, s, 45,  () => `rgba(${150 + Math.random() * 40 | 0},${116 + Math.random() * 30 | 0},${74 + Math.random() * 28 | 0},0.28)`, 1, 6);  // ocre/mineral
  manchas(ctx, s, 500, () => `rgba(${120 + Math.random() * 80 | 0},${118 + Math.random() * 78 | 0},${112 + Math.random() * 72 | 0},0.18)`, 1, 3); // grano fino

  // Medias cañas: sombra en el canal + labio de roca fresca (mas clara) a cada lado.
  recorrerMediasCanas(s, (x, w, y0, y1) => {
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0.00, 'rgba(210,206,198,0.30)');   // labio izquierdo, roca recien expuesta
    g.addColorStop(0.28, 'rgba(96,92,84,0.34)');
    g.addColorStop(0.50, 'rgba(64,61,55,0.42)');      // fondo del canal, en sombra
    g.addColorStop(0.72, 'rgba(96,92,84,0.34)');
    g.addColorStop(1.00, 'rgba(210,206,198,0.30)');   // labio derecho
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y0, w, y1 - y0);
  });
}, { repeat: [1, 1], size: 512 });

/**
 * NORMAL MAP de la roca de túnel: se genera un campo de altura (huecos/salientes/grano) y se
 * derivan las normales por gradiente → la pared capta la luz del headlamp con relieve 3D real.
 * colorSpace lineal (NoColorSpace), como exige un normal map.
 */
export const texturaRocaTunelNormal = () => {
  if (_cache.has('rocaTunelN')) return _cache.get('rocaTunelN');
  const size = 512;
  // 1) Campo de altura en gris
  const { ctx: h } = lienzo(size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  manchas(h, size, 320, () => `rgba(30,30,30,${0.12 + Math.random() * 0.22})`, 3, 22);   // huecos (bajos)
  manchas(h, size, 280, () => `rgba(220,220,220,${0.12 + Math.random() * 0.22})`, 2, 15); // salientes (altos)
  manchas(h, size, 600, () => `rgba(${Math.random() < 0.5 ? 60 : 200},${Math.random() < 0.5 ? 60 : 200},${Math.random() < 0.5 ? 60 : 200},0.16)`, 1, 3); // grano

  // ── MEDIAS CAÑAS: canal CONCAVO (la mitad del taladro que quedo en la roca) ──
  // Perfil semicircular aproximado por paradas de gradiente: hondo en el eje, al ras en el
  // borde, con un labio ligeramente saliente donde la roca se astillo entre taladro y taladro.
  recorrerMediasCanas(size, (x, w, y0, y1) => {
    const g = h.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0.00, 'rgba(150,150,150,0.55)');  // labio saliente
    g.addColorStop(0.14, 'rgba(112,112,112,0.75)');
    g.addColorStop(0.30, 'rgba(92,92,92,0.85)');
    g.addColorStop(0.50, 'rgba(82,82,82,0.90)');     // fondo del canal
    g.addColorStop(0.70, 'rgba(92,92,92,0.85)');
    g.addColorStop(0.86, 'rgba(112,112,112,0.75)');
    g.addColorStop(1.00, 'rgba(150,150,150,0.55)');
    h.fillStyle = g;
    h.fillRect(x - w / 2, y0, w, y1 - y0);
  });

  // ── JUNTA ENTRE DISPAROS: en y=0 (y por tanto cada 2.4 m = un avance de 8') las cañas de una
  // tanda no empalman con las de la anterior y queda un resalte irregular en el contorno. Se
  // dibuja a caballo del borde superior E inferior para que el mosaico la cierre continua.
  const M = size / ESCALA_TEXTURA_ROCA;
  const rj = _prng(0x105A11);
  for (const yBase of [0, size]) {
    for (let x = 0; x < size; x += 7) {
      const alto = (0.035 + rj() * 0.05) * M;
      const claro = rj() < 0.5;
      h.fillStyle = claro ? `rgba(206,206,206,0.42)` : `rgba(66,66,66,0.42)`;
      h.fillRect(x, yBase - alto / 2, 8, alto);
    }
  }

  const src = h.getImageData(0, 0, size, size).data;
  // 2) Normales por gradiente central
  const { c: nc, ctx: nctx } = lienzo(size);
  const dst = nctx.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = H(x + 1, y) - H(x - 1, y);
      const dy = H(x, y + 1) - H(x, y - 1);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      dst.data[i] = (nx * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }
  nctx.putImageData(dst, 0, 0);
  const tex = new THREE.CanvasTexture(nc);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);   // la escala la fija la UV metrica de la malla (ESCALA_TEXTURA_ROCA)
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  _cache.set('rocaTunelN', tex);
  return tex;
};

/**
 * ROUGHNESS MAP de la roca de túnel: base CLARA (roca seca = mate) con ESCURRIMIENTOS
 * y MANCHAS de humedad OSCURAS (rugosidad baja) → la pared BRILLA de humedad
 * donde corre/condensa el agua. En MeshStandardMaterial el canal verde del roughnessMap
 * MULTIPLICA `material.roughness`, así que oscuro = mojado/brillante, claro = seco/mate.
 * md: "wet glistening rock", "brillo húmedo en toda la roca", ambiente saturado (>90% HR).
 * colorSpace LINEAL (NoColorSpace), como todo dato no-color. Se cachea y comparte.
 *
 * OJO CON LA ORIENTACION: el agua cae por GRAVEDAD, o sea que baja recorriendo el PERFIL de la
 * herradura (corona → hastial → piso), que es el eje U = eje X del lienzo. Los escurrimientos van
 * por tanto alargados EN X. Antes se dibujaban alargados en Y, que es el eje de la LABOR: el
 * resultado eran manchas húmedas de varios metros TUMBADAS a lo largo de la galería, en vez de
 * chorreras bajando por la pared.
 */
export const texturaRocaTunelRough = () => {
  if (_cache.has('rocaTunelRough')) return _cache.get('rocaTunelRough');
  const size = 512;
  const { c, ctx } = lienzo(size);
  // Base seca (clara = rugosa/mate)
  ctx.fillStyle = '#efeeea'; ctx.fillRect(0, 0, size, size);
  // Escurrimientos de agua BAJANDO por el perfil (elipses alargadas en X = a lo largo de U).
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 55 + Math.random() * 250;             // longitud de la chorrera (baja por la pared)
    const h = 3 + Math.random() * 11;               // ancho de la chorrera
    const g = 55 + Math.random() * 75 | 0;          // 55..130 → roughness ~0.22..0.51
    ctx.fillStyle = `rgba(${g},${g},${g + 6 | 0},0.5)`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // El agua se ESTANCA en el fondo de las medias cañas: el canal queda mojado y brillante en
  // tramos, que es lo que delata la caña cuando la luz la roza de frente.
  recorrerMediasCanas(size, (x, w, y0, y1) => {
    if ((y1 - y0) < size * 0.06) return;
    ctx.fillStyle = 'rgba(74,76,84,0.34)';
    ctx.fillRect(x - w * 0.28, y0, w * 0.56, y1 - y0);
  });
  // Manchas de humedad/condensación irregulares repartidas
  manchas(ctx, size, 70, () => {
    const g = 70 + Math.random() * 80 | 0;
    return `rgba(${g},${g},${g + 4 | 0},0.4)`;
  }, 4, 26);
  // Pocas pozas muy brillantes: agua estancada en oquedades/repisas
  manchas(ctx, size, 14, () => `rgba(38,40,46,0.55)`, 2, 9);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);   // la escala la fija la UV metrica de la malla (ESCALA_TEXTURA_ROCA)
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  _cache.set('rocaTunelRough', tex);
  return tex;
};

/**
 * NORMAL MAP de AGUA CORRIENDO (canal de drenaje y cunetas): rizos suaves ALARGADOS en el
 * sentido del flujo (eje V = a lo largo del tunel). El material la desplaza (offset.y) cada
 * frame → el agua "corre" hacia la poza de bombeo, como pide el md ("canal central de
 * drenaje con agua"). 128px basta: el agua es una lamina angosta y el rizo es suave.
 * colorSpace LINEAL (NoColorSpace), como todo normal map. Cacheada y COMPARTIDA: un solo
 * offset anima el agua de TODA la mina.
 */
export const texturaAguaNormal = () => {
  if (_cache.has('aguaN')) return _cache.get('aguaN');
  const size = 128;
  // 1) Campo de altura: ondas alargadas en V (flujo) + rizo fino transversal
  const { ctx: h } = lienzo(size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const g = Math.random() < 0.5 ? 60 : 200;      // valle o cresta
    h.fillStyle = `rgba(${g},${g},${g},${0.10 + Math.random() * 0.16})`;
    h.beginPath();
    // Elipses MUY alargadas en Y (el flujo estira el rizo a lo largo del canal)
    h.ellipse(x, y, 2 + Math.random() * 5, 14 + Math.random() * 30, 0, 0, Math.PI * 2);
    h.fill();
  }
  const src = h.getImageData(0, 0, size, size).data;
  // 2) Normales por gradiente central (mismo metodo que texturaRocaTunelNormal)
  const { c: nc, ctx: nctx } = lienzo(size);
  const dst = nctx.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 1.4;   // rizo suave: el agua no es roca
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = H(x + 1, y) - H(x - 1, y);
      const dy = H(x, y + 1) - H(x, y - 1);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      dst.data[i] = (nx * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }
  nctx.putImageData(dst, 0, 0);
  const tex = new THREE.CanvasTexture(nc);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  tex.colorSpace = THREE.NoColorSpace;
  _cache.set('aguaN', tex);
  return tex;
};

/** Shotcrete: spray rugoso gris claro con motas. */
export const texturaShotcrete = () => crearTextura('shotcrete', (ctx, s) => {
  ctx.fillStyle = '#c8c8c0'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 500, () => `rgba(${150 + Math.random() * 60 | 0},${150 + Math.random() * 60 | 0},${145 + Math.random() * 55 | 0},0.5)`, 1, 4);
  manchas(ctx, s, 60, () => `rgba(120,118,110,0.25)`, 6, 22); // manchas de humedad
}, { repeat: [4, 4] });

/** Barro de piso (marron mojado mezclado con grava). */
export const texturaBarro = () => crearTextura('barro', (ctx, s) => {
  ctx.fillStyle = '#4a4036'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 300, () => `rgba(${40 + Math.random() * 30 | 0},${34 + Math.random() * 26 | 0},${26 + Math.random() * 20 | 0},0.6)`, 2, 12);
  manchas(ctx, s, 120, () => `rgba(${90 + Math.random() * 40 | 0},${82 + Math.random() * 36 | 0},${70 + Math.random() * 30 | 0},0.4)`, 1, 5); // grava clara
}, { repeat: [4, 8] });

/**
 * PISO DE LABOR con HUELLA DE NEUMATICO — md, "Pisos y pasaje": "marcas de neumáticos de equipo
 * pesado (huellas en barro)". El piso ya tenia los SURCOS tallados en la malla (dos carriles
 * hundidos), pero la depresion sola no se lee: faltaba el dibujo del taco impreso en el barro.
 *
 * Convencion de UV del piso (ver `BaseSegment._buildFloor`): U = 0..1 EXACTO a lo ancho de la
 * labor, V metrica a lo largo. Por eso los dos carriles se pueden hornear a U fija — caen sobre
 * los surcos de la malla, que van a ±0.2·ancho del eje, o sea U = 0.30 y U = 0.70.
 *
 * Es una textura de MODULACION (multiplica al color del material): base clara neutra, huella y
 * suciedad en tonos mas oscuros.
 */
export const ESCALA_PISO_V = 6.0;        // metros de labor que cubre una baldosa a lo largo
const CARRILES_U = [0.30, 0.70];         // centro de cada surco de rodadura, en U

function _dibujarHuella(ctx, s, cx, ancho, oscuro, alfa) {
  const rnd = _prng(0x7A0C0 + Math.round(cx * 1000));
  const x0 = cx * s - ancho / 2;
  // Sombra general del carril: el barro ahi esta mas compactado y mas humedo.
  const sombra = ctx.createLinearGradient(x0, 0, x0 + ancho, 0);
  sombra.addColorStop(0.0, `rgba(${oscuro},${oscuro},${oscuro},0)`);
  sombra.addColorStop(0.5, `rgba(${oscuro},${oscuro},${oscuro},${alfa * 0.55})`);
  sombra.addColorStop(1.0, `rgba(${oscuro},${oscuro},${oscuro},0)`);
  ctx.fillStyle = sombra;
  ctx.fillRect(x0, 0, ancho, s);
  // TACOS: el neumatico de un scoop lleva taco en V (chevron). Se dibujan como barras inclinadas
  // alternas, con paso irregular — el equipo patina y no estampa dos pisadas iguales.
  const paso = s / 13;                    // ~13 tacos por baldosa (0.46 m entre tacos a 6 m)
  for (let i = 0; i < 13; i++) {
    if (rnd() < 0.22) continue;           // pisada borrada por el agua o por otro equipo
    const y = i * paso + (rnd() - 0.5) * paso * 0.3;
    const a = alfa * (0.45 + rnd() * 0.55);
    ctx.strokeStyle = `rgba(${oscuro},${oscuro},${oscuro},${a})`;
    ctx.lineWidth = paso * (0.26 + rnd() * 0.18);
    ctx.lineCap = 'round';
    // Dos ramas del chevron, encontrandose en el centro del carril.
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + ancho / 2, y + paso * 0.42);
    ctx.lineTo(x0 + ancho, y);
    ctx.stroke();
  }
}

/** Piso de labor: barro/grava compactada con los dos carriles de rodadura impresos. */
export const texturaPisoMina = () => crearTextura('pisoMina', (ctx, s) => {
  ctx.fillStyle = '#b6ada2'; ctx.fillRect(0, 0, s, s);                                   // base clara (modula)
  manchas(ctx, s, 320, () => `rgba(${86 + Math.random() * 34 | 0},${78 + Math.random() * 30 | 0},${66 + Math.random() * 26 | 0},0.5)`, 2, 13);  // barro
  manchas(ctx, s, 200, () => `rgba(${170 + Math.random() * 55 | 0},${164 + Math.random() * 50 | 0},${152 + Math.random() * 46 | 0},0.4)`, 1, 6); // grava clara
  for (const u of CARRILES_U) _dibujarHuella(ctx, s, u, s * 0.115, 74, 0.5);
}, { repeat: [1, 1], size: 512 });

/**
 * NORMAL MAP del piso: relieve del taco impreso + grano de grava. Es lo que hace que la huella
 * capte el rasante del headlamp en vez de leerse como una calcomania pintada.
 */
export const texturaPisoMinaNormal = () => {
  if (_cache.has('pisoMinaN')) return _cache.get('pisoMinaN');
  const size = 512;
  const { ctx: h } = lienzo(size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  manchas(h, size, 420, () => `rgba(60,60,60,${0.10 + Math.random() * 0.18})`, 2, 10);    // huecos de grava
  manchas(h, size, 360, () => `rgba(200,200,200,${0.10 + Math.random() * 0.18})`, 1, 7);  // cantos salientes
  // El taco HUNDE el barro: se dibuja oscuro (bajo) con el mismo trazado que el color.
  for (const u of CARRILES_U) _dibujarHuella(h, size, u, size * 0.115, 48, 0.75);

  const src = h.getImageData(0, 0, size, size).data;
  const { c: nc, ctx: nctx } = lienzo(size);
  const dst = nctx.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 1.7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = H(x + 1, y) - H(x - 1, y);
      const dy = H(x, y + 1) - H(x, y - 1);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      dst.data[i] = (nx * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }
  nctx.putImageData(dst, 0, 0);
  const tex = new THREE.CanvasTexture(nc);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  _cache.set('pisoMinaN', tex);
  return tex;
};

/** Lodo espeso (marron mas oscuro y uniforme). */
export const texturaLodo = () => crearTextura('lodo', (ctx, s) => {
  ctx.fillStyle = '#332a20'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 200, () => `rgba(${30 + Math.random() * 24 | 0},${24 + Math.random() * 20 | 0},${16 + Math.random() * 16 | 0},0.6)`, 4, 20);
}, { repeat: [2, 2] });

/** Metal cepillado claro con rayones (para acero; tine con color del material). */
export const texturaMetal = () => crearTextura('metal', (ctx, s) => {
  ctx.fillStyle = '#cfcfcf'; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(150,150,150,0.35)'; ctx.lineWidth = 1;
  for (let y = 0; y < s; y += 2) { ctx.beginPath(); ctx.moveTo(0, y + Math.random()); ctx.lineTo(s, y + Math.random()); ctx.stroke(); }
  manchas(ctx, s, 40, () => 'rgba(90,90,90,0.3)', 1, 5); // rayones/manchas
}, { repeat: [2, 2] });

/** Grunge claro con polvo y rayones (para equipos de color: tablero, manga, vehiculos). */
export const texturaGrunge = () => crearTextura('grunge', (ctx, s) => {
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 160, () => `rgba(${120 + Math.random() * 60 | 0},${110 + Math.random() * 60 | 0},${100 + Math.random() * 50 | 0},0.35)`, 2, 16); // polvo
  ctx.strokeStyle = 'rgba(70,60,50,0.25)';
  for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * s, Math.random() * s); ctx.lineTo(Math.random() * s, Math.random() * s); ctx.stroke(); }
}, { repeat: [1, 1] });

/** Oxido naranja-cafe (para malla y piezas oxidadas). */
export const texturaOxido = () => crearTextura('oxido', (ctx, s) => {
  ctx.fillStyle = '#a0522d'; ctx.fillRect(0, 0, s, s);
  manchas(ctx, s, 220, () => `rgba(${120 + Math.random() * 50 | 0},${60 + Math.random() * 40 | 0},${20 + Math.random() * 30 | 0},0.5)`, 2, 12);
}, { repeat: [3, 3] });

/**
 * Acero estructural OXIDADO con ESCURRIMIENTO: base de acero sucio con parches de oxido y VETAS
 * verticales que "chorrean" hacia abajo — el agua de filtracion (mina a >90% HR) lava el oxido de
 * bordes/soldaduras/pernos. Base clara (tiñe sin aplanar el color del material, como el resto de
 * mapas de metal). Para bandejas, marcos y anillos de acero fijo; NO para la pintura de equipos.
 */
export const texturaOxidoEscurrido = () => crearTextura('oxidoEscurrido', (ctx, s) => {
  ctx.fillStyle = '#b9b2a6'; ctx.fillRect(0, 0, s, s);                          // acero sucio (claro)
  manchas(ctx, s, 90, () => `rgba(${150 + Math.random() * 40 | 0},${80 + Math.random() * 35 | 0},${40 + Math.random() * 25 | 0},0.5)`, 3, 16); // parches de oxido
  for (let i = 0; i < 26; i++) {                                                // vetas de escurrimiento
    const x = Math.random() * s, y0 = Math.random() * s * 0.5;
    const len = s * (0.25 + Math.random() * 0.55);
    const grad = ctx.createLinearGradient(x, y0, x, y0 + len);
    grad.addColorStop(0, `rgba(120,${55 + Math.random() * 25 | 0},25,0.5)`);
    grad.addColorStop(1, 'rgba(120,60,25,0)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + (Math.random() - 0.5) * 4, y0 + len); ctx.stroke();
  }
}, { repeat: [2, 2] });

/**
 * MANGA DE VENTILACION en labor. A diferencia del resto de texturas, esta lleva el COLOR
 * HORNEADO (su material va con `color: 0xffffff`): la manga naranja se ensucia con SALPICADURA
 * BLANCA DE SHOTCRETE, y una salpicadura blanca no se puede pintar con una textura que solo
 * multiplica sobre naranja. Incluye ademas la costura helicoidal del ducto y el desgaste.
 *
 * El eje V de la TubeGeometry recorre la CIRCUNFERENCIA, asi que las bandas horizontales de
 * aqui envuelven la manga y las diagonales leen como la espiral del refuerzo.
 */
export const texturaManga = () => crearTextura('manga', (ctx, s) => {
  ctx.fillStyle = '#e84000'; ctx.fillRect(0, 0, s, s);                          // naranja de manga activa
  // Pliegues/arrugas longitudinales del plastico flexible.
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * s;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '150,40,0' : '255,120,60'},${0.10 + Math.random() * 0.18})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y + (Math.random() - 0.5) * 8); ctx.stroke();
  }
  // Costura helicoidal del refuerzo (la manga se fabrica en espiral).
  ctx.strokeStyle = 'rgba(120,35,0,0.35)'; ctx.lineWidth = 4;
  for (let k = -s; k < s * 2; k += 64) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + s * 0.45, s); ctx.stroke();
  }
  // Suciedad de labor y desgaste.
  manchas(ctx, s, 45, () => `rgba(${60 + Math.random() * 40 | 0},${35 + Math.random() * 25 | 0},20,${0.10 + Math.random() * 0.20})`, 4, 22);
  // SALPICADURA DE SHOTCRETE: lo que mas ensucia una manga en labor de sostenimiento. Costras
  // blancas irregulares, mas densas en la mitad que da a la pared rociada.
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    const r = 2 + Math.random() * 11;
    ctx.fillStyle = `rgba(${215 + Math.random() * 35 | 0},${212 + Math.random() * 35 | 0},${205 + Math.random() * 30 | 0},${0.45 + Math.random() * 0.5})`;
    ctx.beginPath();
    // Costra irregular, no circulo perfecto.
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const rr = r * (0.6 + Math.random() * 0.7);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
}, { repeat: [1, 1], size: 512 });

/** Goma de neumatico (negro con surcos). */
export const texturaGoma = () => crearTextura('goma', (ctx, s) => {
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#2c2c2c';
  for (let x = 0; x < s; x += 18) ctx.fillRect(x, 0, 9, s); // banda de rodadura
}, { repeat: [3, 1] });
