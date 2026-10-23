#!/usr/bin/env node
/* ------------------------------------------------------------------
   Vérifie que les Payment Links enregistrés dans product.json sont bien
   actifs sur Stripe et affiche leur URL (plus le code promo s'il existe).

   Usage :
     node stripe/check.mjs                 # interroge Stripe (clé requise)
     node stripe/check.mjs --dry-run       # affiche ce qui serait vérifié, sans appel
     node stripe/check.mjs --file chemin   # autre product.json (défaut : ./product.json)

   Sans clé dans .env, se comporte comme --dry-run.
   Sort avec le code 1 si un lien est manquant, inactif ou si son URL diffère
   de celle de product.json (relancer alors `npm run stripe:create`).
   ------------------------------------------------------------------ */

import path from 'node:path';
import {
  DEFAULT_PRODUCT_FILE,
  ENV_FILE,
  describeStripeError,
  fail,
  loadEnv,
  log,
  parseArgs,
  readProduct,
  readStripeKey,
  warn,
} from './lib.mjs';

const USAGE = 'Usage : node stripe/check.mjs [--dry-run] [--file chemin]';

const args = parseArgs(process.argv.slice(2), { flags: ['dry-run', 'help'], options: ['file'], usage: USAGE });
if (args.help) {
  log(USAGE);
  process.exit(0);
}

const PRODUCT_FILE = args.file ? path.resolve(args.file) : DEFAULT_PRODUCT_FILE;

loadEnv(ENV_FILE);
const { key, mode } = readStripeKey({ required: false });
const DRY_RUN = Boolean(args['dry-run']) || !key;

const product = readProduct(PRODUCT_FILE);
if (!Array.isArray(product.bundles) || product.bundles.length === 0) {
  fail('product.json : "bundles" manquant ou vide (nouveau schéma attendu, voir stripe/README.md).');
}
const saved = product.stripe && typeof product.stripe === 'object' ? product.stripe : {};
const savedBundles = saved.bundles || {};
const upsellEnabled = Boolean(product.upsell && product.upsell.enabled);

/* ---------- Liste des liens attendus ---------- */

const links = [];
for (const b of product.bundles) {
  const s = savedBundles[b.id] || {};
  links.push({ bundle: b.id, kind: 'sans upsell', id: s.linkId || null, url: (b.paymentLink || '').trim() });
  if (upsellEnabled || s.linkWithUpsellId || b.paymentLinkWithUpsell) {
    links.push({ bundle: b.id, kind: 'avec upsell', id: s.linkWithUpsellId || null, url: (b.paymentLinkWithUpsell || '').trim() });
  }
}

log(`Fichier : ${PRODUCT_FILE}`);
log(`Mode    : ${mode || 'inconnu (pas de clé)'}${saved.mode ? ` — identifiants enregistrés en mode ${saved.mode}` : ''}\n`);

if (DRY_RUN) {
  log(key ? '--- DRY RUN : rien ne sera demandé à Stripe ---' : '--- STRIPE_SECRET_KEY absente : affichage seul, rien ne sera demandé à Stripe ---');
  log(`\n${links.length} lien(s) seraient vérifiés (actif sur Stripe + URL identique à product.json) :`);
  for (const l of links) {
    log(`  ${l.bundle.padEnd(4)}${l.kind.padEnd(13)} ${l.id ? l.id.padEnd(32) : 'non créé'.padEnd(32)} ${l.url || '(URL vide)'}`);
  }
  if (saved.coupon && saved.coupon.promotionCodeId) {
    log(`\nCode promo ${saved.coupon.code} (${saved.coupon.promotionCodeId}) serait vérifié.`);
  }
  const missing = links.filter((l) => !l.id || !l.url);
  if (missing.length) log(`\n${missing.length} lien(s) non créé(s) : lancez \`npm run stripe:create\`.`);
  log('');
  process.exit(0);
}

/* ---------- Vérification sur Stripe ---------- */

if (saved.mode && saved.mode !== mode) {
  fail(
    `les identifiants de product.json sont en mode "${saved.mode}" mais la clé est en mode "${mode}".\n` +
      'Utilisez la clé du même mode, ou relancez `npm run stripe:create` avec cette clé.'
  );
}

const { default: Stripe } = await import('stripe');
const stripe = new Stripe(key);

let problems = 0;
const problem = (message) => {
  problems += 1;
  return `PROBLÈME  ${message}`;
};

try {
  log(`Liens de paiement (${links.length})`);
  for (const l of links) {
    const label = `  ${l.bundle.padEnd(4)}${l.kind.padEnd(13)}`;
    if (!l.id) {
      log(`${label} ${problem('non créé — lancez `npm run stripe:create`')}`);
      continue;
    }
    let link;
    try {
      link = await stripe.paymentLinks.retrieve(l.id);
    } catch (err) {
      if (err && err.code === 'resource_missing') {
        log(`${label} ${problem(`${l.id} introuvable sur Stripe (supprimé ou autre compte)`)}`);
        continue;
      }
      throw err;
    }
    if (!link.active) {
      log(`${label} ${problem(`${l.id} est INACTIF — ${link.url}`)}`);
    } else if (link.url !== l.url) {
      log(`${label} ${problem(`${l.id} actif mais product.json a une autre URL (Stripe : ${link.url}, fichier : ${l.url || 'vide'})`)}`);
    } else {
      log(`${label} OK        ${link.url}`);
    }
  }

  if (saved.coupon && saved.coupon.promotionCodeId) {
    const promo = await stripe.promotionCodes.retrieve(saved.coupon.promotionCodeId);
    const pct = promo.coupon ? promo.coupon.percent_off : '?';
    if (promo.active && promo.code === saved.coupon.code) {
      log(`\nCode promo ${promo.code} : OK (-${pct} %, ${promo.id})`);
    } else {
      log(`\nCode promo ${saved.coupon.code} : ${problem(`${promo.id} ${promo.active ? `porte le code ${promo.code}` : 'est INACTIF'}`)}`);
    }
  } else {
    log('\nCode promo : aucun enregistré (créé par `npm run stripe:create` sans --no-coupon).');
  }
} catch (err) {
  fail(describeStripeError(err));
}

if (problems) {
  warn(`${problems} problème(s). Relancez \`npm run stripe:create\` pour recréer ce qui manque, puis redéployez.`);
  log('');
  process.exit(1);
}
log('\nTout est en ordre.\n');
