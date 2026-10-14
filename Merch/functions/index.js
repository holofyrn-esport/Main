"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const Stripe = require("stripe");

initializeApp();
const db = getFirestore();
const stripeSecret = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const storeOrigin = defineString("MERCH_STORE_ORIGIN", { default: "https://holofyrn.eu" });
const paymentsEnabled = defineString("MERCH_PAYMENTS_ENABLED", { default: "false" });
const pricesEur = defineString("MERCH_PRICES_EUR_JSON", { default: "{}" });
const shippingEurCents = defineString("MERCH_SHIPPING_EUR_CENTS", { default: "" });
const allowedCountriesValue = defineString("MERCH_SHIPPING_COUNTRIES", { default: "HU" });

const products = {
  jersey: { en: "FYRN Pro Jersey", hu: "FYRN Pro Mez", sizes: ["S", "M", "L", "XL", "2XL"] },
  hoodie: { en: "Core Hoodie", hu: "Core Pul\u00f3ver", sizes: ["S", "M", "L", "XL", "2XL"] },
  tee: { en: "Signature Oversized Tee", hu: "Signature Oversized P\u00f3l\u00f3", sizes: ["S", "M", "L", "XL", "2XL"] },
  cap: { en: "Signature Cap", hu: "Signature Sapka", sizes: ["ONE SIZE"] },
  deskmat: { en: "FYRN Gaming Deskmat", hu: "FYRN Gaming Eg\u00e9rpad", sizes: ["ONE SIZE"] },
};

function cors(req, res) {
  const origin = req.get("origin");
  if (origin && origin === storeOrigin.value()) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  if (origin !== storeOrigin.value()) {
    res.status(403).json({ error: "Store origin is not allowed." });
    return true;
  }
  return false;
}

function getPriceCatalog() {
  let parsed;
  try { parsed = JSON.parse(pricesEur.value()); } catch { throw new Error("MERCH_PRICES_EUR_JSON must be valid JSON."); }
  for (const id of Object.keys(products)) {
    if (!Number.isSafeInteger(parsed[id]) || parsed[id] < 50) {
      throw new Error(`Missing EUR cent price for ${id}.`);
    }
  }
  return parsed;
}

function getStripe() {
  return new Stripe(stripeSecret.value());
}

exports.createMerchCheckout = onRequest({
  region: "us-central1",
  secrets: [stripeSecret],
  cors: false,
  maxInstances: 10,
}, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST required." });
  if (paymentsEnabled.value() !== "true") return res.status(503).json({ error: "Checkout is not enabled yet." });

  try {
    const { items, email, locale } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
      return res.status(400).json({ error: "Invalid cart." });
    }
    if (typeof email !== "string" || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    const catalog = getPriceCatalog();
    const lineItems = [];
    const orderItems = [];
    for (const item of items) {
      const product = products[item?.id];
      const qty = Number(item?.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 50 || !product.sizes.includes(item?.size)) {
        return res.status(400).json({ error: "A cart item is invalid." });
      }
      const name = product[locale === "hu" ? "hu" : "en"];
      lineItems.push({
        quantity: qty,
        price_data: {
          currency: "eur",
          unit_amount: catalog[item.id],
          product_data: { name, metadata: { productId: item.id, size: item.size } },
        },
      });
      orderItems.push({ productId: item.id, name, size: item.size, quantity: qty, unitAmountEurCents: catalog[item.id] });
    }
    const shippingCents = Number(shippingEurCents.value());
    const allowedCountries = allowedCountriesValue.value().split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
    if (!Number.isSafeInteger(shippingCents) || shippingCents < 0 || allowedCountries.length === 0) {
      return res.status(503).json({ error: "Checkout shipping settings are incomplete." });
    }
    const orderRef = db.collection("merchOrders").doc();
    await orderRef.set({
      status: "pending",
      email,
      currency: "eur",
      items: orderItems,
      createdAt: FieldValue.serverTimestamp(),
    });
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      locale: locale === "hu" ? "hu" : "en",
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: allowedCountries },
      shipping_options: [{ shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: shippingCents, currency: "eur" },
        display_name: locale === "hu" ? "Szállítás" : "Shipping",
      } }],
      client_reference_id: orderRef.id,
      metadata: { orderId: orderRef.id },
      success_url: `${storeOrigin.value()}/Merch/holofyrn-merch-demo.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${storeOrigin.value()}/Merch/holofyrn-merch-demo.html?payment=cancelled`,
    });
    await orderRef.set({ checkoutSessionId: session.id }, { merge: true });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Unable to create merch checkout session", error);
    return res.status(500).json({ error: "Could not start checkout." });
  }
});

exports.merchStripeWebhook = onRequest({
  region: "us-central1",
  secrets: [stripeSecret, stripeWebhookSecret],
  maxInstances: 5,
}, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("POST required.");
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, req.get("stripe-signature"), stripeWebhookSecret.value());
  } catch (error) {
    console.warn("Rejected invalid Stripe webhook signature", error.message);
    return res.status(400).send("Invalid signature.");
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      const orderId = session.metadata?.orderId || session.client_reference_id;
      if (orderId) {
        await db.collection("merchOrders").doc(orderId).set({
          status: "paid",
          paymentIntentId: session.payment_intent || null,
          customerEmail: session.customer_details?.email || session.customer_email || null,
          shippingDetails: session.collected_information?.shipping_details || session.shipping_details || null,
          amountTotal: session.amount_total,
          currency: session.currency,
          paidAt: FieldValue.serverTimestamp(),
          stripeEventId: event.id,
        }, { merge: true });
      }
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (orderId) await db.collection("merchOrders").doc(orderId).set({ status: "expired" }, { merge: true });
  }
  return res.status(200).json({ received: true });
});
