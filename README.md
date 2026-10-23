# Cozy Dragon — boutique statique (démo interne)

Réplique visuelle d'une boutique Shopify (thème « Horizon ») pour montrer la cible à un partenaire.
Page statique (GitHub Pages) + paiement hébergé Stripe (Payment Links). Aucun serveur, aucun framework :
HTML + `styles.css` + `app.js`. **Tout le contenu vit dans `product.json`.**

Toutes les pages portent `<meta name="robots" content="noindex,nofollow">` et un fin bandeau gris
« Démo interne — images de référence, non commercial ». Les médias de référence sont dans `img/demo/`.

## Pages

| Fichier | Rôle |
| --- | --- |
| `index.html` | Accueil : bloc « produit vedette » (galerie 6 photos, taille, couleur, quantité, « Ajouter au panier », « Payer avec Stripe ») + « Vu sur TikTok » |
| `produit.html` | Fiche Dragon Onesie™ : galerie 8 photos, widget « Bundle & économisez » (3 offres + chaussons), guide des tailles, quantité / sous-total, preuve d'achat, accordéons, diaporama, bande noire, TikTok, témoignages, FAQ, contact, barre d'achat fixe mobile |
| `chaussons.html`, `porte-cles.html` | Fiches produits simples (`products.slippers`, `products.keychain`) |
| `contact.html` | Formulaire de contact (→ `mailto:`) |
| `politique-de-confidentialite.html`, `mentions-legales.html`, `cgv.html`, `retours.html` | Pages légales (marqueurs `[À COMPLÉTER]`) |
| `merci.html` | Page de remerciement après paiement |

| `connexion.html` | Page « Connexion » façon Shopify (démo : aucun compte) |

Éléments communs injectés par `app.js` sur toutes les pages : barre d'annonce défilante, menu mobile (avec sélecteur pays),
recherche avec suggestions (les 3 produits, filtrées à la frappe), sélecteur « EUR ▾ » pays/devise (table de conversion fixe
dans `app.js` → `COUNTRIES`, choix mémorisé, **paiement Stripe toujours en EUR**), tiroir panier (lignes, quantité, suppression,
protection d'expédition, barre « livraison offerte » dès `cart.freeShippingEur`), boîte de consentement cookies (3 interrupteurs,
cosmétique, aucun traceur), modale « Guide des tailles » (accueil), popover « Plus d'options de paiement », bouton d'achat
flottant (pastille en bas à droite sur desktop, barre pleine largeur sur mobile) dès que le CTA principal sort de l'écran,
visionneuse plein écran, toast « Ajouté au panier ».

Polices : Inter partout, « Work Sans » sur le contenu de la fiche produit (boîte d'achat, bundles, diaporama, témoignages, FAQ, contact).
Les dimensions de référence (en-tête 122/100 px, logo 100 px, gouttières 40/16 px, boutons 52 px rayon 14, CTA produit 46 px
rayon 6, etc.) sont commentées en tête de `styles.css`.

## Mise en ligne

1. **Clé Stripe** : `cp .env.example .env` puis renseigner `STRIPE_SECRET_KEY` (voir `stripe/README.md`).
2. **Éditer `product.json`** (voir le détail des champs ci-dessous).
3. **Créer les produits et liens Stripe** : `npm install && npm run stripe:create` — remplit `bundles[].paymentLink` et `bundles[].paymentLinkWithUpsell`. Tant qu'un lien est vide, le bouton « Commander » du panier affiche « Paiement bientôt disponible ».
4. **Vérifier en local** : `npm run serve` puis http://localhost:4173 (tester aussi en largeur mobile, 375 px).
5. **Déployer** : `./deploy.sh <nom-du-repo>` — lance `node build-meta.mjs` (SEO), commit, push, active Pages.

## Logique d'achat (panier + Payment Links)

- Le panier (`localStorage`, clé `cozydragon:cart`) contient des lignes `{ id, size, color, qty }` avec `id` ∈ `onesie`, `slippers`, `keychain`.
- Remise de pack appliquée sur les onesies : 10 % à partir de 2, 20 % à partir de 3 (`bundles[].discountPct`).
- Au clic sur « Commander » : N = nombre d'onesies, S = nombre de chaussons. Si 1 ≤ N ≤ 3 et S ≤ 1, `app.js` prend `bundles[N-1].paymentLink` (ou `.paymentLinkWithUpsell` si S = 1) et ajoute
  `?client_reference_id=<bundle>_<tailles>_<couleurs>[_CH-<taille chaussons>]`, par ex. `b2_M-L_noir-noir_CH-M`
  (caractères `[A-Za-z0-9_-]`, 200 max). Toute autre combinaison utilise le pack le plus proche et l'indique dans le panier.
- « Payer avec Stripe » (accueil) va directement au lien du pack correspondant à la quantité choisie.
- Page de remerciement : `merci.html` — mettre `SUCCESS_URL=https://<owner>.github.io/<repo>/merci.html` dans `.env` avant `npm run stripe:create`.

## `product.json` — champs principaux

| Clé | Rôle |
| --- | --- |
| `brand`, `name`, `tagline`, `description`, `siteUrl` | Marque, titre produit, SEO |
| `demo.strip` | Texte du bandeau démo |
| `announcement.text` / `.code` / `.repeat` | Barre d'annonce défilante (le code est mis en gras) |
| `rating.value` / `.count` | Étoiles + « 10 000+ » sur la fiche produit |
| `priceEur`, `compareAtEur`, `currency` | Prix et prix barré (54,95 € / 41,65 € : repris tels quels du site de référence) |
| `sizes`, `colors`, `sizingNote` | Pastilles de taille, nuancier, note italique |
| `bundles[]` | `id` (b1/b2/b3), `qty`, `title`, `subtitle`, `text`, `discountPct`, `compareAtEur`, `badge`, `badgeStyle` (`green`/`dark`), `gift`, `giftTag`, `default`, `paymentLink`, `paymentLinkWithUpsell` |
| `upsell` | Chaussons dans le widget bundle : `name`, `priceEur`, `image`, `sizes`, `sizeHint` |
| `images[]`, `thumbnail`, `sizeChart` | Galerie (8 photos), miniature panier, image du guide des tailles |
| `home` | `vendor`, `imageCount` (6), libellés des boutons |
| `features[]`, `purchaseProof`, `buyboxFaq[]`, `buyboxAccordion`, `shipping` | Pastilles, « Sarah et 438 personnes… », accordéons de la boîte d'achat |
| `slideshow` | `slides[]` (GIF, 1ʳᵉ chargée seule), `title`, `text`, `cta` |
| `tiktok` | `title`, `subtitle`, `videos[]` (`id`, `views`) → iframes `tiktok.com/embed/v2/<id>` |
| `testimonialsTitle`, `testimonialsPill`, `testimonials[]` | Témoignages (`name`, `avatar`, `title`, `text`) |
| `faqTitle`, `faqSubtitle`, `faq[]` | FAQ numérotée |
| `contact`, `cart`, `cookies`, `footer` | Libellés du formulaire, du tiroir panier (+ `protection`), de la boîte cookies, liens du pied de page |
| `products.slippers` / `.keychain` | Fiches simples : `name`, `page`, `priceEur`, `compareAtEur`, `sizes`, `images`, `description`, `bullets` |
| `supportEmail` | Destinataire des formulaires (`mailto:`) |
| `stripe` | Identifiants écrits par `stripe/create-product.mjs` — ne pas éditer à la main |

## SEO

`npm run build:meta` (ou `node build-meta.mjs`) réécrit, entre `<!-- meta:start -->` et `<!-- meta:end -->` dans `index.html`
et `produit.html`, le `<title>`, la meta description, les balises Open Graph / Twitter et le JSON-LD `Product`. Idempotent, exécuté par `deploy.sh`.

## Avant d'ouvrir les ventes

- Retirer le bandeau démo et la meta `noindex,nofollow` ; remplacer les médias de référence de `img/demo/` (dont `size-chart.png`, qui porte le logo du site de référence).
- Compléter les marqueurs `[À COMPLÉTER]` des pages légales ; remplacer les témoignages (repris du site de référence) par de vrais avis.
- Rayon de la galerie : variable `--gallery-ratio` en haut de `styles.css` (4/5 par défaut, `1 / 1` pour un carré).
