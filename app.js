/* ==================================================================
   Cozy Dragon — app.js
   Charge ./product.json et construit la page produit. Aucune dépendance.
   Sur les pages secondaires (légales, merci), seuls les éléments communs
   (marque, e-mail, année, réseaux sociaux, logo, icônes) sont remplis.

   Logique d'achat : pas de panier. Chaque bundle possède un Payment Link
   Stripe « sans » et « avec » la vente additionnelle. Au clic sur le CTA,
   on redirige vers le bon lien avec un client_reference_id qui encode
   bundle + tailles + couleurs (+ pointure des chaussons).
   ================================================================== */

'use strict';

const STORAGE_KEY = 'cozydragon:selection';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Icônes SVG inline (trait, 24 px) ----------
   features[].icon et bullets[].icon acceptent une clé ci-dessous ou un emoji. */

const STAR_PATH = 'M12 2.6l2.8 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2 6.2 20.4l1.3-6.5L2.6 9.4l6.6-.8z';

const ICONS = {
  star: `<path fill="currentColor" stroke="none" d="${STAR_PATH}"/>`,
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l4 4v3h-8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  undo: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  headset: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="13" width="5" height="7" rx="2"/><rect x="17" y="13" width="5" height="7" rx="2"/><path d="M19 20a3 3 0 0 1-3 2h-3"/>',
  feather: '<path d="M20.2 3.8c-2.6-2.6-7.4-1.5-10.8 1.9S5.3 13.6 5.3 13.6L3 21l7.4-2.3s4.5-.7 7.9-4.1 4.5-8.2 1.9-10.8z"/><path d="M3 21l9.6-9.6M14 7l3 3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8zM5 2l.6 1.6 1.6.6-1.6.6L5 6.4l-.6-1.6-1.6-.6 1.6-.6z"/>',
  gift: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
  flame: '<path d="M12 22c4.4 0 7.5-3 7.5-7.2 0-3.2-1.8-5.2-3.3-7.3-.6 1.9-1.4 2.9-2.8 3.4C13.6 7 12.7 4 9.8 2c.4 3.4-1.9 5-3.8 7.4A7.4 7.4 0 0 0 4.5 14.8C4.5 19 7.6 22 12 22z"/><path d="M12 22a3 3 0 0 1-3-3c0-1.6 1.1-2.1 1.6-3.6.8.8 1.4 1.3 1.4 2.4 1-.5 1.5-1.5 1.5-2.6.8 1 1.5 2.1 1.5 3.8a3 3 0 0 1-3 3z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  wash: '<path d="M12 2.8s6.5 7 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 9.8 12 2.8 12 2.8z"/><path d="M8.5 14a3.5 3.5 0 0 0 3.5 3.5"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21zM8 10l2 2M11 7l2 2M14 4l2 2M5 13l2 2"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  heart: '<path d="M12 21s-7.5-4.6-9.5-9.3C1 7.6 4 4 7.5 4c2 0 3.4 1 4.5 2.5C13.1 5 14.5 4 16.5 4 20 4 23 7.6 21.5 11.7 19.5 16.4 12 21 12 21z"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
  mail: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 7l10 7 10-7"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
  tiktok: '<path fill="currentColor" stroke="none" d="M16.6 2h-3.3v13.7a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.5a6.2 6.2 0 1 0 5.3 6.2V8.4a7.6 7.6 0 0 0 4.4 1.4V6.5A4.5 4.5 0 0 1 16.6 2z"/>',
  slipper: '<path d="M4 15c0-5 3-9 8-9s8 4 8 9v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1z"/><path d="M4 15h16M9 10c1 1.5 5 1.5 6 0"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) return `<span class="emoji" aria-hidden="true">${escapeHtml(name)}</span>`;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ---------- Point d'entrée ---------- */

(async function main() {
  const product = await loadProduct();
  if (!product) return;
  fillCommon(product);
  if (document.getElementById('buybox')) renderStore(product);
})();

async function loadProduct() {
  try {
    const res = await fetch('./product.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const box = document.getElementById('load-error');
    if (box) {
      box.hidden = false;
      box.textContent =
        'Impossible de charger product.json (' + err.message + '). ' +
        'Ouvrez la boutique via un serveur (npm run serve), pas en double-cliquant sur le fichier.';
    }
    console.error(err);
    return null;
  }
}

/* ==================================================================
   Éléments communs à toutes les pages
   ================================================================== */

function fillCommon(p) {
  qa('[data-brand]').forEach((el) => { el.textContent = p.brand || ''; });
  qa('[data-tagline]').forEach((el) => { el.textContent = p.tagline || ''; });
  qa('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  qa('[data-email]').forEach((el) => { el.textContent = p.supportEmail || ''; });
  qa('[data-email-link]').forEach((el) => {
    if (p.supportEmail) el.href = 'mailto:' + p.supportEmail;
    else el.hidden = true;
  });
  qa('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  qa('[data-shipping]').forEach((el) => {
    const text = (p.shipping || {})[el.dataset.shipping];
    if (text) el.textContent = text;
  });
  setSocial('instagram', p.instagram);
  setSocial('tiktok', p.tiktok);
  if (p.logo) probeLogo(p.brand, p.logo);
}

/* Liens réseaux sociaux : masqués si l'URL est vide. */
function setSocial(network, url) {
  qa(`[data-social="${network}"]`).forEach((a) => {
    if (!url) { a.hidden = true; return; }
    a.href = url;
    a.hidden = false;
    if (!a.querySelector('svg')) a.insertAdjacentHTML('afterbegin', icon(network));
  });
}

/* Logo : si product.json.logo pointe vers une image existante (ex. "img/logo.png"),
   elle remplace le nom de marque en texte. Champ absent = pas de requête, pas de 404. */
function probeLogo(brand, logoPath) {
  const link = q('[data-brand-link]');
  if (!link) return;
  const img = new Image();
  img.onload = () => {
    img.className = 'brand__logo';
    img.alt = brand || 'Logo';
    img.height = 36;
    img.width = Math.max(36, Math.round((36 * img.naturalWidth) / img.naturalHeight)) || 120;
    const text = link.querySelector('.brand__text');
    if (text) text.hidden = true;
    link.prepend(img);
  };
  img.src = logoPath;
}

/* ==================================================================
   Page produit
   ================================================================== */

function renderStore(p) {
  renderAnnouncement(p.announcement);
  setupGallery(p.images || [], p.name || '');
  renderRating(p.rating);
  setText('product-name', p.name);
  setText('product-tagline', p.tagline);
  renderPrice(p);
  renderSizingNote(p.sizingNote);

  const shop = createShop(p); // bundles, vente additionnelle, totaux, CTA

  renderFeatures(p.features || []);
  renderBuyboxAccordion(p);
  renderProof(p.purchaseProof);
  renderEditorial(p.slideshow || {}, p.images || []);
  renderBenefits(p.bullets || [], p.description);
  renderTestimonials(p.testimonials || []);
  renderFaq(p.faq || []);
  setupContact(p);
  setupStickyBar(shop);
}

/* ---------- 1. Barre d'annonce ---------- */

function renderAnnouncement(a) {
  const box = q('#announce');
  const text = q('#announce-text');
  if (!box || !text) return;
  if (!a || !a.text) { box.hidden = true; return; }
  let html = escapeHtml(a.text);
  if (a.code) html = html.split(escapeHtml(a.code)).join(`<strong>${escapeHtml(a.code)}</strong>`);
  text.innerHTML = html;
}

/* ---------- 3a. Galerie (scroll-snap + flèches + miniatures + visionneuse) ---------- */

function setupGallery(images, name) {
  const track = q('#gallery-track');
  const thumbs = q('#gallery-thumbs');
  const prev = q('#gallery-prev');
  const next = q('#gallery-next');
  const counter = q('#gallery-counter');
  if (!track) return;

  prev.innerHTML = icon('arrow-left');
  next.innerHTML = icon('arrow-right');

  if (!images.length) {
    prev.hidden = next.hidden = true;
    counter.hidden = true;
    return;
  }

  const openLightbox = setupLightbox(images, name);
  const n = images.length;
  let index = 0;

  images.forEach((src, i) => {
    const slide = el('div', 'gallery__slide');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'diapositive');
    slide.setAttribute('aria-label', `Photo ${i + 1} sur ${n}`);

    const img = el('img');
    img.src = src;
    img.alt = i === 0 ? name : `${name} – photo ${i + 1}`;
    img.width = 800;
    img.height = 800;
    img.decoding = 'async';
    if (i === 0) {
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else {
      img.loading = 'lazy';
    }
    img.addEventListener('click', () => openLightbox(index));
    slide.append(img);
    track.append(slide);

    if (n > 1) {
      const btn = el('button', 'gallery__thumb');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', `Afficher la photo ${i + 1}`);
      btn.setAttribute('aria-selected', 'false');
      const timg = el('img');
      timg.src = src;
      timg.alt = '';
      timg.width = 76;
      timg.height = 76;
      timg.loading = 'lazy';
      btn.append(timg);
      btn.addEventListener('click', () => goTo(i));
      thumbs.append(btn);
    }
  });

  if (n < 2) {
    prev.hidden = next.hidden = true;
    counter.hidden = true;
  }

  function goTo(i, smooth = true) {
    index = ((i % n) + n) % n; // boucle
    track.scrollTo({ left: index * track.clientWidth, behavior: smooth && !REDUCED_MOTION ? 'smooth' : 'auto' });
    updateUI();
  }

  function updateUI() {
    counter.textContent = `${index + 1} / ${n}`;
    thumbs.querySelectorAll('.gallery__thumb').forEach((b, i) => {
      const active = i === index;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
      if (active && typeof b.scrollIntoView === 'function') {
        b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
      }
    });
  }

  // Synchronise l'index sur le défilement (swipe mobile, molette)
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

  prev.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    if (e.key === 'Enter') openLightbox(index);
  });
  window.addEventListener('resize', () => goTo(index, false));
  updateUI();
}

/* Visionneuse plein écran (<dialog>) */
function setupLightbox(images, name) {
  const dlg = q('#lightbox');
  if (!dlg) return () => {};
  const img = q('#lightbox-img');
  const prev = q('#lightbox-prev');
  const next = q('#lightbox-next');
  const close = q('#lightbox-close');
  const counter = q('#lightbox-counter');
  const n = images.length;
  let i = 0;

  prev.innerHTML = icon('arrow-left');
  next.innerHTML = icon('arrow-right');
  close.innerHTML = icon('close');
  if (n < 2) prev.hidden = next.hidden = true;

  function show(k) {
    i = ((k % n) + n) % n;
    img.src = images[i];
    img.alt = `${name} – photo ${i + 1} sur ${n}`;
    counter.textContent = `${i + 1} / ${n}`;
  }
  function open(k) {
    show(k);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
  }
  function shut() {
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  dlg.addEventListener('close', () => { document.body.style.overflow = ''; });
  close.addEventListener('click', shut);
  prev.addEventListener('click', () => show(i - 1));
  next.addEventListener('click', () => show(i + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) shut(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });

  // Balayage tactile
  let x0 = null;
  dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  }, { passive: true });

  return open;
}

/* ---------- 3b. Boîte d'achat : note, prix, taille ---------- */

function renderRating(r) {
  const box = q('#rating');
  if (!box || !r || !Number(r.value)) return;
  const value = Math.min(5, Math.max(0, Number(r.value)));
  q('#rating-stars').innerHTML = starsHtml(value);
  const parts = [value.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + '/5'];
  if (r.count) parts.push(r.count);
  q('#rating-text').textContent = parts.join(' · ');
  box.hidden = false;
}

/* 5 étoiles, remplissage partiel pour la dernière (4,8 → 80 %). */
function starsHtml(value) {
  let html = '';
  for (let k = 0; k < 5; k++) {
    const ratio = Math.min(1, Math.max(0, value - k));
    html += `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="${STAR_PATH}" fill="#d9d5cb"/>
      <path d="${STAR_PATH}" fill="currentColor" style="clip-path: inset(0 ${Math.round((1 - ratio) * 100)}% 0 0)"/>
    </svg>`;
  }
  return html;
}

function renderPrice(p) {
  const unit = Number(p.priceEur) || 0;
  const compare = Number(p.compareAtEur) || 0;
  setText('price', formatPrice(unit, p.currency));
  if (compare > unit) {
    const was = q('#compare-at');
    const pill = q('#discount');
    const gpill = q('#gallery-pill');
    const pct = Math.round((1 - unit / compare) * 100);
    was.textContent = formatPrice(compare, p.currency);
    was.hidden = false;
    pill.textContent = `-${pct} %`;
    pill.hidden = false;
    if (gpill) { gpill.textContent = `-${pct} %`; gpill.hidden = false; }
  }
}

function renderSizingNote(note) {
  const el = q('#sizing-note');
  if (!el || !note) return;
  el.innerHTML = icon('ruler') + `<span>${escapeHtml(note)}</span>`;
  el.hidden = false;
}

/* ---------- 3c. Bundles, vente additionnelle, totaux, paiement ---------- */

function createShop(p) {
  const currency = p.currency || 'eur';
  const unit = Number(p.priceEur) || 0;
  const compare = Number(p.compareAtEur) || 0;
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : [''];
  const bundles = (Array.isArray(p.bundles) ? p.bundles : []).filter((b) => b && b.id && Number(b.qty) > 0);
  const upsell = p.upsell && p.upsell.enabled ? p.upsell : null;
  const upsellSizes = upsell && Array.isArray(upsell.sizes) ? upsell.sizes : [];
  const defaultSize = sizes[Math.min(1, sizes.length - 1)] || '';

  /* --- État (restauré depuis localStorage, puis validé contre product.json) --- */
  const state = loadState();
  if (!bundles.some((b) => b.id === state.bundleId)) {
    state.bundleId = (bundles.find((b) => b.default) || bundles[0] || {}).id || '';
  }
  const saved = state.items && typeof state.items === 'object' ? state.items : {};
  state.items = {};
  bundles.forEach((b) => {
    const arr = Array.isArray(saved[b.id]) ? saved[b.id] : [];
    state.items[b.id] = Array.from({ length: Number(b.qty) }, (_, i) => ({
      size: sizes.includes(arr[i] && arr[i].size) ? arr[i].size : defaultSize,
      color: colors.includes(arr[i] && arr[i].color) ? arr[i].color : colors[0],
    }));
  });
  state.upsell = Boolean(upsell && state.upsell);
  if (!upsellSizes.includes(state.upsellSize)) state.upsellSize = upsellSizes[Math.min(2, upsellSizes.length - 1)] || '';

  const bundleTotals = (b) => ({
    now: round2(Number(b.qty) * unit * (1 - (Number(b.discountPct) || 0) / 100)),
    was: round2(Number(b.qty) * compare),
  });
  const current = () => bundles.find((b) => b.id === state.bundleId) || bundles[0];

  /* --- Rendu des cartes bundle --- */
  const list = q('#bundles');
  if (bundles.length) {
    bundles.forEach((b) => list.append(bundleCard(b)));
  } else {
    q('.bundle-section').hidden = true;
  }

  function bundleCard(b) {
    const t = bundleTotals(b);
    const qty = Number(b.qty);
    const popular = /populaire|best|top/i.test(b.badge || '');
    const card = el('div', 'bundle');
    card.dataset.bundle = b.id;
    if (b.badge) card.classList.add('has-badge');

    const inputId = `bundle-${b.id}`;
    const rows = state.items[b.id].map((item, i) => `
      <div class="item-row">
        ${qty > 1 ? `<span class="item-row__label">Article ${i + 1}</span>` : ''}
        <span class="select">
          <span class="select__label">Taille</span>
          <span class="select__wrap">${selectHtml(sizes, item.size, { item: i, field: 'size', label: `Taille${qty > 1 ? ` – article ${i + 1}` : ''}` })}</span>
        </span>
        <span class="select">
          <span class="select__label">Couleur</span>
          <span class="select__wrap">${selectHtml(colors, item.color, { item: i, field: 'color', label: `Couleur${qty > 1 ? ` – article ${i + 1}` : ''}` })}</span>
        </span>
      </div>`).join('');

    card.innerHTML = `
      <input class="bundle__input" type="radio" name="bundle" id="${inputId}" value="${escapeHtml(b.id)}">
      ${b.badge ? `<span class="bundle__badge pill ${popular ? 'pill--acid' : 'pill--dark'}">${escapeHtml(b.badge)}</span>` : ''}
      <label class="bundle__head" for="${inputId}">
        <span class="bundle__radio" aria-hidden="true"></span>
        <span class="bundle__qty" aria-hidden="true">${qty}×</span>
        <span class="bundle__text">
          <span class="bundle__title">${escapeHtml(b.title || `${qty} article${qty > 1 ? 's' : ''}`)}</span>
          ${b.subtitle ? `<span class="bundle__sub">${escapeHtml(b.subtitle)}</span>` : ''}
        </span>
        <span class="bundle__price">
          <span class="bundle__now">${formatPrice(t.now, currency)}</span>
          ${t.was > t.now ? `<s class="bundle__was">${formatPrice(t.was, currency)}</s>` : ''}
        </span>
      </label>
      <div class="bundle__body"><div>
        <div class="bundle__items">${rows}</div>
        ${b.perk ? `<p class="bundle__perk">${icon('gift')}<span>${escapeHtml(b.perk)}</span></p>` : ''}
      </div></div>`;

    // Clic n'importe où sur la carte (hors <select>) = sélection
    card.addEventListener('click', (e) => {
      if (e.target.closest('select, label, input')) return;
      const input = card.querySelector('.bundle__input');
      if (!input.checked) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    return card;
  }

  function selectHtml(options, value, { item, field, label }) {
    const opts = options.map((o) => `<option value="${escapeHtml(o)}"${o === value ? ' selected' : ''}>${escapeHtml(o || '—')}</option>`).join('');
    return `<select data-item="${item}" data-field="${field}" aria-label="${escapeHtml(label)}">${opts}</select>`;
  }

  function syncBundleUI() {
    list.querySelectorAll('.bundle').forEach((card) => {
      const selected = card.dataset.bundle === state.bundleId;
      card.classList.toggle('is-selected', selected);
      card.querySelector('.bundle__input').checked = selected;
      const body = card.querySelector('.bundle__body');
      body.toggleAttribute('inert', !selected);
      body.setAttribute('aria-hidden', String(!selected));
    });
  }

  list.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList.contains('bundle__input')) {
      state.bundleId = t.value;
      syncBundleUI();
    } else if (t.tagName === 'SELECT') {
      const card = t.closest('.bundle');
      const item = state.items[card.dataset.bundle][Number(t.dataset.item)];
      if (item) item[t.dataset.field] = t.value;
    }
    update();
  });

  /* --- Vente additionnelle --- */
  const upBox = q('#upsell');
  if (upsell) {
    const label = upsell.label || `Ajouter : ${upsell.name || ''}`;
    upBox.innerHTML = `
      <label class="upsell__main">
        <input class="upsell__check" type="checkbox" id="upsell-check"${state.upsell ? ' checked' : ''}>
        <span class="upsell__thumb upsell__thumb--ph" data-upsell-thumb>${icon('slipper')}</span>
        <span>
          <span class="upsell__title">${escapeHtml(label)} · <b>+${formatPrice(Number(upsell.priceEur) || 0, currency)}</b></span>
          ${upsell.text ? `<span class="upsell__text">${escapeHtml(upsell.text)}</span>` : ''}
        </span>
      </label>
      <div class="upsell__body"><div>
        <div class="upsell__size">
          <span class="select">
            <span class="select__label">Pointure</span>
            <span class="select__wrap">${selectHtml(upsellSizes, state.upsellSize, { item: 0, field: 'upsellSize', label: 'Pointure des chaussons' })}</span>
          </span>
        </div>
      </div></div>`;

    // Miniature : remplacée par un pictogramme si l'image n'existe pas encore
    const src = Array.isArray(upsell.images) && upsell.images[0];
    if (src) {
      const img = new Image(60, 60);
      img.className = 'upsell__thumb';
      img.alt = '';
      img.loading = 'lazy';
      img.onload = () => { const ph = upBox.querySelector('[data-upsell-thumb]'); if (ph) ph.replaceWith(img); };
      img.src = src;
    }

    upBox.hidden = false;
    upBox.addEventListener('change', (e) => {
      if (e.target.id === 'upsell-check') state.upsell = e.target.checked;
      else if (e.target.dataset.field === 'upsellSize') state.upsellSize = e.target.value;
      syncUpsellUI();
      update();
    });
  }

  function syncUpsellUI() {
    if (!upsell) return;
    upBox.classList.toggle('is-checked', state.upsell);
    const body = upBox.querySelector('.upsell__body');
    body.toggleAttribute('inert', !state.upsell);
    body.setAttribute('aria-hidden', String(!state.upsell));
  }

  /* --- Totaux, CTA, lien de paiement --- */
  const cta = q('#cta');
  const stickyPrice = q('#sticky-price');
  const stickyLabel = q('#sticky-label');
  const stickyBtn = q('#sticky-cta');

  function subtotal() {
    const b = current();
    const base = b ? bundleTotals(b).now : unit;
    const extra = state.upsell && upsell ? Number(upsell.priceEur) || 0 : 0;
    return round2(base + extra);
  }

  function getLink() {
    const b = current();
    if (!b) return '';
    const raw = state.upsell ? b.paymentLinkWithUpsell : b.paymentLink;
    return String(raw || '').trim();
  }

  /* client_reference_id : "b2_M-L_noir-noir_CH-40-41" (lettres, chiffres, _ et -, 200 max) */
  function buildReference() {
    const b = current();
    if (!b) return '';
    const items = state.items[b.id] || [];
    let ref = [b.id, items.map((i) => i.size).join('-'), items.map((i) => (i.color || '').toLowerCase()).join('-')].join('_');
    if (state.upsell) ref += '_CH-' + state.upsellSize;
    return sanitizeRef(ref);
  }

  function checkout() {
    const link = getLink();
    if (!link) return;
    const ref = buildReference();
    location.href = link + (link.includes('?') ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(ref);
  }

  function update() {
    const total = subtotal();
    const b = current();
    const link = getLink();
    const price = formatPrice(total, currency);
    setText('subtotal', price);

    if (link) {
      cta.disabled = false;
      cta.removeAttribute('aria-disabled');
      cta.innerHTML = `<span>Commander — ${escapeHtml(price)}</span>${icon('arrow-right')}`;
      stickyBtn.disabled = false;
      stickyBtn.textContent = 'Commander';
    } else {
      cta.disabled = true;
      cta.setAttribute('aria-disabled', 'true');
      cta.textContent = 'Bientôt disponible';
      stickyBtn.disabled = true;
      stickyBtn.textContent = 'Bientôt disponible';
    }
    if (stickyPrice) stickyPrice.textContent = price;
    if (stickyLabel) stickyLabel.textContent = (b ? b.title : '') + (state.upsell && upsell ? ' + ' + (upsell.name || '').toLowerCase() : '');
    saveState(state);
  }

  cta.addEventListener('click', checkout);
  syncBundleUI();
  syncUpsellUI();
  update();

  return { checkout, getLink, cta };
}

/* ---------- 3d. Pastilles, accordéons de la boîte d'achat, preuve sociale ---------- */

function renderFeatures(features) {
  const list = q('#features');
  if (!list) return;
  if (!features.length) { list.hidden = true; return; }
  features.forEach((f) => {
    const li = el('li', 'feature');
    li.innerHTML = `<span class="feature__icon">${icon(f.icon || 'check')}</span><span>${escapeHtml(f.label || '')}${f.sub ? `<small>${escapeHtml(f.sub)}</small>` : ''}</span>`;
    list.append(li);
  });
}

function renderBuyboxAccordion(p) {
  const box = q('#buybox-acc');
  if (!box) return;
  const items = [];

  // Guide des tailles : vrai tableau HTML
  const g = p.sizeGuide;
  if (g && Array.isArray(g.rows) && g.rows.length) {
    const cols = Array.isArray(g.columns) ? g.columns : [];
    const table = el('table', 'size-table');
    table.innerHTML =
      `<thead><tr>${cols.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}</tr></thead>` +
      `<tbody>${g.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`)).join('')}</tr>`).join('')}</tbody>`;
    const wrap = el('div');
    wrap.append(table);
    if (g.note) {
      const note = el('p', 'size-table__note');
      note.textContent = g.note;
      wrap.append(note);
    }
    items.push({ title: 'Guide des tailles', content: wrap });
  }

  // Les 3 premières questions
  const faq = (p.faq || []).slice(0, 3);
  if (faq.length) {
    const wrap = el('div');
    faq.forEach((f) => {
      const para = el('p');
      para.innerHTML = `<strong>${escapeHtml(f.q)}</strong><br>${escapeHtml(f.a)}`;
      wrap.append(para);
    });
    items.push({ title: 'Questions fréquentes', content: wrap });
  }

  // Préparation & livraison
  const s = p.shipping;
  if (s && (s.processing || s.delivery || s.returns)) {
    const ul = el('ul', 'ship-list');
    [['box', 'Préparation', s.processing], ['truck', 'Livraison', s.delivery], ['undo', 'Retours', s.returns]]
      .filter(([, , text]) => text)
      .forEach(([ic, title, text]) => {
        const li = el('li');
        li.innerHTML = `${icon(ic)}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
        ul.append(li);
      });
    items.push({ title: 'Préparation & livraison', content: ul });
  }

  makeAccordion(box, items, { exclusive: false, numbered: false, level: 'h2' });
}

function renderProof(proof) {
  const el = q('#proof');
  if (!el || !proof || !proof.enabled || !proof.text) return;
  el.textContent = proof.text;
  el.hidden = false;
}

/* ---------- 4. Section éditoriale ---------- */

function renderEditorial(s, images) {
  const section = q('#editorial');
  if (!section) return;
  const src = s.image || images[1] || images[0] || '';
  const img = q('#editorial-img');
  if (src) { img.src = src; img.hidden = false; }
  setText('editorial-title', s.title || 'Votre nouveau pyjama préféré.');
  setText('editorial-text', s.text || '');
  const cta = q('#editorial-cta');
  cta.innerHTML = `${escapeHtml(s.cta || 'Je veux le mien')}${icon('arrow-right')}`;
}

/* ---------- 5. Bénéfices ---------- */

function renderBenefits(bullets, description) {
  setText('product-description', description);
  const grid = q('#benefits');
  if (!grid) return;
  bullets.forEach((b) => {
    const item = typeof b === 'string' ? { title: b } : b;
    const card = el('article', 'benefit');
    card.innerHTML =
      `<span class="benefit__icon">${icon(item.icon || 'check')}</span>` +
      `<h3>${escapeHtml(item.title || '')}</h3>` +
      (item.text ? `<p>${escapeHtml(item.text)}</p>` : '');
    grid.append(card);
  });
}

/* ---------- 6. Témoignages ---------- */

function renderTestimonials(list) {
  const section = q('#testimonials');
  const grid = q('#testimonials-grid');
  if (!section || !grid) return;
  if (!list.length) { section.hidden = true; return; }
  list.forEach((t) => {
    const card = el('article', 'review');
    card.innerHTML = `
      <div class="review__head">
        <span class="review__avatar" aria-hidden="true">${escapeHtml(initials(t.name))}</span>
        <span>
          <span class="review__name">${escapeHtml(t.name || 'Client')}</span>
          ${t.verified ? `<span class="review__verified">${icon('check')} Achat vérifié</span>` : ''}
        </span>
      </div>
      <span class="stars stars--sm" role="img" aria-label="5 étoiles sur 5">${starsHtml(5)}</span>
      ${t.title ? `<h3>${escapeHtml(t.title)}</h3>` : ''}
      <p>${escapeHtml(t.text || '')}</p>`;
    grid.append(card);
  });
  section.hidden = false;
}

/* ---------- 7. FAQ complète (numérotée, une seule ouverte à la fois) ---------- */

function renderFaq(faq) {
  const box = q('#faq');
  if (!box) return;
  if (!faq.length) { q('#faq-section').hidden = true; return; }
  const items = faq.map((f) => {
    const p = el('p');
    p.textContent = f.a || '';
    return { title: f.q || '', content: p };
  });
  makeAccordion(box, items, { exclusive: true, numbered: true, level: 'h3' });
}

/* Accordéon accessible (bouton aria-expanded + panneau animé via grid-template-rows).
   `level` = balise de titre (h2 dans la boîte d'achat sous le H1, h3 sous un H2 de section). */
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
      (numbered ? `<span class="acc__num">${String(idx + 1).padStart(2, '0')}</span>` : '') +
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

/* ---------- 8. Contact : formulaire → mailto: pré-rempli (aucun backend) ---------- */

function setupContact(p) {
  const form = q('#contact-form');
  if (!form) return;
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
      hint.textContent = 'Merci de remplir tous les champs (adresse e-mail valide).';
      form.querySelector('.is-invalid input, .is-invalid textarea').focus();
      return;
    }
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();
    const subject = `[${p.brand || 'Boutique'}] Message de ${name}`;
    const body = `${message}\n\n— ${name} (${email})`;
    hint.textContent = 'Votre application e-mail s\'ouvre avec le message pré-rempli…';
    location.href = `mailto:${p.supportEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

/* ---------- 10. Barre d'achat fixe (mobile) ---------- */

function setupStickyBar(shop) {
  const bar = q('#sticky-bar');
  const cta = shop && shop.cta;
  const btn = q('#sticky-cta');
  if (!bar || !cta || !btn) return;

  btn.addEventListener('click', () => {
    // CTA plus bas que l'écran → on y amène l'utilisateur (choix de taille) ; sinon paiement direct.
    const rect = cta.getBoundingClientRect();
    if (rect.top > window.innerHeight) {
      q('#buybox').scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
    } else {
      shop.checkout();
    }
  });

  if (!('IntersectionObserver' in window)) { bar.classList.add('is-visible'); bar.setAttribute('aria-hidden', 'false'); return; }
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
  }, { rootMargin: '-64px 0px 0px 0px' }).observe(cta);
}

/* ==================================================================
   Utilitaires
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

function initials(name) {
  return String(name || '?').split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

/* Ne garde que [A-Za-z0-9_-] : accents retirés, espaces → tirets, tirets
   parasites nettoyés, 200 caractères max. */
function sanitizeRef(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* stockage indisponible : on ignore */ }
}
