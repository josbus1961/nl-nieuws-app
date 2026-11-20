"use strict";

const FEEDS = [
  { id: "hoogtepunten", label: "Hoogtepunten", special: true },
  { id: "algemeen", label: "Algemeen", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  { id: "binnenland", label: "Binnenland", url: "https://feeds.nos.nl/nosnieuwsbinnenland" },
  { id: "buitenland", label: "Buitenland", url: "https://feeds.nos.nl/nosnieuwsbuitenland" },
  { id: "economie", label: "Economie", url: "https://feeds.nos.nl/nosnieuwseconomie" },
  { id: "sport", label: "Sport", url: "https://feeds.nos.nl/nossportalgemeen" },
  { id: "cultuur", label: "Cultuur & Media", url: "https://feeds.nos.nl/nosnieuwscultuurenmedia" },
  { id: "tech", label: "Tech & Wetenschap", url: "https://feeds.nos.nl/nosnieuwstech" },
  { id: "bewaard", label: "Bewaard", special: true }
];

const PROXIES = [
  url => url,
  url => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
  url => "https://api.allorigins.win/get?url=" + encodeURIComponent(url),
  url => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url),
  url => "https://corsproxy.io/?url=" + encodeURIComponent(url)
];

const CACHE_KEY = "nl-nieuws-cache-v1";
const BEWAARD_KEY = "nl-nieuws-bewaard-v1";
const THEMA_KEY = "nl-nieuws-thema";
const MAX_PER_FEED = 25;
const TOP_MARKERINGEN = 3;

const staat = {
  tab: "hoogtepunten",
  feeds: {},
  fouten: {},
  verversedOp: null,
  laadt: false,
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
  else lijst.unshift({ titel: item.titel, link: item.link, samenvatting: item.samenvatting, datum: item.datum, bron: item.bron, categorieLabel: item.categorieLabel });
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

function haalFeedOp(feedUrl) {
  const pogingen = PROXIES.map(proxy => (async () => {
    const antwoord = await fetch(proxy(feedUrl), { cache: "no-store" });
    if (!antwoord.ok) throw new Error("HTTP " + antwoord.status);
    return antwoord.text();
  })());
  return pogingen.reduce((vorige, huidige) => vorige.catch(() => huidige));
}

function eigenNieuwsJson(ruw) {
  if (!ruw) return null;
  const t = ruw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const j = JSON.parse(t);
    if (j.feeds && typeof j.feeds === "object") return j;
  } catch (e) { /* andere json, negeren */ }
  return null;
}

function ontvouwAntwoord(ruw) {
  const tekst = (ruw || "").trim();
  if (tekst.startsWith("{")) {
    try {
      const j = JSON.parse(tekst);
      if (typeof j.contents === "string") return j.contents;
    } catch (e) { /* geen ingepakt JSON-antwoord */ }
  }
  return tekst;
}

function parseFeed(ruw) {
  const doc = new DOMParser().parseFromString(ontvouwAntwoord(ruw), "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Ongeldig RSS-antwoord");
  const nodes = Array.from(doc.querySelectorAll("item, entry"));
  return nodes.slice(0, MAX_PER_FEED).map(node => {
    const titel = stripHtml(node.querySelector("title")?.textContent) || "";
    const link =
      (node.querySelector("link")?.textContent || "").trim() ||
      node.querySelector("link[rel='alternate']")?.getAttribute("href") ||
      "";
    const samenvatting = stripHtml(
      node.querySelector("description")?.textContent ||
      node.querySelector("summary")?.textContent ||
      ""
    );
    const ruweDatum = node.querySelector("pubDate")?.textContent ||
      node.querySelector("published")?.textContent ||
      node.querySelector("updated")?.textContent || "";
    return {
      titel,
      link,
      samenvatting,
      datum: ruweDatum ? new Date(ruweDatum).toISOString() : "",
      bron: "NOS"
    };
  }).filter(i => i.titel && i.link);
}

async function haalAlleFeedsOp() {
  staat.laadt = true;
  staat.fouten = {};
  toonVoortgang(10);
  updateStatus();

  let gegenereerd = null;
  try {
    const antwoord = await fetch("data/nieuws.json", { cache: "no-store" });
    if (antwoord.ok) {
      const eigen = eigenNieuwsJson(await antwoord.text());
      if (eigen) {
        FEEDS.filter(f => f.url).forEach(feed => {
          const items = eigen.feeds[feed.id] || [];
          if (items.length) staat.feeds[feed.id] = items;
        });
        gegenereerd = eigen.gegenereerd || null;
      }
    }
  } catch (e) { /* lokale data onbestaand, door naar proxies */ }

  toonVoortgang(60);

  const veroud = !gegenereerd || (Date.now() - new Date(gegenereerd).getTime()) > 3 * 3600000;
  if (veroud) {
    await haalFeedsViaProxies();
    if (!Object.keys(staat.fouten).length) gegenereerd = new Date().toISOString();
  }

  staat.verversedOp = new Date(gegenereerd || Date.now()).toISOString();
  staat.laadt = false;
  slaCache();
  toonVoortgang(100);
  setTimeout(() => { verbergVoortgang(); }, 450);
  updateStatus();
  renderTabs();
  renderInhoud();
}

async function haalFeedsViaProxies() {
  const doelwitten = FEEDS.filter(f => f.url);
  let klaar = 0;

  const resultaten = await Promise.all(doelwitten.map(async feed => {
    let feedItems = [];
    let fout = null;
    try {
      const ruw = await haalFeedOp(feed.url);
      feedItems = parseFeed(ruw);
      if (!feedItems.length) throw new Error("Geen artikelen gevonden");
    } catch (e) {
      fout = e && e.message ? e.message : "Onbekende fout";
    }
    klaar++;
    toonVoortgang(60 + Math.round((klaar / doelwitten.length) * 40));
    return { id: feed.id, items: feedItems, fout };
  }));

  resultaten.forEach(r => {
    if (r.fout && !(staat.feeds[r.id] || []).length) {
      staat.feeds[r.id] = [];
      staat.fouten[r.id] = r.fout;
    } else if (!r.fout && (r.items || []).length) {
      staat.feeds[r.id] = r.items;
      delete staat.fouten[r.id];
    }
  });
}

function geefHoogtepunten() {
  const lijst = [];
  FEEDS.filter(f => f.url).forEach(feed => {
    (staat.feeds[feed.id] || []).slice(0, 2).forEach(item => {
      lijst.push({ ...item, categorieLabel: feed.label });
    });
  });
  lijst.sort((a, b) => new Date(b.datum) - new Date(a.datum));
  return lijst.slice(0, 20);
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
        knop.innerHTML = "★ " + escapeHtml(feed.label);
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
    (item.samenvatting ? '<p class="item-samenvatting">' + escapeHtml(item.samenvatting) + "</p>" : "") +
    '<div class="item-meta"><span>' +
      escapeHtml(relatieveTijd(item.datum) || flexTijd(item.datum)) +
    "</span></div>";

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
  if (staat.tab === "hoogtepunten") return geefHoogtepunten();
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

  const isHoog = staat.tab === "hoogtepunten";
  items.forEach((item, idx) => {
    inhoud.appendChild(nieuwsItemHtml(item, {
      toonCategorie: isHoog ? item.categorieLabel : null,
      top: !isHoog && idx < TOP_MARKERINGEN
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
  if (staat.laadt) {
    status.textContent = "Bezig met verversen…";
    return;
  }
  const nu = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  el("datum-regel").textContent = nu.charAt(0).toUpperCase() + nu.slice(1);

  if (staat.verversedOp) {
    const t = new Date(staat.verversedOp);
    status.textContent = "Laatst ververst " + new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(t);
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

function verfris() {
  const knop = el("ververs-knop");
  knop.disabled = true;
  knop.classList.add("spinnend");
  haalAlleFeedsOp().finally(() => {
    knop.disabled = false;
    knop.classList.remove("spinnend");
  });
}

function init() {
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

  if (navigator.onLine !== false) verfris();
}

document.addEventListener("DOMContentLoaded", init);
