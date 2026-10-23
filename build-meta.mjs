#!/usr/bin/env node
/* ------------------------------------------------------------------
   build-meta.mjs — génère les métadonnées SEO à partir de product.json :
   <title>, meta description, Open Graph, Twitter Cards et JSON-LD Product
   (offre = prix du bundle 1 / quantité 1).

   Cibles : index.html (accueil, og:type website) et produit.html (fiche
   produit, og:type product) — produit.html est ignoré s'il n'existe pas.
   Tout est écrit entre les marqueurs <!-- meta:start --> et <!-- meta:end -->
   de chaque fichier ; l'exécution est idempotente.

   Usage : node build-meta.mjs      (ou npm run build:meta)
   Appelé automatiquement par deploy.sh avant le commit.
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_FILE = path.join(ROOT, 'product.json');
const START = '<!-- meta:start -->';
const END = '<!-- meta:end -->';

function fail(msg) {
  console.error(`build-meta : ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(PRODUCT_FILE)) fail('product.json introuvable');
if (!fs.existsSync(path.join(ROOT, 'index.html'))) fail('index.html introuvable');

const p = JSON.parse(fs.readFileSync(PRODUCT_FILE, 'utf8'));

/* ---------- Données communes ---------- */

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

/* ---------- Cibles ---------- */

const targets = [
  { file: 'index.html', ogType: 'website', url: siteUrl, required: true },
  { file: 'produit.html', ogType: 'product', url: siteUrl ? siteUrl + 'produit.html' : '', required: false },
];

for (const t of targets) {
  const file = path.join(ROOT, t.file);
  if (!fs.existsSync(file)) {
    if (t.required) fail(`${t.file} introuvable`);
    console.log(`build-meta : ${t.file} absent, ignoré.`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const startAt = html.indexOf(START);
  const endAt = html.indexOf(END);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    fail(`marqueurs ${START} / ${END} introuvables dans ${t.file}`);
  }
  const block = `${START}\n  ${metaLines(t).join('\n  ')}\n  ${END}`;
  const next = html.slice(0, startAt) + block + html.slice(endAt + END.length);
  if (next === html) {
    console.log(`build-meta : ${t.file} déjà à jour.`);
  } else {
    fs.writeFileSync(file, next);
    console.log(`build-meta : ${t.file} mis à jour (title « ${title} », prix ${price.toFixed(2)} ${currency}).`);
  }
}

/* ---------- Bloc HTML d'une cible ---------- */

function metaLines({ ogType, url }) {
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
      url: url || undefined,
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
      ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(p.rating.value), bestRating: 5, reviewCount: count };
    }
  }

  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    url && `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${esc(ogType)}">`,
    '<meta property="og:locale" content="fr_FR">',
    brand && `<meta property="og:site_name" content="${esc(brand)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    images[0] && `<meta property="og:image" content="${esc(images[0])}">`,
    url && `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="product:price:amount" content="${price.toFixed(2)}">`,
    `<meta property="product:price:currency" content="${esc(currency)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    images[0] && `<meta name="twitter:image" content="${esc(images[0])}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean);
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
