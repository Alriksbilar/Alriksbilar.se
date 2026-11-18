// Gemensam kod: hämtar alla filmer och spellistor för Alriks Bilar via YouTube Data API
// och räknar fram topplistor. Data cachas i Netlify Blobs (butiken "kanal").
import { getStore } from "@netlify/blobs";

export const KANAL_ID = "UCU-4UJDGqQWK5Iv4wXDlzGQ";           // Alriks Bilar
const UPPLADDNINGAR = "UU" + KANAL_ID.slice(2);               // kanalens "uploads"-spellista
const API = "https://www.googleapis.com/youtube/v3";
const MAX_ALDER_MS = 6 * 60 * 60 * 1000;                      // hämta nytt var 6:e timme
const SHORTS_MAX_SEK = 180;                                   // shorts är högst 3 minuter

export const nyckel = () => (globalThis.Netlify?.env?.get?.("YOUTUBE_API_KEY") || process.env.YOUTUBE_API_KEY || "").trim().replace(/^["']|["']$/g, "") || undefined;
export const butik = () => getStore({ name: "kanal", consistency: "strong" });

async function yt(path, params, key) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries({ ...params, key })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ISO 8601-längd (PT1H2M3S) → sekunder
function sekunder(iso = "") {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

export async function hamtaAllt(key) {
  // 1. Alla video-id:n från uppladdningslistan
  const ids = [];
  let sida;
  do {
    const d = await yt("/playlistItems", { part: "contentDetails", playlistId: UPPLADDNINGAR, maxResults: 50, ...(sida ? { pageToken: sida } : {}) }, key);
    ids.push(...d.items.map(i => i.contentDetails.videoId));
    sida = d.nextPageToken;
  } while (sida && ids.length < 2000);

  // 2. Titel, datum, längd och visningar, 50 åt gången
  const filmer = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await yt("/videos", { part: "snippet,statistics,contentDetails,status", id: ids.slice(i, i + 50).join(",") }, key);
    for (const v of d.items) {
      if (v.status?.privacyStatus !== "public") continue;
      if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== "none") continue;
      const sek = sekunder(v.contentDetails?.duration);
      filmer.push({
        id: v.id,
        titel: v.snippet.title,
        datum: (v.snippet.publishedAt || "").slice(0, 10),
        visningar: Number(v.statistics?.viewCount || 0),
        sek,
        shorts: sek > 0 && sek <= SHORTS_MAX_SEK
      });
    }
  }

  // 3. Spellistor
  const spellistor = [];
  sida = undefined;
  do {
    const d = await yt("/playlists", { part: "snippet,contentDetails", channelId: KANAL_ID, maxResults: 50, ...(sida ? { pageToken: sida } : {}) }, key);
    for (const p of d.items) {
      if (!p.contentDetails?.itemCount) continue;
      const t = p.snippet.thumbnails || {};
      spellistor.push({
        id: p.id,
        titel: p.snippet.title,
        antal: p.contentDetails.itemCount,
        bild: (t.maxres || t.standard || t.high || t.medium || t.default || {}).url || null
      });
    }
    sida = d.nextPageToken;
  } while (sida);

  return { hamtad: new Date().toISOString(), filmer, spellistor };
}

// Hämtar från cache, eller från YouTube om cachen är för gammal. Sparar en ögonblicksbild per dag.
export async function data({ tvinga = false } = {}) {
  const store = butik();
  const cache = await store.get("data", { type: "json" });
  if (!tvinga && cache && Date.now() - Date.parse(cache.hamtad) < MAX_ALDER_MS) return cache;
  const key = nyckel();
  if (!key) { if (cache) return cache; throw new Error("YOUTUBE_API_KEY saknas"); }
  const ny = await hamtaAllt(key);
  await store.setJSON("data", ny);
  const dag = ny.hamtad.slice(0, 10);
  const snap = Object.fromEntries(ny.filmer.map(f => [f.id, f.visningar]));
  await store.setJSON(`snap-${dag}`, snap);
  return ny;
}

// Hittar närmaste sparade ögonblicksbild som är minst `dagar` gammal (men högst dagar+7)
async function snapshotFor(dagar) {
  const store = butik();
  for (let extra = 0; extra <= 7; extra++) {
    const d = new Date(Date.now() - (dagar + extra) * 86400000).toISOString().slice(0, 10);
    const s = await store.get(`snap-${d}`, { type: "json" });
    if (s) return { datum: d, s };
  }
  return null;
}

const ut = f => ({ id: f.id, titel: f.titel, datum: f.datum, visningar: f.visningar, ...(f.okning != null ? { okning: f.okning } : {}) });

export async function topplistor(d) {
  const langa = d.filmer.filter(f => !f.shorts);
  const nu = Date.now();
  const inom = (f, dagar) => nu - Date.parse(f.datum) <= dagar * 86400000;
  const listor = {};

  // Veckans och månadens: flest NYA visningar sedan ögonblicksbilden. Saknas historik: nyaste filmernas visningar.
  for (const [nyckelNamn, dagar, titel] of [["vecka", 7, "Veckans mest sedda"], ["manad", 30, "Månadens mest sedda"]]) {
    const snap = await snapshotFor(dagar);
    if (snap) {
      const lista = langa.map(f => ({ ...f, okning: f.visningar - (snap.s[f.id] ?? 0) }))
        .filter(f => f.okning > 0).sort((a, b) => b.okning - a.okning).slice(0, 5);
      listor[nyckelNamn] = { titel, typ: "okning", filmer: lista.map(ut) };
    } else {
      const lista = langa.filter(f => inom(f, dagar)).sort((a, b) => b.visningar - a.visningar).slice(0, 5);
      listor[nyckelNamn] = { titel: titel + " – nya filmer", typ: "visningar", filmer: lista.map(ut) };
    }
  }

  listor.alla = { titel: "Alla tiders mest sedda", typ: "visningar", filmer: [...langa].sort((a, b) => b.visningar - a.visningar).slice(0, 10).map(ut) };

  const ar = [...new Set(langa.map(f => f.datum.slice(0, 4)))].filter(Boolean).sort().reverse();
  for (const a of ar) {
    const lista = langa.filter(f => f.datum.startsWith(a)).sort((x, y) => y.visningar - x.visningar).slice(0, 5);
    if (lista.length >= 3) listor["ar" + a] = { titel: `Mest sedda ${a}`, typ: "visningar", filmer: lista.map(ut) };
  }

  // Den bortglömda pärlan: minst sedda långa filmen senaste halvåret (minst en vecka gammal)
  const kandidater = langa.filter(f => inom(f, 183) && !inom(f, 7) && f.sek >= 240);
  const parla = kandidater.sort((a, b) => a.visningar - b.visningar)[0] || null;

  return { uppdaterad: d.hamtad, listor, ordning: Object.keys(listor), parla: parla && ut(parla) };
}
