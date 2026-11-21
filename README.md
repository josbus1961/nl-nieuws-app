# Nederland Nieuws Vandaag

Een snelle, statische web-app met het belangrijkste actuele Nederlandse nieuws per categorie, plus regionaal nieuws voor Zeeland, Brabant, Borsele, Kwadendamme en Roosendaal — en de weersverwachting voor Kwadendamme bovenaan.

Live: **https://josbus1961.github.io/nl-nieuws-app/**

## Categorieën

**Landelijk** (NOS + NU.nl + RTL Nieuws):

- Alles — alle binnengekomen berichten uit alle categorieën, nieuwste bovenaan (max. 120)
- Algemeen, Binnenland, Buitenland, **Politiek** (NOS), Economie, Sport, Cultuur & Media, Tech & Wetenschap

**Regionaal:**

- Zeeland — Google Nieuws-aggregatie (PZC, ZeelandNet, Omroep Zeeland, HVZeeland, …)
- Brabant — Omroep Brabant
- Borsele, Kwadendamme, Roosendaal — Google Nieuws-aggregatie

**Weer:**

- Weersverwachting Kwadendamme voor 3 dagen (Open-Meteo API, met icoon, max/min temperatuur, neerslag en wind)

## Hoe het verversen werkt

1. Een GitHub Action (`nieuws.yml`) haalt **elke 30 minuten** (op de minuten 7 en 37, met retries per bron) alle bronnen op en schrijft het resultaat als `data/nieuws.json` in deze repository.
2. De site leest dat bestand van haar eigen domein — geen CORS-problemen, geen externe proxy-diensten.
3. Bij elke paginalading haalt de app de laatste `nieuws.json` op; het weer wordt max. 30 minuten gecached.
4. **Live-terugval:** is de `nieuws.json` ouder dan 45 minuten (bijvoorbeeld als de GitHub Action een keer overslaat), dan haalt de app zelf de nieuwste berichten op via de rss2json-API en dedupliceert die tegen de bestaande data (max. 1× per 10 minuten). De statusregel toont dan "(live)".
5. De rode **Verversen**-knop haalt alles direct opnieuw op en triggert ook de live-verversing (ook hier geldt de 10-minuten-rem om de gratis rss2json-quota te ontzien).
6. Is de data langer dan 2 uur oud (zowel de action als de live-verversing mislukt), dan kleurt de statusregel oranje met een leeftijdsaanduiding.

## Lokaal draaien

Geen build-stap nodig:

```bash
python3 -m http.server 8080
```

ga dan naar http://localhost:8080. Verse data genereren kan met `node scripts/haal-nieuws.mjs`.

## Technisch

- Pure HTML/CSS/JS, geen dependencies en geen server.
- `scripts/haal-nieuws.mjs` parseert RSS/Atom met een kleine regex-parser, dedupliceert op link en sorteert op datum (18 bronnen, max. 30 items per categorie).
- Gewijzigde data wordt door de Action automatisch gecommit; de Pages-build publiceert dan ~1 minuut later de nieuwe inhoud.
- Bewaarde artikelen, het donkere thema en de weerscache staan in `localStorage`.
