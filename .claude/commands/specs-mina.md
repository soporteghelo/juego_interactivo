# Especificaciones del Simulador — Cerro Lindo (AESA/NEXA)

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

---

## 1. COLORES DE MANGUERAS

| Elemento          | Color esperado | Código hex | Archivo a verificar        |
|-------------------|----------------|------------|----------------------------|
| Manguera de AGUA  | VERDE          | `#1a9e3f`  | `src/elementos/manguera.js` y `MineMaterials.js` |
| Manguera de AIRE  | AZUL           | `#1155cc`  | `src/elementos/manguera.js` y `MineMaterials.js` |

---

## 2. ALTURAS DE MONTAJE (medido desde el suelo, y=0)

| Elemento                        | Altura centro (m) | Altura borde inferior (m) | Archivo                                   |
|---------------------------------|-------------------|---------------------------|-------------------------------------------|
| Tablero eléctrico en NICHO      | 1.0               | —                         | `src/elementos/nicho_electrico.js`        |
| Panel informativo AESA (pared)  | 2.0               | 1.5                       | `src/procedural/PropScatter.js`           |
| PT-TAG en pecho del trabajador  | 1.30              | —                         | `src/elementos/persona.js`                |

> Nota: "altura centro" es el valor Y del `position.set(x, Y, z)` del objeto en cuestión.

---

## 3. DIMENSIONES DEL NICHO ELÉCTRICO

| Parámetro             | Valor esperado  | Archivo                             |
|-----------------------|-----------------|-------------------------------------|
| Ancho nicho simple    | 1.35 m          | `src/elementos/nicho_electrico.js`  |
| Ancho nicho doble     | 1.90 m          | `src/elementos/nicho_electrico.js`  |
| Alto del nicho        | 2.20 m          | `src/elementos/nicho_electrico.js`  |
| Profundidad del nicho | 0.65 m          | `src/elementos/nicho_electrico.js`  |
| Prob. aparición/tramo | 55%             | `src/procedural/PropScatter.js`     |
| Prob. variante doble  | 30%             | `src/procedural/PropScatter.js`     |

---

## 4. MALLA SOBRESALIDA

| Parámetro             | Valor esperado  | Archivo                             |
|-----------------------|-----------------|-------------------------------------|
| Ancho del panel       | 1.0 m           | `src/procedural/PropScatter.js`     |
| Tipo de hazard        | `'corte'`       | `src/elementos/malla.js`            |
| Distancia de aviso    | 1.5 m           | `src/elementos/malla.js`            |
| Distancia de herida   | 0.35 m          | `src/elementos/malla.js`            |
| Mata al jugador       | NO (sin `kill`) | `src/elementos/malla.js`            |

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
| Semi-ancho HW               | 1.05 m              | `src/elementos/camioneta.js`        |
| Radio de llanta             | 0.55 m              | `src/elementos/camioneta.js`        |
| Ancho de llanta             | 0.38 m              | `src/elementos/camioneta.js`        |
| Segmentos de llanta         | 20                  | `src/elementos/camioneta.js`        |
| Orientación de llanta       | `rotation.z = π/2`  | `src/elementos/camioneta.js`        |
| Kill distance               | 0.5 m               | `src/world/VehicleSystem.js`        |
| Tipo de hazard              | `'atropello'`       | `src/elementos/camioneta.js`        |

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
| Posición en el trabajador   | Pecho derecho (x=0.20, y=1.30, z=0.14) | `src/elementos/persona.js` |
| LED batería OK              | Verde                        | `src/elementos/pt_tag.js`    |
| LED batería baja            | Ámbar (parpadeo animado)     | `src/elementos/pt_tag.js`    |
| LED batería crítica         | Rojo (parpadeo animado)      | `src/elementos/pt_tag.js`    |
| % trabajadores batería baja | ~20%                         | `src/elementos/persona.js`   |

---

## 10. VENTILADOR

| Parámetro                        | Valor esperado   | Archivo                         |
|----------------------------------|------------------|---------------------------------|
| Variante sin guarda: kill dist   | 1.1 m            | `src/elementos/ventilador.js`   |
| Variante con guarda: kill dist   | 0.6 m            | `src/elementos/ventilador.js`   |
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

*Fin de especificaciones. Para agregar una nueva spec, añade una fila a la tabla correspondiente
o crea una sección nueva con el mismo formato. Luego ejecuta `/specs-mina` para verificar.*
