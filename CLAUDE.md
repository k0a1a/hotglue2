# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Hotglue is a PHP web application for building free-form, drag-and-drop web pages in the browser. It does not use a database and stores everything as flat files under `content/`. The project targets PHP 8 compatibility and includes jQuery-based frontend JS/CSS in the `js/` and `css/` directories.

## Common Commands

### Running the Application
To run Hotglue locally:
```bash
php -S localhost:8000
```
Ensure that the `content/` directory is writable by the webserver:
```bash
chmod -R 0777 content
```

### Configuration
Copy the configuration file and set the authentication password:
```bash
cp user-config.inc.php-dist user-config.inc.php
```

### Testing
`tests/UtilTest.php` is a PHPUnit test case for `util.inc.php`. There is no `composer.json`/`vendor/` in this repo, so PHPUnit must be available separately (e.g. installed globally or as a phar). It cannot be run with plain `php`; run it with the `phpunit` binary:
```bash
phpunit tests/UtilTest.php
```

### Debugging
Set `error_reporting(E_ALL);` in `user-config.inc.php` to enable detailed error messages.

## High-Level Architecture

### Request Flow
Hotglue has two main HTTP entry points:

1. **`index.php`** - Handles page views and edits. It parses the query string using `parse_query_string()` and invokes the appropriate controller.
2. **`json.php`** - AJAX/RPC endpoint used by the in-browser editor. It expects POST body parameters that are individually JSON-encoded values.

### Controllers, Services, and Hooks
- **Controllers**: Registered via `register_controller($arg0, $arg1, $func, $args)`. They are keyed on the first two positional query arguments.
- **Services**: Registered via `register_service($name, $func, $args)`. They are invoked by `run_service()`/`json.php`.
- **Hooks**: Named extension points modules can implement. For example, a module named `image` implementing hook `render_object` defines `image_render_object()`. These hooks are managed through `invoke_hook()`.

### Modules
Modules are located in the root directory as `module_*.inc.php` files and are auto-discovered by `load_modules()`. Each module can define functions for hooks it participates in, such as `alter_render_early`, and register services for AJAX operations. Disabled modules are suffixed with `-disabled`.

### Content Storage
Content is stored as flat files under the `content/` directory. Pages, objects, and revisions are addressed by dotted names (`page.revision.object`) that map directly to filesystem paths via `str_replace('.', '/', $name)`.

### HTML Building
HTML output is built programmatically using functions like `body()`, `body_append()`, `elem()`, and `elem_attr()` from `html.inc.php`. Assets are queued with `html_add_css()`/`html_add_js()` and finalized with `html_finalize()`.

### Configuration
All settings are defined as constants in `config.inc.php`. Overrides should be placed in `user-config.inc.php`.

## Important Files

- **`index.php`**: Main entry point for page views and edits.
- **`json.php`**: AJAX/RPC endpoint used by the editor.
- **`module_glue.inc.php`**: Core module providing objects, revisions, and locking primitives.
- **`config.inc.php`**: Contains all configuration settings with inline doc comments.
- **`user-config.inc.php`**: Used to override default configuration values.
- **`tests/UtilTest.php`**: PHPUnit test for `util.inc.php`.

## Additional Notes

- The Docker setup is located in the `docker/` directory. Use `docker-compose up -d` to start the container, then follow `docker/INSTALL.md` (the image clones the app from GitHub into a named volume rather than bind-mounting the local checkout, so it's a deployment setup, not a live-reload dev environment for this source tree).
- For logging, set `LOG_LEVEL` to `'debug'` in `config.inc.php` to enable verbose logging to `content/log.txt`.
- To disable caching, ensure `CACHE_TIME` is set to zero or remove it from the configuration.