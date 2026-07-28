# Triangulador XYZ

Abre `index.html` en el navegador y usa **Importar puntos XYZ**. La aplicación acepta archivos CSV y XLSX en dos formatos:

- nube de puntos con una columna X, una Y y una Z;
- wireframe con un triángulo por fila y columnas `XP1,YP1,ZP1,XP2,YP2,ZP2,XP3,YP3,ZP3`.

Después de abrir el archivo:

1. Selecciona la hoja si el XLSX contiene varias.
2. Asigna una columna diferente a cada eje X, Y y Z.
3. Comprueba la vista previa y pulsa **Graficar superficie**.

Las tres asignaciones empiezan vacías: el usuario debe escoger manualmente una columna diferente para X, Y y Z. Los archivos se procesan localmente en el navegador.

La carpeta `elementos/` contiene 34 labores trackless a escala 1:1, generadas según
`.claude/commands/mina-3d-trackless.md`. El archivo
`elementos/galeria_wireframe_simulada.csv` es la galería curva de alta densidad;
incluye perfil herradura de 4.5 × 4.5 m, cuneta, sostenimiento, ventilación y
servicios. Sus paredes usan facetas de roca volada, sobreexcavación localizada,
huellas de tránsito y placas de pernos distribuidas de forma irregular. Consulta
`elementos/_catalogo.csv` para revisar las dimensiones de todas las labores.

La mina ensamblada se encuentra en `elementos/_mina_completa.csv`, acompañada por
`elementos/_mina_completa_layout.csv`. Se puede graficar directamente desde la portada
del simulador mediante **VER MINA COMPLETA 3D**.

Para que el botón **Ejemplo local** cargue automáticamente `ejercPT.csv`, inicia un servidor en esta carpeta, por ejemplo:

```powershell
python -m http.server 8080
```

Luego abre `http://localhost:8080`. Al abrir el HTML directamente también funciona la importación manual.
