#!/bin/sh
# The one-origin parity server (SOW-parity-ab-stage.md, Part 1): a single
# docroot serves both engines and the stage, so the stage can read into both
# iframes — cross-origin panes would block contentDocument access.
#
#   /current/<...>  the current (dev-lineage) engine
#   /ng/<...>       the ng engine
#   /stage/         the A/B stage
#
# The engines address pages by query string: /ng/?<page>, /current/?<page>.
#
# Run:  tools/parity-stage/serve.sh [port]        (default 8003)
# Then: http://127.0.0.1:8003/stage/?page=<name>
#
# Requires each engine's user-config.inc.php to point CONTENT_DIR at the shared
# parity content tree. current's BASE_URL is '/current/' (relative, so the port
# does not matter); ng needs none — it addresses everything relatively.
set -e
PORT="${1:-8003}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOCROOT="$(dirname "$ROOT")/parity-local"
[ -d "$DOCROOT/ng" ] || { echo "no engine copies in $DOCROOT" >&2; exit 1; }
echo "parity origin on http://127.0.0.1:$PORT  (docroot $DOCROOT)"
echo "  stage: http://127.0.0.1:$PORT/stage/?page=<name>"
exec php -S "127.0.0.1:$PORT" -t "$DOCROOT"
