const FEEDS = [
  { id: "algemeen", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  { id: "binnenland", url: "https://feeds.nos.nl/nosnieuwsbinnenland" },
  { id: "buitenland", url: "https://feeds.nos.nl/nosnieuwsbuitenland" },
  { id: "economie", url: "https://feeds.nos.nl/nosnieuwseconomie" },
  { id: "sport", url: "https://feeds.nos.nl/nossportalgemeen" },
  { id: "cultuur", url: "https://feeds.nos.nl/nosnieuwscultuurenmedia" },
  { id: "tech", url: "https://feeds.nos.nl/nosnieuwstech" }
];

const MAX_PER_FEED = 25;

function cdata(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function taginhoud(itemXml, tag) {
  const m = itemXml.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">"));
  return m ? cdata(m[1]) : "";
}

function parseFeed(xml) {
  const items = [];
  const re = /<item[ >]([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < MAX_PER_FEED) {
    const blok = m[1];
    const titel = cdata((blok.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
    let link = cdata((blok.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || "");
    if (!link) {
      const cdataLink = blok.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdataLink) link = cdataLink[1].trim();
    }
    const ruweDatum = cdata((blok.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    const samenvatting = cdata((blok.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || "");
    if (!titel || !link) continue;
    let iso = "";
    if (ruweDatum) {
      const d = new Date(ruweDatum);
      if (!isNaN(d)) iso = d.toISOString();
    }
    items.push({ titel, link, samenvatting, datum: iso, bron: "NOS" });
  }
  return items;
}

const feeds = {};
for (const feed of FEEDS) {
  try {
    const r = await fetch(feed.url, { headers: { "User-Agent": "nl-nieuws-app/1.0 (GitHub Actions)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const items = parseFeed(await r.text());
    if (!items.length) throw new Error("geen items geparseerd");
    feeds[feed.id] = items;
    console.log(feed.id, "OK", items.length);
  } catch (e) {
    console.error(feed.id, "FOUT", e.message);
    if (feeds[feed.id] === undefined) feeds[feed.id] = [];
  }
}

const json = {
  gegenereerd: new Date().toISOString(),
  bron: "https://feeds.nos.nl/",
  feeds
};

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
mkdirSync("data", { recursive: true });
const pad = "data/nieuws.json";
if (existsSync(pad)) {
  try {
    const oud = JSON.parse(readFileSync(pad, "utf8"));
    if (oud.gegenereerd === json.gegenereerd) {
      console.log("ongewijzigd");
    }
  } catch (e) { /* herschrijven */ }
}
writeFileSync(pad, JSON.stringify(json, null, 1) + "\n");
console.log("geschreven:", pad, "| feeds:", Object.keys(feeds).join(","), "| totaal items:", Object.values(feeds).reduce((a, b) => a + b.length, 0));
