# Assets

Esta carpeta aloja los recursos externos (modelos, texturas, audio). **En esta entrega no
hay assets externos**: todo el contenido visual y sonoro se genera por código
(geometría procedural, señalética con `CanvasTexture`, audio sintetizado con WebAudio).
Esto cumple el requisito de *placeholders cuando no existan assets*.

## Estructura sugerida

```
assets/
├── models/    # .glb / .gltf (preferible con compresión DRACO)
├── textures/  # .jpg / .png / .ktx2
└── audio/     # .mp3 / .ogg / .wav
```

## Cómo sustituir placeholders por assets reales

1. Coloca el archivo en la subcarpeta correspondiente.
2. Cárgalo con el `AssetLoader` (ya cablea `GLTFLoader` + `DRACOLoader`):

   ```js
   // dentro de un segmento o prop
   const jumbo = await assets.loadModel('/src/assets/models/jumbo.glb', () => createPlaceholderJumbo());
   group.add(jumbo);
   ```

   Si la carga falla, se usa el placeholder pasado como segundo argumento, de modo que la
   escena nunca queda vacía.

3. Para audio real, usa `AudioManager` + `THREE.PositionalAudio` (ver comentarios en
   `src/audio/AudioManager.js`).

> El decoder DRACO se sirve por CDN por defecto (`AssetLoader.js`). Para uso offline,
> descarga el decoder y apunta `setDecoderPath` a una ruta local dentro de `assets/`.
