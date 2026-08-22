<?php

/**
 *	router for the PHP built-in server used by the Playwright e2e suite
 *
 *	Its whole job is to force a hermetic configuration before any of hotglue
 *	loads. Both config.inc.php and user-config.inc.php declare their settings
 *	with @define(), which is a no-op once a constant already exists, so
 *	defining them here wins over whatever the developer has locally. That
 *	keeps the suite off the real content directory and off real credentials.
 *
 *	Start with:
 *		php -S 127.0.0.1:8123 tests/e2e/server-router.php
 *	from the repository root (playwright.config.js does this automatically).
 */

$root = dirname(__DIR__, 2);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// hand real static files (js/, css/, uploaded media) back to the built-in
// server untouched - returning false means "serve this as-is"
if ($path !== '/' && !preg_match('#\.php$#', $path) && is_file($root.$path)) {
	return false;
}

// CONTENT_DIR is emitted into asset URLs (module_video.inc.php:284 and
// friends), so it has to stay a path relative to the document root - an
// absolute temp directory would produce unreachable URLs.
define('CONTENT_DIR', 'content-e2e');
define('LOG_FILE', 'content-e2e/log.txt');
define('AUTH_USER', 'e2e');
define('AUTH_PASSWORD', 'e2e-secret');
// exercise the real sources, not whatever .min.js pair happens to be stale
define('USE_MIN_FILES', false);
define('CACHE_TIME', 0);
// verbose logging into the throwaway content dir, so a failing test can be
// diagnosed from content-e2e/log.txt instead of by guesswork
define('LOG_LEVEL', 'debug');

chdir($root);
require $root.(preg_match('#/json\.php$#', $path) ? '/json.php' : '/index.php');
