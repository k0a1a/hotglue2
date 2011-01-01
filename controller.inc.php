<?php

/*
 *	controller.inc.php
 *	Generic dispatcher code mixed with some hotglue-specific controllers
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
require_once('html.inc.php');
require_once('log.inc.php');
require_once('modules.inc.php');
// module glue gets loaded on demand
require_once('util.inc.php');

if (!isset($controllers)) {
	$controllers = array();
}



/**
 *	show a site where authenticated users can create new pages
 */
function controller_create_page($args)
{
	page_canonical($args[0][0]);
	$page = $args[0][0];
	if (page_exists($page)) {
		log_msg('debug', 'controller_create_page: page '.quot($page).'already exists, invoking controller_edit');
		controller_edit($args);
		return;
	}
	
	load_modules('glue');
	default_html(true);
	html_add_css(base_url().'css/hotglue_error.css');
	if (USE_MIN_FILES) {
		html_add_js(base_url().'js/create_page.min.js');
	} else {
		html_add_js(base_url().'js/create_page.js');
	}
	html_add_js_var('$.glue.page', $page);
	$bdy = &body();
	elem_attr($bdy, 'id', 'create_page');
	body_append(tab(1).'<div id="paper">'.nl());
	body_append(tab(2).'<div id="wrapper">'.nl());
	body_append(tab(3).'<div id="content">'.nl());
	body_append(tab(4).'<div id="left-nav">'.nl());
	body_append(tab(5).'<img src="'.htmlspecialchars(base_url(), ENT_COMPAT, 'UTF-8').'img/hotglue-logo.png" alt="logo">'.nl());
	body_append(tab(4).'</div>'.nl());
	body_append(tab(4).'<div id="main">'.nl());
	body_append(tab(5).'<h1 id="error-title">Page does not exist yet!</h1>'.nl());
	body_append(tab(5).'<p>'.nl());
	body_append(tab(6).'This page does not exist yet!<br>'.nl());
	body_append(tab(6).'Would you like to create the page?'.nl());
	body_append(tab(5).'</p>'.nl());
	body_append(tab(5).'<form><input id="create_page_btn" type="button" value="Create it!"></form>'.nl());
	body_append(tab(5).'<p>'.nl());
	body_append(tab(6).'<a href="'.htmlspecialchars(base_url(), ENT_COMPAT, 'UTF-8').'" id="home">take me home!</a>'.nl());
	body_append(tab(5).'</p>'.nl());
	body_append(tab(4).'</div>'.nl());
	body_append(tab(3).'</div>'.nl());
	body_append(tab(2).'</div>'.nl());
	body_append(tab(2).'<div style="position: absolute; left: 200px; top: -10px; z-index: 2;">'.nl());
	body_append(tab(3).'<img src="'.htmlspecialchars(base_url(), ENT_COMPAT, 'UTF-8').'img/hotglue-404.png" alt="404">'.nl());
	body_append(tab(2).'</div>'.nl());
	body_append(tab(1).'</div>'.nl());
	echo html_finalize();
}

register_controller('*', 'create_page', 'controller_create_page', array('auth'=>true));


/**
 *	show a site to edit pages
 */
function controller_edit($args)
{
	handle_updates();
	
	// most of these checks are only necessary if the client calls 
	// page/edit directly
	page_canonical($args[0][0]);
	$page = $args[0][0];
	if (!page_exists($page)) {
		log_msg('debug', 'controller_edit: page '.quot($page).' does not exist, invoking controller_create_page');
		controller_create_page($args);
		return;
	}
	
	// create page on the fly
	load_modules('glue');
	default_html(true);
	html_add_js_var('$.glue.page', $page);
	html_add_css(base_url().'css/farbtastic.css', 2);
	html_add_css(base_url().'css/edit.css', 5);
	if (USE_MIN_FILES) {
		html_add_js(base_url().'js/jquery-ui-1.8.6.custom.min.js', 2);
	} else {
		html_add_js(base_url().'js/jquery-ui-1.8.6.custom.js', 2);
	}
	if (USE_MIN_FILES) {
		html_add_js(base_url().'js/farbtastic.min.js', 2);
	} else {
		html_add_js(base_url().'js/farbtastic.js', 2);
	}
	if (USE_MIN_FILES) {
		html_add_js(base_url().'js/jquery.xcolor-1.2.1.min.js', 2);
	} else {
		html_add_js(base_url().'js/jquery.xcolor-1.2.1.js', 2);
	}
	if (USE_MIN_FILES) {
		html_add_js(base_url().'js/edit.min.js', 4);
	} else {
		html_add_js(base_url().'js/edit.js', 4);
	}
	render_page(array('page'=>$page, 'edit'=>true));
	echo html_finalize();
	
	log_msg('debug', 'controller_edit: invoking check_auto_snapshot');
	check_auto_snapshot(array('page'=>$page));
}

register_controller('*', 'edit', 'controller_edit', array('auth'=>true));


/**
 *	this is the default (fallback) controller
 *
 *	it mainly invokes other controllers or sends error messages
 */
function controller_default($args)
{
	if (empty($args[0][0]) && empty($args[0][1])) {
		// take the default page
		$args[0][0] = startpage();
		log_msg('debug', 'controller_default: using the default page');
	} elseif ($args[0][0] == 'edit' && empty($args[0][1])) {
		// quirk: edit the default page
		$args[0][0] = startpage();
		$args[0][1] = 'edit';
		log_msg('debug', 'controller_default: using the default page');
		invoke_controller($args);
		return;
	}
	
	page_canonical($args[0][0]);
	$obj = expl('.', $args[0][0]);
	if (count($obj) == 2) {
		// page requested
		if (page_exists($args[0][0])) {
			if (DEFAULT_TO_EDIT && is_auth()) {
				log_msg('debug', 'controller_default: invoking controller_edit');
				controller_edit($args);
			} else {
				log_msg('debug', 'controller_default: invoking controller_show');
				controller_show($args);
			}
		} elseif (ALWAYS_PROMPT_CREATE_PAGE || is_auth()) {
			log_msg('debug', 'controller_default: invoking controller_create_page');
			controller_create_page($args);
		} else {
			log_msg('info', 'controller_default: page '.quot($args[0][0]).' not found, serving 404');
			hotglue_error(404);
		}
	} else {
		// possibly object requested
		if (object_exists($args[0][0])) {
			// try to serve upload
			if (isset($args['download']) && $args['download']) {
				// prompt file save dialog on client
				$dl = true;
			} else {
				$dl = false;
			}
			log_msg('debug', 'controller_default: invoking serve_resource');
			if (!serve_resource($args[0][0], $dl)) {
				log_msg('info', 'controller_default: object '.quot($args[0][0]).' has no associated resource, serving 404');
				hotglue_error(404);
			}
		} else {
			log_msg('info', 'controller_default: object '.quot($args[0][0]).' not found, serving 404');
			hotglue_error(404);
		}
	}
}

register_controller('*', '*', 'controller_default');


/**
 *	promt the user to authenticate
 *
 *	this might be helpful as other controller's authentication seem to be only 
 *	valid for the respective directory. (e.g. having privileges in '/foo/edit' 
 *	does not seem to have an effect on the parent directory or any other sibling 
 *	directory.
 */
function controller_login($args)
{
	if (!is_auth()) {
		prompt_auth();
	} else {
		// redirect
		if (SHORT_URLS) {
			header('Location: '.base_url().'pages');		
		} else {
			header('Location: '.base_url().'?pages');
		}
		die();
	}
}

register_controller('login', '', 'controller_login');


/**
 *	show a page
 */
function controller_show($args)
{
	// most of these checks are only necessary if the client calls 
	// page/show directly
	page_canonical($args[0][0]);
	$page = $args[0][0];
	if (!page_exists($page)) {
		log_msg('info', 'controller_show: page '.quot($page).' not found, serving 404');
		hotglue_error(404);
	}
	
	// serve from page if possible
	if (0 < CACHE_TIME && is_cached('page', $page, CACHE_TIME)) {
		serve_cached('page', $page);
		die();
	}
	
	// otherwise create page on the fly
	load_modules('glue');
	default_html(false);
	$cache_page = true;
	render_page(array('page'=>$page, 'edit'=>false));
	// the $cache_page parameter is set by the html_finalize()
	$html = html_finalize($cache_page);
	echo $html;
	
	// and cache it
	if (0 < CACHE_TIME && $cache_page) {
		cache_output('page', $page, $html);
	}
}

register_controller('*', 'show_page', 'controller_show');



/**
 *	invoke a controller based on the query arguments given
 *
 *	this function does not return in case of an error.
 *	@param array $args query-arguments array
 *	@return mixed return value of controller that was called
 */
function invoke_controller($args)
{
	global $controllers;
	
	// change query-arguments so that we always have a arg0 and arg1
	if (!isset($args[0])) {
		$args[0] = array('', '');
	} elseif (is_string($args[0])) {
		$args[0] = array($args[0], '');
	}
	
	// load all modules
	// TODO (later): fastpath for serving cached pages or files (the latter one 
	// is only doable when we store in the object file which module to load)
	load_modules();
	
	$match = false;
	if (isset($controllers[$args[0][0].'-'.$args[0][1]])) {
		// foo/bar would match controller for "foo/bar"
		$match = $controllers[$args[0][0].'-'.$args[0][1]];
		$reason = $args[0][0].'/'.$args[0][1];
	} elseif (isset($controllers[$args[0][0].'-*'])) {
		// foo/bar would match "foo/*"
		$match = $controllers[$args[0][0].'-*'];
		$reason = $args[0][0].'/*';
	} elseif (isset($controllers['*-'.$args[0][1]])) {
		// foo/bar would match "*/bar"
		$match = $controllers['*-'.$args[0][1]];
		$reason = '*/'.$args[0][1];
	} elseif (isset($controllers['*-*'])) {
		// foo/bar would match "*/*"
		$match = $controllers['*-*'];
		$reason = '*/*';
	}
	
	if ($match !== false) {
		// check authentication for those controllers that require it
		if (isset($match['auth']) && $match['auth']) {
			if (!is_auth()) {
				prompt_auth();
			}
			
			// also check the referer to prevent against cross site request 
			// forgery (xsrf)
			// this is not really optimal, since proxies can filter the referer 
			// header, but as a first step..
			if (!empty($_SERVER['HTTP_REFERER'])) {
				$bu = base_url();
				if (substr($_SERVER['HTTP_REFERER'], 0, strlen($bu)) != $bu) {
					log_msg('warn', 'controller: possible xsrf detected, referer is '.quot($_SERVER['HTTP_REFERER']).', arguments '.var_dump_inl($args));
					hotglue_error(400);
				}
			}
		}
		
		log_msg('info', 'controller: invoking controller '.quot($reason).' => '.$match['func']);
		return $match['func']($args);
	} else {
		// normally we won't reach this as some default (*/*) controller will 
		// be present
		log_msg('warn', 'controller: no match for '.quot($args[0][0].'/'.$args[0][1]));
		hotglue_error(400);
	}
}


/**
 *	parse the QUERY_STRING server variable
 *
 *	@return array query-arguments array (key/value and numeric keys)
 */
function parse_query_string()
{
	// QUERY_STRING per se seems not to be affected by magic quotes, only 
	// the derived $_GET, $_POST etc
	$q = $_SERVER['QUERY_STRING'];
	$args = array();
	$num_args = array();
	// strip a tailing slash
	if (substr($q, -1) == '/') {
		$q = substr($q, 0, -1);
	}
	// explode query string
	// this could also be done with parse_str() instead
	$temp = expl('&', $q);
	foreach ($temp as $a) {
		if (($p = strpos($a, '=')) !== false) {
			$args[urldecode(substr($a, 0, $p))] = urldecode(substr($a, $p+1));
		} else {
			$num_args[] = urldecode($a);
		}
	}
	// merge $num_args into $args
	for ($i=0; $i < count($num_args); $i++) {
		// explode slashes in arguments without a key
		if (($p = strpos($num_args[$i], '/')) !== false) {
			$args[$i] = expl('/', $num_args[$i]);
		} else {
			$args[$i] = $num_args[$i];
		}
	}
	return $args;
}


/**
 *	register a controller
 *
 *	@param string $arg0 first argument of query to match (* for wildcard)
 *	@param string $arg1 second argument of query to match (* for widcard)
 *	@param string $func function name
 *	@param array $args optional arguments
 */
function register_controller($arg0, $arg1, $func, $args = array())
{
	global $controllers;
	$controllers[$arg0.'-'.$arg1] = array_merge($args, array('func'=>$func));
	log_msg('debug', 'controller: registered controller '.quot($arg0.'/'.$arg1).' => '.$func);
}


/**
 *	serve a resource associated with an object
 *
 *	the function might not return (e.g. when a module calls serve_file()).
 *	@param string $s object (e.g. page.rev.obj)
 *	@param bool $dl download file
 *	@return bool
 */
function serve_resource($s, $dl)
{
	load_modules('glue');
	
	// resolve symlinks
	$ret = object_get_symlink(array('name'=>$s));
	if ($ret['#error'] == false && $ret['#data'] !== false) {
		log_msg('debug', 'controller: resolved resource '.quot($s).' into '.quot($ret['#data']));
		$s = $ret['#data'];
	}
	
	$obj = load_object(array('name'=>$s));
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	
	$ret = invoke_hook_while('serve_resource', false, array('obj'=>$obj, 'dl'=>$dl));
	// this is probably not needed as the module will most likely call 
	// serve_file() on success, which does not return
	foreach ($ret as $key=>$val) {
		if ($val !== false) {
			return true;
		}
	}
	return false;
}

register_hook('serve_resource', 'serve resources associated with objects');


?>