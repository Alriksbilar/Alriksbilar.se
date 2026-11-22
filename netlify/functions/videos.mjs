// Hämtar de senaste filmerna från båda YouTube-kanalerna (RSS) och returnerar JSON.
// Körs på Netlify som /api/videos – sajten uppdateras därmed automatiskt vid varje ny film.
// Vanliga filmer och shorts returneras i separata listor.
const KANALER = {
  svenska: "UCU-4UJDGqQWK5Iv4wXDlzGQ", // Alriks Bilar
  english: "UC2DoOqxbdQATnKKmFyDuW6A"  // Alriks Cars
};

const avkoda = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Hittar en länk till en vanlig YouTube-film i en beskrivning (t.ex. "Se hela filmen: youtu.be/…")
function helaFilmen(beskrivning, egetId) {
  const m = [...beskrivning.matchAll(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/g)]
    .map(x => x[1]).find(id => id !== egetId);
  return m || null;
}

async function hamta(kanalId, typ = "channel_id") {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?${typ}=${kanalId}`).catch(() => null);
  if (!res) return [];
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const id = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
    const beskrivning = avkoda((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || "");
    return {
      id,
      titel: avkoda((e.match(/<title>(.*?)<\/title>/) || [])[1] || ""),
      datum: ((e.match(/<published>(.*?)<\/published>/) || [])[1] || "").slice(0, 10),
      shorts: /\/shorts\//.test(e),
      hela: helaFilmen(beskrivning, id)
    };
  }).filter(v => v.id);
}

// Premiärer: RSS-flödet visar en schemalagd premiär som vilken film som helst, med datumet då den lades upp.
// En premiär som ligger längre fram än PREMIAR_GRANS_H timmar ska inte ligga överst på sajten – den flyttas
// ned till plats 2, efter den senaste vanliga filmen. Inom gränsen (t.ex. två timmar kvar) får den ligga överst.
// Kräver YOUTUBE_API_KEY (samma nyckel som topplistorna); saknas den lämnas ordningen som den är.
const PREMIAR_GRANS_H = 24;
const apiNyckel = () => (globalThis.Netlify?.env?.get?.("YOUTUBE_API_KEY") || process.env.YOUTUBE_API_KEY || "").trim().replace(/^["']|["']$/g, "");

async function premiarer(ids) {
  const key = apiNyckel();
  if (!key || !ids.length) return {};
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,liveStreamingDetails");
  url.searchParams.set("id", ids.slice(0, 50).join(","));
  url.searchParams.set("key", key);
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return {};
  const d = await res.json().catch(() => ({}));
  const ut = {};
  for (const v of d.items || []) {
    const start = v.liveStreamingDetails?.scheduledStartTime;
    if (v.snippet?.liveBroadcastContent === "upcoming" && start) ut[v.id] = start;
  }
  return ut;
}

// Lägger premiärer som ligger för långt fram efter den första film som går att se nu.
function ordnaPremiarer(lista, start) {
  const grans = Date.now() + PREMIAR_GRANS_H * 3600000;
  const langtFram = v => start[v.id] && Date.parse(start[v.id]) > grans;
  const med = lista.map(v => (start[v.id] ? { ...v, premiar: start[v.id] } : v));
  const senare = med.filter(langtFram);
  if (!senare.length || !langtFram(med[0])) return med;
  const ovriga = med.filter(v => !langtFram(v));
  if (!ovriga.length) return med;
  return [ovriga[0], ...senare, ...ovriga.slice(1)];
}

export default async () => {
  // Kanalflödet har bara de 15 senaste uppladdningarna – shorts inräknade. Spellistan "UULF…"
  // innehåller enbart långa filmer, så den ger 15 senaste riktiga filmer oavsett hur många shorts som läggs upp.
  const lang = id => hamta("UULF" + id.slice(2), "playlist_id");
  const [sv, en, svLang, enLang] = await Promise.all([
    hamta(KANALER.svenska), hamta(KANALER.english), lang(KANALER.svenska), lang(KANALER.english)
  ]);
  const utan = ({ shorts, hela, ...v }) => v;
  const filmer = (flode, langa) => {
    const set = new Set(); const ut = [];
    for (const v of [...flode.filter(v => !v.shorts), ...langa]) if (!set.has(v.id)) { set.add(v.id); ut.push(utan(v)); }
    return ut.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  };
  const svFilmer = filmer(sv, svLang), enFilmer = filmer(en, enLang);
  const start = await premiarer([...svFilmer.slice(0, 5), ...enFilmer.slice(0, 5)].map(v => v.id)).catch(() => ({}));
  const body = {
    kalla: "youtube",
    svenska: ordnaPremiarer(svFilmer, start),
    english: ordnaPremiarer(enFilmer, start),
    shorts: sv.filter(v => v.shorts).map(({ shorts, ...v }) => v)
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, durable, s-maxage=900, stale-while-revalidate=3600"
    }
  });
};

export const config = { path: "/api/videos" };
