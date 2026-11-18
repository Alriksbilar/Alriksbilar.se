// Schemalagd: hämtar kanalens filmer och sparar dagens visningssiffror (för "veckans/månadens mest sedda").
import { data } from "../lib/kanal.mjs";

export default async () => {
  try { await data({ tvinga: true }); } catch (e) { console.error("kanal-dagligen:", e); }
  return new Response("ok");
};

export const config = { schedule: "15 4 * * *" };
