# Cozy Dragon — boutique mono-produit

Page statique (GitHub Pages) + paiement hébergé Stripe (Payment Links). Aucun serveur, aucun framework :
un `index.html`, un `styles.css`, un `app.js`. **Tout le contenu vit dans `product.json`.**

Structure de la page (dans l'ordre) : barre d'annonce → en-tête → héros (galerie + boîte d'achat avec bundles, vente additionnelle, sous-total, CTA, guide des tailles / FAQ / livraison) → bandeau de réassurance → section éditoriale plein écran → « Pourquoi vous allez l'adorer » → témoignages → FAQ → contact → pied de page. Sur mobile, une barre d'achat fixe apparaît dès que le CTA sort de l'écran.

## Mise en ligne

1. **Clé Stripe** : `cp .env.example .env` puis renseigner `STRIPE_SECRET_KEY` (voir `stripe/README.md`).
2. **Éditer `product.json`** (voir le détail des champs ci-dessous).
3. **Créer les produits et liens Stripe** : `npm install && npm run stripe:create` — remplit `bundles[].paymentLink` et `bundles[].paymentLinkWithUpsell`. Tant qu'un lien est vide, le bouton affiche « Bientôt disponible ».
4. **Vérifier en local** : `npm run serve` puis http://localhost:4173 (tester aussi en largeur mobile, 375 px).
5. **Déployer** : `./deploy.sh <nom-du-repo>` — lance `node build-meta.mjs` (SEO), commit, push, active Pages.

## Logique d'achat (sans panier)

- 3 bundles (1, 2 ou 3 pyjamas), un seul sélectionné à la fois ; chaque article a sa taille et sa couleur.
- Case « chaussons assortis » (vente additionnelle) avec sa pointure.
- Au clic sur « Commander », `app.js` choisit le Payment Link du bundle (`paymentLink` ou `paymentLinkWithUpsell`) et ajoute
  `?client_reference_id=<bundle>_<tailles>_<couleurs>[_CH-<pointure>]`, par ex. `b2_M-L_noir-noir_CH-40-41`
  (caractères `[A-Za-z0-9_-]` uniquement, 200 max). Cette référence apparaît dans le Dashboard Stripe et les webhooks : c'est elle qui dit quoi expédier.
- Prix d'un bundle = `qty × priceEur × (1 − discountPct/100)` ; prix barré = `qty × compareAtEur`.
- La dernière sélection est mémorisée dans `localStorage`.
- Page de remerciement : `merci.html`. Pour y renvoyer après paiement, mettre `SUCCESS_URL=https://<owner>.github.io/<repo>/merci.html` dans `.env` avant `npm run stripe:create`.

## `product.json` — champs

| Clé | Rôle |
| --- | --- |
| `brand`, `name`, `tagline`, `description` | Marque, H1, sous-titre, paragraphe d'intro de la section bénéfices |
| `siteUrl` | URL publique (canonical, Open Graph, JSON-LD) |
| `announcement.text` / `.code` | Barre d'annonce ; le code est mis en surbrillance |
| `rating.value` / `.count` | Étoiles + texte (« 4,8/5 · 1 200+ avis »). `jsonld: true` pour l'inclure dans les données structurées — **uniquement avec de vrais avis** |
| `priceEur`, `compareAtEur`, `currency` | Prix unitaire, prix barré (le « -29 % » est calculé) |
| `sizes`, `colors`, `sizingNote` | Options des sélecteurs, note italique sous le prix |
| `bundles[]` | `id`, `qty`, `title`, `subtitle`, `discountPct`, `badge`, `perk`, `default`, `paymentLink`, `paymentLinkWithUpsell` |
| `upsell` | `enabled`, `name`, `label`, `text`, `priceEur`, `images[0]` (miniature), `sizes` |
| `images[]` | Galerie (la première est chargée en priorité ; toutes les autres en lazy) |
| `features[]` | 3 pastilles `{ icon, label, sub }` — `icon` = clé d'icône (`feather`, `layers`, `sparkles`, `flame`, `eye`, `users`, `wash`, `shield`, `moon`, `heart`, `clock`, `gift`…) ou un emoji |
| `bullets[]` | 4 cartes bénéfices `{ icon, title, text }` |
| `sizeGuide` | `columns`, `rows`, `note` → tableau HTML dans « Guide des tailles » |
| `slideshow` | `image` (vide = 2ᵉ photo de la galerie), `title`, `text`, `cta` |
| `testimonials[]` | `{ name, title, text, verified }` — tableau vide = section masquée. Les exemples fournis sont **fictifs** (voir `_note`) |
| `purchaseProof` | `enabled`, `text` (ligne de preuve sociale sous le CTA) |
| `faq[]` | `{ q, a }` — les 3 premières aussi dans la boîte d'achat |
| `shipping` | `processing`, `delivery`, `returns` (boîte d'achat + `merci.html`) |
| `supportEmail`, `instagram`, `tiktok` | Contact (formulaire → `mailto:`), icônes masquées si vide |
| `stripe` | Identifiants écrits par `stripe/create-product.mjs` — ne pas éditer à la main |

Logo : déposer `img/logo.png` (hauteur ≈ 36 px à l'écran) ; sinon le nom de marque s'affiche en texte.

## SEO

`npm run build:meta` (ou `node build-meta.mjs`) réécrit, entre `<!-- meta:start -->` et `<!-- meta:end -->` dans `index.html`, le `<title>`, la meta description, les balises Open Graph / Twitter et le JSON-LD `Product` (offre au prix du bundle 1). Idempotent, exécuté par `deploy.sh`.

## Avant d'ouvrir les ventes

- Compléter les marqueurs `[À COMPLÉTER]` dans `mentions-legales.html`, `cgv.html` et `retours.html`.
- Remplacer les témoignages d'exemple par de vrais avis (ou vider le tableau).
- Vérifier les mesures du guide des tailles avec la fiche fournisseur.
- Ajouter `img/upsell-1.jpg` (miniature des chaussons) et éventuellement `img/logo.png`.
- Couleurs : variables `--green-900`, `--acid`, `--bg` en haut de `styles.css`.
