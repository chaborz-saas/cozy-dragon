/* ------------------------------------------------------------------
   Boutique mono-produit — app.js
   Charge ./product.json et remplit la page. Aucune dépendance.
   Sur les pages légales, seuls la marque, l'e-mail et l'année sont remplis.
   ------------------------------------------------------------------ */

(async function main() {
  const product = await loadProduct();
  if (!product) return;

  fillCommon(product);
  if (document.getElementById('main-image')) renderStore(product);
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

/* ---------- Éléments communs à toutes les pages ---------- */

function fillCommon(p) {
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = p.brand || ''; });
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  document.querySelectorAll('[data-email]').forEach((el) => { el.textContent = p.supportEmail || ''; });
  document.querySelectorAll('[data-email-link]').forEach((el) => {
    if (p.supportEmail) el.href = 'mailto:' + p.supportEmail;
    else el.hidden = true;
  });
}

/* ---------- Page produit ---------- */

function renderStore(p) {
  setMeta(p);
  setInstagram(p.instagram);
  renderGallery(p.images || [], p.name);

  setText('product-name', p.name);
  setText('product-tagline', p.tagline);
  setText('product-description', p.description);
  setText('shipping-note', p.shippingNote);

  renderPrice(p);
  renderBullets(p.bullets || []);
  renderFaq(p.faq || []);
  setupBuyButtons(p.paymentLink);
  setupStickyBar();
}

function setMeta(p) {
  const title = p.brand ? `${p.name} – ${p.brand}` : p.name;
  const description = p.tagline || p.description || '';
  const url = location.origin + location.pathname;

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:image"]', (p.images && p.images[0]) || '');
  setMetaContent('meta[property="og:url"]', url);

  // Données structurées (Google Shopping / rich results)
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.images || [],
    brand: { '@type': 'Brand', name: p.brand },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: (p.currency || 'eur').toUpperCase(),
      price: Number(p.priceEur).toFixed(2),
      availability: p.paymentLink ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    },
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(ld);
  document.head.append(script);
}

function setInstagram(url) {
  const link = document.getElementById('instagram-link');
  if (!link) return;
  if (url) {
    link.href = url;
    link.hidden = false;
  }
}

function renderGallery(images, name) {
  const main = document.getElementById('main-image');
  const thumbs = document.getElementById('thumbs');

  if (!images.length) {
    main.alt = name || '';
    thumbs.hidden = true;
    return;
  }

  main.src = images[0];
  main.alt = name || '';
  main.fetchPriority = 'high';

  if (images.length < 2) {
    thumbs.hidden = true;
    return;
  }

  images.forEach((src, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery__thumb' + (i === 0 ? ' is-active' : '');
    btn.setAttribute('aria-label', `Photo ${i + 1} sur ${images.length}`);

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    btn.append(img);

    btn.addEventListener('click', () => {
      main.src = src;
      thumbs.querySelectorAll('.is-active').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
    thumbs.append(btn);
  });
}

function renderPrice(p) {
  const price = formatPrice(p.priceEur, p.currency);
  setText('price', price);
  setText('sticky-price', price);

  const compare = document.getElementById('compare-at');
  const badge = document.getElementById('discount');
  if (p.compareAtEur && Number(p.compareAtEur) > Number(p.priceEur)) {
    compare.textContent = formatPrice(p.compareAtEur, p.currency);
    compare.hidden = false;
    const pct = Math.round((1 - Number(p.priceEur) / Number(p.compareAtEur)) * 100);
    badge.textContent = `-${pct} %`;
    badge.hidden = false;
  }
}

function renderBullets(bullets) {
  const list = document.getElementById('bullets');
  bullets.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    list.append(li);
  });
}

function renderFaq(items) {
  const faq = document.getElementById('faq');
  if (!items.length) {
    faq.closest('section').hidden = true;
    return;
  }

  items.forEach((item) => {
    const details = document.createElement('details');
    details.className = 'faq__item';

    const summary = document.createElement('summary');
    summary.textContent = item.q;

    const answer = document.createElement('div');
    answer.className = 'faq__answer';
    const para = document.createElement('p');
    para.textContent = item.a;
    answer.append(para);

    details.append(summary, answer);

    // Accordéon : un seul élément ouvert à la fois
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      faq.querySelectorAll('details[open]').forEach((other) => {
        if (other !== details) other.open = false;
      });
    });

    faq.append(details);
  });
}

function setupBuyButtons(paymentLink) {
  const link = (paymentLink || '').trim();
  ['buy-btn', 'sticky-buy'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (link) {
      btn.href = link; // même onglet, vers le Checkout Stripe
    } else {
      btn.removeAttribute('href');
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled', 'true');
      btn.textContent = 'Bientôt disponible';
    }
  });
}

/* La barre fixe n'apparaît que lorsque le bouton principal est hors écran. */
function setupStickyBar() {
  const bar = document.getElementById('sticky-bar');
  const cta = document.getElementById('buy-btn');
  if (!bar || !cta || !('IntersectionObserver' in window)) {
    if (bar) bar.classList.add('is-visible');
    return;
  }
  const observer = new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
  });
  observer.observe(cta);
}

/* ---------- Utilitaires ---------- */

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (currency || 'eur').toUpperCase(),
  }).format(Number(amount) || 0);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function setMetaContent(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', value);
}
