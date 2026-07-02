import * as THREE from 'three';
import {
  texturaRoca, texturaShotcrete, texturaBarro, texturaLodo, texturaMetal, texturaGrunge
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
   * Roca de tunel subterraneo con colores por vertice fBM (misma tecnica que
   * webgl_geometry_terrain_raycast). Sin flatShading → shading suave sobre la
   * geometria desplazada, igual que el terrain example. vertexColors:true activa
   * el atributo 'color' generado en TunnelGeometry.createTunnelShell().
   */
  rocaTunel() {
    return this._get('rocaTunel', () =>
      new THREE.MeshStandardMaterial({
        color:        0xffffff,
        roughness:    1.0,
        metalness:    0.0,
        vertexColors: true,
        emissive:          0x1c150e,
        emissiveIntensity: 0.35,
        // DoubleSide: al cruzar el shell del tunel (p.ej. entrando a un nicho),
        // la cara trasera sigue renderizando roca → sin "agujero negro" ni perdida de
        // visualizacion. No hay impacto perceptible en la vista normal desde el tunel.
        side: THREE.DoubleSide
      })
    );
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
        metalness: 0
      })
    );
  }

  // -- Pisos --
  sueloSeco() {
    return this._get('sueloSeco', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.sueloSeco, roughness: 1, metalness: 0 })
    );
  }

  /** Barro/suelo mojado: humedo pero sin brillo exagerado. */
  barroMojado() {
    return this._get('barro', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x9a9088,
        map: texturaBarro(),
        roughness: 0.60,
        metalness: 0.1,
        clearcoat: 0.20,
        clearcoatRoughness: 0.45
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

  /** Charco: agua estancada, oscura, ligeramente reflectiva. */
  charco() {
    return this._get('charco', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x05060a,
        roughness: 0.20,
        metalness: 0.0,
        clearcoat: 0.33,
        clearcoatRoughness: 0.12,
        reflectivity: 0.33
      })
    );
  }

  // -- Metales --
  acero() {
    return this._get('acero', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.acero, map: texturaMetal(), roughness: 0.65, metalness: 0.28 })
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
      new THREE.MeshStandardMaterial({ color: PALETTE.ventNaranja, map: texturaGrunge(), roughness: 0.8, metalness: 0.1 })
    );
  }

  panelNaranja() {
    return this._get('panelN', () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.panelNaranja, map: texturaGrunge(), roughness: 0.78, metalness: 0.13 })
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
        emissiveIntensity: 3.0,
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

  /** Material de color plano parametrizable (EPP, cascos, equipos). No cacheado por color. */
  plano(color, { rough = 0.8, metal = 0.1, emissive = 0, emissiveIntensity = 0 } = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      emissive,
      emissiveIntensity
    });
  }
}

/** Singleton de materiales de mina. */
export const MineMaterials = new MaterialLibrary();
