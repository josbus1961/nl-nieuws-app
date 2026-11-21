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

1. De workflow `nieuws.yml` (Action "Haal nieuws op") haalt alle bronnen op en schrijft het resultaat als `data/nieuws.json` in deze repository. Dit is een **zelf doorrijvende keten**: na elke run pauzeert de Action ±25 minuten en start zichzelf daarna opnieuw op (via `workflow_dispatch` met zijn eigen runner-token). Zo is de verversing niet afhankelijk van de op GitHub berucht onbetrouwbare cron-schema's.
2. **Eénmalig starten:** op de [Actions-pagina](https://github.com/josbus1961/nl-nieuws-app/actions/workflows/nieuws.yml) één keer op **Run workflow** klikken. Daarna blijft de keten zelf doorlopen en is de data normaliter nooit ouder dan ±30 minuten. Mislukt een stap (bijvoorbeeld het ophalen), dan blijft de keten wél bestaan: de start-stap voor de volgende run draait altijd.
3. De site leest `nieuws.json` van haar eigen domein — geen CORS-problemen, geen externe proxy-diensten.
4. Bij elke paginalading haalt de app de laatste `nieuws.json` op; het weer wordt max. 30 minuten gecached. De app ververst ook automatisch elke 10 minuten én zodra je terugkeert in het tabblad.
5. **Live-terugval:** is de `nieuws.json` ouder dan 45 minuten, dan haalt de app zelf de nieuwste berichten op via de rss2json-API (sequentieel en geprioriteerd, met 429-retry en vroege stop bij quotum) en dedupliceert die tegen de bestaande data. De statusregel toont dan "(live)".
6. De rode **Verversen**-knop haalt alles direct opnieuw op en triggert ook de live-verversing (met een 10-minuten-rem om de gratis rss2json-quota te ontzien).
7. Is de data langer dan 2 uur oud (zowel de keten als de live-verversing mislukt), dan kleurt de statusregel oranje met een leeftijdsaanduiding. Start dan de keten opnieuw via stap 2.

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
