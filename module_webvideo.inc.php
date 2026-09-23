<?php

/*
 *	module_webvideo.inc.php
 *	Module for embedding media from oEmbed providers
 *	(SOW-oembed-media.md, implemented 2026-09-23)
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');
require_once('html_parse.inc.php');


/**
 *	the vendored, curated provider whitelist, read from
 *	modules/webvideo/providers.json (SOW-oembed-media.md): each entry
 *	carries the oEmbed endpoint template (with {url}) - or the tier it
 *	resolves through instead - the URL schemes that select it, and the
 *	pattern an embed iframe's host must match. Three tiers: tier 1 oEmbed
 *	(youtube/vimeo/soundcloud/spotify/mixcloud), tier 2 a direct URL
 *	transform (peertube - the embed url derives from the watch url), tier
 *	3 an Open Graph scrape (bandcamp). The hermetic suite's stub provider
 *	joins the list when HG_STUB_OEMBED is defined and resolves locally,
 *	no network involved.
 */
function webvideo_providers()
{
	static $providers = false;
	if ($providers === false) {
		$file = __DIR__.'/modules/webvideo/providers.json';
		$providers = json_decode(@file_get_contents($file), true);
		if (!is_array($providers)) {
			log_msg('error', 'webvideo: could not read the provider whitelist '.$file);
			$providers = [];
		}
		unset($providers['#']);
	}
	if (defined('HG_STUB_OEMBED') && HG_STUB_OEMBED && !isset($providers['stub'])) {
		$providers['stub'] = [
			'stub' => true,
			'schemes' => '~^https?://stub\\.example/(watch|fail|bad)/~i',
			'host' => '~^embed\\.stub\\.example$~i',
		];
	}
	return $providers;
}


/**
 *	fetch a URL with a 5s timeout - curl when available, streams otherwise.
 *	Never called in the hermetic suite's normal runs (the stub resolves
 *	locally); a slow or down provider must not hang a page render.
 *
 *	@return string|false the body, or false on failure
 */
function webvideo_fetch($url)
{
	$ctx = stream_context_create(['http' => [
		'timeout' => 5,
		'follow_location' => 1,
		'max_redirects' => 3,
		'user_agent' => 'hotglue',
	]]);
	if (function_exists('curl_init')) {
		$ch = curl_init();
		curl_setopt_array($ch, [
			CURLOPT_URL => $url,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_FOLLOWLOCATION => true,
			CURLOPT_MAXREDIRS => 3,
			CURLOPT_TIMEOUT => 5,
			CURLOPT_USERAGENT => 'hotglue',
		]);
		$body = curl_exec($ch);
		curl_close($ch);
		if ($body === false) {
			return @file_get_contents($url, false, $ctx);
		}
		return $body;
	}
	return @file_get_contents($url, false, $ctx);
}


/**
 *	parse an oEmbed-style embed html and return it as a NORMALIZED iframe
 *	element string: exactly one iframe, whose src host matches the given
 *	pattern, nothing else (a <script> anywhere rejects the whole response).
 *	The normalized form carries sandbox and referrerpolicy and no size -
 *	the object's box sizes the embed (SOW Decisions 7 and 8).
 *
 *	@return string|false
 */
function webvideo_validate_embed($html, $host_pattern)
{
	if (preg_match('#<script\b#i', $html)) {
		return false;
	}
	$childs = html_parse($html);
	$iframes = [];
	foreach ($childs as $c) {
		if (elem_tag($c) == 'iframe') {
			$iframes[] = $c;
		}
	}
	if (count($iframes) != 1) {
		return false;
	}
	$src = elem_attr($iframes[0], 'src');
	if (empty($src)) {
		return false;
	}
	$src = preg_replace('#^//#', 'https:', $src);
	$host = parse_url($src, PHP_URL_HOST);
	if ($host === false || $host === NULL || !preg_match($host_pattern, $host)) {
		return false;
	}
	$out = elem('iframe');
	elem_attr($out, 'src', $src);
	elem_attr($out, 'sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
	elem_attr($out, 'referrerpolicy', 'strict-origin-when-cross-origin');
	return elem_finalize($out);
}


/**
 *	build a Bandcamp embed from a pasted album/track URL, the SOW's tier 3:
 *	the page's og:video (or og:video:secure_url) meta carries the
 *	EmbeddedPlayer url with the numeric id already in it - Bandcamp keeps
 *	these for social-media link previews, so they are stable. The raw
 *	numeric-id scrape is the fallback for a page without them.
 *
 *	@return string|false
 */
function webvideo_bandcamp_embed($url, $page_html)
{
	$src = false;
	$og = '#<meta[^>]+property=["\']PROP["\'][^>]+content=["\']([^"\']+)["\']#i';
	$og_rev = '#<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']PROP["\']#i';
	foreach (['og:video:secure_url', 'og:video'] as $prop) {
		$pat = str_replace('PROP', $prop, $og);
		$pat_rev = str_replace('PROP', $prop, $og_rev);
		if (preg_match($pat, $page_html, $m) || preg_match($pat_rev, $page_html, $m)) {
			$src = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
			break;
		}
	}
	if ($src === false) {
		// the fallback: the numeric id in the page's own json
		if (preg_match('#"album_id":(\d+)#', $page_html, $m) || preg_match('#data-album-id="(\d+)"#', $page_html, $m)) {
			$src = 'https://bandcamp.com/EmbeddedPlayer/album='.$m[1]
				.'/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/';
		} elseif (preg_match('#"track_id":(\d+)#', $page_html, $m)) {
			$src = 'https://bandcamp.com/EmbeddedPlayer/track='.$m[1]
				.'/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/';
		}
	}
	if ($src === false) {
		return false;
	}
	// the url - scraped or templated - goes through the same validation
	// as every other embed (single iframe, bandcamp's own host)
	$html = webvideo_validate_embed('<iframe src="'.htmlspecialchars($src, ENT_QUOTES, 'UTF-8').'"></iframe>', '#^bandcamp\.com$#i');
	return $html;
}


/**
 *	resolve a pasted media URL to its validated embed html: provider match,
 *	then the tier the provider maps to - tier 1 oEmbed, tier 2 a direct
 *	URL transform (PeerTube), tier 3 an Open Graph scrape (Bandcamp) -
 *	then validation. Writes the cache file into the page's shared
 *	directory - shared assets travel with copy-paste and are deduplicated
 *	(SOW Decision 1) - and creates the object, returning its editor render.
 *
 *	@return string|false the embed html, or false with $error set
 */
function webvideo_resolve_url($url, &$provider_out, &$error)
{
	$error = '';
	$provider_out = false;
	foreach (webvideo_providers() as $name => $p) {
		if (preg_match($p['schemes'], $url)) {
			$provider_out = $name;
			break;
		}
	}
	if ($provider_out === false) {
		$error = "this service isn't supported yet";
		return false;
	}
	$p = webvideo_providers()[$provider_out];
	if (!empty($p['stub'])) {
		// the hermetic suite's local provider, no network
		if (preg_match('#/fail/#', $url)) {
			$error = "couldn't reach the provider";
			return false;
		}
		$id = basename(parse_url($url, PHP_URL_PATH));
		if (preg_match('#/bad/#', $url)) {
			$html = '<iframe src="https://evil.example/'.$id.'"></iframe><script>bad()</script>';
		} else {
			$html = '<iframe src="https://embed.stub.example/'.$id.'"></iframe>';
		}
		$html = webvideo_validate_embed($html, $p['host']);

		if ($html === false) {
			$error = "the provider's response did not validate";
			return false;
		}
		return $html;
	}
	if (!empty($p['transform'])) {
		// tier 2: the embed url derives directly from the public url - a
		// PeerTube watch url is /w/<uuid> or /videos/watch/<uuid> on the
		// instance, the embed is /videos/embed/<uuid> on that same
		// instance, so the host allowlist IS the instance (SOW Decision 6)
		preg_match($p['schemes'], $url, $m);
		$instance = $m[1];
		$uuid = $m[3];
		$html = webvideo_validate_embed(
			'<iframe src="https://'.$instance.'/videos/embed/'.$uuid.'"></iframe>',
			'#^'.preg_quote($instance, '#').'$#i');
		if ($html === false) {
			$error = "couldn't embed this link";
			return false;
		}
		return $html;
	}
	if (!empty($p['template'])) {
		// tier 3: bandcamp. A pasted share/embed link may already BE the
		// player url - wrap it directly, no fetch; the ordinary album/
		// track url fetches the page and reads og:video.
		if (preg_match('~^https?://bandcamp\.com/EmbeddedPlayer/~i', $url)) {
			$html = webvideo_validate_embed('<iframe src="'.htmlspecialchars($url, ENT_QUOTES, 'UTF-8').'"></iframe>', $p['host']);
			if ($html !== false) {
				return $html;
			}
		}
		$page_html = webvideo_fetch($url);
		if ($page_html === false) {
			$error = "couldn't reach the provider";
			return false;
		}
		$html = webvideo_bandcamp_embed($url, $page_html);
		if ($html === false) {
			$error = "couldn't embed this link";
			return false;
		}
		return $html;
	}
	$endpoint = str_replace('{url}', rawurlencode($url), $p['endpoint']);
	$body = webvideo_fetch($endpoint);
	if ($body === false) {
		$error = "couldn't reach the provider";
		return false;
	}
	$data = json_decode($body, true);
	if (empty($data['html'])) {
		$error = "couldn't embed this link";
		return false;
	}
	$html = webvideo_validate_embed($data['html'], $p['host']);
	if ($html === false) {
		$error = "the provider's response did not validate";
		return false;
	}
	return $html;
}


/**
 *	the source URL an object carries - the stored webvideo-url, or the
 *	canonical URL reconstructed from a legacy object's provider + id
 *	(SOW Decision 4)
 */
function webvideo_object_url($obj)
{
	if (!empty($obj['webvideo-url'])) {
		return $obj['webvideo-url'];
	}
	if (!empty($obj['webvideo-id']) && !empty($obj['webvideo-provider'])) {
		if ($obj['webvideo-provider'] == 'youtube') {
			return 'https://www.youtube.com/watch?v='.$obj['webvideo-id'];
		}
		if ($obj['webvideo-provider'] == 'vimeo') {
			return 'https://vimeo.com/'.$obj['webvideo-id'];
		}
	}
	return false;
}


function webvideo_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'webvideo')) {
		return false;
	}

	$url = webvideo_object_url($obj);
	// the cached embed, or ONE re-resolve with the timeout (SOW Decision 2)
	// - legacy objects resolve through the reconstructed url
	$html = false;
	if (!empty($obj['webvideo-cache-file'])) {
		$pn = get_first_item(expl('.', $obj['name']));
		$cache = CONTENT_DIR.'/'.$pn.'/shared/'.$obj['webvideo-cache-file'];
		if (is_file($cache)) {
			$html = @file_get_contents($cache);
		}
	}
	if ($html === false && $url !== false) {
		$pn = get_first_item(expl('.', $obj['name']));
		$provider = false;
		$error = '';
		$html = webvideo_resolve_url($url, $provider, $error);
		if ($html !== false) {
			$cache = 'webvideo-'.substr(md5($url), 0, 16).'.html';
			$dir = CONTENT_DIR.'/'.$pn.'/shared';
			if (!is_dir($dir)) {
				mkdir($dir, 0777, true);
			}
			@file_put_contents($dir.'/'.$cache, $html);
			update_object(['name'=>$obj['name'], 'webvideo-url'=>$url,
				'webvideo-provider'=>$provider, 'webvideo-cache-file'=>$cache]);
			$obj['webvideo-url'] = $url;
			$obj['webvideo-provider'] = $provider;
			$obj['webvideo-cache-file'] = $cache;
		}
	}
	if ($html === false) {
		// the fallback: the url as a plain link, or the message - never a
		// broken page (SOW Decision 2)
		if ($url !== false) {
			$a = elem('a');
			elem_attr($a, 'href', $url);
			elem_val($a, htmlspecialchars($url, ENT_NOQUOTES, 'UTF-8'));
			elem_append($elem, $a);
		} else {
			elem_val($elem, "couldn't embed this link");
		}
		return true;
	}

	// the embed: the cached (already validated + sandboxed) iframe, with
	// the autoplay/loop attrs appended where the provider speaks them
	$childs = html_parse($html);
	foreach ($childs as $c) {
		if (elem_tag($c) == 'iframe') {
			$src = elem_attr($c, 'src');
			if (!empty($obj['webvideo-provider'])
				&& ($obj['webvideo-provider'] == 'youtube' || $obj['webvideo-provider'] == 'vimeo')) {
				if (isset($obj['webvideo-autoplay']) && $obj['webvideo-autoplay'] == 'autoplay'
					&& strpos($src, 'autoplay') === false) {
					$src .= (strpos($src, '?') === false ? '?' : '&').'autoplay=1';
				}
				if (isset($obj['webvideo-loop']) && $obj['webvideo-loop'] == 'loop'
					&& strpos($src, 'loop') === false) {
					$src .= (strpos($src, '?') === false ? '?' : '&').'loop=1';
				}
				elem_attr($c, 'src', $src);
			}
			$i = elem('iframe');
			elem_attr($i, 'src', elem_attr($c, 'src'));
			elem_attr($i, 'sandbox', elem_attr($c, 'sandbox'));
			elem_attr($i, 'referrerpolicy', elem_attr($c, 'referrerpolicy'));
			elem_css($i, 'border-width', '0px');
			elem_css($i, 'height', '100%');
			elem_css($i, 'position', 'absolute');
			elem_css($i, 'width', '100%');
			elem_append($elem, $i);
			break;
		}
	}

	if ($args['edit']) {
		// shield over the upper part of the embed: the <iframe> is a
		// genuine cross-origin document, so any click landing directly on
		// it never bubbles to the parent page at all - a same-document div
		// stacked on top intercepts the click before it reaches the
		// iframe, letting the editor's select/menu/drag handling see it
		$s = elem('div');
		elem_add_class($s, 'glue-webvideo-shield');
		elem_add_class($s, 'glue-ui');
		elem_attr($s, 'title', 'click here to select/edit this embed');
		elem_append($elem, $s);
	}

	return true;
}


function webvideo_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'webvideo') {
		return false;
	}

	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'webvideo');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	// a fresh embed starts at a sensible default size until the author
	// resizes it (the render is the source of truth, so nothing is stored)
	if (empty($obj['object-width'])) {
		elem_css($e, 'width', '400px');
		elem_css($e, 'height', '300px');
	}

	// hooks
	invoke_hook_first('alter_render_early', 'webvideo', ['obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']]);
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'webvideo', ['obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']]);

	return $html;
}


function webvideo_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/webvideo/webvideo-edit.min.js');
		} else {
			html_add_js(base_url().'modules/webvideo/webvideo-edit.js');
		}
		html_add_css(base_url().'modules/webvideo/webvideo-edit.css');
	}
}


function webvideo_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (get_first_item(elem_classes($elem)) != 'webvideo') {
		return false;
	}

	// make sure the type is set
	$obj['type'] = 'webvideo';
	$obj['module'] = 'webvideo';

	// hook
	invoke_hook('alter_save', ['obj'=>&$obj, 'elem'=>$elem]);

	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'webvideo_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function webvideo_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'webvideo') {
		return false;
	}

	load_modules('glue');
	$pn = get_first_item(expl('.', $obj['name']));
	if (!empty($obj['webvideo-cache-file'])) {
		delete_upload(['pagename'=>$pn, 'file'=>$obj['webvideo-cache-file'], 'max_cnt'=>1]);
	}
}


function webvideo_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'webvideo') {
		return false;
	}
	// the cache file is a shared asset, so copy-paste carries it
	if (!empty($obj['webvideo-cache-file']) && $obj['webvideo-cache-file'] == $args['file']) {
		return true;
	}
	return false;
}


/**
 *	the editor's resolve-and-create: match the whitelist, resolve, validate,
 *	write the cache, create the object, return its editor render in the
 *	upload shape the editor's handle_response consumes.
 */
function webvideo_resolve($args)
{
	if (empty($args['url']) || empty($args['page'])) {
		return response('Required argument "url" is missing', 400);
	}
	$url = $args['url'];
	$url = preg_replace('#^//#', 'https:', $url);
	if (!preg_match('#^https?://#i', $url)) {
		return response('Not a valid URL', 400);
	}
	load_modules('glue');
	$pn = $args['page'];

	$provider = false;
	$error = '';
	$html = webvideo_resolve_url($url, $provider, $error);
	if ($html === false) {
		return response($error, 400);
	}

	$cache = 'webvideo-'.substr(md5($url), 0, 16).'.html';
	$dir = CONTENT_DIR.'/'.$pn.'/shared';
	if (!is_dir($dir)) {
		mkdir($dir, 0777, true);
	}
	if (@file_put_contents($dir.'/'.$cache, $html) === false) {
		log_msg('error', 'webvideo_resolve: could not write the cache file');
		return response('There was a problem embedding the link', 500);
	}

	$obj = create_object(['page'=>$pn]);
	if ($obj['#error']) {
		return response('There was a problem embedding the link', 500);
	}
	$obj = $obj['#data'];
	$obj['type'] = 'webvideo';
	$obj['module'] = 'webvideo';
	$obj['webvideo-url'] = $url;
	$obj['webvideo-provider'] = $provider;
	$obj['webvideo-cache-file'] = $cache;
	save_object($obj);

	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	if ($ret['#error']) {
		return response('There was a problem embedding the link', 500);
	}
	// the upload shape: an array of html strings
	return response([$ret['#data']]);
}

register_service('webvideo.resolve', 'webvideo_resolve', ['auth'=>true]);
