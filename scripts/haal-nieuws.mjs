const BRONNEN = [
  { cat: "algemeen", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  { cat: "algemeen", bron: "NU.nl", url: "https://www.nu.nl/rss/Algemeen" },
  { cat: "algemeen", bron: "RTL Nieuws", url: "https://www.rtlnieuws.nl/rss.xml" },
  { cat: "binnenland", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwsbinnenland" },
  { cat: "binnenland", bron: "NU.nl", url: "https://www.nu.nl/rss/Binnenland" },
  { cat: "buitenland", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwsbuitenland" },
  { cat: "buitenland", bron: "NU.nl", url: "https://www.nu.nl/rss/Buitenland" },
  { cat: "economie", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwseconomie" },
  { cat: "economie", bron: "NU.nl", url: "https://www.nu.nl/rss/Economie" },
  { cat: "sport", bron: "NOS", url: "https://feeds.nos.nl/nossportalgemeen" },
  { cat: "sport", bron: "NU.nl", url: "https://www.nu.nl/rss/Sport" },
  { cat: "cultuur", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwscultuurenmedia" },
  { cat: "tech", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwstech" },
  { cat: "zeeland", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Zeeland+nieuws&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "brabant", bron: "Omroep Brabant", url: "https://www.omroepbrabant.nl/rss" },
  { cat: "borsele", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Borsele&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "kwadendamme", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Kwadendamme&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "roosendaal", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Roosendaal+nieuws&hl=nl&gl=NL&ceid=NL:nl" }
];

const MAX_PER_CAT = 30;

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

function schoonTitel(titel) {
  const idx = titel.lastIndexOf(" - ");
  if (idx > 20 && titel.length - idx <= 45) return titel.slice(0, idx).trim();
  return titel;
}

function haalFoto(blok) {
  const enclosure = blok.match(/<enclosure[^>]*(?:type="image[^"]*"|type="image\/[^"]*")[^>]*url="([^"]+)"|<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/);
  if (enclosure) return (enclosure[1] || enclosure[2]);
  const media = blok.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/);
  if (media) return media[1];
  return "";
}

function normaliseerTitel(t) {
  return (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a, b) {
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  let snit = 0;
  for (const w of ta) if (tb.has(w)) snit++;
  return snit / (ta.size + tb.size - snit);
}

function isDubbel(a, b) {
  const na = a.normalized;
  const nb = b.normalized;
  if (na === nb) return true;
  if (na.length >= 25 && nb.length >= 25 && (na.includes(nb) || nb.includes(na))) return true;
  if (taSize(na) + taSize(nb) === 0) return false;
  const gelijkenis = jaccard(na, nb);
  if (a.bron !== b.bron) return gelijkenis >= 0.6 || (gelijkenis >= 0.5 && gedeeldeZeldzameWoorden(a, b));
  return gelijkenis >= 0.7;
}

const STOPWOORDEN = new Set(["de","het","een","en","van","in","op","uit","met","voor","te","dat","dan","bij","naar","over","na","door"]);
function gedeeldeZeldzameWoorden(a, b) {
  const wa = new Set(a.normalized.split(" ").filter(w => w.length >= 5 && !STOPWOORDEN.has(w)));
  const wb = new Set(b.normalized.split(" ").filter(w => w.length >= 5 && !STOPWOORDEN.has(w)));
  let zelfde = 0;
  for (const w of wa) if (wb.has(w)) zelfde++;
  return zelfde >= 2;
}

const tokenCache = new Map();
function taSize(n) {
  if (!tokenCache.has(n)) tokenCache.set(n, n.split(" ").filter(Boolean).length);
  return tokenCache.get(n);
}

function dedupliceer(items) {
  const gehouden = [];
  const verwijderen = new Set();
  const gesorteerd = [...items].sort((a, b) => {
    if (!!b.foto !== !!a.foto) return b.foto ? 1 : -1;
    return new Date(b.datum) - new Date(a.datum);
  });
  for (let i = 0; i < gesorteerd.length; i++) {
    if (verwijderen.has(i)) continue;
    for (let j = i + 1; j < gesorteerd.length; j++) {
      if (verwijderen.has(j)) continue;
      if (isDubbel(gesorteerd[i], gesorteerd[j])) verwijderen.add(j);
    }
  }
  gesorteerd.forEach((it, i) => { if (!verwijderen.has(i)) gehouden.push(it); });
  return gehouden;
}


function stripTags(html) {
  return cdata(html)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function parseAtomOfRss(xml, bron) {
  const isAtom = /<feed[\s>]/i.test(xml);
  const sep = isAtom ? "entry" : "item";
  const items = [];
  const re = new RegExp("<" + sep + "[ >]([\\s\\S]*?)</" + sep + ">", "g");
  let m;
  while ((m = re.exec(xml)) && items.length < MAX_PER_CAT * 2) {
    const blok = m[1];
    let titel = taginhoud(blok, "title");
    if (!titel) continue;
    if (bron === "Google Nieuws") titel = schoonTitel(titel);
    let link = "";
    if (isAtom) {
      const lm = blok.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/) ||
        blok.match(/<link[^>]*href=["']([^"']+)["']/);
      link = lm ? lm[1] : "";
    } else {
      link = taginhoud(blok, "link");
      if (!link) {
        const cd = blok.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/);
        if (cd) link = cd[1].trim();
      }
    }
    const ruweDatum = taginhoud(blok, "pubDate") || taginhoud(blok, "published") || taginhoud(blok, "updated");
    let iso = "";
    if (ruweDatum) {
      const d = new Date(ruweDatum);
      if (!isNaN(d)) iso = d.toISOString();
    }
    const samenvatting = bron === "Google Nieuws" ? "" : stripTags(taginhoud(blok, "description"));
    if (!link) continue;
    items.push({ titel: titel, normalized: normaliseerTitel(titel), link, samenvatting, datum: iso, bron, foto: haalFoto(blok) });
  }
  return items;
}

const categorieen = {};
for (const b of BRONNEN) {
  try {
    const r = await fetch(b.url, { headers: { "User-Agent": "nl-nieuws-app/1.0 (GitHub Actions)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const xml = await r.text();
    const items = parseAtomOfRss(xml, b.bron);
    if (!items.length) throw new Error("geen items");
    categorieen[b.cat] = categorieen[b.cat] || [];
    categorieen[b.cat].push(...items);
    console.log(b.cat.padEnd(13), b.bron.padEnd(15), items.length);
  } catch (e) {
    console.error(b.cat.padEnd(13), b.bron.padEnd(15), "FOUT", e.message);
  }
}

const feeds = {};
for (const [cat, lijst] of Object.entries(categorieen)) {
  feeds[cat] = dedupliceer(lijst).slice(0, MAX_PER_CAT);
  console.log("==", cat, "totaal:", feeds[cat].length);
}

const json = {
  gegenereerd: new Date().toISOString(),
  bron: "diverse (NOS, NU.nl, RTL Nieuws, Omroep Brabant, Google Nieuws)",
  feeds
};

import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("data", { recursive: true });
writeFileSync("data/nieuws.json", JSON.stringify(json, null, 1) + "\n");
console.log("geschreven:", "data/nieuws.json", "| cats:", Object.keys(feeds).join(","), "| totaal items:",
  Object.values(feeds).reduce((a, b) => a + b.length, 0));
