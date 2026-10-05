#!/usr/bin/env bash
#
# Refresh ng-dev (the public self-host branch) from ng: merge in whatever
# landed on ng since the last sync, then re-strip the dev-only paths so
# ng-dev stays a clean, installable-your-own branch. See
# SOW-ng-repo-restructure.md (on ng) for the full background.
#
# Usage: run from a clone that has both branches, with a clean working tree.
#   scripts/sync-to-public.sh
# Review the result (git show, git diff ng-dev@{1} ng-dev) before pushing -
# this script never pushes anything itself.
#
# IMPORTANT: a merge can silently carry fragments of a change into a file
# this branch keeps-but-trims (right now, only .gitignore: ng-dev drops the
# composer/vendor and e2e-tooling blocks ng still has). If ng later touches
# lines next to a trimmed block, auto-merge can reintroduce part of it
# without a conflict. A clean exit from this script is not proof nothing
# needs attention - check `git diff ng-dev@{1} ng-dev -- .gitignore` by eye
# every time, the same way any merge of a deliberately-diverged file would
# need checking.

set -euo pipefail

# Markdown files to KEEP on ng-dev; every other *.md is stripped.
KEEP_MD=(docker/INSTALL.md fonts/MANIFEST.md README.md)

# Non-markdown paths to strip outright: the test suites, and the tooling
# that exists solely to run them.
STRIP_PATHS=(tests package.json package-lock.json composer.json composer.lock scripts/sync-to-public.sh)

if [ -n "$(git status --porcelain)" ]; then
	echo "working tree not clean, aborting" >&2
	exit 1
fi

git checkout ng-dev
git merge ng --no-edit

git ls-files '*.md' | while read -r f; do
	keep=false
	for k in "${KEEP_MD[@]}"; do
		[ "$f" = "$k" ] && keep=true
	done
	$keep || git rm -q "$f"
done

git rm -rq --ignore-unmatch "${STRIP_PATHS[@]}"

if git diff --cached --quiet; then
	echo "nothing to strip - ng-dev was already clean after the merge"
else
	git commit -m "sync: strip dev-only docs/tooling after merging ng"
fi

echo
echo "Done. Review before pushing:"
echo "  git diff ng-dev@{1} ng-dev -- .gitignore"
echo "  git log --oneline ng-dev@{1}..ng-dev"
