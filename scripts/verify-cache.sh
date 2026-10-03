#!/bin/sh
# Vérification appelée par `cadence deliver` (L54) : ce que reçoit un visiteur,
# à travers Cloudflare (réessayée par cadence jusqu'au délai).
#   1. le document (/ et une route servie par repli) porte `Cache-Control:
#      no-cache` — sans quoi un navigateur garde l'ancienne appli après une
#      livraison ;
#   2. le bundle que référence le document existe : 200 et du JavaScript — un
#      /assets/ cassé (ou le repli HTML mis en cache sous le nom du bundle
#      pendant une bascule) donne une page blanche avec une livraison verte ;
#   3. un fichier absent de /assets/ répond 404, pas le repli HTML en 200.
# Lecture seule, par curl. OL_URL remplace l'adresse (scripts/test-nginx-cache.sh
# s'en sert contre un nginx local).
set -eu

BASE="${OL_URL:-https://ol.sladoire.dev}"

# en-têtes d'un GET (ce que fait un navigateur), sans le corps
headers() {
  raw=$(curl -sS -o /dev/null -D - --max-time 15 "$1") || return 1
  printf '%s\n' "$raw" | tr -d '\r'
}
status() { printf '%s\n' "$1" | awk 'NR == 1 { print $2 }'; }
cache_control() { printf '%s\n' "$1" | awk -F': ' 'tolower($1) == "cache-control" { print $2 }'; }
content_type() { printf '%s\n' "$1" | awk -F': ' 'tolower($1) == "content-type" { print $2 }'; }

for path in / /fixtures; do
  h=$(headers "$BASE$path") || { echo "verify: $BASE$path injoignable" >&2; exit 1; }
  [ "$(status "$h")" = 200 ] || { echo "verify: $path répond $(status "$h"), attendu 200" >&2; exit 1; }
  case "$(cache_control "$h")" in
    *no-cache*) ;;
    *) echo "verify: $path sans Cache-Control no-cache (reçu : '$(cache_control "$h")')" >&2; exit 1 ;;
  esac
done

body=$(curl -sS --max-time 15 "$BASE/") || { echo "verify: $BASE/ injoignable" >&2; exit 1; }
bundle=$(printf '%s\n' "$body" | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -n 1 || true)
[ -n "$bundle" ] || { echo "verify: aucun /assets/index-*.js dans le document" >&2; exit 1; }
h=$(headers "$BASE$bundle") || { echo "verify: $BASE$bundle injoignable" >&2; exit 1; }
[ "$(status "$h")" = 200 ] ||
  { echo "verify: le bundle du document répond $(status "$h"), attendu 200 ($bundle)" >&2; exit 1; }
case "$(content_type "$h")" in
  *javascript*) ;;
  *) echo "verify: le bundle du document n'est pas du JavaScript (reçu : '$(content_type "$h")', $bundle)" >&2; exit 1 ;;
esac

# Nom qu'aucun build ne produit, et paramètre différent à chaque passage : la
# sonde ne peut ni lire ni laisser dans le cache du CDN une entrée sous un nom
# que l'appli demanderait.
probe="/assets/verify-fichier-absent.js?verify=$(date +%s)-$$"
h=$(headers "$BASE$probe") || { echo "verify: $BASE$probe injoignable" >&2; exit 1; }
[ "$(status "$h")" = 404 ] ||
  { echo "verify: un fichier absent de /assets/ répond $(status "$h"), attendu 404 ($probe)" >&2; exit 1; }
