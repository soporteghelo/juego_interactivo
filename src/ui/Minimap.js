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
    const SCALE = 2.0;             // pixeles por metro

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
      const sx = seg.group.position.x;
      const sz = seg.group.position.z;
      const sw = seg.width;
      const sl = seg.length;

      // Conversion mundo → canvas (relativo al jugador):
      //   canvasX = (worldX - playerX) * SCALE
      //   canvasY = (worldZ - playerZ) * SCALE   ← Z más negativo = arriba en el radar
      const relZ  = sz - this._playerZ;
      const left  = (sx - sw / 2 - this._playerX) * SCALE;
      const top   = relZ * SCALE;
      const width = sw * SCALE;
      const height = sl * SCALE;

      ctx.fillStyle = this._segColor(seg.type);
      ctx.fillRect(left, top, width, height);

      // Bordes sutiles para distinguir tramos
      ctx.strokeStyle = 'rgba(80,130,80,0.35)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(left, top, width, height);
    }

    ctx.restore();   // quita la rotacion

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
      default:             return '#1a2a1a';
    }
  }
}
