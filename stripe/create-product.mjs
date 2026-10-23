#!/usr/bin/env node
/* ------------------------------------------------------------------
   Crée sur Stripe tout ce qu'il faut pour vendre les packs de product.json :
   - un Product + un Price par pack (b1, b2, b3…), nommés explicitement pour
     la page de paiement, ex. « Dragon Onesie — Pack Duo (2 pièces, -10 %) » ;
   - un Product + un Price pour l'upsell (chaussons) si upsell.enabled ;
   - deux tarifs de livraison : « Livraison suivie » (SHIPPING_EUR, défaut 4,90 €)
     et « Livraison offerte » (0 €) à partir de FREE_SHIPPING_FROM_QTY pièces ;
   - un Payment Link par pack SANS upsell et un AVEC upsell (6 liens pour 3 packs) ;
   - un code promo (DRAGON10, -10 %) pour la barre d'annonce.
   Les URL des liens sont écrites dans product.json (bundles[i].paymentLink et
   bundles[i].paymentLinkWithUpsell) et les identifiants sous product.json.stripe.

   Usage :
     node stripe/create-product.mjs                  # crée (ou réutilise) sur Stripe
     node stripe/create-product.mjs --dry-run        # affiche le plan, aucun appel Stripe
     node stripe/create-product.mjs --reset          # ignore les identifiants enregistrés
     node stripe/create-product.mjs --no-coupon      # ne crée pas le code promo
     node stripe/create-product.mjs --file chemin    # autre product.json (défaut : ./product.json)
     node stripe/create-product.mjs --dry-run --json # ajoute les paramètres bruts envoyés à Stripe

   Variables lues dans store/.env (ou l'environnement) :
     STRIPE_SECRET_KEY        obligatoire  sk_live_... ou sk_test_... (inutile en --dry-run)
     SITE_URL                 optionnel    URL publique du site : images et page merci
                                           (défaut : product.json.siteUrl, sinon
                                           https://chaborz-saas.github.io/cozy-dragon/)
     SUCCESS_URL              optionnel    page après paiement (défaut : SITE_URL + merci.html)
     SHIPPING_EUR             optionnel    « Livraison suivie », défaut 4.90 (0 = offerte pour tous)
     FREE_SHIPPING_FROM_QTY   optionnel    livraison offerte à partir de N pièces, défaut 2
     COUPON_CODE / COUPON_PCT optionnel    code promo (défaut : product.json.announcement.code,
                                           sinon DRAGON10) / 10

   Champs optionnels de product.json utilisés ici : shortName (nom court affiché
   à la caisse, ex. « Dragon Onesie »), siteUrl, announcement.code.

   Idempotence : les identifiants créés sont stockés dans product.json sous la
   clé "stripe" et réutilisés aux exécutions suivantes. Un Price Stripe est
   immuable : si un montant change, un nouveau Price et de nouveaux Payment
   Links sont créés, les anciens sont désactivés. Les identifiants sont écrits
   après chaque étape : en cas d'erreur à mi-chemin, relancer reprend où ça
   s'est arrêté sans créer de doublons.
   ------------------------------------------------------------------ */

import path from 'node:path';
import {
  DEFAULT_PRODUCT_FILE,
  DEFAULT_SITE_URL,
  ENV_FILE,
  absoluteUrl,
  describeStripeError,
  fail,
  loadEnv,
  log,
  money,
  normalizeSiteUrl,
  parseArgs,
  readProduct,
  readStripeKey,
  sig,
  toCents,
  warn,
  writeProduct,
} from './lib.mjs';

const USAGE = 'Usage : node stripe/create-product.mjs [--dry-run] [--reset] [--no-coupon] [--json] [--file chemin]';

const args = parseArgs(process.argv.slice(2), {
  flags: ['dry-run', 'reset', 'no-coupon', 'json', 'help'],
  options: ['file'],
  usage: USAGE,
});
if (args.help) {
  log(USAGE);
  process.exit(0);
}

const DRY_RUN = Boolean(args['dry-run']);
const RESET = Boolean(args.reset);
const WITH_COUPON = !args['no-coupon'];
const PRODUCT_FILE = args.file ? path.resolve(args.file) : DEFAULT_PRODUCT_FILE;

const ALLOWED_COUNTRIES = ['FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'NL'];
const SHIPPING_PAID_LABEL = 'Livraison suivie';
const SHIPPING_FREE_LABEL = 'Livraison offerte';
const SUBMIT_MESSAGE = 'Les tailles/couleurs choisies sont transmises avec votre commande.';
const MAX_IMAGES = 8; // limite Stripe par Product

/* ---------- Lecture de la configuration ---------- */

loadEnv(ENV_FILE);
const { key, mode } = readStripeKey({ required: !DRY_RUN });

const product = readProduct(PRODUCT_FILE);
validateProduct(product);

const brand = String(product.brand || '');
const currency = String(product.currency || 'eur').toLowerCase();
const baseCents = toCents(product.priceEur, 'priceEur');
// Nom court pour la page de paiement (product.json.shortName), sinon le nom complet.
const checkoutName = String(product.shortName || product.name).trim();
// Priorité : variable d'environnement, puis product.json, puis valeur par défaut.
const siteUrl = normalizeSiteUrl(envOr('SITE_URL', product.siteUrl || DEFAULT_SITE_URL));
const successUrl = withSessionId(envOr('SUCCESS_URL', `${siteUrl}merci.html`));
const shippingCents = toCents(envOr('SHIPPING_EUR', '4.90'), 'SHIPPING_EUR', { allowZero: true });
const shippingEur = shippingCents / 100;
const freeFromQty = positiveInt(envOr('FREE_SHIPPING_FROM_QTY', '2'), 'FREE_SHIPPING_FROM_QTY');
const announcedCode = product.announcement && product.announcement.code ? String(product.announcement.code) : '';
const couponCode = envOr('COUPON_CODE', announcedCode || 'DRAGON10').toUpperCase();
const couponPct = percent(envOr('COUPON_PCT', '10'), 'COUPON_PCT');

// Identifiants déjà créés lors d'une exécution précédente.
let saved = product.stripe && typeof product.stripe === 'object' ? product.stripe : {};
if (RESET && Object.keys(saved).length) {
  const oldLinks = linkIdsOf(saved);
  warn(
    `--reset : les identifiants enregistrés dans product.json.stripe (mode ${saved.mode || '?'}) sont ignorés.\n` +
      '           Les anciens objets Stripe restent actifs : désactivez-les dans le Dashboard si besoin' +
      (oldLinks.length ? ` (liens : ${oldLinks.join(', ')})` : '') +
      '.'
  );
  saved = {};
}
if (saved.mode && mode && saved.mode !== mode) {
  warn(`les identifiants enregistrés sont en mode "${saved.mode}" mais la clé est en mode "${mode}". Ils sont ignorés.`);
  saved = {};
}

/* ---------- Plan de création ---------- */

const images = (product.images || []).slice(0, MAX_IMAGES).map((src) => absoluteUrl(src, siteUrl));

const bundles = product.bundles.map((b) => {
  const discountPct = Number(b.discountPct || 0);
  // Montant du pack en centimes : qty × prix × (1 − remise), arrondi au centime.
  const unitAmount = Math.round(b.qty * Number(product.priceEur) * (1 - discountPct / 100) * 100);
  const shipping = shippingCents === 0 || b.qty >= freeFromQty ? 'free' : 'paid';
  const name = bundleProductName(checkoutName, b, discountPct);
  return {
    id: b.id,
    qty: b.qty,
    title: b.title,
    discountPct,
    unitAmount,
    shipping,
    name,
    productParams: {
      name,
      description: product.description,
      ...(images.length ? { images } : {}),
      metadata: { brand, bundle: b.id, qty: String(b.qty) },
    },
    priceParams: { currency, unit_amount: unitAmount, nickname: b.title, metadata: { brand, bundle: b.id } },
  };
});

const upsell = product.upsell && product.upsell.enabled ? buildUpsell(product.upsell) : null;

const shippingRates = {
  paid:
    shippingCents > 0
      ? {
          display_name: SHIPPING_PAID_LABEL,
          type: 'fixed_amount',
          fixed_amount: { amount: shippingCents, currency },
          metadata: { brand },
        }
      : null,
  free: {
    display_name: SHIPPING_FREE_LABEL,
    type: 'fixed_amount',
    fixed_amount: { amount: 0, currency },
    metadata: { brand },
  },
};

const coupon = WITH_COUPON
  ? {
      code: couponCode,
      percentOff: couponPct,
      couponParams: { name: `${couponCode} (-${couponPct} %)`, percent_off: couponPct, duration: 'once', metadata: { brand } },
      // first_time_transaction : un client Stripe déjà passé en caisse ne peut pas réutiliser le code.
      promotionParams: { code: couponCode, restrictions: { first_time_transaction: true }, metadata: { brand } },
    }
  : null;

/* ---------- Décisions : réutiliser, mettre à jour, créer, remplacer ---------- */
// Chaque décision vaut { action, id? } avec action ∈ reuse | update | create | replace | remove | skip.
// Calculées avant tout appel : le dry-run affiche exactement ce que la vraie exécution fera.

const savedBundles = saved.bundles || {};
const savedUpsell = saved.upsell || {};
const savedShipping = saved.shippingRateIds || {};
const savedCoupon = saved.coupon || {};

const decisions = {
  shipping: { paid: decideShipping('paid'), free: decideShipping('free') },
  upsell: decideUpsell(),
  bundles: [],
  removedBundles: Object.keys(savedBundles)
    .filter((id) => !bundles.some((b) => b.id === id))
    .map((id) => ({ id, links: [savedBundles[id].linkId, savedBundles[id].linkWithUpsellId].filter(Boolean) })),
  coupon: decideCoupon(),
  pendingCleanup: saved.pendingCleanup || null,
};
decisions.bundles = bundles.map(decideBundle);

if (DRY_RUN) {
  printPlan();
  process.exit(0);
}

/* ---------- Appels Stripe ---------- */

// Import différé : permet de lancer --dry-run avant même `npm install`.
const { default: Stripe } = await import('stripe');
const stripe = new Stripe(key);

// État à enregistrer : copie de l'existant, complétée au fil des étapes.
const next = structuredClone(saved);
Object.assign(next, {
  mode,
  updatedAt: new Date().toISOString(),
  currency,
  siteUrl,
  successUrl,
  shippingEur,
  freeShippingFromQty: freeFromQty,
  shippingRateIds: { ...(saved.shippingRateIds || {}) },
  bundles: { ...(saved.bundles || {}) },
});

// Objets à désactiver une fois leurs remplaçants créés (liens d'abord, puis prix, puis tarifs).
const cleanup = {
  links: [...((saved.pendingCleanup && saved.pendingCleanup.links) || [])],
  prices: [...((saved.pendingCleanup && saved.pendingCleanup.prices) || [])],
  shippingRates: [...((saved.pendingCleanup && saved.pendingCleanup.shippingRates) || [])],
};

function persist() {
  const pending = Object.values(cleanup).some((list) => list.length);
  if (pending) next.pendingCleanup = cleanup;
  else delete next.pendingCleanup;
  product.stripe = next;
  writeProduct(PRODUCT_FILE, product);
}

const pad = (label) => label.padEnd(26);

try {
  // 1. Tarifs de livraison
  for (const kind of ['paid', 'free']) {
    const d = decisions.shipping[kind];
    const label = pad(kind === 'paid' ? SHIPPING_PAID_LABEL : SHIPPING_FREE_LABEL);
    if (d.action === 'skip') continue;
    if (d.action === 'remove') {
      cleanup.shippingRates.push(d.id);
      delete next.shippingRateIds[kind];
      continue;
    }
    if (d.action === 'reuse') {
      log(`${label}: réutilisé ${d.id}`);
      continue;
    }
    const created = await stripe.shippingRates.create(shippingRates[kind]);
    if (d.action === 'replace') cleanup.shippingRates.push(d.id);
    next.shippingRateIds[kind] = created.id;
    log(`${label}: créé ${created.id} (${money(shippingRates[kind].fixed_amount.amount, currency)})`);
  }
  persist();

  // 2. Upsell : Product + Price
  if (upsell) {
    next.upsell = { ...(saved.upsell || {}), enabled: true, name: upsell.name };
    const productId = await ensureProduct(decisions.upsell.product, upsell.productParams, next.upsell, pad('Upsell · Product'));
    await ensurePrice(decisions.upsell.price, upsell.priceParams, productId, next.upsell, pad('Upsell · Price'));
  } else {
    if (next.upsell) next.upsell.enabled = false;
    log(`${pad('Upsell')}: désactivé dans product.json`);
  }
  persist();

  // 3. Packs : Product + Price
  for (const d of decisions.bundles) {
    const b = d.bundle;
    const store = (next.bundles[b.id] = { ...(next.bundles[b.id] || {}), qty: b.qty, title: b.title });
    const productId = await ensureProduct(d.product, b.productParams, store, pad(`[${b.id}] Product`));
    await ensurePrice(d.price, b.priceParams, productId, store, pad(`[${b.id}] Price`));
    persist();
  }

  // 4. Payment Links (un sans upsell, un avec)
  for (const d of decisions.bundles) {
    const b = d.bundle;
    const store = next.bundles[b.id];
    const entry = product.bundles.find((x) => x.id === b.id);
    const shippingRateId = next.shippingRateIds[b.shipping];
    store.shipping = b.shipping;

    const params = linkParams({ bundle: b, withUpsell: false, priceId: store.priceId, shippingRateId });
    entry.paymentLink = await ensureLink(d.link, params, store, 'linkId', 'linkSig', pad(`[${b.id}] Lien sans upsell`));

    if (upsell) {
      const paramsUp = linkParams({
        bundle: b,
        withUpsell: true,
        priceId: store.priceId,
        upsellPriceId: next.upsell.priceId,
        shippingRateId,
      });
      entry.paymentLinkWithUpsell = await ensureLink(
        d.linkWithUpsell,
        paramsUp,
        store,
        'linkWithUpsellId',
        'linkWithUpsellSig',
        pad(`[${b.id}] Lien avec upsell`)
      );
    } else {
      if (d.linkWithUpsell.action === 'remove') {
        cleanup.links.push(d.linkWithUpsell.id);
        delete store.linkWithUpsellId;
        delete store.linkWithUpsellSig;
        log(`${pad(`[${b.id}] Lien avec upsell`)}: ${d.linkWithUpsell.id} à désactiver (upsell désactivé)`);
      }
      entry.paymentLinkWithUpsell = '';
    }
    persist();
  }

  // 5. Packs retirés de product.json
  for (const removed of decisions.removedBundles) {
    cleanup.links.push(...removed.links);
    delete next.bundles[removed.id];
    log(`${pad(`[${removed.id}] Pack retiré`)}: ${removed.links.length} lien(s) à désactiver`);
  }

  // 6. Nettoyage : liens, puis prix, puis tarifs de livraison
  for (const id of cleanup.links.splice(0)) {
    await stripe.paymentLinks.update(id, { active: false });
    log(`${pad('Nettoyage')}: lien ${id} désactivé`);
  }
  for (const id of cleanup.prices.splice(0)) {
    await stripe.prices.update(id, { active: false });
    log(`${pad('Nettoyage')}: prix ${id} désactivé`);
  }
  for (const id of cleanup.shippingRates.splice(0)) {
    await stripe.shippingRates.update(id, { active: false });
    log(`${pad('Nettoyage')}: tarif de livraison ${id} désactivé`);
  }
  persist();

  // 7. Code promo
  if (coupon) {
    const d = decisions.coupon;
    if (d.action === 'reuse') {
      log(`${pad('Code promo')}: réutilisé ${coupon.code} (${d.id})`);
    } else {
      if (d.action === 'replace') {
        await stripe.promotionCodes.update(d.id, { active: false });
        log(`${pad('Code promo')}: ancien code ${d.id} désactivé`);
      }
      next.coupon = await createCoupon();
    }
  } else {
    log(`${pad('Code promo')}: ignoré (--no-coupon)`);
  }
  persist();
} catch (err) {
  try {
    persist(); // on garde les identifiants déjà créés : la prochaine exécution reprendra ici
  } catch {
    /* le message d'erreur Stripe reste prioritaire */
  }
  fail(describeStripeError(err));
}

/* ---------- Récapitulatif ---------- */

log(`\nproduct.json mis à jour (${mode}) : ${PRODUCT_FILE}\n`);
log('Liens de paiement :');
for (const b of product.bundles) {
  log(`  ${b.id.padEnd(4)} sans upsell : ${b.paymentLink}`);
  if (b.paymentLinkWithUpsell) log(`  ${b.id.padEnd(4)} avec upsell : ${b.paymentLinkWithUpsell}`);
}
if (next.coupon) log(`\nCode promo : ${next.coupon.code} (-${next.coupon.percentOff} %, ${next.coupon.promotionCodeId})`);
log('\nVérification : npm run stripe:check\n');

/* ================================================================== */
/*                            Fonctions                                */
/* ================================================================== */

/* ---------- Validation et configuration ---------- */

function validateProduct(p) {
  for (const field of ['name', 'description', 'priceEur']) {
    if (!p[field]) fail(`product.json : champ "${field}" manquant`);
  }
  if (!Array.isArray(p.bundles) || p.bundles.length === 0) {
    fail(
      'product.json : "bundles" manquant ou vide. Schéma attendu :\n' +
        '  "bundles": [\n' +
        '    { "id": "b1", "qty": 1, "title": "1 Dragon Onesie", "discountPct": 0,  "paymentLink": "", "paymentLinkWithUpsell": "" },\n' +
        '    { "id": "b2", "qty": 2, "title": "Pack Duo",        "discountPct": 10, "paymentLink": "", "paymentLinkWithUpsell": "" }\n' +
        '  ]'
    );
  }
  const seen = new Set();
  p.bundles.forEach((b, i) => {
    const where = `product.json : bundles[${i}]`;
    if (!b || typeof b !== 'object') fail(`${where} doit être un objet`);
    if (!b.id || typeof b.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(b.id)) {
      fail(`${where} : "id" manquant ou invalide (lettres, chiffres, - et _ uniquement, ex. "b1")`);
    }
    if (seen.has(b.id)) fail(`${where} : id "${b.id}" en double`);
    seen.add(b.id);
    if (!Number.isInteger(b.qty) || b.qty < 1) fail(`${where} (${b.id}) : "qty" doit être un entier ≥ 1`);
    if (!b.title || typeof b.title !== 'string') fail(`${where} (${b.id}) : "title" manquant`);
    const pct = Number(b.discountPct ?? 0);
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100) fail(`${where} (${b.id}) : "discountPct" doit être compris entre 0 et 99`);
  });
  if (p.upsell && p.upsell.enabled) {
    if (!p.upsell.name) fail('product.json : "upsell.name" manquant (ou passez upsell.enabled à false)');
    toCents(p.upsell.priceEur, 'upsell.priceEur');
  }
}

function envOr(name, fallback) {
  const value = (process.env[name] || '').trim();
  return value === '' ? fallback : value;
}

function positiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(`${label} invalide : "${value}" (attendu un entier ≥ 1)`);
  return n;
}

function percent(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100) fail(`${label} invalide : "${value}" (attendu un pourcentage entre 1 et 100)`);
  return n;
}

function withSessionId(url) {
  if (!/^https?:\/\//i.test(url)) fail(`SUCCESS_URL invalide : "${url}" (URL https attendue)`);
  if (url.includes('{CHECKOUT_SESSION_ID}')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
}

function linkIdsOf(state) {
  return Object.values(state.bundles || {}).flatMap((b) => [b.linkId, b.linkWithUpsellId].filter(Boolean));
}

/* ---------- Construction des objets Stripe ---------- */

// Nom affiché sur la page de paiement. Un pack d'une pièce sans remise garde
// le nom du produit ; les autres annoncent le pack, la quantité et la remise.
function bundleProductName(baseName, b, discountPct) {
  if (b.qty === 1 && discountPct === 0) return baseName;
  const pieces = `${b.qty} pièce${b.qty > 1 ? 's' : ''}`;
  const remise = discountPct > 0 ? `, -${discountPct} %` : '';
  return `${baseName} — ${b.title} (${pieces}${remise})`;
}

function buildUpsell(u) {
  const unitAmount = toCents(u.priceEur, 'upsell.priceEur');
  const upsellImages = (u.images || []).slice(0, MAX_IMAGES).map((src) => absoluteUrl(src, siteUrl));
  return {
    name: u.name,
    unitAmount,
    productParams: {
      name: u.name,
      ...(u.description ? { description: u.description } : {}),
      ...(upsellImages.length ? { images: upsellImages } : {}),
      metadata: { brand, role: 'upsell' },
    },
    priceParams: { currency, unit_amount: unitAmount, nickname: u.name, metadata: { brand, role: 'upsell' } },
  };
}

function linkParams({ bundle, withUpsell, priceId, upsellPriceId, shippingRateId }) {
  const metadata = { brand, bundle: bundle.id, qty: String(bundle.qty), upsell: withUpsell ? 'yes' : 'no' };
  return {
    line_items: [{ price: priceId, quantity: 1 }, ...(withUpsell ? [{ price: upsellPriceId, quantity: 1 }] : [])],
    shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    shipping_options: [{ shipping_rate: shippingRateId }],
    after_completion: { type: 'redirect', redirect: { url: successUrl } },
    custom_text: { submit: { message: SUBMIT_MESSAGE } },
    metadata,
    // Recopié sur le PaymentIntent : visible sur la page du paiement dans le Dashboard.
    payment_intent_data: { metadata },
  };
}

/* ---------- Décisions ---------- */

function changed(d) {
  return d.action === 'create' || d.action === 'replace';
}

function decideShipping(kind) {
  const id = savedShipping[kind] || null;
  if (!shippingRates[kind]) return id ? { action: 'remove', id } : { action: 'skip' };
  const sameAmount = kind === 'free' || Number(saved.shippingEur) === shippingEur;
  if (id && sameAmount) return { action: 'reuse', id };
  return id ? { action: 'replace', id } : { action: 'create' };
}

function decideProduct(s, params) {
  if (!s.productId) return { action: 'create' };
  return s.productSig === sig(params) ? { action: 'reuse', id: s.productId } : { action: 'update', id: s.productId };
}

function decidePrice(s, params, productDecision) {
  if (productDecision.action === 'create' || !s.priceId) return { action: 'create' };
  const same = Number(s.unitAmount) === params.unit_amount && (s.currency || 'eur') === params.currency;
  if (!same) return { action: 'replace', id: s.priceId };
  return s.nickname === params.nickname ? { action: 'reuse', id: s.priceId } : { action: 'update', id: s.priceId };
}

function decideUpsell() {
  if (!upsell) return { product: { action: 'skip' }, price: { action: 'skip' } };
  const productDecision = decideProduct(savedUpsell, upsell.productParams);
  return { product: productDecision, price: decidePrice(savedUpsell, upsell.priceParams, productDecision) };
}

function decideLink(s, idField, sigField, withUpsell, b, priceDecision) {
  const id = s[idField] || null;
  const shippingDecision = decisions.shipping[b.shipping];
  const deps = [priceDecision, shippingDecision, ...(withUpsell ? [decisions.upsell.price] : [])];
  if (deps.some(changed)) return id ? { action: 'replace', id } : { action: 'create' };
  // Toutes les dépendances sont conservées : on compare la signature du lien tel qu'il serait créé.
  const params = linkParams({
    bundle: b,
    withUpsell,
    priceId: priceDecision.id,
    upsellPriceId: decisions.upsell.price.id,
    shippingRateId: shippingDecision.id,
  });
  if (id && s[sigField] === sig(params)) return { action: 'reuse', id };
  return id ? { action: 'replace', id } : { action: 'create' };
}

function decideBundle(b) {
  const s = savedBundles[b.id] || {};
  const productDecision = decideProduct(s, b.productParams);
  const priceDecision = decidePrice(s, b.priceParams, productDecision);
  const link = decideLink(s, 'linkId', 'linkSig', false, b, priceDecision);
  let linkWithUpsell;
  if (upsell) linkWithUpsell = decideLink(s, 'linkWithUpsellId', 'linkWithUpsellSig', true, b, priceDecision);
  else linkWithUpsell = s.linkWithUpsellId ? { action: 'remove', id: s.linkWithUpsellId } : { action: 'skip' };
  return { bundle: b, product: productDecision, price: priceDecision, link, linkWithUpsell };
}

function decideCoupon() {
  if (!coupon) return { action: 'skip' };
  const same =
    savedCoupon.couponId &&
    savedCoupon.promotionCodeId &&
    savedCoupon.code === coupon.code &&
    Number(savedCoupon.percentOff) === coupon.percentOff;
  if (same) return { action: 'reuse', id: savedCoupon.promotionCodeId };
  return savedCoupon.promotionCodeId ? { action: 'replace', id: savedCoupon.promotionCodeId } : { action: 'create' };
}

/* ---------- Dry run ---------- */

function status(d) {
  switch (d.action) {
    case 'create':
      return 'à créer';
    case 'reuse':
      return `réutilisé (${d.id})`;
    case 'update':
      return `mis à jour (${d.id})`;
    case 'replace':
      return `à recréer (ancien ${d.id} désactivé)`;
    case 'remove':
      return `à désactiver (${d.id})`;
    default:
      return '—';
  }
}

function printPlan() {
  log('--- DRY RUN : rien ne sera envoyé à Stripe ---\n');
  log(`Clé Stripe : ${key ? `${key.slice(0, 8)}… (mode ${mode})` : 'absente (OK en dry-run)'}`);
  log(`Fichier    : ${PRODUCT_FILE}`);
  log(`Site       : ${siteUrl}`);
  log(`Retour     : ${successUrl}`);
  log(
    `Enregistré : ${
      Object.keys(saved).length
        ? `identifiants ${saved.mode || '?'} (mis à jour le ${saved.updatedAt || '?'}) — réutilisés quand rien n'a changé`
        : 'aucun identifiant Stripe (première exécution, tout est à créer)'
    }`
  );

  log(`\nPacks — un Product + un Price par pack (prix de base ${money(baseCents, currency)})`);
  if (!product.shortName) {
    log(`  (nom à la caisse basé sur "name" ; ajoutez "shortName": "Dragon Onesie" dans product.json pour un nom plus court)`);
  }
  for (const d of decisions.bundles) {
    const b = d.bundle;
    const calc = `${b.qty} × ${money(baseCents, currency)}${b.discountPct ? ` −${b.discountPct} %` : ''}`;
    log(`  ${b.id.padEnd(4)}${calc.padEnd(24)} = ${money(b.unitAmount, currency).padStart(11)}   « ${b.name} »`);
    log(`      Product : ${status(d.product)} · Price « ${b.title} » : ${status(d.price)}`);
  }

  log('\nUpsell');
  if (upsell) {
    log(`  « ${upsell.name} »  ${money(upsell.unitAmount, currency)}`);
    log(`      Product : ${status(decisions.upsell.product)} · Price : ${status(decisions.upsell.price)}`);
  } else {
    log('  désactivé dans product.json (upsell.enabled = false) : pas de lien « avec upsell »');
  }

  log('\nLivraison');
  const paidFor = bundles.filter((b) => b.shipping === 'paid').map((b) => b.id);
  const freeFor = bundles.filter((b) => b.shipping === 'free').map((b) => b.id);
  if (shippingRates.paid) {
    log(
      `  ${SHIPPING_PAID_LABEL.padEnd(18)} ${money(shippingCents, currency).padStart(8)}   packs de moins de ${freeFromQty} pièce(s)` +
        ` [${paidFor.join(', ') || 'aucun'}]  → ${status(decisions.shipping.paid)}`
    );
  } else {
    log(`  ${SHIPPING_PAID_LABEL.padEnd(18)} SHIPPING_EUR = 0 : non créée, livraison offerte pour tous les packs`);
    if (decisions.shipping.paid.action === 'remove') log(`      ancien tarif ${status(decisions.shipping.paid)}`);
  }
  log(
    `  ${SHIPPING_FREE_LABEL.padEnd(18)} ${money(0, currency).padStart(8)}   à partir de ${freeFromQty} pièce(s)` +
      ` [${freeFor.join(', ') || 'aucun'}]  → ${status(decisions.shipping.free)}`
  );

  const linkCount = decisions.bundles.length * (upsell ? 2 : 1);
  log(`\nLiens de paiement (${linkCount})`);
  for (const d of decisions.bundles) {
    const b = d.bundle;
    const ship = b.shipping === 'paid' ? `+ ${SHIPPING_PAID_LABEL.toLowerCase()} ${money(shippingCents, currency)}` : `+ ${SHIPPING_FREE_LABEL.toLowerCase()}`;
    log(`  ${b.id.padEnd(4)}sans upsell  ${money(b.unitAmount, currency).padStart(11)} ${ship.padEnd(28)} → ${status(d.link)}`);
    if (upsell) {
      const total = b.unitAmount + upsell.unitAmount;
      log(`  ${b.id.padEnd(4)}avec upsell  ${money(total, currency).padStart(11)} ${ship.padEnd(28)} → ${status(d.linkWithUpsell)}`);
    } else if (d.linkWithUpsell.action === 'remove') {
      log(`  ${b.id.padEnd(4)}avec upsell  ${''.padStart(11)} ${''.padEnd(28)} → ${status(d.linkWithUpsell)}`);
    }
  }
  log('  Chaque lien :');
  log(`    · pays de livraison ${ALLOWED_COUNTRIES.join(', ')} ; numéro de téléphone demandé ; codes promo acceptés`);
  log(`    · redirection après paiement : ${successUrl}`);
  log(`    · message sous le bouton : « ${SUBMIT_MESSAGE} »`);
  log(`    · metadata : bundle, qty, upsell (yes/no), brand « ${brand} » (sur le lien et sur le paiement)`);

  log('\nCode promo');
  if (coupon) {
    log(`  ${coupon.code} : -${coupon.percentOff} % sur la commande, une fois par client → ${status(decisions.coupon)}`);
  } else {
    log('  ignoré (--no-coupon)');
  }

  const removed = decisions.removedBundles;
  const pending = decisions.pendingCleanup;
  if (removed.length || pending) {
    log('\nNettoyage');
    for (const r of removed) log(`  pack ${r.id} retiré de product.json : ${r.links.length} lien(s) à désactiver (${r.links.join(', ')})`);
    if (pending) {
      const ids = [...(pending.links || []), ...(pending.prices || []), ...(pending.shippingRates || [])];
      log(`  en attente depuis une exécution interrompue : ${ids.join(', ')}`);
    }
  }

  if (args.json) {
    log('\nParamètres bruts envoyés à Stripe (les identifiants entre < > sont remplacés à la création) :');
    const raw = {
      shippingRates,
      upsell: upsell ? { product: upsell.productParams, price: upsell.priceParams } : null,
      bundles: bundles.map((b) => ({ id: b.id, product: b.productParams, price: b.priceParams })),
      paymentLinks: bundles.flatMap((b) =>
        [false, ...(upsell ? [true] : [])].map((withUpsell) =>
          linkParams({
            bundle: b,
            withUpsell,
            priceId: `<price ${b.id}>`,
            upsellPriceId: '<price upsell>',
            shippingRateId: `<shipping rate ${b.shipping}>`,
          })
        )
      ),
      coupon: coupon ? { coupon: coupon.couponParams, promotionCode: { ...coupon.promotionParams, coupon: '<coupon>' } } : null,
    };
    log(JSON.stringify(raw, null, 2));
  }
  log('');
}

/* ---------- Exécution ---------- */

async function ensureProduct(d, params, store, label) {
  if (d.action === 'reuse') {
    log(`${label}: réutilisé ${d.id}`);
  } else if (d.action === 'update') {
    await stripe.products.update(d.id, params);
    log(`${label}: mis à jour ${d.id} (« ${params.name} »)`);
  } else {
    const created = await stripe.products.create(params);
    store.productId = created.id;
    log(`${label}: créé ${created.id} (« ${params.name} »)`);
  }
  store.productSig = sig(params);
  return store.productId;
}

async function ensurePrice(d, params, productId, store, label) {
  const amount = money(params.unit_amount, params.currency);
  if (d.action === 'reuse') {
    log(`${label}: réutilisé ${d.id} (${amount})`);
  } else if (d.action === 'update') {
    await stripe.prices.update(d.id, { nickname: params.nickname, metadata: params.metadata });
    log(`${label}: mis à jour ${d.id} (${amount}, « ${params.nickname} »)`);
  } else {
    const created = await stripe.prices.create({ product: productId, ...params });
    if (d.action === 'replace') cleanup.prices.push(d.id);
    store.priceId = created.id;
    log(`${label}: créé ${created.id} (${amount})${d.action === 'replace' ? ` — remplace ${d.id}` : ''}`);
  }
  store.unitAmount = params.unit_amount;
  store.currency = params.currency;
  store.nickname = params.nickname;
  return store.priceId;
}

async function ensureLink(d, params, store, idField, sigField, label) {
  if (d.action === 'reuse') {
    const existing = await stripe.paymentLinks.retrieve(d.id);
    if (existing.active) {
      log(`${label}: réutilisé ${d.id}`);
      return existing.url;
    }
    log(`${label}: ${d.id} a été désactivé côté Stripe → recréé`);
  }
  const created = await stripe.paymentLinks.create(params);
  if (d.action === 'replace') cleanup.links.push(d.id);
  store[idField] = created.id;
  store[sigField] = sig(params);
  log(`${label}: créé ${created.id}${d.action === 'replace' ? ` — remplace ${d.id}` : ''}`);
  return created.url;
}

async function createCoupon() {
  const label = pad('Code promo');
  // Un code actif portant déjà ce nom existe peut-être (ex. après --reset) : on le réutilise.
  const existing = await stripe.promotionCodes.list({ code: coupon.code, active: true, limit: 1 });
  const found = existing.data[0];
  if (found && found.coupon && Number(found.coupon.percent_off) === coupon.percentOff) {
    log(`${label}: ${coupon.code} existe déjà sur Stripe (${found.id}) → réutilisé`);
    return { code: coupon.code, percentOff: coupon.percentOff, couponId: found.coupon.id, promotionCodeId: found.id };
  }
  if (found) {
    await stripe.promotionCodes.update(found.id, { active: false });
    log(`${label}: ${found.id} (-${found.coupon ? found.coupon.percent_off : '?'} %) désactivé, remise différente`);
  }
  const created = await stripe.coupons.create(coupon.couponParams);
  const promo = await stripe.promotionCodes.create({ ...coupon.promotionParams, coupon: created.id });
  log(`${label}: créé ${coupon.code} (-${coupon.percentOff} %, ${promo.id})`);
  return { code: coupon.code, percentOff: coupon.percentOff, couponId: created.id, promotionCodeId: promo.id };
}
