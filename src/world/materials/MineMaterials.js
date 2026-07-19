import * as THREE from 'three';
import {
  texturaRoca, texturaShotcrete, texturaBarro, texturaLodo, texturaMetal, texturaGrunge,
  texturaRocaTunel, texturaRocaTunelNormal, texturaRocaTunelRough, texturaAguaNormal,
  texturaOxidoEscurrido
} from './Texturas.js';

/**
 * Libreria CENTRAL de materiales — UNICA fuente de la paleta del md (mineria-draw.md).
 *
 * Todos los colores provienen literalmente de la tabla "PALETA DE COLORES COMPLETA".
 * Los materiales se crean una sola vez y se reutilizan (optimizacion: menos draw calls,
 * menos memoria). Para editar el look de un elemento, se cambia AQUI.
 *
 * Reglas del md aplicadas:
 *  - Superficies rugosas (roughness alto), nunca lisas/uniformes.
 *  - Suelo mojado/charcos muy reflectivos (clearcoat).
 *  - Emisivos para LED verde neon, LED blanco y bombilla calida (alimentan el bloom).
 */

/** Paleta literal del md, exportada para usar en UI/senaletica/luces. */
export const PALETTE = {
  rocaOscura: 0x2a2a2a,        // #1a1a1a–#3d3d3d
  rocaMineralizada: 0x8f7a2a,  // sulfuros Zn/Pb/Cu #b8960c–#6b7c3a
  shotcreteFresco: 0xd0d0c8,   // #c8c8c0–#d8d8d0
  shotcreteHumedo: 0x909088,   // #909088
  sueloSeco: 0x6e6860,         // #6e6860
  barro: 0x484840,             // #484840 reflectivo
  oxidoMalla: 0x8b4513,        // #8b4513–#a0522d
  ventNaranja: 0xe84000,       // manga activa
  ventOxido: 0x8b4513,         // manga antigua
  panelNaranja: 0xe06000,      // tablero electrico
  acero: 0x888888,
  cableNegro: 0x141414,
  mangueraAmarilla: 0xf5c300,
  mangueraVerde: 0x1a9e3f,    // agua (verde seguridad)
  mangueraAzul: 0x1155cc,     // aire comprimido (azul seguridad)
  ledVerde: 0x39ff14,          // #00ff44–#39ff14
  ledBlanco: 0xffffff,
  bombillaCalida: 0xffcc44,    // #ffcc44
  headlampFrio: 0xe8f0ff,      // #e8f0ff
  eppNaranja: 0xff6600,        // traje/coverall
  cascoOperario: 0xffdd00,
  cascoSupervisor: 0xf0f0f0,
  cascoGeomecanica: 0x2e7d32,
  equipoRojo: 0xcc2200,        // jumbo Sandvik
  equipoAmarillo: 0xf5c300     // bolter / utilitario
};

class MaterialLibrary {
  constructor() {
    this._cache = new Map();
  }

  _get(key, factory) {
    if (!this._cache.has(key)) this._cache.set(key, factory());
    return this._cache.get(key);
  }

  // -- Roca y estructura --
  roca() {
    return this._get('roca', () =>
      new THREE.MeshStandardMaterial({ color: 0x9a9a96, map: texturaRoca(), roughness: 1, metalness: 0 })
    );
  }

  /**
   * Roca de tunel subterraneo: colores por vertice fBM (tecnica del terrain_raycast) MÁS
   * textura de caliza real y NORMAL MAP (grano/relieve 3D bajo la luz del headlamp), calibrada
   * al escaneo por fotogrametria de la galeria real. El `map` (gris medio) MODULA el color por
   * vertice sin aplanarlo; el `normalMap` da la rugosidad de roca. vertexColors sigue activo.
   */
  rocaTunel() {
    return this._get('rocaTunel', () => {
      const nrm = texturaRocaTunelNormal();
      return new THREE.MeshStandardMaterial({
        color:        0xffffff,
        map:          texturaRocaTunel(),
        normalMap:    nrm,
        // Relieve mas marcado (antes 0.85): la roca se ve mas tridimensional bajo el headlamp
        // sin coste extra (el normalMap ya se muestrea). Aporta realismo en todos los presets.
        normalScale:  new THREE.Vector2(1.05, 1.05),
        // Humedad diferencial: el roughnessMap MODULA la rugosidad → la roca brilla mojada
        // en escurrimientos/manchas y sigue mate en seco. roughness=1.0 deja que el mapa
        // mande (base clara del mapa ≈0.94 → sigue mate; vetas oscuras ≈0.25 → brillo humedo).
        // Coste: 1 sampler extra sobre una textura ya cacheada. Aporta en TODOS los presets.
        roughnessMap: texturaRocaTunelRough(),
        roughness:    1.0,
        metalness:    0.0,
        vertexColors: true,
        emissive:          0x1c150e,
        emissiveIntensity: 0.35,
        // envMap (scene.environment) bajo: la roca es matte y grande → un reflejo/IBL fuerte
        // aclararia los hastiales y romperia la "regla de oro". Solo un matiz humedo sutil.
        envMapIntensity: 0.16,
        // DoubleSide: al cruzar el shell del tunel (p.ej. entrando a un nicho),
        // la cara trasera sigue renderizando roca → sin "agujero negro" ni perdida de
        // visualizacion. No hay impacto perceptible en la vista normal desde el tunel.
        side: THREE.DoubleSide
      });
    });
  }

  rocaMineralizada() {
    return this._get('rocaMin', () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.rocaMineralizada,
        roughness: 0.82,
        metalness: 0.08,
        emissive: 0x3a2f00,
        emissiveIntensity: 0.15,
        flatShading: true
      })
    );
  }

  shotcrete(fresco = true) {
    const key = fresco ? 'shotcreteF' : 'shotcreteH';
    return this._get(key, () =>
      new THREE.MeshStandardMaterial({
        color: fresco ? 0xffffff : 0xb8b8b0,
        map: texturaShotcrete(),
        roughness: 0.95,
        metalness: 0,
        // Superficie matte grande → env-map muy contenido para no aclarar la labor.
        envMapIntensity: 0.16
      })
    );
  }

  // -- Pisos --
  sueloSeco() {
    return this._get('sueloSeco', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.sueloSeco, roughness: 1, metalness: 0 })
    );
  }

  /** Barro/suelo mojado: humedo, con lamina de agua reflectiva pero controlada. */
  barroMojado() {
    return this._get('barro', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x9a9088,
        map: texturaBarro(),
        // Mas mojado (md: piso muy reflectivo, casi en todas las escenas): baja la rugosidad
        // y sube el clearcoat/lo hace mas liso para que el env-map (LED/bombillas) espeje en el
        // piso. Sigue siendo piso (no charco), asi que el reflejo es difuso, no de espejo.
        roughness: 0.52,
        metalness: 0.1,
        clearcoat: 0.35,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.5
      })
    );
  }

  /**
   * BARRO/POLVO DE LOS BAJOS de la flota (md: "muy polvoriento", nada "de fabrica" limpio).
   * Material UNICO compartido por todos los equipos: salpicadura seca y mate en faldones, ejes
   * y parte baja del chasis. Mate total (no compite con vastagos cromados ni filos pulidos).
   */
  barroBajos() {
    return this._get('barroBajos', () =>
      new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.98, metalness: 0.0 })
    );
  }

  /**
   * ACERO PULIDO POR ABRASION — el FILO de faena de los implementos (dientes/labio de cuchara,
   * pica del scaler, cuchillas/labios). La roca come la pintura y pule el metal: espeja
   * (roughness muy bajo, metalness alto) contra el resto polvoriento del equipo. Material UNICO
   * compartido por toda la flota (md: "filo de cuchara/hoja/pica en metal PULIDO... brillante").
   * Es acero de trabajo, no cromo: brillo alto pero no espejo perfecto.
   */
  aceroPulido() {
    return this._get('aceroPulido', () =>
      new THREE.MeshStandardMaterial({
        color: 0xd0d4d8, roughness: 0.16, metalness: 0.95, envMapIntensity: 0.8
      })
    );
  }

  /** Lodo / barro espeso: marron oscuro, humedo pero mate. */
  lodo() {
    return this._get('lodo', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x6a5a48,
        map: texturaLodo(),
        roughness: 0.65,
        metalness: 0.05,
        clearcoat: 0.17,
        clearcoatRoughness: 0.55
      })
    );
  }

  /**
   * Agua CORRIENDO (canal de drenaje central + soleras de cuneta): mismo look que el charco
   * pero con normal map de rizos que BaseSegment desplaza cada frame (userData.tick) → el
   * flujo hacia la poza de bombeo se VE. md: "canal central de drenaje con agua".
   * La textura es compartida: UN offset anima el agua de toda la mina (coste ~cero).
   */
  aguaCorriente() {
    return this._get('aguaCorriente', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x05060a,
        normalMap: texturaAguaNormal(),
        normalScale: new THREE.Vector2(0.35, 0.35),   // rizo sutil: lamina fina, no oleaje
        roughness: 0.14,
        metalness: 0.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.08,
        reflectivity: 0.45,
        envMapIntensity: 0.9
      })
    );
  }

  /** Charco: agua estancada oscura, casi espejo. Refleja el env-map (LED/bombillas/banners). */
  charco() {
    return this._get('charco', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x05060a,
        // Casi liso → refleja el entorno como agua real. Con scene.environment asignado, el
        // md se cumple: "mirror-like reflection of yellow banners", "red halos in the puddles".
        roughness: 0.12,
        metalness: 0.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.08,
        reflectivity: 0.45,
        envMapIntensity: 0.9
      })
    );
  }

  // -- Metales --
  acero() {
    return this._get('acero', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.acero, map: texturaMetal(), roughness: 0.65, metalness: 0.28, envMapIntensity: 0.4 })
    );
  }

  /**
   * Acero estructural OXIDADO (bandejas de cable, marcos, anillos): acero sucio con parches y
   * VETAS de oxido escurrido (md: oxido cafe en bordes/soldaduras; la mina humeda lo lava hacia
   * abajo). Compartido/cacheado, sin geometria extra. NO usar en la pintura de equipos (va limpia);
   * solo estructura de acero fija y expuesta a la humedad.
   */
  aceroOxidado() {
    return this._get('aceroOxidado', () =>
      new THREE.MeshStandardMaterial({ color: 0x9a8f82, map: texturaOxidoEscurrido(), roughness: 0.86, metalness: 0.22, envMapIntensity: 0.3 })
    );
  }

  mallaOxidada() {
    return this._get('malla', () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.oxidoMalla,
        roughness: 0.88,
        metalness: 0.20,
        transparent: true,
        opacity: 0.95
      })
    );
  }

  // -- Instalaciones / equipos --
  ventNaranja() {
    return this._get('ventN', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.ventNaranja, map: texturaGrunge(), roughness: 0.8, metalness: 0.1, envMapIntensity: 0.3 })
    );
  }

  panelNaranja() {
    return this._get('panelN', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.panelNaranja, map: texturaGrunge(), roughness: 0.78, metalness: 0.13, envMapIntensity: 0.3 })
    );
  }

  cable() {
    return this._get('cable', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.cableNegro, roughness: 0.6, metalness: 0.1 })
    );
  }

  mangueraAmarilla() {
    return this._get('manguera', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.mangueraAmarilla, roughness: 0.6, metalness: 0.1 })
    );
  }

  mangueraVerde() {
    return this._get('mangueraVerde', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.mangueraVerde, roughness: 0.65, metalness: 0.05 })
    );
  }

  mangueraAzul() {
    return this._get('mangueraAzul', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.mangueraAzul, roughness: 0.65, metalness: 0.05 })
    );
  }

  // -- Emisivos (alimentan el bloom; ver lighting/ y PostFX) --
  ledVerde() {
    return this._get('ledVerde', () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.ledVerde,
        emissive: PALETTE.ledVerde,
        emissiveIntensity: 3.5,
        roughness: 0.4
      })
    );
  }

  ledBlanco() {
    return this._get('ledBlanco', () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        // Emisivo moderado: antes (3.0) el bloom de la barra del techo "empañaba" la vista
        // al mirar hacia arriba. Bajado a 1.4 → la luminaria sigue brillando pero su halo no
        // vela la corona de la labor. La iluminacion REAL la aporta el PointLight de LinearLed.
        emissiveIntensity: 1.4,
        roughness: 0.4
      })
    );
  }

  bombilla() {
    return this._get('bombilla', () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.bombillaCalida,
        emissive: PALETTE.bombillaCalida,
        emissiveIntensity: 2.5
      })
    );
  }

  /** Material de color plano parametrizable (EPP, cascos, equipos). Cacheado por parametros. */
  plano(color, { rough = 0.8, metal = 0.1, emissive = 0, emissiveIntensity = 0 } = {}) {
    const key = `plano:${color}:${rough}:${metal}:${emissive}:${emissiveIntensity}`;
    return this._get(key, () => new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      emissive,
      emissiveIntensity
    }));
  }
}

/** Singleton de materiales de mina. */
export const MineMaterials = new MaterialLibrary();
