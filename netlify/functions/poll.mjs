// Veckans fråga: sparar och returnerar röster. Rösterna lagras i Netlify Blobs.
import { getStore } from "@netlify/blobs";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const giltigtId = id => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id);

export default async (req) => {
  const store = getStore({ name: "veckans-fraga", consistency: "strong" });

  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id");
    if (!giltigtId(id)) return json({ fel: "ogiltigt id" }, 400);
    return json({ id, roster: (await store.get(id, { type: "json" })) || {} });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ fel: "ogiltig data" }, 400); }
    const { id, val } = body || {};
    if (!giltigtId(id) || !Number.isInteger(val) || val < 0 || val > 5) return json({ fel: "ogiltig röst" }, 400);
    const roster = (await store.get(id, { type: "json" })) || {};
    roster[val] = (roster[val] || 0) + 1;
    await store.setJSON(id, roster);
    return json({ id, roster });
  }

  return json({ fel: "metod stöds inte" }, 405);
};

export const config = { path: "/api/poll" };
