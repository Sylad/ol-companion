#!/bin/sh
# Vérification appelée par `cadence deliver` : les pods tournent-ils les images
# que developpeur-gitops déclare ? (réessayée par cadence jusqu'au délai)
# Lecture seule sur le cluster dark-blue (namespace preprod).
set -eu

ROOT="$(git rev-parse --show-toplevel)"
VALUES="${GITOPS_DIR:-$ROOT/../developpeur-gitops}/charts/ol-companion/values.yaml"

[ "$(kubectl config current-context)" = "dark-blue" ] || { echo "verify: contexte kubectl inattendu" >&2; exit 1; }
for svc in backend frontend; do
  want=$(sed -n "/^$svc:/,/^[a-z]/ s/^  tag: //p" "$VALUES")
  got=$(kubectl -n preprod get deploy "ol-$svc" -o jsonpath='{.spec.template.spec.containers[0].image}')
  case "$got" in
    *":$want") ;;
    *) echo "verify: ol-$svc sur $got, attendu $want" >&2; exit 1 ;;
  esac
  kubectl -n preprod rollout status "deploy/ol-$svc" --timeout=5s >/dev/null ||
    { echo "verify: rollout de ol-$svc en cours" >&2; exit 1; }
done
