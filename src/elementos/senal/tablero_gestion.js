import * as THREE from 'three';
import { MineMaterials } from '../../world/materials/MineMaterials.js';

/**
 * TABLERO DE GESTION SSOMA — md: panel verde con borde rojo/blanco ~80×60cm, con
 * secciones POLITICAS / IPERC / ESTANDARES / PROCEDIMIENTOS / ESTADISTICAS / PLANOS /
 * PLAN DE EMERGENCIAS. INTERACTUABLE: revisar tablero de gestion.
 */

export const meta = {
  id: 'tablero_gestion',
  nombre: 'Tablero de gestion (SSOMA)',
  descripcion: 'Panel verde con documentos de gestion de seguridad. Interactuable.'
};

function texturaPanel() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b5e20'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
  ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, c.width, 54);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
  ctx.fillText('GESTION SSOMA', c.width / 2, 38);
  const items = ['POLITICAS', 'IPERC / MAPA DE RIESGO', 'ESTANDARES', 'PROCEDIMIENTOS',
    'ESTADISTICAS', 'PLANO TOPOGRAFICO', 'PLANO GEOMECANICO', 'PLAN DE EMERGENCIAS'];
  ctx.textAlign = 'left'; ctx.font = '22px Arial';
  items.forEach((it, i) => {
    const x = 30 + (i % 2) * 240;
    const y = 100 + Math.floor(i / 2) * 64;
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 24, 220, 44);
    ctx.fillStyle = '#111'; ctx.fillText(it, x + 8, y + 4);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @returns {THREE.Group} */
export function crear() {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 0.04),
    new THREE.MeshStandardMaterial({ map: texturaPanel(), roughness: 0.7, emissive: 0x111111, emissiveIntensity: 0.2 })
  );
  panel.position.y = 1.6;
  g.add(panel);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.66, 0.02), MineMaterials.aceroOxidado());
  frame.position.set(0, 1.6, -0.02);
  g.add(frame);

  g.name = 'tablero_gestion';
  g.userData.solid = true;   // obstaculo solido: el jugador/NPC no lo atraviesa
  g.userData.interactable = {
    object: panel,
    descriptor: {
      label: 'Revisar tablero de gestion (SSOMA)',
      onInteract: () => window.__mina?.bus.emit('ui:read', {
        title: 'TABLERO DE GESTION — SSOMA',
        body:
          'Sistema de gestion en terreno: IPERC (Identificacion de Peligros, Evaluacion y ' +
          'Control de Riesgos), Mapa de Riesgo, Estandares y Procedimientos (PETS), ' +
          'Estadisticas de seguridad, Plano Topografico, Plano Geomecanico y Plan de ' +
          'Respuesta a Emergencias. Valores: Integridad, Bienestar y Seguridad, ' +
          'Productividad, Trabajo en Equipo, Cliente, Pasion y Aprendizaje.'
      })
    }
  };
  return g;
}
