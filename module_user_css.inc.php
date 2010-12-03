<?php


@require_once('config.inc.php');
require_once('common.inc.php');
require_once('controller.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');
require_once('util.inc.php');


/**
 *	controller that shows a textarea for editing either a page's or the global 
 *	user-defined css file
 */
function controller_user_css_stylesheet($args)
{
	if ($args[0][1] == 'stylesheet') {
		// changing page stylesheet
		$page = $args[0][0];
		page_canonical($page);
		if (!page_exists($page)) {
			http_404();
		}
	} else {
		// changing global stylesheet
		$page = false;
	}
	
	default_html(true);
	html_add_js_var('$.glue.page', $page);
	html_add_css(base_url().'modules/user_css/user_css.css');
	html_add_js(base_url().'modules/user_css/user_css.js');
	$bdy = &body();
	elem_attr($bdy, 'id', 'user_css');
	if ($page === false) {
		body_append('<h1>Global stylesheet</h1>'.nl());
		// try to load css
		$css = @file_get_contents(CONTENT_DIR.'/usercss');
		if ($css === false) {
			$css = '';
		}
	} else {
		body_append('<h1>'.htmlspecialchars($page, ENT_NOQUOTES, 'UTF-8').' stylesheet</h1>'.nl());
		load_modules('glue');
		$obj = load_object(array('name'=>$page.'.usercss'));
		if ($obj['#error']) {
			$css = '';
		} else {
			$css = $obj['#data']['content'];
		}
	}
	// encoding to html must come before the replacement below
	$css = htmlspecialchars($css, ENT_NOQUOTES, 'UTF-8');
	// replace newline characters by an entity to prevent render_object() 
	// from adding some indentation
	$css = str_replace("\r\n", '&#10;', $css);
	$css = str_replace("\n", '&#10;', $css);
	// why not replace tabs as well why we are at it
	$css = str_replace("\t", '&#09;', $css);
	body_append('<textarea id="user_css_text" placeholder="enter css code here">'.$css.'</textarea>'.nl());
	body_append('<br>'.nl());
	body_append('<input id="user_css_save" type="button" value="save">'.nl());
	echo html_finalize();
}

register_controller('stylesheet', '', 'controller_user_css_stylesheet', array('auth'=>true));
register_controller('*', 'stylesheet', 'controller_user_css_stylesheet', array('auth'=>true));


/**
 *	controller that serves either a page's or the global user-defined css file
 */
function controller_user_css_user_css($args)
{
	header('Content-type: text/css; charset=UTF-8');
	if (empty($args[0][1])) {
		// serve global stylesheet
		@readfile(CONTENT_DIR.'/usercss');
	} else {
		load_modules('glue');
		$obj = load_object(array('name'=>$args[0][1].'.usercss'));
		if (!$obj['#error'] && isset($obj['#data']['content'])) {
			echo $obj['#data']['content'];
		}
	}
}

register_controller('user_css', '*', 'controller_user_css_user_css');


function user_css_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'usercss') {
		return false;
	}
	
	if (!empty($obj['content'])) {
		if (SHORT_URLS) {
			html_add_css(base_url().'user_css/'.implode('.', array_slice(expl('.', $obj['name']), 0, 2)), 9);
		} else {
			html_add_css(base_url().'?user_css/'.implode('.', array_slice(expl('.', $obj['name']), 0, 2)), 9);
		}
	}
	return '';
}


function user_css_render_page_early($args)
{
	// include the global usercss if it exists
	if (@is_file(CONTENT_DIR.'/usercss')) {
		if (SHORT_URLS) {
			html_add_css(base_url().'user_css', 8);
		} else {
			html_add_css(base_url().'?user_css', 8);
		}
	}
}


/**
 *	set the user-defined css file
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev) or false the global css
 *		key 'css' is the content of the css file
 *	@return array response
 *		true if successful
 */
function user_css_set_css($args)
{
	if (!isset($args['page']) || ($args['page'] !== false && !page_exists($args['page']))) {
		return response('Required argument "page" missing or invalid', 400);
	}
	if (!isset($args['css'])) {
		return response('Required argument "css" missing', 400);
	}
	
	if ($args['page'] === false) {
		if (empty($args['css'])) {
			// empty stylesheet
			@unlink(CONTENT_DIR.'/usercss');
			return response(true);
		} else {
			$m = umask(0111);
			if (!@file_put_contents(CONTENT_DIR.'/usercss', $args['css'])) {
				umask($m);
				return response('Error saving stylesheet', 500);
			} else {
				umask($m);
				return response(true);
			}
		}
	} else {
		load_modules('glue');
		return update_object(array('name'=>$args['page'].'.usercss', 'type'=>'usercss', 'module'=>'user_css', 'content'=>$args['css']));
	}
}

register_service('user_css.set_css', 'user_css_set_css', array('auth'=>true));


?>