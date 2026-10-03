#!/usr/bin/env bash
# L54 — valide dans un vrai nginx (Docker) ce que frontend/nginx.conf répond
# pour les fichiers du build, en-têtes de cache compris :
#   1. `nginx -t` dans l'image de base du Dockerfile frontend ;
#   2. index.html (/, /index.html, repli des routes) : `no-cache`, et un 304
#      possible (ETag, Last-Modified) ;
#   3. /assets/ : fichier à empreinte = cache d'un an immutable ; fichier
#      absent = 404 `no-store`, jamais le repli HTML ;
#   4. tout autre fichier du build (sw.js, manifeste, icônes, JSON, captures) :
#      `no-cache` ;
#   5. /api/ et /api/events : relayés, aucun Cache-Control ajouté ;
#   6. scripts/verify-cache.sh (le contrôle d'effet de `cadence deliver`) passe
#      sur ce nginx, et échoue sur un serveur qui répond 200 sans en-tête à tout.
#
# Prérequis : `cd frontend && npm run build` (le script sert frontend/dist tel
# quel, monté comme le Dockerfile le copie). Le backend n'existe pas ici : il
# est simulé par un second nginx nommé `ol-backend` (port 3002), sans quoi
# nginx refuse de charger la conf (« host not found in upstream »).
# Tout est supprimé à la fin. Sur Big-Blue : DOCKER_API_VERSION=1.44.
set -euo pipefail

cd "$(dirname "$0")/.."
DIST="$PWD/frontend/dist"
CONF="$PWD/frontend/nginx.conf"
[ -f "$DIST/index.html" ] ||
  { echo "test-nginx-cache: $DIST/index.html absent — lancer « cd frontend && npm run build »" >&2; exit 2; }

# la même image de base que le dernier étage du Dockerfile frontend
IMAGE="$(awk '$1 == "FROM" && $2 ~ /^nginx/ { print $2 }' frontend/Dockerfile | tail -n 1)"
[ -n "$IMAGE" ] || { echo "test-nginx-cache: image nginx introuvable dans frontend/Dockerfile" >&2; exit 2; }

NET="ol-nginx-cache-$$"
FRONT="ol-nginx-cache-front-$$"
BACK="ol-backend"
CURL="ol-nginx-cache-curl-$$"
TMP="$(mktemp -d)"

cleanup() {
  docker rm -f "$FRONT" "$BACK-$$" "$CURL" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

cat > "$TMP/backend.conf" <<'EOF'
server {
    listen 3002;
    location / {
        default_type text/plain;
        return 200 "stub\n";
    }
}
# faux frontaux pour les contrôles négatifs de verify-cache.sh
# 3003 : document en no-cache, mais TOUT /assets/ en 404 (le bundle aussi)
server {
    listen 3003;
    location /assets/ { return 404; }
    location / {
        default_type text/html;
        add_header Cache-Control "no-cache";
        return 200 '<script type="module" src="/assets/index-AbCd1234.js"></script>';
    }
}
# 3004 : document en no-cache, bundle servi, mais repli HTML en 200 sur un absent
server {
    listen 3004;
    location = /assets/index-AbCd1234.js {
        default_type application/javascript;
        return 200 "export {}";
    }
    location / {
        default_type text/html;
        add_header Cache-Control "no-cache";
        return 200 '<script type="module" src="/assets/index-AbCd1234.js"></script>';
    }
}
EOF

docker network create "$NET" >/dev/null
docker run -d --name "$BACK-$$" --network "$NET" --network-alias "$BACK" -p 127.0.0.1::3002 -p 127.0.0.1::3003 -p 127.0.0.1::3004 \
  -v "$TMP/backend.conf:/etc/nginx/conf.d/default.conf:ro" "$IMAGE" >/dev/null
docker run --rm --network "$NET" \
  -v "$CONF:/etc/nginx/conf.d/default.conf:ro" "$IMAGE" nginx -t
docker run -d --name "$FRONT" --network "$NET" -p 127.0.0.1::80 \
  -v "$CONF:/etc/nginx/conf.d/default.conf:ro" \
  -v "$DIST:/usr/share/nginx/html:ro" "$IMAGE" >/dev/null
docker run -d --name "$CURL" --network "$NET" --entrypoint sleep curlimages/curl:latest 600 >/dev/null
sleep 1

# probe <chemin> [options curl…] → STATUS, CTYPE, CC, ETAG, LASTMOD (« - » si absent ;
# plusieurs Cache-Control seraient joints par « + », donc visibles et refusés)
probe() {
  local path="$1"; shift
  local raw
  raw="$(docker exec "$CURL" curl -sI "$@" "http://$FRONT$path" | tr -d '\r')"
  header() {
    printf '%s\n' "$raw" | awk -v name="$1" '
      BEGIN { FS = ": " }
      tolower($1) == name { v = (v == "" ? "" : v " + ") substr($0, length($1) + 3) }
      END { print (v == "" ? "-" : v) }'
  }
  STATUS="$(printf '%s\n' "$raw" | awk 'NR == 1 { print $2 }')"
  CTYPE="$(header content-type)"
  CC="$(header cache-control)"
  ETAG="$(header etag)"
  LASTMOD="$(header last-modified)"
}

fail=0
printf '%-4s | %-3s | %-24s | %-36s | %s\n' '' 'st.' 'Content-Type' 'Cache-Control' 'requête'
# expect <libellé> <chemin> <statut> <type attendu (préfixe, « - » = absent, « * » = libre)> <Cache-Control exact> [options curl…]
expect() {
  local label="$1" path="$2" status="$3" ctype="$4" cc="$5"; shift 5
  probe "$path" "$@"
  local verdict=OK
  [ "$STATUS" = "$status" ] || verdict=FAIL
  [ "$CC" = "$cc" ] || verdict=FAIL
  case "$ctype" in
    '*') ;;
    *) case "$CTYPE" in "$ctype"*) ;; *) verdict=FAIL ;; esac ;;
  esac
  printf '%-4s | %-3s | %-24s | %-36s | %s\n' "$verdict" "$STATUS" "$CTYPE" "$CC" "$label"
  if [ "$verdict" = FAIL ]; then
    echo "       attendu : $status | $ctype | $cc"
    fail=1
  fi
}

IMMUTABLE='public, max-age=31536000, immutable'

# 1. le document, sous toutes ses formes
expect '/'                           /               200 text/html no-cache
expect '/index.html'                 /index.html     200 text/html no-cache
expect '/fixtures (repli)'           /fixtures       200 text/html no-cache
expect '/player/2185 (repli)'        /player/2185    200 text/html no-cache

# 2. le 304 reste possible, et porte le même Cache-Control
probe /
etag="$ETAG" lastmod="$LASTMOD"
if [ "$etag" = - ] || [ "$lastmod" = - ]; then
  echo "FAIL / sans ETag ($etag) ou sans Last-Modified ($lastmod) : aucun 304 possible"
  fail=1
else
  expect '/ + If-None-Match'         /               304 - no-cache -H "If-None-Match: $etag"
  expect '/ + If-Modified-Since'     /               304 - no-cache -H "If-Modified-Since: $lastmod"
  expect '/fixtures + If-None-Match' /fixtures       304 - no-cache -H "If-None-Match: $etag"
fi

# 3. /assets/ : uniquement des fichiers à empreinte, cache long ; un absent = 404
js="$(cd "$DIST" && ls assets/index-*.js | head -n 1)"
css="$(cd "$DIST" && ls assets/index-*.css | head -n 1)"
expect "/$js"                        "/$js"          200 application/javascript "$IMMUTABLE"
expect "/$css"                       "/$css"         200 text/css "$IMMUTABLE"
probe "/$js"
expect "/$js + If-None-Match"        "/$js"          304 - "$IMMUTABLE" -H "If-None-Match: $ETAG"
expect '/assets/absent-0a1B2c3D.js'  /assets/absent-0a1B2c3D.js  404 text/html no-store
expect '/assets/absent-0a1B2c3D.css' /assets/absent-0a1B2c3D.css 404 text/html no-store
expect '/assets/sous/dossier/x.js'   /assets/sous/dossier/x.js   404 text/html no-store

# le cache d'un an n'est sûr que si TOUT fichier de assets/ porte une empreinte
# de contenu dans son nom (Vite : -XXXXXXXX avant l'extension)
while IFS= read -r f; do
  case "$f" in
    *-[A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-].*) ;;
    *) echo "FAIL $f : fichier sans empreinte dans assets/, il serait servi immutable"; fail=1 ;;
  esac
done < <(cd "$DIST" && find assets -type f | sort)

# 4. tout autre fichier du build : pas d'empreinte dans le nom → no-cache
while IFS= read -r f; do
  expect "/$f"                       "/$f"           200 '*' no-cache
done < <(cd "$DIST" && find . -type f ! -path './assets/*' ! -name index.html | sed 's|^\./||' | sort)
expect '/sw.js (type JavaScript)'    /sw.js          200 application/javascript no-cache

# 5. l'API est relayée telle quelle : aucun Cache-Control ajouté
expect '/api/fixtures (relais)'      /api/fixtures   200 text/plain -
expect '/api/events (relais)'        /api/events     200 text/plain -

# 6. le contrôle d'effet de la livraison, rejoué depuis l'hôte sur les ports publiés
front_url="http://$(docker port "$FRONT" 80/tcp | head -n 1)"
stub_url="http://$(docker port "$BACK-$$" 3002/tcp | head -n 1)"
if OL_URL="$front_url" scripts/verify-cache.sh; then
  echo "OK   verify-cache.sh passe sur ce nginx"
else
  echo "FAIL verify-cache.sh échoue sur ce nginx"
  fail=1
fi
if OL_URL="$stub_url" scripts/verify-cache.sh 2>/dev/null; then
  echo "FAIL verify-cache.sh passe sur un serveur sans Cache-Control qui répond 200 à tout"
  fail=1
else
  echo "OK   verify-cache.sh échoue sur un serveur sans Cache-Control qui répond 200 à tout"
fi
no_assets_url="http://$(docker port "$BACK-$$" 3003/tcp | head -n 1)"
if OL_URL="$no_assets_url" scripts/verify-cache.sh 2>/dev/null; then
  echo "FAIL verify-cache.sh passe alors que le bundle du document répond 404"
  fail=1
else
  echo "OK   verify-cache.sh échoue quand le bundle du document répond 404"
fi
fallback_url="http://$(docker port "$BACK-$$" 3004/tcp | head -n 1)"
if OL_URL="$fallback_url" scripts/verify-cache.sh 2>/dev/null; then
  echo "FAIL verify-cache.sh passe alors qu'un /assets/ absent répond le repli HTML en 200"
  fail=1
else
  echo "OK   verify-cache.sh échoue quand un /assets/ absent répond le repli HTML en 200"
fi
unreachable=$(OL_URL="http://127.0.0.1:9" scripts/verify-cache.sh 2>&1 || true)
case "$unreachable" in
  *injoignable*) echo "OK   verify-cache.sh dit « injoignable » quand le serveur ne répond pas" ;;
  *) echo "FAIL verify-cache.sh ne dit pas « injoignable » quand le serveur ne répond pas"; fail=1 ;;
esac

if [ "$fail" = 0 ]; then echo "test-nginx-cache: tout est conforme"; else echo "test-nginx-cache: ÉCHEC"; fi
exit "$fail"
