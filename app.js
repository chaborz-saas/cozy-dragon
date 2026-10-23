/* ==================================================================
   Cozy Dragon — app.js  (démo interne : réplique visuelle « Horizon »)
   Charge ./product.json et construit les pages. Aucune dépendance, aucun
   backend : tout fonctionne en JS + localStorage.

   Organisation du fichier :
     1. Icônes SVG inline
     2. Devise / pays (sélecteur « EUR ▾ », table de conversion fixe)
     3. Point d'entrée (selon <body data-page="…">)
     4. Éléments communs : bandeau démo, marquee, en-tête, recherche,
        menu mobile, pied de page, cookies, toast, modale, popover
     5. Panier (état + tiroir + barre « livraison offerte » + Stripe)
     6. Galerie + visionneuse
     7. Composants : pastilles, nuancier, compteur, accordéon
     8. Accueil (produit vedette)
     9. Page produit (bundles, vente additionnelle)
    10. Pages produit simples (chaussons, porte-clés)
    11. Sections partagées : diaporama, TikTok, témoignages, FAQ, contact,
        bouton d'achat flottant / barre fixe
    12. Utilitaires

   Logique d'achat : le panier (localStorage) contient des lignes
   { id, size, color, qty }. Au clic sur « Commander », on compte les
   onesies (N) et les chaussons (S) : si 1 ≤ N ≤ 3 et S ≤ 1, on utilise
   bundles[N-1].paymentLink (ou .paymentLinkWithUpsell) avec un
   client_reference_id du type « b2_M-L_noir-noir_CH-M ». Sinon on prend
   le pack le plus proche et on l'indique. Lien vide = « Paiement bientôt
   disponible ». Le paiement Stripe reste en EUR quelle que soit la devise
   d'affichage.
   ================================================================== */

'use strict';

const CART_KEY = 'cozydragon:cart';
const COOKIE_KEY = 'cozydragon:cookies';
const COUNTRY_KEY = 'cozydragon:country';
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
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21zM8 10l2 2M11 7l2 2M14 4l2 2M5 13l2 2"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ==================================================================
   2. Devise / pays : table de conversion fixe (démo), prix affichés
      convertis, paiement Stripe toujours en EUR.
   ================================================================== */

const COUNTRIES = [
  { id: 'FR', name: 'France', currency: 'EUR', symbol: '€', rate: 1, locale: 'fr-FR' },
  { id: 'BE', name: 'Belgique', currency: 'EUR', symbol: '€', rate: 1, locale: 'fr-FR' },
  { id: 'CH', name: 'Suisse', currency: 'CHF', symbol: 'CHF', rate: 0.95, locale: 'fr-CH' },
  { id: 'LU', name: 'Luxembourg', currency: 'EUR', symbol: '€', rate: 1, locale: 'fr-FR' },
  { id: 'CA', name: 'Canada', currency: 'CAD', symbol: '$', rate: 1.48, locale: 'fr-CA' },
  { id: 'US', name: 'États-Unis', currency: 'USD', symbol: '$', rate: 1.08, locale: 'en-US' },
  { id: 'GB', name: 'Royaume-Uni', currency: 'GBP', symbol: '£', rate: 0.85, locale: 'en-GB' },
  { id: 'DE', name: 'Allemagne', currency: 'EUR', symbol: '€', rate: 1, locale: 'fr-FR' },
];
let COUNTRY = COUNTRIES[0];

function initCurrency() {
  const saved = readStorage(COUNTRY_KEY);
  COUNTRY = COUNTRIES.find((c) => saved && c.id === saved.id) || COUNTRIES[0];
}

function setCountry(id) {
  COUNTRY = COUNTRIES.find((c) => c.id === id) || COUNTRIES[0];
  writeStorage(COUNTRY_KEY, { id: COUNTRY.id });
  refreshPrices();
  qa('[data-currency-label]').forEach((n) => { n.textContent = `${COUNTRY.currency} ${COUNTRY.symbol}`; });
  qa('[data-country-select]').forEach((s) => { s.value = COUNTRY.id; });
  qa('[data-country]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.country === COUNTRY.id)); });
  if (typeof CustomEvent === 'function' && document.dispatchEvent) document.dispatchEvent(new CustomEvent('currencychange'));
}

/* Prix : montant en EUR → devise choisie. Chaque nœud garde son montant EUR
   dans data-eur pour être re-formaté au changement de devise. */
function formatPrice(eur) {
  const v = round2((Number(eur) || 0) * COUNTRY.rate);
  return new Intl.NumberFormat(COUNTRY.locale, { style: 'currency', currency: COUNTRY.currency }).format(v);
}
function formatEur(eur) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(eur) || 0);
}
function priceHtml(eur, cls = '') {
  return `<span${cls ? ` class="${cls}"` : ''} data-eur="${round2(eur)}">${escapeHtml(formatPrice(eur))}</span>`;
}
function setPrice(el, eur) {
  if (!el) return;
  el.dataset.eur = String(round2(eur));
  el.textContent = formatPrice(eur);
}
function refreshPrices() {
  qa('[data-eur]').forEach((n) => { n.textContent = formatPrice(Number(n.dataset.eur)); });
}

/* ==================================================================
   3. Point d'entrée
   ================================================================== */

(async function main() {
  const p = await loadProduct();
  if (!p) return;

  initCurrency();
  const cart = createCart(p);
  initChrome(p, cart);

  const page = document.body.dataset.page || '';
  if (page === 'home') renderHome(p, cart);
  else if (page === 'product') renderProduct(p, cart);
  else if (page === 'simple-product') renderSimpleProduct(p, cart, document.body.dataset.product || '');

  if (q('#tiktok-grid')) renderTiktok(p);
  if (q('#contact-form')) setupContact(p);
  if (q('#login-form')) setupLogin();
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
   4. Éléments communs à toutes les pages
   ================================================================== */

function initChrome(p, cart) {
  fillCommon(p);
  renderAnnouncement(p.announcement || {});
  setupFooter(p.footer || {});
  setupToast();
  setupModal();
  setupLightboxShell();
  setupSearch(p);
  setupCountryMenu();
  setupMobileMenu(p);
  setupCookies(p.cookies || {});
  setupDrawer(p, cart);

  const cartBtn = q('#cart-btn');
  if (cartBtn) cartBtn.addEventListener('click', () => cart.open());
  cart.onChange(() => updateCartCount(cart));
  updateCartCount(cart);

  // Lien actif dans la navigation
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  qa('.nav a, .mobile-menu__panel a').forEach((a) => {
    const target = (a.getAttribute('href') || '').replace(/^\.\//, '').toLowerCase();
    if (target === file) a.setAttribute('aria-current', 'page');
  });

  // Guide des tailles en modale (lien souligné sous les pastilles de l'accueil)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-size-guide]');
    if (!link) return;
    e.preventDefault();
    openModal({
      title: 'Guide des tailles',
      html: p.sizeChart ? `<img src="${escapeHtml(p.sizeChart)}" alt="Guide des tailles du onesie (mesures en centimètres)" width="1480" height="969">` : '<p>Guide des tailles indisponible.</p>',
    });
  });

  // Défilement doux vers la boîte d'achat (bouton du diaporama, liens #buybox)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#buybox"]');
    const box = q('#buybox');
    if (!a || !box) return;
    e.preventDefault();
    box.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
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
  qa('[data-currency-label]').forEach((n) => { n.textContent = `${COUNTRY.currency} ${COUNTRY.symbol}`; });
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

/* Pied de page : bouton texte « Terms and Policies » qui déplie la liste des liens (repliée par défaut). */
function setupFooter(f) {
  const nav = q('[data-footer-links]');
  const trigger = q('[data-footer-trigger]');
  if (nav && Array.isArray(f.links) && f.links.length) {
    nav.innerHTML = f.links.map((l) => {
      const href = String(l.href || '#');
      const isCookie = href === '#cookies';
      return `<a href="${escapeHtml(isCookie ? '#cookies' : './' + href.replace(/^\.?\//, ''))}"${isCookie ? ' data-cookie-prefs' : ''}>${escapeHtml(l.label || '')}</a>`;
    }).join('');
  }
  if (!nav || !trigger) return;
  if (f.trigger) trigger.textContent = f.trigger;
  nav.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', () => {
    const open = nav.hidden;
    nav.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });
}

/* Icônes de paiement génériques (rectangles gris, texte) — aucune œuvre de marque. */
function paymentCard(label, extra = '') {
  return `<svg viewBox="0 0 38 24" role="img" aria-label="${escapeHtml(label)}">
      <rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#fff" stroke="#d9d9d9"/>
      ${extra || `<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="700" fill="#444">${escapeHtml(label)}</text>`}
    </svg>`;
}
const PAYMENT_ICONS = {
  Visa: () => paymentCard('VISA'),
  Mastercard: () => paymentCard('Mastercard', '<circle cx="15" cy="12" r="6" fill="#bdbdbd"/><circle cx="23" cy="12" r="6" fill="#8a8a8a" fill-opacity="0.85"/>'),
  Amex: () => paymentCard('AMEX'),
  'Apple Pay': () => paymentCard('Apple Pay', '<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#444">Pay</text>'),
  'Google Pay': () => paymentCard('Google Pay', '<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#444">G Pay</text>'),
  PayPal: () => paymentCard('PayPal', '<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7" font-weight="700" fill="#444">PayPal</text>'),
  Stripe: () => paymentCard('Stripe', '<text x="19" y="15.5" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#444">stripe</text>'),
};
/* Rangée d'icônes de paiement sous la preuve d'achat (fiche produit) : SVG de img/demo/pay/ (product.json → paymentIcons). */
function renderPaymentIcons(p) {
  const row = q('#pay-row');
  if (!row) return;
  const icons = (Array.isArray(p.paymentIcons) ? p.paymentIcons : []).filter((i) => i && i.src);
  if (!icons.length) { row.hidden = true; return; }
  row.innerHTML = icons.map((i) => `<img src="${escapeHtml(i.src)}" alt="${escapeHtml(i.label || '')}" width="38" height="24" loading="lazy">`).join('');
}

const CROWN_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';

/* Recherche : overlay avec champ + « Suggestions » (les 3 produits) filtrées à la frappe. */
function setupSearch(p) {
  const btn = q('#search-btn');
  if (!btn) return;
  const items = catalog(p);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="Recherche">
      <form class="search-overlay__inner" id="search-form" role="search">
        <input class="search-overlay__input" id="search-input" type="search" placeholder="Rechercher" aria-label="Rechercher" autocomplete="off">
        <button type="button" class="icon-btn" id="search-close" aria-label="Fermer">${icon('close')}</button>
      </form>
      <div class="search-overlay__results">
        <p class="search-overlay__label">${escapeHtml((p.search && p.search.title) || 'Suggestions')}</p>
        <ul class="search-list" id="search-list"></ul>
      </div>
    </div>`);
  const overlay = q('#search-overlay');
  const input = q('#search-input');
  const list = q('#search-list');

  function render(query) {
    const needle = normalize(query);
    const hits = items.filter((it) => !needle || normalize(it.name).includes(needle) || normalize(it.keywords || '').includes(needle));
    list.innerHTML = hits.length
      ? hits.map((it) => `
        <li><a class="search-item" href="${escapeHtml(it.page)}">
          <img src="${escapeHtml(it.image)}" alt="" width="56" height="56" loading="lazy">
          <span class="search-item__name">${escapeHtml(it.name)}</span>
          ${priceHtml(it.priceEur, 'search-item__price')}
        </a></li>`).join('')
      : '<li class="search-list__empty">Aucun résultat</li>';
  }
  const open = () => { render(''); overlay.classList.add('is-open'); lockScroll(true); setTimeout(() => input.focus(), 30); };
  const close = () => { overlay.classList.remove('is-open'); lockScroll(false); input.value = ''; btn.focus(); };
  btn.addEventListener('click', open);
  q('#search-close').addEventListener('click', close);
  input.addEventListener('input', () => render(input.value));
  q('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = list.querySelector('.search-item');
    if (first) location.href = first.getAttribute('href'); else toast('Aucun résultat pour « ' + input.value.trim() + ' »');
  });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* Catalogue (3 produits) utilisé par la recherche et le menu */
function catalog(p) {
  const pr = p.products || {};
  const out = [{ id: 'onesie', name: p.name || 'Produit', page: './produit.html', image: p.thumbnail || (p.images || [])[0] || '', priceEur: Number(p.priceEur) || 0, keywords: 'pyjama dragon onesie combinaison' }];
  ['slippers', 'keychain'].forEach((k) => {
    if (pr[k]) out.push({ id: k, name: pr[k].name || k, page: './' + (pr[k].page || `${k}.html`), image: pr[k].image || (pr[k].images || [])[0] || '', priceEur: Number(pr[k].priceEur) || 0, keywords: k === 'slippers' ? 'chaussons pantoufles' : 'porte-clés peluche cadeau' });
  });
  return out;
}

/* Sélecteur pays / devise (« EUR ▾ ») : liste « Pays/région » avec champ de recherche. */
function setupCountryMenu() {
  const btn = q('#currency-btn');
  if (!btn) return;
  const host = btn.parentElement;
  host.insertAdjacentHTML('beforeend', `
    <div class="country-menu" id="country-menu" hidden>
      <p class="country-menu__title">Pays/région</p>
      <input class="country-menu__search" id="country-search" type="search" placeholder="Rechercher" aria-label="Rechercher un pays" autocomplete="off">
      <ul class="country-menu__list" id="country-list" role="listbox" aria-label="Pays/région"></ul>
    </div>`);
  const menu = q('#country-menu');
  const search = q('#country-search');
  const list = q('#country-list');

  function render(query) {
    const needle = normalize(query);
    const hits = COUNTRIES.filter((c) => !needle || normalize(c.name).includes(needle) || normalize(c.currency).includes(needle));
    list.innerHTML = hits.length
      ? hits.map((c) => `<li><button type="button" role="option" data-country="${c.id}" aria-selected="${c.id === COUNTRY.id}"><span>${escapeHtml(c.name)}</span><span class="country-menu__cur">${escapeHtml(c.currency)} ${escapeHtml(c.symbol)}</span></button></li>`).join('')
      : '<li class="country-menu__empty">Aucun pays</li>';
  }
  function open() { render(''); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); setTimeout(() => search.focus(), 30); }
  function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); search.value = ''; }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  search.addEventListener('input', () => render(search.value));
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-country]');
    if (!b) return;
    setCountry(b.dataset.country);
    close();
    toast(`Pays : ${COUNTRY.name} · prix en ${COUNTRY.currency}`);
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) close(); });
}

function countrySelectHtml() {
  return `<label class="country-select"><span>Pays/région</span>
    <span class="select__wrap"><select data-country-select aria-label="Pays/région">${COUNTRIES.map((c) => `<option value="${c.id}"${c.id === COUNTRY.id ? ' selected' : ''}>${escapeHtml(c.name)} · ${escapeHtml(c.currency)} ${escapeHtml(c.symbol)}</option>`).join('')}</select></span></label>`;
}

/* Menu mobile : panneau latéral gauche + sélecteur pays en bas. */
function setupMobileMenu(p) {
  const btn = q('#menu-btn');
  if (!btn) return;
  const products = p.products || {};
  const links = [
    ['./produit.html', 'Accueil'],
    ['./produit.html', 'Produit'],
    products.slippers ? ['./' + (products.slippers.page || 'chaussons.html'), 'Chaussons'] : null,
    products.keychain ? ['./' + (products.keychain.page || 'porte-cles.html'), 'Porte-clés'] : null,
    ['./contact.html', 'Contact'],
    ['./connexion.html', 'Connexion'],
  ].filter(Boolean);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="mobile-menu__overlay" data-close></div>
      <div class="mobile-menu__panel">
        <button type="button" class="icon-btn mobile-menu__close" aria-label="Fermer" data-close>${icon('close')}</button>
        <nav class="mobile-menu__nav" aria-label="Menu">${links.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')}</nav>
        <div class="mobile-menu__meta">${countrySelectHtml()}</div>
      </div>
    </div>`);
  const menu = q('#mobile-menu');
  const open = () => { menu.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); lockScroll(true); };
  const close = () => { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); lockScroll(false); };
  btn.addEventListener('click', open);
  menu.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', close));
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  menu.querySelector('[data-country-select]').addEventListener('change', (e) => { setCountry(e.target.value); toast(`Pays : ${COUNTRY.name} · prix en ${COUNTRY.currency}`); });
}

/* Consentement cookies : purement cosmétique (aucun traceur), 3 interrupteurs, choix mémorisé. */
function setupCookies(c) {
  const toggle = (id, label, checked, locked) => `
    <label class="toggle">
      <input type="checkbox" id="${id}"${checked ? ' checked' : ''}${locked ? ' disabled' : ''}>
      <span class="toggle__track" aria-hidden="true"></span>
      <span class="toggle__label">${label}</span>
    </label>`;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="cookie" id="cookie" role="dialog" aria-labelledby="cookie-title">
      <p class="cookie__title" id="cookie-title">${escapeHtml(c.title || 'Consentement aux cookies')}</p>
      <p class="cookie__text">${escapeHtml(c.text || '')}</p>
      <div class="cookie__prefs" id="cookie-prefs" hidden>
        ${toggle('cookie-essential', 'Essentiels <small>(toujours actifs)</small>', true, true)}
        ${toggle('cookie-analytics', 'Mesure d\'audience', false, false)}
        ${toggle('cookie-marketing', 'Marketing', false, false)}
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

  function open(showPrefs) {
    const cur = readStorage(COOKIE_KEY);
    if (cur) { q('#cookie-analytics').checked = Boolean(cur.analytics); q('#cookie-marketing').checked = Boolean(cur.marketing); }
    prefs.hidden = !showPrefs;
    manage.textContent = showPrefs ? (c.save || 'Enregistrer les préférences') : (c.manage || 'Gérer les préférences');
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
    else { close('custom'); toast('Préférences enregistrées'); }
  });
  q('#cookie-accept').addEventListener('click', () => { q('#cookie-analytics').checked = true; q('#cookie-marketing').checked = true; close('accept'); });
  q('#cookie-decline').addEventListener('click', () => { q('#cookie-analytics').checked = false; q('#cookie-marketing').checked = false; close('decline'); });
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-cookie-prefs], a[href="#cookies"]');
    if (!link) return;
    e.preventDefault();
    open(true);
  });
  if (!saved) setTimeout(() => open(false), 600);
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

/* Modale générique (guide des tailles) */
function setupModal() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden>
      <div class="modal__overlay" data-modal-close></div>
      <div class="modal__panel">
        <div class="modal__head"><h2 class="modal__title" id="modal-title"></h2><button type="button" class="icon-btn" aria-label="Fermer" data-modal-close>${icon('close')}</button></div>
        <div class="modal__body" id="modal-body"></div>
      </div>
    </div>`);
  const m = q('#modal');
  m.querySelectorAll('[data-modal-close]').forEach((n) => n.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) closeModal(); });
}
function openModal({ title = '', html = '' }) {
  const m = q('#modal');
  if (!m) return;
  q('#modal-title').textContent = title;
  q('#modal-body').innerHTML = html;
  m.hidden = false;
  lockScroll(true);
  setTimeout(() => { const c = m.querySelector('[data-modal-close].icon-btn'); if (c) c.focus(); }, 30);
}
function closeModal() {
  const m = q('#modal');
  if (!m || m.hidden) return;
  m.hidden = true;
  lockScroll(false);
}

/* Popover ancré sous un élément (ex. « Plus d'options de paiement ») */
function attachPopover(anchor, html) {
  if (!anchor) return;
  const pop = el('div', 'popover');
  pop.setAttribute('role', 'dialog');
  pop.hidden = true;
  pop.innerHTML = html;
  anchor.insertAdjacentElement('afterend', pop);
  anchor.setAttribute('aria-expanded', 'false');
  const show = (on) => { pop.hidden = !on; anchor.setAttribute('aria-expanded', String(on)); };
  anchor.addEventListener('click', (e) => { e.preventDefault(); show(pop.hidden); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) show(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) show(false); });
}

function lockScroll(lock) { document.body.classList.toggle('is-locked', Boolean(lock)); }

/* ==================================================================
   5. Panier : état (localStorage), tiroir, Payment Link Stripe
   ================================================================== */

function createCart(p) {
  const products = p.products || {};
  const bundles = (Array.isArray(p.bundles) ? p.bundles : [])
    .filter((b) => b && b.id && Number(b.qty) > 0)
    .sort((a, b) => Number(a.qty) - Number(b.qty));
  const unit = Number(p.priceEur) || 0;
  const texts = p.cart || {};
  const protection = texts.protection && texts.protection.enabled ? texts.protection : null;
  const freeShipping = Number(texts.freeShippingEur) || 0;
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
    const merch = round2(net + others);
    const prot = protection && withProtection ? Number(protection.priceEur) || 0 : 0;
    return {
      count, onesies,
      discountPct: discountPct(onesies),
      discount: round2(gross - net),
      merch,
      protection: prot,
      subtotal: round2(merch + prot),
      freeShipping,
      freeShippingLeft: freeShipping ? Math.max(0, round2(freeShipping - merch)) : 0,
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

/* Ajout + toast + ouverture du tiroir (même comportement partout) */
function addToCartAndOpen(cart, lines) {
  if (!lines || !lines.length) return;
  cart.add(lines);
  toast('Ajouté au panier');
  cart.open();
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

    const tot = cart.totals();

    // Barre « livraison offerte »
    if (tot.freeShipping) {
      const pct = Math.min(100, Math.round((tot.merch / tot.freeShipping) * 100));
      const bar = el('div', 'shipbar');
      bar.innerHTML = `
        <p class="shipbar__text">${tot.freeShippingLeft > 0
          ? `Plus que ${priceHtml(tot.freeShippingLeft)} pour la livraison offerte`
          : `${icon('check')} Livraison offerte !`}</p>
        <div class="shipbar__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
      body.append(bar);
    }

    items.forEach((line, i) => body.append(lineEl(line, i)));

    if (cart.protection) {
      const pr = cart.protection;
      const on = cart.hasProtection();
      const row = el('div', 'cart-protect');
      row.innerHTML = `
        ${pr.icon ? `<img class="cart-protect__icon" src="${escapeHtml(pr.icon)}" alt="" width="36" height="36" loading="lazy">` : '<span></span>'}
        <div><p class="cart-protect__title">${escapeHtml(pr.title || '')}</p><p class="cart-protect__text">${escapeHtml(pr.text || '')}</p></div>
        <div class="cart-protect__right">${priceHtml(pr.priceEur)}
          <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${escapeHtml(pr.title || 'Protection')}"></button></div>`;
      row.querySelector('.switch').addEventListener('click', (e) => cart.setProtection(e.currentTarget.getAttribute('aria-checked') !== 'true'));
      body.append(row);
    }

    const pl = cart.plan();
    foot.innerHTML = `
      ${tot.discount > 0 ? `<div class="drawer__line"><span>${escapeHtml(t.discountLabel || 'Remise pack')} (-${tot.discountPct} %)</span><span>-${priceHtml(tot.discount)}</span></div>` : ''}
      ${tot.protection > 0 ? `<div class="drawer__line"><span>${escapeHtml(cart.protection.title || '')}</span>${priceHtml(tot.protection)}</div>` : ''}
      <div class="drawer__subtotal"><span>${escapeHtml(t.subtotal || 'Sous-total')}</span>${priceHtml(tot.subtotal)}</div>
      <p class="drawer__note">${escapeHtml(t.note || '')}</p>
      ${COUNTRY.currency !== 'EUR' ? `<p class="drawer__note">Paiement en EUR à l'étape Stripe : ${escapeHtml(formatEur(tot.subtotal))}.</p>` : ''}
      ${!pl.exact ? `<p class="drawer__warn">${escapeHtml(t.closestNote || '')}${pl.bundle ? ` (${escapeHtml(pl.bundle.title || pl.bundle.id)}${pl.withUpsell ? ' + chaussons' : ''})` : ''}</p>` : ''}
      <button type="button" class="btn btn--black btn--full" id="drawer-checkout"${pl.link ? '' : ' disabled'}>${escapeHtml(pl.link ? (t.checkout || 'Commander') : (t.soon || 'Paiement bientôt disponible'))}</button>`;
    q('#drawer-checkout').addEventListener('click', () => { const url = cart.checkoutUrl(); if (url) location.href = url; });
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
        <p class="cart-line__price">${priceHtml(unitP)}${cmp ? `<s>${priceHtml(cmp)}</s>` : ''}</p>
        <div class="cart-line__bottom"></div>
      </div>
      <div class="cart-line__right">
        ${priceHtml(unitP * line.qty)}
        <button type="button" class="icon-btn cart-line__remove" aria-label="Supprimer">${icon('close')}</button>
      </div>`;
    node.querySelector('.cart-line__bottom').append(makeQty({ value: line.qty, min: 0, max: 99, small: true, onChange: (v) => cart.setQty(index, v) }));
    node.querySelector('.cart-line__remove').addEventListener('click', () => cart.remove(index));
    return node;
  }

  q('#drawer-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const rerender = () => { if (drawer.classList.contains('is-open')) render(); };
  cart.onChange(rerender);
  document.addEventListener('currencychange', rerender);
  cart._setOpen(open);
}

/* ==================================================================
   6. Galerie (scroll-snap + flèches + miniatures + compteur) et visionneuse
   ================================================================== */

function setupGallery(root, images, name) {
  if (!root) return;
  const track = root.querySelector('.gallery__track');
  const thumbs = root.querySelector('.gallery__thumbs');
  const prev = root.querySelector('.gallery__arrow--prev');
  const next = root.querySelector('.gallery__arrow--next');
  const counter = root.querySelector('.gallery__counter');
  const dots = root.querySelector('.gallery__dots');
  if (!track) return;

  if (prev) prev.innerHTML = icon('arrow-left');
  if (next) next.innerHTML = icon('arrow-right');
  const n = images.length;
  if (!n) { if (prev) prev.hidden = true; if (next) next.hidden = true; if (counter) counter.hidden = true; if (dots) dots.hidden = true; return; }

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
      timg.src = src; timg.alt = ''; timg.width = 100; timg.height = 100; timg.loading = 'lazy';
      btn.append(timg);
      btn.addEventListener('click', () => goTo(i));
      thumbs.append(btn);
    }
    if (dots && n > 1) {
      const d = el('button', 'gallery__dot');
      d.type = 'button';
      d.setAttribute('aria-label', `Afficher la photo ${i + 1}`);
      d.addEventListener('click', () => goTo(i));
      dots.append(d);
    }
  });
  if (thumbs && n < 2) thumbs.hidden = true;
  if (n < 2) { if (prev) prev.hidden = true; if (next) next.hidden = true; if (counter) counter.hidden = true; if (dots) dots.hidden = true; }

  function goTo(i, smooth = true) {
    index = ((i % n) + n) % n;
    track.scrollTo({ left: index * track.clientWidth, behavior: smooth && !REDUCED_MOTION ? 'smooth' : 'auto' });
    updateUI();
  }
  function updateUI() {
    if (counter) counter.textContent = `${index + 1}/${n}`;
    if (dots) dots.querySelectorAll('.gallery__dot').forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
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
    counter.textContent = `${i + 1}/${n}`;
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
   7. Composants : pastilles, nuancier, quantité, accordéon
   ================================================================== */

/* Pastilles de taille (rayon 14 px, sélection = fond noir) */
function makePills(container, options, selected, onSelect) {
  if (!container) return;
  container.innerHTML = '';
  container.style.setProperty('--pill-cols', String(Math.max(1, options.length)));
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

/* Accordéon accessible : icône + (fermé) / − (ouvert), panneau animé via grid-template-rows */
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
      `<span class="acc__q">${escapeHtml(it.title)}</span>` +
      `<span class="acc__chev"><span class="acc__plus">${icon('plus')}</span><span class="acc__minus">${icon('minus')}</span></span>`;
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
   8. Accueil : produit vedette
   ================================================================== */

function renderHome(p, cart) {
  const home = p.home || {};
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const images = (p.images || []).slice(0, Math.max(1, Number(home.imageCount) || 6));
  const state = { size: sizes[0] || '', color: colors[0] || '', qty: 1 };

  setupGallery(q('#home-gallery'), images, p.name || '');
  setText('home-title', p.name);
  setPrice(q('#home-price'), p.priceEur);

  makePills(q('#home-sizes'), sizes, state.size, (v) => { state.size = v; });
  const colorName = q('#home-color-name');
  const setColor = (v) => { state.color = v; if (colorName) colorName.textContent = v || ''; };
  makeSwatches(q('#home-colors'), colors, state.color, setColor);
  setColor(state.color);
  const qtyBox = q('#home-qty');
  if (qtyBox) qtyBox.append(makeQty({ value: 1, onChange: (v) => { state.qty = v; } }));

  const lines = () => [{ id: 'onesie', size: state.size, color: state.color, qty: state.qty }];
  const addBtn = q('#home-add');
  const stripeBtn = q('#home-stripe');
  if (addBtn) {
    addBtn.innerHTML = `${icon('cart')}<span>${escapeHtml(home.addToCart || 'Ajouter au panier')}</span>`;
    addBtn.addEventListener('click', () => addToCartAndOpen(cart, lines()));
  }
  if (stripeBtn) {
    stripeBtn.textContent = home.payWithStripe || 'Payer avec Stripe';
    stripeBtn.addEventListener('click', () => {
      const url = cart.checkoutUrl(lines());
      if (url) location.href = url; else toast((p.cart || {}).soon || 'Paiement bientôt disponible');
    });
  }

  // « Plus d'options de paiement » : popover (démo)
  const more = q('#home-more');
  if (more) {
    more.textContent = home.moreOptions || 'Plus d\'options de paiement';
    const options = Array.isArray(p.paymentOptions) && p.paymentOptions.length ? p.paymentOptions : ['Stripe', 'Apple Pay', 'Google Pay', 'PayPal'];
    attachPopover(more, `
      <p class="popover__title">Moyens de paiement</p>
      <ul class="popover__list">${options.map((o) => `<li>${PAYMENT_ICONS[o] ? PAYMENT_ICONS[o]() : ''}<span>${escapeHtml(o)}</span><small>démo</small></li>`).join('')}</ul>`);
  }

  setupStickyBar({
    getPrice: () => round2(cart.onesiePrice(state.qty)),
    label: p.name,
    thumb: p.bundleThumb || p.thumbnail || images[0] || '',
    options: [
      { label: 'Taille', values: sizes, get: () => state.size, set: (v) => { state.size = v; selectPressed(q('#home-sizes'), v); } },
      { label: 'Couleur', values: colors, get: () => state.color, set: (v) => { setColor(v); selectPressed(q('#home-colors'), v, 'aria-label'); } },
    ],
    onClick: () => addToCartAndOpen(cart, lines()),
    canAdd: () => !sizes.length || Boolean(state.size),
    anchor: addBtn,
  });
}

/* Met à jour l'état « pressé » d'un groupe de pastilles / nuances depuis l'extérieur (barre flottante) */
function selectPressed(container, value, attr = '') {
  if (!container) return;
  container.querySelectorAll('[aria-pressed]').forEach((b) => {
    const v = attr ? b.getAttribute(attr) : b.textContent.trim();
    const on = v === value;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-checked', String(on));
  });
}

/* ==================================================================
   9. Page produit
   ================================================================== */

function renderProduct(p, cart) {
  setupGallery(q('#product-gallery'), p.images || [], p.name || '');
  renderRating(p.rating);
  setText('product-name', p.name);
  setPrice(q('#price'), p.priceEur);
  const cmp = q('#compare-at');
  if (cmp) { const c = Number(p.compareAtEur) || 0; if (c) setPrice(cmp, c); cmp.hidden = !c; }
  // Phrase des tailles : **…** en gras, comme « *Sizing up by two sizes* is recommended* »
  const note = q('#sizing-note');
  if (note) note.innerHTML = escapeHtml(p.sizingNote || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  setText('bundle-label', p.bundleLabel || 'Bundle & économisez');
  const chart = q('#size-chart-img');
  if (chart && p.sizeChart) chart.src = p.sizeChart;

  const shop = createOffers(p, cart);
  renderFeatures(p.features || []);
  renderProof(p.purchaseProof);
  renderPaymentIcons(p);
  renderBuyboxAccordion(p);
  setupSlideshow(p.slideshow || {});
  renderTestimonials(p);
  renderFaq(p);
  renderContactTexts(p);
  setupStickyBar({
    getPrice: shop.subtotal,
    compare: Number(p.compareAtEur) || 0,
    label: p.name,
    thumb: p.bundleThumb || p.thumbnail || (p.images || [])[0] || '',
    options: [
      { label: 'Taille', values: p.sizes || [], get: () => shop.getOption('size'), set: (v) => shop.setOption('size', v) },
      { label: 'Couleur', values: p.colors || [], get: () => shop.getOption('color'), set: (v) => shop.setOption('color', v) },
    ],
    onChange: shop.onChange,
    onClick: shop.addToCart,
    canAdd: () => true,
    anchor: q('#cta'),
  });
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

/* Widget « Bundle & économisez » : 3 offres ; par article une ligne
   [miniature 64×66 | Taille | Couleur] (repliée sur les cartes non
   sélectionnées) ; bande chaussons olive foncé sur CHAQUE carte (état
   partagé) ; autocollant « RECOMMANDÉ » sur la carte 3 ; ligne « Cadeau
   exclusif » sous les cartes (déverrouillée quand la carte 3 est choisie) ;
   quantité, sous-total, ajout au panier. */
function createOffers(p, cart) {
  const unit = Number(p.priceEur) || 0;
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : [''];
  const bundles = (Array.isArray(p.bundles) ? p.bundles : []).filter((b) => b && b.id && Number(b.qty) > 0);
  const upsell = p.upsell && p.upsell.enabled ? p.upsell : null;
  const upsellSizes = upsell && Array.isArray(upsell.sizes) ? upsell.sizes : [];
  const list = q('#offers');
  const giftBox = q('#offers-gift');
  const gift = p.bundleGift && (p.bundleGift.text || p.bundleGift.lead) ? p.bundleGift : null;
  const thumb = p.bundleThumb || (p.images && p.images[0]) || '';
  const listeners = [];

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
  // Ligne « Cadeau exclusif : … » + boîte cadeau 64×64, sous les trois cartes
  if (giftBox && gift) {
    giftBox.classList.add('offer-gift');
    giftBox.innerHTML = `
      <p class="offer-gift__text">${gift.lead ? `<b>${escapeHtml(gift.lead)}</b>` : ''}${gift.lead && gift.text ? ' : ' : ''}${escapeHtml(gift.text || '')}</p>
      <span class="offer-gift__box" aria-hidden="true">${gift.icon ? `<img src="${escapeHtml(gift.icon)}" alt="" width="36" height="36" loading="lazy">` : ''}</span>`;
  } else if (giftBox) giftBox.hidden = true;

  function offerCard(b) {
    const qty = Number(b.qty);
    const card = el('div', 'offer');
    card.dataset.bundle = b.id;
    const inputId = `offer-${b.id}`;
    const rows = state.items[b.id].map((item, i) => `
      ${qty > 1 ? `<p class="offer__num">Article ${i + 1}</p>` : ''}
      <div class="offer__row">
        <img class="offer__thumb" src="${escapeHtml(thumb)}" alt="" width="64" height="66" loading="lazy">
        <span class="select"><span class="select__label">Taille</span><span class="select__wrap">${selectHtml(sizes, item.size, i, 'size', `Taille${qty > 1 ? ` – article ${i + 1}` : ''}`)}</span></span>
        <span class="select"><span class="select__label">Couleur</span><span class="select__wrap">${selectHtml(colors, item.color, i, 'color', `Couleur${qty > 1 ? ` – article ${i + 1}` : ''}`)}</span></span>
      </div>`).join('');
    // Bande chaussons : hors du corps repliable, donc visible sur chaque carte
    const upsellHtml = upsell ? `
      <div class="upsell" data-upsell>
        <label class="upsell__main">
          <input class="upsell__check" type="checkbox" data-upsell-check>
          ${upsell.image ? `<img class="upsell__thumb" src="${escapeHtml(upsell.image)}" alt="" width="64" height="66" loading="lazy">` : ''}
          <span><span class="upsell__title">${escapeHtml(upsell.label || upsell.name || '')}</span>${upsell.sizeHint ? `<span class="upsell__hint">${escapeHtml(upsell.sizeHint)}</span>` : ''}</span>
        </label>
        <span class="select select--upsell"><span class="select__wrap">${selectHtml(upsellSizes, state.upsellSize, 0, 'upsellSize', 'Taille des chaussons')}</span></span>
        ${priceHtml(upsell.priceEur, 'upsell__price')}
      </div>` : '';
    card.innerHTML = `
      <input class="offer__input" type="radio" name="offer" id="${inputId}" value="${escapeHtml(b.id)}">
      ${b.sticker ? `<span class="offer__sticker" aria-hidden="true">${CROWN_SVG}<span>${escapeHtml(b.sticker)}</span></span>` : ''}
      <label class="offer__head" for="${inputId}">
        <span class="offer__radio" aria-hidden="true"></span>
        <span class="offer__text">
          <span class="offer__title">${escapeHtml(b.title || `Acheter ${qty}`)}${b.badge ? `<span class="offer__badge">${escapeHtml(b.badge)}</span>` : ''}</span>
          ${b.subtitle ? `<span class="offer__sub">${escapeHtml(b.subtitle)}</span>` : ''}
          ${b.text ? `<span class="offer__desc">${escapeHtml(b.text)}</span>` : ''}
        </span>
        <span class="offer__price">
          ${priceHtml(bundlePrice(b), 'offer__now')}
          ${bundleCompare(b) ? `<s class="offer__was">${priceHtml(bundleCompare(b))}</s>` : ''}
        </span>
      </label>
      <div class="offer__body"><div><div class="offer__inner">${rows}</div></div></div>
      ${upsellHtml}`;
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
      }
      // Les sélecteurs de l'article 1 reflètent l'état (modifiable aussi depuis la barre flottante)
      (state.items[card.dataset.bundle] || []).forEach((item, i) => {
        ['size', 'color'].forEach((f) => {
          const s = card.querySelector(`select[data-item="${i}"][data-field="${f}"]`);
          if (s && s.value !== item[f]) s.value = item[f];
        });
      });
    });
    if (giftBox && gift) giftBox.classList.toggle('is-unlocked', !gift.unlockBundle || state.bundleId === gift.unlockBundle);
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
  function addToCart() { addToCartAndOpen(cart, lines()); }
  function update() {
    setPrice(q('#subtotal'), subtotal());
    listeners.forEach((fn) => fn());
    document.dispatchEvent(new CustomEvent('subtotalchange'));
  }
  /* Option (taille / couleur) de l'article 1 du pack courant — utilisée par la barre flottante */
  function getOption(field) {
    const b = current();
    const it = b && state.items[b.id] ? state.items[b.id][0] : null;
    return it ? it[field] || '' : '';
  }
  function setOption(field, value) {
    const b = current();
    const it = b && state.items[b.id] ? state.items[b.id][0] : null;
    if (!it || it[field] === value) return;
    it[field] = value;
    syncUI();
    update();
  }

  const cta = q('#cta');
  if (cta) cta.addEventListener('click', addToCart);
  syncUI();
  update();
  return { addToCart, subtotal, lines, getOption, setOption, onChange: (fn) => listeners.push(fn) };
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

/* « Sarah et 438 personnes ont acheté » : pile de 3 avatars + point « live » */
function renderProof(proof) {
  const node = q('#proof');
  if (!node || !proof || !proof.enabled || !proof.text) return;
  const avatars = (Array.isArray(proof.avatars) && proof.avatars.length ? proof.avatars : [proof.avatar]).filter(Boolean).slice(0, 3);
  const [first, ...rest] = String(proof.text).split(' ');
  node.innerHTML = `
    ${avatars.length ? `<span class="proof__stack">${avatars.map((a) => `<img src="${escapeHtml(a)}" alt="" width="28" height="28" loading="lazy">`).join('')}</span>` : ''}
    <span class="proof__dot" aria-hidden="true"></span>
    <span><b>${escapeHtml(first)}</b> ${escapeHtml(rest.join(' '))}</span>`;
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
  makeAccordion(box, items, { exclusive: true, numbered: false, level: 'h2' });
}

/* ==================================================================
   10. Pages produit simples (chaussons, porte-clés)
   ================================================================== */

function renderSimpleProduct(p, cart, key) {
  const prod = (p.products || {})[key];
  if (!prod) { const e = q('#load-error'); if (e) { e.hidden = false; e.textContent = `Produit « ${key} » introuvable dans product.json.`; } return; }
  const sizes = Array.isArray(prod.sizes) ? prod.sizes : [];
  const state = { size: sizes[0] || '', qty: 1 };

  setupGallery(q('#sp-gallery'), prod.images || [], prod.name || '');
  setText('sp-name', prod.name);
  setPrice(q('#sp-price'), prod.priceEur);
  const cmp = q('#sp-compare');
  if (cmp) { const c = Number(prod.compareAtEur) || 0; if (c) setPrice(cmp, c); cmp.hidden = !c; }
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
  if (qtyBox) qtyBox.append(makeQty({ value: 1, onChange: (v) => { state.qty = v; document.dispatchEvent(new CustomEvent('subtotalchange')); } }));

  const bl = q('#sp-bullets');
  if (bl && Array.isArray(prod.bullets)) prod.bullets.forEach((t) => { const li = el('li'); li.innerHTML = `${icon('check')}<span>${escapeHtml(t)}</span>`; bl.append(li); });

  const lines = () => [{ id: key, size: state.size, color: '', qty: state.qty }];
  const addToCart = () => addToCartAndOpen(cart, lines());
  const cta = q('#cta');
  if (cta) cta.addEventListener('click', addToCart);

  const acc = q('#sp-acc');
  if (acc) {
    const s = p.shipping || {};
    const ul = el('ul', 'ship-list');
    [['box', s.processing], ['globe', s.international], ['truck', s.france]].filter(([, t]) => t).forEach(([ic, text]) => {
      const li = el('li'); li.innerHTML = `${icon(ic)}<span>${escapeHtml(text)}</span>`; ul.append(li);
    });
    makeAccordion(acc, [{ title: (p.buyboxAccordion || {}).shippingTitle || 'Préparation & livraison', content: ul }], { exclusive: true, level: 'h2' });
  }
  setupStickyBar({
    getPrice: () => round2((Number(prod.priceEur) || 0) * state.qty),
    compare: Number(prod.compareAtEur) || 0,
    label: prod.name,
    thumb: prod.image || (prod.images || [])[0] || '',
    options: sizes.length ? [{ label: 'Taille', values: sizes, get: () => state.size, set: (v) => { state.size = v; selectPressed(q('#sp-sizes'), v); } }] : [],
    onClick: addToCart,
    canAdd: () => !sizes.length || Boolean(state.size),
    anchor: cta,
  });
}

/* ==================================================================
   11. Sections partagées
   ================================================================== */

/* Diaporama : GIF 9:16 centré sur fond sombre, défilement automatique
   (pause au survol / hors écran), points et flèches ; seule la 1re diapo
   est chargée au départ (les autres au moment de leur affichage). */
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

/* « Vu sur TikTok » : 3 vidéos. Si `src` (fichier local) est renseigné, on
   l'affiche en <video> et on bascule sur l'iframe /embed/v2 si le fichier
   manque ; sinon iframe directement (aucun script externe requis).
   Le champ `url` n'est jamais affiché. */
function renderTiktok(p) {
  const t = p.tiktok || {};
  const grid = q('#tiktok-grid');
  const section = q('#tiktok');
  if (!grid) return;
  const videos = (Array.isArray(t.videos) ? t.videos : []).filter((v) => v && /^\d{5,25}$/.test(String(v.id)));
  if (!videos.length) { if (section) section.hidden = true; return; }
  setText('tiktok-title', t.title || 'Vu sur TikTok');
  setText('tiktok-sub', t.subtitle || '');
  const iframeHtml = (v, i) => `<iframe src="https://www.tiktok.com/embed/v2/${encodeURIComponent(String(v.id))}" width="325" height="575" loading="lazy" allow="encrypted-media" allowfullscreen title="Vidéo TikTok ${i + 1} – ${escapeHtml(p.brand || '')}"></iframe>`;
  videos.forEach((v, i) => {
    const item = el('div', 'tiktok__item');
    const local = typeof v.src === 'string' && /^[\w./-]+\.(mp4|webm|mov)$/i.test(v.src);
    item.innerHTML = `
      <div class="tiktok__frame">
        ${local
          ? `<video src="${escapeHtml(v.src)}" controls muted loop playsinline preload="metadata" width="325" height="575" aria-label="Vidéo TikTok ${i + 1} – ${escapeHtml(p.brand || '')}"></video>`
          : iframeHtml(v, i)}
      </div>
      <p class="tiktok__views">${icon('play')}<span>${escapeHtml(v.views || '')}</span></p>`;
    const video = item.querySelector('video');
    if (video) video.addEventListener('error', () => { video.outerHTML = iframeHtml(v, i); }, { once: true });
    grid.append(item);
  });
}

function renderTestimonials(p) {
  const section = q('#testimonials');
  const grid = q('#testimonials-grid');
  if (!section || !grid) return;
  const list = Array.isArray(p.testimonials) ? p.testimonials : [];
  if (!list.length) { section.hidden = true; return; }
  setText('testimonials-title', p.testimonialsTitle || 'Join over 10,000+ Happy Customers');
  const pill = q('#testimonials-pill');
  if (pill) { pill.textContent = p.testimonialsPill || ''; pill.hidden = !p.testimonialsPill; }
  // Cartes : nom, titre en italique gras entre guillemets, 5 étoiles, texte ; la carte centrale est inversée (noire)
  list.forEach((t, i) => {
    const dark = t.dark === true || (t.dark === undefined && i === 1);
    const card = el('article', 'review' + (dark ? ' review--dark' : ''));
    card.innerHTML = `
      <p class="review__name">${escapeHtml(t.name || 'Client')}</p>
      ${t.title ? `<h3 class="review__title">${escapeHtml(t.title)}</h3>` : ''}
      <span class="stars stars--sm" role="img" aria-label="5 étoiles sur 5">${starsHtml(5)}</span>
      <p class="review__text">${escapeHtml(t.text || '')}</p>`;
    grid.append(card);
  });
  // Carrousel : flèches rondes (défilement d'une carte), balayage natif (scroll-snap)
  const prev = section.querySelector('.testimonials__arrow--prev');
  const next = section.querySelector('.testimonials__arrow--next');
  const step = () => { const c = grid.querySelector('.review'); return (c ? c.getBoundingClientRect().width : grid.clientWidth) + 24; };
  if (prev) { prev.innerHTML = icon('arrow-left'); prev.addEventListener('click', () => grid.scrollBy({ left: -step(), behavior: REDUCED_MOTION ? 'auto' : 'smooth' })); }
  if (next) { next.innerHTML = icon('arrow-right'); next.addEventListener('click', () => grid.scrollBy({ left: step(), behavior: REDUCED_MOTION ? 'auto' : 'smooth' })); }
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
  setText('contact-title', c.title || 'Reach Out Any Time');
  const txt = q('#contact-text');
  if (txt) { txt.textContent = c.text || ''; txt.hidden = !c.text; }
  const btn = q('#contact-submit');
  if (btn && c.submit) btn.textContent = c.submit;
  // Textes des champs affichés en placeholder (libellés conservés pour les lecteurs d'écran)
  const ph = c.placeholders || {};
  qa('[data-ph]').forEach((n) => {
    const v = ph[n.dataset.ph];
    if (!v) return;
    n.placeholder = v;
    const label = n.parentElement && n.parentElement.querySelector('.sr-only');
    if (label) label.textContent = v.replace(/\s*\*\s*$/, '');
  });
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

/* Page « Connexion » (démo : aucun compte) */
function setupLogin() {
  const form = q('#login-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    if (input && !input.checkValidity()) { input.focus(); toast('Adresse e-mail invalide'); return; }
    toast('Démo : la connexion n\'est pas disponible.');
  });
}

/* Barre d'achat flottante : miniature + titre/prix + listes Taille/Couleur
   (synchronisées avec la boîte d'achat) + bouton « Ajouter au panier ».
   Visible dès que le CTA principal est sorti de l'écran. */
function setupStickyBar({ getPrice, compare = 0, label, thumb = '', options = [], onChange = null, onClick, canAdd = () => true, anchor }) {
  const bar = q('#sticky-bar');
  const btn = q('#sticky-cta');
  if (!bar || !btn || !anchor) return;
  document.body.classList.add('has-sticky-bar');
  const price = q('#sticky-price');
  const cmp = q('#sticky-compare');
  const lab = q('#sticky-label');
  const img = q('#sticky-thumb');
  const opts = q('#sticky-opts');
  if (lab) lab.textContent = label || '';
  if (img) { if (thumb) img.src = thumb; else img.hidden = true; }
  if (cmp) { if (compare) setPrice(cmp, compare); cmp.hidden = !compare; }
  btn.innerHTML = `${icon('cart')}<span>Ajouter au panier</span>`;

  const valid = options.filter((o) => o && Array.isArray(o.values) && o.values.length);
  if (opts) {
    opts.innerHTML = valid.map((o, i) => `
      <span class="sticky-bar__select"><select data-sticky-opt="${i}" aria-label="${escapeHtml(o.label || '')}">${o.values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}</select></span>`).join('');
    opts.hidden = !valid.length;
    const sync = () => valid.forEach((o, i) => { const s = opts.querySelector(`[data-sticky-opt="${i}"]`); if (s && o.get) s.value = o.get(); });
    opts.addEventListener('change', (e) => {
      const s = e.target.closest('[data-sticky-opt]');
      if (!s) return;
      const o = valid[Number(s.dataset.stickyOpt)];
      if (o && o.set) o.set(s.value);
    });
    sync();
    if (onChange) onChange(sync);
    document.addEventListener('change', sync);
  }

  const refresh = () => setPrice(price, getPrice());
  refresh();
  document.addEventListener('subtotalchange', refresh);
  document.addEventListener('change', refresh);
  document.addEventListener('click', () => setTimeout(refresh, 0));
  btn.addEventListener('click', () => {
    if (!canAdd()) {
      const box = q('#buybox');
      if (box) box.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
      toast('Choisissez d\'abord une taille');
      return;
    }
    onClick();
  });
  if (!('IntersectionObserver' in window)) { bar.classList.add('is-visible'); bar.setAttribute('aria-hidden', 'false'); return; }
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
  }, { rootMargin: '-100px 0px 0px 0px' }).observe(anchor);
}

/* ==================================================================
   12. Utilitaires
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

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

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
