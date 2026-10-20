# HoloFyrn Discord OAuth Worker

## Cloudflare dashboard setup

1. In Cloudflare, open **Workers & Pages** and create a Worker named `holofyrn-recruitment-oauth` (a Hello World Worker is fine).
2. Open the Worker editor and replace its code with [`src/index.js`](src/index.js). Deploy it once.
3. Open the Worker **Settings → Domains & Routes → Add → Custom Domain** and add `api.holofyrn.eu`. Cloudflare must already manage an active `holofyrn.eu` zone. If it does not, add the zone and verify/import its existing DNS records before changing nameservers; preserve the current website, email, and verification records.
4. In **Settings → Variables and Secrets**, add:
   - Text variable `DISCORD_CLIENT_ID` = `1562030012339585064`
   - Secret `DISCORD_CLIENT_SECRET` = the newly rotated Discord Client Secret
   - Secret `SESSION_SIGNING_SECRET` = a fresh random value; generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - Set text variable `REVIEW_BOT_URL` to the bot's HTTPS endpoint, for example `https://<your-bot-host>/api/web-applications`, and set secret `REVIEW_BOT_SECRET` to the same value as the bot's `WEB_APPLICATION_SECRET`. See [`BOT_API.md`](BOT_API.md).
5. Save and deploy the Worker after adding the settings.
6. In the Discord Developer Portal, add this exact OAuth2 Redirect URI: `https://api.holofyrn.eu/auth/discord/callback`.
7. Open `https://api.holofyrn.eu/auth/discord` to check the flow. It should go to Discord, then return to `https://holofyrn.eu/#/join/` and show the connected account.

The Main Site calls `https://api.holofyrn.eu/auth/me` using an HttpOnly session cookie. The Worker stores no Discord access token and does not require Firebase custom authentication.
