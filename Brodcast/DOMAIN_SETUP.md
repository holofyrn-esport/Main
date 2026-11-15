# Domain and OBS sync setup

The site can be hosted as static files on any HTTPS domain. Live team settings are synchronized through Firebase Firestore so the public OBS browser source receives edits from the control page, even though OBS and Chrome use separate browser storage. HTTPS is also required for browser access to the Rocket League computer's local WebSocket; Chrome may ask permission for local network access.

## One-time Firebase setup

1. Use the existing `noctiq-d1020` Firebase project (the same project used by HoloFyrn Manager). Its project settings are already set in `firebase-config.js`.
2. Enable **Authentication → Sign-in method → Anonymous** for OBS overlays, and **Email/Password** for control-page editors.
3. Publish the updated `../holofyrnmanager/firestore.rules` rules to enable the isolated `broadcastHubs/{roomId}` collection. Keep the other existing matches intact. Broadcast room settings and logos live in that collection; Manager/Main documents are not changed.
4. Add the production domain under **Authentication → Settings → Authorized domains**.
5. Deploy all site files, including `firebase-config.js` and `cloud-sync.js`. The older `database.rules.json` file is not used by this Firestore-based integration.

The Firebase web API key is a public project identifier. Access is controlled by the Firestore rules. Do not replace the supplied rules with public write access. Only approved HoloFyrn Manager accounts with Admin, Coach, Manager, or Captain roles can edit Broadcast rooms across devices. Anonymous sessions can read overlays and retain access to rooms they originally created. Enable Email/Password sign-in in Firebase Authentication before using the shared editor login.

Uploaded team logos are resized to 512 × 512 WebP data URLs and saved directly in the room's Firestore settings. Each logo is limited to 280 KB to stay within Firestore's 1 MiB document limit. OBS reads the same Firestore document and displays the embedded image data.

## Use with OBS

Open the control page and sign in with an approved HoloFyrn Manager account on each computer that should edit the room. Configure the teams, then copy the generated overlay link into an OBS Browser Source at 1920 × 1080. The link contains the room ID; keep using that same link for the show. Every saved team or Best-of change is pushed to the room and appears in OBS without changing the source URL.

Keep the control page open during a series so it can write the Rocket League `MatchEnded` result to the shared series score. The overlay page reads that score and connects directly to Rocket League's local Stats API on the OBS computer.
