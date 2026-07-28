# Especificaciones del Simulador — Mina Subterránea (NEXA)

Este archivo es el DOCUMENTO DE ESPECIFICACIONES del simulador de mina subterránea.
Edita las specs aquí abajo para cambiar un requisito. Luego ejecuta este mismo skill
(`/specs-mina`) y Claude comparará automáticamente cada spec con el código real.

---

## INSTRUCCIÓN AL EJECUTAR ESTE SKILL

Lee TODAS las especificaciones definidas en las secciones de abajo. Luego busca en el
código fuente (carpeta `src/`) los archivos relevantes para cada especificación y verifica
si el código cumple o NO cumple cada ítem. Al final genera un reporte con tres columnas:
✅ CUMPLE / ❌ NO CUMPLE / ⚠ REVISAR MANUALMENTE — con el archivo y la línea exacta donde
encontraste la evidencia (o la ausencia de ella). No corrijas nada; solo reporta.

REGLA DE DESARROLLO (aplica a todo elemento NUEVO o MODIFICADO): todo elemento
"completo"/complejo (compuesto de varias partes lógicas) DEBE discretizarse en
SUBELEMENTOS según la convención de la sección 13. Si al verificar encuentras un
elemento complejo sin subelementos, repórtalo como ❌ en la sección 13.

---

## 1. COLORES DE MANGUERAS

| Elemento          | Color esperado | Código hex | Archivo a verificar        |
|-------------------|----------------|------------|----------------------------|
| Manguera de AGUA  | VERDE          | `#1a9e3f`  | `src/elementos/servicios/manguera.js` y `MineMaterials.js` |
| Manguera de AIRE  | AZUL           | `#1155cc`  | `src/elementos/servicios/manguera.js` y `MineMaterials.js` |

---

## 2. ALTURAS DE MONTAJE (medido desde el suelo, y=0)

| Elemento                        | Altura centro (m) | Altura borde inferior (m) | Archivo                                   |
|---------------------------------|-------------------|---------------------------|-------------------------------------------|
| Tablero eléctrico en NICHO      | 1.0               | —                         | `src/elementos/entorno/nicho_electrico.js`        |
| Panel informativo (pared)       | 2.0               | 1.5                       | `src/procedural/PropScatter.js`           |
| PT-TAG en pecho del trabajador  | 1.30              | —                         | `src/elementos/personas/persona.js`                |

> Nota: "altura centro" es el valor Y del `position.set(x, Y, z)` del objeto en cuestión.

---

## 3. DIMENSIONES DEL NICHO ELÉCTRICO

| Parámetro             | Valor esperado  | Archivo                             |
|-----------------------|-----------------|-------------------------------------|
| Ancho nicho simple    | 1.35 m          | `src/elementos/entorno/nicho_electrico.js`  |
| Ancho nicho doble     | 1.90 m          | `src/elementos/entorno/nicho_electrico.js`  |
| Alto del nicho        | 2.20 m          | `src/elementos/entorno/nicho_electrico.js`  |
| Profundidad del nicho | 0.65 m          | `src/elementos/entorno/nicho_electrico.js`  |
| Prob. aparición/tramo | 55%             | `src/procedural/PropScatter.js`     |
| Prob. variante doble  | 30%             | `src/procedural/PropScatter.js`     |

---

## 4. MALLA SOBRESALIDA

| Parámetro             | Valor esperado  | Archivo                             |
|-----------------------|-----------------|-------------------------------------|
| Ancho del panel       | 1.0 m           | `src/procedural/PropScatter.js`     |
| Tipo de hazard        | `'corte'`       | `src/elementos/sostenimiento/malla.js`            |
| Distancia de aviso    | 1.5 m           | `src/elementos/sostenimiento/malla.js`            |
| Distancia de herida   | 0.35 m          | `src/elementos/sostenimiento/malla.js`            |
| Mata al jugador       | NO (sin `kill`) | `src/elementos/sostenimiento/malla.js`            |

---

## 5. ZONA PROHIBIDA (banderin rojo / barrera)

| Parámetro                        | Valor esperado                     | Archivo                             |
|----------------------------------|------------------------------------|-------------------------------------|
| Mata al jugador                  | NO (sin `kill`)                    | `src/procedural/PropScatter.js`     |
| Tipo de hazard                   | `'prohibida'`                      | `src/procedural/PropScatter.js`     |
| Radio de aviso                   | 12 m                               | `src/procedural/PropScatter.js`     |
| Evento emitido                   | `hazard:zona` (no `hazard:warn`)   | `src/core/HazardSystem.js`          |
| Clase CSS del banner             | `.hud-zona`                        | `src/ui/styles.css`                 |
| Color del banner                 | ámbar/naranja (NO rojo pulsante)   | `src/ui/styles.css`                 |

---

## 6. VEHÍCULOS — CAMIONETA HILUX

| Parámetro                   | Valor esperado      | Archivo                             |
|-----------------------------|---------------------|-------------------------------------|
| Semi-ancho HW               | 1.05 m              | `src/elementos/equipos/camioneta.js`        |
| Radio de llanta             | 0.55 m              | `src/elementos/equipos/camioneta.js`        |
| Ancho de llanta             | 0.38 m              | `src/elementos/equipos/camioneta.js`        |
| Segmentos de llanta         | 20                  | `src/elementos/equipos/camioneta.js`        |
| Orientación de llanta       | `rotation.z = π/2`  | `src/elementos/equipos/camioneta.js`        |
| Kill distance               | 0.5 m               | `src/world/VehicleSystem.js`        |
| Tipo de hazard              | `'atropello'`       | `src/elementos/equipos/camioneta.js`        |

---

## 7. SISTEMA DE PELIGROS / HAZARDS

| Parámetro                   | Valor esperado   | Archivo                        |
|-----------------------------|------------------|--------------------------------|
| Periodo de gracia al inicio | 5.0 s            | `src/core/HazardSystem.js`     |
| Cooldown entre cortes       | 4.0 s            | `src/core/HazardSystem.js`     |
| Tipos con kill              | `atropello`, `aspas`, `aspas_guardadas`, `equipoPesado` | varios |
| Tipos con hurt (no kill)    | `corte`          | `src/core/HazardSystem.js`     |
| Tipos sin kill ni hurt      | `prohibida`      | `src/core/HazardSystem.js`     |

---

## 8. LINTERNA DEL JUGADOR

| Parámetro          | Valor esperado                       | Archivo                       |
|--------------------|--------------------------------------|-------------------------------|
| Tecla de ciclo     | `F`                                  | `src/player/Player.js`        |
| Nivel inicial      | L3 (máximo)                          | `src/player/Headlamp.js`      |
| OFF: intensidad    | 0                                    | `src/player/Headlamp.js`      |
| L1: intensidad     | 5 / distancia 20 m                   | `src/player/Headlamp.js`      |
| L2: intensidad     | 12 / distancia 38 m                  | `src/player/Headlamp.js`      |
| L3: intensidad     | 24 / distancia 56 m                  | `src/player/Headlamp.js`      |
| Evento emitido     | `headlamp:changed`                   | `src/player/Headlamp.js`      |

---

## 9. PT-TAG (dispositivo de rastreo personal)

| Parámetro                   | Valor esperado               | Archivo                      |
|-----------------------------|------------------------------|------------------------------|
| Posición en el trabajador   | Pecho derecho (x=0.20, y=1.30, z=0.14) | `src/elementos/personas/persona.js` |
| LED batería OK              | Verde                        | `src/elementos/ssoma/pt_tag.js`    |
| LED batería baja            | Ámbar (parpadeo animado)     | `src/elementos/ssoma/pt_tag.js`    |
| LED batería crítica         | Rojo (parpadeo animado)      | `src/elementos/ssoma/pt_tag.js`    |
| % trabajadores batería baja | ~20%                         | `src/elementos/personas/persona.js`   |

---

## 10. VENTILADOR

| Parámetro                        | Valor esperado   | Archivo                         |
|----------------------------------|------------------|---------------------------------|
| Variante sin guarda: kill dist   | 1.1 m            | `src/elementos/servicios/ventilador.js`   |
| Variante con guarda: kill dist   | 0.6 m            | `src/elementos/servicios/ventilador.js`   |
| Prob. de guarda protectora       | 50%              | `src/procedural/PropScatter.js` |

---

## 11. SHOTCRETE Y ROCA EXPUESTA

| Parámetro                              | Valor esperado | Archivo                              |
|----------------------------------------|----------------|--------------------------------------|
| % tramos sin shotcrete (roca expuesta) | ~25%           | `src/procedural/SegmentAssembler.js` |
| Mínimo tramos sin shotcrete            | A partir del tramo índice 2 | `src/procedural/SegmentAssembler.js` |
| Tramo spawn: siempre con shotcrete     | SÍ             | `src/procedural/SegmentAssembler.js` |

---

## 12. SPAWN DEL JUGADOR

| Parámetro              | Valor esperado      | Archivo                              |
|------------------------|---------------------|--------------------------------------|
| Profundidad de spawn   | 55% del largo del tramo o mín 8 m | `src/procedural/SegmentAssembler.js` |
| Fase mínima vehículos  | 0.22 (22% del mapa) | `src/world/VehicleSystem.js`         |

---

## 13. DISCRETIZACIÓN DE ELEMENTOS COMPLEJOS (SUBELEMENTOS)

Todo elemento "completo" (formado por varias partes lógicas) se discretiza en
SUBELEMENTOS: cada parte se agrupa en un `THREE.Group` etiquetado, de modo que en el
visor se pueda **listar, aislar y editar cada parte de forma independiente**.

**Convención obligatoria** (helper central `src/elementos/_comun/subelemento.js`):

| Parámetro                        | Valor esperado                                        | Archivo                             |
|----------------------------------|-------------------------------------------------------|-------------------------------------|
| Helper de creación               | `sub(padre, id, nombre, descripcion)`                 | `src/elementos/_comun/subelemento.js`      |
| Etiqueta del grupo               | `userData.subelemento = { id, nombre, descripcion }`  | `src/elementos/_comun/subelemento.js`      |
| Nombre del grupo                 | `sub_<id>`                                            | `src/elementos/_comun/subelemento.js`      |
| Transformación del grupo         | Identidad (NO altera la geometría final)              | `src/elementos/_comun/subelemento.js`      |
| id repetido                      | Devuelve el grupo existente (permite reabrir sección) | `src/elementos/_comun/subelemento.js`      |
| Recolección para el visor        | `recolectarSubelementos(root)` — solo PRIMER nivel; NO entra dentro de un subelemento ya etiquetado (elementos anidados aparecen como una sola parte) | `src/elementos/_comun/subelemento.js` |
| Patrón dentro de `crear()`       | `let S = sub(g, 'id', 'Nombre'); S.add(...)` y se reasigna `S` por sección | cada elemento |

**Elementos ya discretizados** (verificar que cada uno tenga AL MENOS estos subelementos):

| Elemento             | Subelementos esperados (ids)                                                        | Archivo                              |
|----------------------|--------------------------------------------------------------------------------------|--------------------------------------|
| Refugio Dräger       | skid, casco, franjas_logos, puerta_exterior, semaforo, senaletica_frontal, extintor_frontal, precamara, iluminacion_interior, asientos, acabados_interiores, bpu, cilindros_o2, banco_baterias, instrumentacion, tuberia, letrero_tanque_co, letrero_catalizador_co, letrero_raciones_alimentos, letrero_raciones_agua, letrero_diagrama_agua, letrero_procedimiento_ingreso, plano_rescate_nivel, plano_ubicacion_refugios, letrero_procedimiento_o2 | `src/elementos/ssoma/refugio_draeger.js` |
| Refugio simple       | cuerpo, puerta, semaforo, letrero, extintor                                          | `src/elementos/ssoma/refugio.js`           |
| Nicho del refugio    | excavacion, suelo, marco_apertura, refugio_draeger (anidado), cordel_letreros, senaletica, cables, iluminacion | `src/elementos/ssoma/nicho_refugio.js` |
| Camioneta Hilux      | chasis, capot, bull_bar, cabina, franja_neon, reflectivos, tolva, luces, baliza, placa, ruedas, extintor | `src/elementos/equipos/camioneta.js` |
| Camión / volquete    | chasis, cabina (COE), escape, tolva (incl. `carga_muck` conmutable vía `userData.carga.set()`), ruedas (duales en tandem), luces, baliza, reflectivos, extintor | `src/elementos/equipos/camion.js`            |
| Operador sentado     | cuerpo (postura de conducción, casco por rol, lámpara). Va en cabinas: `userData.operador` en camión/camioneta (visible) y scoop (oculto hasta conducirlo) | `src/elementos/equipos/operador_sentado.js`  |
| Estación de emergencia | camilla (tabla espinal + correas), botiquin (cruz verde), senal. Interactuable. Distribuida por PropScatter y en sala Bombeo | `src/elementos/ssoma/estacion_emergencia.js` |
| Teléfono de emergencia | caja (estanca amarilla + LED), auricular (con cable espiral), senal. Interactuable. En galerías (PropScatter), Subestación y Refugios | `src/elementos/ssoma/telefono_emergencia.js` |
| Punto de acopio      | parihuela, cilindros (amarillo METALES / rojo PELIGROSOS / negro GENERALES, NTP 900.058), letrero. Interactuable. En Taller | `src/elementos/ssoma/punto_residuos.js`    |
| Espejo convexo       | espejo (domo pulido + marco naranja + brazo). En cruces ciegos (≥3 bocas) de NodeSegment, gated por heavyDetail | `src/elementos/ssoma/espejo_convexo.js`    |
| Chimenea de escape   | boca (RB Ø1.5 m + brocal), escalera (enjaulada), plataforma, senal. Interactuable. Una por nivel (nodos c1_r1 y lower_entry) | `src/elementos/ssoma/chimenea_escape.js`   |
| Ducha lavaojos       | ducha (columna + regadera + palanca + taza lavaojos + pedal). Interactuable. En Subestación y Shotcrete | `src/elementos/ssoma/ducha_lavaojos.js`    |
| Sensor de gases      | caja (display O2/CO/NO2/H2S), estrobo (baliza roja: tick estrobea con `event:gas`/`gas:alarm`). Interactuable. En Frente, Bombeo y Shotcrete | `src/elementos/ssoma/sensor_gases.js`      |
| Estación total (topografía) | tripode (3 patas + cabezal), instrumento (tribrach, cuerpo amarillo, anteojo, pantalla emisiva, asa). En sala Frente; el topógrafo de la cuadrilla la usa (gesto `topografiar`) | `src/elementos/entorno/estacion_total.js` |
| Frente cargado (voladura)   | barrenos (bocas + tacos, malla burn cut+auxiliares+contorno), cordon (cordón detonante + troncal + lead-out), senaletica (tarjeta VOLADURA). En sala Frente + cordón de bloqueo con hazard `prohibida` en la boca | `src/elementos/entorno/frente_cargado.js` |
| Malla naranja (delimitación) | pano (rejilla romboidal naranja fluor, **alphaTest** sin blending → no altera el bloom), postes (parantes + bases). Textura/material CACHEADOS. Delimita la boca de las labores activas (frente, sostenimiento, shotcrete, desatado, disparado) desde `RoomSegment` | `src/elementos/ssoma/malla_naranja.js` |
| **Manto de malla (sostenimiento de labor)** | Tejido ESLABONADO/romboidal CONTINUO barrido sobre toda la herradura (hastiales **y bóveda**, md:107), colgado del perfil NOMINAL a 5.5 cm — puentea la sobre-excavación en vez de calcar la roca, que es como cuelga de verdad y además evita z-fighting con la carcasa. COMBA entre anclajes en ambos ejes, JOROBAS de roca acumulada detrás, traslape de paño cada 2.5 m. Recorta las bocas de nicho vía `skipZones`. Material único `alphaTest` **sin `transparent`** (fuera de la cola de transparencias). 1 malla y 1 llamada de dibujo por tramo | `src/elementos/sostenimiento/malla.js` (`crearManto`) |
| Costura del manto | Zigzag de alambre galvanizado que cose cada traslape de paño; una geometría fusionada por tramo, material claro y metálico (alambre nuevo) contra el tejido oxidado. Gated `heavyDetail ≥ 0.75` | `src/elementos/sostenimiento/malla.js` (`crearCosturaManto`) |
| Anclaje de sostenimiento | `anclajesManto()` devuelve los nudos del manto; los CONSUMEN a la vez el manto y `PropScatter._rockBolts`, de modo que cada perno cae en un nudo real (sin pernos al aire ni malla colgando de nada). Paso 1.3 m (md:106). En `heavyDetail < 0.5` solo hastial | `src/elementos/sostenimiento/malla.js`, `src/procedural/PropScatter.js` |
| Tag de perno | Plaquita de identificación (longitud/campaña) en la cabeza del perno, en pilas de 2-3. `InstancedMesh` con `instanceColor` → todos los puntos de color de la labor en 1 llamada. Base blanca + `envMapIntensity` alto = retro-reflectivo bajo el headlamp, sin emisivo (no debe arder en el bloom) | `src/elementos/sostenimiento/perno.js` (`geometriaTag`, `COLORES_TAG`) |
| Manga de ventilación | ducto (tubo + **bridas de unión cada 5 m fusionadas en la MISMA geometría** → el billowing las arrastra y no cuestan draw call), suspension (abrazadera + tirante + grillete a la bóveda cada 3 m; sin esto la manga "flota"), ramal (manga vieja oxidada, descolgada y con el extremo RASGADO, ~1/3 de labores). Textura con el naranja HORNEADO + salpicadura blanca de shotcrete (un `color` naranja teñiría también la salpicadura) | `src/elementos/servicios/ventilacion.js`, `MineMaterials.mangaVent()` |
| Tags de cable | Grupos de 2-3 plaquitas de color abrazadas al tendido cada ~7 m (identifican tablero y equipo). Un mesh FUSIONADO por color → 3-4 draw calls por tendido y elegible para el fusor de estáticos | `src/elementos/servicios/cable_electrico.js` |
| Estarcido de labor | Código de la labor PINTADO CON PLANTILLA sobre el hastial en recuadro rojo (`CX-026`), con descascarado y escurrimientos hechos con `destination-out` (la roca asoma por los huecos en vez de quedar tapada por un parche). CALCO con `polygonOffset` en vez de separación física. Textura y material cacheados POR CÓDIGO. Más `crearBanda()`: franja pintada corrida que da la línea de fuga del hastial | `src/elementos/senal/estarcido_labor.js` |
| **Precámara del refugio (esclusa)** | Mamparo con 2ª puerta estanca, ojo de buey de 12 pernos, manija de palanca con uñas, placa PRECÁMARA, cartel y baño químico. **ALARMA ROJA**: mientras el refugio está en BATERÍAS, la luz de la esclusa vira de blanco a rojo saturado con pulso lento (~0.55 Hz, suelo al 55% → el rojo se sostiene, no estrobea). Reutiliza el `PointLight` que ya existía — **cero luces dinámicas nuevas** — y apaga el LED de servicio para que no lave el rojo. Atada al MISMO estado que el semáforo exterior: la roja de fuera y la de dentro no pueden contradecirse | `src/elementos/ssoma/refugio_draeger.js` |
| Baliza de alarma (precámara) | Domo emisivo sobre caja galvanizada + conduit FLEXIBLE negro que baja del techo. Es el emisor visible del destello rojo (alimenta el bloom); apagado queda casi negro | `src/elementos/ssoma/refugio_draeger.js` |
| Instalación eléctrica vista | Tubería RÍGIDA GALVANIZADA por pared y techo con coplas y abrazaderas + cajas de conexión + tramos de flexible negro. En atmósfera con gas no hay cable a la vista: todo va en tubo metálico. Tendido completo en UNA geometría fusionada (1 draw call) | `src/elementos/ssoma/refugio_draeger.js` |
| Luminaria de mamparo (bulkhead) | Bronce roscado + tubo de vidrio + JAULA de varillas + codo de conduit blanco, en las ESQUINAS ALTAS de la esclusa (con la puerta cerrada no le llega luz de la cámara). Antes: cilindro + esfera dorados | `src/elementos/ssoma/refugio_draeger.js` |
| **Cuarto del baño (esclusa)** | NO es un vano abierto: TABIQUE con **puerta CORREDIZA EMBUTIDA** (de bolsillo). Corrediza y no abatible porque en una esclusa de 1 m una hoja batiente chocaría con las puertas estancas. Al abrirse desaparece dentro del tabique y solo asoma su canto de arrastre con el tirador, lo que mantiene EXPUESTA la **parte fija** — que es donde va la placa Dräger. Guía superior corrida sobre todo el tabique; cuarto de 0.62 m de fondo con el baño químico e instructivo dentro, visibles por el hueco | `src/elementos/ssoma/refugio_draeger.js` |
| Rotulación de la precámara | Cartel BAÑO sobre el DINTEL del tabique, placa de fabricante `Dräger \| SIMSA — MRC 5000` atornillada a la **PARTE FIJA** del tabique del baño (junto al hueco, a la altura de la vista), FLECHAS CURVAS de circulación pintadas en la hoja y ENTRADA en la cara interior de la puerta exterior | `src/elementos/senal/…` vía `_texturaFlechaCurva`, `_texturaTextoPintado`, `_texturaPlacaMRC` |
| Piso y baño de la esclusa | Matting PERFORADO antideslizante a escala métrica (el agua del EPP escurre bajo la plancha) + baño químico envuelto en FILM de embalaje: unidad inspeccionada pero aún sin poner en servicio | `src/elementos/ssoma/refugio_draeger.js`, `pila_mineral.js` |
| Disparo sin limpiar | Muck que TAPA el tope tras la voladura: talud de hastial a hastial hasta media altura, bloques angulares, roca FRESCA (mucho más clara que la caja polvorienta). Estático y anónimo → lo absorbe el fusor. Hazard `prohibida`. Fase `disparado` del ciclo (spur `c5_r5→S`), entre frente cargado y desatado | `src/elementos/entorno/pila_mineral.js` (`crearDisparo`), `src/world/grid/RoomSegment.js` |
| Polvorín (labor)     | spur `c0_r0→W` en MinePlan; reja con candado + hazard `prohibida` (warn 7), cajones, señales `polvorin`/`peligro_no_ingresar`, teléfono | `src/world/grid/RoomSegment.js`      |
| Bermas de rampa      | media caña de material compactado a ambos hastiales + colisionador + señal `rampa` (pendiente 10%, 15 km/h) en ambas bocas | `src/world/grid/EdgeSegment.js`      |
| Rampa espiral (decline) | conecta niveles bajando en HÉLICE (roca herradura + piso + berma exterior barridos sobre la curva; ~11% de gradiente). Visual = 1 malla curva; colisión/contención/piso = cadena de SPANS rectos. Config en `RAMP_HELIX` (MinePlan) | `src/world/grid/HelicalRampSegment.js`, `src/world/segments/TunnelGeometry.js` |
| Variedad por semilla | cada carga es una mina reproducible distinta: pilares extra, jitter de sección (±20% ACOTADO a 3.6–6.4 m ancho / 3.8–5.6 m alto, < boca de cruce) por galería/crucero y qué galerías llevan LED verde. Config en `VARIETY` (MinePlan) | `src/world/grid/GridLayoutGenerator.js` |
| Pila de mineral      | monticulo (cono + falda + bolones). `userData.pila.extraer()` + `tick` regen/escala. En Cámara, la muck-ea el HaulCycle | `src/elementos/entorno/pila_mineral.js`      |
| Manto de malla (labor) | Tejido ESLABONADO continuo barrido sobre la herradura COMPLETA (hastiales + bóveda, md:107 "cubre paredes y techo"), colgado de los pernos: comba entre anclajes en ambas direcciones, jorobas de roca suelta, traslape de paños c/2.5 m y recorte en bocas de nicho. `alphaTest` sin `transparent` (fuera de la cola de transparencias). 1 malla por tramo | `src/elementos/sostenimiento/malla.js` (`crearManto`), `src/procedural/PropScatter.js` |
| Costura del manto    | Zigzag de alambre galvanizado que cose el traslape entre paños. Geometría fusionada, material claro/metálico (alambre nuevo vs. tejido oxidado). Gated `heavyDetail ≥ 0.75` | `src/elementos/sostenimiento/malla.js` (`crearCosturaManto`) |
| Perno + tag          | vastago + placa + tuerca (instanciado). **Los pernos caen en los NUDOS del manto** (`anclajesManto`), nunca sorteados aparte. `tags_perno`: plaquitas de color (azul/verde/blanco/naranja) por `instanceColor` = 1 draw call. Bóveda gated `heavyDetail ≥ 0.5` | `src/elementos/sostenimiento/perno.js`, `src/procedural/PropScatter.js` |
| Manga de ventilación | ducto (tubo + bridas de tramo c/5 m FUSIONADAS en su geometría → el billowing las arrastra), suspension (abrazadera + tirante + grillete a la bóveda c/3 m, gated `heavyDetail ≥ 0.5`), ramal (manga vieja oxidada y RASGADA, 32% con `heavyDetail ≥ 0.75`). Textura con color HORNEADO por la salpicadura blanca de shotcrete | `src/elementos/servicios/ventilacion.js`, `MineMaterials.mangaVent()` |
| Estarcido de labor   | Código pintado con plantilla sobre la roca en recuadro rojo (`CX-026`), descascarado y con escurrimientos; CALCO por `polygonOffset` (no separación física). Más `crearBanda()`: franja pintada corrida del hastial. Textura/material cacheados POR CÓDIGO | `src/elementos/senal/estarcido_labor.js`, `src/world/grid/EdgeSegment.js` |
| Disparo sin limpiar  | muck (talud en capas + bloques angulares) que TAPA el tope tras la voladura; roca fresca clara vs. caja polvorienta. Hazard `prohibida`. Fase `disparado` del ciclo: spur `c5_r5→S` | `src/elementos/entorno/pila_mineral.js` (`crearDisparo`), `src/world/grid/RoomSegment.js` |
| Echadero (labor)     | spur `c2_r3→S`; pique oscuro + parrilla grizzly + tope de descarga (collider) + señal + hazard `prohibida`. Punto de descarga del acarreo | `src/world/grid/RoomSegment.js`      |
| Acarreo (HaulCycle)  | ciclo autónomo del scoop de la Cámara: cargar→salir(reversa+beep)→volcar→volver; cede al jugador vía `_driven`. Camiones cargados (cámara)→vacíos (echadero) | `src/world/HaulCycle.js`, `src/world/VehicleSystem.js` |
| Jumbo                | chasis, motor, cabina, carrete, neumaticos, brazos, mangueras, luces, extintor  | `src/elementos/equipos/jumbo.js`             |
| Jumbo Raptor (frontal)| chasis, motor, cabina, neumaticos, gatas, brazo (incluye viga+canasta+perforadora anidados), mangueras, luces, extintor | `src/elementos/equipos/raptor.js` |
| Ventilador           | carcasa, rotor, guarda (solo con protección), patas                                  | `src/elementos/servicios/ventilador.js`        |
| Nicho eléctrico      | excavacion, marco_apertura, tableros (o cables si vacío), humedad (según seed), luz_interior | `src/elementos/entorno/nicho_electrico.js` |
| Persona / minero     | torso, chaleco, cabeza, brazos, piernas, pt_tag, autorescatador                      | `src/elementos/personas/persona.js`           |
| Pizarra monitoreo    | cuerpo, cara, marco, pernos                                                          | `src/elementos/senal/pizarra_monitoreo.js` |
| Empernador / Bolter 88D | chasis, motor, cabina, neumaticos, gatas, brazo (viga+perforadora+carrusel anidados), manipulador_malla, mangueras, luces, extintor | `src/elementos/equipos/empernador.js` |
| Shotcretera          | chasis, bomba_tolva, tanque_aditivo, cabina, neumaticos, gatas, brazo_lanzador (boquilla anidada), luces, extintor | `src/elementos/equipos/shotcretera.js` |
| Mixer / agitador     | chasis, cabina, tambor_agitador, descarga, neumaticos, luces, extintor               | `src/elementos/equipos/mixer.js`             |
| Desatador / Scaler   | chasis, hoja_frontal, motor, cabina, neumaticos, gatas, brazo_desate (pica anidada), luces, extintor | `src/elementos/equipos/desatador.js` |
| Scoop / LHD          | chasis_del, articulacion, motor, cabina, brazo (boom+cuchara+Z-bar), **neumaticos_del** / **neumaticos_tras**, **luces_del** / **luces_tras**, extintor. **ARTICULACIÓN QUE DOBLA**: la mitad DELANTERA (chasis_del, brazo, neumaticos_del, luces_del) cuelga de un grupo `pivote_articulacion` en el pasador (z=`PIVZ`) que rota con `userData._steer` (−1..1, lo inyectan `DriveController`/`VehicleSystem` igual que `_speed`); los 2 cilindros de dirección son dinámicos vía `aim()` entre anclaje trasero y delantero. El pivote NO lleva `sub()` → el visor sigue listando los subelementos igual | `src/elementos/equipos/scoop.js` |
| Telehandler Manitou  | chasis, cabina, contrapeso, neumaticos, pluma_telescopica (var. manitou) / plataforma_tijera (var. paus), luces, extintor | `src/elementos/equipos/telehandler.js` |
| Desatado manual (labor + actividad) | Labor `desatado` (spur `c1_r0→N`, PETS-CL-OPE-1): RoomSegment amuebla frente con barretillas+porta, roca caída, sensor de gases y BLOQUEO de acceso (cordón + bastón luminoso cyalume + letrero del maestro). `WorkCrewSystem.CUADRILLAS.desatado` pone 2 personas ancladas al FRENTE (`frente:true`, `mira:'fondo'`): una DESATA (gesto `desatar` + barretilla en mano) y otra ALUMBRA (`alumbrar`), **rotan rol cada 20 s** (`swap`). El sitio dispara **caída de roca** (pool reciclado). Gestos/herramienta en `minero.js` (`GESTOS.desatar/alumbrar`, `setTarea` adjunta la barretilla al hueso de la mano) | `src/world/grid/MinePlan.js`, `RoomSegment.js`, `src/world/WorkCrewSystem.js`, `src/elementos/personas/minero.js`, `cordon_bloqueo.js` |
| Identidad de equipo  | Helper COMPARTIDO `marcarEquipo(g,{prefijo,articulado})` añade a la flota trackless (scoop/jumbo/raptor/empernador/shotcretera/mixer/desatador/telehandler) los subelementos `identidad` (código interno por unidad p.ej. SC-01/JU-02 + placa de flota + aviso `PELIGRO ARTICULACIÓN` en articulados + tarjeta pre-uso gated por heavyDetail) y `tacos` (cuñas de estacionamiento; `g.userData._tacos`, ocultadas al conducir por DriveController). Decals y geometrías CACHEADOS/compartidos; colocación por bounding box | `src/elementos/equipos/codigo_equipo.js` |

> Al crear un elemento complejo NUEVO: usa el mismo patrón `sub()` desde el inicio y
> añade su fila a esta tabla. Los elementos simples (perno, baliza, manguera, etc.)
> no requieren subelementos.

---

## 14. VISUALIZADOR DE ELEMENTOS (visor.html)

| Parámetro                              | Valor esperado                                           | Archivo                |
|----------------------------------------|----------------------------------------------------------|------------------------|
| Lista de subelementos en el panel      | Debajo del elemento activo, con entrada "Elemento completo" primero | `src/visor/visor.js` |
| Clic en subelemento                    | AÍSLA la parte (solo ella visible) + encuadre de cámara  | `src/visor/visor.js`   |
| Aislamiento                            | `aislar(root, sel)` por visibilidad; ancestros visibles  | `src/visor/visor.js`   |
| Autorrotación con subelemento aislado  | PAUSADA (inspección estática)                            | `src/visor/visor.js`   |
| Info inferior con subelemento          | `Elemento — Subelemento` + dimensiones del subelemento   | `src/visor/visor.js`   |
| **Persistencia de la selección**       | localStorage, clave `visor.seleccion` (JSON `{id, sub}`) | `src/visor/visor.js`   |
| Tras recarga / cambio de código (HMR)  | Se restaura el MISMO elemento y subelemento que se estaba viendo (NUNCA volver al primer objeto) | `src/visor/visor.js` |
| Selección guardada inválida            | Fallback al primer elemento del catálogo                 | `src/visor/visor.js`   |
| Estilo de subitems                     | Clase CSS `.subitem` (+ `.activo` ámbar)                 | `visor.html`           |

---

## 15. REFUGIO MINERO DRÄGER (elemento completo)

| Parámetro                     | Valor esperado                                   | Archivo                              |
|-------------------------------|--------------------------------------------------|--------------------------------------|
| Largo × Ancho × Alto (paredes)| L=6.0 m × A=2.94 m × H=2.45 m                    | `src/elementos/ssoma/refugio_draeger.js`   |
| Capacidad                     | 20 personas                                      | `src/elementos/ssoma/refugio_draeger.js`   |
| Anatomía interior             | Precámara (esclusa), BPU, banco de baterías (recámara exterior), cilindros O2, asientos | `src/elementos/ssoma/refugio_draeger.js` |
| **BPU — cotas de foto**       | Gabinete **1.23 alto × 0.67 ancho × 0.60 fondo** + 2 tolvas de **0.22** = **1.45 m** total. Cotas sacadas de foto real escalando por el Ø 0.23 m de la botella de O2. Antes 1.85 m: casi tocaba la bóveda y no dejaba sitio al split. Mandos en **franja horizontal a ras** de 0.115 m (2 interruptores · visor · pulsador rojo · verde), NO pupitre inclinado. Rejilla ancha y baja **0.59 × 0.32** | `src/elementos/ssoma/refugio_draeger.js` |
| Tolvas de consumible (BPU)    | Dos bocas de carga rotuladas en naranja: `ABSORBENTE DE CO2` y `ABSORBENTE HUMEDAD / CATALIZADOR CO`, cada una con su tapa roscada naranja. Van rotuladas en alto contraste porque confundirlas durante el encierro dejaría la atmósfera sin tratar. Un **ducto blanco de impulsión** sube de entre ambas al split: BPU y A/C son un mismo circuito | `src/elementos/ssoma/refugio_draeger.js`, `_texturaTolva` |
| Cilindros de O2               | **2** botellas en línea (no 4 en 2×2), Ø 0.23 × 1.6 m, aseguradas con **eslinga naranja de carraca** contra cáncamo de mamparo (D.S. 024: una botella a 200 bar suelta es un proyectil) | `src/elementos/ssoma/refugio_draeger.js` |
| Film de embalaje              | Baño químico, bancas, respaldos y split van **precintados en film**: refugio instalado e inspeccionado pero aún sin poner en servicio, que es el estado de las fotos | `src/elementos/ssoma/refugio_draeger.js` |
| Semáforo: verde fija          | Alimentado por RED de mina                       | `src/elementos/ssoma/refugio_draeger.js`   |
| Semáforo: roja fija           | Alimentado por BATERÍAS (alternan cada 60 s, excluyentes) | `src/elementos/ssoma/refugio_draeger.js` |
| Semáforo: ámbar               | SIEMPRE parpadeando a 1 Hz                       | `src/elementos/ssoma/refugio_draeger.js`   |
| Interacción                   | Abre/cierra puertas estancas + panel `ui:read`   | `src/elementos/ssoma/refugio_draeger.js`   |
| En el nicho                   | `nicho_refugio.js` lo anida con frente hacia la apertura y reexpone su interactable | `src/elementos/ssoma/nicho_refugio.js` |

---

## 16. CUADRILLAS DE TRABAJO POR LABOR (NPCs ejecutando tareas)

La mina está VIVA: cada labor activa tiene una cuadrilla humana ejecutando su tarea (no solo
las máquinas). Las cuadrillas se **crean/retiran por proximidad** al jugador y cada trabajador
está estático en su puesto, mirando su punto de trabajo, con un **micro-gesto** de tarea.

| Parámetro                              | Valor esperado                                                        | Archivo                          |
|----------------------------------------|----------------------------------------------------------------------|----------------------------------|
| Sistema                                | `WorkCrewSystem` (gemelo de `WorkSiteSystem`)                        | `src/world/WorkCrewSystem.js`    |
| Labores con cuadrilla                  | `frente`, `sostenimiento`, `shotcrete`, `bombeo`                    | `src/world/WorkCrewSystem.js`    |
| Frente                                 | maestro perforista (`perforar`) + ayudante (`operar`) + vigía (`observar`) | `src/world/WorkCrewSystem.js` |
| Sostenimiento                          | 2 de cuadrilla instalando malla/perno (`instalar`)                   | `src/world/WorkCrewSystem.js`    |
| Shotcrete                              | boquillero (`operar`) + vigía (`observar`), ambos con respirador     | `src/world/WorkCrewSystem.js`    |
| Bombeo                                 | cañería/servicios junto a la bomba (`operar`)                        | `src/world/WorkCrewSystem.js`    |
| Distancia de aparición / retiro        | spawn < 46 m · despawn > 62 m (histéresis)                          | `src/world/WorkCrewSystem.js`    |
| Presupuesto móvil                      | media cuadrilla (`Device.isTouch`)                                   | `src/world/WorkCrewSystem.js`    |
| Anclaje                                | respecto al equipo, hacia el centro de la sala (fuera del hastial) + boundsCheck | `src/world/WorkCrewSystem.js` |
| Comportamiento NPC                     | `behavior: 'trabajando'` — estático, mira `faceTarget`, sin patrulla/refugio | `src/ai/NPC.js`          |
| Micro-gesto de tarea                   | `setTarea(obj, gesto)` — idle + delta en brazos/torso tras el mixer (no acumula) | `src/elementos/personas/minero.js` |
| Gestos disponibles                     | `perforar`, `instalar`, `operar`, `observar`                        | `src/elementos/personas/minero.js`        |
| LOD                                    | delegado a `NPC.update` (animación a tasa reducida / oculto por distancia) | `src/ai/NPC.js`            |

---

## 17. ATMÓSFERA — GOTEO DE AGUA VISIBLE Y ÓXIDO DE ESCURRIMIENTO

La mina está a >90 % HR (`mineria-draw.md`): el agua de filtración gotea de la bóveda e impacta en
el piso/charco, y oxida el acero fijo expuesto. Verificable en pantalla (gota que cae + rizo al
impactar, sincronizados con el "ploc"; óxido escurrido en bandejas/marcos) y en código:

| Parámetro                              | Valor esperado                                                        | Archivo                          |
|----------------------------------------|----------------------------------------------------------------------|----------------------------------|
| Sistema de goteo VISIBLE               | `DripSystem` (gemelo de `VaporSystem`)                              | `src/particles/DripSystem.js`    |
| Gotas simultáneas / goteras            | ≤10 gotas · 3 goteras (escritorio); ≤5 · 2 (táctil)                 | `src/particles/DripSystem.js`    |
| Emisión                                | goteras en la bóveda (player.y+2.9) alrededor del jugador; se recolocan al alejarse (>14 m) | `src/particles/DripSystem.js` |
| Impacto                                | rizo (anillo que expande y desvanece) + `audio.drip(pos)` sincronizado y espacializado | `src/particles/DripSystem.js` |
| Gating de calidad                      | apagado si `particleDensity ≤ 0.05`; nº de goteras escala con la densidad | `src/particles/DripSystem.js` |
| Coste                                  | 1 `THREE.Points` (gotas) + pool de anillos (geo/material compartidos); SIN luces nuevas | `src/particles/DripSystem.js` |
| Goteo AMBIENTE (audio)                 | cadencia lenta 6–14 s como fallback (antes 2–7 s); las visibles las dispara el DripSystem | `src/audio/AudioManager.js` |
| Método público de audio                | `AudioManager.drip(position)` → ploc espacializado por `_spatial`   | `src/audio/AudioManager.js`      |
| Óxido de escurrimiento (material)      | `MineMaterials.aceroOxidado()` + `texturaOxidoEscurrido()` (vetas verticales) | `src/world/materials/MineMaterials.js`, `src/world/materials/Texturas.js` |
| Aplicado a (acero estructural fijo)    | bandeja de cables, marco del tablero de gestión, anillos del ventilador | `bandeja_cables.js`, `tablero_gestion.js`, `ventilador.js` |
| NO aplicado a                          | pintura de equipos (va limpia) ni acero galvanizado de la vía de escape | — |

---

*Fin de especificaciones. Para agregar una nueva spec, añade una fila a la tabla correspondiente
o crea una sección nueva con el mismo formato. Luego ejecuta `/specs-mina` para verificar.*
