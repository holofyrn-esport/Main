# Account deletion on Firebase Spark

The manager no longer calls a Firebase Cloud Function. An administrator's Delete action now atomically disables the target's `users/{uid}` profile and creates an `accountDeletionRequests/{uid}` document. Firestore rules reject further manager access immediately. A scheduled GitHub Actions worker deletes the Firebase Authentication login and cleans up the Firestore profile, legacy shared user record, player account links, and notifications. Player records and results remain.

GitHub Pages and Firebase Spark alone cannot safely let one browser user delete another user's Authentication login. The worker is a trusted server process outside Firebase. It runs every 15 minutes, and can also be run manually. GitHub's standard hosted runners are free for public repositories; check the repository's Actions allowance if it becomes private.

## One-time setup

1. Deploy `holofyrnmanager/firestore.rules` from the `Main/holofyrnmanager` directory with `firebase deploy --project noctiq-d1020 --only firestore:rules`. Firestore rules deployment works on Spark. The Delete button cannot queue a request until these rules are active.
2. In Google Cloud, create a dedicated service account for project `noctiq-d1020` with **Firebase Authentication Admin** (`roles/firebaseauth.admin`) and **Cloud Datastore User** (`roles/datastore.user`) permissions. Generate a JSON key for it. Keep the key out of the repository and out of browser code.
3. In GitHub repository **Settings → Secrets and variables → Actions**, create the repository secret `HOLOFYRN_FIREBASE_SERVICE_ACCOUNT` containing the complete JSON key. Limit who can edit the repository and workflow because workflows can use this secret.
4. Publish the updated `Main/holofyrnmanager` files and the `Main/.github/workflows/delete-manager-accounts.yml` workflow to the `holofyrn-esport/Main` repository's default branch. Enable GitHub Actions for the repository.
5. Create a disposable manager account, request its deletion in the Admin page, and run **Actions → Delete queued manager accounts → Run workflow**. Confirm that the login is gone from Firebase Authentication and the profile is gone from Firestore. Then allow the 15-minute schedule to handle regular requests.

The UI reports **Deletion queued** once access is revoked. That is not the same as completed Auth deletion. Scheduled GitHub runs can be delayed, and GitHub disables schedules in public repositories after 60 days without repository activity. A failed worker run leaves the target disabled and the request pending for the next run. Check the GitHub Actions run log if a request stays pending. An invalid request is marked `rejected`; after fixing the account data, use **Retry deletion** in the Admin page to queue it again.

The old `functions/` implementation is no longer used. No Blaze upgrade or Cloud Functions deployment is needed. Firebase Console → Authentication → Users remains a free manual fallback for one-off Auth deletion.

References: [Firebase Cloud Functions quotas](https://firebase.google.com/docs/functions/quotas), [Firebase Authentication Admin SDK](https://firebase.google.com/docs/auth/admin/manage-users), [Firestore rules and `getAfter()`](https://firebase.google.com/docs/firestore/security/rules-conditions), [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
