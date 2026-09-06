import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * EMPERNADOR — VARIANTE GLB (malla externa optimizada).
 *
 * Sustituye en el VISOR al empernador procedural (`empernador.js`) por el modelo descargado
 * de Sketchfab, pasado por el pipeline de optimizacion:
 *
 *   original            59.27 MB    992.896 tris
 *   weld                53.58 MB    992.896
 *   simplify .08/.001   12.32 MB    108.965
 *   webp + prune         8.11 MB    108.965
 *   draco                2.47 MB    108.965   ← public/models/bolter_lod0.glb
 *
 * Queda con UN material y UNA llamada de dibujo, contra las ~250 mallas del procedural.
 *
 * AVISO DE FIDELIDAD: la maquina escaneada es una PERFORADORA DE TALADROS LARGOS (Simba),
 * no un empernador. Le falta el rasgo que identifica al bolter — carrusel de pernos,
 * inyector de resina y manipulador de malla — que SI esta modelado en `empernador.js`.
 * Se monta aqui para comparar calidad de superficie, no como equipo correcto.
 *
 * NORMALIZACION (el GLB no viene listo para la escena):
 *  - Escala: llega con 1.904 unidades de largo, no metrico. Se reescala a `largo` metros.
 *  - Eje: el eje largo del modelo es X; la conveccion de los equipos del simulador es Z.
 *  - Origen: viene centrado en su bounding box, con media maquina bajo y=0. Se apoya al piso.
 * Las tres cosas se miden en runtime sobre la caja real, asi que si se cambia el GLB por otro
 * (u otro LOD) sigue cuadrando sin tocar numeros a mano.
 */

export const meta = {
  id: 'empernador',
  nombre: 'Empernador / Bolter (GLB)',
  descripcion:
    'Malla externa optimizada (Sketchfab → simplify + webp + draco): 108.965 tris, 1 material, ' +
    '2.47 MB. Escalada a metrico, orientada sobre Z y apoyada al piso. Ojo: el escaneo es de una ' +
    'perforadora de taladros largos (Simba), no de un bolter — le falta carrusel de pernos y ' +
    'manipulador de malla.'
};

const URL_MODELO = '/models/bolter_lod0.glb';
/** Largo objetivo en metros. 11 m es la referencia de la ficha de equipos (Simba ~11 x 2.5 x 3.2). */
const LARGO_M = 11.0;

let _promesa = null;

/**
 * Carga y NORMALIZA el GLB una sola vez. Devuelve el grupo fuente (ya escalado, orientado y
 * apoyado en y=0) del que se clona en cada `crear()`. Si falla, resuelve a `null` y el
 * llamador se queda con el grupo vacio en vez de romper el visor.
 */
function cargarFuente() {
  if (_promesa) return _promesa;

  _promesa = (async () => {
    const draco = new DRACOLoader();
    // Decoder servido desde public/ (copiado de three/examples/jsm/libs/draco/gltf) en vez del
    // CDN que usa AssetLoader: el visor tiene que abrir sin red.
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    try {
      const gltf = await loader.loadAsync(URL_MODELO);

      // El material del escaneo viene doubleSided: en la mina eso es fill-rate regalado,
      // porque nunca se ve el interior de la maquina.
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = false;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          m.side = THREE.FrontSide;
          // El env-map de la mina es casi negro (ver EnvMap.js): sin subir la intensidad el
          // metal del escaneo se lee como una mancha plana cuando esto pase al juego.
          m.envMapIntensity = 1.2;
          m.needsUpdate = true;
        }
      });

      // ── Orientacion: eje largo del modelo (X) → Z, que es como se construyen los equipos ──
      const orientado = new THREE.Group();
      orientado.add(gltf.scene);
      const caja = new THREE.Box3().setFromObject(orientado);
      const tam = caja.getSize(new THREE.Vector3());
      if (tam.x > tam.z) orientado.rotation.y = -Math.PI / 2;
      orientado.updateMatrixWorld(true);

      // ── Escala: de unidades de Sketchfab a metros ──
      const escalado = new THREE.Group();
      escalado.add(orientado);
      const cajaOr = new THREE.Box3().setFromObject(escalado);
      const tamOr = cajaOr.getSize(new THREE.Vector3());
      escalado.scale.setScalar(LARGO_M / tamOr.z);
      escalado.updateMatrixWorld(true);

      // ── Apoyo: centrado en X/Z y con las ruedas en y=0 (los equipos del simulador se
      //    colocan sobre el piso, no por su centro) ──
      const fuente = new THREE.Group();
      fuente.add(escalado);
      const cajaEs = new THREE.Box3().setFromObject(fuente);
      const centro = cajaEs.getCenter(new THREE.Vector3());
      escalado.position.set(-centro.x, -cajaEs.min.y, -centro.z);
      fuente.updateMatrixWorld(true);

      return fuente;
    } catch (err) {
      console.warn(`[empernador_glb] no se pudo cargar "${URL_MODELO}".`, err);
      return null;
    }
  })();

  return _promesa;
}

/** Precarga opcional (para que la primera seleccion en el visor no espere). */
export function precargar() { return cargarFuente(); }

export function crear() {
  const g = new THREE.Group();
  g.name = 'empernador';
  // Los clones COMPARTEN geometria y materiales con la fuente: si el visor los disposea al
  // cambiar de elemento, la siguiente seleccion sale vacia. Bandera leida en visor.js.
  g.userData.compartido = true;

  // Proxy de bounding box INVISIBLE con las medidas de ficha del bolter. El visor encuadra la
  // camara con Box3 justo despues de `crear()`, que es antes de que llegue el GLB; sin esto la
  // caja sale vacia y la camara queda pegada al origen. `Box3.expandByObject` no mira
  // `visible`, asi que el proxy aporta medidas sin dibujarse. Se retira al llegar el modelo.
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 3.0, LARGO_M),
    new THREE.MeshBasicMaterial()
  );
  proxy.visible = false;
  proxy.position.y = 1.5;
  g.add(proxy);

  // El visor encuadra y mide JUSTO despues de `crear()`, cuando el GLB todavia no llego. Deja
  // aqui la promesa para que vuelva a medir cuando la malla real este puesta; sin esto el panel
  // informa las medidas del proxy en vez de las de la maquina.
  g.userData.listo = cargarFuente().then((fuente) => {
    if (!fuente) return;                 // fallo de carga: queda el grupo vacio, sin reventar
    g.add(fuente.clone(true));
    g.remove(proxy);
    proxy.geometry.dispose();
    proxy.material.dispose();
  });

  return g;
}
