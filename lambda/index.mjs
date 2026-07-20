/* ════════════════════════════════════════════════════════════
   endmid.gg — API proxy (AWS Lambda, Node.js 20.x, Function URL)

   The browser must never hold API credentials, so it calls this
   instead. Credentials come from Lambda environment variables:

     YT_DATA_API_KEY        YouTube Data API v3 key
     TWITCH_CLIENT_ID       Twitch application client id
     TWITCH_CLIENT_SECRET   Twitch application client secret

   Never hardcode those here — this file is public.
   ════════════════════════════════════════════════════════════ */

/* endmid.gg redirects the bare domain to www, but allow both so a
   direct hit on either origin still works. */
const ALLOWED_ORIGINS = new Set([
  "https://www.endmid.gg",
  "https://endmid.gg",
]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

/* App access tokens last ~60 days. Cache per warm container and
   re-mint a minute before expiry. */
let cachedToken = null;
let cachedExp = 0;

async function getTwitchToken() {
  if (cachedToken && Date.now() < cachedExp - 60000) return cachedToken;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`twitch token ${res.status}`);

  const data = await res.json();
  cachedToken = data.access_token;
  cachedExp = Date.now() + (data.expires_in || 0) * 1000;
  return cachedToken;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || "GET";
  const path = event.rawPath || "/";
  const query = event.queryStringParameters || {};
  const origin = event.headers?.origin || "";
  const cors = corsHeaders(origin);

  const reply = (body, status = 200) => ({
    statusCode: status,
    headers: { ...cors, "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  if (method === "OPTIONS") return { statusCode: 204, headers: cors };

  try {
    if (path === "/youtube/stats") {
      const ids = query.id || "";
      if (!ids) return reply({ error: "missing id" }, 400);

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/videos" +
          `?part=statistics&id=${encodeURIComponent(ids)}` +
          `&key=${process.env.YT_DATA_API_KEY}`
      );
      return reply(await res.text(), res.status);
    }

    if (path === "/twitch/streams") {
      const gameId = query.game_id || "";
      if (!gameId) return reply({ error: "missing game_id" }, 400);

      const token = await getTwitchToken();
      const res = await fetch(
        `https://api.twitch.tv/helix/streams?game_id=${encodeURIComponent(gameId)}` +
          "&first=20&language=en",
        {
          headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return reply(await res.text(), res.status);
    }

    return reply({ error: "not found" }, 404);
  } catch (err) {
    console.error(err);
    return reply({ error: "upstream failure" }, 502);
  }
};
