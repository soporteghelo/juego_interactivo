# Simulador de Mina Subterránea (Three.js)

Simulador/juego de mina subterránea **hiperrealista** para navegador, orientado a
entrenamiento operacional, seguridad y salud ocupacional (SSOMA), inspecciones,
investigación de incidentes, identificación de peligros, simulacros de emergencia y
recorridos virtuales.

Todo el diseño visual deriva **exclusivamente** de la referencia
[`mineria-draw.md`](./mineria-draw.md) (unidad minera subterránea, NEXA): paleta de
colores, "regla de oro" de iluminación (oscuridad total, solo fuentes puntuales), EPP,
señalética, elementos estructurales y dimensiones técnicas.

Jugable en **escritorio** (teclado/ratón) y en **celular** (controles táctiles), con
detección de dispositivo y preset de calidad adaptativo.

---

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (incluye `npm`).
- Un navegador moderno con WebGL2 (Chrome, Edge, Firefox, Safari).

## Instalación y ejecución

```bash
npm install      # instala three, @dimforge/rapier3d-compat y vite
npm run dev      # arranca el servidor de desarrollo (Vite)
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).
Pulsa **INGRESAR A LA MINA** para activar controles y audio.

### Mina completa 3D desde CSV

La portada incluye **VER MINA COMPLETA 3D**, que abre el modelo ensamblado a escala
`1:1` en 54 emplazamientos creados desde los 34 archivos de `prueba/elementos/`.
La mina cubre superficie y niveles 160, 128, 96 y 64. La vista permite orbitar, cambiar
entre perspectiva/planta/perfil, cortar por cota, mostrar la triangulación, ocultar
servicios y enfocar una labor individual.

```bash
npm run generate:mine  # regenera elementos + mina maestra
npm run test:mine      # valida emplazamientos, cotas, extensión y triángulos
```

El archivo maestro es `prueba/elementos/_mina_completa.csv`; su catálogo de ubicación
es `_mina_completa_layout.csv`. Ambos mantienen la convención topográfica X=Este,
Y=Norte, Z=cota y una unidad igual a un metro.

> **Las nubes de puntos NO se versionan.** Son 73 MB regenerables, así que están en
> `.gitignore` (solo se versionan `_catalogo.csv` y `_mina_completa_layout.csv`, que son
> de autoría). Por eso `dev` y `build` llevan un hook `predev`/`prebuild` que ejecuta
> `generate:mine` automáticamente: en un clon recién hecho —o en un deploy— el bundle
> importa `_mina_completa.csv`, y sin el hook la compilación falla con
> `Could not resolve "../../prueba/elementos/_mina_completa.csv?url"`. La generación
> tarda ~5 s y es determinista. Los `test:*` sí asumen que ya se ejecutó al menos una vez.

### Probar en el celular

El `vite.config.js` expone el servidor en la red local (`server.host`). Con el PC y el
celular en la **misma red WiFi**, abre en el móvil la URL `Network:` que muestra Vite
(ej. `http://192.168.x.x:5173`). Aparecerán el joystick y los botones táctiles.

### Build de producción

```bash
npm run build    # genera /dist
npm run preview  # sirve /dist localmente
```

---

## Visualizador de elementos (editor)

Para inspeccionar y editar cada elemento por separado (ver qué le falta), abre:

```
http://localhost:4000/visor.html
```

Lista todos los elementos del catálogo ([src/elementos/](src/elementos/)); permite rotarlos,
medir sus dimensiones, ver su descripción y alternar grilla/wireframe. Cada elemento vive en
**un solo archivo en español** dentro de `src/elementos/`: edita ese archivo y el cambio se
refleja en el visor y en el simulador.

## Controles

| Acción | Escritorio | Celular |
|---|---|---|
| Moverse | `W A S D` / flechas | Joystick (abajo-izq.) |
| Mirar | Ratón (clic para bloquear puntero) | Arrastrar en pantalla |
| Correr | `Shift` | Botón `CORRER` |
| Agacharse | `Ctrl` / `C` | Botón `AGACHAR` |
| Saltar | `Espacio` | Botón `SALTAR` |
| Interactuar | `E` | Botón `ACCIÓN` |
| Linterna (headlamp) | `F` | Botón `LUZ` |
| Cambiar 1ª/3ª persona | `V` | Botón `VISTA` |

## Probar eventos dinámicos (consola del navegador)

```js
__mina.eventDirector.trigger('rockfall')  // caída de rocas
__mina.eventDirector.trigger('blackout')  // corte eléctrico
__mina.eventDirector.trigger('fire')      // incendio (los NPC evacúan)
__mina.eventDirector.trigger('gas')       // fuga de gases
```

---

## Arquitectura

```
src/
├── core/        Engine, Loop, Renderer, SceneManager, Settings, Device,
│                EventBus, Input (teclado+ratón+táctil unificado), AssetLoader,
│                InteractionSystem, PostFX
├── elementos/   TODOS los elementos editables en español, un archivo por elemento
│                (perno, malla, shotcrete, roca_suelta, charco, baliza, senal, ventilacion,
│                ventilador, bandeja_cables, manguera, tablero_electrico, tablero_gestion,
│                pizarra_monitoreo, camion, camioneta, refugio…) + index.js (catálogo)
├── visor/       Visualizador de elementos (lo carga visor.html)
├── world/       World (orquesta), segments/ (tipos de galería),
│                materials/MineMaterials (paleta única del md)
├── procedural/  Rng, LayoutGenerator, SegmentAssembler, PropScatter
├── player/      Player, CharacterController (Rapier), CameraRig (1ª/3ª), Headlamp
├── physics/     Physics (Rapier), Colliders
├── lighting/    LightingRig (regla de oro), LedStrip, LinearLed, HangingBulb
├── particles/   ParticleSystem, Dust, Mist
├── audio/       AudioManager (audio espacial sintetizado)
├── ai/          NPCManager, NPC (EPP por rol)
├── events/      EventDirector + RockFall, PowerOutage, Fire, GasLeak
├── missions/    MissionManager, Mission (inducción de seguridad)
├── ui/          HUD, TouchControls, styles.css
├── assets/      models/ textures/ audio/ (placeholders por código; ver assets/README.md)
└── utils/       math, ObjectPool, Lod, Disposable
```

### Optimización (objetivo 60 FPS @ 1080p en GPU integrada y celular)

- **InstancedMesh** para pernos de roca y escombros.
- **LOD** (`utils/Lod.js`), **Frustum Culling** (Three) y culling por distancia (`World`).
- **Object Pooling** (`utils/ObjectPool.js`), materiales/texturas compartidos.
- **Quality gating** por preset (`Settings`) según el dispositivo (`Device`).
- Generación procedural reproducible por semilla (`Rng`).

---

## Extensibilidad

El proyecto está estructurado en carpetas para editar cada elemento por separado:

- **Nuevos entornos:** añade un tipo en `world/segments/`, regístralo en
  `procedural/SegmentAssembler.js` y dale reglas en `procedural/LayoutGenerator.js`.
- **Assets reales:** suelta `.glb` en `src/assets/models/` y mapéalos en `AssetLoader`
  (ver [`src/assets/README.md`](./src/assets/README.md)).
- **IA, eventos y misiones:** ampliar `ai/`, `events/` y `missions/`; todos están cableados
  al `EventBus` (pub/sub) para comunicarse sin acoplarse.

> Versión legada: la carpeta [`otros/`](./otros/) conserva el prototipo monolítico original
> a modo de referencia; no forma parte del build de Vite.
