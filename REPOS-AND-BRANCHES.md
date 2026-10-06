# Hotglue repos and branches

How the code is split across repos and branches, where each piece is deployed, and how
`hotglue2-ng/ng` (private) and `hotglue2/ng-dev` (public) are kept in sync. Background:
`SOW-ng-repo-restructure.md` (why the split exists, what stays private) and
`SOW-move-ng-private-repo.md` (the 2026-10-06 move of `ng` to its own private repo).

## Repos

| Repo | Visibility | Local clone | Holds |
|---|---|---|---|
| `k0a1a/hotglue2` | public | server: `/var/www-hotglue/src` | The original hotglue2 and the public self-host branch |
| `k0a1a/hotglue2-ng` | **private** | `~/pro/hotglue/src-ng` (the working clone; `~/pro/hotglue/hotglue2-ng` is a spare second one, and `ng-src.delete-me-soon` is the old working directory, kept until nothing in it is needed) | The `ng` branch: hotglue.me server version, SOWs, tests, notes |
| `k0a1a/hotglue-account` | private | `~/pro/hotglue/account` | hotglue.me/account admin and registration tooling |

In `src-ng` the remotes are named: `origin` = `hotglue2-ng` (private), `hotglue2` =
public repo.

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

Local `ng-dev` tracks `hotglue2/ng-dev`. (The old `server-capture` branch, the server's
uncommitted state, was merged into `ng` in `1002088`.)

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
- **Hosted-only config:** `user-config.inc.php-off` (the hosted multi-tenant routing, kept off
  by default) never goes to `ng-dev`; it is in `STRIP_PATHS`.
- **Trimmed `.gitignore`:** the composer/vendor and e2e blocks are dropped.

The privacy line: SOWs, notes, anti-spam internals, infrastructure details and real config
values never go public. db-auth *code* is public (off by default); the real
`user-config.inc.php` is not (only the `-dist` template).

## Keeping `ng-dev` in sync with `ng`

Direction is one way: **`ng` → `ng-dev`**. Never commit features on `ng-dev`; never merge
`ng-dev` back into `ng` (the strip commits would delete the SOWs and tests there).

Four steps: sync, review, publish, update the demo. The first two change nothing public;
the third is the only one that does, and is done when asked for.

### 1. Sync, in a worktree

`scripts/sync-to-public.sh` refuses to run on a dirty working tree, and the working clone
usually has work in progress in it (icons, uncommitted edits). So it runs in a separate
worktree of `ng-dev`, which is clean by construction and leaves the working tree and its
branch alone. **Never `git stash` the working tree to make room** - it takes your
uncommitted work with it.

```bash
cd ~/pro/hotglue/src-ng
git push origin ng                       # ng goes to the private repo first
git fetch hotglue2
WT=$(mktemp -d)/ng-dev-wt
git worktree add "$WT" ng-dev
cd "$WT"
bash ~/pro/hotglue/src-ng/scripts/sync-to-public.sh
```

The script is run from `src-ng`'s copy because on `ng-dev` it strips itself. It merges `ng`
into `ng-dev`, removes every `*.md` not in `KEEP_MD` and every path in `STRIP_PATHS`, and
commits `sync: strip dev-only docs/tooling after merging ng` if anything needed stripping.
It never pushes.

**Conflicts.** The expected one is a modify/delete (`DU` in `git status`): `ng` changed a
file that `ng-dev` had stripped - a `*.md`, something under `tests/`. The merge stops there.
When every conflict is of that kind, remove the files and run the script again to do the strip:

```bash
git status --short | grep -v '^[AMDR] '    # all DU, all stripped paths?
git rm -q <those files>
git commit -qm "Merge ng into ng-dev"
bash ~/pro/hotglue/src-ng/scripts/sync-to-public.sh
```

Any other kind of conflict (a file `ng-dev` keeps, a `.gitignore` clash) is not routine:
stop and resolve it by hand.

### 2. Review

Still in the worktree. Nothing private may be in the tree, and `.gitignore` is checked by
eye every time: a merge can carry a fragment of an `ng` change into a deliberately trimmed
file without a conflict, so a clean exit is not proof it's fine.

```bash
git diff ng-dev@{1} ng-dev -- .gitignore            # empty, unless ng touched it
git ls-files | grep -E '\.md$|^tests/|user-config.inc.php-off|SOW|package|composer|sync-to-public'
                                                    # only README.md, docker/INSTALL.md, fonts/MANIFEST.md
git diff hotglue2/ng-dev ng-dev --stat              # what the public branch will gain
for f in $(git diff --name-only hotglue2/ng-dev ng-dev -- '*.php'); do php -l $f; done
for f in $(git diff --name-only hotglue2/ng-dev ng-dev -- '*.js'); do node --check $f; done
```

### 3. Publish

The one public step, so it waits for a go-ahead. From the worktree or from `src-ng`:

```bash
git push hotglue2 ng-dev
git ls-remote hotglue2 refs/heads/ng-dev            # the tip must match: git rev-parse ng-dev
```

GitHub sometimes answers a push with "Please make sure you have the correct access rights
and the repository exists". It is transient; the same push goes through on a retry. Check
the tip with `ls-remote` rather than trusting either outcome.

### 4. Update the demo

Nothing is visible until the server pulls. By hand, since the server is not reachable from
the tools:

```bash
ssh -p 877 danja@hotglue.me 'cd /var/www-hotglue/hotglue.me-ng && git status -sb && git pull --ff-only'
```

Then hard-reload the editor (Ctrl+Shift+R): the stylesheets and scripts have no version in
their URLs and a browser keeps the old ones.

Last, drop the worktree (`git worktree remove "$WT"`); `ng-dev` cannot be checked out in
`src-ng` while it exists.

### When to sync

After any `ng` change that should be visible in the public demo or to self-hosters: code,
css, js, the editor's icons, fonts. It is not needed for docs-only, test-only or SOW-only
commits, since those are stripped anyway - a sync after only those leaves the public tree
unchanged and just adds merge commits. `git log --oneline ng-dev..ng -- . ':!*.md' ':!tests'`
shows what a sync would carry over.

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
- **A dirty working tree stops the script, and stashing is not the answer:** use the
  worktree above. A `git stash` there takes every uncommitted change with it, including
  files you have not committed on purpose.
- **Server pull:** the demo only changes when you pull on the server; pushing `ng-dev` alone
  does nothing visible.
- **`ng` is not live:** pushing `ng` to `origin` deploys nothing anywhere.
- **The transient push error** (above) is not a permissions problem; retry and check the tip.

## Demo checkout history (`/var/www-hotglue/hotglue.me-ng`)

Until 2026-10-06 the demo tracked `hotglue2`'s `ng` branch (at `807ada8`, clean tree). When
`ng` moved to the private `hotglue2-ng` and was deleted from `hotglue2`, its pull target
vanished. It was switched to `hotglue2` / `ng-dev` (`git checkout -B ng-dev origin/ng-dev`,
a 48-commit fast-forward since `807ada8` is in `ng-dev`), and its stale local `ng` branch and
`origin/ng` ref were removed. It now follows the sync flow above.

Since then every public change has gone out the same way: sync, review, `git push hotglue2
ng-dev`, then a `git pull --ff-only` there. The checkout is expected to be clean; if
`git status -sb` shows anything before a pull, look at it first rather than pulling over it.
