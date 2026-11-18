# Fichas de registro sonoro · Buenos Aires

App web, que también se puede instalar en el teléfono, para registrar en terreno el paisaje sonoro de Buenos Aires. Es parte del Proyecto de Visualización del Grupo 2 (Taller de Diseño de Servicios, e[ad] PUCV), en la Travesía Coordenadas Portuarias 26.

Funciona sin conexión. Hay que abrir el link una vez con internet; después de eso la app queda guardada en el teléfono.

## Páginas

| Archivo | Contenido |
|---|---|
| `index.html` | Inicio: tipos de ficha, registros agrupados por lugar, respaldo y exportación |
| `ficha-sonora.html` | 01 Ficha de observación sonora (con cronómetro de 10 min) |
| `ficha-actividades.html` | 02 Registro de actividades humanas (conteo por intervalos de 2 min) |
| `cartografia.html` | 03 Cartografía sonora y espacial (croquis interactivo) |
| `guia.html` | Guía y procedimiento |

## Datos

- Todo se guarda en el navegador de cada teléfono (IndexedDB) a medida que se escribe. Las fotos se comprimen antes de guardarse.
- **Respaldo completo (.json)**: incluye todas las fichas, fotos y croquis. Sirve para juntar los datos del grupo con *Importar respaldo*.
- **Tabla general (CSV)**: una fila por registro (código), compatible con la tabla de Valparaíso.
- Además hay CSV de fuentes, conteos y cartografía.

## Publicar con GitHub Pages

1. Sube estos archivos a la raíz del repositorio `fichas-sonoras-ba`.
2. En GitHub, entra a **Settings → Pages → Build and deployment**. En *Source* elige *Deploy from a branch*, selecciona la rama `main` y la carpeta `/ (root)`, y guarda.
3. En uno o dos minutos la app queda en `https://<usuario>.github.io/fichas-sonoras-ba/`.

## Actualizar

Cada vez que cambies archivos, sube el número de `VERSION` en `sw.js` (por ejemplo `fichas-ba-v2`). Los teléfonos reciben la nueva versión la segunda vez que abren la app con conexión. Los registros guardados no se pierden al actualizar.
