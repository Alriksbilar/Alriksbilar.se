// /api/innehall/:fil – läser nyheter.json, podd.json och poll.json direkt från GitHub.
// Då syns morgonens Bilnytt, nya poddavsnitt och veckans fråga utan att sajten behöver publiceras om
// (publiceringar kostar krediter hos Netlify). Faller tillbaka på den publicerade filen om GitHub inte svarar.
const TILLATNA = new Set(["nyheter", "podd", "poll"]);
const RAW = "https://raw.githubusercontent.com/Alriksbilar/alriksbilar.se/main/";

export default async (req, context) => {
  const fil = context.params?.fil;
  if (!TILLATNA.has(fil)) return new Response("finns inte", { status: 404 });
  const huvud = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" };
  try {
    const r = await fetch(RAW + fil + ".json", { headers: { "cache-control": "no-cache" } });
    if (!r.ok) throw new Error("GitHub " + r.status);
    const text = await r.text();
    JSON.parse(text); // giltig JSON?
    return new Response(text, { headers: { ...huvud, "netlify-cdn-cache-control": "public, durable, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (e) {
    const reserv = await fetch(new URL("/" + fil + ".json", req.url));
    return new Response(await reserv.text(), { status: reserv.status, headers: { ...huvud, "netlify-cdn-cache-control": "no-store" } });
  }
};

export const config = { path: "/api/innehall/:fil" };
