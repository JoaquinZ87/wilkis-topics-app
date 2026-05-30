# Etiquetado de tópicos — Zelizer / Wilkis 2026

App web para que Wilkis revise los 25 tópicos NMF y les ponga un nombre interpretativo.

## Funcionalidades

- Navegar tópicos con teclado (← →) o con la lista lateral.
- Para cada tópico ver:
  - Top 15 palabras (TF-IDF score) como barras horizontales
  - Cantidad de documentos donde domina
  - Top 5 países donde más aparece como dominante
- Input para **nombre interpretativo** y **notas** opcionales.
- Auto-guarda en `localStorage` mientras escribís.
- Botón **📥 Descargar mis nombres (JSON)** — descarga un JSON con todas las etiquetas.
- Botón **📋 Copiar como tabla Markdown** — copia al portapapeles una tabla lista para pegar en el informe.
- Botón **📤 Subir un JSON previo** — para retomar el trabajo en otro dispositivo o después de borrar el navegador.

## Cómo desplegar en GitHub Pages

```bash
# Desde la raíz del repo
git checkout -b gh-pages
# Asegurate que la carpeta topics_app/ esté commiteada
git push origin gh-pages
```

En GitHub → Settings → Pages → Source: `gh-pages` branch, folder: `/topics_app`.

Después de unos segundos la URL será:
```
https://<tu-usuario>.github.io/<repo>/
```

Si querés que sirva directo desde `main`, configurá Pages con `main` + `/topics_app`.

## Cómo funciona la persistencia

- **Mientras Wilkis escribe**: se guarda en `localStorage` del navegador. Si cierra la pestaña y vuelve, sus etiquetas siguen ahí.
- **Para mandarme los resultados**: hace clic en "📥 Descargar mis nombres (JSON)" y me manda el archivo.
- **Si trabaja en otro dispositivo / otro día**: yo le mando el JSON anterior y él lo sube con "📤 Subir un JSON previo".

GitHub Pages **no permite** guardar datos en el servidor sin un backend. Por eso usamos localStorage + descarga manual.

## Archivos

- `index.html` — UI
- `style.css` — estilos
- `app.js` — lógica (vanilla JS, sin frameworks)
- `topics_data.json` — los 25 tópicos NMF exportados de `analyze_topics_styled.py`

## Re-generar `topics_data.json`

Cada vez que cambien los tópicos, correr desde la raíz del repo:
```bash
python _export_topics_for_app.py
```
