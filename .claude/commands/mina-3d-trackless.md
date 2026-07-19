---
name: mina-3d-trackless
description: Referencia visual y geométrica ÚNICA Y COMPLETA para recrear en 3D (Three.js, Babylon, Blender) una mina subterránea MECANIZADA TRACKLESS (sobre neumáticos, sin rieles, tipo Cerro Lindo) explotada por SUBLEVEL STOPING y LONGHOLE STOPING. Fusiona en un solo documento: convenciones 3D, topología general, el MÉTODO de explotación (bloque de tajeo, slot, abanicos de taladros, drawpoints, secuencia de retirada, relleno, pilares, estados), el CATÁLOGO de labores (rampa, galería, crucero, bypass, subnivel, chimenea, echadero, tajeo, estocada, nicho, cámaras) con sus secciones y medidas reales, la ANATOMÍA fina de cada labor (partes de sección herradura, frente/tope con malla de perforación, crucero, intersecciones, labores pequeñas, gradientes y drenaje), el SOSTENIMIENTO (shotcrete, pernos, malla, cimbras), los SERVICIOS en labor, el catálogo de EQUIPOS trackless (scoop/LHD, jumbo, simba, dumper, empernador, scaler, shotcretera, mixer, cargador ANFO, utilitario, cisterna, ventilador) con bounding boxes, colores y poses, la PALETA de materiales y la RECETA de escena. Vocabulario minero peruano, medidas reales compatibles con D.S. 024-2016-EM. Usar SIEMPRE que se pida modelar, dibujar, renderizar o simular en 3D una mina subterránea, socavón, labor, rampa, tajeo, interior de mina o escenas con equipo minero pesado bajo tierra — aunque no se mencione "trackless".
---

# Mina 3D — Mecanizada Trackless (referencia unificada)

Referencia única para construir en 3D una mina subterránea **mecanizada trackless** (equipo
sobre neumáticos, diésel/eléctrico, sin rieles). Método de explotación: **Sublevel Stoping +
Longhole Stoping** (taladros largos, tajeos abiertos con relleno) — el de Cerro Lindo. Este
método define **toda la disposición de la zona de producción** (§3). Todas las medidas son
reales de operación peruana y compatibles con el **D.S. 024-2016-EM** (secciones mínimas para
tránsito de equipo pesado). Vocabulario minero peruano: **labor** = cualquier excavación.

> **Regla mental #1 antes de modelar:** una mina NO es un pasillo iluminado. Es **oscura**,
> húmeda, irregular y llena de fierro. La luz sale de los faros de los equipos y de luminarias
> puntuales en estaciones. Si renderizas todo iluminado y con paredes lisas grises, se ve a
> laboratorio, no a mina. **Ambiente casi negro + niebla/polvo + superficies rugosas mojadas =
> realismo.**

**Tabla de contenido**
1. Convenciones para 3D
2. Topología general (cómo se conecta todo)
3. Método de explotación — Sublevel Stoping + Longhole Stoping (el tajeo)
4. Perfil y partes de la SECCIÓN transversal (la forma del túnel)
5. Catálogo de labores (qué es, medidas, cómo se ve, cómo modelar)
6. Anatomía fina: frente/tope, crucero, intersecciones, labores pequeñas, gradiente y drenaje
7. Sostenimiento (lo que ves en paredes y techo)
8. Servicios en labor (el "cableado" del túnel)
9. Equipos trackless (catálogo con bounding box, color y pose)
10. Paleta de materiales / colores
11. Receta de construcción de escena 3D
12. Checklist 3D final (por parte)

---

## 1. Convenciones para 3D

- **Unidades:** 1 unidad = 1 metro. Modela a escala real; una labor trackless es GRANDE (5 m de
  ancho, un scoop de 10 m de largo).
- **Ejes:** Y = arriba (gravedad −Y). El eje de cada labor corre en el plano XZ. La rampa baja en −Y.
- **Origen:** portal/bocamina en (0,0,0), o la estación del nivel principal.
- **Pisos (niveles):** nombrados por cota, p.ej. Nv 1820, Nv 1800, Nv 1780 → separación vertical
  típica **15–30 m** entre niveles principales; **subniveles** cada 6–15 m.
- **Las labores son túneles = sólidos vacíos.** Modelas el VACÍO (el hueco por donde se transita),
  no un tubo. Técnica recomendada: define un **perfil de sección transversal 2D** (§4) y
  **extrúyelo a lo largo de un spline/centerline** (ExtrudeGeometry siguiendo una curva, o sweep).
  El "terreno" es un bloque grande al que le restas (CSG/booleano) el barrido de las labores si
  quieres roca alrededor; para vistas interiores basta con renderizar las caras internas (BackSide).
- **Irregularidad:** ninguna pared es plana. Aplica ruido (noise) a los vértices del perfil y
  ligera variación por tramo. Sobre-excavación real ±0.2–0.4 m.

---

## 2. Topología general (cómo se conecta todo)

Jerarquía de acceso, de superficie hacia el mineral:

```
 SUPERFICIE
   │  Bocamina / Portal
   ▼
 ╔═══════════ RAMPA PRINCIPAL (decline en espiral/rampa switchback) ═══════════╗
 ║  baja al 12–15% conectando todos los niveles                                ║
 ╚════╤═════════════════╤═════════════════╤═══════════════════╤═══════════════╝
      │                 │                 │                   │
   [Nv 1820]        [Nv 1800]        [Nv 1780]           [Nv 1760] ...
      │                 │                 │
   ESTACIÓN          ESTACIÓN          ESTACIÓN   ← rampa se ensancha en cada acceso a nivel
      │                 │                 │
   GALERÍA ──── corre paralela al cuerpo mineralizado (sobre rumbo)
      │  ├─ CRUCERO ──► atraviesa hacia el cuerpo (a través del rumbo) ──► TAJEO
      │  ├─ CRUCERO ──► TAJEO
      │  └─ BYPASS (galería paralela para ventilación/tránsito)
      │
   CHIMENEAS (verticales/inclinadas):
      ├─ RB de ventilación (intake / return)
      ├─ ECHADERO / ore pass (mineral cae por gravedad a nivel de carguío)
      └─ CAMINO / escape (con escaleras)

   CÁMARAS especiales colgadas de galerías o rampa:
      Taller mecánico · Grifo/despacho combustible · Polvorín · Sala de bombas ·
      Subestación eléctrica · REFUGIO minero · Sala de chancado (si aplica)
```

**Flujo de mineral (resumen):** tajeo → se vuela → LHD extrae del embudo → echadero →
dumper/chancado → superficie. (Secuencia detallada del método en §3.)

**Circuito de ventilación (define dónde va aire limpio vs viciado):**
- **Intake (aire fresco):** entra por la rampa/bocamina o por una chimenea de inyección. Se lleva
  a los frentes por **mangas de ventilación** (ductos flexibles amarillos/naranjas colgados del techo).
- **Return (aire viciado):** sale por chimeneas de extracción (RB) empujado por **ventiladores
  axiales**. En las bocas de circuito hay **tapones/compuertas de ventilación** (bulkheads) que
  fuerzan el aire por el camino correcto.

**Disposición de la zona de producción (Sublevel / Longhole Stoping):** el cuerpo se divide
verticalmente en **bloques de tajeo** entre niveles principales. Dentro de cada bloque:

```
      NIVEL SUPERIOR ── galería de perforación (cabeza)
   ┌──────────────────────────────────────────────┐
   │  SUBNIVEL de perforación  ●●●●●● (abanicos)    │  ← Simba perfora taladros largos
   │              (cada 15–30 m vertical)           │     hacia arriba/abajo
   │  SUBNIVEL de perforación  ●●●●●●                │
   │                                                │   ┌─ SLOT / cara libre (chimenea
   │        T A J E O   A B I E R T O               │   │  al extremo: 1ª voladura)
   │        (se vuela por anillos, en                │   │
   │         retirada hacia el SLOT)                 │◄──┘
   │                                                │
   └───────┬───────────┬───────────┬────────────────┘
   NIVEL DE EXTRACCIÓN │  DRAWPOINTS │  ← brechas/embudos; el LHD saca el muck
        (undercut)  ▼  ▼           ▼
                   echadero / ore pass
```

Detalle completo del método (dimensiones, abanicos vs paralelos, secuencia, transversal vs
longitudinal, primario/secundario, relleno, pilares y cómo modelar el tajeo) → **§3**.

---

## 3. Método de explotación — Sublevel Stoping + Longhole Stoping (el tajeo)

Aplica a cuerpos **regulares, potentes y con buzamiento fuerte (≥ 50°)** en **roca competente**
(mineral y encajonante), tipo VMS de Cerro Lindo. Sinónimos/variantes: sublevel open stoping,
longhole stoping, sublevel longhole, bench-and-fill.

Idea central: se **perfora con taladros largos** desde subniveles, se abre una **cara libre
(slot)** en un extremo, y se **vuela por anillos en retirada** hacia el slot. El mineral cae por
gravedad a un **nivel de extracción** donde el **LHD** lo saca por **drawpoints**. Vaciado el
tajeo, se **rellena**.

### 3.1 Anatomía del bloque de tajeo
Un **bloque de tajeo** ocupa el espacio entre dos niveles principales. Sus labores de acceso (todas
herradura trackless, ver §4–§5):
- **Galería/nivel superior (cabeza):** desde arriba se puede perforar hacia abajo y luego rellenar.
- **Subniveles de perforación (drilling drifts):** galerías horizontales apiladas cada 15–30 m de
  altura. Desde AQUÍ el **Simba** perfora los taladros largos. Cortan las paredes del futuro tajeo.
- **Slot raise (chimenea de corte):** chimenea vertical en un extremo que se abre primero como cara libre.
- **Nivel de extracción / undercut (base):** galería inferior desde la que salen los
  **drawpoints/embudos** por donde el LHD extrae. Debajo va el crucero de acarreo hacia el echadero.
- **Accesos:** cruceros desde la rampa/galería principal a cada subnivel y al nivel de extracción.

Corte vertical esquemático (buzamiento fuerte):

```
   ┌── GALERÍA SUPERIOR ────────────────────────┐
   │  · · · · · · · · · · · · · · · · · · · · ·   │
   ├── SUBNIVEL 3 (perforación) ●───abanico──►   │ ┐
   │        \  |  /   \  |  /                      │ │ taladros
   ├── SUBNIVEL 2 ●───►                            │ │ largos
   │        \  |  /                                │ │ (15–30 m)
   ├── SUBNIVEL 1 ●───►                            │ ┘
   │                                               │
   │      T A J E O   (se vacía por anillos)       │  ◄── SLOT en el extremo
   │                                               │
   ├── NIVEL DE EXTRACCIÓN ─┬────┬────┬────────────┤
   │      drawpoints  ▼      ▼    ▼    ▼            │
   └────────────────────────────────────────────────┘
              │ muck cae y el LHD lo saca │
              ▼
         crucero de acarreo → ECHADERO
```

### 3.2 Dimensiones (números para modelar)

| Parámetro | Rango típico | Nota |
|---|---|---|
| Intervalo entre niveles principales | 30–60 m | altura total del bloque |
| Intervalo de subnivel (perforación) | 15–30 m | separación vertical de drilling drifts |
| Ancho del tajeo | 5–20 m | = potencia del cuerpo |
| Largo del tajeo (sobre rumbo) | 15–40 m | por panel/tajeo |
| Alto del tajeo | 15–40 m | = intervalo de nivel/subnivel |
| Buzamiento | 50–90° | fuerte, para que el mineral fluya por gravedad |
| Ø taladro de producción | 51–89 mm (2"–3.5") | longhole; DTH 115–165 mm en tajeos grandes |
| Longitud de taladro | 15–30 m (hasta 40 m en abanico) | |
| Burden × espaciamiento | 1.5–3.0 × 1.8–3.5 m | separación entre taladros/anillos |
| Slot (chimenea de corte) | Ø 1.5–2.5 m o 2×2 m | cara libre inicial |
| Drawpoint (embudo) | boca ~4–5 m ancho | brecha en la base |

### 3.3 Perforación de taladros largos (define el look de las paredes)
Dos patrones; dejan "grabadas" líneas de collares en las paredes del tajeo:
- **Abanico / anillo (ring / fan drilling):** desde el subnivel, el Simba perfora en **abanico
  radial** (arriba, a los lados, abajo) cubriendo toda la sección transversal del tajeo desde una
  sola posición. Los anillos se repiten a lo largo del subnivel cada 1.5–3 m (el **burden**). Lo
  más común en cuerpos anchos. Visualmente: filas de taladros que **irradian** desde la línea del subnivel.
- **Paralelos (parallel / long blasthole):** taladros verticales/subverticales paralelos, perforados
  hacia abajo desde un subnivel superior y/o hacia arriba desde uno inferior. Se usa en bench stoping
  (bancos) y cuerpos regulares. Visualmente: filas de taladros **paralelos** verticales.

Para 3D no modelas cada taladro como hueco, pero SÍ conviene: (a) filas de **collares** (pequeños
círculos/puntos oscuros) en las paredes del subnivel y en la corona, y (b) paredes del tajeo con
**estriado vertical** (marcas de media caña / half-barrel de los taladros) — textura acanalada, no lisa.

### 3.4 Slot / cara libre
- Se abre PRIMERO, en un **extremo** del tajeo, ensanchando una chimenea de corte (slot raise) a
  todo lo alto → crea el **primer vacío** contra el que se vuela el primer anillo.
- En 3D: una **ranura vertical** (slot) de todo el alto del tajeo en un extremo. Punto de inicio de la secuencia.

### 3.5 Nivel de extracción y drawpoints
- Galería inferior con **drawpoints (brechas/embudos/cruceros de extracción)** que se abren hacia la
  base del tajeo. Por su boca (**brow** = labio/coronación del embudo) el LHD mete el balde a la pila.
- Bajo buzamiento fuerte, el mineral **fluye por gravedad** hacia los drawpoints.
- En 3D: en la base del prisma del tajeo, abre 2–5 **bocas de embudo** (aberturas inclinadas ~45–55°)
  que conectan a la galería de extracción; pon el **muck pile** (pila de rocas) asomando por el brow y
  el LHD cargando ahí.

### 3.6 Secuencia de voladura (retirada / retreat)
- Se vuela **anillo por anillo, retirándose DESDE el slot hacia el extremo opuesto**. Cada disparo
  bota su burden contra el vacío ya creado.
- El tajeo crece progresivamente en la dirección de retirada. El muck se extrae en paralelo por los drawpoints.
- Para animar/representar avance: el vacío "come" el mineral avanzando lejos del slot; el frente de
  roca sin volar retrocede.

### 3.7 Transversal vs longitudinal (orienta los tajeos respecto al cuerpo)
- **Longitudinal:** tajeos **a lo largo del rumbo**, dentro del cuerpo. Para cuerpos **angostos**
  (potencia < ~12 m). Una sola línea de tajeos.
- **Transversal:** tajeos **perpendiculares al rumbo** (atraviesan el ancho). Para cuerpos **anchos**
  (potencia > ~12–15 m). Se ordenan en **paneles primarios y secundarios** alternados a lo largo del
  rumbo; exige relleno cementado para minar los secundarios contra el relleno.

En 3D esto define si alineas los prismas de tajeo **paralelos** al eje del cuerpo (longitudinal) o
**perpendiculares** en fila alterna (transversal).

### 3.8 Primario / secundario y relleno
- En transversal: se minan primero los **primarios** (dejando "pilares" temporales de mineral entre
  ellos), se **rellenan con pasta cementada** (fraguan como muro), y luego se minan los **secundarios**
  contra ese relleno. Recupera casi todo el cuerpo.
- **Tipos de relleno (superficie visible en 3D):**
  - **Pasta cementada (paste fill):** relaves + cemento + agua, bombeado por tubería HDPE gruesa.
    Superficie **gris cemento** lisa/plástica. (El de Cerro Lindo.)
  - **Relleno detrítico (rock fill):** desmonte volcado por LHD. Superficie **marrón-gris de rocas** sueltas.
  - **Relleno hidráulico (hydraulic fill):** arena en pulpa, drenada. Superficie **arenosa clara** con
    tubos de drenaje.
- En 3D, un tajeo "cerrado" = el prisma lleno con una **superficie superior** del color del relleno y
  tubería de relleno entrando por arriba.

### 3.9 Pilares
Si NO hay relleno total, quedan pilares (bloques de mineral sin minar que sostienen):
- **Rib pillar (pilar costilla):** vertical, entre tajeos vecinos.
- **Sill pillar (puente):** horizontal, entre bloques/niveles.
- **Crown pillar (pilar corona):** bajo la superficie o labor superior.
En 3D: bloques macizos de roca **entre** los vacíos de tajeo. Con relleno cementado
(primario/secundario) los pilares se eliminan.

### 3.10 Cómo modelar un tajeo en 3D (paso a paso)
1. **Prisma del tajeo:** caja de ancho×largo×alto (§3.2). Paredes **casi planas** con ruido suave +
   **estriado vertical** (half-barrel). NO caverna redondeada.
2. **Subniveles:** galerías herradura horizontales (4×4 m) que cortan las paredes laterales del prisma,
   apiladas cada 15–30 m. Deja el Simba en uno, feed apuntando en abanico.
3. **Collares de taladros:** filas de puntos oscuros irradiando (abanico) o paralelos, en las paredes
   del subnivel/corona.
4. **Slot:** ranura vertical en un extremo (todo el alto).
5. **Nivel de extracción + drawpoints:** galería inferior con 2–5 bocas de embudo (aberturas inclinadas)
   hacia la base; **muck pile** en cada brow; **LHD** cargando.
6. **Echadero:** el crucero de extracción termina en la chimenea de echadero (ore pass).
7. **Estado:** elige abierto (vacío + muck en base), en voladura (frente retrocediendo desde slot) o
   relleno (prisma lleno + superficie de pasta/detrítico + tubería de relleno arriba).
8. **Orientación:** longitudinal (prismas paralelos al cuerpo) o transversal (perpendiculares, en fila
   primario/secundario) según §3.7.

### 3.11 Estados del tajeo (para poblar una escena con variedad)
En una mina real conviven tajeos en distintas fases — modela varios para realismo:
- **Preparado:** subniveles y drawpoints listos, slot abierto, aún macizo.
- **En producción:** parcialmente vacío, muck en drawpoints, LHD extrayendo, Simba perforando el siguiente.
- **Vacío/agotado:** gran vacío abierto, paredes estriadas, listo para rellenar.
- **Relleno:** lleno de pasta/detrítico; tubería de relleno; superficie gris/marrón.
- **Pilar remanente:** bloque de mineral sin minar entre vacíos.

---

## 4. Perfil y partes de la SECCIÓN transversal (la forma del túnel)

El perfil trackless estándar es **"herradura" / arco de medio punto sobre hastiales rectos** (baúl).
NO es un círculo ni un rectángulo. Nombra bien las partes (de arriba hacia abajo): definen dónde va
cada detalle (sostenimiento, servicios, cuneta):

```
              CLAVE / llave de bóveda  ← punto más alto del arco
               ___________
          ▄▄▀▀             ▀▀▄▄
       RIÑÓN                    RIÑÓN   ← hombros curvos del arco
        /                           \
  ─ ─ ─┤  ARRANQUE DE BÓVEDA (springline) ├─ ─ ─  ← donde el arco nace del hastial
       |                             |
   CAJA/HASTIAL                 CAJA/HASTIAL       ← paredes verticales
   (caja piso)                  (caja techo)       ← en cuerpo inclinado: footwall / hangingwall
       |                             |
   TALÓN/ARRANQUE ╲             ╱ TALÓN            ← rincón pared–piso
   ┌───────────────────────────────────┐
   │ CUNETA │      PISO / RASANTE       │ SARDINEL │  ← piso = superficie de rodadura
   └───────────────────────────────────┘
   │◄─── espacio libre / GÁLIBO ───►│              ← luz mínima equipo–caja (lado personal ≥0.90 m)
```

**Glosario de partes:**
- **Clave / llave de bóveda:** punto más alto del techo (corona). Ahí suele colgar la manga de
  ventilación y la luminaria central.
- **Corona / bóveda / back / techo:** todo el arco superior. Máximo sostenimiento (shotcrete + pernos + malla).
- **Riñones:** los hombros curvos del arco. Zona de transición, se sostiene también.
- **Arranque de bóveda (springline):** línea donde el arco empieza a curvarse desde el hastial (a la
  altura del hastial ≈ ancho/2). Referencia clave para dibujar el perfil.
- **Hastiales / cajas:** las dos paredes verticales. En labor dentro de cuerpo inclinado: **caja piso**
  (footwall, lado del muro) y **caja techo** (hangingwall, lado del techo del manto). Aquí van pernos,
  malla y los **servicios** de un costado.
- **Talón / arranque / rinconada:** el rincón donde el hastial encuentra el piso. Suele acumular agua/lodo.
- **Piso / rasante:** el suelo. **Rasante** = la línea de nivel de diseño del piso (define la gradiente).
  Superficie de rodadura de relleno compactado.
- **Cuneta:** canal de drenaje a un costado del piso (0.3–0.5 m). Agua siempre presente.
- **Sardinel / uña / berma:** borde de contención (en curvas, bordes de echadero, lado de precipicio).
- **Gálibo / espacio libre / luz:** holgura entre el punto más saliente del equipo y la caja. Del
  **lado de circulación de personal** se exige un espacio libre (≈ 0.90 m, D.S. 024-2016-EM) — por eso
  el equipo NO va centrado: va corrido hacia un lado, dejando la vereda peatonal al otro.
- **Sobreexcavación / sobrerotura (overbreak):** roca volada de más allá de la línea de diseño →
  contorno irregular (±0.2–0.4 m). Es lo que hace que NADA sea plano.

**Regla de disposición (importante para 3D):** cuneta a UN costado del piso; **servicios** (mangas,
tuberías, cables) por el costado/techo OPUESTO o alto; **vereda peatonal** (gálibo) del lado del
personal. El equipo transita corrido, no centrado.

**Cómo construir el perfil 2D (para extruir):**
1. Piso: línea recta horizontal, ancho A (4.0 / 4.5 / 5.0 según labor).
2. Hastiales (cajas): dos verticales de altura ≈ A/2 desde los extremos del piso (hasta el arranque de bóveda).
3. Bóveda: arco (semicircunferencia o arco rebajado) de radio ≈ A/2 uniendo los topes de los hastiales;
   la cúspide es la clave.
4. Añade **ruido/sobreexcavación** a los puntos del arco/hastiales (±0.1–0.3 m) para que no sea perfecto.
5. Extrúyelo a lo largo del centerline (spline). Para curvas y rampa, orienta el perfil perpendicular a
   la tangente del spline.

**Secciones por labor (ancho × alto, en m):**

| Labor              | Sección típica | Perfil            |
|--------------------|----------------|-------------------|
| Rampa              | 5.0 × 5.0      | Herradura         |
| Galería            | 4.5 × 4.5      | Herradura         |
| Crucero            | 4.0 × 4.0      | Herradura         |
| Bypass             | 4.0 × 4.0      | Herradura         |
| Subnivel           | 4.0 × 4.0      | Herradura         |
| Estación (cruce)   | 6–7 × 5.5      | Herradura ancha   |
| Intersección       | +20% span      | Herradura ancha   |
| Chimenea/Ore pass  | Ø 2.5–4.0      | Círculo o 3×3     |
| Cámara/Taller      | 8–12 × 6–8     | Arco amplio       |
| Tajeo              | 5–20 × 15–30   | Caverna irregular |

> Referencia de la mina real (AESA · Cerro Lindo) para secciones de avance: By Pass **5.0×4.5**,
> Crucero/Galería **4.5×4.5 y 5.0×4.5**, Rampa (+)/(−) **5.0×4.5 y 5.0×5.0**, Refugio **2.0×2.0**,
> Cuneta **0.40×0.35**.

---

## 5. Catálogo de labores (qué es, medidas, cómo se ve, cómo modelar)

En mina peruana **labor** = cualquier excavación. Los términos se distinguen por **función y
orientación**, no por forma (casi todas comparten el perfil "herradura" de §4). Se agrupan en:
- **Desarrollo** (acceso y llegada al cuerpo): socavón/cortada, galería, crucero, rampa, chimenea, pique.
- **Preparación** (habilitar el bloque para explotar): subnivel, estocada, ventana, echadero, camino, cámaras.
- **Explotación** (extraer mineral): tajeos (§3), realce, breasting.

### Rampa (decline / ramp)
- **Qué es:** vía principal en pendiente que conecta niveles; por aquí sube/baja TODO el equipo
  trackless. En espiral (helicoidal) o en switchbacks (curvas cerradas en "S").
- **Medidas:** sección **4.5×4.5 a 5.0×5.0 m**. Pendiente (gradiente) **12–15 %** (1:8 a 1:7). Radio de
  curva ≥ 15–25 m (el equipo largo necesita giro amplio). Ancho extra en curvas.
- **Cómo se ve:** el túnel de mayor tránsito → piso más batido y con más agua/lodo, cunetas marcadas,
  señalización de pendiente y curva, mucho tráfico. En cada nivel se abre una **estación** (ensanche/nicho)
  para cruce de equipos.
- **Rampa de subnivel / basculante:** rampa corta que une subniveles dentro del bloque de tajeo.

### Galería (drift, sobre rumbo)
- **Qué es:** labor horizontal que corre **paralela** al cuerpo mineralizado (a lo largo del rumbo).
  Es la "avenida" de un nivel.
- **Medidas:** **4.0×4.0 a 4.5×4.5 m** (trackless). Longitud: cientos de metros. Galería principal más
  amplia (6–8 m) que galería de trabajo (4.5–6 m).
- **Cómo se ve:** larga, recta o suavemente curva, con servicios corriendo por un costado y el techo
  (mangas, tuberías, cables), nichos de refugio/estacionamiento cada cierto tramo.

### Socavón (adit) y Cortada
- **Socavón:** labor horizontal que **entra desde superficie** (boca a la luz del día) hacia el interior.
  En trackless suele ser la bocamina que da a la rampa/decline. Se ve el portal con luz natural en la boca.
- **Cortada:** labor horizontal en **estéril** para cruzar hacia la veta/cuerpo; a menudo sinónimo de
  crucero cuando parte de superficie o de una galería principal.

### Crucero (crosscut, a través del rumbo)
- **Qué es:** labor horizontal **perpendicular/transversal al rumbo** que atraviesa (casi siempre en
  estéril) desde la galería/rampa **hacia el cuerpo**, o conecta dos galerías. También sirve para
  ventilación, drenaje o exploración.
- **Medidas:** iguales a galería (**4×4 a 4.5×4.5 m**). Más cortos.
- **Partes:** **boca de crucero** (unión en T/Y con la galería = intersección reforzada), cuerpo recto,
  y **frente** si está en avance o **contacto con el cuerpo** si ya llegó (ahí cambia el color de roca:
  estéril gris → mineral con brillos). Se rotulan (Cr-1, Cr-2… o por progresiva) → pon letrero en la boca.
- **Cómo se ve / 3D:** ramal recto que sale en T o Y de la galería. La **boca/intersección** es punto
  crítico: mayor luz (span) → esquinas redondeadas, back más reforzado (pernos largos, malla densa, a
  veces cables o cimbras), luminaria, espejo convexo y señalización. Modela la boca ensanchada ~20 % y
  las esquinas redondeadas. Detalle completo del crucero e intersecciones → **§6**.

### Bypass / By-pass
- **Qué es:** galería paralela a otra, para separar tránsito o para ventilación (una entra aire, otra saca).
- **Medidas:** como galería (mina real: **5.0×4.5 m**).
- **Cómo se ve:** dos túneles gemelos con "ventanas" (conexiones cortas) entre ellos cada X metros.

### Ventana
- **Qué es:** conexión **corta** entre dos labores paralelas (bypass↔galería, o entre subniveles), para
  ventilación o tránsito.
- **Cómo se ve:** tramo corto que perfora de una labor a la vecina.

### Estocada (stub / cuddy)
- **Qué es:** labor **corta y ciega** que sale de una galería, crucero o rampa para una función puntual:
  **carguío/volteo** (que el LHD voltee al dumper sin bloquear la vía), **parqueo**, **almacén**, o
  **sump** (poza de sedimentación).
- **Medidas:** 4×4 m, longitud 5–15 m.
- **Cómo se ve:** rebaje lateral con piso muy batido y muck disperso (si es de carguío), o con
  equipo/material estacionado. Da mucha vida a la escena.

### Nicho / Refugio peatonal
- **Qué es:** **rebaje corto en el hastial** para refugio peatonal (el personal se protege al pasar el
  equipo), teléfono, extintores, tablero eléctrico o materiales. El **refugio peatonal** va a intervalos
  regulares (≈ cada 30 m). NO confundir con el **refugio minero** (cámara sellada de emergencia con aire).
- **Medidas:** ~1.5–2 m de profundidad, alto de persona/parihuela (refugio 2.0×2.0).
- **Cómo se ve:** hueco señalizado (verde para refugio) en la pared, a media altura del hastial.

### Estación (de nivel / carguío)
- **Qué es:** **ensanche** donde la rampa accede a un nivel; punto de cruce de equipos y maniobra.
- **Medidas:** más ancha (6–7 m).
- **Cómo se ve:** zona amplia con luminaria, señalización, a veces caseta/tablero de control; empalma
  rampa con galería del nivel.

### Subnivel (sublevel)
- **Qué es:** nivel intermedio dentro de la zona de producción; desde aquí se perfora (Simba) y se
  accede a los tajeos.
- **Medidas:** **4×4 m** aprox. Separación vertical **6–15 m** entre subniveles.
- **Cómo se ve:** galerías más cortas apiladas verticalmente a los costados del tajeo, conectadas por
  rampas cortas (rampas de subnivel) o accesos.

### Chimenea (raise) — vertical/inclinada
Misma familia, tres funciones:
- **RB ventilación (raise bore / chimenea de ventilación):** circular Ø **2.4–4.0 m** (raise-bored =
  perfecta y lisa) o rectangular si es convencional/Alimak. Puede llevar ducto y ventilador en boca.
- **Echadero / coada / Ore pass (pique de mineral):** chimenea por la que **cae el mineral** por gravedad
  a un nivel inferior. Ø **2.5–4 m** o cuadrada ~3×3 m; **vertical o inclinada 55–90°**. Interior
  pulido/desgastado por el mineral. En su base va una **tolva/chute con compuerta** para cargar al dumper.
- **Camino / escape (manway):** con **escaleras y plataformas** de descanso para tránsito de personal /
  escape; a veces combinado con el echadero (compartimentado).
- **Pique (shaft):** labor **vertical mayor** con izaje (jaula/skip). Menos común en trackless puro, pero
  puede existir para profundizar.

### Tajeo / Stope — el vacío de producción (Sublevel / Longhole)
- **Qué es:** el **tajeo abierto** que se genera al volar el bloque de mineral por taladros largos. NO es
  una caverna redondeada: es un **prisma alto de paredes casi planas** (definidas por los taladros), entre
  dos niveles.
- **Medidas típicas:** ancho = potencia del cuerpo (**5–20 m**), largo a lo largo del rumbo **15–40 m**,
  alto = intervalo de nivel/subnivel (**15–40 m**). Es un vacío GRANDE y vertical.
- **Cómo se ve:** paredes altas planas con **líneas/collares de taladros** (el patrón del abanico queda
  grabado en la roca), un **slot** (ranura vertical) en un extremo que fue la cara libre, y en la base los
  **drawpoints/embudos** con la pila de mineral volado (**muck pile**). Los subniveles cortan las paredes
  laterales como galerías horizontales apiladas. Si YA está relleno: superficie de **pasta cementada** gris
  o **relleno detrítico** marrón-gris compactado.
- **3D:** caja alta con ruido suave en las paredes (planas, no cavernosas), aberturas de drawpoint en la
  base, slot vertical en un extremo, y galerías de subnivel intersecando los costados. Ver **§3** para el detalle.

### Cámaras especiales (excavaciones grandes con función)
Modela como salas más anchas (span 6–12 m) colgadas de galería/rampa, con objetos dentro:
- **Taller mecánico:** techo alto, fosa, tecles/puente grúa, equipos estacionados, tableros.
- **Grifo / despacho de combustible:** tanque, surtidor, bermas de contención, extintores.
- **Polvorín (magazine):** puerta blindada, señal de explosivos, alejado y ventilado.
- **Sala de bombas / poza (sump):** al punto más bajo; bombas, tuberías gruesas, agua acumulada.
- **Subestación eléctrica:** transformadores, tableros, celdas, piso limpio, malla a tierra.
- **REFUGIO minero:** cámara sellada con puerta hermética, banca, provisiones, monitoreo de gases
  (CO/CO₂), autonomía de aire (relación con equipos Dräger / cal sodada). Señalética verde de refugio.

### Elementos del piso/labor (no olvidar)
- **Cuneta:** canal de drenaje a un costado del piso (agua siempre presente). ~0.3–0.5 m ancho.
- **Sardinel / berma:** borde de contención en curvas y bordes de echadero.
- **Charcos y lodo:** el piso es rodadura de relleno compactado, húmedo, con huellas de neumático.

---

## 6. Anatomía fina: frente/tope, crucero, intersecciones, labores pequeñas, gradiente y drenaje

El realismo fino: las partes de la SECCIÓN están en §4. Aquí, el resto del detalle que hace que una
escena se vea usada y no un túnel vacío.

### 6.1 Partes del FRENTE / tope (labor en avance)
El **frente** (o **tope**) es la cara de roca que se avanza. Una labor "ciega" termina en un frente:

```
   ┌─────────────────────────────┐
   │   ● ● ● ● ● ●  ← ALZAS/CORONA (taladros de techo, contorno)
   │  ●               ●          │
   │  ● CUADRADORES   CUADRADORES ● ← taladros de hastial (contorno)
   │  ●    ◎ ◎          ●        │
   │  ●   ◎ ✚ ◎  ← ARRANQUE/CORTE  │  ✚ = taladros de alivio (vacíos)
   │  ●    ◎ ◎    (rainura, burn/V cut)
   │  ●   AYUDAS (relievers)      │
   │   ● ● ● ● ● ●  ← ARRASTRES/ZAPATERAS (taladros de piso)
   └─────────────────────────────┘
        MALLA DE PERFORACIÓN (pintada en la cara)
```

- **Frente / tope / cara:** la pared de roca fresca al final de la labor. Húmeda, con marcas de la última
  voladura (half-barrel de los taladros de contorno).
- **Malla de perforación:** el patrón de taladros marcado (pintado) en la cara. Partes del patrón:
  - **Arranque / corte (cut):** taladros centrales que abren la cavidad inicial, con **taladros de alivio**
    vacíos (burn cut) o en cuña (V-cut).
  - **Ayudas / alivianadores (relievers):** rodean el arranque, van rompiendo hacia el vacío.
  - **Cuadradores:** taladros de los hastiales (definen el ancho).
  - **Alzas / corona:** taladros del techo (definen la bóveda; contorno = smooth blasting).
  - **Arrastres / zapateras (lifters):** taladros del piso (definen la rasante).
  - **Taladros de contorno / periféricos:** perímetro completo, poca carga, para dejar la pared lisa
    (voladura controlada).
- **Marina / escombro / muck:** la pila de roca fragmentada tras el disparo, en el piso frente al tope.
  Lo que el LHD limpia.
- **Avance:** cuánto profundiza la labor por voladura (típico 3–4 m por disparo).
- **Ciclo visible:** perforar (jumbo) → cargar (explosivos) → disparar → ventilar → desatar (scaler) →
  limpiar/marina (scoop) → sostener (empernador/shotcretera) → repetir. Puedes mostrar el frente en
  cualquiera de estas fases.

### 6.2 Crucero a fondo
El crucero es una de las labores más frecuentes; conviene modelarlo bien.
- **Qué es:** labor horizontal **perpendicular/transversal al rumbo** del cuerpo. Se abre casi siempre en
  **estéril** para: (a) alcanzar el cuerpo desde la galería/rampa, (b) conectar dos galerías, (c)
  ventilación o drenaje, (d) exploración.
- **Cómo se identifica visualmente:** sale **en ángulo (T o Y)** de una galería o rampa y avanza recto hacia
  un lado; suele **terminar en el contacto con el cuerpo** (donde empieza el mineral) o conectar con otra labor.
- **Partes:**
  - **Boca de crucero:** la unión con la galería/rampa = una **intersección** (§6.3). Punto más reforzado.
  - **Cuerpo del crucero:** el tramo recto, con sus partes de sección (§4).
  - **Frente:** si está en avance (§6.1); si ya llegó al cuerpo, ahí arranca la preparación del tajeo
    (estocadas, drawpoints).
  - **Numeración:** los cruceros se rotulan (Cr-1, Cr-2… o por progresiva/nivel). Pon letreros en la boca.
- **Medidas:** sección **4.0×4.0 a 4.5×4.5 m** (igual que galería). Más cortos que las galerías.
- **3D:** ramal recto perpendicular al spline de la galería; **redondea y ensancha la boca**; refuerza la
  intersección; letrero con el nombre; si llega al cuerpo, cambia el color de roca (estéril gris → mineral
  con brillos de sulfuros) en el frente.

### 6.3 Intersecciones y cruces
Donde dos labores se encuentran (boca de crucero, T, Y, cruz de cuatro vías). Son **puntos críticos** —
mayor vano (span) → más esfuerzo → más sostenimiento. Modelarlas bien sube muchísimo el realismo:
- **Mayor luz/span:** la abertura es más ancha y alta que una labor normal → **ensancha ~20%** y sube un
  poco la corona.
- **Esquinas redondeadas:** NUNCA esquinas vivas; las intersecciones se redondean (radios) para repartir esfuerzos.
- **Refuerzo visible:** shotcrete + malla más densa, **pernos más largos**, a veces **cables (cable
  bolting)** o **cimbras** en las esquinas. Se nota más fierro.
- **Servicios y señalización:** luminaria en el cruce, **espejo convexo** en cruces ciegos, letreros (PARE,
  nombre de labores), chevrones, a veces semáforo/paletas de tránsito.
- **Piso:** más batido por el giro de equipos; sardinel en el vértice interior.

### 6.4 Labores pequeñas (dan realismo)
Features cortas que cuelgan de galerías, cruceros y rampa. Poblarlas hace que la mina se vea usada:
- **Estocada de carguío / volteo:** nicho corto donde el LHD **voltea o carga** al dumper (para no maniobrar
  en la vía). Piso muy batido, muck disperso.
- **Estocada de parqueo / servicio:** para estacionar equipo o guardar materiales.
- **Estocada / poza de sedimentación (sump):** en el punto bajo, junta agua antes de bombear; bombas y tuberías.
- **Nicho / hornacina:** rebaje corto en el hastial para: **refugio peatonal**, teléfono/comunicación,
  extintores, tablero eléctrico, materiales.
- **Refugio peatonal:** nicho donde el personal **se protege al pasar el equipo**; a intervalos regulares
  (≈ cada 30 m). Señalizado. Distinto del **refugio minero** (cámara sellada de emergencia con aire).
- **Ventana:** conexión corta entre labores paralelas (bypass) — para ventilación o tránsito.
- **Estación (de nivel / de carguío):** ensanche donde la **rampa accede a un nivel**; sirve de cruce de
  equipos y punto de maniobra. Más ancha (6–7 m), con luminaria, señalización y a veces caseta de control.
- **Cámara** (§5): taller, grifo, polvorín, bombas, subestación, refugio, chancado.

### 6.5 Gradiente, rasante, curvas y drenaje
Detalles que hacen creíble el piso y el trazo:
- **Gradiente de galería de transporte:** **suave, 0.3–0.5 %**, ligeramente en bajada hacia la poza, para
  que el agua drene por la cuneta. No es perfectamente horizontal.
- **Gradiente de rampa:** **12–15 %** (1:8 a 1:7). Constante; se rotula.
- **Curvas:** **radio ≥ 15–25 m** (el equipo articulado largo necesita giro amplio). En la curva: **ensanche**,
  **berma/sardinel** en el borde exterior, señal de curva y espejo si es ciega. Leve **peralte** (superelevación).
- **Rasante y cuneta:** la cuneta corre a un costado siguiendo la rasante; el agua va a **pozas de
  sedimentación** y de ahí se bombea. En labores de acarreo, la cuneta va del lado opuesto al peatonal.
- **Drenaje visible:** charcos en talones y en el eje de rodada, hilos de agua en la cuneta, manchas de
  humedad bajando por hastiales.

---

## 7. Sostenimiento (lo que ves en paredes y techo)

El sostenimiento define la textura y los detalles metálicos de las superficies. Del más al menos común:

- **Shotcrete (concreto lanzado):** capa gris cemento **rugosa, ondulada, con rebote (rebound)**. Cubre
  back y hastiales. Le da el look gris "gotelé" a la mina moderna. Grosor 2–5 cm, superficie irregular.
- **Pernos de anclaje (rock bolts):** varillas ancladas con **placa cuadrada ~15×15 cm + tuerca** que
  sobresale de la pared, en malla regular (~1.0–1.5 m entre pernos). Tipos: split set (tubo ranurado),
  swellex, helicoidal/rebar con lechada. Modela como cilindros cortos + placa; el patrón repetido en
  techo/hastiales es muy reconocible. (Mina real: helicoidal 7' y swellex 7', fierro negro/galvanizado.)
- **Malla (mesh):** electrosoldada (**4"×4"**) o eslabonada, gris galvanizado, tensada contra la roca bajo
  las placas. Da textura de cuadrícula. A veces sobre shotcrete, a veces sola. **Placa de traslape** en los empalmes.
- **Cimbras (steel sets / arcos de acero):** perfiles de acero curvados en H/V, colocados como costillas
  cada 1–1.5 m en terreno malo o intersecciones. Muy visibles: arcos metálicos oscuros repetidos.
- **Straps / cintas y cables (cable bolting):** en tajeos y grandes vanos, cables largos anclados
  (P+I, 5 y 9 m, con/sin placa).
- **Marchavantes / spilling:** en terreno muy malo (paraguas de barras sobre el frente).

**Regla visual:** back y parte alta de hastiales casi siempre con shotcrete + pernos + malla. Piso sin
sostenimiento (es rodadura). Intersecciones = más fierro.

---

## 8. Servicios en labor (el "cableado" del túnel)

Corren por lo alto de un costado (o ambos), a lo largo de galerías, cruceros y rampa. Son clave para el
realismo — una labor sin servicios se ve vacía:

- **Manga de ventilación (ducto):** tubo flexible **amarillo o naranja**, Ø 0.6–1.2 m, colgado del techo,
  corre hacia los frentes ciegos. El detalle más icónico del interior mina.
- **Tubería de aire comprimido:** metálica/HDPE, Ø 2–6", a un costado.
- **Tubería de agua:** para perforación y regado, Ø 2–4".
- **Tubería de relleno / pasta (backfill):** HDPE gruesa negra/gris hacia los tajeos.
- **Cables eléctricos y de comunicación:** en bandejas o colgados; alimentan luminarias, bombas, equipos
  eléctricos; fibra/leaky feeder para comms.
- **Luminarias:** puntos de luz en estaciones, cruces, talleres y refugios. El resto: oscuro.
- **Señalización:** letreros reflectivos (velocidad, pendiente, PARE, nombre de labor/nivel), chevrones en
  curvas, tarjetas/candados (LOTO), estación de refugio (verde), advertencia de voladura, hitos topográficos.
- **Estación de bombeo/mangueras** en zonas bajas; **puntos de recarga** de agua para cisternas.

> **Código de color de mangueras (convención del simulador NEXA):** manguera de **AGUA = VERDE**
> (`#1a9e3f`), manguera de **AIRE = AZUL** (`#1155cc`). (Ver `/specs-mina`.)

---

## 9. Equipos trackless (catálogo con bounding box, color y pose)

La flota es lo que hace "mecanizada" a la mina. Van sobre neumáticos, **low profile** (bajos y anchos)
para caber en la herradura de 4–5 m, color dominante **amarillo/naranja de seguridad**, cabina/ROPS gris
oscuro, neumáticos negros grandes, **baliza ámbar** giratoria, faros delante y atrás, cintas reflectivas.

Para cada equipo: función, bounding box (L×A×Al en m), cómo aproximar la geometría con primitivas, color y
**pose de trabajo**. Si no tienes modelos CAD, una **caja proxy** con estas medidas + color amarillo +
baliza ya lee correctamente a la distancia de una escena de mina.

**Resumen (imprescindibles):**

| Equipo | Rol | Bounding box aprox (L×A×Al m) |
|---|---|---|
| Scoop / LHD (Scooptram) | Carga-acarreo-descarga: saca mineral del tajeo | 10.5 × 2.8 × 2.4 |
| Jumbo de desarrollo | Perfora frentes para voladura de avance | 11 × 2.5 × 3.0 |
| Simba / perforadora de producción (longhole) | Perfora taladros largos en tajeo | 11 × 2.5 × 3.2 |
| Dumper / camión bajo perfil | Acarreo de mineral por rampa/galería | 10 × 2.9 × 2.9 |
| Empernador (bolter) | Instala pernos de sostenimiento | 12 × 2.5 × 3.0 |
| Scaler (desatador mecanizado) | Desata roca suelta del techo | 11 × 2.3 × 2.8 |
| Robot lanzador de shotcrete | Proyecta concreto | 9 × 2.5 × 3.0 |
| Mixer / transmixer bajo perfil | Lleva concreto/relleno | 9 × 2.5 × 3.0 |
| Cargador de ANFO/explosivos | Carga taladros | 8 × 2.3 × 2.8 |
| Utilitario / transporte de personal | Mueve gente | 5–7 × 2.2 × 2.4 |
| Cisterna de agua | Regado antipolvo | 8 × 2.5 × 2.8 |

### 9.1 Scoop / LHD — Load-Haul-Dump (Scooptram)
- **Función:** el equipo estrella. Carga mineral del **drawpoint** del tajeo, lo acarrea y lo descarga en
  el **echadero (ore pass)** o en un dumper. Chasis **articulado** en el centro (se dobla para girar).
- **Referencias reales:** Cat R1700 / R1300G, Sandvik LH514 / LH410, Epiroc ST14. Balde 3.5–7 m³.
- **Bounding box:** grande ≈ **10.5 × 2.8 × 2.4**; chico ≈ 8.7 × 2.1 × 2.2.
- **Geometría:** cuerpo bajo y alargado (caja) + **balde/cucharón** grande al frente (cuña trapezoidal que
  baja al piso) + brazos hidráulicos (2 cilindros) + articulación central (dos mitades) + 4 neumáticos
  enormes (Ø ~1.5 m). Cabina lateral baja, tipo perfil transversal. Tubo de escape.
- **Color:** cuerpo amarillo `#F5B301`, balde acero desgastado gris, cabina gris.
- **Pose:** frente al muck pile en un drawpoint, balde bajado hundido en la pila, faros encendidos, baliza
  ámbar. O trasladándose por galería con balde a media altura.

### 9.2 Jumbo de desarrollo (drill jumbo / perforadora de avance)
- **Función:** perfora los taladros del **frente** para la voladura de avance. 1–2 brazos (booms)
  hidráulicos con perforadoras.
- **Referencias:** Sandvik DD421 / DD321, Epiroc Boomer 282 / S2.
- **Bounding box:** ≈ **11 × 2.5 × 3.0** (booms recogidos; extendidos alcanzan ~5–7 m al frente).
- **Geometría:** chasis bajo tipo camión + cabina protegida (FOPS) + **1 o 2 brazos articulados largos**
  terminados en **viga de avance (feed)** con la perforadora. Plataforma/canasta de servicio a veces. 4 ruedas.
- **Color:** amarillo, brazos rojos/grises (según marca).
- **Pose:** estacionado contra un **frente ciego**, brazos extendidos apuntando a la cara con feeds
  horizontales; marcas de taladros en la roca.

### 9.3 Simba / perforadora de producción (longhole / DTH)
- **Función:** perfora **taladros largos** (15–30 m) en **abanico/anillo** para tumbar el tajeo. Trabaja
  **desde el subnivel de perforación**, apuntando arriba, a los lados y abajo para cubrir toda la sección.
- **Referencias:** Sandvik DL421 (Simba), Epiroc SimbaM.
- **Bounding box:** ≈ **11 × 2.5 × 3.2**.
- **Geometría:** similar al jumbo pero con **torre/feed que rota y se inclina** (puede apuntar arriba/abajo
  en abanico), un solo brazo robusto. Carrusel de barras.
- **Color:** amarillo/naranja.
- **Pose:** en el subnivel de perforación, feed inclinado apuntando en abanico (al techo y a los costados)
  perforando el anillo; collares de taladros grabados en la corona/paredes.

### 9.4 Dumper / camión bajo perfil (underground truck)
- **Función:** acarrea mineral/desmonte por rampa y galerías desde echaderos/chancado hacia superficie o
  pique. **Articulado**, tolva basculante.
- **Referencias:** Cat AD30 / AD45, Sandvik TH430 / TH545, Epiroc MT42. Capacidad 30–45 t.
- **Bounding box:** 30t ≈ **10 × 2.9 × 2.9**; 45t ≈ 11 × 3.4 × 3.2.
- **Geometría:** cabina baja adelante + **tolva larga en cuña** atrás que bascula hacia atrás/lateral +
  articulación central + 4–6 ruedas grandes.
- **Color:** amarillo, tolva acero gris.
- **Pose:** bajo la **tolva/chute del echadero** cargándose, o subiendo la rampa cargado, o descargando con
  la tolva levantada.

### 9.5 Empernador (bolter)
- **Función:** instala **pernos de sostenimiento** (split set, swellex, helicoidal) en techo y hastiales,
  muchas veces también coloca malla.
- **Referencias:** Sandvik DS421 (Boltec), Epiroc Boltec.
- **Bounding box:** ≈ **12 × 2.5 × 3.0**.
- **Geometría:** chasis + **brazo con módulo de emperno** (feed corto + magazine de pernos + inyector de
  lechada) + canasta/plataforma de operación. 4 ruedas.
- **Color:** amarillo/gris.
- **Pose:** con el módulo apuntando **al techo**, junto a una zona recién sostenida con placas y malla visibles.

### 9.6 Scaler — desatador mecanizado
- **Función:** **desata la roca suelta** del techo y hastiales tras la voladura (seguridad) con un
  martillo/rastrillo en un brazo.
- **Referencias:** Normet Scamec, Getman.
- **Bounding box:** ≈ **11 × 2.3 × 2.8**.
- **Geometría:** chasis + **brazo robusto con pica/rastrillo** al extremo + cabina reforzada (FOPS pesado). 4 ruedas.
- **Color:** amarillo/naranja.
- **Pose:** brazo levantado picando el back, rocas cayendo (opcional partículas/escombros en piso).

### 9.7 Robot lanzador de shotcrete (spraying robot)
- **Función:** proyecta **concreto lanzado (shotcrete)** sobre paredes y techo con boquilla en brazo.
- **Referencias:** Normet Spraymec, Meyco.
- **Bounding box:** ≈ **9 × 2.5 × 3.0**.
- **Geometría:** chasis + **brazo articulado con boquilla** + tolva/bomba de concreto + a veces tanque de
  aditivo. 4 ruedas.
- **Color:** naranja/amarillo, salpicado de gris cemento (¡ensúcialo!).
- **Pose:** boquilla apuntando a un hastial, "nube" de shotcrete (partículas grises), superficie fresca brillante.

### 9.8 Mixer / transmixer bajo perfil
- **Función:** transporta concreto (para shotcrete) o **relleno/pasta** hacia los frentes/tajeos.
- **Referencias:** Normet Utimec / Alpha.
- **Bounding box:** ≈ **9 × 2.5 × 3.0**.
- **Geometría:** chasis + **tambor mezclador giratorio** (cilindro inclinado) atrás. 4 ruedas.
- **Color:** amarillo, tambor gris.
- **Pose:** en tránsito o descargando junto al robot de shotcrete.

### 9.9 Cargador de ANFO / explosivos
- **Función:** carga los taladros con explosivo (ANFO/emulsión) desde un tanque presurizado.
- **Referencias:** Normet Charmec.
- **Bounding box:** ≈ **8 × 2.3 × 2.8**.
- **Geometría:** chasis + **tanque/olla de emulsión** + canasta de operación + manguera de carguío. 4 ruedas.
- **Color:** naranja, señalización de explosivos (rombo naranja "1.5D").
- **Pose:** frente cargándose, manguera hacia los taladros.

### 9.10 Utilitario / transporte de personal
- **Función:** mueve gente y herramientas. Desde camionetas 4×4 adaptadas (Land Cruiser con jaula) hasta
  buses/carros de personal bajo perfil.
- **Referencias:** Getman personnel carrier, Toyota LC adaptado, Paus.
- **Bounding box:** camioneta ≈ **5.5 × 2.0 × 2.3**; carro de personal ≈ 7 × 2.2 × 2.4.
- **Geometría:** vehículo con **jaula antivuelco (ROPS)**, banca/cabina de pasajeros, baliza, banderola alta.
- **Color:** blanco/amarillo con jaula, muchas cintas reflectivas.
- **Pose:** estacionado en estación/refugio o circulando por galería.

### 9.11 Cisterna de agua (water truck)
- **Función:** riega vías para **control de polvo**.
- **Bounding box:** ≈ **8 × 2.5 × 2.8**.
- **Geometría:** chasis + **tanque cilíndrico** + barra rociadora atrás/abajo. 4 ruedas.
- **Color:** amarillo, tanque gris/azul.
- **Pose:** en galería con abanico de agua saliendo por la barra trasera.

### 9.12 Ventilador axial (fijo, no móvil)
- **Función:** empuja/extrae aire; alimenta las mangas de ventilación. En bocas de labor, chimeneas o cámaras.
- **Bounding box:** carcasa cilíndrica ≈ Ø 1.0–1.6 m × 1.5–2.5 m largo.
- **Geometría:** **cilindro (ducto) con hélice/rotor** dentro, patas/soporte, motor. Conecta a la manga.
- **Color:** amarillo/naranja o gris, aspas visibles.
- **Pose:** en la boca de un frente ciego o chimenea, con la manga saliendo hacia el interior.

### 9.13 Notas comunes de modelado de equipos
- **Escala:** son GRANDES. Un scoop de 10.5 m casi llena una galería de 4.5 m de alto — deja ~0.5–0.7 m de
  luz al techo. Esto transmite la sensación de mina.
- **Nivel de detalle (LOD):** para escena general, cajas proxy con silueta correcta + color amarillo +
  baliza bastan. Detalla solo el equipo en primer plano (brazos, balde, ruedas).
- **Faros:** cada equipo activo emite **luz** (spotlights blancos-cálidos hacia adelante/trabajo) — son la
  fuente de luz principal de la escena. Añade halo/volumen por el polvo.
- **Baliza ámbar** giratoria emisiva en todos: detalle barato y muy reconocible.
- **Suciedad:** ensucia todo con polvo/lodo (mapa de suciedad en la parte baja y ruedas). Nada está limpio
  bajo tierra, salvo subestaciones.
- **Neumáticos:** enormes, Ø 1.3–1.6 m, negro mate, banda gruesa.
- **Articulación:** scoops y dumpers se **doblan en el centro** para girar en curvas cerradas — si animas
  movimiento en curva, dobla el chasis, no gires las ruedas como auto.
- **Instanciado:** si pones flota/props repetidos (pernos, luminarias, tuberías), usa instancing para rendimiento.
- **Marcas registradas:** si distribuyes el render, evita logotipos/marcas exactas (Cat, Sandvik). Usa color
  y silueta genéricos; no repliques logos.

---

## 10. Paleta de materiales / colores

Puntos de partida (ajústalos con textura + rugosidad; casi todo es mate y húmedo):

| Superficie | Color base (hex) | Notas de material |
|---|---|---|
| Roca fresca (sulfuros/encajonante) | `#4a433c` – `#6b5f52` | Húmeda → brillo especular puntual, oscura |
| Shotcrete | `#8c887f` – `#a8a29a` | Gris cemento, muy rugoso, mate |
| Piso / rodadura (relleno) | `#544b40` | Marrón-gris, huellas, charcos oscuros |
| Relleno en pasta (paste fill) | `#9b978d` | Gris cemento, superficie lisa/plástica |
| Relleno detrítico (rock fill) | `#5f564a` | Marrón-gris, rocas sueltas |
| Muck / mineral volado | `#443b33` – `#5a4d3f` | Roca fragmentada oscura, brillos de sulfuros |
| Manga de ventilación | `#F2A900` / `#FF7A1A` | Amarillo/naranja, semimate |
| Malla / pernos (acero galv.) | `#9aa0a6` | Gris metálico claro |
| Cimbras (acero) | `#3f4448` | Gris oscuro metálico |
| Tubería aire | `#1155cc` | Azul (código NEXA) |
| Tubería agua | `#1a9e3f` | Verde (código NEXA) |
| Tubería relleno (HDPE) | `#222222` | Negro |
| Cables / bandejas | `#1c1c1c` | Negro |
| Cuerpo de equipos | `#F5B301` (Cat) / `#E08600` (Sandvik) | Amarillo/naranja seguridad |
| Cabina/ROPS equipos | `#3a3d40` | Gris oscuro |
| Neumáticos | `#111111` | Negro mate |
| Baliza/warning beacon | `#FF8C00` emisivo | Ámbar, emisivo |
| Cintas reflectivas | `#EAEAEA` emisivo suave | Blanco/amarillo reflectivo |
| Agua (charcos/poza) | `#20282b` | Oscura, reflectante |
| Señalética refugio | `#1E9E4A` | Verde |

**Iluminación:** ambiente muy bajo (casi negro, `#05070a`). Fuentes: faros de equipos (conos
blancos-cálidos), luminarias puntuales (cálidas) en estaciones, baliza ámbar. Añade **niebla exponencial**
(fog) leve para polvo/humedad y para dar profundidad. Sube el contraste; nada de iluminación plana global.

> En el simulador NEXA, la fuente de verdad de la paleta viva es `src/world/materials/MineMaterials.js`
> (`PALETTE`), derivada de `mineria-draw.md`. No inventes colores sueltos; si falta uno, se añade allí.

---

## 11. Receta de construcción de escena 3D

Orden sugerido (aplica a Three.js, Babylon o export a glTF):

1. **Centerlines:** define splines para rampa (helicoidal descendente), galerías por nivel, cruceros que
   salen de ellas, y chimeneas verticales. Marca las cotas de cada nivel.
2. **Perfil de sección** (§4) por tipo de labor; ensancha en estaciones e intersecciones.
3. **Extrusión/sweep** del perfil a lo largo de cada spline → geometría de labor (renderiza cara interna,
   BackSide). Añade ruido a vértices para irregularidad.
4. **Booleano opcional:** si quieres roca sólida alrededor + corte transversal, resta las labores a un
   bloque de terreno (CSG).
5. **Materiales/texturas** (§10): roca, shotcrete, piso; usa mapas de rugosidad y normal para textura.
6. **Sostenimiento** (§7): instancia pernos+placas en patrón (InstancedMesh, miles de ellos), malla como
   plano con textura de rejilla, cimbras como costillas en intersecciones.
7. **Servicios** (§8): tubos y mangas siguiendo el mismo spline, desplazados hacia un costado del techo;
   bandejas de cable; luminarias. Recuerda: cuneta a un lado, servicios al opuesto, equipo corrido dejando
   vereda peatonal (gálibo).
8. **Intersecciones y detalle de labor** (§6): ensancha y redondea las bocas de crucero, refuerza esquinas,
   añade letreros/espejos/luminaria; en frentes en avance pon malla de perforación + marina; siembra
   **estocadas y nichos** (parqueo, carguío, refugio peatonal, sump) cada cierto tramo.
9. **Tajeos (Sublevel/Longhole)** (§3): prisma alto de paredes casi planas con estriado vertical (NO
   caverna), subniveles de perforación cortando los costados, slot en un extremo, drawpoints y muck pile en
   la base. Las cámaras (taller, refugio, etc.) sí son salas anchas con objetos internos.
10. **Equipos** (§9): coloca 2–5 equipos en poses de trabajo (scoop cargando en drawpoint, jumbo en un
    frente, dumper en rampa). Usa cajas proxy con las medidas dadas si no tienes modelos detallados.
11. **Iluminación y niebla** (§10): oscuro + faros + fog. Esto es lo que "vende" la escena como mina.
12. **Detalles finales:** charcos (planos reflectantes en piso), señalización (planos con textura), polvo
    (partículas), muck pile (pila de rocas) en tajeos.

**Prioridad si tienes poco tiempo:** perfil herradura correcto → oscuridad + faros + fog → mangas de
ventilación + servicios → shotcrete rugoso → 1 scoop amarillo. Con eso ya "lee" como mina trackless. Si vas
a mostrar producción, agrega un tajeo (prisma alto + drawpoint + muck) según el método (§3).

---

## 12. Checklist 3D final (por parte)

Al modelar/afinar una labor, revisa que estén:

- [ ] Perfil herradura con **clave, riñones, arranque de bóveda, hastiales, talón, piso** (no rectángulo ni tubo).
- [ ] **Sobreexcavación** (ruido en el contorno) — nada plano.
- [ ] **Cuneta** a un costado + charcos + humedad.
- [ ] **Gálibo peatonal**: equipo corrido a un lado, no centrado.
- [ ] **Servicios** por el costado/techo opuesto a la cuneta (mangas, tuberías, cables).
- [ ] **Sostenimiento** en corona y riñones (shotcrete rugoso, pernos con placa, malla).
- [ ] **Intersecciones** ensanchadas, esquinas redondeadas, refuerzo extra, luminaria + espejo + letreros.
- [ ] **Frentes** con malla de perforación / half-barrel y marina si está en avance.
- [ ] **Estocadas y nichos** cada cierto tramo (parqueo, refugio peatonal, sump).
- [ ] **Letreros y señalización** en bocas de crucero e intersecciones (nombres, PARE, chevrones).
- [ ] **Gradiente** correcta (suave en galería, 12–15 % en rampa) y **cotas de nivel** rotuladas.
- [ ] **Oscuridad + faros + fog** (regla mental #1): ambiente casi negro, luz puntual, niebla de polvo/humedad.
- [ ] **Equipos** a escala real, amarillos, con baliza ámbar y suciedad; articulados se doblan al centro.
- [ ] **Tajeos** como prisma alto estriado (no caverna), con slot, drawpoints y muck pile.

---

> **Skills relacionadas del simulador NEXA:** `/iteracion_skill` (auditoría de fidelidad/realismo/forma/
> rendimiento + plan aprobable) usa ESTE documento como referencia geométrica y operacional; `/specs-mina`
> (verificación de specs vs código `src/`). Biblia visual de fotos reales: `mineria-draw.md`.
