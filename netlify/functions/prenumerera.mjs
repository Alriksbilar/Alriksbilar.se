// Lägger till en prenumerant på Alriks Bilbrev i MailerLite.
// Kräver miljövariabeln MAILERLITE_TOKEN i Netlify (Project configuration → Environment variables).
// Prenumeranten läggs i gruppen "Alriks Bilbrev" (skapas automatiskt om den saknas).
// Har kontot dubbel bekräftelse (double opt-in) påslaget skickar MailerLite själv ett bekräftelsemejl.

const API = "https://connect.mailerlite.com/api";
const GRUPP = "Alriks Bilbrev";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

async function ml(path, token, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json", ...(options.headers || {}) }
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data };
}

async function gruppId(token) {
  const sok = await ml(`/groups?filter[name]=${encodeURIComponent(GRUPP)}&limit=25`, token);
  const hittad = sok.ok && (sok.data?.data || []).find(g => g.name === GRUPP);
  if (hittad) return hittad.id;
  const ny = await ml("/groups", token, { method: "POST", body: JSON.stringify({ name: GRUPP }) });
  return ny.ok ? ny.data?.data?.id : null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ fel: "metod stöds inte" }, 405);
  const token = globalThis.Netlify?.env?.get?.("MAILERLITE_TOKEN") || process.env.MAILERLITE_TOKEN;
  if (!token) return json({ fel: "ej konfigurerad" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ fel: "ogiltig data" }, 400); }
  const epost = String(body?.epost || "").trim();
  const fornamn = String(body?.fornamn || "").trim().slice(0, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost) || epost.length > 200) return json({ fel: "ogiltig e-post" }, 400);
  if (body?.samtycke !== "ja") return json({ fel: "samtycke saknas" }, 400);
  if (body?.["bot-field"]) return json({ ok: true }); // honeypot: låtsas lyckas

  const grupp = await gruppId(token);
  const res = await ml("/subscribers", token, {
    method: "POST",
    body: JSON.stringify({
      email: epost,
      fields: fornamn ? { name: fornamn } : {},
      groups: grupp ? [String(grupp)] : [],
      opted_in_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      optin_ip: req.headers.get("x-nf-client-connection-ip") || undefined
    })
  });
  if (!res.ok) return json({ fel: "mailerlite", status: res.status }, 502);
  return json({ ok: true });
};

export const config = { path: "/api/prenumerera" };
