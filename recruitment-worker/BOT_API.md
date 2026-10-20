# Review bot handoff contract

The Worker submits an application to the bot server with an HTTPS `POST` request. With the included bot project, configure `REVIEW_BOT_URL` as `https://<your-bot-host>/api/web-applications`. The bot endpoint rejects requests unless `Authorization: Bearer <REVIEW_BOT_SECRET>` matches its `WEB_APPLICATION_SECRET` environment variable. Set both secrets to the same randomly generated value.

Example request body:

```json
{
  "applicationId": "generated-idempotency-id",
  "teamId": "esports",
  "teamName": "HoloFyrn Esports",
  "applicant": {
    "discordId": "123456789012345678",
    "discordUsername": "player"
  },
  "application": {
    "playerName": "Player Name",
    "age": 18,
    "trackerUrl": "https://rocketleague.tracker.network/rocket-league/profile/...",
    "country": "Hungary / Hungary",
    "availability": "Weekday evenings"
  },
  "source": "holofyrn.eu"
}
```

Allowed web `teamId` values are `esports`, `vanguards`, and `academy`. The bot maps them to its roster IDs `main`, `vanguards`, and `academy`. It uses the same stored tryout application format and posts the existing pending embed and Accept/Decline buttons to `TRYOUT_REVIEW_CHANNEL_ID`. The Worker sends an `Idempotency-Key` header. The bot also prevents a second pending application by the same Discord account for that team. The bot token stays on the bot server; it must never be put in the browser or the Worker.

The bot server needs an HTTPS reverse proxy or HTTPS hosting in front of its HTTP listener. Configure `WEB_APPLICATION_SECRET` on the bot host and the identical value as the Cloudflare Worker secret `REVIEW_BOT_SECRET`. Configure Worker text variable `REVIEW_BOT_URL` with the full HTTPS endpoint URL. The bot endpoint listens on `WEB_APPLICATION_PORT` (default `3001`, or `PORT` if supplied by the host) and exposes `/health` for a basic readiness check.
