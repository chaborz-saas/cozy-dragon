#!/usr/bin/env bash
# ------------------------------------------------------------------
# Déploie la boutique sur GitHub Pages.
# Usage : ./deploy.sh <nom-du-repo>          (ex. ./deploy.sh ma-boutique)
#         ./deploy.sh <organisation/nom>     (pour créer le repo dans une organisation)
# Prérequis : gh CLI connecté (gh auth login), git.
# ------------------------------------------------------------------
set -euo pipefail

REPO_ARG="${1:-}"
if [ -z "$REPO_ARG" ]; then
  echo "Usage : ./deploy.sh <nom-du-repo>"
  exit 1
fi

cd "$(dirname "$0")"

command -v git >/dev/null 2>&1 || { echo "git est requis."; exit 1; }
command -v gh  >/dev/null 2>&1 || { echo "gh CLI est requis : https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh n'est pas connecté : lancez 'gh auth login'."; exit 1; }

# Propriétaire et nom du repo
if [[ "$REPO_ARG" == */* ]]; then
  OWNER="${REPO_ARG%%/*}"
  NAME="${REPO_ARG##*/}"
else
  OWNER="$(gh api user -q .login)"
  NAME="$REPO_ARG"
fi

# Avertissement si le Payment Link n'est pas encore renseigné
if ! grep -q '"paymentLink": *"https://' product.json; then
  echo "Attention : product.json.paymentLink est vide. Le bouton d'achat sera désactivé."
  echo "            Lancez 'npm run stripe:create' puis relancez ./deploy.sh pour l'activer."
fi

# 1. Dépôt git
if [ ! -d .git ]; then
  git init -b main
fi
touch .nojekyll
git rm --cached .env >/dev/null 2>&1 || true   # sécurité : jamais de .env dans l'historique
git add -A
if git diff --cached --quiet; then
  echo "Rien de nouveau à commiter."
else
  git commit -q -m "Deploy storefront $(date '+%Y-%m-%d %H:%M')"
fi
git branch -M main

# 2. Repo GitHub + push
if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin existant : push sur main."
  git push -u origin main
else
  echo "Création du repo GitHub $OWNER/$NAME…"
  gh repo create "$OWNER/$NAME" --public --source=. --remote=origin --push
fi

# 3. GitHub Pages depuis la branche main, racine
echo "Activation de GitHub Pages…"
if ! gh api -X POST "repos/$OWNER/$NAME/pages" \
      -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/' >/dev/null 2>&1; then
  gh api -X PUT "repos/$OWNER/$NAME/pages" \
      -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi

OWNER_LC="$(printf '%s' "$OWNER" | tr '[:upper:]' '[:lower:]')"
echo
echo "Boutique déployée. URL (disponible dans 1 à 2 minutes) :"
echo "  https://$OWNER_LC.github.io/$NAME/"
