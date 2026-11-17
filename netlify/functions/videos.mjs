// Hämtar de senaste filmerna från båda YouTube-kanalerna (RSS) och returnerar JSON.
// Körs på Netlify som /api/videos – sajten uppdateras därmed automatiskt vid varje ny film.
const KANALER = {
  svenska: "UCU-4UJDGqQWK5Iv4wXDlzGQ", // Alriks Bilar
  english: "UC2DoOqxbdQATnKKmFyDuW6A"  // Alriks Cars
};

const avkoda = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function hamta(kanalId) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${kanalId}`);
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1],
    titel: avkoda((e.match(/<title>(.*?)<\/title>/) || [])[1] || ""),
    datum: ((e.match(/<published>(.*?)<\/published>/) || [])[1] || "").slice(0, 10),
    shorts: /\/shorts\//.test(e)
  })).filter(v => v.id && !v.shorts);
}

export default async () => {
  const [svenska, english] = await Promise.all([hamta(KANALER.svenska), hamta(KANALER.english)]);
  return new Response(JSON.stringify({ kalla: "youtube", svenska, english }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=900" }
  });
};

export const config = { path: "/api/videos" };
