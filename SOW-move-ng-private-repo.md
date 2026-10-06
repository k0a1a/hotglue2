# SOW — Move the `ng` branch to a new private repo `hotglue-ng`

Status: done 2026-10-06; `hotglue2-ng` confirmed Private. The repo is named `hotglue2-ng`
(not `hotglue-ng` as written below) and lives locally at `~/pro/hotglue/hotglue2-ng`. In
`ng-src`, `origin` is `hotglue2-ng` and `hotglue2` is the public repo.

Move the `ng` branch out of the public `hotglue2` repo into a NEW PRIVATE repo `hotglue-ng`
(private, like the `account` repo), preserving history, keeping the branch name `ng`. Then
update the git remotes on the local clone(s) and the server so `ng` work tracks the new
private repo. (Confirmed: there are NO secrets in the `ng` history, so this is clean
housekeeping — no secret-rotation needed.)

## Why

`ng` is becoming the hotglue.me server version (db-auth, multi-tenant, sensitive ops will be
merged in next, per SOW-ng-repo-restructure.md), so it must live in a PRIVATE repo, not the
public `hotglue2`. This move is the prerequisite for merging the server's sensitive state
into `ng` privately.

## Steps

### 1. Create the private repo
- Create a new PRIVATE repo named `hotglue-ng` (same privacy as `account`), empty (no
  auto-generated README/license that would complicate the first push).

### 2. Push `ng` to `hotglue-ng`, preserving history, keeping the name `ng`
- From a local clone that has the `ng` branch and the `hotglue2` remote:
  - add the new repo as a remote, e.g. `git remote add hotglue-ng <hotglue-ng-url>`
  - push the branch keeping its name: `git push hotglue-ng ng:ng`
- Branch naming: keep the branch as **`ng`** in the new repo (not renamed to main). Set `ng`
  as the repo's DEFAULT branch in `hotglue-ng` settings (so the repo's primary content is on
  the branch it lives on). Delete/ignore any placeholder default branch the host created.

### 3. Verify `ng` landed intact BEFORE deleting the original
- Confirm in `hotglue-ng` that `ng` arrived with full history: latest commit hash matches,
  commit count matches, the tree matches. Do NOT proceed to deletion until verified.

### 4. Delete `ng` from the public `hotglue2`
- Once verified in `hotglue-ng`: `git push hotglue2 --delete ng`
- (No secret concern — confirmed nothing sensitive was in `ng`; this is just removing the
  now-moved branch from the public repo.)

### 5. Update git remotes (local clone(s) AND the server) — yes, required
Both the local working clone and the SERVER's repo need their remote for `ng` work pointed at
`hotglue-ng` instead of `hotglue2`, or they'll keep tracking the old (now `ng`-less) public
repo.

- **Local clone(s):** decide the remote layout. Options:
  - If this clone's main job is now `ng` work: repoint `origin` to `hotglue-ng`
    (`git remote set-url origin <hotglue-ng-url>`), and keep `hotglue2` as a secondary remote
    if you still need the public repo (`git remote add hotglue2 <hotglue2-url>`).
  - Set the local `ng` branch to track `hotglue-ng/ng`:
    `git branch --set-upstream-to=hotglue-ng/ng ng` (or `-u` on next push).
  - Remove the temporary `hotglue-ng` remote name if you repointed `origin` to it (avoid two
    remotes pointing at the same repo).
- **Server: no change needed (decided).** Neither server checkout tracks the moved branch:
  - `/var/www-hotglue/src` stays on `git@github.com:k0a1a/hotglue2.git`, branch `dev` (the
    deployed original hotglue2; hotglue.me root and every user site run it).
  - `/var/www-hotglue/hotglue.me/ng` (the public demo) stays on `hotglue2`, branch `ng-dev`,
    which is untouched by deleting `ng` from `hotglue2`.
  - Optional, later: if the private `ng` branch should be deployed, create a separate clone
    `/var/www-hotglue/src-ng` of `git@github.com:k0a1a/hotglue2-ng.git` on `ng`. It needs a
    read-only deploy key on `hotglue2-ng` (a key already used as a deploy key on another repo
    can't be reused; use a second key plus an `~/.ssh/config` host alias), and
    `user-config.inc.php` and `content/` are not in git. Not needed today.

### 6. Sanity-check access
- Confirm `hotglue-ng` is genuinely PRIVATE (not accidentally public).
- Confirm you (and any needed collaborators) can access it; confirm the server's deploy
  key / credentials can read `hotglue-ng` (a private repo needs the server's git auth updated
  — SSH deploy key or token — or server pulls will fail). Add the server's key/token to
  `hotglue-ng` if not already authorized.

## Constraints

- Preserve `ng` history (push the branch; no fresh-start).
- `hotglue-ng` PRIVATE from creation; verify privacy after.
- Verify `ng` intact in `hotglue-ng` BEFORE deleting from `hotglue2`.
- Non-destructive on the SERVER: repoint the remote but do NOT discard the server's
  uncommitted production changes (capture them per the restructure SOW first/next).
- Ensure the server's git auth can access the now-PRIVATE repo (deploy key/token) or pulls
  break.

## Definition of done

- Private repo `hotglue-ng` exists, contains the `ng` branch (named `ng`, set as default)
  with full history, verified intact; repo confirmed private.
- `ng` branch deleted from public `hotglue2`.
- Local clone(s) remotes updated: `ng` tracks `hotglue-ng/ng`; `hotglue2` kept as secondary
  only if still needed.
- Server checkouts unchanged: `src` stays on `hotglue2`/`dev`, the `/ng` demo stays on
  `hotglue2`/`ng-dev`. (`src-ng` only if the private branch is ever deployed.)
- `ng` is now private, ready to receive the server's sensitive state per
  SOW-ng-repo-restructure.md.
