/* ==================================================================
   Cozy Dragon — app.js  (démo interne : réplique visuelle « Horizon »)
   Charge ./product.json et construit les pages. Aucune dépendance.

   Organisation du fichier :
     1. Icônes SVG inline
     2. Point d'entrée (selon <body data-page="…">)
     3. Éléments communs : bandeau démo, marquee, en-tête, recherche,
        menu mobile, pied de page, cookies, toast
     4. Panier (état + tiroir + choix du Payment Link Stripe)
     5. Galerie + visionneuse
     6. Composants : pastilles, nuancier, compteur de quantité, accordéon
     7. Accueil (produit vedette)
     8. Page produit (bundles, vente additionnelle, sections)
     9. Pages produit simples (chaussons, porte-clés)
    10. Sections partagées : diaporama, TikTok, témoignages, FAQ, contact,
        barre d'achat fixe
    11. Utilitaires

   Logique d'achat : le panier (localStorage) contient des lignes
   { id, size, color, qty }. Au clic sur « Commander », on compte les
   onesies (N) et les chaussons (S) : si 1 ≤ N ≤ 3 et S ≤ 1, on utilise
   bundles[N-1].paymentLink (ou .paymentLinkWithUpsell) avec un
   client_reference_id du type « b2_M-L_noir-noir_CH-M ». Sinon on prend
   le pack le plus proche et on l'indique. Lien vide = « Paiement bientôt
   disponible ».
   ================================================================== */

'use strict';

const CART_KEY = 'cozydragon:cart';
const COOKIE_KEY = 'cozydragon:cookies';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==================================================================
   1. Icônes SVG inline (trait 24 px)
   ================================================================== */

const STAR_PATH = 'M12 2.6l2.8 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2 6.2 20.4l1.3-6.5L2.6 9.4l6.6-.8z';

const ICONS = {
  star: `<path fill="currentColor" stroke="none" d="${STAR_PATH}"/>`,
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'arrow-left': '<path d="M15 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l4 4v3h-8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  play: '<path fill="currentColor" stroke="none" d="M7 4.5v15l13-7.5z"/>',
  mail: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 7l10 7 10-7"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ==================================================================
   2. Point d'entrée
   ================================================================== */

(async function main() {
  const p = await loadProduct();
  if (!p) return;

  const cart = createCart(p);
  initChrome(p, cart);

  const page = document.body.dataset.page || '';
  if (page === 'home') renderHome(p, cart);
  else if (page === 'product') renderProduct(p, cart);
  else if (page === 'simple-product') renderSimpleProduct(p, cart, document.body.dataset.product || '');

  if (q('#tiktok-grid')) renderTiktok(p);
  if (q('#contact-form')) setupContact(p);
})();

async function loadProduct() {
  try {
    const res = await fetch('./product.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const box = q('#load-error');
    if (box) {
      box.hidden = false;
      box.textContent = 'Impossible de charger product.json (' + err.message + '). ' +
        'Ouvrez la boutique via un serveur (npm run serve), pas en double-cliquant sur le fichier.';
    }
    console.error(err);
    return null;
  }
}

/* ==================================================================
   3. Éléments communs à toutes les pages
   ================================================================== */

function initChrome(p, cart) {
  fillCommon(p);
  renderAnnouncement(p.announcement || {});
  renderFooterLinks(p.footer || {});
  renderPayments();
  setupSearch();
  setupMobileMenu(p);
  setupCookies(p.cookies || {});
  setupToast();
  setupLightboxShell();
  setupDrawer(p, cart);

  const cartBtn = q('#cart-btn');
  if (cartBtn) cartBtn.addEventListener('click', () => cart.open());
  cart.onChange(() => updateCartCount(cart));
  updateCartCount(cart);

  // Lien actif dans la navigation
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  qa('.nav a, .mobile-menu__panel a').forEach((a) => {
    const target = (a.getAttribute('href') || '').replace(/^\.\//, '').toLowerCase();
    if (target === file || (file === '' && target === 'index.html')) a.setAttribute('aria-current', 'page');
  });
}

function fillCommon(p) {
  qa('[data-brand]').forEach((n) => { n.textContent = p.brand || ''; });
  qa('[data-year]').forEach((n) => { n.textContent = String(new Date().getFullYear()); });
  qa('[data-email]').forEach((n) => { n.textContent = p.supportEmail || ''; });
  qa('[data-email-link]').forEach((n) => {
    if (p.supportEmail) n.href = 'mailto:' + p.supportEmail; else n.hidden = true;
  });
  qa('[data-icon]').forEach((n) => { n.innerHTML = icon(n.dataset.icon); });
  qa('[data-shipping]').forEach((n) => {
    const text = (p.shipping || {})[n.dataset.shipping];
    if (text) n.textContent = text;
  });
  if (p.demo && p.demo.strip) qa('[data-demo-strip]').forEach((n) => { n.textContent = p.demo.strip; });
}

/* Barre d'annonce : texte répété, deux groupes identiques pour une boucle
   CSS sans couture (translateX(-50 %)). Pause au survol, statique si
   l'utilisateur préfère réduire les animations. */
function renderAnnouncement(a) {
  const box = q('#announce');
  const track = q('#announce-track');
  if (!box || !track) return;
  if (!a.text) { box.hidden = true; return; }
  const repeat = Math.max(1, Math.min(12, Number(a.repeat) || 6));
  let item = escapeHtml(a.text);
  if (a.code) item = item.split(escapeHtml(a.code)).join(`<strong>${escapeHtml(a.code)}</strong>`);
  const group = `<div class="announce__group">${`<span class="announce__item">${item}</span>`.repeat(repeat)}</div>`;
  track.innerHTML = group + group.replace('class="announce__group"', 'class="announce__group" aria-hidden="true"');
}

function renderFooterLinks(f) {
  const nav = q('[data-footer-links]');
  if (!nav || !Array.isArray(f.links) || !f.links.length) return;
  nav.innerHTML = f.links.map((l) => {
    const href = String(l.href || '#');
    const isCookie = href === '#cookies';
    return `<a href="${escapeHtml(isCookie ? '#cookies' : './' + href.replace(/^\.?\//, ''))}"${isCookie ? ' data-cookie-prefs' : ''}>${escapeHtml(l.label || '')}</a>`;
  }).join('');
  if (f.heading) qa('.footer__heading').forEach((h) => { h.textContent = f.heading; });
}

/* Icônes de paiement génériques (rectangles gris, texte) — aucune œuvre de marque. */
function renderPayments() {
  const box = q('[data-payments]');
  if (!box) return;
  const card = (label, extra = '') => `
    <svg viewBox="0 0 38 24" role="img" aria-label="${escapeHtml(label)}">
      <rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#fff" stroke="#d9d9d9"/>
      ${extra || `<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="700" fill="#444">${escapeHtml(label)}</text>`}
    </svg>`;
  box.innerHTML = [
    card('VISA'),
    card('Mastercard', '<circle cx="15" cy="12" r="6" fill="#bdbdbd"/><circle cx="23" cy="12" r="6" fill="#8a8a8a" fill-opacity="0.85"/>'),
    card('AMEX'),
    card('Apple Pay', '<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#444">Pay</text>'),
    card('Google Pay', '<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#444">G Pay</text>'),
  ].join('');
}

/* Recherche : simple overlay avec un champ (démo, aucun index). */
function setupSearch() {
  const btn = q('#search-btn');
  if (!btn) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="Recherche">
      <form class="search-overlay__inner" id="search-form" role="search">
        <input class="search-overlay__input" id="search-input" type="search" placeholder="Rechercher" aria-label="Rechercher" autocomplete="off">
        <button type="button" class="icon-btn" id="search-close" aria-label="Fermer">${icon('close')}</button>
      </form>
      <p class="search-overlay__hint">Démo : la recherche n'est pas branchée.</p>
    </div>`);
  const overlay = q('#search-overlay');
  const input = q('#search-input');
  const open = () => { overlay.classList.add('is-open'); lockScroll(true); setTimeout(() => input.focus(), 30); };
  const close = () => { overlay.classList.remove('is-open'); lockScroll(false); btn.focus(); };
  btn.addEventListener('click', open);
  q('#search-close').addEventListener('click', close);
  q('#search-form').addEventListener('submit', (e) => { e.preventDefault(); toast('Recherche (démo) : « ' + input.value.trim() + ' »'); close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* Menu mobile : panneau latéral gauche. */
function setupMobileMenu(p) {
  const btn = q('#menu-btn');
  if (!btn) return;
  const products = p.products || {};
  const links = [
    ['./index.html', 'Accueil'],
    ['./produit.html', p.name || 'Produit'],
    products.slippers ? ['./' + (products.slippers.page || 'chaussons.html'), products.slippers.name] : null,
    products.keychain ? ['./' + (products.keychain.page || 'porte-cles.html'), products.keychain.name] : null,
    ['./contact.html', 'Contact'],
  ].filter(Boolean);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="mobile-menu__overlay" data-close></div>
      <div class="mobile-menu__panel">
        <button type="button" class="icon-btn mobile-menu__close" aria-label="Fermer" data-close>${icon('close')}</button>
        ${links.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')}
        <div class="mobile-menu__meta"><span>${icon('globe')}</span><span>EUR €</span><a href="#" style="border:0;padding:0;font-size:13px;margin-left:auto">${icon('user')}</a></div>
      </div>
    </div>`);
  const menu = q('#mobile-menu');
  const open = () => { menu.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); lockScroll(true); };
  const close = () => { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); lockScroll(false); };
  btn.addEventListener('click', open);
  menu.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', close));
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* Consentement cookies : purement cosmétique (aucun traceur), choix mémorisé. */
function setupCookies(c) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="cookie" id="cookie" role="dialog" aria-labelledby="cookie-title">
      <p class="cookie__title" id="cookie-title">${escapeHtml(c.title || 'Consentement aux cookies')}</p>
      <p class="cookie__text">${escapeHtml(c.text || '')}</p>
      <div class="cookie__prefs" id="cookie-prefs" hidden>
        <label><input type="checkbox" checked disabled> <span>Essentiels <small>(toujours actifs)</small></span></label>
        <label><input type="checkbox" id="cookie-analytics"> <span>Mesure d'audience</span></label>
        <label><input type="checkbox" id="cookie-marketing"> <span>Marketing</span></label>
      </div>
      <div class="cookie__actions">
        <button type="button" class="btn btn--sm btn--outline" id="cookie-manage">${escapeHtml(c.manage || 'Gérer les préférences')}</button>
        <button type="button" class="btn btn--sm btn--black" id="cookie-accept">${escapeHtml(c.accept || 'Accepter')}</button>
        <button type="button" class="btn btn--sm btn--outline" id="cookie-decline">${escapeHtml(c.decline || 'Refuser')}</button>
      </div>
    </div>`);
  const box = q('#cookie');
  const prefs = q('#cookie-prefs');
  const manage = q('#cookie-manage');
  const saved = readStorage(COOKIE_KEY);

  function open() {
    if (saved && typeof saved === 'object') {
      q('#cookie-analytics').checked = Boolean(saved.analytics);
      q('#cookie-marketing').checked = Boolean(saved.marketing);
    }
    box.classList.add('is-open');
  }
  function close(choice) {
    writeStorage(COOKIE_KEY, { choice, analytics: q('#cookie-analytics').checked, marketing: q('#cookie-marketing').checked, at: Date.now() });
    box.classList.remove('is-open');
    prefs.hidden = true;
    manage.textContent = c.manage || 'Gérer les préférences';
  }

  manage.addEventListener('click', () => {
    if (prefs.hidden) { prefs.hidden = false; manage.textContent = c.save || 'Enregistrer les préférences'; }
    else close('custom');
  });
  q('#cookie-accept').addEventListener('click', () => { q('#cookie-analytics').checked = true; q('#cookie-marketing').checked = true; close('accept'); });
  q('#cookie-decline').addEventListener('click', () => { q('#cookie-analytics').checked = false; q('#cookie-marketing').checked = false; close('decline'); });
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-cookie-prefs], a[href="#cookies"]');
    if (!link) return;
    e.preventDefault();
    open();
    prefs.hidden = false;
    manage.textContent = c.save || 'Enregistrer les préférences';
  });

  if (!saved) setTimeout(open, 600);
}

function setupToast() {
  document.body.insertAdjacentHTML('beforeend', '<div class="toast" id="toast" role="status" aria-live="polite"></div>');
}
let toastTimer = null;
function toast(msg) {
  const t = q('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2600);
}

function lockScroll(lock) { document.body.classList.toggle('is-locked', Boolean(lock)); }

/* ==================================================================
   4. Panier : état (localStorage), tiroir, Payment Link Stripe
   ================================================================== */

function createCart(p) {
  const products = p.products || {};
  const bundles = (Array.isArray(p.bundles) ? p.bundles : [])
    .filter((b) => b && b.id && Number(b.qty) > 0)
    .sort((a, b) => Number(a.qty) - Number(b.qty));
  const unit = Number(p.priceEur) || 0;
  const texts = p.cart || {};
  const protection = texts.protection && texts.protection.enabled ? texts.protection : null;
  const listeners = [];

  /* --- État --- */
  const raw = readStorage(CART_KEY);
  const state = {
    items: raw && Array.isArray(raw.items) ? raw.items.filter(validLine).map(normalizeLine) : [],
    protection: Boolean(raw && raw.protection),
  };
  let openFn = () => {};

  function validLine(l) { return l && typeof l === 'object' && typeof l.id === 'string' && (l.id === 'onesie' || products[l.id]); }
  function normalizeLine(l) {
    return { id: l.id, size: String(l.size || ''), color: String(l.color || ''), qty: Math.max(1, Math.min(99, Math.round(Number(l.qty) || 1))) };
  }
  function lineKey(l) { return [l.id, l.size, l.color].join('|'); }
  function persist() { writeStorage(CART_KEY, state); }
  function emit() { listeners.forEach((fn) => fn()); }

  /* --- Informations produit --- */
  function productOf(id) { return products[id] || null; }
  function unitPrice(id) {
    if (id === 'onesie') return unit;
    const pr = productOf(id);
    return pr ? Number(pr.priceEur) || 0 : 0;
  }
  function compareAt(id) {
    if (id === 'onesie') return Number(p.compareAtEur) || 0;
    const pr = productOf(id);
    return pr ? Number(pr.compareAtEur) || 0 : 0;
  }
  function titleOf(id) {
    if (id === 'onesie') return p.name || 'Produit';
    const pr = productOf(id);
    return pr ? pr.name || id : id;
  }
  function imageOf(id) {
    if (id === 'onesie') return p.thumbnail || (p.images || [])[0] || '';
    const pr = productOf(id);
    return pr ? pr.image || (pr.images || [])[0] || '' : '';
  }
  function variantText(l) { return [l.size, l.color].filter(Boolean).join(' / '); }

  /* --- Tarification : remise de pack appliquée sur les onesies (10 % à 2, 20 % à 3+) --- */
  function discountPct(n) {
    if (n < 1 || !bundles.length) return 0;
    return Number(bundles[Math.min(n, bundles.length) - 1].discountPct) || 0;
  }
  function onesiePrice(n) { return round2(n * unit * (1 - discountPct(n) / 100)); }

  function totals(items = state.items, withProtection = state.protection) {
    let onesies = 0;
    let others = 0;
    let count = 0;
    items.forEach((l) => {
      const qty = Number(l.qty) || 0;
      count += qty;
      if (l.id === 'onesie') onesies += qty; else others += unitPrice(l.id) * qty;
    });
    const gross = round2(onesies * unit);
    const net = onesiePrice(onesies);
    const prot = protection && withProtection ? Number(protection.priceEur) || 0 : 0;
    return {
      count, onesies,
      discountPct: discountPct(onesies),
      discount: round2(gross - net),
      protection: prot,
      subtotal: round2(net + others + prot),
    };
  }

  /* --- Choix du Payment Link + client_reference_id --- */
  function expand(lines) {
    const out = [];
    lines.forEach((l) => { for (let i = 0; i < (Number(l.qty) || 0); i++) out.push(l); });
    return out;
  }
  function plan(items = state.items) {
    const ones = expand(items.filter((l) => l.id === 'onesie'));
    const slip = expand(items.filter((l) => l.id === 'slippers'));
    const extra = items.filter((l) => l.id !== 'onesie' && l.id !== 'slippers');
    if (!bundles.length) return { link: '', ref: '', exact: false, bundle: null, withUpsell: false };
    const n = ones.length;
    const bundle = bundles[Math.min(Math.max(n, 1), bundles.length) - 1];
    const bq = Number(bundle.qty);
    const withUpsell = slip.length >= 1;
    const link = String((withUpsell ? bundle.paymentLinkWithUpsell : bundle.paymentLink) || '').trim();
    const exact = n >= 1 && n === bq && slip.length <= 1 && !extra.length;
    const picked = ones.slice(0, bq);
    const fallback = { size: (p.sizes || [])[0] || '', color: (p.colors || [])[0] || '' };
    while (picked.length < bq) picked.push(picked[picked.length - 1] || fallback);
    let ref = [bundle.id, picked.map((i) => i.size).join('-'), picked.map((i) => (i.color || '').toLowerCase()).join('-')].join('_');
    if (withUpsell) ref += '_CH-' + (slip[0].size || '');
    return { link, ref: sanitizeRef(ref), exact, bundle, withUpsell };
  }
  function checkoutUrl(items) {
    const pl = plan(items);
    if (!pl.link) return '';
    return pl.link + (pl.link.includes('?') ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(pl.ref);
  }

  /* --- Mutations --- */
  function add(lines) {
    lines.filter(validLine).map(normalizeLine).forEach((l) => {
      const existing = state.items.find((i) => lineKey(i) === lineKey(l));
      if (existing) existing.qty = Math.min(99, existing.qty + l.qty); else state.items.push(l);
    });
    persist(); emit();
  }
  function setQty(index, qty) {
    const l = state.items[index];
    if (!l) return;
    const n = Math.round(Number(qty) || 0);
    if (n <= 0) state.items.splice(index, 1); else l.qty = Math.min(99, n);
    persist(); emit();
  }
  function remove(index) { if (state.items[index]) { state.items.splice(index, 1); persist(); emit(); } }
  function setProtection(on) { state.protection = Boolean(on); persist(); emit(); }

  return {
    items: () => state.items.slice(),
    count: () => totals().count,
    hasProtection: () => state.protection,
    protection, texts,
    add, setQty, remove, setProtection,
    totals, plan, checkoutUrl, onesiePrice, discountPct,
    unitPrice, compareAt, titleOf, imageOf, variantText,
    onChange: (fn) => listeners.push(fn),
    open: () => openFn(),
    _setOpen: (fn) => { openFn = fn; },
  };
}

function updateCartCount(cart) {
  const n = cart.count();
  qa('[data-cart-count]').forEach((b) => { b.textContent = String(n); b.hidden = n === 0; });
}

/* Tiroir latéral droit */
function setupDrawer(p, cart) {
  const t = cart.texts;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="drawer-overlay" id="drawer-overlay"></div>
    <aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-hidden="true">
      <div class="drawer__head">
        <h2 class="drawer__title" id="drawer-title">${escapeHtml(t.title || 'Panier')}</h2>
        <button type="button" class="icon-btn" id="drawer-close" aria-label="Fermer le panier">${icon('close')}</button>
      </div>
      <div class="drawer__body" id="drawer-body"></div>
      <div class="drawer__foot" id="drawer-foot"></div>
    </aside>`);
  const drawer = q('#drawer');
  const overlay = q('#drawer-overlay');
  const body = q('#drawer-body');
  const foot = q('#drawer-foot');
  const cur = p.currency;

  function open() { render(); drawer.classList.add('is-open'); overlay.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); lockScroll(true); setTimeout(() => q('#drawer-close').focus(), 50); }
  function close() { drawer.classList.remove('is-open'); overlay.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); lockScroll(false); }

  function render() {
    const items = cart.items();
    body.innerHTML = '';
    foot.innerHTML = '';
    foot.hidden = !items.length;

    if (!items.length) {
      body.innerHTML = `
        <div class="drawer__empty">
          <p>${escapeHtml(t.empty || 'Votre panier est vide')}</p>
          <button type="button" class="btn btn--black" id="drawer-continue">${escapeHtml(t.continue || 'Continuer vos achats')}</button>
        </div>`;
      q('#drawer-continue').addEventListener('click', close);
      return;
    }

    items.forEach((line, i) => body.append(lineEl(line, i)));

    if (cart.protection) {
      const pr = cart.protection;
      const on = cart.hasProtection();
      const row = el('div', 'cart-protect');
      row.innerHTML = `
        ${pr.icon ? `<img class="cart-protect__icon" src="${escapeHtml(pr.icon)}" alt="" width="36" height="36" loading="lazy">` : '<span></span>'}
        <div><p class="cart-protect__title">${escapeHtml(pr.title || '')}</p><p class="cart-protect__text">${escapeHtml(pr.text || '')}</p></div>
        <div class="cart-protect__right"><span>${formatPrice(pr.priceEur, cur)}</span>
          <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${escapeHtml(pr.title || 'Protection')}"></button></div>`;
      row.querySelector('.switch').addEventListener('click', (e) => cart.setProtection(e.currentTarget.getAttribute('aria-checked') !== 'true'));
      body.append(row);
    }

    const tot = cart.totals();
    const pl = cart.plan();
    foot.innerHTML = `
      ${tot.discount > 0 ? `<div class="drawer__line"><span>${escapeHtml(t.discountLabel || 'Remise pack')} (-${tot.discountPct} %)</span><span>-${formatPrice(tot.discount, cur)}</span></div>` : ''}
      ${tot.protection > 0 ? `<div class="drawer__line"><span>${escapeHtml(cart.protection.title || '')}</span><span>${formatPrice(tot.protection, cur)}</span></div>` : ''}
      <div class="drawer__subtotal"><span>${escapeHtml(t.subtotal || 'Sous-total')}</span><span>${formatPrice(tot.subtotal, cur)}</span></div>
      <p class="drawer__note">${escapeHtml(t.note || '')}</p>
      ${!pl.exact ? `<p class="drawer__warn">${escapeHtml(t.closestNote || '')}${pl.bundle ? ` (${escapeHtml(pl.bundle.title || pl.bundle.id)}${pl.withUpsell ? ' + chaussons' : ''})` : ''}</p>` : ''}
      <button type="button" class="btn btn--black btn--full" id="drawer-checkout"${pl.link ? '' : ' disabled'}>${escapeHtml(pl.link ? (t.checkout || 'Commander') : (t.soon || 'Paiement bientôt disponible'))}</button>`;
    const btn = q('#drawer-checkout');
    btn.addEventListener('click', () => { const url = cart.checkoutUrl(); if (url) location.href = url; });
  }

  function lineEl(line, index) {
    const node = el('div', 'cart-line');
    const unitP = cart.unitPrice(line.id);
    const cmp = cart.compareAt(line.id);
    const img = cart.imageOf(line.id);
    node.innerHTML = `
      ${img ? `<img class="cart-line__img" src="${escapeHtml(img)}" alt="" width="72" height="72" loading="lazy">` : '<span></span>'}
      <div>
        <p class="cart-line__title">${escapeHtml(cart.titleOf(line.id))}</p>
        ${cart.variantText(line) ? `<p class="cart-line__variant">${escapeHtml(cart.variantText(line))}</p>` : ''}
        <p class="cart-line__price">${formatPrice(unitP, cur)}${cmp ? `<s>${formatPrice(cmp, cur)}</s>` : ''}</p>
        <div class="cart-line__bottom"></div>
      </div>
      <div class="cart-line__right">
        <span>${formatPrice(unitP * line.qty, cur)}</span>
        <button type="button" class="icon-btn cart-line__remove" aria-label="Supprimer">${icon('close')}</button>
      </div>`;
    node.querySelector('.cart-line__bottom').append(makeQty({ value: line.qty, min: 0, max: 99, small: true, onChange: (v) => cart.setQty(index, v) }));
    node.querySelector('.cart-line__remove').addEventListener('click', () => cart.remove(index));
    return node;
  }

  q('#drawer-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  cart.onChange(() => { if (drawer.classList.contains('is-open')) render(); });
  cart._setOpen(open);
}

/* ==================================================================
   5. Galerie (scroll-snap + flèches + miniatures) et visionneuse
   ================================================================== */

function setupGallery(root, images, name) {
  if (!root) return;
  const track = root.querySelector('.gallery__track');
  const thumbs = root.querySelector('.gallery__thumbs');
  const prev = root.querySelector('.gallery__arrow--prev');
  const next = root.querySelector('.gallery__arrow--next');
  if (!track) return;

  if (prev) prev.innerHTML = icon('arrow-left');
  if (next) next.innerHTML = icon('arrow-right');
  const n = images.length;
  if (!n) { if (prev) prev.hidden = true; if (next) next.hidden = true; return; }

  const openLightbox = setupLightbox(images, name);
  let index = 0;

  images.forEach((src, i) => {
    const slide = el('div', 'gallery__slide');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'diapositive');
    slide.setAttribute('aria-label', `Photo ${i + 1} sur ${n}`);
    const img = el('img');
    img.src = src;
    img.alt = i === 0 ? name : `${name} – photo ${i + 1}`;
    img.width = 1120; img.height = 1400;
    img.decoding = 'async';
    if (i === 0) { img.loading = 'eager'; img.fetchPriority = 'high'; } else { img.loading = 'lazy'; }
    img.addEventListener('click', () => openLightbox(index));
    slide.append(img);
    track.append(slide);

    if (thumbs && n > 1) {
      const btn = el('button', 'gallery__thumb');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', `Afficher la photo ${i + 1}`);
      btn.setAttribute('aria-selected', 'false');
      const timg = el('img');
      timg.src = src; timg.alt = ''; timg.width = 72; timg.height = 72; timg.loading = 'lazy';
      btn.append(timg);
      btn.addEventListener('click', () => goTo(i));
      thumbs.append(btn);
    }
  });
  if (thumbs) { thumbs.classList.toggle('gallery__thumbs--8', n > 6); if (n < 2) thumbs.hidden = true; }
  if (n < 2) { if (prev) prev.hidden = true; if (next) next.hidden = true; }

  function goTo(i, smooth = true) {
    index = ((i % n) + n) % n;
    track.scrollTo({ left: index * track.clientWidth, behavior: smooth && !REDUCED_MOTION ? 'smooth' : 'auto' });
    updateUI();
  }
  function updateUI() {
    if (!thumbs) return;
    thumbs.querySelectorAll('.gallery__thumb').forEach((b, i) => {
      const active = i === index;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
      if (active && typeof b.scrollIntoView === 'function' && thumbs.scrollWidth > thumbs.clientWidth + 2) {
        b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
      }
    });
  }
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== index && i >= 0 && i < n) { index = i; updateUI(); }
    });
  }, { passive: true });
  if (prev) prev.addEventListener('click', () => goTo(index - 1));
  if (next) next.addEventListener('click', () => goTo(index + 1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    if (e.key === 'Enter') openLightbox(index);
  });
  window.addEventListener('resize', () => goTo(index, false));
  updateUI();
}

/* Visionneuse : un seul <dialog> injecté par page, partagé. */
function setupLightboxShell() {
  if (q('#lightbox')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="lightbox" id="lightbox" aria-label="Photo en grand">
      <button type="button" class="lightbox__close" id="lightbox-close" aria-label="Fermer">${icon('close')}</button>
      <button type="button" class="lightbox__arrow lightbox__arrow--prev" id="lightbox-prev" aria-label="Photo précédente">${icon('arrow-left')}</button>
      <img class="lightbox__img" id="lightbox-img" src="" alt="" width="1120" height="1400">
      <button type="button" class="lightbox__arrow lightbox__arrow--next" id="lightbox-next" aria-label="Photo suivante">${icon('arrow-right')}</button>
      <span class="lightbox__counter" id="lightbox-counter"></span>
    </dialog>`);
}

function setupLightbox(images, name) {
  const dlg = q('#lightbox');
  if (!dlg) return () => {};
  const img = q('#lightbox-img');
  const prev = q('#lightbox-prev');
  const next = q('#lightbox-next');
  const counter = q('#lightbox-counter');
  const n = images.length;
  let i = 0;

  function show(k) {
    i = ((k % n) + n) % n;
    img.src = images[i];
    img.alt = `${name} – photo ${i + 1} sur ${n}`;
    counter.textContent = `${i + 1} / ${n}`;
    prev.hidden = next.hidden = n < 2;
  }
  function open(k) {
    show(k);
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    lockScroll(true);
  }
  function shut() { if (dlg.open && typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }

  if (!dlg.dataset.bound) {
    dlg.dataset.bound = '1';
    dlg.addEventListener('close', () => lockScroll(false));
    q('#lightbox-close').addEventListener('click', shut);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) shut(); });
  }
  // (Ré)attache la navigation à ce jeu d'images
  prev.onclick = () => show(i - 1);
  next.onclick = () => show(i + 1);
  dlg.onkeydown = (e) => { if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); };
  let x0 = null;
  dlg.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
  dlg.ontouchend = (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  };
  return open;
}

/* ==================================================================
   6. Composants : pastilles, nuancier, quantité, accordéon
   ================================================================== */

/* Pastilles de taille (boutons arrondis, sélection = fond noir) */
function makePills(container, options, selected, onSelect) {
  if (!container) return;
  container.innerHTML = '';
  options.forEach((opt) => {
    const b = el('button', 'pill-btn');
    b.type = 'button';
    b.textContent = opt;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-pressed', String(opt === selected));
    b.setAttribute('aria-checked', String(opt === selected));
    b.addEventListener('click', () => {
      container.querySelectorAll('.pill-btn').forEach((x) => { x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-checked', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      b.setAttribute('aria-checked', 'true');
      onSelect(opt);
    });
    container.append(b);
  });
}

/* Nuancier : cercles blanc / noir (couleur déduite du nom) */
const SWATCH_COLORS = { blanc: '#ffffff', white: '#ffffff', noir: '#1a1a1a', black: '#1a1a1a', gris: '#9a9a9a', rouge: '#c0392b', bleu: '#2d5bd1', vert: '#8a9a4a', rose: '#e8a3b8', beige: '#e9dcc5', marron: '#6b4b2b', violet: '#5a31f4' };
function makeSwatches(container, options, selected, onSelect) {
  if (!container) return;
  container.innerHTML = '';
  options.forEach((opt) => {
    const b = el('button', 'swatch');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', opt);
    b.setAttribute('aria-pressed', String(opt === selected));
    b.setAttribute('aria-checked', String(opt === selected));
    const dot = el('span');
    dot.style.background = SWATCH_COLORS[String(opt).toLowerCase()] || '#d0d0d0';
    b.append(dot);
    b.addEventListener('click', () => {
      container.querySelectorAll('.swatch').forEach((x) => { x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-checked', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      b.setAttribute('aria-checked', 'true');
      onSelect(opt);
    });
    container.append(b);
  });
}

/* Compteur de quantité −/+ */
function makeQty({ value = 1, min = 1, max = 99, small = false, onChange = () => {} } = {}) {
  const box = el('div', 'qty' + (small ? ' qty--sm' : ''));
  box.innerHTML = `
    <button type="button" class="qty__btn" data-step="-1" aria-label="Diminuer la quantité">${icon('minus')}</button>
    <input class="qty__input" type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}" aria-label="Quantité">
    <button type="button" class="qty__btn" data-step="1" aria-label="Augmenter la quantité">${icon('plus')}</button>`;
  const input = box.querySelector('input');
  const [dec, inc] = box.querySelectorAll('button');
  let v = value;
  function set(nv, fire = true) {
    v = Math.max(min, Math.min(max, Math.round(Number(nv) || min)));
    input.value = String(v);
    dec.disabled = v <= min && min > 0;
    inc.disabled = v >= max;
    if (fire) onChange(v);
  }
  dec.addEventListener('click', () => set(v - 1));
  inc.addEventListener('click', () => set(v + 1));
  input.addEventListener('change', () => set(input.value));
  set(value, false);
  box.get = () => v;
  box.set = (nv) => set(nv, false);
  return box;
}

/* Accordéon accessible (aria-expanded + panneau animé via grid-template-rows) */
function makeAccordion(container, items, { exclusive = false, numbered = false, level = 'h3' } = {}) {
  const entries = [];
  items.forEach((it, idx) => {
    const panelId = `${container.id}-panel-${idx}`;
    const btnId = `${container.id}-btn-${idx}`;
    const item = el('div', 'acc__item');
    const h = el(level);
    const btn = el('button', 'acc__btn');
    btn.type = 'button';
    btn.id = btnId;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', panelId);
    btn.innerHTML =
      (numbered ? `<span class="acc__num">${idx + 1}</span>` : '') +
      `<span class="acc__q">${escapeHtml(it.title)}</span><span class="acc__chev">${icon('chevron')}</span>`;
    h.append(btn);
    const panel = el('div', 'acc__panel');
    panel.id = panelId;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', btnId);
    const inner = el('div');
    const content = el('div', 'acc__content');
    content.append(it.content);
    inner.append(content);
    panel.append(inner);
    item.append(h, panel);
    container.append(item);
    const entry = { btn, panel };
    entries.push(entry);
    setOpen(entry, false);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      if (exclusive && open) entries.forEach((e) => { if (e !== entry) setOpen(e, false); });
      setOpen(entry, open);
    });
  });
  function setOpen({ btn, panel }, open) {
    btn.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
    panel.toggleAttribute('inert', !open);
  }
}

/* ==================================================================
   7. Accueil : produit vedette
   ================================================================== */

function renderHome(p, cart) {
  const home = p.home || {};
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const images = (p.images || []).slice(0, Math.max(1, Number(home.imageCount) || 6));
  const state = { size: sizes[0] || '', color: colors[0] || '', qty: 1 };

  setupGallery(q('#home-gallery'), images, p.name || '');
  setText('home-vendor', home.vendor || p.brand);
  setText('home-title', p.name);
  setText('home-price', formatPrice(p.priceEur, p.currency));

  makePills(q('#home-sizes'), sizes, state.size, (v) => { state.size = v; });
  const colorName = q('#home-color-name');
  const setColor = (v) => { state.color = v; if (colorName) colorName.textContent = v ? `: ${v}` : ''; };
  makeSwatches(q('#home-colors'), colors, state.color, setColor);
  setColor(state.color);
  const qtyBox = q('#home-qty');
  if (qtyBox) qtyBox.append(makeQty({ value: 1, onChange: (v) => { state.qty = v; } }));

  const addBtn = q('#home-add');
  const stripeBtn = q('#home-stripe');
  if (addBtn) {
    addBtn.innerHTML = `${icon('cart')}<span>${escapeHtml(home.addToCart || 'Ajouter au panier')}</span>`;
    addBtn.addEventListener('click', () => {
      cart.add([{ id: 'onesie', size: state.size, color: state.color, qty: state.qty }]);
      cart.open();
    });
  }
  if (stripeBtn) {
    stripeBtn.textContent = home.payWithStripe || 'Payer avec Stripe';
    stripeBtn.addEventListener('click', () => {
      const url = cart.checkoutUrl([{ id: 'onesie', size: state.size, color: state.color, qty: state.qty }]);
      if (url) location.href = url; else toast((p.cart || {}).soon || 'Paiement bientôt disponible');
    });
  }
  const more = q('#home-more');
  if (more && home.moreOptions) more.textContent = home.moreOptions;
}

/* ==================================================================
   8. Page produit
   ================================================================== */

function renderProduct(p, cart) {
  const cur = p.currency;
  setupGallery(q('#product-gallery'), p.images || [], p.name || '');
  renderRating(p.rating);
  setText('product-name', p.name);
  setText('price', formatPrice(p.priceEur, cur));
  const cmp = q('#compare-at');
  if (cmp) { const c = Number(p.compareAtEur) || 0; cmp.textContent = c ? formatPrice(c, cur) : ''; cmp.hidden = !c; }
  setText('sizing-note', p.sizingNote);
  setText('bundle-label', p.bundleLabel || 'Bundle & économisez');
  const chart = q('#size-chart-img');
  if (chart && p.sizeChart) chart.src = p.sizeChart;

  const shop = createOffers(p, cart);
  renderFeatures(p.features || []);
  renderProof(p.purchaseProof);
  renderBuyboxAccordion(p);
  setupSlideshow(p.slideshow || {});
  renderTestimonials(p);
  renderFaq(p);
  renderContactTexts(p);
  setupStickyBar({ getPrice: shop.subtotal, label: p.name, onClick: shop.addToCart, anchor: q('#cta') });
}

function renderRating(r) {
  const box = q('#rating');
  if (!box || !r) return;
  const value = Math.min(5, Math.max(0, Number(r.value) || 5));
  const stars = q('#rating-stars');
  if (stars) stars.innerHTML = starsHtml(value);
  setText('rating-text', r.count || '');
  box.hidden = false;
}

function starsHtml(value) {
  let html = '';
  for (let k = 0; k < 5; k++) {
    const ratio = Math.min(1, Math.max(0, value - k));
    html += `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${STAR_PATH}" fill="#d9d9d9"/><path d="${STAR_PATH}" fill="currentColor" style="clip-path: inset(0 ${Math.round((1 - ratio) * 100)}% 0 0)"/></svg>`;
  }
  return html;
}

/* Widget « Bundle & économisez » : 3 offres, tailles/couleurs par article,
   chaussons en vente additionnelle, quantité, sous-total, ajout au panier. */
function createOffers(p, cart) {
  const cur = p.currency;
  const unit = Number(p.priceEur) || 0;
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : [''];
  const bundles = (Array.isArray(p.bundles) ? p.bundles : []).filter((b) => b && b.id && Number(b.qty) > 0);
  const upsell = p.upsell && p.upsell.enabled ? p.upsell : null;
  const upsellSizes = upsell && Array.isArray(upsell.sizes) ? upsell.sizes : [];
  const list = q('#offers');

  const state = {
    bundleId: (bundles.find((b) => b.default) || bundles[0] || {}).id || '',
    items: {},
    upsell: false,
    upsellSize: upsellSizes[Math.min(1, upsellSizes.length - 1)] || '',
    qty: 1,
  };
  bundles.forEach((b) => {
    state.items[b.id] = Array.from({ length: Number(b.qty) }, () => ({ size: sizes[0] || '', color: colors[0] }));
  });
  const current = () => bundles.find((b) => b.id === state.bundleId) || bundles[0];
  const bundlePrice = (b) => round2(Number(b.qty) * unit * (1 - (Number(b.discountPct) || 0) / 100));
  const bundleCompare = (b) => Number(b.compareAtEur) || round2(Number(b.qty) * (Number(p.compareAtEur) || 0));

  if (list) {
    if (!bundles.length) list.hidden = true;
    bundles.forEach((b) => list.append(offerCard(b)));
  }

  function offerCard(b) {
    const qty = Number(b.qty);
    const card = el('div', 'offer');
    card.dataset.bundle = b.id;
    const inputId = `offer-${b.id}`;
    const rows = state.items[b.id].map((item, i) => `
      <div class="offer__row${qty > 1 ? '' : ' offer__row--single'}">
        ${qty > 1 ? `<span class="offer__num">#${i + 1}</span>` : ''}
        <span class="select"><span class="select__label">Taille</span><span class="select__wrap">${selectHtml(sizes, item.size, i, 'size', `Taille${qty > 1 ? ` – article ${i + 1}` : ''}`)}</span></span>
        <span class="select"><span class="select__label">Couleur</span><span class="select__wrap">${selectHtml(colors, item.color, i, 'color', `Couleur${qty > 1 ? ` – article ${i + 1}` : ''}`)}</span></span>
      </div>`).join('');
    const upsellHtml = upsell ? `
      <div class="upsell" data-upsell>
        <label class="upsell__main">
          <input class="upsell__check" type="checkbox" data-upsell-check>
          ${upsell.image ? `<img class="upsell__thumb" src="${escapeHtml(upsell.image)}" alt="" width="44" height="44" loading="lazy">` : ''}
          <span><span class="upsell__title">${escapeHtml(upsell.label || upsell.name || '')}</span>
            ${upsell.sizeHint ? ` <span class="upsell__hint">${escapeHtml(upsell.sizeHint)}</span>` : ''}</span>
          <span class="upsell__price">${formatPrice(upsell.priceEur, cur)}</span>
        </label>
        <div class="upsell__size"><div>
          <span class="select"><span class="select__label">Taille des chaussons</span><span class="select__wrap">${selectHtml(upsellSizes, state.upsellSize, 0, 'upsellSize', 'Taille des chaussons')}</span></span>
        </div></div>
      </div>` : '';
    card.innerHTML = `
      <input class="offer__input" type="radio" name="offer" id="${inputId}" value="${escapeHtml(b.id)}">
      ${b.badge ? `<span class="offer__badge${b.badgeStyle === 'green' ? ' offer__badge--green' : ''}">${escapeHtml(b.badge)}</span>` : ''}
      <label class="offer__head" for="${inputId}">
        <span class="offer__radio" aria-hidden="true"></span>
        <span class="offer__text">
          <span class="offer__title">${escapeHtml(b.title || `Acheter ${qty}`)}</span>
          ${b.subtitle ? `<span class="offer__sub">${escapeHtml(b.subtitle)}</span>` : ''}
          ${b.text ? `<span class="offer__desc">${escapeHtml(b.text)}</span>` : ''}
        </span>
        <span class="offer__price">
          <span class="offer__now">${formatPrice(bundlePrice(b), cur)}</span>
          ${bundleCompare(b) ? `<s class="offer__was">${formatPrice(bundleCompare(b), cur)}</s>` : ''}
        </span>
      </label>
      <div class="offer__body"><div><div class="offer__inner">
        ${rows}
        ${upsellHtml}
        ${b.gift ? `<p class="offer__gift">${icon('check')}<span>${escapeHtml(b.gift)}</span>${b.giftTag ? `<strong>— ${escapeHtml(b.giftTag)}</strong>` : ''}</p>` : ''}
      </div></div></div>`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('select, label, input, button')) return;
      const input = card.querySelector('.offer__input');
      if (!input.checked) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    return card;
  }

  function selectHtml(options, value, item, field, label) {
    const opts = options.map((o) => `<option value="${escapeHtml(o)}"${o === value ? ' selected' : ''}>${escapeHtml(o || '—')}</option>`).join('');
    return `<select data-item="${item}" data-field="${field}" aria-label="${escapeHtml(label)}">${opts}</select>`;
  }

  function syncUI() {
    if (!list) return;
    list.querySelectorAll('.offer').forEach((card) => {
      const selected = card.dataset.bundle === state.bundleId;
      card.classList.toggle('is-selected', selected);
      card.querySelector('.offer__input').checked = selected;
      const body = card.querySelector('.offer__body');
      body.toggleAttribute('inert', !selected);
      body.setAttribute('aria-hidden', String(!selected));
      const up = card.querySelector('[data-upsell]');
      if (up) {
        up.classList.toggle('is-checked', state.upsell);
        up.querySelector('[data-upsell-check]').checked = state.upsell;
        const sel = up.querySelector('select');
        if (sel) sel.value = state.upsellSize;
        const sizeBox = up.querySelector('.upsell__size');
        sizeBox.toggleAttribute('inert', !state.upsell);
      }
    });
  }

  if (list) {
    list.addEventListener('change', (e) => {
      const t = e.target;
      if (t.classList.contains('offer__input')) state.bundleId = t.value;
      else if (t.matches('[data-upsell-check]')) state.upsell = t.checked;
      else if (t.tagName === 'SELECT' && t.dataset.field === 'upsellSize') state.upsellSize = t.value;
      else if (t.tagName === 'SELECT') {
        const card = t.closest('.offer');
        const item = state.items[card.dataset.bundle][Number(t.dataset.item)];
        if (item) item[t.dataset.field] = t.value;
      }
      syncUI();
      update();
    });
  }

  /* Quantité + sous-total (même règle de prix que le panier) */
  const qtyBox = q('#product-qty');
  if (qtyBox) qtyBox.append(makeQty({ value: 1, onChange: (v) => { state.qty = v; update(); } }));

  function subtotal() {
    const b = current();
    if (!b) return 0;
    const n = Number(b.qty) * state.qty;
    const extra = upsell && state.upsell ? (Number(upsell.priceEur) || 0) * state.qty : 0;
    return round2(cart.onesiePrice(n) + extra);
  }
  function lines() {
    const b = current();
    if (!b) return [];
    const out = [];
    (state.items[b.id] || []).forEach((it) => { for (let k = 0; k < state.qty; k++) out.push({ id: 'onesie', size: it.size, color: it.color, qty: 1 }); });
    if (upsell && state.upsell) out.push({ id: upsell.product || 'slippers', size: state.upsellSize, color: '', qty: state.qty });
    return out;
  }
  function addToCart() {
    const ls = lines();
    if (!ls.length) return;
    cart.add(ls);
    cart.open();
  }
  function update() { setText('subtotal', formatPrice(subtotal(), cur)); }

  const cta = q('#cta');
  if (cta) cta.addEventListener('click', addToCart);
  syncUI();
  update();
  return { addToCart, subtotal, lines };
}

function renderFeatures(features) {
  const list = q('#features');
  if (!list) return;
  if (!features.length) { list.hidden = true; return; }
  features.forEach((f) => {
    const li = el('li', 'feature');
    li.innerHTML = `${icon(f.icon || 'check')}<span>${escapeHtml(f.label || '')}</span>`;
    list.append(li);
  });
}

function renderProof(proof) {
  const node = q('#proof');
  if (!node || !proof || !proof.enabled || !proof.text) return;
  const [first, ...rest] = String(proof.text).split(' ');
  node.innerHTML = `${proof.avatar ? `<img class="proof__avatar" src="${escapeHtml(proof.avatar)}" alt="" width="28" height="28" loading="lazy">` : ''}<span><b>${escapeHtml(first)}</b> ${escapeHtml(rest.join(' '))}</span>`;
  node.hidden = false;
}

function renderBuyboxAccordion(p) {
  const box = q('#buybox-acc');
  if (!box) return;
  const titles = p.buyboxAccordion || {};
  const items = [];

  if (p.sizeChart) {
    const wrap = el('div');
    wrap.innerHTML = `<img src="${escapeHtml(p.sizeChart)}" alt="Guide des tailles" width="1480" height="969" loading="lazy">`;
    items.push({ title: titles.sizeGuideTitle || 'Guide des tailles du onesie', content: wrap });
  }
  const faq = Array.isArray(p.buyboxFaq) && p.buyboxFaq.length ? p.buyboxFaq : (p.faq || []).slice(0, 3);
  if (faq.length) {
    const wrap = el('div');
    faq.forEach((f) => { const para = el('p'); para.innerHTML = `<strong>${escapeHtml(f.q)}</strong><br>${escapeHtml(f.a)}`; wrap.append(para); });
    items.push({ title: titles.faqTitle || 'Questions fréquentes', content: wrap });
  }
  const s = p.shipping || {};
  if (s.processing || s.international || s.france) {
    const ul = el('ul', 'ship-list');
    [['box', s.processing], ['globe', s.international], ['truck', s.france]].filter(([, t]) => t).forEach(([ic, text]) => {
      const li = el('li');
      li.innerHTML = `${icon(ic)}<span>${escapeHtml(text)}</span>`;
      ul.append(li);
    });
    items.push({ title: titles.shippingTitle || 'Préparation & livraison', content: ul });
  }
  makeAccordion(box, items, { exclusive: false, numbered: false, level: 'h2' });
}

/* ==================================================================
   9. Pages produit simples (chaussons, porte-clés)
   ================================================================== */

function renderSimpleProduct(p, cart, key) {
  const prod = (p.products || {})[key];
  if (!prod) { const e = q('#load-error'); if (e) { e.hidden = false; e.textContent = `Produit « ${key} » introuvable dans product.json.`; } return; }
  const cur = p.currency;
  const sizes = Array.isArray(prod.sizes) ? prod.sizes : [];
  const state = { size: sizes[0] || '', qty: 1 };

  setupGallery(q('#sp-gallery'), prod.images || [], prod.name || '');
  setText('sp-name', prod.name);
  setText('sp-price', formatPrice(prod.priceEur, cur));
  const cmp = q('#sp-compare');
  if (cmp) { const c = Number(prod.compareAtEur) || 0; cmp.textContent = c ? formatPrice(c, cur) : ''; cmp.hidden = !c; }
  setText('sp-desc', prod.description);

  const sizeOpt = q('#sp-size-option');
  if (sizeOpt) {
    if (!sizes.length) sizeOpt.hidden = true;
    else {
      const hint = q('#sp-size-hint');
      if (hint) hint.textContent = prod.sizeHint || '';
      makePills(q('#sp-sizes'), sizes, state.size, (v) => { state.size = v; });
      const guide = q('#sp-size-guide');
      if (guide && prod.sizeGuide) { guide.textContent = prod.sizeGuide; guide.hidden = false; }
    }
  }
  const qtyBox = q('#sp-qty');
  if (qtyBox) qtyBox.append(makeQty({ value: 1, onChange: (v) => { state.qty = v; } }));

  const bl = q('#sp-bullets');
  if (bl && Array.isArray(prod.bullets)) prod.bullets.forEach((t) => { const li = el('li'); li.innerHTML = `${icon('check')}<span>${escapeHtml(t)}</span>`; bl.append(li); });

  function addToCart() { cart.add([{ id: key, size: state.size, color: '', qty: state.qty }]); cart.open(); }
  const cta = q('#cta');
  if (cta) cta.addEventListener('click', addToCart);

  const acc = q('#sp-acc');
  if (acc) {
    const s = p.shipping || {};
    const ul = el('ul', 'ship-list');
    [['box', s.processing], ['globe', s.international], ['truck', s.france]].filter(([, t]) => t).forEach(([ic, text]) => {
      const li = el('li'); li.innerHTML = `${icon(ic)}<span>${escapeHtml(text)}</span>`; ul.append(li);
    });
    makeAccordion(acc, [{ title: (p.buyboxAccordion || {}).shippingTitle || 'Préparation & livraison', content: ul }], { level: 'h2' });
  }
  setupStickyBar({ getPrice: () => round2((Number(prod.priceEur) || 0) * state.qty), label: prod.name, onClick: addToCart, anchor: cta });
}

/* ==================================================================
   10. Sections partagées
   ================================================================== */

/* Diaporama : GIF 9:16 centré sur fond sombre ; seule la 1re diapo est
   chargée au départ (les autres au moment de leur affichage). */
function setupSlideshow(s) {
  const root = q('#slideshow');
  if (!root) return;
  const slides = (Array.isArray(s.slides) ? s.slides : []).filter(Boolean);
  if (!slides.length) { root.hidden = true; return; }
  const track = q('#slideshow-track');
  const dots = q('#slideshow-dots');
  const prev = root.querySelector('.slideshow__arrow--prev');
  const next = root.querySelector('.slideshow__arrow--next');
  setText('slideshow-title', s.title);
  setText('slideshow-text', s.text);
  const cta = q('#slideshow-cta');
  if (cta) cta.textContent = s.cta || '';
  if (prev) prev.innerHTML = icon('arrow-left');
  if (next) next.innerHTML = icon('arrow-right');

  const n = slides.length;
  const entries = slides.map((src, i) => {
    const slide = el('div', 'slideshow__slide');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'diapositive');
    slide.setAttribute('aria-label', `Diapositive ${i + 1} sur ${n}`);
    const img = el('img', 'slideshow__media');
    img.alt = ''; img.width = 720; img.height = 1280; img.decoding = 'async'; img.loading = 'lazy';
    if (i === 0) img.src = src; else img.dataset.src = src;
    slide.append(img);
    track.append(slide);
    const dot = el('button', 'slideshow__dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Afficher la diapositive ${i + 1}`);
    dot.addEventListener('click', () => go(i, true));
    if (dots) dots.append(dot);
    return { slide, img, dot };
  });
  if (n < 2) { if (prev) prev.hidden = true; if (next) next.hidden = true; if (dots) dots.hidden = true; }

  let index = 0;
  let timer = null;
  function go(i, manual) {
    index = ((i % n) + n) % n;
    entries.forEach((e, k) => {
      const on = k === index;
      e.slide.classList.toggle('is-active', on);
      e.dot.setAttribute('aria-current', String(on));
      if (on && e.img.dataset.src) { e.img.src = e.img.dataset.src; delete e.img.dataset.src; }
    });
    if (manual) restart();
  }
  function stop() { clearInterval(timer); timer = null; }
  function restart() { stop(); if (REDUCED_MOTION || n < 2) return; timer = setInterval(() => go(index + 1), 7000); }
  if (prev) prev.addEventListener('click', () => go(index - 1, true));
  if (next) next.addEventListener('click', () => go(index + 1, true));
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', restart);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { if (en.isIntersecting) restart(); else stop(); }, { threshold: 0.3 }).observe(root);
  } else restart();
  go(0);
}

/* « Vu sur TikTok » : vidéos auto-hébergées (v.src) pour une lecture fiable en démo,
   avec repli sur l'iframe /embed/v2 si aucun fichier n'est fourni. */
function renderTiktok(p) {
  const t = p.tiktok || {};
  const grid = q('#tiktok-grid');
  const section = q('#tiktok');
  if (!grid) return;
  const videos = (Array.isArray(t.videos) ? t.videos : []).filter((v) => v && /^\d{5,25}$/.test(String(v.id)));
  if (!videos.length) { if (section) section.hidden = true; return; }
  setText('tiktok-title', t.title || 'Vu sur TikTok');
  setText('tiktok-sub', t.subtitle || '');
  videos.forEach((v, i) => {
    const item = el('div', 'tiktok__item');
    const media = v.src
      ? `<video src="${escapeHtml(v.src)}" controls muted loop playsinline preload="metadata" title="Vidéo TikTok ${i + 1}"></video>`
      : `<iframe src="https://www.tiktok.com/embed/v2/${encodeURIComponent(String(v.id))}" width="325" height="575" loading="lazy" allow="encrypted-media" allowfullscreen title="Vidéo TikTok ${i + 1} – ${escapeHtml(p.brand || '')}"></iframe>`;
    const link = v.url ? `<a class="tiktok__link" href="${escapeHtml(v.url)}" target="_blank" rel="noopener">Voir sur TikTok</a>` : '';
    item.innerHTML = `
      <div class="tiktok__frame">${media}</div>
      <p class="tiktok__views">${icon('play')}<span>${escapeHtml(v.views || '')}</span>${link}</p>`;
    grid.append(item);
  });
}

function renderTestimonials(p) {
  const section = q('#testimonials');
  const grid = q('#testimonials-grid');
  if (!section || !grid) return;
  const list = Array.isArray(p.testimonials) ? p.testimonials : [];
  if (!list.length) { section.hidden = true; return; }
  setText('testimonials-title', p.testimonialsTitle || 'Rejoignez nos clients heureux');
  const pill = q('#testimonials-pill');
  if (pill) { pill.textContent = p.testimonialsPill || ''; pill.hidden = !p.testimonialsPill; }
  list.forEach((t) => {
    const card = el('article', 'review');
    card.innerHTML = `
      <div class="review__head">
        ${t.avatar ? `<img class="review__avatar" src="${escapeHtml(t.avatar)}" alt="" width="46" height="46" loading="lazy">` : ''}
        <span><span class="review__name">${escapeHtml(t.name || 'Client')}</span>
        ${t.verified ? `<span class="review__verified">${icon('check')} Achat vérifié</span>` : ''}</span>
      </div>
      <span class="stars stars--sm" role="img" aria-label="5 étoiles sur 5">${starsHtml(5)}</span>
      ${t.title ? `<h3>${escapeHtml(t.title)}</h3>` : ''}
      <p>${escapeHtml(t.text || '')}</p>`;
    grid.append(card);
  });
}

function renderFaq(p) {
  const box = q('#faq');
  if (!box) return;
  const faq = Array.isArray(p.faq) ? p.faq : [];
  if (!faq.length) { const s = q('#faq-section'); if (s) s.hidden = true; return; }
  setText('faq-title', p.faqTitle || 'Questions fréquentes');
  setText('faq-sub', p.faqSubtitle || '');
  const items = faq.map((f) => { const para = el('p'); para.textContent = f.a || ''; return { title: f.q || '', content: para }; });
  makeAccordion(box, items, { exclusive: true, numbered: true, level: 'h3' });
}

function renderContactTexts(p) {
  const c = p.contact || {};
  setText('contact-title', c.title || 'Écrivez-nous à tout moment');
  setText('contact-text', c.text || '');
  const btn = q('#contact-submit');
  if (btn && c.submit) btn.textContent = c.submit;
}

/* Formulaire de contact → mailto: pré-rempli (aucun backend) */
function setupContact(p) {
  const form = q('#contact-form');
  if (!form) return;
  renderContactTexts(p);
  const hint = q('#form-hint');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    form.querySelectorAll('.field').forEach((f) => {
      const input = f.querySelector('input, textarea');
      const ok = input.checkValidity();
      f.classList.toggle('is-invalid', !ok);
      if (!ok) valid = false;
    });
    if (!valid) {
      if (hint) hint.textContent = 'Merci de vérifier les champs obligatoires (adresse e-mail valide).';
      const first = form.querySelector('.is-invalid input, .is-invalid textarea');
      if (first) first.focus();
      return;
    }
    const d = new FormData(form);
    const g = (k) => String(d.get(k) || '').trim();
    const name = [g('prenom'), g('nom')].filter(Boolean).join(' ');
    const subject = `[${p.brand || 'Boutique'}] Message de ${name || g('email')}`;
    const body = `${g('commentaire')}\n\n— ${name}\n${g('email')}${g('telephone') ? '\n' + g('telephone') : ''}`;
    if (hint) hint.textContent = 'Votre application e-mail s\'ouvre avec le message pré-rempli…';
    location.href = `mailto:${p.supportEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

/* Barre d'achat fixe (mobile) : visible dès que le CTA sort de l'écran */
function setupStickyBar({ getPrice, label, onClick, anchor }) {
  const bar = q('#sticky-bar');
  const btn = q('#sticky-cta');
  if (!bar || !btn || !anchor) return;
  document.body.classList.add('has-sticky-bar');
  const price = q('#sticky-price');
  const lab = q('#sticky-label');
  if (lab) lab.textContent = label || '';
  const refresh = () => { if (price) price.textContent = formatPrice(getPrice(), 'eur'); };
  refresh();
  document.addEventListener('change', refresh);
  document.addEventListener('click', () => setTimeout(refresh, 0));
  btn.addEventListener('click', onClick);
  if (!('IntersectionObserver' in window)) { bar.classList.add('is-visible'); bar.setAttribute('aria-hidden', 'false'); return; }
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(anchor);
}

/* ==================================================================
   11. Utilitaires
   ================================================================== */

function q(sel) { return document.querySelector(sel); }
function qa(sel) { return Array.from(document.querySelectorAll(sel)); }
function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value || '';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: (currency || 'eur').toUpperCase() }).format(Number(amount) || 0);
}

/* Ne garde que [A-Za-z0-9_-] (200 caractères max) pour client_reference_id. */
function sanitizeRef(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible : on ignore */ }
}
