# Boutique mono-produit

Page statique (GitHub Pages) + paiement hébergé Stripe (Payment Link). Aucun serveur, aucun framework.
Tout ce qui concerne le produit vit dans **`product.json`** : changer de produit = éditer ce fichier.

## Mise en ligne en 5 étapes

1. **Coller la clé Stripe dans `.env`**
   `cp .env.example .env`, puis remplacer `sk_live_xxx` par votre clé secrète (Dashboard Stripe > Développeurs > Clés API).
   Optionnel : `SHIPPING_EUR=4.90` pour facturer la livraison, `SUCCESS_URL=` pour une page de remerciement personnalisée.

2. **Éditer `product.json`**
   Nom, accroche, description, `priceEur`, `compareAtEur` (prix barré, optionnel), `images` (URLs), `bullets`, `faq`, `shippingNote`, `brand`, `supportEmail`, `instagram` (optionnel).
   Laissez `paymentLink` vide : il est rempli automatiquement à l'étape 3.

3. **Créer le produit sur Stripe**
   `npm install && npm run stripe:create`
   Le script crée le Product, le Price, le Payment Link (et le tarif de livraison si `SHIPPING_EUR` est défini), puis écrit l'URL du lien dans `product.json`.
   Pour voir le plan sans rien créer : `npm run stripe:dry-run`.

4. **Vérifier en local**
   `npm run serve` puis ouvrir http://localhost:4173 (testez aussi en largeur mobile).

5. **Déployer sur GitHub Pages**
   `./deploy.sh <nom-du-repo>`
   Le script crée le repo public, pousse les fichiers, active Pages et affiche l'URL `https://<owner>.github.io/<nom-du-repo>/`.

## Changer de produit plus tard

Éditez `product.json`, relancez `npm run stripe:create` (un nouveau Price et un nouveau lien sont créés si le prix a changé ; les anciens identifiants sont réutilisés sinon), puis `./deploy.sh <nom-du-repo>` pour pousser.

## Avant d'ouvrir les ventes

- Compléter les marqueurs `[À COMPLÉTER]` dans `mentions-legales.html` et `cgv.html`.
- Remplacer les images picsum par vos vraies photos (URLs https).
- Changer la couleur d'accent : variable `--accent` en haut de `styles.css`.
