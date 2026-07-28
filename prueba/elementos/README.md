# Labores mineras trackless — wireframes CSV a escala real

Catálogo de excavaciones para una mina subterránea mecanizada **trackless**, orientada
a **Sublevel Stoping / Longhole Stoping**. La fuente geométrica principal es
`.claude/commands/mina-3d-trackless.md`.

## Convención del archivo

- Escala exacta de modelado: **1 unidad = 1 metro (1:1)**.
- El documento de referencia usa `Y` vertical; estos CSV usan **`Z` vertical** para
  conservar compatibilidad con `prueba/index.html`, que interpreta `Z` como elevación.
- Una fila equivale a un triángulo.
- Coordenadas: `XP1,YP1,ZP1,XP2,YP2,ZP2,XP3,YP3,ZP3`.
- Precisión: 0.001 m.
- `LAYERS` identifica anatomía, sostenimiento, drenaje, servicios y componentes.
- `_catalogo.csv` registra dimensiones nominales, escala, unidad, referencia, límites
  y cantidad de triángulos.
- `_mina_completa.csv` ensambla 54 emplazamientos usando las 34 geometrías fuente en
  un único modelo conectado, sin reescalar ninguna labor; `_mina_completa_layout.csv`
  documenta traslación, rotación, nivel, límites y triángulos de cada emplazamiento.

## Mejoras incorporadas

- Estaciones longitudinales no uniformes, compatibles con avances sucesivos de
  voladura y sin el patrón repetitivo de un túnel generado por extrusión.
- Superficie de roca dividida en facetas irregulares, con bolsadas locales de
  sobreexcavación en hastiales, riñones y corona.
- Piso operativo con dos huellas de neumáticos, pequeñas depresiones y bombeo
  hacia la cuneta; la rasante y la pendiente nominal se conservan.
- Placas visibles de pernos de `0.15 × 0.15 m`, alternadas en corona y hastiales.
- Manga flexible con leve flecha entre colgadores y variación menor de sección;
  las tuberías rígidas mantienen su diámetro nominal.
- Chimeneas convencionales y echaderos con pared facetada y deriva local; las
  perforaciones raise-bored y el pique conservan una terminación más regular.
- Perfil herradura real: hastiales verticales, arranque de bóveda, riñones y clave.
- Sobreexcavación irregular de `±0.2–0.4 m` en labores convencionales.
- Cuneta funcional de `0.40 × 0.35 m` al costado de la rasante.
- Gradiente de drenaje de `0.3–0.5%` en labores horizontales.
- Rampa helicoidal de `13%`, radio de curva `22 m` y sección `5 × 5 m`.
- Manga de ventilación `Ø 0.90 m`, tubería de agua `Ø 0.10 m`, aire
  `Ø 0.15 m` y cables, todos modelados como geometría real.
- Capas de shotcrete, malla y pernos en corona/riñones.
- Frente con malla de perforación: arrastres, cuadradores, alzas, ayudas,
  taladros de alivio y pila de marina.
- Bypass doble con tres ventanas de conexión.
- Intersección central ensanchada 20%.
- Tajeo longhole prismático con slot, tres drawpoints, muck piles y subniveles
  de perforación cada 15 m.

## Catálogo de 34 geometrías

### Acceso y desarrollo

| Archivo | Escala nominal |
|---|---|
| `bocamina.csv` | 90 m; 5.0 × 5.0 m; −13% |
| `socavon.csv` | 120 m; 5.0 × 4.5 m; −0.4% |
| `rampa.csv` | 240 m; 5.0 × 5.0 m; −13%; R=22 m |
| `galeria.csv` | 220 m; 4.5 × 4.5 m; −0.4% |
| `galeria_wireframe_simulada.csv` | 120 m; 4.5 × 4.5 m; alta densidad |
| `nivel_principal.csv` | 260 m; 6.5 × 5.5 m; −0.4% |
| `crucero.csv` | 70 m; 4.5 × 4.5 m |
| `cortada.csv` | 85 m; 4.5 × 4.5 m |
| `by_pass.csv` | dos labores de 120 m; 5.0 × 4.5 m; separación 15 m |
| `ventana.csv` | 16 m; 4.0 × 4.0 m |
| `subnivel.csv` | 80 m; 4.0 × 4.0 m |
| `frente_desarrollo.csv` | 36 m; 4.5 × 4.5 m; frente perforado |
| `interseccion_4_vias.csv` | 4.5 × 4.5 m; centro 5.4 × 5.4 m |
| `estacion_nivel.csv` | 32 m; hasta 7.0 × 5.5 m |

### Labores pequeñas

| Archivo | Escala nominal |
|---|---|
| `estocada_carguio.csv` | 12 m; 4.0 × 4.0 m |
| `nicho_refugio_peatonal.csv` | 1.8 m de profundidad; 2.0 × 2.0 m |

### Infraestructura vertical y manejo de mineral

| Archivo | Escala nominal |
|---|---|
| `chimenea.csv` | 60 m; Ø 3.0 m; convencional irregular |
| `chimenea_ventilacion.csv` | 80 m; Ø 3.5 m; raise-bored |
| `pique.csv` | 120 m; Ø 5.5 m |
| `echadero_mineral.csv` | 60 m; Ø 3.0 m |
| `slot_raise.csv` | 30 m; Ø 2.0 m |
| `camino_escape.csv` | 45 m; sección 3.0 × 3.0 m |
| `tolva_drawpoint.csv` | acceso 4.5 × 4.5 m; campana Ø 3.0–4.5 m |

### Producción

| Archivo | Escala nominal |
|---|---|
| `tajo_subniveles.csv` | 36 × 14 × 30 m; slot + 3 drawpoints + 3 subniveles |
| `tajo_corte_relleno.csv` | 30 × 8 × 20 m |

### Cámaras

| Archivo | Escala nominal |
|---|---|
| `camara_carguio.csv` | 26 m; hasta 7.0 × 5.5 m |
| `taller_subterraneo.csv` | 38 m; hasta 11.0 × 7.5 m |
| `estacion_bombeo.csv` | 24 m; hasta 8.0 × 6.5 m |
| `poza_sedimentacion.csv` | 18 m; hasta 6.0 × 4.5 m |
| `grifo_subterraneo.csv` | 28 m; hasta 9.0 × 6.5 m |
| `polvorin.csv` | 30 m; hasta 7.0 × 5.5 m |
| `subestacion_electrica.csv` | 24 m; hasta 8.0 × 6.0 m |
| `refugio_mineros.csv` | 20 m; hasta 8.0 × 6.0 m |
| `sala_chancado.csv` | 34 m; hasta 12.0 × 8.0 m |

## Regeneración y control

```powershell
node prueba/generar_elementos_mina.mjs
node prueba/generar_mina_completa.mjs
node prueba/validar_elementos_mina.mjs
```

El generador es determinista. La validación comprueba encabezados, números finitos,
áreas triangulares, capas, volumen tridimensional y coherencia de `LABOR`.

Estas geometrías son prototipos de simulación a escala operacional. Para construcción
real, las dimensiones finales y el sostenimiento deben aprobarse con la caracterización
geomecánica, equipos y servicios específicos de la unidad minera.
