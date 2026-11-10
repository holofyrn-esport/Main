# Domain and OBS sync setup

The site can be hosted as static files on any HTTPS domain. Live team settings are synchronized through Firebase Firestore so the public OBS browser source receives edits from the control page, even though OBS and Chrome use separate browser storage. HTTPS is also required for browser access to the Rocket League computer's local WebSocket; Chrome may ask permission for local network access.

## One-time Firebase setup

1. Use the existing `noctiq-d1020` Firebase project (the same project used by HoloFyrn Manager). Its project ID and Storage bucket are already set in `firebase-config.js`.
2. Enable **Authentication → Sign-in method → Anonymous**. Broadcast uses anonymous auth for its logo uploads.
3. Ensure Firebase Storage is enabled for this project. In **Storage → Rules**, add the `broadcast-logos` match and `canWriteBroadcastLogo` helper from `../holofyrnmanager/storage.rules` to the existing rules, then publish. Keep all existing rule matches intact. Logo reads are public so OBS can load their download URLs; uploads require auth and are limited to 1 MiB WebP files under the uploader's own UID.
4. Publish the updated `../holofyrnmanager/firestore.rules` rules to enable the isolated `broadcastHubs/{roomId}` collection. Keep the other existing matches intact. Broadcast room settings and logo URLs live in that collection; Manager/Main documents are not changed.
5. Add the production domain under **Authentication → Settings → Authorized domains**.
6. Deploy all site files, including `firebase-config.js` and `cloud-sync.js`. The older `database.rules.json` file is not used by this Firestore-based integration.

The Firebase web API key is a public project identifier. Access is controlled by the Firestore and Storage rules. Do not replace the supplied rules with public write access.

Uploaded team logos are resized to 512 × 512 WebP and stored at `broadcast-logos/{uploaderUid}/{roomId}/{home|away}.webp`. The room settings contain only the Firebase download URL. Replacing a side's logo reuses its object path; removing a logo clears it from the room settings.

## Use with OBS

Open the control page on the computer/browser that will manage the broadcast, configure the teams, then copy the generated overlay link into an OBS Browser Source at 1920 × 1080. The link contains a random room ID; keep using that same link for the show. Every saved team or Best-of change is pushed to the room and appears in OBS without changing the source URL.

Keep the control page open during a series so it can write the Rocket League `MatchEnded` result to the shared series score. The overlay page reads that score and connects directly to Rocket League's local Stats API on the OBS computer.
