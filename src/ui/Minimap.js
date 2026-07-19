/**
 * Minimap al estilo GTA V: radar circular en la esquina inferior derecha.
 *
 * Muestra la planta del trazado (tramos como rellenos de color segun tipo)
 * con el jugador siempre centrado y el mapa rotado segun la orientacion del jugador.
 * No requiere Three.js: todo es Canvas2D sobre el HUD DOM.
 */
export class Minimap {
  constructor({ bus, world, container }) {
    this._bus = bus;
    this._segments = world.segments;

    this._playerX = 0;
    this._playerZ = 0;
    this._playerYaw = 0;
    this._visible = false;

    this._canvas = null;
    this._ctx = null;

    this._build(container);

    bus.on('player:moved', ({ position, yaw }) => {
      this._playerX = position.x;
      this._playerZ = position.z;
      if (yaw !== undefined) this._playerYaw = yaw;
    });

    bus.on('engine:begin', () => {
      this._visible = true;
      this._canvas.classList.add('visible');
    });
  }

  _build(container) {
    const SIZE = 180;
    this._size = SIZE;

    this._canvas = document.createElement('canvas');
    this._canvas.width  = SIZE;
    this._canvas.height = SIZE;
    this._canvas.className = 'hud-minimap';
    container.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    // ── ZOOM del mapa: escala (px por metro) ajustable ──
    this._scale = 2.0;
    this._minScale = 0.6;    // muy alejado (se ve casi toda la mina)
    this._maxScale = 9.0;    // muy cerca (una interseccion llena el radar)

    // Botones ＋/－ dibujados en el radar (hit-test por coordenada). Radio y centros fijos.
    this._btnR = 12;
    this._btnPlus  = { x: 16, y: SIZE - 16 };
    this._btnMinus = { x: SIZE - 16, y: SIZE - 16 };

    this._installZoomControls();
  }

  /** Aplica un factor de zoom acotado. */
  _zoom(factor) {
    this._scale = Math.max(this._minScale, Math.min(this._maxScale, this._scale * factor));
  }

  /** Convierte un evento de puntero a coordenadas del canvas (respeta el escalado CSS). */
  _toCanvas(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this._canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this._canvas.height / rect.height)
    };
  }

  _hitBtn(pt, b) {
    return (pt.x - b.x) ** 2 + (pt.y - b.y) ** 2 <= (this._btnR + 3) ** 2;
  }

  /** Rueda (escritorio), botones ＋/－ (click/tap) y pellizco (móvil). Autocontenido. */
  _installZoomControls() {
    const cv = this._canvas;

    // Rueda del ratón sobre el radar.
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });

    // Click / tap en los botones ＋ / －.
    cv.addEventListener('pointerdown', (e) => {
      const pt = this._toCanvas(e);
      if (this._hitBtn(pt, this._btnPlus))  { e.preventDefault(); this._zoom(1.35); }
      else if (this._hitBtn(pt, this._btnMinus)) { e.preventDefault(); this._zoom(1 / 1.35); }
    });

    // Pellizco de dos dedos (táctil).
    let d0 = 0, s0 = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    cv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { d0 = dist(e.touches); s0 = this._scale; }
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && d0 > 0) {
        e.preventDefault();
        this._scale = Math.max(this._minScale, Math.min(this._maxScale, s0 * (dist(e.touches) / d0)));
      }
    }, { passive: false });
    cv.addEventListener('touchend', () => { d0 = 0; });
  }

  /** Llamado cada frame por el Loop. */
  update() {
    if (!this._visible) return;
    this._draw();
  }

  _draw() {
    const ctx  = this._ctx;
    const S    = this._size;
    const cx   = S / 2;
    const cy   = S / 2;
    const R    = cx - 2;           // radio del circulo clip
    const SCALE = this._scale;     // pixeles por metro (ajustable con el zoom)

    ctx.clearRect(0, 0, S, S);

    /* ─── Clip circular ─── */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    /* ─── Fondo oscuro de mina ─── */
    ctx.fillStyle = 'rgba(5, 10, 5, 0.88)';
    ctx.fillRect(0, 0, S, S);

    /* ─── Tramos: rotados segun heading del jugador ─── */
    ctx.save();
    ctx.translate(cx, cy);
    // Rotacion: -yaw hace que el "adelante" (hacia -Z mundial) quede arriba.
    ctx.rotate(-this._playerYaw);

    for (const seg of this._segments) {
      // Centro del tramo en mundo (los tramos de la retICula pueden estar rotados y NO
      // centrados en x=0, por eso usamos su _center y su rotacion en vez del rect fijo).
      const c = seg._center || seg.group.position;
      const sw = seg.width;
      const sl = seg.type === 'node' ? seg.width : seg.length;

      const relX = (c.x - this._playerX) * SCALE;
      const relZ = (c.z - this._playerZ) * SCALE;

      ctx.save();
      ctx.translate(relX, relZ);
      // Rotacion Y del mundo → rotacion inversa en canvas (x→x, z→y).
      ctx.rotate(-(seg.group.rotation?.y || 0));

      const w = sw * SCALE;
      const h = sl * SCALE;
      ctx.fillStyle = this._segColor(seg.type);
      ctx.fillRect(-w / 2, -h / 2, w, h);

      // Bordes sutiles para distinguir tramos
      ctx.strokeStyle = 'rgba(80,130,80,0.35)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    ctx.restore();   // quita la rotacion

    /* ─── Rótulos del plano (Ga / Cx / RN 96) en modo retícula ─── */
    this._drawLabels(ctx, cx, cy, R, SCALE);

    /* ─── Indicador del jugador (siempre en el centro) ─── */
    // Punto blanco central
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Flecha de dirección amarilla (apunta "arriba" = hacia donde mira el jugador)
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx,     cy - 4);
    ctx.lineTo(cx,     cy - 14);
    ctx.moveTo(cx,     cy - 14);
    ctx.lineTo(cx - 4, cy - 9);
    ctx.moveTo(cx,     cy - 14);
    ctx.lineTo(cx + 4, cy - 9);
    ctx.stroke();

    ctx.restore();   // quita el clip

    /* ─── Borde del radar ─── */
    ctx.strokeStyle = '#1a3d1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Borde interior mas brillante (GTA style)
    ctx.strokeStyle = 'rgba(50,100,50,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2, 0, Math.PI * 2);
    ctx.stroke();

    /* ─── Etiqueta MAPA ─── */
    ctx.fillStyle = 'rgba(80,140,80,0.8)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAPA', cx, S - 3);

    /* ─── Botones de ZOOM (＋ / －) ─── */
    this._drawZoomButtons(ctx);
  }

  /** Dibuja los botones ＋ / － de zoom en la parte baja del radar (fuera del clip circular). */
  _drawZoomButtons(ctx) {
    const r = this._btnR;
    for (const [b, sign] of [[this._btnPlus, '+'], [this._btnMinus, '−']]) {
      // Deshabilitado visualmente si ya esta en el tope de zoom.
      const atLimit = (sign === '+' && this._scale >= this._maxScale - 1e-3)
                   || (sign === '−' && this._scale <= this._minScale + 1e-3);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,20,10,0.82)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = atLimit ? 'rgba(60,90,60,0.5)' : 'rgba(90,160,90,0.9)';
      ctx.stroke();
      ctx.fillStyle = atLimit ? 'rgba(120,150,120,0.5)' : '#d8f0d8';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign, b.x, b.y + 1);
    }
    ctx.textBaseline = 'alphabetic';   // restablece para el resto del HUD
  }

  /**
   * Dibuja los rótulos del plano (Ga 240, Cx 996, RN 96…) sobre el radar. El texto va
   * DERECHO (no rota con el mapa) para que sea legible. Se deduplica por etiqueta quedandose
   * con la instancia mas cercana (una galeria tiene varias aristas con el mismo nombre) y se
   * limita a las mas proximas para no saturar el radar pequeño.
   */
  _drawLabels(ctx, cx, cy, R, SCALE) {
    const a = -this._playerYaw;
    const ca = Math.cos(a), sa = Math.sin(a);
    const best = new Map(); // label -> {label, sx, sy, d2, type}

    for (const seg of this._segments) {
      if (!seg.label) continue;
      const c = seg._center || seg.group.position;
      const rx = (c.x - this._playerX) * SCALE;
      const rz = (c.z - this._playerZ) * SCALE;
      const sx = cx + (rx * ca - rz * sa);
      const sy = cy + (rx * sa + rz * ca);
      const d2 = (sx - cx) ** 2 + (sy - cy) ** 2;
      if (d2 > (R - 6) ** 2) continue;                 // fuera del disco visible
      const prev = best.get(seg.label);
      if (!prev || d2 < prev.d2) best.set(seg.label, { label: seg.label, sx, sy, d2, type: seg.type });
    }

    const items = [...best.values()].sort((p, q) => p.d2 - q.d2).slice(0, 7);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 8px monospace';
    ctx.lineWidth = 2.5;
    for (const it of items) {
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.fillStyle = it.type === 'mainRoad' ? '#ffcf5a'
        : (it.type === 'gallery' ? '#bfe6bf' : '#9fc7d6');
      ctx.strokeText(it.label, it.sx, it.sy);
      ctx.fillText(it.label, it.sx, it.sy);
    }
  }

  /** Color de relleno segun el tipo de tramo — diferencia los tipos al leer el radar. */
  _segColor(type) {
    switch (type) {
      case 'mainGallery':  return '#233023';
      case 'intersection': return '#2a4a2a';
      case 'crossroad':    return '#344a34';
      case 'chamber':      return '#3a2a18';
      case 'refuge':       return '#1a2a3a';
      case 'ramp':         return '#1e2a1e';
      // --- Modo retICula (réplica del plano) ---
      case 'gallery':      return '#243a24'; // galeria (Ga)
      case 'crucero':      return '#203020'; // crucero (Cx)
      case 'mainRoad':     return '#4a3d1c'; // via principal RN 96 (ambar tenue)
      case 'ramp':         return '#3a3420'; // rampa / decline
      case 'access':       return '#22331f'; // acceso a una labor
      case 'node':         return '#2e4a2e'; // interseccion de 4 vias
      case 'room':         return '#3a2e46'; // sala de labor especial (violeta tenue)
      default:             return '#1a2a1a';
    }
  }
}
