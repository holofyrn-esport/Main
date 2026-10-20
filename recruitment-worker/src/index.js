const SITE_ORIGINS = new Set(["https://holofyrn.eu", "https://www.holofyrn.eu"]);
const API_PATH = "/auth";

function corsHeaders(origin) {
  const headers = new Headers({ Vary: "Origin" });
  if (SITE_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return headers;
}

function cookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const part = raw.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}

function base64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function signSession(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return `${encoded}.${base64url(signature)}`;
}

async function readSession(token, secret) {
  if (!token || token.length > 4096) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64url(signature), new TextEncoder().encode(encoded));
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(encoded)));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function redirectToSite(status) {
  const url = new URL("https://holofyrn.eu/");
  url.hash = `/join/?discordAuth=${encodeURIComponent(status)}`;
  return new Response(null, { status: 303, headers: { Location: url.toString() } });
}

function makeCookie(name, value, options = {}) {
  const pieces = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || "/"}`, "Secure", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge !== undefined) pieces.push(`Max-Age=${options.maxAge}`);
  return pieces.join("; ");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET" && request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

    if (url.pathname === `${API_PATH}/application`) {
      const jsonHeaders = { ...Object.fromEntries(headers), "Content-Type": "application/json", "Cache-Control": "no-store" };
      if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: jsonHeaders });
      if (!SITE_ORIGINS.has(origin)) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: jsonHeaders });
      const session = await readSession(cookie(request, "discord_session"), env.SESSION_SIGNING_SECRET);
      if (!session) return new Response(JSON.stringify({ error: "Connect your Discord account first" }), { status: 401, headers: jsonHeaders });
      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > 12000) return new Response(JSON.stringify({ error: "Application is too large" }), { status: 413, headers: jsonHeaders });
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 12000) return new Response(JSON.stringify({ error: "Application is too large" }), { status: 413, headers: jsonHeaders });
      let data;
      try { data = JSON.parse(rawBody); }
      catch { return new Response(JSON.stringify({ error: "Invalid application data" }), { status: 400, headers: jsonHeaders }); }
      if (!data || typeof data !== "object" || Array.isArray(data)) return new Response(JSON.stringify({ error: "Invalid application data" }), { status: 400, headers: jsonHeaders });

      const teams = {
        esports: "HoloFyrn Esports",
        vanguards: "HoloFyrn Vanguards",
        academy: "HoloFyrn Esports Academy",
      };
      const teamName = teams[data.teamId];
      const playerName = String(data.playerName || "").trim();
      const age = Number(data.age);
      const trackerUrl = String(data.trackerUrl || "").trim();
      const country = String(data.country || "").trim();
      const availability = String(data.availability || "").trim();
      let tracker;
      try { tracker = new URL(trackerUrl); } catch { tracker = null; }
      if (!teamName || playerName.length < 2 || playerName.length > 50 || !Number.isInteger(age) || age < 10 || age > 99 || !tracker || tracker.protocol !== "https:" || tracker.hostname !== "rocketleague.tracker.network" && !tracker.hostname.endsWith(".rocketleague.tracker.network") || country.length < 2 || country.length > 100 || availability.length < 2 || availability.length > 1200) {
        return new Response(JSON.stringify({ error: "Please check all application fields" }), { status: 400, headers: jsonHeaders });
      }
      if (!env.REVIEW_BOT_URL || !env.REVIEW_BOT_SECRET) {
        return new Response(JSON.stringify({ error: "The recruitment review bot is not connected yet" }), { status: 503, headers: jsonHeaders });
      }

      let botUrl;
      try { botUrl = new URL(env.REVIEW_BOT_URL); } catch { botUrl = null; }
      if (!botUrl || botUrl.protocol !== "https:") return new Response(JSON.stringify({ error: "Review bot endpoint must use HTTPS" }), { status: 503, headers: jsonHeaders });

      const applicationId = crypto.randomUUID();
      try {
        const botResponse = await fetch(botUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.REVIEW_BOT_SECRET}`,
            "Idempotency-Key": applicationId,
          },
          body: JSON.stringify({
            applicationId,
            teamId: data.teamId,
            teamName,
            applicant: { discordId: session.sub, discordUsername: session.username },
            application: { playerName, age, trackerUrl: tracker.toString(), country, availability },
            source: "holofyrn.eu",
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!botResponse.ok) throw new Error(`Review bot returned ${botResponse.status}`);
        return new Response(JSON.stringify({ ok: true, applicationId }), { status: 202, headers: jsonHeaders });
      } catch (error) {
        console.error("Recruitment application handoff failed", error.message);
        return new Response(JSON.stringify({ error: "Could not send the application to the review bot" }), { status: 502, headers: jsonHeaders });
      }
    }

    if (url.pathname === `${API_PATH}/discord` || url.pathname === `${API_PATH}/discord/start`) {
      const stateBytes = crypto.getRandomValues(new Uint8Array(32));
      const state = base64url(stateBytes);
      const authorize = new URL("https://discord.com/oauth2/authorize");
      authorize.search = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: `${url.origin}${API_PATH}/discord/callback`,
        response_type: "code",
        scope: "identify",
        state,
      }).toString();
      return new Response(null, {
        status: 302,
        headers: { Location: authorize.toString(), "Set-Cookie": makeCookie("discord_oauth_state", state, { path: `${API_PATH}/discord`, maxAge: 600 }), "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === `${API_PATH}/discord/callback`) {
      const state = url.searchParams.get("state") || "";
      const savedState = cookie(request, "discord_oauth_state");
      const clearStateCookie = makeCookie("discord_oauth_state", "", { path: `${API_PATH}/discord`, maxAge: 0 });
      if (!state || !savedState || state !== savedState) return redirectToSite("state_error");
      if (url.searchParams.has("error") || !url.searchParams.has("code") || url.searchParams.get("iss") !== "https://discord.com") return redirectToSite("denied");

      try {
        const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: url.searchParams.get("code"),
            redirect_uri: `${url.origin}${API_PATH}/discord/callback`,
          }),
        });
        if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
        const tokenData = await tokenResponse.json();
        const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!profileResponse.ok) throw new Error("Discord profile request failed");
        const profile = await profileResponse.json();
        if (!/^\d{17,20}$/.test(String(profile.id || ""))) throw new Error("Invalid Discord profile");

        const session = await signSession({
          sub: profile.id,
          username: String(profile.global_name || profile.username || "").slice(0, 80),
          avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith("a_") ? "gif" : "png"}` : "",
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        }, env.SESSION_SIGNING_SECRET);
        const response = redirectToSite("connected");
        response.headers.append("Set-Cookie", clearStateCookie);
        response.headers.append("Set-Cookie", makeCookie("discord_session", session, { path: API_PATH, maxAge: 60 * 60 * 24 * 7 }));
        response.headers.set("Cache-Control", "no-store");
        return response;
      } catch (error) {
        console.error("Discord OAuth callback failed", error.message);
        const response = redirectToSite("failed");
        response.headers.append("Set-Cookie", clearStateCookie);
        return response;
      }
    }

    if (url.pathname === `${API_PATH}/me`) {
      if (!SITE_ORIGINS.has(origin)) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
      const session = await readSession(cookie(request, "discord_session"), env.SESSION_SIGNING_SECRET);
      if (!session) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ id: session.sub, username: session.username, avatar: session.avatar }), { headers: { ...Object.fromEntries(headers), "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    return new Response("Not found", { status: 404, headers });
  },
};
