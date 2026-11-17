# alriksbilar.se

Hemsidan för YouTube-kanalen Alriks Bilar.

- `index.html` – själva sajten
- `nyheter.json` – dagens bilnyheter (Bilnytt-spalten)
- `podd.json` – senaste avsnitten av Varför? – Därför!
- `videos.json` – reservlista med filmer (den riktiga listan hämtas från YouTube via `/api/videos`)
- `netlify/functions/videos.mjs` – hämtar senaste filmerna från YouTube
- `img/` – bilder och loggor
