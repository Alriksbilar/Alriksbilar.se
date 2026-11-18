// /api/topplistor – topplistor, den bortglömda pärlan och spellistor för Alriks Bilar.
import { data, topplistor, nyckel } from "../lib/kanal.mjs";

const svar = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=0, must-revalidate",
    "netlify-cdn-cache-control": status === 200 ? "public, durable, s-maxage=3600, stale-while-revalidate=86400" : "no-store"
  }
});

export default async () => {
  try {
    const d = await data();
    const t = await topplistor(d);
    return svar({ ...t, spellistor: d.spellistor });
  } catch (e) {
    console.error(e);
    const k = nyckel() || "";
    return svar({ fel: String(e.message || e).slice(0, 120), nyckel: { finns: !!k, langd: k.length, ratt_start: k.startsWith("AIza") } }, 503);
  }
};

export const config = { path: "/api/topplistor" };
