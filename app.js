"use strict";

const FEEDS = [
  { id: "alles", label: "Alles", special: true },
  { id: "algemeen", label: "Algemeen" },
  { id: "binnenland", label: "Binnenland" },
  { id: "buitenland", label: "Buitenland" },
  { id: "politiek", label: "Politiek" },
  { id: "economie", label: "Economie" },
  { id: "sport", label: "Sport" },
  { id: "cultuur", label: "Cultuur & Media" },
  { id: "tech", label: "Tech & Wetenschap" },
  { id: "zeeland", label: "Zeeland", regio: true },
  { id: "brabant", label: "Brabant", regio: true },
  { id: "borsele", label: "Borsele", regio: true },
  { id: "kwadendamme", label: "Kwadendamme", regio: true },
  { id: "roosendaal", label: "Roosendaal", regio: true },
  { id: "bewaard", label: "Bewaard", special: true }
];

const WEER_URL = "https://api.open-meteo.com/v1/forecast?latitude=51.4732&longitude=4.036" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
  "&timezone=Europe%2FAmsterdam&forecast_days=3";
const WEER_CACHE_KEY = "nl-nieuws-weer-v1";
const WEER_CACHETIJD = 30 * 60 * 1000;

const CACHE_KEY = "nl-nieuws-cache-v1";
const BEWAARD_KEY = "nl-nieuws-bewaard-v1";
const THEMA_KEY = "nl-nieuws-thema";
const MAX_PER_FEED = 25;
const TOP_MARKERINGEN = 3;

const RSS2JSON_URL = "https://api.rss2json.com/v1/api.json?rss_url=";
const LIVE_CACHE_KEY = "nl-nieuws-live-v1";
const LIVE_STALE_TIJD = 45 * 60 * 1000;
const LIVE_CACHE_TIJD = 10 * 60 * 1000;

const LIVE_BRONNEN = [
  { cat: "algemeen", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  { cat: "binnenland", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwsbinnenland" },
  { cat: "buitenland", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwsbuitenland" },
  { cat: "zeeland", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Zeeland+nieuws&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "kwadendamme", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Kwadendamme&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "brabant", bron: "Omroep Brabant", url: "https://www.omroepbrabant.nl/rss" },
  { cat: "roosendaal", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Roosendaal+nieuws&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "sport", bron: "NOS", url: "https://feeds.nos.nl/nossportalgemeen" },
  { cat: "politiek", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwspolitiek" },
  { cat: "borsele", bron: "Google Nieuws", url: "https://news.google.com/rss/search?q=Borsele&hl=nl&gl=NL&ceid=NL:nl" },
  { cat: "algemeen", bron: "NU.nl", url: "https://www.nu.nl/rss/Algemeen" },
  { cat: "binnenland", bron: "NU.nl", url: "https://www.nu.nl/rss/Binnenland" },
  { cat: "buitenland", bron: "NU.nl", url: "https://www.nu.nl/rss/Buitenland" },
  { cat: "economie", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwseconomie" },
  { cat: "sport", bron: "NU.nl", url: "https://www.nu.nl/rss/Sport" },
  { cat: "economie", bron: "NU.nl", url: "https://www.nu.nl/rss/Economie" },
  { cat: "cultuur", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwscultuurenmedia" },
  { cat: "tech", bron: "NOS", url: "https://feeds.nos.nl/nosnieuwstech" },
  { cat: "algemeen", bron: "RTL Nieuws", url: "https://www.rtlnieuws.nl/rss.xml" }
];

const AUTO_VERFRIS_TIJD = 10 * 60 * 1000;

const staat = {
  tab: "alles",
  feeds: {},
  fouten: {},
  verversedOp: null,
  laadt: false,
  liveBezig: false,
  live: false,
  zoek: ""
};

const el = id => document.getElementById(id);

function vandaag() {
  return new Date().toISOString().slice(0, 10);
}

function laadCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (data && data.feeds) return data;
  } catch (e) { /* oude cache negeren */ }
  return null;
}

function slaCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      datum: vandaag(),
      verversedOp: staat.verversedOp,
      feeds: staat.feeds,
      fouten: staat.fouten
    }));
  } catch (e) { /* opslag vol of geblokkeerd */ }
}

function laadBewaard() {
  try {
    return JSON.parse(localStorage.getItem(BEWAARD_KEY) || "[]");
  } catch (e) { return []; }
}

function slaBewaard(lijst) {
  try {
    localStorage.setItem(BEWAARD_KEY, JSON.stringify(lijst));
  } catch (e) { /* opslag vol */ }
}

function isBewaard(item) {
  return laadBewaard().some(b => b.link === item.link);
}

function wisselBewaar(item) {
  const lijst = laadBewaard();
  const idx = lijst.findIndex(b => b.link === item.link);
  if (idx >= 0) lijst.splice(idx, 1);
  else lijst.unshift({ titel: item.titel, link: item.link, samenvatting: item.samenvatting, datum: item.datum, bron: item.bron, categorieLabel: item.categorieLabel, foto: item.foto });
  slaBewaard(lijst);
  return idx < 0;
}

function relatieveTijd(iso) {
  if (!iso || isNaN(new Date(iso))) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  const fmt = new Intl.RelativeTimeFormat("nl", { numeric: "auto" });
  if (Math.abs(min) < 60) return fmt.format(-min, "minute");
  const uur = Math.round(min / 60);
  if (Math.abs(uur) < 24) return fmt.format(-uur, "hour");
  return fmt.format(-Math.round(uur / 24), "day");
}

function flexTijd(iso) {
  if (!iso || isNaN(new Date(iso))) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function stripHtml(html) {
  const t = document.createElement("textarea");
  t.innerHTML = html || "";
  return (t.value || "").replace(/\s+/g, " ").trim();
}

function weerOmschrijving(code) {
  if (code === 0) return ["☀️", "Zonnig"];
  if (code === 1) return ["🌤️", "Licht bewolkt"];
  if (code === 2) return ["⛅", "Half bewolkt"];
  if (code === 3) return ["☁️", "Bewolkt"];
  if (code === 45 || code === 48) return ["🌫️", "Mist"];
  if (code >= 51 && code <= 57) return ["🌦️", "Motregen"];
  if (code >= 61 && code <= 67) return ["🌧️", "Regen"];
  if (code >= 71 && code <= 77) return ["❄️", "Sneeuw"];
  if (code >= 80 && code <= 82) return ["🌧️", "Buien"];
  if (code === 85 || code === 86) return ["🌨️", "Sneeuwbuien"];
  if (code >= 95) return ["⛈️", "Onweer"];
  return ["🌡️", "Weer"];
}

function dagLabelW(i, iso) {
  if (i === 0) return "Vandaag";
  if (i === 1) return "Morgen";
  const d = new Date(iso);
  if (isNaN(d)) return "Dag " + (i + 1);
  const naam = new Intl.DateTimeFormat("nl-NL", { weekday: "long" }).format(d);
  return naam.charAt(0).toUpperCase() + naam.slice(1);
}

async function laadWeer() {
  let data = null;
  try {
    const c = JSON.parse(localStorage.getItem(WEER_CACHE_KEY) || "null");
    if (c && Date.now() - c.tijd < WEER_CACHETIJD && c.daily) data = c.daily;
  } catch (e) { /* oude cache negeren */ }

  if (!data) {
    const antwoord = await fetch(WEER_URL, { cache: "no-store" });
    if (!antwoord.ok) throw new Error("HTTP " + antwoord.status);
    const j = await antwoord.json();
    if (!j.daily) throw new Error("geen weerdata");
    data = j.daily;
    try { localStorage.setItem(WEER_CACHE_KEY, JSON.stringify({ tijd: Date.now(), daily: data })); } catch (e) { /* opslag vol */ }
  }

  const balk = el("weerbalk");
  balk.hidden = false;
  const rij = [0, 1, 2].map(i => {
    const icoOmschr = weerOmschrijving(data.weather_code[i]);
    const neerslag = (data.precipitation_sum[i] || 0).toFixed(1);
    const wind = Math.round(data.wind_speed_10m_max[i] || 0);
    return '<div class="weer-dag">' +
      '<div class="weer-dagnaam">' + escapeHtml(dagLabelW(i, data.time[i])) + "</div>" +
      '<div class="weer-icoon">' + icoOmschr[0] + "</div>" +
      '<div class="weer-tekst">' + escapeHtml(icoOmschr[1]) + "</div>" +
      '<div class="weer-temp"><strong>' + Math.round(data.temperature_2m_max[i]) + "°</strong> / " + Math.round(data.temperature_2m_min[i]) + "°</div>" +
      '<div class="weer-extra">💧 ' + neerslag + " mm · 💨 " + wind + " km/h</div>" +
    "</div>";
  }).join("");
  balk.innerHTML =
    '<div class="weer-kop">🌦️ Weersverwachting Kwadendamme <span class="weer-bron">– Open-Meteo</span></div>' +
    '<div class="weer-rij">' + rij + "</div>";
}

function eigenNieuwsJson(ruw) {
  if (!ruw) return null;
  const t = ruw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const j = JSON.parse(t);
    if (j.feeds && typeof j.feeds === "object") return j;
  } catch (e) { /* ongeldig json, negeren */ }
  return null;
}

function decodeEntities(s) {
  const t = document.createElement("textarea");
  t.innerHTML = s || "";
  return t.value;
}

function maakSamenvatting(html) {
  return decodeEntities(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function schoonGoogleTitel(titel) {
  const idx = titel.lastIndexOf(" - ");
  if (idx > 20 && titel.length - idx <= 45) return titel.slice(0, idx).trim();
  return titel;
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
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  let snit = 0;
  for (const w of ta) if (tb.has(w)) snit++;
  return snit / (ta.size + tb.size - snit);
}

function isDubbelTitel(a, b) {
  const na = normaliseerTitel(a.titel);
  const nb = normaliseerTitel(b.titel);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 25 && nb.length >= 25 && (na.includes(nb) || nb.includes(na))) return true;
  const g = jaccard(na, nb);
  return a.bron === b.bron ? g >= 0.7 : g >= 0.6 || (g >= 0.5 && gedeeldeKernwoorden(na, nb));
}

function gedeeldeKernwoorden(na, nb) {
  const stop = new Set(["de", "het", "een", "en", "van", "in", "op", "uit", "met", "voor", "te", "dat", "dan", "bij", "naar", "over", "na", "door"]);
  const wa = new Set(na.split(" ").filter(w => w.length >= 5 && !stop.has(w)));
  const wb = new Set(nb.split(" ").filter(w => w.length >= 5 && !stop.has(w)));
  let zelfde = 0;
  for (const w of wa) if (wb.has(w)) zelfde++;
  return zelfde >= 2;
}

function rss2jsonItem(it, bron, isGoogle) {
  let d = null;
  if (it.pubDate && /^\d{4}-\d{2}-\d{2} /.test(it.pubDate)) d = new Date(it.pubDate.replace(" ", "T") + "Z");
  else if (it.pubDate) d = new Date(it.pubDate);
  let foto = it.thumbnail || (it.enclosure && it.enclosure.link) || "";
  if (foto) foto = decodeEntities(foto);
  let titel = (it.title || "").trim();
  if (isGoogle) titel = schoonGoogleTitel(titel);
  return {
    titel,
    link: decodeEntities(it.link || "").trim(),
    samenvatting: isGoogle ? "" : maakSamenvatting(it.description),
    datum: d && !isNaN(d) ? d.toISOString() : "",
    bron,
    foto
  };
}

function slaap(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function haalLiveBron(bron) {
  let fout = null;
  for (let poging = 0; poging < 2; poging++) {
    try {
      const r = await fetch(RSS2JSON_URL + encodeURIComponent(bron.url), { cache: "no-store" });
      if (r.status === 429) {
        fout = new Error("429");
      } else if (!r.ok) {
        throw new Error("HTTP " + r.status);
      } else {
        const j = await r.json();
        if (j.status !== "ok" || !Array.isArray(j.items)) throw new Error("rss2json: " + (j.message || j.status));
        const isGoogle = bron.url.includes("news.google.com");
        return j.items.map(it => rss2jsonItem(it, bron.bron, isGoogle)).filter(it => it.titel && it.link);
      }
    } catch (e) {
      fout = e;
    }
    if (poging === 0) await slaap(30000);
  }
  throw fout || new Error("onbekende fout");
}

function voegLiveSamen(cat, liveItems) {
  const bestaand = (staat.feeds[cat] || []).slice(0, MAX_PER_FEED);
  const kandidaten = [...liveItems, ...bestaand].sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const gehouden = [];
  const links = new Set();
  for (const k of kandidaten) {
    const basis = k.link.split("?")[0];
    if (links.has(basis)) continue;
    if (gehouden.some(g => isDubbelTitel(g, k))) continue;
    gehouden.push(k);
    links.add(basis);
  }
  staat.feeds[cat] = gehouden.slice(0, MAX_PER_FEED + 10);
}

async function verfrisLive() {
  let liveCache = null;
  try { liveCache = JSON.parse(localStorage.getItem(LIVE_CACHE_KEY) || "null"); } catch (e) { /* negeren */ }
  if (liveCache && liveCache.tijd && Date.now() - liveCache.tijd < LIVE_CACHE_TIJD) return 0;

  staat.liveBezig = true;
  updateStatus();
  const wachtrij = [...LIVE_BRONNEN];
  const totaal = wachtrij.length;
  let klaar = 0;
  let gelukt = 0;
  let limiettreffers = 0;
  try {
    while (wachtrij.length) {
      const bron = wachtrij.shift();
      try {
        const items = await haalLiveBron(bron);
        if (items.length) {
          voegLiveSamen(bron.cat, items);
          gelukt++;
          renderTabs();
          if (staat.tab === bron.cat || staat.tab === "alles") renderInhoud();
        }
      } catch (e) {
        if (String(e.message).includes("429")) limiettreffers++;
        if (limiettreffers >= 3) break;
      }
      klaar++;
      toonVoortgang(30 + Math.round(60 * klaar / totaal));
      if (wachtrij.length) await slaap(1500);
    }
    if (gelukt) {
      staat.verversedOp = new Date().toISOString();
      staat.live = true;
    }
    slaCache();
  } finally {
    staat.liveBezig = false;
    try { localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify({ tijd: Date.now() })); } catch (e) { /* opslag vol */ }
  }
  return gelukt;
}

async function haalAlleFeedsOp(opties = {}) {
  const forceerLive = !!opties.forceerLive;
  staat.laadt = true;
  staat.fouten = {};
  toonVoortgang(25);
  updateStatus();

  let gelukt = false;
  laadWeer().catch(() => {});
  try {
    const antwoord = await fetch("data/nieuws.json", { cache: "no-store" });
    if (antwoord.ok) {
      const eigen = eigenNieuwsJson(await antwoord.text());
      if (eigen) {
        FEEDS.filter(f => !f.special).forEach(feed => {
          const items = eigen.feeds[feed.id] || [];
          if (items.length) {
            staat.feeds[feed.id] = items;
            delete staat.fouten[feed.id];
          }
        });
        gelukt = true;
        staat.verversedOp = eigen.gegenereerd || new Date().toISOString();
        staat.live = false;
      }
    }
  } catch (e) { /* offline of data onbestaand; cache blijft staan */ }

  if (!gelukt && !staat.verversedOp) {
    staat.fouten[staat.tab] = "Kon het nieuws niet laden. Controleer je internetverbinding.";
  }

  const verouderd = !staat.verversedOp || Date.now() - new Date(staat.verversedOp).getTime() > LIVE_STALE_TIJD;
  if ((gelukt || Object.keys(staat.feeds).length) && (forceerLive || verouderd)) {
    try { await verfrisLive(); } catch (e) { /* live verversen mislukt; JSON-data blijft staan */ }
  }

  staat.laadt = false;
  slaCache();
  toonVoortgang(100);
  setTimeout(() => { verbergVoortgang(); }, 450);
  updateStatus();
  renderTabs();
  renderInhoud();
}

function autoVerfris() {
  if (staat.laadt || staat.liveBezig || navigator.onLine === false) return;
  lopendeVervressing = haalAlleFeedsOp().catch(() => {});
}

const MAX_ALLES = 120;

function geefAlles() {
  const uniek = new Map();
  FEEDS.filter(f => !f.special).forEach(feed => {
    (staat.feeds[feed.id] || []).forEach(item => {
      if (item.categorieLabel) return;
      const sleutel = item.link.split("?")[0];
      if (!uniek.has(sleutel)) uniek.set(sleutel, { ...item, categorieLabel: feed.label });
    });
  });
  const lijst = Array.from(uniek.values());
  lijst.sort((a, b) => new Date(b.datum) - new Date(a.datum));
  return lijst.slice(0, MAX_ALLES);
}

function renderTabs() {
  const nav = el("tabbladen");
  nav.innerHTML = "";
  FEEDS.forEach(feed => {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "tab" + (staat.tab === feed.id ? " actief" : "");

    if (feed.special) {
      if (feed.id === "bewaard") {
        const n = laadBewaard().length;
        knop.innerHTML = "🔖 " + escapeHtml(feed.label) + (n ? ' <span class="teller">' + n + "</span>" : "");
      } else {
        const totaal = Object.values(staat.feeds).reduce((a, b) => a + b.length, 0);
        knop.innerHTML = escapeHtml(feed.label) + (totaal ? ' <span class="teller">' + totaal + "</span>" : "");
      }
    } else {
      const n = (staat.feeds[feed.id] || []).length;
      knop.innerHTML = escapeHtml(feed.label) + (n ? ' <span class="teller">' + n + "</span>" : "");
      if (staat.fouten[feed.id]) {
        knop.innerHTML += ' <span class="fout-punt" title="Feed tijdelijk niet beschikbaar"></span>';
      }
    }

    knop.addEventListener("click", () => {
      staat.tab = feed.id;
      staat.zoek = "";
      el("zoeken").value = "";
      renderTabs();
      renderInhoud();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    nav.appendChild(knop);
  });
}

function nieuwsItemHtml(item, opties) {
  const art = document.createElement("article");
  art.className = "nieuws-item";

  const bewaard = isBewaard(item);
  const labels =
    (opties.top ? '<span class="label label-top">Top</span>' : "") +
    '<span class="label label-bron">' + escapeHtml(opties.toonCategorie || item.bron) + "</span>";

  const tekst = document.createElement("div");
  tekst.className = "item-tekst";
  tekst.innerHTML =
    '<div class="item-labels">' + labels + "</div>" +
    '<h3 class="item-kop"><a href="' + encodeURI(item.link) + '" target="_blank" rel="noopener">' +
      escapeHtml(item.titel) + "</a></h3>" +
    (item.samenvatting ? '<p class="item-samenvatting">' + escapeHtml(stripHtml(item.samenvatting)) + "</p>" : "") +
    '<div class="item-meta"><span>' +
      escapeHtml(relatieveTijd(item.datum) || flexTijd(item.datum)) +
    "</span></div>";

  if (item.foto) {
    const foto = document.createElement("img");
    foto.className = "item-foto";
    foto.loading = "lazy";
    foto.alt = "";
    foto.src = item.foto;
    foto.addEventListener("error", () => foto.remove());
    art.appendChild(foto);
  }

  const knop = document.createElement("button");
  knop.className = "bewaar-knop" + (bewaard ? " actief" : "");
  knop.type = "button";
  knop.title = bewaard ? "Verwijder uit bewaard" : "Bewaar dit artikel";
  knop.textContent = bewaard ? "★" : "☆";
  knop.addEventListener("click", () => {
    wisselBewaar(item);
    renderTabs();
    renderInhoud();
  });

  art.appendChild(tekst);
  art.appendChild(knop);
  return art;
}

function escapeHtml(s) {
  const t = document.createElement("span");
  t.textContent = s || "";
  return t.innerHTML;
}

function toonLaadber(id, tekst) {
  const doel = el(id);
  doel.innerHTML = "";
  const d = document.createElement("div");
  d.className = "laad-bericht";
  d.innerHTML = '<div class="stipper"></div><span>' + escapeHtml(tekst) + "</span>";
  doel.appendChild(d);
}

function toonFout(id, bericht, detail) {
  const doel = el(id);
  doel.innerHTML = "";
  const d = document.createElement("div");
  d.className = "fout";
  d.innerHTML =
    "<p><strong>" + escapeHtml(bericht) + "</strong></p>" +
    (detail ? '<p class="fout-detail">' + escapeHtml(detail) + "</p>" : "") +
    '<button type="button" id="fout-haal-op">Opnieuw proberen</button>';
  doel.appendChild(d);
  el("fout-haal-op").addEventListener("click", () => verfris());
}

function toonLeeg(id, bericht) {
  const doel = el(id);
  doel.innerHTML = "";
  const d = document.createElement("div");
  d.className = "leeg";
  d.textContent = bericht;
  doel.appendChild(d);
}

function geefActieveLijst() {
  if (staat.tab === "alles") return geefAlles();
  if (staat.tab === "bewaard") return laadBewaard();
  return staat.feeds[staat.tab] || [];
}

function renderInhoud() {
  const feed = FEEDS.find(f => f.id === staat.tab);
  const titel = el("paneel-titel");
  const zoekveld = el("zoeken");
  zoekveld.hidden = staat.tab === "bewaard";
  const inhoud = el("inhoud");
  inhoud.innerHTML = "";

  if (staat.tab === "bewaard") {
    titel.textContent = "Bewaard";
    renderBewaard(inhoud);
    return;
  }

  titel.textContent = (feed ? feed.label : "") + (staat.laadt ? " — laden…" : "");

  if (staat.laadt && !Object.keys(staat.feeds).length) {
    toonLaadber("inhoud", "Nieuws ophalen…");
    return;
  }

  let items = geefActieveLijst();
  if (staat.zoek) {
    const q = staat.zoek.toLowerCase();
    items = items.filter(i => (i.titel + " " + (i.samenvatting || "")).toLowerCase().includes(q));
  }

  if (!items.length && staat.fouten[staat.tab]) {
    toonFout("inhoud", "Deze categorie kon niet geladen worden", staat.fouten[staat.tab]);
    return;
  }
  if (!items.length) {
    toonLeeg("inhoud", staat.zoek
      ? "Niets gevonden voor ‘" + staat.zoek + "’"
      : "Nog geen nieuws in deze categorie.");
    return;
  }

  const alles = staat.tab === "alles";
  items.forEach((item, idx) => {
    inhoud.appendChild(nieuwsItemHtml(item, {
      toonCategorie: alles ? item.categorieLabel : null,
      top: !alles && idx < TOP_MARKERINGEN
    }));
  });
}

function renderBewaard(container) {
  const items = laadBewaard();
  if (!items.length) {
    toonLeeg("inhoud", "Nog geen artikelen bewaard. Tik op de ster ☆ bij een bericht om het hier te bewaren.");
    return;
  }
  items.forEach(item => {
    container.appendChild(nieuwsItemHtml(item, { toonCategorie: "Bewaard" }));
  });
}

function updateStatus() {
  const status = el("update-status");
  status.classList.toggle("oud", false);
  if (staat.liveBezig) {
    status.textContent = "Live verversen…";
    return;
  }
  if (staat.laadt) {
    status.textContent = "Bezig met verversen…";
    return;
  }
  const nu = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  el("datum-regel").textContent = nu.charAt(0).toUpperCase() + nu.slice(1);

  if (staat.verversedOp) {
    const t = new Date(staat.verversedOp);
    let tekst = "Laatst ververst " + new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(t);
    if (staat.live) tekst += " (live)";
    const urenOud = (Date.now() - t.getTime()) / 3600000;
    if (urenOud >= 2) {
      tekst += " · " + relatieveTijd(staat.verversedOp);
      status.classList.toggle("oud", true);
    }
    status.textContent = tekst;
  } else {
    status.textContent = "Nog niet ververst";
  }
}

function toonVoortgang(pct) {
  el("voortgang").hidden = false;
  el("voortgang-balk").style.width = Math.min(100, Math.max(0, pct)) + "%";
}

function verbergVoortgang() {
  el("voortgang").hidden = true;
  el("voortgang-balk").style.width = "0%";
}

function zetThema(thema) {
  document.documentElement.setAttribute("data-thema", thema);
  try { localStorage.setItem(THEMA_KEY, thema); } catch (e) { /* opslag geblokkeerd */ }
}

function initThema() {
  let opgeslagen = null;
  try { opgeslagen = localStorage.getItem(THEMA_KEY); } catch (e) { /* opslag geblokkeerd */ }
  const donker = opgeslagen === "donker" ||
    (!opgeslagen && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  zetThema(donker ? "donker" : "licht");
}

let lopendeVervressing = null;

function verfris() {
  const knop = el("ververs-knop");
  if (!lopendeVervressing) {
    lopendeVervressing = haalAlleFeedsOp({ forceerLive: true });
  }
  knop.disabled = true;
  knop.classList.add("spinnend");
  lopendeVervressing.finally(() => {
    lopendeVervressing = null;
    knop.disabled = false;
    knop.classList.remove("spinnend");
  });
}

let opgestart = false;

function init() {
  if (opgestart) return;
  opgestart = true;
  initThema();

  el("thema-knop").addEventListener("click", () => {
    const donker = document.documentElement.getAttribute("data-thema") === "donker";
    zetThema(donker ? "licht" : "donker");
  });

  el("ververs-knop").addEventListener("click", verfris);

  el("zoeken").addEventListener("input", e => {
    staat.zoek = e.target.value.trim();
    renderInhoud();
  });

  const cache = laadCache();
  if (cache && cache.datum === vandaag() && Object.keys(cache.feeds || {}).length) {
    staat.feeds = cache.feeds;
    staat.fouten = cache.fouten || {};
    staat.verversedOp = cache.verversedOp;
  }

  renderTabs();
  renderInhoud();
  updateStatus();

  if (navigator.onLine !== false) haalAlleFeedsOp().catch(() => {});

  setInterval(autoVerfris, AUTO_VERFRIS_TIJD);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) autoVerfris();
  });
}

document.addEventListener("DOMContentLoaded", init);
