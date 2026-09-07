#!/usr/bin/env bash
#
# tools/parity-copy.sh — copy sampled live hotglue.me pages into the ng parity
# install's content tree, for the parity harness (see SOW-parity-ab-stage.md).
#
# One live PAGE (usr/<shard>/<site>/content/<page>/head + shared) becomes one ng
# page (hotglue.me-ng/content/<target>/head + shared). The ng install is a
# single-content-root engine, so each sampled page gets its own uniquely named
# page dir there.
#
# SAFETY (the SOW's CRITICAL): this script only ever READS from /var/www-hotglue/usr
# (live content) and only ever WRITES under the parity install's content dir.
# It refuses to touch anything else, refuses to overwrite an existing target,
# and does nothing at all unless you pass --commit.
#
# Usage:
#   tools/parity-copy.sh                 # dry run over tools/parity-sample.tsv
#   tools/parity-copy.sh <manifest.tsv>  # dry run over another manifest
#   tools/parity-copy.sh --commit        # actually copy (run on the server)
#
# Manifest format (tab-separated, # comments allowed):
#   <site>   <page>   <target>   <note>
#   site   = live site dir name, e.g. "000"   (shard is derived: first char)
#   page   = page dir under the site's content/, e.g. "matière" or "start"
#   target = page name to create in the ng install, e.g. "000-matiere"
#   note   = free text, ignored by the script

set -euo pipefail

USR=/var/www-hotglue/usr
DEST=/var/www-hotglue/hotglue.me-ng/content
COMMIT=0
MANIFEST="tools/parity-sample.tsv"   # repo-root default
if [ "${1:-}" = "--commit" ]; then
  COMMIT=1
  MANIFEST="${2:-tools/parity-sample.tsv}"
elif [ "${2:-}" = "--commit" ]; then
  COMMIT=1
  MANIFEST="${1:-tools/parity-sample.tsv}"
elif [ -n "${1:-}" ]; then
  MANIFEST="$1"
fi

[ -f "$MANIFEST" ] || { echo "manifest not found: $MANIFEST" >&2; exit 1; }

echo "== parity-copy: $(date -Is)"
echo "   source root : $USR        (READ ONLY)"
echo "   destination : $DEST       (parity install content)"
[ "$COMMIT" = 1 ] && echo "   mode        : COMMIT" || echo "   mode        : DRY RUN (pass --commit to copy)"

# the parity install must exist and its content dir be writable by us
[ -d "$USR" ] || { echo "FATAL: $USR is not a directory" >&2; exit 1; }
if [ "$COMMIT" = 1 ]; then
  [ -d "$DEST" ] || { echo "FATAL: $DEST is not a directory" >&2; exit 1; }
  [ -w "$DEST" ] || { echo "FATAL: $DEST is not writable by $(id -un)" >&2; exit 1; }
fi

copied=0
skipped=0

# reads "site<TAB>page<TAB>target[<TAB>note]"
while IFS=$'\t' read -r site page target note; do
  # skip blank lines and comments
  case "$site" in ""|\#*) continue ;; esac
  [ -n "$target" ] || { echo "SKIP $site/$page: no target column" >&2; skipped=$((skipped+1)); continue; }

  # shard = first character of the site name (usr/<0-9a-z>/<site>)
  shard="${site:0:1}"
  src="$USR/$shard/$site/content/$page"
  tgt="$DEST/$target"

  if [ ! -d "$src/head" ]; then
    echo "SKIP $site/$page -> $target: no head/ at $src" >&2
    skipped=$((skipped+1))
    continue
  fi
  # never overwrite: a parity page and a native ng page are indistinguishable
  # on disk once copied, so a name already in use is a hard stop
  if [ -e "$tgt" ]; then
    echo "SKIP $site/$page -> $target: $tgt already exists" >&2
    skipped=$((skipped+1))
    continue
  fi
  # refuse anything outside the usr tree (defence in depth)
  case "$src" in
    "$USR/"*) ;;
    *) echo "SKIP $site/$page: source escapes $USR" >&2; skipped=$((skipped+1)); continue ;;
  esac

  if [ "$COMMIT" = 1 ]; then
    cp -a "$src" "$tgt"
    # pages get re-saved by the Check-B round trip under the web server's user
    if [ "$(id -u)" = 0 ]; then
      chown -R www-data:www-data "$tgt"
    fi
    n_src=$(find "$src" -type f | wc -l)
    n_tgt=$(find "$tgt" -type f | wc -l)
    echo "COPIED $site/$page -> $target ($n_src files)"
    # provenance marker inside the parity tree, so a later sweep can tell
    # parity copies from native ng pages
    echo -e "$site\t$page\t$target\t$(date -Is)\t$note" >> "$DEST/.parity-manifest.tsv"
    copied=$((copied+1))
  else
    echo "WOULD COPY $site/$page -> $target${note:+   # $note}"
    copied=$((copied+1))
  fi
done < "$MANIFEST"

echo "== done: $copied ok, $skipped skipped ($([ "$COMMIT" = 1 ] && echo commit || echo dry-run))"
[ "$COMMIT" = 1 ] && echo "   manifest of copied pages: $DEST/.parity-manifest.tsv"
