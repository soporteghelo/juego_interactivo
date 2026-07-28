from __future__ import annotations

import csv
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "ejercPT.csv"
OUTPUT_PATH = ROOT / "grafica_puntos.png"

WIDTH, HEIGHT = 1800, 920
BG = "#F5F7FA"
INK = "#172033"
MUTED = "#667085"
GRID = "#D9E1EA"
PANEL = "#FFFFFF"
ACCENT = "#2563EB"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts\seguisb.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"),
        Path(r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


TITLE_FONT = font(34, True)
SUBTITLE_FONT = font(18)
PANEL_TITLE_FONT = font(24, True)
LABEL_FONT = font(17)
SMALL_FONT = font(14)


def load_points() -> tuple[list[tuple[float, float, float]], int]:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    all_points = [(float(r["XPT"]), float(r["YPT"]), float(r["ZPT"])) for r in rows]
    # Exact duplicates would be drawn in the same pixel, so retain one copy for clarity.
    unique_points = list(dict.fromkeys(all_points))
    return unique_points, len(all_points)


def interpolate_color(value: float, minimum: float, maximum: float) -> str:
    stops = [
        (0.00, (37, 99, 235)),
        (0.25, (6, 182, 212)),
        (0.50, (34, 197, 94)),
        (0.75, (250, 204, 21)),
        (1.00, (239, 68, 68)),
    ]
    t = 0.5 if maximum == minimum else (value - minimum) / (maximum - minimum)
    t = max(0.0, min(1.0, t))
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            local = (t - a) / (b - a)
            rgb = tuple(round(x + (y - x) * local) for x, y in zip(ca, cb))
            return "#%02X%02X%02X" % rgb
    return "#EF4444"


def nice_ticks(minimum: float, maximum: float, count: int = 5) -> list[float]:
    span = maximum - minimum
    if span <= 0:
        return [minimum]
    raw = span / count
    magnitude = 10 ** math.floor(math.log10(raw))
    residual = raw / magnitude
    step = (1 if residual < 1.5 else 2 if residual < 3 else 5 if residual < 7 else 10) * magnitude
    start = math.ceil(minimum / step) * step
    ticks = []
    current = start
    while current <= maximum + step * 1e-9:
        ticks.append(current)
        current += step
    return ticks


def draw_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], title: str) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=20, fill=PANEL, outline="#E4E7EC", width=2)
    draw.text((x0 + 28, y0 + 22), title, fill=INK, font=PANEL_TITLE_FONT)
    draw.line((x0 + 28, y0 + 62, x1 - 28, y0 + 62), fill="#EEF1F5", width=2)


def draw_top_view(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    points: list[tuple[float, float, float]],
    zmin: float,
    zmax: float,
) -> None:
    x0, y0, x1, y1 = box
    plot = (x0 + 92, y0 + 92, x1 - 48, y1 - 82)
    px0, py0, px1, py1 = plot
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    xpad, ypad = (xmax - xmin) * 0.03, (ymax - ymin) * 0.03
    xmin, xmax = xmin - xpad, xmax + xpad
    ymin, ymax = ymin - ypad, ymax + ypad

    def sx(v: float) -> float:
        return px0 + (v - xmin) / (xmax - xmin) * (px1 - px0)

    def sy(v: float) -> float:
        return py1 - (v - ymin) / (ymax - ymin) * (py1 - py0)

    for tick in nice_ticks(xmin, xmax):
        x = sx(tick)
        draw.line((x, py0, x, py1), fill=GRID, width=1)
        label = f"{tick:,.0f}"
        w = draw.textbbox((0, 0), label, font=SMALL_FONT)[2]
        draw.text((x - w / 2, py1 + 12), label, fill=MUTED, font=SMALL_FONT)
    for tick in nice_ticks(ymin, ymax):
        y = sy(tick)
        draw.line((px0, y, px1, y), fill=GRID, width=1)
        label = f"{tick:,.0f}"
        w = draw.textbbox((0, 0), label, font=SMALL_FONT)[2]
        draw.text((px0 - w - 12, y - 8), label, fill=MUTED, font=SMALL_FONT)

    draw.line((px0, py1, px1, py1), fill=INK, width=2)
    draw.line((px0, py0, px0, py1), fill=INK, width=2)
    for x, y, z in sorted(points, key=lambda p: p[2]):
        cx, cy = sx(x), sy(y)
        color = interpolate_color(z, zmin, zmax)
        draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=color, outline="#FFFFFF", width=1)

    x_label = "XPT"
    w = draw.textbbox((0, 0), x_label, font=LABEL_FONT)[2]
    draw.text(((px0 + px1 - w) / 2, py1 + 42), x_label, fill=INK, font=LABEL_FONT)
    draw.text((px0, py0 - 30), "YPT", fill=INK, font=LABEL_FONT)


def draw_3d_view(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    points: list[tuple[float, float, float]],
    zmin: float,
    zmax: float,
) -> None:
    x0, y0, x1, y1 = box
    area = (x0 + 60, y0 + 84, x1 - 60, y1 - 150)
    ax0, ay0, ax1, ay1 = area
    xs, ys, zs = zip(*points)
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    xmid, ymid = (xmin + xmax) / 2, (ymin + ymax) / 2
    xspan, yspan, zspan = xmax - xmin, ymax - ymin, zmax - zmin

    projected = []
    for x, y, z in points:
        xn = (x - xmid) / (xspan or 1)
        yn = (y - ymid) / (yspan or 1)
        zn = (z - zmin) / (zspan or 1) - 0.5
        # Orthographic isometric projection, with elevation emphasized slightly.
        u = (xn - yn) * 0.82
        v = (xn + yn) * 0.34 - zn * 0.90
        projected.append((u, v, z))
    ground_projection = []
    for xn, yn in [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]:
        ground_projection.append(((xn - yn) * 0.82, (xn + yn) * 0.34 + 0.45))
    us = [p[0] for p in projected] + [p[0] for p in ground_projection]
    vs = [p[1] for p in projected] + [p[1] for p in ground_projection]
    umin, umax = min(us), max(us)
    vmin, vmax = min(vs), max(vs)
    upad, vpad = (umax - umin) * 0.03, (vmax - vmin) * 0.03
    umin, umax = umin - upad, umax + upad
    vmin, vmax = vmin - vpad, vmax + vpad

    def screen(u: float, v: float) -> tuple[float, float]:
        sx = ax0 + (u - umin) / (umax - umin or 1) * (ax1 - ax0)
        sy = ay0 + (v - vmin) / (vmax - vmin or 1) * (ay1 - ay0)
        return sx, sy

    # A subtle ground plane gives the projection spatial context.
    corners = [screen(u, v) for u, v in ground_projection]
    draw.polygon(corners, fill="#F8FAFC", outline=GRID)
    for i in range(6):
        t = i / 5
        for orientation in (0, 1):
            if orientation == 0:
                a = (-0.5 + t, -0.5)
                b = (-0.5 + t, 0.5)
            else:
                a = (-0.5, -0.5 + t)
                b = (0.5, -0.5 + t)
            segment = []
            for xn, yn in (a, b):
                segment.append(screen((xn - yn) * 0.82, (xn + yn) * 0.34 + 0.45))
            draw.line((*segment[0], *segment[1]), fill=GRID, width=1)

    for u, v, z in sorted(projected, key=lambda p: p[1]):
        cx, cy = screen(u, v)
        color = interpolate_color(z, zmin, zmax)
        draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=color, outline="#FFFFFF", width=1)

    draw.text((x0 + 40, y1 - 50), "Proyección XPT · YPT · ZPT", fill=MUTED, font=SMALL_FONT)


def draw_colorbar(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], zmin: float, zmax: float) -> None:
    x0, y0, x1, y1 = box
    steps = max(1, x1 - x0)
    for i in range(steps):
        z = zmin + (zmax - zmin) * i / max(1, steps - 1)
        draw.line((x0 + i, y0, x0 + i, y1), fill=interpolate_color(z, zmin, zmax), width=1)
    draw.rounded_rectangle(box, radius=4, outline="#D0D5DD", width=1)
    label = "Elevación ZPT"
    draw.text((x0, y0 - 28), label, fill=INK, font=SMALL_FONT)
    draw.text((x0, y1 + 8), f"{zmin:,.2f}", fill=MUTED, font=SMALL_FONT)
    high = f"{zmax:,.2f}"
    w = draw.textbbox((0, 0), high, font=SMALL_FONT)[2]
    draw.text((x1 - w, y1 + 8), high, fill=MUTED, font=SMALL_FONT)


def main() -> None:
    points, total_rows = load_points()
    zmin = min(p[2] for p in points)
    zmax = max(p[2] for p in points)

    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw.text((64, 36), "Puntos topográficos de ejercPT.csv", fill=INK, font=TITLE_FONT)
    subtitle = (
        f"{total_rows:,} registros · {len(points):,} coordenadas XYZ únicas · "
        f"ZPT {zmin:,.3f}–{zmax:,.3f}"
    )
    draw.text((64, 82), subtitle, fill=MUTED, font=SUBTITLE_FONT)

    left = (48, 130, 888, 844)
    right = (912, 130, 1752, 844)
    draw_panel(draw, left, "Vista en planta (XPT vs YPT)")
    draw_panel(draw, right, "Vista tridimensional")
    draw_top_view(draw, left, points, zmin, zmax)
    draw_3d_view(draw, right, points, zmin, zmax)
    draw_colorbar(draw, (1260, 795, 1650, 813), zmin, zmax)

    image.save(OUTPUT_PATH, format="PNG", optimize=True)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
