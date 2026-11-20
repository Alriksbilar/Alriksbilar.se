// /api/innehall/:fil – läser nyheter.json, podd.json, poll.json och leasing.json direkt från GitHub.
// Då syns morgonens Bilnytt, nya poddavsnitt och veckans fråga utan att sajten behöver publiceras om
// (publiceringar kostar krediter hos Netlify). Faller tillbaka på den publicerade filen om GitHub inte svarar.
const TILLATNA = new Set(["nyheter", "podd", "poll", "leasing"]);
const RAW = "https://raw.githubusercontent.com/Alriksbilar/alriksbilar.se/main/";

export default async (req, context) => {
  const fil = context.params?.fil;
  if (!TILLATNA.has(fil)) return new Response("finns inte", { status: 404 });
  const huvud = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" };
  try {
    const r = await fetch(RAW + fil + ".json", { headers: { "cache-control": "no-cache" } });
    if (!r.ok) throw new Error("GitHub " + r.status);
    let text = await r.text();
    const data = JSON.parse(text); // giltig JSON?
    if (fil === "podd" && data.rss) {
      try { const avsnitt = await lasRss(data.rss); if (avsnitt.length) { data.avsnitt = avsnitt; text = JSON.stringify(data); } } catch {}
    }
    return new Response(text, { headers: { ...huvud, "netlify-cdn-cache-control": "public, durable, s-maxage=120, stale-while-revalidate=30" } });
  } catch (e) {
    const reserv = await fetch(new URL("/" + fil + ".json", req.url));
    return new Response(await reserv.text(), { status: reserv.status, headers: { ...huvud, "netlify-cdn-cache-control": "no-store" } });
  }
};

// Hämtar de senaste poddavsnitten direkt från RSS-flödet, så att nya avsnitt syns automatiskt.
async function lasRss(url) {
  const r = await fetch(url, { headers: { "user-agent": "alriksbilar.se" } });
  if (!r.ok) throw new Error("RSS " + r.status);
  const xml = await r.text();
  const tagg = (s, t) => { const m = s.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">")); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };
  const ren = s => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  const langd = d => {
    if (!d) return "";
    const p = d.split(":").map(Number); const sek = p.reduce((a, b) => a * 60 + b, 0);
    return Math.max(1, Math.round(sek / 60)) + " min";
  };
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map(([, it]) => {
    const besk = ren(tagg(it, "description"));
    const forsta = (besk.match(/^.{20,180}?[.!?](\s|$)/) || [besk.slice(0, 160)])[0].trim();
    return {
      titel: ren(tagg(it, "title")),
      datum: new Date(tagg(it, "pubDate")).toISOString().slice(0, 10),
      langd: langd(tagg(it, "itunes:duration")),
      text: forsta,
      url: tagg(it, "link") || data_url(it)
    };
  });
  function data_url(it) { const m = it.match(/<enclosure[^>]*url="([^"]+)"/); return m ? m[1] : ""; }
}

export const config = { path: "/api/innehall/:fil" };
