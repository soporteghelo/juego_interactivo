/**
 * GENERADOR DE VISOR AUTOCONTENIDO (sin servidor)
 * ================================================
 *
 * Empaqueta el visor de elementos (src/visor/visor.js + Three.js + todos los
 * elementos del CATALOGO) en UN SOLO archivo HTML: `visor-standalone.html`.
 *
 * Ese archivo se abre con DOBLE CLIC (protocolo file://) sin necesidad de
 * levantar Vite ni ningun servidor. Todo el JavaScript queda embebido en un
 * <script type="module"> inline, que el navegador SI ejecuta bajo file://
 * (los modulos inline no pasan por la comprobacion CORS que bloquea a los
 * modulos cargados por `src=`/`import` externos).
 *
 * Uso:
 *   npm run build:visor
 *   # luego abre visor-standalone.html con doble clic
 *
 * Los modelos FBX del minero tambien se convierten a data URLs y quedan incluidos
 * dentro del HTML, de modo que el resultado no depende de /models ni de ningun
 * otro archivo del proyecto.
 */

import esbuild from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz      = __dirname;

const ENTRADA      = resolve(raiz, 'src/visor/visor.js');
const HTML_FUENTE  = resolve(raiz, 'visor.html');
const HTML_SALIDA  = resolve(raiz, 'visor-standalone.html');
const FBX_RUNNING  = resolve(raiz, 'public/models/running.fbx');
const FBX_WALK     = resolve(raiz, 'public/models/walk.fbx');

// Etiqueta <script> del HTML original que carga el modulo por ruta absoluta.
const TAG_MODULO = '<script type="module" src="/src/visor/visor.js"></script>';

async function main() {
  console.log('· Empaquetando el visor con esbuild (Three.js incluido)…');

  // FBXLoader puede leer data URLs. Al sustituir las dos rutas durante el bundle,
  // tanto la malla como las animaciones quedan fisicamente dentro del HTML final.
  const [runningBytes, walkBytes] = await Promise.all([
    readFile(FBX_RUNNING),
    readFile(FBX_WALK)
  ]);
  const runningDataUrl = `data:application/octet-stream;base64,${runningBytes.toString('base64')}`;
  const walkDataUrl = `data:application/octet-stream;base64,${walkBytes.toString('base64')}`;

  const embedFbxPlugin = {
    name: 'embed-fbx-en-html',
    setup(build) {
      build.onLoad({ filter: /[\\/]src[\\/]elementos[\\/]personas[\\/]minero\.js$/ }, async (args) => {
        let contents = await readFile(args.path, 'utf8');
        const runningPath = "'/models/running.fbx'";
        const walkPath = "'/models/walk.fbx'";

        if (!contents.includes(runningPath) || !contents.includes(walkPath)) {
          throw new Error('No se encontraron las rutas FBX esperadas en minero.js.');
        }

        contents = contents
          .replace(runningPath, JSON.stringify(runningDataUrl))
          .replace(walkPath, JSON.stringify(walkDataUrl));

        return { contents, loader: 'js' };
      });
    }
  };

  const bundle = await esbuild.build({
    entryPoints: [ENTRADA],
    bundle: true,
    format: 'esm',        // se inyecta como <script type="module"> inline
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    write: false,         // queremos el resultado en memoria, no en disco
    logLevel: 'warning',
    plugins: [embedFbxPlugin],
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  const js = bundle.outputFiles[0].text;
  const kb = (Buffer.byteLength(js, 'utf8') / 1024).toFixed(0);
  console.log(`· Bundle generado: ${kb} KB de JavaScript.`);

  let html = await readFile(HTML_FUENTE, 'utf8');

  // El standalone SI funciona bajo file://, asi que se elimina la guardia que
  // visor.html muestra en ese protocolo (delimitada por marcadores).
  html = html.replace(
    /\/\/ \[FILE_GUARD_START\][\s\S]*?\/\/ \[FILE_GUARD_END\]\n?/,
    ''
  );

  if (!html.includes(TAG_MODULO)) {
    throw new Error(
      `No se encontro la etiqueta de script esperada en visor.html:\n  ${TAG_MODULO}\n` +
      'Actualiza la constante TAG_MODULO en build-visor.mjs si cambiaste visor.html.'
    );
  }

  // El enlace "Volver al simulador" (href="/") no tiene sentido bajo file://; se
  // neutraliza para que no lleve a la raiz del disco.
  html = html.replace(
    'href="/">← Volver al simulador',
    'href="#" onclick="return false" style="opacity:.4;cursor:default">Simulador (requiere servidor)'
  );

  // Reemplaza la carga externa del modulo por el bundle inline. Se escapa la
  // secuencia </script> por si apareciera dentro de algun string del bundle.
  const inline = `<script type="module">\n${js.replace(/<\/script>/gi, '<\\/script>')}\n</script>`;
  // IMPORTANTE: el reemplazo se pasa como FUNCION, no como string. El bundle
  // minificado contiene secuencias como `$&`, `$'` o `` $` `` que
  // String.prototype.replace interpretaria como patrones especiales (insertando
  // la coincidencia, el texto previo/posterior, etc.) y corromperia el JS. Una
  // funcion devuelve el texto literal, sin interpretar ningun `$`.
  html = html.replace(TAG_MODULO, () => inline);

  // Verificacion defensiva: el archivo entregable no debe conservar referencias
  // HTML ni rutas de los dos recursos que acabamos de incorporar.
  const referenciasExternas = [
    /<script\b[^>]*\bsrc\s*=/i,
    /<link\b[^>]*\bhref\s*=/i,
    /<img\b[^>]*\bsrc\s*=/i,
    /['"]\/models\/(?:running|walk)\.fbx['"]/i
  ];
  if (referenciasExternas.some((patron) => patron.test(html))) {
    throw new Error('El HTML generado todavia contiene una dependencia externa.');
  }

  // Aviso visible en el <title> y un comentario para dejar claro que es generado.
  html = html.replace(
    '<title>Visualizador de Elementos — Mina Subterránea</title>',
    '<title>Visualizador de Elementos — Mina Subterránea (autocontenido)</title>\n' +
    '  <!-- ARCHIVO GENERADO por build-visor.mjs. No editar a mano: regenerar con `npm run build:visor`. -->'
  );

  await writeFile(HTML_SALIDA, html, 'utf8');

  const totalKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  console.log(`✓ Listo: visor-standalone.html (${totalKb} KB)`);
  console.log('  Abrelo con doble clic — no necesita servidor.');
}

main().catch((err) => {
  console.error('✗ Error generando el visor autocontenido:');
  console.error(err.message || err);
  process.exit(1);
});
