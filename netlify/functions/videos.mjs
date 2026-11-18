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

async function hamta(kanalId) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${kanalId}`);
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

export default async () => {
  const [sv, en] = await Promise.all([hamta(KANALER.svenska), hamta(KANALER.english)]);
  const utan = ({ shorts, hela, ...v }) => v;
  const body = {
    kalla: "youtube",
    svenska: sv.filter(v => !v.shorts).map(utan),
    english: en.filter(v => !v.shorts).map(utan),
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
