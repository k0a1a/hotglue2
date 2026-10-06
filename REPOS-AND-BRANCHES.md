# Hotglue repos and branches

How the code is split across repos and branches, where each piece is deployed, and how
`hotglue2-ng/ng` (private) and `hotglue2/ng-dev` (public) are kept in sync. Background:
`SOW-ng-repo-restructure.md` (why the split exists, what stays private) and
`SOW-move-ng-private-repo.md` (the 2026-10-06 move of `ng` to its own private repo).

## Repos

| Repo | Visibility | Local clone | Holds |
|---|---|---|---|
| `k0a1a/hotglue2` | public | server: `/var/www-hotglue/src` | The original hotglue2 and the public self-host branch |
| `k0a1a/hotglue2-ng` | **private** | `~/pro/hotglue/ng-src` (`~/pro/hotglue/hotglue2-ng` is a second clone made for the initial push) | The `ng` branch: hotglue.me server version, SOWs, tests, notes |
| `k0a1a/hotglue-account` | private | `~/pro/hotglue/account` | hotglue.me/account admin and registration tooling |

In `ng-src` the remotes are named: `origin` = `hotglue2-ng` (private), `hotglue2` = public
repo, `server-src` = the server's `/var/www-hotglue/src` over SSH.

## Branches

**`hotglue2-ng` (private)**
- `ng` — the default branch. Everything: editor, features, db-auth, multi-tenant routing,
  SOWs and notes, Playwright e2e suite, PHPUnit tests, `scripts/`. All new work lands here.

**`hotglue2` (public)**
- `dev` — the original hotglue2 line. What `/var/www-hotglue/src` runs: hotglue.me root and
  every `user.hotglue.me` site.
- `ng-dev` — the clean, installable self-host version of `ng` (see below). What the public
  demo at hotglue.me/ng runs.
- `master`, `db-auth-wip` — older lines, not part of the current flow.

Local-only in `ng-src`: `server-capture` (the server's uncommitted state, already merged into
`ng` in `1002088`).

## Where each branch runs

| Where | Server path | Remote / branch |
|---|---|---|
| hotglue.me and all user sites | `/var/www-hotglue/src` | `hotglue2` / `dev` |
| hotglue.me/ng (demo) | `/var/www-hotglue/hotglue.me-ng` | `hotglue2` / `ng-dev` |
| hotglue.me/account | `/var/www-hotglue/account` | `hotglue-account` / `main` |

Nothing on the server tracks `hotglue2-ng`. A commit on `ng` therefore reaches no server by
itself; it reaches the demo only through `ng-dev` (below). If the private `ng` is ever
deployed, use a separate clone (`/var/www-hotglue/src-ng`) with its own read-only deploy key.

## What `ng-dev` is

`ng-dev` is `ng` minus the dev-only material. It is one codebase, config-switched: self-host
versus hosted differs by config, not by code. `ng-dev` differs from `ng` only by:

- **Stripped markdown:** every `*.md` except `README.md`, `docker/INSTALL.md`,
  `fonts/MANIFEST.md` (the `KEEP_MD` list in the script).
- **Stripped tooling:** `tests/`, `package.json`, `package-lock.json`, `composer.json`,
  `composer.lock`, `scripts/sync-to-public.sh` (`STRIP_PATHS`).
- **Trimmed `.gitignore`:** the composer/vendor and e2e blocks are dropped.

The privacy line: SOWs, notes, anti-spam internals, infrastructure details and real config
values never go public. db-auth *code* is public (off by default); the real
`user-config.inc.php` is not (only the `-dist` template).

## Keeping `ng-dev` in sync with `ng`

Direction is one way: **`ng` → `ng-dev`**. Never commit features on `ng-dev`; never merge
`ng-dev` back into `ng` (the strip commits would delete the SOWs and tests there).

Run from `ng-src`, with a clean working tree:

```bash
git push origin ng                 # ng goes to the private repo first
git fetch hotglue2
scripts/sync-to-public.sh          # checks out ng-dev, merges ng, re-strips, commits
```

The script merges `ng` into `ng-dev`, removes every `*.md` not in `KEEP_MD` and every path in
`STRIP_PATHS`, and commits `sync: strip dev-only docs/tooling after merging ng` if anything
needed stripping. It never pushes. Then review:

```bash
git diff ng-dev@{1} ng-dev -- .gitignore   # every time, by eye
git log --oneline ng-dev@{1}..ng-dev
git diff ng-dev@{1} ng-dev --stat          # nothing private should appear: no SOW-*, tests, notes
```

Check `.gitignore` every time. A merge can carry a fragment of an `ng` change into a
deliberately-trimmed file without a conflict, so a clean exit is not proof it's fine.

Publish, then update the demo:

```bash
git push hotglue2 ng-dev
git checkout ng
# demo server: cd /var/www-hotglue/hotglue.me-ng && git pull   (run by hand)
```

### When to sync

After any `ng` change that should be visible in the public demo or to self-hosters. It is
not needed for docs-only, test-only or SOW-only commits, since those are stripped anyway.

### Adding files that should stay private or go public

- A new `*.md` is private by default, because the script strips it. To publish one, add it to
  `KEEP_MD` in `scripts/sync-to-public.sh`.
- A new dev-only non-markdown path (a test config, a tool) must be added to `STRIP_PATHS`, or
  it leaks into `ng-dev`.
- A file that must never reach public even by accident (secrets, real configs) belongs in
  `.gitignore` on both branches, not in the strip list.

### Traps

- **Divergence:** if someone commits directly on `hotglue2/ng-dev`, local `ng-dev` and the
  remote diverge and the push is rejected. Merge `hotglue2/ng-dev` in deliberately; don't
  force-push.
- **Wrong remote:** `origin` is the private repo. `git push origin ng-dev` would put the
  public branch in the private repo; the public push is `git push hotglue2 ng-dev`.
- **Server pull:** the demo only changes when you pull on the server; pushing `ng-dev` alone
  does nothing visible.
- **`ng` is not live:** pushing `ng` to `origin` deploys nothing anywhere.

## Demo checkout history (`/var/www-hotglue/hotglue.me-ng`)

Until 2026-10-06 the demo tracked `hotglue2`'s `ng` branch (at `807ada8`, clean tree). When
`ng` moved to the private `hotglue2-ng` and was deleted from `hotglue2`, its pull target
vanished. It was switched to `hotglue2` / `ng-dev` (`git checkout -B ng-dev origin/ng-dev`,
a 48-commit fast-forward since `807ada8` is in `ng-dev`), and its stale local `ng` branch and
`origin/ng` ref were removed. It now follows the sync flow above.
