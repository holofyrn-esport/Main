# Coaching

The default manager at `index.html` has a Coaching page in the Team menu. `classic.html` does not use this feature.

Team notes are stored at `coachingTeams/{teamId}/notes/{noteId}`. Player notes are stored at `coachingPlayers/{teamId}/players/{playerId}/notes/{noteId}`. Each note has `authorId`, `text`, and `createdAt`. Notes are append-only for now.

Firestore rules in `firestore.rules` allow assigned team members to read team notes. A linked player can read only their own player notes. Coaches can read and write notes for their assigned team; admins can access all teams. The account's `teamId` and `playerId`/`linkedPlayerId` in `users/{uid}` control access. Assign a coach's team in Admin → Edit account. Linked roster accounts are synchronized by an admin session and on later roster edits.

Deploy the rules from this directory with `firebase deploy --project noctiq-d1020 --only firestore:rules` before using the Coaching page. Publishing the static site alone does not activate these permissions.

The rules also reserve shared roster changes for admins because roster links determine the recipients of individual notes.
