# Stripe — packs, upsell et liens de paiement

Tout part de `product.json`. Le script `stripe/create-product.mjs` crée sur Stripe ce qu'il faut, écrit les URL des liens dans `product.json` et mémorise les identifiants sous `product.json.stripe` pour ne jamais créer de doublons.

```bash
npm run stripe:dry-run   # affiche le plan complet, aucun appel Stripe (clé inutile)
npm run stripe:create    # crée ou met à jour sur Stripe, puis écrit product.json
npm run stripe:check     # vérifie que chaque lien enregistré est actif et affiche son URL
```

Options de `stripe/create-product.mjs` : `--reset` (ignore les identifiants enregistrés, avec avertissement), `--no-coupon` (pas de code promo), `--file chemin` (autre `product.json`), `--dry-run --json` (ajoute les paramètres bruts envoyés à Stripe).

Variables de `.env` : `STRIPE_SECRET_KEY` (obligatoire hors dry-run), `SITE_URL` (images et page merci ; défaut `product.json.siteUrl`, sinon `https://chaborz-saas.github.io/cozy-dragon/`), `SUCCESS_URL` (défaut `SITE_URL + merci.html`), `SHIPPING_EUR` (défaut 4.90, `0` = offerte pour tous), `FREE_SHIPPING_FROM_QTY` (défaut 2), `COUPON_CODE` / `COUPON_PCT` (défaut `product.json.announcement.code`, sinon `DRAGON10` / `10`).

Champ optionnel `product.json.shortName` : nom court utilisé pour nommer les Products à la caisse (ex. `"Dragon Onesie"`) ; sans lui, c'est `name` complet qui est utilisé.

## Le modèle à 6 liens

Un Payment Link Stripe a un panier fixe. Pour proposer 3 packs, avec ou sans chaussons, il faut donc **2 liens par pack** : la boutique envoie le client vers le bon lien selon son choix.

| Pack | Product Stripe (nom affiché à la caisse) | Price | Livraison | Lien sans upsell | Lien avec upsell |
|---|---|---|---|---|---|
| b1 (1 pièce) | `Dragon Onesie` | 49,90 € | Livraison suivie 4,90 € | `bundles[0].paymentLink` | `bundles[0].paymentLinkWithUpsell` |
| b2 (2 pièces, -10 %) | `Dragon Onesie — Pack Duo (2 pièces, -10 %)` | 89,82 € | Livraison offerte | `bundles[1].paymentLink` | `bundles[1].paymentLinkWithUpsell` |
| b3 (3 pièces, -20 %) | `Dragon Onesie — Pack Famille (3 pièces, -20 %)` | 119,76 € | Livraison offerte | `bundles[2].paymentLink` | `bundles[2].paymentLinkWithUpsell` |

Prix d'un pack = `arrondi(qty × priceEur × (1 − discountPct/100))`. Le lien « avec upsell » ajoute une ligne « Chaussons dragon assortis » (`upsell.priceEur`) ; si `upsell.enabled` est `false`, seuls 3 liens sont créés. La livraison est offerte à partir de `FREE_SHIPPING_FROM_QTY` pièces (2 par défaut).

Chaque lien : adresse de livraison limitée à FR, BE, CH, LU, DE, ES, IT, NL ; téléphone demandé ; codes promo acceptés ; redirection vers `merci.html?session_id={CHECKOUT_SESSION_ID}` ; message sous le bouton « Les tailles/couleurs choisies sont transmises avec votre commande. » ; metadata `bundle`, `qty`, `upsell` (`yes`/`no`) et `brand`, recopiées sur le paiement.

Le code promo `DRAGON10` (-10 %, restreint à la première commande d'un client Stripe) est créé une fois et réutilisé ; `--no-coupon` l'ignore.

## Tailles et couleurs : `client_reference_id`

Un Payment Link ne pose pas de question au client. La boutique ajoute donc le choix du client à l'URL du lien :

```
https://buy.stripe.com/xxxx?client_reference_id=b2_M-L_noir-noir_CH-40-41
```

Format : `pack_tailles_couleurs_pointureChaussons`, soit ici le pack **b2**, tailles **M** et **L**, couleurs **noir** et **noir**, chaussons **CH-40-41**. Stripe n'accepte que lettres, chiffres, `-` et `_` (200 caractères max) : pas d'espace ni d'accent dans la valeur.

**Où le lire pour préparer une commande** : Dashboard Stripe → *Paiements* → ouvrir le paiement → bloc *Session Checkout* (ou *Checkout*) : ligne **Client reference ID**. Le même bloc montre l'adresse de livraison, le téléphone et les metadata `bundle` / `upsell`. Par l'API, la valeur est `client_reference_id` sur la Checkout Session (`checkout.sessions.retrieve(session_id)`, l'identifiant étant passé à `merci.html?session_id=…`), et dans l'événement webhook `checkout.session.completed`.

## Relancer après un changement de prix

Un Price Stripe est immuable. Modifiez `priceEur`, `discountPct` ou `upsell.priceEur` dans `product.json`, puis `npm run stripe:create` :

1. les Products sont conservés (nom, description, images mis à jour si besoin) ;
2. un **nouveau Price** est créé pour chaque montant modifié, l'ancien est désactivé ;
3. les liens qui utilisaient un Price, un tarif de livraison ou une URL de retour modifiés sont **recréés**, les anciens sont désactivés (une page déjà déployée avec l'ancienne URL affiche un lien expiré : redéployez) ;
4. tout ce qui n'a pas changé est réutilisé tel quel.

Les identifiants sont écrits dans `product.json` après chaque étape : si une exécution s'interrompt, la suivante reprend sans doublon et termine le nettoyage. Le mode (`test` / `live`) vient du préfixe de la clé ; des identifiants d'un autre mode sont ignorés avec un avertissement. Après `stripe:create`, lancez `npm run stripe:check` puis redéployez le site.
