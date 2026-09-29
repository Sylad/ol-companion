#!/usr/bin/env bash
# Valide frontend/nginx.conf dans un vrai nginx:alpine (Docker) :
#   1. `nginx -t` ;
#   2. L16 : sur /api/ et /api/events, le backend reçoit le CF-Connecting-IP
#      posé par Cloudflare s'il porte une seule adresse, et RIEN si le client
#      en ajoute d'autres à côté ou y met n'importe quoi (repli req.ip).
# Le backend est simulé par un second nginx nommé `ol-backend` (port 3002)
# qui renvoie l'en-tête reçu. Tout est supprimé à la fin.
set -euo pipefail

cd "$(dirname "$0")/.."
NET="ol-nginx-test-$$"
FRONT="ol-nginx-front-$$"
BACK="ol-backend"
TMP="$(mktemp -d)"

cleanup() {
  docker rm -f "$FRONT" "$BACK-$$" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

cat > "$TMP/backend.conf" <<'EOF'
server {
    listen 3002;
    location / {
        default_type text/plain;
        return 200 "cf=[$http_cf_connecting_ip]\n";
    }
}
EOF

docker network create "$NET" >/dev/null
docker run -d --name "$BACK-$$" --network "$NET" --network-alias "$BACK" \
  -v "$TMP/backend.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine >/dev/null
docker run --rm --network "$NET" \
  -v "$PWD/frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
docker run -d --name "$FRONT" --network "$NET" \
  -v "$PWD/frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine >/dev/null
sleep 1

fail=0
check() { # $1 = libellé, $2 = attendu, $3… = arguments curl
  local label="$1" expected="$2"; shift 2
  local got
  got="$(docker run --rm --network "$NET" curlimages/curl:latest -s "$@")"
  if [ "$got" = "$expected" ]; then
    echo "OK   $label"
  else
    echo "FAIL $label : attendu '$expected', reçu '$got'"
    fail=1
  fi
}

for path in /api/fixtures /api/events; do
  check "$path : CF-Connecting-IP transmis" "cf=[203.0.113.9]" \
    -H 'CF-Connecting-IP: 203.0.113.9' "http://$FRONT$path"
  check "$path : IPv6 transmise" "cf=[2001:db8::1]" \
    -H 'CF-Connecting-IP: 2001:db8::1' "http://$FRONT$path"
  check "$path : valeur ajoutée à côté par le client → rien transmis" "cf=[]" \
    -H 'CF-Connecting-IP: 203.0.113.9' -H 'CF-Connecting-IP: 6.6.6.6' "http://$FRONT$path"
  check "$path : contenu arbitraire → rien transmis" "cf=[]" \
    -H 'CF-Connecting-IP: <script>' "http://$FRONT$path"
  check "$path : sans en-tête, rien de transmis" "cf=[]" "http://$FRONT$path"
done

exit "$fail"
