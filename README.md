# Nederland Nieuws Vandaag

Een snelle, statische web-app die het belangrijkste actuele Nederlandse nieuws per categorie toont. Gebouwd rond de officiële RSS-feeds van de NOS.

## Categorieën

- **Hoogtepunten** — de twee nieuwste berichten per categorie, samengevoegd op tijdstip
- **Algemeen**
- **Binnenland**
- **Buitenland**
- **Economie**
- **Sport**
- **Cultuur & Media**
- **Wetenschap**
- **Bewaard** — door jou opgeslagen artikelen (lokaal in de browser)

## Dagelijks verversen

- Bij het openen op een nieuwe dag wordt automatisch vers nieuws opgehaald.
- Handmatig verversen kan altijd via de rode **Verversen**-knop.
- Berichten van dezelfde dag worden lokaal gecached, zodat de app meteen opent.
- Relatieve tijden ("20 minuten geleden") per bericht en een tijdstip van laatste verversing bovenin.

## Gebruik

Geen build-stap nodig. Open `index.html` direct in de browser, of host de map op een statische host (GitHub Pages, Netlify, enz.):

```bash
python3 -m http.server 8080
```

ga dan naar http://localhost:8080.

## Technisch

- Pure HTML/CSS/JS, geen dependencies en geen server.
- De NOS-feeds bieden geen CORS-headers voor browsers; de app probeert eerst direct en valt daarna automatisch terug op publieke CORS-proxies (`allorigins`, `codetabs`, `corsproxy`).
- Artikelen openen op nos.nl; de app zelf toont alleen koppen, samenvattingen en links.
- Bewaarde artikelen en het donkere thema worden in `localStorage` bewaard.
