import * as THREE from 'three';

/**
 * ENV-MAP de mina (scene.environment).
 *
 * Objetivo: dar REFLEJOS plausibles al suelo mojado/charcos, al metal de los equipos y a los
 * clearcoat, en vez del *specular* plano que se ve sin mapa de entorno. Cumple el md:
 * "mirror-like reflection of yellow banners", "red halos in the puddles", "charcos con
 * reflejo metalico, muy presentes".
 *
 * Se construye SIN assets externos: se pinta un equirectangular OSCURO en canvas con unos
 * pocos halos de las luces tipicas de galeria (bombilla calida, LED verde neon, LED blanco
 * lineal del techo, y un matiz frio de headlamp), y se hornea con PMREMGenerator UNA sola vez
 * al arranque. El muestreo en runtime es barato; la memoria es un cubemap pequeño.
 *
 * REGLA DE ORO: el mapa es casi negro a proposito. La irradiancia difusa que aporta a las
 * superficies matte (roca, shotcrete) es minima, y ademas esos materiales llevan
 * envMapIntensity bajo (ver MineMaterials). Asi el entorno NO aclara la labor: solo espeja en
 * agua/metal.
 */
export function crearEnvMapMina(renderer, { res = 256 } = {}) {
  const w = res, h = res / 2;               // equirectangular 2:1
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Base casi negra (galeria oscura). El suelo (mitad inferior) un pelin menos negro para que
  // el reflejo del piso no sea un vacio absoluto.
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#080706'; ctx.fillRect(0, h * 0.5, w, h * 0.5);

  // Halo radial aditivo suave. x/y en pixeles; r radio; (rr,gg,bb) color; a alfa central.
  const halo = (x, y, r, rr, gg, bb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rr},${gg},${bb},${a})`);
    g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // Horizonte ~ y=h*0.5. Techo arriba (y pequeño), piso abajo (y grande).
  // LED blanco lineal del techo: banda tenue cerca de la corona.
  halo(w * 0.50, h * 0.24, h * 0.55, 235, 240, 255, 0.30);
  // Bombilla calida colgante (la fuente dominante del md): halo naranja sobre el horizonte.
  halo(w * 0.30, h * 0.44, h * 0.42, 255, 190, 90, 0.55);
  halo(w * 0.82, h * 0.40, h * 0.30, 255, 170, 70, 0.35);
  // LED verde neon (accesos/refugios): un par de halos verdes bajos.
  halo(w * 0.63, h * 0.52, h * 0.34, 60, 255, 90, 0.32);
  halo(w * 0.10, h * 0.55, h * 0.22, 60, 255, 90, 0.22);
  // Matiz frio de headlamp/equipo al fondo.
  halo(w * 0.46, h * 0.60, h * 0.20, 200, 220, 255, 0.18);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return rt.texture;
}
