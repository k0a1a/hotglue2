# hotglue

Hotglue is a free-form, drag-and-drop web page builder that runs entirely in the
browser. It stores everything as flat files under `content/` - no database
required - and runs on plain PHP 8.

## Requirements

- PHP 8.x
- A webserver, or just use PHP's own built-in server to get started

## Quick start

```bash
php -S localhost:8000
chmod -R 0777 content
cp user-config.inc.php-dist user-config.inc.php
```

Edit `user-config.inc.php` and set your own username and password - it defaults
to `admin` / `changeme`, which you should change before putting a site anywhere
public.

Open `http://localhost:8000` in a browser.

## Configuration

All settings are defined in `config.inc.php`, with inline documentation for each
one. Don't edit that file directly - override individual settings in
`user-config.inc.php` instead, which won't be touched by future updates.

By default hotglue authenticates against the single username/password pair in
`user-config.inc.php` (`AUTH_METHOD` = `'basic'`). It can instead authenticate
against a MySQL-backed accounts table (`AUTH_METHOD` = `'db'`, configured via
the `DB_AUTH_*` constants) if you're running several sites off one shared user
database - most self-hosters won't need this.

## Docker

See `docker/INSTALL.md` for running hotglue under Docker Compose instead.
