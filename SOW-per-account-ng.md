# SOW - serve single accounts from src-ng (per-account switch)

Status: dashboard toggle written (not committed, not deployed); server steps below are a
draft, nothing has been changed on the server. Read-only survey of the server, 2026-10-12.

## Goal

Any hotglue.me account can be moved from `/var/www-hotglue/src` (branch `dev`) to
`/var/www-hotglue/src-ng` (branch `ng`) and back, one account at a time, by an admin from the
account dashboard. Default stays `src`; no account moves unless switched.

## How it works

A marker file `USE_NG` in the account's site dir (`usr/<first letter>/<user>/USE_NG`, the
same place as `SUSPENDED`). Apache checks for it and rewrites to `src-ng` instead of `src`.
Content is shared by both codebases (`CONTENT_DIR` is an absolute path in the account's own
`user-config.inc.php`), so switching moves no data.

## Pieces

1. **Dashboard (done, account repo, uncommitted):** `admin-scripts/dashboard.php` - new
   `ng_user` action (writes / removes `USE_NG`, logs to
   `/var/www-hotglue/logs/codebase.log`), an `NG` badge next to the username, and a
   `use NG` / `use current` button in each row's actions. Flash messages `ng_*`.
   Deploy: push the account repo, then
   `ssh -p 877 danja@hotglue.me 'cd /var/www-hotglue/account && git pull --ff-only'`.
2. **src-ng on the server (todo):**
   - `git -C /var/www-hotglue/src-ng pull` (it is at `50cce12`, origin/ng is ahead)
   - `cp user-config.inc.php-off user-config.inc.php` - the hosted dispatcher, identical to
     `src/user-config.inc.php` apart from comments (gitignored, so it stays local)
   - the dispatcher must also define what dev gets from `../account`: ng's `db` auth reads
     `AUTH_METHOD 'db'` and `DB_AUTH_HOST/USER/PASSWORD/NAME/TABLE` constants (empty in
     `config.inc.php`; dev uses `require_once("../account/models/settings.php")`). Define them
     in the dispatcher before it requires the account's config. Copy the values from the
     account app's settings, do not commit them.
   - `.htaccess` from `htaccess-dist` (there is none in src-ng)
   - `<Directory "/var/www-hotglue/src-ng/">` block like src's (`Options -Indexes
     +FollowSymLinks +Includes -MultiViews`, `AllowOverride All`, `Require all granted`)
3. **Apache rules (todo)** in `/etc/apache2/sites-includes/hotglue.me-inc`, placed BEFORE the
   existing `## rewrite for user subdomains` rule. `((?!www\.)(.)[^.]*)` captures the whole name
   in `%1` and its first letter in `%2`:

   ```apache
   ## accounts switched to ng: a USE_NG marker in the site dir
   RewriteCond %{HTTP_HOST} ^((?!www\.)(.)[^.]*)\.hotglue\.me$ [NC]
   RewriteCond /var/www-hotglue/usr/%2/%1/USE_NG -f
   RewriteRule ^(.*)$ /var/www-hotglue/src-ng/%{REQUEST_URI} [QSA,L]
   ```

   Bound domains need the same through `usr-bind.txt`. The `RewriteMap usrbind` line has to
   come before the rule that uses it, so declare it once near the top (and drop the two
   copies lower down), then:

   ```apache
   RewriteCond %{HTTP_HOST} ^(www\.)?(.+)$ [NC]
   RewriteCond /var/www-hotglue/usr-bind/%2 -f
   RewriteCond ${usrbind:%2} ^((.).*)$
   RewriteCond /var/www-hotglue/usr/%3/%2/USE_NG -f
   RewriteRule ^(.*)$ /var/www-hotglue/src-ng/%{REQUEST_URI}?host=${usrbind:%2}.hotglue.me&loc=usr [QSA,L]
   ```

   Check the back-reference numbers when writing it: `%N` in a RewriteCond is the last
   *regex* condition that matched, so `%2`/`%3` above refer to different groups than in the
   first block. Test with `apachectl configtest`, then reload once; the marker itself never
   needs a reload.
   Not covered: `srv/` domains (hotglue.me's own pages, a few custom domains) - they are not
   accounts. `/srv/slow` does not exist on this server, so the dispatcher's slow-storage
   fallback is dead and the marker is only looked for under `usr/`.
4. **Cache (todo, test first):** `.js` and `.css` get 7 days (`ExpiresByType`) and 1 day
   (`Cache-Control max-age=86400` in the `FilesMatch`), and dev and ng share unversioned URLs
   (`/js/edit.js`). After a switch the browser keeps the other codebase's scripts: the editor is
   broken until a hard reload, worse going ng -> dev. The dashboard message tells the admin to
   reload; a real fix is `no-cache` for ng accounts (set an env var in the ng rule with
   `[E=HG_NG:1]`, `Header set Cache-Control "no-cache" env=HG_NG` inside the `FilesMatch`) -
   untested, and it does not help the first load after switching back.

## Rollout

1. Piece 2, then piece 3 for subdomains only; `apachectl configtest`; reload.
2. Switch a test account (own) from the dashboard; edit, save, reload, switch back.
3. Take a copy of an account before its first switch (`/var/www-hotglue/backup` exists):
   ng writes keys dev does not render (`page-layout-mode`, the page video keys, heading level,
   image alt text, html-upload iframes, downloads). The files are safe going back, the
   features just do not show.
4. Deploy the dashboard (piece 1).

## Open

- Is a bound-domain account switched by its username's marker (as drafted)? Yes, by design:
  one marker per account.
- A user-facing opt-in (account page button) is not built; the toggle is admin-only.
- `src` itself has uncommitted edits on the server (`common.inc.php`, `module_glue.inc.php`,
  `user-config.inc.php`) that would block a plain `git pull` there.
