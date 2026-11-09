# Domain and OBS sync setup

The site can be hosted as static files on any HTTPS domain. Live team settings are synchronized through Firebase Realtime Database so the public OBS browser source receives edits from the control page, even though OBS and Chrome use separate browser storage. HTTPS is also required for browser access to the Rocket League computer's local WebSocket; Chrome may ask permission for local network access.

## One-time Firebase setup

1. Create or choose a Firebase project, add a Web app, and create a Realtime Database.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Copy the Web app settings into `firebase-config.js`, including the Realtime Database URL.
4. Publish `database.rules.json` as the Realtime Database rules.
5. Add the production domain under **Authentication → Settings → Authorized domains**.
6. Deploy all site files, including `firebase-config.js`, `cloud-sync.js`, and `database.rules.json` (the rules file itself may instead be applied from the Firebase Console).

The Firebase web API key is a public project identifier. Access is controlled by the database rules. Do not replace the supplied rules with public write access.

## Use with OBS

Open the control page on the computer/browser that will manage the broadcast, configure the teams, then copy the generated overlay link into an OBS Browser Source at 1920 × 1080. The link contains a random room ID; keep using that same link for the show. Every saved team or Best-of change is pushed to the room and appears in OBS without changing the source URL.

Keep the control page open during a series so it can write the Rocket League `MatchEnded` result to the shared series score. The overlay page reads that score and connects directly to Rocket League's local Stats API on the OBS computer.
