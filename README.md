# Mi Recetario

**Sencillo. Casero. Bueno.** Web personal de recetas: se filtran por sección, categoría y «apto para» (sin gluten, sin lactosa, vegano…), y tiene cuatro juegos hechos con las propias recetas, con los ingredientes modelados en 3D.

Es una web estática (HTML, CSS y JavaScript, sin servidor) publicada con GitHub Pages.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `index.html` | Portada, la carta, listado con filtros, ficha de receta y juegos (una sola página con rutas `#receta-…` y `#juego-…`) |
| `data/recetas.json` | Todas las recetas. Es lo único que hay que tocar para añadir una |
| `fotos/` | Fotos de los platos, en WebP de 1200 px, con el nombre de la receta |
| `js/reglas.js` | Módulo de reglas dietéticas: calcula las etiquetas a partir de los ingredientes |
| `js/app.js` | Listado, filtros, ficha y rutas |
| `js/juegos.js` | Adivina la receta, ¿Es apto?, Memory y La cesta de la compra (escena 3D) |
| `js/modelos.js` | Ingredientes en 3D hechos con three.js (tomate, huevo, gambas, botellas…). Para un ingrediente nuevo, se añade su palabra clave en `REGLAS` |
| `js/vendor/` | three.js 0.170 (licencia MIT), incluido para no depender de ningún CDN |
| `css/estilos.css` | Paleta, tipografía y componentes |

## Añadir una receta

Añade un objeto a `data/recetas.json`. Las etiquetas «apto para» **no se escriben**: las calcula `js/reglas.js`.

```json
{
  "id": "merluza-salsa-verde",
  "nombre": "Merluza en salsa verde",
  "seccion": "Comidas",
  "categoria": "Pescado y marisco",
  "raciones": 4,
  "tiempo_preparacion_min": 15,
  "tiempo_marinado_h": 6,
  "tiempo_coccion_min": 20,
  "dificultad": "Media",
  "fecha_hecha": "2026-11-23",
  "foto": "merluza-salsa-verde.webp",
  "ingredientes": [
    { "cantidad": "4 lomos", "nombre": "merluza", "tipo": "pescado", "contiene": ["pescado"], "trazas": [] }
  ],
  "pasos": ["Salar los lomos."],
  "notas": "Con harina de arroz queda igual y es sin gluten."
}
```

- `seccion`: `Comidas` o `Postres`. `categoria`: nombre exacto de la lista de `CATEGORIAS` en `js/reglas.js`.
- `tipo`: `vegetal`, `lacteo`, `huevo`, `miel`, `pescado`, `marisco` o `carne`.
- `contiene` y `trazas`: alérgenos de la UE (`gluten`, `lactosa`, `huevo`, `frutos_secos`, `pescado`, `moluscos`, `crustaceos`, `soja`, `cacahuetes`, `apio`, `mostaza`, `sesamo`, `sulfitos`, `altramuces`).
- `foto`: nombre del archivo en `fotos/`, o `null`.
- `tiempo_marinado_h`: opcional, horas de marinado (no cuentan en el tiempo de la tarjeta, se muestran aparte).

Las recetas con `"ejemplo": true` son de prueba y se borran cuando llegan las reales.

## Probar en local

```bash
python3 -m http.server 8000
```

y abrir http://localhost:8000 (abrir `index.html` directamente no funciona porque el navegador bloquea la carga del JSON).
