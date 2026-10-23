#!/usr/bin/env node
/* ------------------------------------------------------------------
   build-meta.mjs — génère les métadonnées SEO de index.html à partir
   de product.json : <title>, meta description, Open Graph, Twitter Cards
   et JSON-LD Product (offre = prix du bundle 1 / quantité 1).

   Tout est écrit entre les marqueurs <!-- meta:start --> et <!-- meta:end -->
   de index.html ; l'exécution est idempotente (relancer ne change rien si
   product.json n'a pas bougé).

   Usage : node build-meta.mjs      (ou npm run build:meta)
   Appelé automatiquement par deploy.sh avant le commit.
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_FILE = path.join(ROOT, 'product.json');
const INDEX_FILE = path.join(ROOT, 'index.html');
const START = '<!-- meta:start -->';
const END = '<!-- meta:end -->';

function fail(msg) {
  console.error(`build-meta : ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(PRODUCT_FILE)) fail('product.json introuvable');
if (!fs.existsSync(INDEX_FILE)) fail('index.html introuvable');

const p = JSON.parse(fs.readFileSync(PRODUCT_FILE, 'utf8'));
const html = fs.readFileSync(INDEX_FILE, 'utf8');

const startAt = html.indexOf(START);
const endAt = html.indexOf(END);
if (startAt === -1 || endAt === -1 || endAt < startAt) {
  fail(`marqueurs ${START} / ${END} introuvables dans index.html`);
}

/* ---------- Données ---------- */

const siteUrl = normalizeUrl(p.siteUrl);
const brand = String(p.brand || '').trim();
const name = String(p.name || brand).trim();
const title = truncate(brand && !name.includes(brand) ? `${name} – ${brand}` : name, 70);
const description = truncate(oneLine(p.tagline || p.description || ''), 160);
const images = (Array.isArray(p.images) ? p.images : []).map(absolute).filter(Boolean);
const currency = String(p.currency || 'eur').toUpperCase();

// Offre : bundle quantité 1 (sinon premier bundle, sinon prix unitaire)
const bundles = Array.isArray(p.bundles) ? p.bundles : [];
const bundle1 = bundles.find((b) => Number(b.qty) === 1) || bundles[0];
const unit = Number(p.priceEur) || 0;
const price = bundle1
  ? round2(Number(bundle1.qty) * unit * (1 - (Number(bundle1.discountPct) || 0) / 100))
  : unit;
const inStock = Boolean(bundle1 && String(bundle1.paymentLink || '').trim());

const ld = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name,
  description: oneLine(p.description || p.tagline || ''),
  image: images,
  brand: { '@type': 'Brand', name: brand },
  color: Array.isArray(p.colors) && p.colors[0] ? p.colors[0] : undefined,
  offers: {
    '@type': 'Offer',
    url: siteUrl || undefined,
    priceCurrency: currency,
    price: price.toFixed(2),
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    itemCondition: 'https://schema.org/NewCondition',
  },
};

// Note agrégée : uniquement si rating.jsonld === true (les avis doivent être réels
// pour respecter les consignes Google sur les données structurées).
if (p.rating && p.rating.jsonld === true && Number(p.rating.value)) {
  const count = parseInt(String(p.rating.count || '').replace(/\D/g, ''), 10);
  if (count) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.rating.value),
      bestRating: 5,
      reviewCount: count,
    };
  }
}

/* ---------- Bloc HTML ---------- */

const lines = [
  `<title>${esc(title)}</title>`,
  `<meta name="description" content="${esc(description)}">`,
  siteUrl && `<link rel="canonical" href="${esc(siteUrl)}">`,
  '<meta property="og:type" content="product">',
  '<meta property="og:locale" content="fr_FR">',
  brand && `<meta property="og:site_name" content="${esc(brand)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  images[0] && `<meta property="og:image" content="${esc(images[0])}">`,
  siteUrl && `<meta property="og:url" content="${esc(siteUrl)}">`,
  `<meta property="product:price:amount" content="${price.toFixed(2)}">`,
  `<meta property="product:price:currency" content="${esc(currency)}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:title" content="${esc(title)}">`,
  `<meta name="twitter:description" content="${esc(description)}">`,
  images[0] && `<meta name="twitter:image" content="${esc(images[0])}">`,
  `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
].filter(Boolean);

const block = `${START}\n  ${lines.join('\n  ')}\n  ${END}`;
const next = html.slice(0, startAt) + block + html.slice(endAt + END.length);

if (next === html) {
  console.log('build-meta : index.html déjà à jour.');
} else {
  fs.writeFileSync(INDEX_FILE, next);
  console.log(`build-meta : index.html mis à jour (title « ${title} », prix ${price.toFixed(2)} ${currency}).`);
}

/* ---------- Utilitaires ---------- */

function normalizeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  return s.endsWith('/') ? s : s + '/';
}

function absolute(src) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return siteUrl ? siteUrl + s.replace(/^\.?\//, '') : s;
}

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function truncate(s, max) {
  const t = oneLine(s);
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
