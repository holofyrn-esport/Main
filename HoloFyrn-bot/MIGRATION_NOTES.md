# HoloFyrn Bot – Stage 1 Refactor

This is a safe working copy of the old Noctiq bot. It does **not** include the original `.env`, `.git`, or `node_modules` directories.

## Changed in Stage 1
- Visible Noctiq branding changed to HoloFyrn.
- Main brand color changed to deep burgundy (`0x7A101B`).
- Branding settings moved to `config/brand.js`.
- Old expiring roster image URLs were removed; use `BRAND_LOGO_URL` and `ROSTER_BANNER_URL`.
- `GuildMembers` gateway intent was added in code to match features that fetch server members.
- Announcement/Giveaway role IDs and partnership contact ID moved out of source code into environment variables.
- Synq/Eldr captain role IDs moved out of source code into environment variables.
- Package renamed to `holofyrn-bot`.

## Intentionally not changed yet
- `data/rosters.json` and `seed-data/rosters.json` still contain the old live roster structure/names. These need a deliberate roster migration once the final HoloFyrn team mapping is confirmed.
- Legacy environment variable names such as `TRYOUT_NOCTIQ_ROLE_ID` and `NOCTIQ_CAPTAIN_ROLE_ID` are still supported so the existing deployment can be migrated safely. They can be renamed in Stage 2.

## Before deployment
1. Reset the Discord bot token because the uploaded ZIP contained `.env`.
2. Fill a new `.env` from `.env.example`.
3. Confirm the bot role has at least View Channels, Send Messages, Embed Links, Read Message History, Manage Roles, and Manage Channels for the existing features.
4. Keep Presence Intent and Message Content Intent disabled; Server Members Intent should stay enabled.
5. For website applications, configure `TRYOUT_REVIEW_CHANNEL_ID` and `WEB_APPLICATION_SECRET`; expose the bot's HTTP listener over HTTPS at `/api/web-applications` and set the matching Worker `REVIEW_BOT_URL` and `REVIEW_BOT_SECRET` values.
