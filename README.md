# Nederland Nieuws Vandaag

Een snelle, statische web-app met het belangrijkste actuele Nederlandse nieuws per categorie, plus regionaal nieuws voor Zeeland, Brabant, Borsele, Kwadendamme en Roosendaal — en de weersverwachting voor Kwadendamme bovenaan.

Live: **https://josbus1961.github.io/nl-nieuws-app/**

## Categorieën

**Landelijk** (NOS + NU.nl + RTL Nieuws):

- Hoogtepunten — mix van landelijke en regionale koppen op tijdstip
- Algemeen, Binnenland, Buitenland, Economie, Sport, Cultuur & Media, Tech & Wetenschap

**Regionaal:**

- Zeeland — Google Nieuws-aggregatie (PZC, ZeelandNet, Omroep Zeeland, HVZeeland, …)
- Brabant — Omroep Brabant
- Borsele, Kwadendamme, Roosendaal — Google Nieuws-aggregatie

**Weer:**

- Weersverwachting Kwadendamme voor 3 dagen (Open-Meteo API, met icoon, max/min temperatuur, neerslag en wind)

## Hoe het verversen werkt

1. Een GitHub Action (`nieuws.yml`) haalt **elke 30 minuten** alle bronnen op en schrijft het resultaat als `data/nieuws.json` in deze repository.
2. De site leest dat bestand van haar eigen domein — geen CORS-problemen, geen externe proxy-diensten.
3. Bij elke paginalading haalt de app de laatste `nieuws.json` op; het weer wordt max. 30 minuten gecached.
4. De rode **Verversen**-knop haalt alles direct opnieuw op.

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
