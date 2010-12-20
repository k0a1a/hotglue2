<?php

/*
 *	common.inc.php
 *	Common hotglue infrastructure
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');


/**
 *	save a page in the cache
 *
 *	@param string $category cache category (e.g. 'page')
 *	@param string $name item name
 *	@param string $out content
 *	@return true if successful, false if not
 */
function cache_output($category, $name, $out)
{
	// check if cache dir exists
	$f = CONTENT_DIR.'/cache';
	if (!is_dir($f)) {
		$m = umask(0000);
		if (!@mkdir($f, 0777)) {
			umask($m);
			log_msg('error', 'common: cannot create cache directory '.quot($f));
			return false;
		}
		umask($m);
	}
	
	// check if category subdirectory exists
	$f .= '/'.$category;
	if (!is_dir($f)) {
		$m = umask(0000);
		if (!@mkdir($f, 0777)) {
			umask($m);
			log_msg('error', 'common: cannot create cache directory '.quot($f));
			return false;
		}
		umask($m);
	}
	
	// save file
	$f .= '/'.$name;
	$m = umask(0111);
	if (!file_put_contents($f, $out)) {
		umask($m);
		log_msg('error', 'common: error writing cache file '.quot($f));
		return false;
	}
	umask($m);
	
	log_msg('debug', 'common: cached '.$category.' '.quot($name));
	return true;
}


/**
 *	setup a default html page
 *
 *	see html.inc.php.
 *	@param bool $add_glue true for adding the glue code
 */
function default_html($add_glue)
{
	html_title(SITE_NAME);
	$favicon = FAVICON;
	if (!empty($favicon)) {
		if (is_url($favicon)) {
			html_favicon($favicon);
		} else {
			html_favicon(base_url().$favicon);
		}
	}
	if (USE_MIN_FILES) {
		html_add_css(base_url().'css/reset.min.css', 1);
	} else {
		html_add_css(base_url().'css/reset.css', 1);
	}
	// 2 can be used for third-party components
	html_add_css(base_url().'css/main.css', 3);
	if ($add_glue) {
		html_add_css(base_url().'css/glue.css', 4);
	}
	if ($add_glue) {
		$jquery = JQUERY;
		if (is_url($jquery)) {
			html_add_js($jquery, 1);
		} else {
			html_add_js(base_url().$jquery, 1);
		}
		// 2 can be used for third-party components
		if (USE_MIN_FILES) {
			html_add_js(base_url().'js/glue.min.js', 3);
		} else {
			html_add_js(base_url().'js/glue.js', 3);
		}
		html_add_js_var('$.glue.base_url', base_url());
		html_add_js_var('$.glue.conf.show_frontend_errors', SHOW_FRONTEND_ERRORS);
		html_add_js_var('$.glue.version', glue_version());
	}
}


/**
 *	remove a page from the cache
 *
 *	@param string $category cache category (e.g. 'page')
 *	@param string $name item name
 */
function drop_cache($category, $name)
{
	// TODO (later): make name optional
	$f = CONTENT_DIR.'/cache/'.$category.'/'.$name;
	if (@unlink($f)) {
		log_msg('debug', 'common: dropped cache of '.$category.' '.quot($name));
	}
}


/**
 *	return the glue version with api.version.patchlevel
 *
 *	@return array (with length three)
 */
function glue_version()
{
	$a = expl('.', HOTGLUE_VERSION);
	$ret = array(0, 0, 0);
	for ($i=0; $i < count($a); $i++) {
		$ret[$i] = $a[$i];
	}
	return $ret;
}


/**
 *	invoke a hook when an update was detected
 */
function handle_updates()
{
	$new = glue_version();
	$write_file = false;
	
	if (($s = @file_get_contents(CONTENT_DIR.'/version')) !== false) {
		// parse version
		$a = expl('.', $s);
		$old = array(0, 0, 0);
		for ($i=0; $i < count($a); $i++) {
			$old[$i] = $a[$i];
		}
		// check if an update happened
		if ($old != $new) {
			log_msg('info', 'common: detected hotglue update from version '.implode('.', $old).' to '.implode('.', $new));
			// hook
			invoke_hook('glue_update', array('old'=>$old, 'new'=>$new));
			$write_file = true;
		}
	} else {
		$write_file = true;
	}
	
	if ($write_file) {
		$m = umask(0111);
		@file_put_contents(CONTENT_DIR.'/version', implode('.', $new));
		umask($m);
	}
}


/**
 *	return a hotglue-themed error message to the client
 *
 *	the function does not return if successful.
 *	@param int $code error code
 *	@param bool $no_header don't output any header
 *	@return false if the error code is not supported yet
 */
function hotglue_error($code, $no_header = false)
{
	if (!$no_header) {
		// output header
		if (USE_HOTGLUE_ERRORS) {
			$header_only = true;
		} else {
			$header_only = false;
		}
		if (!http_error($code, $header_only)) {
			return false;
		}
	}
	
	// output informative message
	html_flush();
	default_html(false);
	html_add_css(base_url().'css/hotglue_error.css');
	$bdy = &body();
	elem_attr($bdy, 'id', 'hotglue_error');
	body_append(tab(1).'<div id="paper">'.nl());
	body_append(tab(2).'<div id="wrapper">'.nl());
	body_append(tab(3).'<div id="content">'.nl());
	body_append(tab(4).'<div id="left-nav">'.nl());
	body_append(tab(5).'<img src="'.htmlspecialchars(base_url(), ENT_COMPAT, 'UTF-8').'img/hotglue-logo.png" alt="logo">'.nl());
	body_append(tab(4).'</div>'.nl());
	body_append(tab(4).'<div id="main">'.nl());
	if ($code == 400) {
		body_append(tab(5).'<h1 id="error-title">ERROR 400, bad request!</h1>'.nl());
	} elseif ($code == 401) {
		body_append(tab(5).'<h1 id="error-title">Authorization required!</h1>'.nl());	
	} elseif ($code == 404) {
		body_append(tab(5).'<h1 id="error-title">ERROR 404, not found!</h1>'.nl());	
	} elseif ($code == 500) {
		body_append(tab(5).'<h1 id="error-title">ERROR 500, server fault!</h1>'.nl());	
	}
	body_append(tab(5).'<p>'.nl());
	if ($code == 400) {
		body_append(tab(6).'Something got screwed up...<br>'.nl());
		body_append(tab(6).'The page is sending a bad request to the server!'.nl());
	} elseif ($code == 401) {
		body_append(tab(6).'You need to be logged in in order to do this.<br>'.nl());
	} elseif ($code == 404) {
		body_append(tab(6).'It looks like you got lost in cyber-space...<br>'.nl());
		body_append(tab(6).'The page you are trying to reach does not exist!'.nl());
	} elseif ($code == 500) {
		body_append(tab(6).'Are we runnining out of fuel?!<br>'.nl());
		body_append(tab(6).'Something is causing serious server errors!'.nl());
	}
	body_append(tab(5).'</p>'.nl());
	body_append(tab(6).'<a href="'.htmlspecialchars(base_url(), ENT_COMPAT, 'UTF-8').'" id="home">take me home!</a>'.nl());
	body_append(tab(4).'</div>'.nl());
	body_append(tab(3).'</div>'.nl());
	body_append(tab(2).'</div>'.nl());
	body_append(tab(2).'<div style="position: absolute; left: 200px; top: -10px; z-index: 2;">'.nl());
	body_append(tab(3).'<img src="'.htmlspecialchars(base_url(), ENT_COMPAT, 'UTF-8').'img/hotglue-404.png" alt="404">'.nl());
	body_append(tab(2).'</div>'.nl());
	body_append(tab(1).'</div>'.nl());
	echo html_finalize();
	
	die();
}


/**
 *	check if the user is authenticated or not
 *
 *	@return true if authenticated, false if not
 */
function is_auth()
{
	if (AUTH_METHOD == 'none') {
		log_msg('debug', 'common: auth success (auth_method none)');
		return true;
	} elseif (AUTH_METHOD == 'basic') {
		if (isset($_SERVER['PHP_AUTH_USER']) && isset($_SERVER['PHP_AUTH_PW'])) {
			if ($_SERVER['PHP_AUTH_USER'] == AUTH_USER && $_SERVER['PHP_AUTH_PW'] == AUTH_PASSWORD) {
				log_msg('debug', 'common: auth success (auth_method basic)');
				return true;
			} else {
				log_msg('info', 'common: auth failure (auth_method basic)');
				return false;
			}
		} else {
			log_msg('debug', 'common: no auth data (auth_method basic)');
			return false;
		}
	} elseif (AUTH_METHOD == 'digest') {
		if (isset($_SERVER['PHP_AUTH_DIGEST'])) {
			log_msg('debug', 'common: auth digest '.var_dump_inl($_SERVER['PHP_AUTH_DIGEST']));
			$res = http_digest_check(array(AUTH_USER=>AUTH_PASSWORD), SITE_NAME);
			if ($res == 0) {
				log_msg('debug', 'common: auth success (auth_method digest)');
				return true;
			} else {
				log_msg('info', 'common: auth failure '.$res.' (auth_method digest)');
				return false;
			}
		}
	} else {
		log_msg('error', 'common: invalid or missing AUTH_METHOD config setting');
		return false;
	}
}


/**
 *	check if a page can be served from the cache
 *
 *	@param string $category cache category (e.g. 'page')
 *	@param string $name item name
 *	@param int $max_age serve from cache when younger than $max_age seconds
 *	@return bool true if the page can be served from cache, false if not
 */
function is_cached($category, $name, $max_age)
{
	$f = CONTENT_DIR.'/cache/'.$category.'/'.$name;
	if (!is_file($f)) {
		return false;
	}
	// check the file's age
	if (version_compare(PHP_VERSION, '5.3.0', '>=')) {
		clearstatcache(true, realpath($f));
	} else {
		clearstatcache();
	}
	$age = filemtime($f);
	if ($max_age < abs(time()-$age)) {
		return false;
	} else {
		return true;
	}
}


/**
 *	check if an object exists
 *
 *	@param $s object (e.g. page.rev.obj)
 *	@return bool
 */
function object_exists($s)
{
	$a = expl('.', $s);
	// we need not check if any of $a[..] is empty as the resulting string 
	// cannot be a file anyway
	if (2 < count($a) && is_file(CONTENT_DIR.'/'.str_replace('.', '/', $s))) {
		return true;
	} else {
		return false;
	}
}


/**
 *	turn short page names into canonical ones
 *
 *	if $s is not a page, the string is not altered.
 *	@param string &$s reference to the page name
 */
function page_canonical(&$s)
{
	$a = expl('.', $s);
	// assume head revision
	if (count($a) == 1) {
		$s .= '.head';
	}
}


/**
 *	check if a page exists
 *
 *	this function can also be used with object names (e.g. page.rev.obj).
 *	@param $s page
 *	@return bool
 */
function page_exists($s)
{
	$a = expl('.', $s);
	if (1 < count($a) && !empty($a[0]) && !empty($a[1]) && is_dir(CONTENT_DIR.'/'.$a[0].'/'.$a[1])) {
		return true;
	} else {
		return false;
	}
}


/**
 *	return the short pagename if possible, otherwise the long one
 *
 *	@param $s page
 *	@return string
 */
function page_short($s)
{
	$a = expl('.', $s);
	if (count($a) == 1) {
		return $s;
	} elseif (count($a) == 2 && $a[1] == 'head') {
		return $a[0];
	} elseif (count($a) == 2) {
		return $s;
	} else {
		return '';
	}
}


/**
 *	prompt user for authentication
 *
 *	@param bool $header_only only send header information
 *	this function does not return.
 */
function prompt_auth($header_only = false)
{
	if (AUTH_METHOD == 'none') {
		// nothing to do here
	} elseif (AUTH_METHOD == 'basic') {
		header('WWW-Authenticate: Basic realm="'.str_replace("\"", '', SITE_NAME).'"');
		header($_SERVER['SERVER_PROTOCOL'].' 401 Unauthorized');
	} elseif (AUTH_METHOD == 'digest') {
		http_digest_prompt(SITE_NAME);
	} else {
		log_msg('error', 'common: invalid or missing AUTH_METHOD config setting');
	}
	hotglue_error(401, true);
}


/**
 *	resolve common aliases which should be used in lieu of explicit page names
 *
 *	@param string $s input string
 *	@param string $name current object name (when applicable)
 *	@return string resolved string
 */
function resolve_aliases($s, $name = '')
{
	// base url
	$s = str_replace('$BASEURL$', base_url(), $s);
	$s = str_replace('$baseurl$', base_url(), $s);
	// version number
	$s = str_replace('$GLUE$', HOTGLUE_VERSION, $s);
	$s = str_replace('$glue$', HOTGLUE_VERSION, $s);
	if (!empty($name)) {
		// current object
		$s = str_replace('$OBJ$', $name, $s);
		$s = str_replace('$obj$', $name, $s);
		// current page
		$s = str_replace('$PAGE$', implode('.', array_slice(expl('.', $name), 0, 2)), $s);
		$s = str_replace('$page$', implode('.', array_slice(expl('.', $name), 0, 2)), $s);
		// pagename
		$s = str_replace('$PAGENAME$', array_shift(expl('.', $name)), $s);
		$s = str_replace('$pagename$', array_shift(expl('.', $name)), $s);
		// revision
		$s = str_replace('$REV$', array_shift(array_slice(expl('.', $name), 1, 1)), $s);
		$s = str_replace('$rev$', array_shift(array_slice(expl('.', $name), 1, 1)), $s);
	}
	return $s;
}


/**
 *	resolve relative urls in various page content to include the pages base 
 *	url
 *
 *	this function looks for href and src attributes.
 *	@param string $s input string
 *	@return string resolved string
 */
function resolve_relative_urls($s)
{
	$attrs = array('href', 'src');
	
	foreach ($attrs as $attr) {
		$start = 0;
		while (($start = strpos($s, $attr.'="', $start)) !== false) {
			if (($end = strpos($s, '"', $start+strlen($attr)+2)) !== false) {
				$link = substr($s, $start+strlen($attr)+2, $end-$start-strlen($attr)-2);
				if (!is_url($link) && substr($link, 0, 1) != '#') {
					// add base url for relative links that are not directed towards anchors
					log_msg('debug', 'common: resolving relative url '.quot($link));
					if (SHORT_URLS) {
						$link = base_url().$link;
					} else {
						$link = base_url().'?'.$link;
					}
				} else {
					log_msg('debug', 'common: not resolving url '.quot($link));
				}
				$start = $end+1;
			} else {
				break;
			}
		}
	}
	return $s;
}


/**
 *	output a cached page to the client
 *
 *	@param string $category cache category (e.g. 'page')
 *	@param string $name item name
 *	@return true if successful, false if not
 */
function serve_cached($category, $name)
{
	$f = CONTENT_DIR.'/cache/'.$category.'/'.$name;
	if (@readfile($f)) {
		log_msg('info', 'common: serving '.$category.' '.quot($name).' from cache');
		return true;
	} else {
		log_msg('error', 'common: cannot serve '.$category.' '.quot($name).' from cache');
		return false;
	}
}


/**
 *	return the starting page
 *
 *	@return string
 */
function startpage()
{
	// read the starting page information from the content dir
	// or fall back to the one defined in the configuration
	$s = @file_get_contents(CONTENT_DIR.'/startpage');
	if ($s !== false && 0 < strlen($s)) {
		return $s;
	} else {
		$s = DEFAULT_PAGE;
		page_canonical($s);
		return $s;
	}
}


/**
 *	move an uploaded file to the shared directory of a page
 *
 *	this function reuses existing files when possible.
 *	@param string $fn filename of newly uploaded file (most likely in /tmp)
 *	@param string $page page or pagename
 *	@param string $orig_fn the original filename on the client machine (optional)
 *	@param bool &$existed set to true if the filename returned did already exist 
 *	before
 *	@return filename inside the shared directory or false in case of error
 */
function upload_file($fn, $page, $orig_fn = '', &$existed = false)
{
	// default to the temporary filename
	if ($orig_fn == '') {
		$orig_fn = $fn;
	}
	
	$a = expl('.', $page);
	if (count($a) < 1 || !is_dir(CONTENT_DIR.'/'.$a[0])) {
		log_msg('error', 'common: page '.quot($page).' does not exist, cannot move uploaded file');
		// not sure if we ought to remove the file in /tmp here (probably not)
		return false;
	}
	
	// create shared directory if it doesn't exist yet
	$d = CONTENT_DIR.'/'.$a[0].'/shared';
	if (!is_dir($d)) {
		$m = umask(0000);
		if (!@mkdir($d, 0777)) {
			umask($m);
			log_msg('error', 'common: cannot create shared directory '.quot($d).', cannot move uploaded file');
			// not sure if we ought to remove the file in /tmp here (probably not)
			return false;
		}
		umask($m);
	}
	
	// check if file is already in shared directory
	if (($f = dir_has_same_file($d, $fn, $orig_fn)) !== false) {
		log_msg('info', 'common: reusing file '.quot($f).' instead of newly uploaded file as they don\'t differ');
		@unlink($fn);
		$existed = true;
		return $f;
	} else {
		// at least give it a unique name
		$f = unique_filename($d, basename($orig_fn));
		$m = umask(0111);
		if (!@move_uploaded_file($fn, $d.'/'.$f)) {
			umask($m);
			log_msg('error', 'common: error moving uploaded file to '.quot($d.'/'.$f));
			// not sure if we ought to remove the file in /tmp here (probably not)
			return false;
		} else {
			umask($m);
			log_msg('info', 'common: moved uploaded file to '.quot($d.'/'.$f));
			$existed = false;
			return $f;
		}
	}
}


/**
 *	check whether the string is a valid, canonical page name
 *
 *	the function does not check if the page exists or not.
 *	@param string $s string to check
 *	@return bool
 */
function valid_pagename($s)
{
	$a = expl('.', $s);
	if (count($a) != 2) {
		return false;
	} elseif (empty($a[0]) || empty($a[1])) {
		return false;
	} elseif (in_array($a[0], array('cache', 'shared'))) {
		// reserved page names
		// TODO (later): we're missing the log file here
		// TODO (later): we're also missing $arg0 of controllers here
		// TODO (later): we're missing all the files directly in the 
		// content directory here (this might not be an issue on all 
		// os)
		return false;
	} elseif (in_array($a[1], array('shared'))) {
		// reserved revision names
		return false;
	} elseif (is_file($a[0]) || is_dir($a[0]) || is_link($a[0])) {
		// same name as existing file names in the root directory
		// this is an issue when using the RewriteRule
		return false;
	} else {
		return true;
	}
}


?>
