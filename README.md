# Nederland Nieuws Vandaag

Een snelle, statische web-app die het belangrijkste actuele Nederlandse nieuws per categorie toont. Gebouwd rond de officiële RSS-feeds van de NOS.

Live: **https://josbus1961.github.io/nl-nieuws-app/**

## Categorieën

- **Hoogtepunten** — de twee nieuwste berichten per categorie, samengevoegd op tijdstip
- **Algemeen**, **Binnenland**, **Buitenland**, **Economie**, **Sport**, **Cultuur & Media**, **Tech & Wetenschap**
- **Bewaard** — door jou opgeslagen artikelen (lokaal in de browser)

## Hoe het verversen werkt

1. Een GitHub Action (`nieuws.yml`) haalt **elke 30 minuten** de NOS-feeds op en schrijft het resultaat als `data/nieuws.json` in deze repository.
2. De site leest dat bestand van haar eigen domein — geen CORS-problemen, geen externe diensten nodig.
3. Bij het openen haalt de app altijd de laatste `nieuws.json` op; is die ouder dan 3 uur (of afwezig), dan probeert hij het live via publieke CORS-proxies als noodval.
4. Bij een nieuwe dag wordt de cache doorververst; de rode **Verversen**-knop haalt altijd opnieuw op.

## Lokaal draaien

Geen build-stap nodig:

```bash
python3 -m http.server 8080
```

ga dan naar http://localhost:8080. (Wil je lokaal verse data? Run `node scripts/haal-nieuws.mjs`.)

## Technisch

- Pure HTML/CSS/JS, geen dependencies en geen server.
- `scripts/haal-nieuws.mjs` parseert de NOS-RSS met een kleine regex-parser en schrijft een compacte JSON (7 feeds × 25 items).
- Gewijzigde data wordt door de Action automatisch gecommit; de Pages-build publiceert dan ~1 minuut later de nieuwe inhoud.
- Bewaarde artikelen en het donkere thema staan in `localStorage`.
