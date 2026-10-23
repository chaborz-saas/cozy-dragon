/* ------------------------------------------------------------------
   Fonctions partagées par create-product.mjs et check.mjs :
   lecture de .env, validation de la clé Stripe, lecture/écriture de
   product.json, options de ligne de commande, formatage des montants.
   Aucune dépendance npm : utilisable avant même `npm install`.
   ------------------------------------------------------------------ */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = path.join(ROOT, '.env');
export const DEFAULT_PRODUCT_FILE = path.join(ROOT, 'product.json');
export const DEFAULT_SITE_URL = 'https://chaborz-saas.github.io/cozy-dragon/';

/* ---------- Sortie ---------- */

export function fail(message) {
  console.error(`\nErreur : ${message}\n`);
  process.exit(1);
}

export function log(message = '') {
  console.log(message);
}

export function warn(message) {
  console.log(`Attention : ${message}`);
}

/* ---------- Ligne de commande ---------- */

// parseArgs(['--dry-run', '--file', 'x.json']) → { 'dry-run': true, file: 'x.json' }
// Accepte aussi --file=x.json. Toute option inconnue arrête le script.
export function parseArgs(argv, { flags = [], options = [], usage = '' } = {}) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`argument inattendu : "${arg}"\n${usage}`);
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (flags.includes(name)) {
      if (eq !== -1) fail(`l'option --${name} ne prend pas de valeur\n${usage}`);
      out[name] = true;
    } else if (options.includes(name)) {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined || value === '') fail(`l'option --${name} attend une valeur\n${usage}`);
      out[name] = value;
    } else {
      fail(`option inconnue : ${arg}\n${usage}`);
    }
  }
  return out;
}

/* ---------- .env et clé Stripe ---------- */

// Mini parseur .env : KEY=value, commentaires #, guillemets optionnels.
// Les variables déjà présentes dans l'environnement ont la priorité.
export function loadEnv(file) {
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

// Retourne { key, mode } ; mode vaut "test", "live" ou null (pas de clé).
export function readStripeKey({ required }) {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (key.startsWith('pk_')) {
    fail(
      'STRIPE_SECRET_KEY est une clé PUBLIQUE (pk_...). Il faut la clé SECRÈTE (sk_live_... ou sk_test_...),\n' +
        'visible dans le Dashboard Stripe > Développeurs > Clés API.'
    );
  }
  if (!key && required) {
    fail(`STRIPE_SECRET_KEY manquante. Copiez .env.example vers .env (${ENV_FILE}) et collez votre clé secrète Stripe.`);
  }
  if (key && !/^(sk|rk)_(live|test)_/.test(key)) {
    fail('STRIPE_SECRET_KEY ne ressemble pas à une clé secrète Stripe (sk_live_... ou sk_test_...).');
  }
  const mode = key ? (key.includes('_test_') ? 'test' : 'live') : null;
  return { key, mode };
}

// Message lisible pour une erreur renvoyée par le SDK Stripe.
export function describeStripeError(err) {
  if (err && err.type === 'StripeAuthenticationError') {
    return 'clé Stripe refusée (STRIPE_SECRET_KEY invalide, révoquée ou du mauvais compte).';
  }
  if (err && err.type === 'StripePermissionError') {
    return (
      `la clé Stripe n'a pas les droits nécessaires (${err.message}).\n` +
      'Utilisez la clé secrète complète, ou une clé restreinte avec accès en écriture aux Produits, Prix,\n' +
      'Payment Links, Tarifs de livraison, Coupons et Codes promotionnels.'
    );
  }
  if (err && err.type === 'StripeConnectionError') {
    return `impossible de joindre l'API Stripe (${err.message}). Vérifiez la connexion réseau.`;
  }
  const code = err && err.code ? ` (code ${err.code})` : '';
  return `Stripe a répondu : ${err && err.message ? err.message : String(err)}${code}`;
}

/* ---------- product.json ---------- */

export function readProduct(file) {
  if (!fs.existsSync(file)) fail(`product.json introuvable : ${file}`);
  let product;
  try {
    product = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`product.json illisible (${file}) : ${err.message}`);
  }
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    fail(`product.json (${file}) doit contenir un objet JSON`);
  }
  return product;
}

export function writeProduct(file, product) {
  fs.writeFileSync(file, JSON.stringify(product, null, 2) + '\n');
}

/* ---------- Montants, URL, signatures ---------- */

export function toCents(eur, label, { allowZero = false } = {}) {
  const n = Number(eur);
  const ok = Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
  if (!ok) fail(`${label} invalide : "${eur}" (attendu un nombre ${allowZero ? '≥ 0' : '> 0'}, ex. 39.90)`);
  return Math.round(n * 100);
}

export function money(cents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

// Garantit une URL http(s) terminée par « / ».
export function normalizeSiteUrl(url, label = 'SITE_URL') {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) fail(`${label} invalide : "${value}" (URL https attendue, ex. ${DEFAULT_SITE_URL})`);
  return value.endsWith('/') ? value : `${value}/`;
}

// "img/1.jpg" → "https://site/img/1.jpg" ; une URL déjà absolue est conservée.
export function absoluteUrl(src, siteUrl) {
  const value = String(src || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return siteUrl + value.replace(/^\.?\//, '');
}

// Empreinte courte et stable d'un objet (clés triées) : sert à détecter
// qu'un Product ou un Payment Link doit être mis à jour ou recréé.
export function sig(value) {
  return crypto.createHash('sha1').update(JSON.stringify(canonical(value))).digest('hex').slice(0, 12);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])])
    );
  }
  return value;
}
