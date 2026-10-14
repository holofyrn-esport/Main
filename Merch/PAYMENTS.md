# Stripe Checkout setup

This storefront is static GitHub Pages. Payment creation and confirmation therefore run in Firebase Cloud Functions; Stripe secret keys must never be added to the HTML or committed to this repository.

## Before enabling payments

The catalog in the demo currently shows illustrative HUF prices. This integration charges EUR, so replace the displayed prices with the confirmed EUR catalog before opening the store. Confirm shipping prices and delivery countries, returns/refunds, tax and invoice handling, and the final production URL. Checkout remains disabled by default.

The current product IDs and sizes are mirrored in `functions/index.js`. Keep that server catalog in sync when the storefront catalog changes. Server prices in `MERCH_PRICES_EUR_JSON` are integer euro cents, for example `{ "jersey": 6490, "hoodie": 5290, "tee": 2690, "cap": 2190, "deskmat": 3290 }`; these example amounts are placeholders and must be replaced.

## Configure and deploy

1. Create/activate the Stripe account and use test keys first.
2. From the repository root, install the Firebase CLI if needed, select the intended Firebase project, and install function dependencies with `npm install --prefix Merch/functions`.
3. In Stripe, create a webhook for `https://us-central1-noctiq-d1020.cloudfunctions.net/merchStripeWebhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`. Set `STRIPE_SECRET_KEY` and the webhook signing secret with `firebase functions:secrets:set` for each secret.
4. Deploy `firebase deploy --only functions:merch` and set the function parameters when prompted: store origin, EUR price JSON, shipping cents, allowed ISO country codes, and `MERCH_PAYMENTS_ENABLED=false` initially.
5. Set the `CHECKOUT_API_URL` constant in the storefront to the deployed `createMerchCheckout` endpoint. Verify successful payment, cancellation, expiry, invalid cart/price tampering, and webhook delivery in Stripe test mode. Only then set `MERCH_PAYMENTS_ENABLED=true` and switch to production keys.

Firebase Functions require a billing-enabled Firebase/Google Cloud project. Paid orders are recorded in the `merchOrders` Firestore collection by the signed Stripe webhook; the browser redirect alone never marks an order as paid.
