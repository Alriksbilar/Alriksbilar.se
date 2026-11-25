# alriksbilar.se

Hemsidan för YouTube-kanalen Alriks Bilar.

- `index.html` – själva sajten
- `nyheter.json` – dagens bilnyheter (Bilnytt-spalten)
- `podd.json` – senaste avsnitten av Varför? – Därför!
- `videos.json` – reservlista med filmer (den riktiga listan hämtas från YouTube via `/api/videos`)
- `netlify/functions/videos.mjs` – hämtar senaste filmerna från YouTube
- `img/` – bilder och loggor

## Kontaktformulär

Formuläret "kontakt" hanteras av Netlify Forms. Notiser skickas till alrik.soderlind@icloud.com.

## Nyhetsbrev

Anmälningar går till MailerLite (gruppen "Alriks Bilbrev") via /api/prenumerera. Kräver miljövariabeln MAILERLITE_TOKEN i Netlify. Reservkopia sparas i Netlify Forms ("nyhetsbrev").

## Topplistor och spellistor

/api/topplistor läser kanalen via YouTube Data API (miljövariabeln YOUTUBE_API_KEY). Funktionen kanal-dagligen sparar visningssiffror varje natt för veckans och månadens mest sedda.

## Krediter hos Netlify

Varje publicering kostar krediter. Därför läses `nyheter.json`, `podd.json` och `poll.json` direkt från GitHub via `/api/innehall/<fil>`, och `netlify.toml` hoppar över publicering när bara de filerna (eller README) ändrats. Samla design- och kodändringar i färre publiceringar.

## Artiklar

Nya artiklar läggs in i `artiklar.json` (slug, rubrik, ingress, datum, kategori, bild). Då får de automatiskt ett kort på /artiklar/, en knapp i kategorifiltret (länkbar som /artiklar/?kategori=Trippeltest) och visas under "Läs också" i andra artiklar (`js/relaterat.js`). Ange gärna `marken` (t.ex. ["Volvo","Polestar"]) och `amnen` (t.ex. ["elbil","SUV","Kina"]) för varje artikel – rutan visar då de mest närliggande först: samma märke ger 3 poäng, samma ämne 1, samma kategori 1, lika poäng ger nyast först. Saknas `marken` letas kända märken upp i rubrik och ingress. Ny artikelsida behöver `<div class="relaterat" id="relaterat"></div>` efter `.slut` och `<script src="/js/relaterat.js" defer></script>`.

## Google (SEO)

Efter att en ny artikel lagts in i `artiklar.json`: kör `python3 verktyg/seo.py`. Skriptet uppdaterar `sitemap.xml` och den strukturerade datan (JSON-LD) för artikel, film och brödsmulor på alla sidor. Valfria fält i `artiklar.json`: `uppdaterad` (datum då artikeln ändrats) och `filmdatum` (filmens publiceringsdatum på YouTube, annars används `datum`).

## Veckans nya bil

Rutan "Veckans nya bil" på startsidan läser `veckansbil.json` via `/api/innehall/veckansbil` – uppdateras utan ny publicering hos Netlify (filen är undantagen i `netlify.toml`). Rutan syns bara när `"publicerad": true`. Fält: vecka, datum, marke, modell, rubrik, ingress, text (stycken separerade med tom rad), fakta [{etikett, varde}], vadBetyder, alriksRad, bild (officiell pressbild-URL eller /img/...), bildkalla, kallor [{namn, url}], tidigare [{vecka, datum, marke, modell, rubrik}]. Utkastet tas fram av den schemalagda uppgiften på onsdagar och publiceras först när Alrik godkänt.
