// Serves the static site, plus one endpoint: POST /api/request stores a piece request in D1.
const PIECES = {
  "sk-archive": "Skrei Archive Coat",
  "sk-hjell": "Hjell Parka",
  "sk-route": "Northern Route Bomber",
  "sk-rorbu": "Rorbu Chore Coat",
  "sk-vestfjord": "Vestfjord Puffer",
  "sk-hamnoy": "Hamnøy Sherpa Trucker",
};
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Made to measure"];
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {"content-type": "application/json; charset=utf-8"},
});
const clean = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";

async function takeRequest(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({error: "Send JSON."}, 400); }

  if (clean(body.company, 50)) return json({error: "Rejected."}, 400);   // honeypot: real people leave it empty
  const piece = clean(body.piece, 40), size = clean(body.size, 20);
  const name = clean(body.name, 80), email = clean(body.email, 120);
  if (!PIECES[piece]) return json({error: "Choose a piece."}, 400);
  if (!SIZES.includes(size)) return json({error: "Choose a size."}, 400);
  if (name.length < 2) return json({error: "Tell us your name."}, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({error: "Check the email address."}, 400);
  if (body.consent !== true) return json({error: "Please agree to the privacy note."}, 400);

  // one person, three requests an hour
  const recent = await env.DB.prepare(
    "SELECT count(*) AS n FROM requests WHERE email = ? AND created_at > datetime('now', '-1 hour')"
  ).bind(email).first();
  if (recent && recent.n >= 3) return json({error: "You have already sent a few requests. We'll be in touch."}, 429);

  const ref = "YVER-I-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  await env.DB.prepare(
    `INSERT INTO requests (ref, piece_id, piece_name, size, name, email, city, contact, about, country, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    ref, piece, PIECES[piece], size, name, email,
    clean(body.city, 80), clean(body.contact, 40), clean(body.about, 2000),
    request.headers.get("cf-ipcountry") || "", clean(request.headers.get("user-agent"), 200),
  ).run();

  return json({ref});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/request") {
      if (request.method !== "POST") return json({error: "Use POST."}, 405);
      try { return await takeRequest(request, env); }
      catch (e) { return json({error: "Something went wrong. Please email us instead."}, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
