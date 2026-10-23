# Traiter une commande (Stripe → AliExpress)

Objectif : une commande payée devient un colis commandé chez le fournisseur en moins de 5 minutes, sans oubli de taille.

## 1. Où voir la commande

1. Stripe Dashboard → **Paiements** → ouvrir le paiement.
2. Bloc **Session Checkout** → `Client reference ID`, par ex. `b2_M-L_noir-noir_CH-L-39-45`.
   - `b1` / `b2` / `b3` = 1, 2 ou 3 onesies
   - puis les **tailles** dans l'ordre des articles (`M-L` = article 1 en M, article 2 en L)
   - puis les **couleurs** (`noir-noir`)
   - `CH-…` = chaussons ajoutés, avec leur pointure (`L-39-45` = taille L, EU 39-45)
3. Bloc **Livraison** → nom, adresse, téléphone du client (collectés par Stripe).
4. Le code promo éventuel (DRAGON10) est déjà déduit : le montant encaissé est net.

## 2. Commander chez le fournisseur

| Article | Fiche AliExpress | Prix constaté (23/10/2026) | Choix à faire |
|---|---|---|---|
| Dragon Onesie noir | https://www.aliexpress.com/item/1005008660618755.html | 27,19 € l'unité, livraison gratuite, ≈3 semaines | taille S-XXL, couleur noir |
| Chaussons griffes | https://www.aliexpress.com/item/1005007934760216.html | 8,29 €, livraison gratuite | taille M (EU 31-38) ou L (EU 39-45) |

Étapes :
1. Ouvrir la fiche, choisir taille/couleur, quantité = ce que dit le `Client reference ID`.
2. Adresse de livraison = **celle du client** (pas la vôtre). Nom + téléphone du client.
3. Cocher « expédition sans facture / sans publicité » si l'option est proposée (dropshipping).
4. Payer. Noter le numéro de commande AliExpress dans la note du paiement Stripe (bouton « Ajouter une note »).

## 3. Prévenir le client

- **J+0** : e-mail « Commande confirmée, préparation sous 1 à 3 jours ouvrés » (Stripe envoie déjà le reçu ; ajoutez un mot humain).
- **Dès le numéro de suivi AliExpress** (24-72 h) : e-mail avec le lien de suivi (17track.net/fr fonctionne pour tous les transporteurs).
- **J+12** sans livraison : e-mail proactif « votre colis est en route, voici où il en est ». Un client prévenu ne réclame pas.

## 4. Marge par commande (à jour du 23/10/2026)

| Bundle | Encaissé | Coût fournisseur | Port facturé | Marge brute |
|---|---|---|---|---|
| 1 onesie | 49,90 € | 27,19 € | +4,90 € | ≈ 27 € |
| Pack Duo | 89,82 € | 54,38 € | 0 € | ≈ 35 € |
| Pack Famille | 119,76 € | 81,57 € | 0 € | ≈ 38 € |
| + chaussons | +22,90 € | 8,29 € | — | ≈ +14,6 € |

Hors frais Stripe (≈1,5 % + 0,25 €) et hors TVA : à vérifier avec votre régime (auto-entrepreneur = TVA non applicable sous le seuil, art. 293 B CGI).

## 5. Retours et litiges

- Retour client sous 14 jours : rembourser depuis Stripe (bouton « Rembourser »), demander le renvoi à **votre** adresse (le fournisseur ne reprend pas).
- Colis perdu : ouvrir un litige AliExpress (« Protection acheteur ») → remboursement, puis rembourser ou réexpédier au client.
- Taille incorrecte à cause d'une erreur de lecture du `Client reference ID` : à vos frais, réexpédier la bonne taille sans demander le retour (coût ≈ 27 €, un avis positif vaut plus).

## 6. Avant la première vraie commande

- [ ] Clé Stripe collée dans `.env`, `npm run stripe:create` lancé, `./deploy.sh cozy-dragon` relancé → le bouton « Commander » est actif.
- [ ] Un **paiement test** fait avec une clé `sk_test_` (carte 4242 4242 4242 4242) pour voir le `Client reference ID` apparaître.
- [ ] Mentions légales, CGV, Politique de retour : remplacer les `[À COMPLÉTER]` (identité, SIREN, adresse).
- [ ] `supportEmail` dans `product.json` = une vraie adresse relevée tous les jours.
- [ ] Commander **un onesie pour soi** : vérifier la qualité, la taille réelle, le délai, et faire les vraies photos/vidéos.
