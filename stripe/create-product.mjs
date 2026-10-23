#!/usr/bin/env node
/* ------------------------------------------------------------------
   Crée sur Stripe : un Product, un Price et un Payment Link à partir
   de product.json, puis écrit l'URL du lien dans product.json.paymentLink.

   Usage :
     node stripe/create-product.mjs            # crée (ou réutilise) sur Stripe
     node stripe/create-product.mjs --dry-run  # affiche le plan sans appeler Stripe

   Variables lues dans store/.env (ou l'environnement) :
     STRIPE_SECRET_KEY  obligatoire  (sk_live_... ou sk_test_...)
     SHIPPING_EUR       optionnel    frais de port fixes, ex. 4.90
     SUCCESS_URL        optionnel    page de redirection après paiement

   Idempotence : les identifiants créés sont stockés dans product.json
   sous la clé "stripe" et réutilisés aux exécutions suivantes.
   Un Price Stripe est immuable : si priceEur change, un nouveau Price
   et un nouveau Payment Link sont créés (l'ancien lien est désactivé).
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env');
const PRODUCT_FILE = path.join(ROOT, 'product.json');
const DRY_RUN = process.argv.includes('--dry-run');

const ALLOWED_COUNTRIES = ['FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'NL'];
const SHIPPING_LABEL = 'Livraison suivie';
const CONFIRMATION_MESSAGE =
  "Merci pour votre commande ! Vous recevez un e-mail de confirmation, puis le numéro de suivi dès l'expédition.";

/* ---------- Utilitaires ---------- */

function fail(message) {
  console.error(`\nErreur : ${message}\n`);
  process.exit(1);
}

function log(message) {
  console.log(message);
}

// Mini parseur .env : KEY=value, commentaires #, guillemets optionnels.
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function toCents(eur, label) {
  const n = Number(eur);
  if (!Number.isFinite(n) || n <= 0) fail(`${label} invalide : "${eur}" (attendu un nombre > 0, ex. 39.90)`);
  return Math.round(n * 100);
}

/* ---------- Lecture de la configuration ---------- */

loadEnv(ENV_FILE);

const key = process.env.STRIPE_SECRET_KEY || '';
if (key.startsWith('pk_')) {
  fail(
    'STRIPE_SECRET_KEY est une clé PUBLIQUE (pk_...). Il faut la clé SECRÈTE (sk_live_... ou sk_test_...),\n' +
      'visible dans le Dashboard Stripe > Développeurs > Clés API.'
  );
}
if (!key && !DRY_RUN) {
  fail(`STRIPE_SECRET_KEY manquante. Copiez .env.example vers .env (${ENV_FILE}) et collez votre clé secrète Stripe.`);
}
if (key && !/^(sk|rk)_(live|test)_/.test(key)) {
  fail('STRIPE_SECRET_KEY ne ressemble pas à une clé secrète Stripe (sk_live_... ou sk_test_...).');
}
const mode = key.includes('_test_') ? 'test' : 'live';

if (!fs.existsSync(PRODUCT_FILE)) fail(`product.json introuvable : ${PRODUCT_FILE}`);
const product = JSON.parse(fs.readFileSync(PRODUCT_FILE, 'utf8'));
for (const field of ['name', 'description', 'priceEur']) {
  if (!product[field]) fail(`product.json : champ "${field}" manquant`);
}

const currency = (product.currency || 'eur').toLowerCase();
const shippingEur = process.env.SHIPPING_EUR ? Number(process.env.SHIPPING_EUR) : null;
const successUrl = (process.env.SUCCESS_URL || '').trim();

// Identifiants déjà créés lors d'une exécution précédente.
let saved = product.stripe || {};
if (saved.mode && saved.mode !== mode && key) {
  log(`Attention : les identifiants enregistrés sont en mode "${saved.mode}" mais la clé est en mode "${mode}". Ils sont ignorés.`);
  saved = {};
}

/* ---------- Plan de création ---------- */

const plan = {
  product: {
    name: product.name,
    description: product.description,
    images: (product.images || []).slice(0, 8),
  },
  price: {
    currency,
    unit_amount: toCents(product.priceEur, 'priceEur'),
  },
  shippingRate:
    shippingEur !== null
      ? {
          display_name: SHIPPING_LABEL,
          type: 'fixed_amount',
          fixed_amount: { amount: toCents(shippingEur, 'SHIPPING_EUR'), currency },
        }
      : null,
  paymentLink: {
    line_items: [
      {
        price: '<price créé ci-dessus>',
        quantity: 1,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
      },
    ],
    shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    after_completion: successUrl
      ? { type: 'redirect', redirect: { url: successUrl } }
      : { type: 'hosted_confirmation', hosted_confirmation: { custom_message: CONFIRMATION_MESSAGE } },
  },
};

const priceUnchanged = Boolean(saved.priceId) && Number(saved.priceEur) === Number(product.priceEur);
const shippingUnchanged =
  shippingEur === null ? !saved.shippingRateId : Boolean(saved.shippingRateId) && Number(saved.shippingEur) === shippingEur;
const linkUnchanged = Boolean(saved.paymentLinkId) && priceUnchanged && shippingUnchanged && (saved.successUrl || '') === successUrl;

if (DRY_RUN) {
  log('--- DRY RUN : rien ne sera envoyé à Stripe ---\n');
  log(`Clé Stripe : ${key ? `${key.slice(0, 8)}… (mode ${mode})` : 'absente (OK en dry-run)'}`);
  log(`Fichier    : ${PRODUCT_FILE}\n`);
  log(`Product      : ${saved.productId ? `réutilisé (${saved.productId})` : 'à créer'}`);
  log(`Price        : ${priceUnchanged ? `réutilisé (${saved.priceId})` : 'à créer'}`);
  log(`ShippingRate : ${plan.shippingRate ? (shippingUnchanged ? `réutilisé (${saved.shippingRateId})` : 'à créer') : 'aucun (SHIPPING_EUR non défini)'}`);
  log(`PaymentLink  : ${linkUnchanged ? `réutilisé (${saved.paymentLinkId})` : 'à créer'}\n`);
  log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

/* ---------- Appels Stripe ---------- */

// Import différé : permet de lancer --dry-run avant même `npm install`.
const { default: Stripe } = await import('stripe');
const stripe = new Stripe(key);

try {
  // 1. Product
  let productId = saved.productId;
  if (productId) {
    log(`Product      : réutilisé ${productId}`);
  } else {
    const created = await stripe.products.create(plan.product);
    productId = created.id;
    log(`Product      : créé ${productId}`);
  }

  // 2. Price (immuable : nouveau Price si le montant a changé)
  let priceId = saved.priceId;
  if (priceUnchanged) {
    log(`Price        : réutilisé ${priceId}`);
  } else {
    const created = await stripe.prices.create({ product: productId, ...plan.price });
    priceId = created.id;
    log(`Price        : créé ${priceId} (${plan.price.unit_amount / 100} ${currency.toUpperCase()})`);
  }

  // 3. Shipping rate (optionnel)
  let shippingRateId = null;
  if (plan.shippingRate) {
    if (shippingUnchanged) {
      shippingRateId = saved.shippingRateId;
      log(`ShippingRate : réutilisé ${shippingRateId}`);
    } else {
      const created = await stripe.shippingRates.create(plan.shippingRate);
      shippingRateId = created.id;
      log(`ShippingRate : créé ${shippingRateId} (${shippingEur} ${currency.toUpperCase()})`);
    }
  } else {
    log('ShippingRate : aucun (SHIPPING_EUR non défini)');
  }

  // 4. Payment Link
  let paymentLinkId = saved.paymentLinkId;
  let paymentLinkUrl = product.paymentLink;
  if (linkUnchanged) {
    const existing = await stripe.paymentLinks.retrieve(paymentLinkId);
    paymentLinkUrl = existing.url;
    log(`PaymentLink  : réutilisé ${paymentLinkId}`);
  } else {
    const params = {
      ...plan.paymentLink,
      line_items: [{ ...plan.paymentLink.line_items[0], price: priceId }],
    };
    if (shippingRateId) params.shipping_options = [{ shipping_rate: shippingRateId }];

    const created = await stripe.paymentLinks.create(params);
    if (paymentLinkId) {
      await stripe.paymentLinks.update(paymentLinkId, { active: false });
      log(`PaymentLink  : ancien lien ${paymentLinkId} désactivé`);
    }
    paymentLinkId = created.id;
    paymentLinkUrl = created.url;
    log(`PaymentLink  : créé ${paymentLinkId}`);
  }

  // 5. Écriture dans product.json
  product.paymentLink = paymentLinkUrl;
  product.stripe = {
    mode,
    productId,
    priceId,
    priceEur: Number(product.priceEur),
    shippingRateId,
    shippingEur,
    paymentLinkId,
    successUrl,
  };
  fs.writeFileSync(PRODUCT_FILE, JSON.stringify(product, null, 2) + '\n');

  log(`\nproduct.json mis à jour (${mode}).`);
  log(`Payment Link : ${paymentLinkUrl}\n`);
} catch (err) {
  fail(`Stripe a répondu : ${err.message}`);
}
