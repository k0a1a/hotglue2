<?php

/*
 *	module_user_code.inc.php
 *	Module for setting user-defined <head> and <body> code
 *	on per-site and per-page basis.
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
require_once('controller.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');
require_once('util.inc.php');


/**
 *	controller that shows a textarea for editing either a page's or the global 
 *	user-defined code files
 */
function controller_user_code_stylesheet($args)
{
	if ($args[0][1] == 'code') {
		// changing page code
		$page = $args[0][0];
		page_canonical($page);
		if (!page_exists($page)) {
			hotglue_error(404);
		}
	} else {
		// changing global code
		$page = false;
	}
	
	default_html(true);
	html_add_js_var('$.glue.page', $page);
	html_add_css(base_url().'modules/user_code/user_code.css');
	if (USE_MIN_FILES) {
		html_add_js(base_url().'modules/user_code/user_code.min.js');
	} else {
		html_add_js(base_url().'modules/user_code/user_code.js');
	}
	$bdy = &body();
	// create array with names of code elements
	$code = array('head'=>'','body'=>'');
	elem_attr($bdy, 'id', 'user_code');
	if ($page === false) {
		body_append('<h1>Global code</h1>'.nl());
		// try to load code
		foreach ($code as $x => $v) {
			$code[$x] = @file_get_contents(CONTENT_DIR.'/user'.$x);
			if ($code[$x] === false) {
				$code[$x] = '';
			}
		}
	} else {
		body_append('<h1>"'.htmlspecialchars(substr($page, 0, strpos($page, '.')), ENT_NOQUOTES, 'UTF-8').'" page code</h1>'.nl());
		load_modules('glue');
		foreach ($code as $x => $v) {
			$obj = load_object(array('name'=>$page.'.user'.$x));
			if ($obj['#error']) {
				$code[$x] = '';
			} else {
				$code[$x] = $obj['#data']['content'];
			}
		}
	}
	foreach ($code as $k => $v) {
		// encoding to html must come before the replacement below
		$v = htmlspecialchars($v, ENT_NOQUOTES, 'UTF-8');
		// replace newline characters by an entity to prevent render_object() 
		// from adding some indentation
		$v = str_replace("\r\n", '&#10;', $v);
		$v = str_replace("\n", '&#10;', $v);
		// why not replace tabs as well why we are at it
		$v = str_replace("\t", '&#09;', $v);
		$code[$k] = $v;
	}
	body_append('<div id=\'text\'>add your custom code to &lt;head&gt; and &lt;body&gt; sections of this '.($page ? 'page.' : 'site.').nl());
	body_append('<br>'.nl());
	body_append('be cautious - errors in the code below may render the whole '.($page ? 'page' : 'site').' unusable.</div>'.nl());
	body_append('<br>'.nl());
	body_append('<div id=\'fake_tags\'>&lt;head&gt;</div>'.nl());
	body_append('<textarea id="user_head_text" placeholder="enter code here">'.$code['head'].'</textarea>'.nl());
	body_append('<br>'.nl());
	body_append('<div id=\'fake_tags\'>&lt;/head&gt;<br>'.nl());
	body_append('&lt;body&gt;</div>'.nl());
	body_append('<textarea id="user_body_text" placeholder="enter code here">'.$code['body'].'</textarea>'.nl());
	body_append('<div id=\'fake_tags\'>&lt;/body&gt;</div><br>'.nl());
	body_append('<input id="user_code_save" type="button" value="save">'.nl());
	body_append('<br>'.nl());
	body_append('<br>'.nl());
	echo html_finalize();
}

register_controller('code', '', 'controller_user_code_stylesheet', array('auth'=>true));
register_controller('*', 'code', 'controller_user_code_stylesheet', array('auth'=>true));


function user_code_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || !($obj['type'] == 'userhead' or $obj['type'] == 'userbody')) {
		return false;
	}
	if (!empty($obj['content'])) {
		if ($obj['type'] == 'userhead') {
			html_add_head_inline($obj['content'], 5);
		} else {
			html_add_body_inline($obj['content'], 5);
		}
	}
	return '';
}


function user_code_render_page_early($args)
{
	// include the global usercode if it exists
	foreach (array('head','body') as $x) {
		if (@is_file(CONTENT_DIR.'/user'.$x)) {
			$func = 'html_add_'.$x.'_inline'; 
			$func(@file_get_contents(CONTENT_DIR.'/user'.$x), 5);
		}
	}
}


/**
 *	set the user-defined code files
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev) or false the global code
 *		key 'head' is the content of the head file
 *		key 'body' is the content of the body file
 *	@return array response
 *		true if successful
 */
function user_code_set_code($args)
{
	if (!isset($args['page']) || ($args['page'] !== false && !page_exists($args['page']))) {
		return response('Required argument "page" missing or invalid', 400);
	}
	if (!isset($args['head'])) {
		return response('Required argument "head" missing', 400);
	}
	if (!isset($args['body'])) {
		return response('Required argument "body" missing', 400);
	}

	if ($args['page'] === false) {
		drop_cache('page');
		foreach (array('head','body') as $x) {
			if (empty($args[$x])) {
				@unlink(CONTENT_DIR.'/user'.$x);
			} else {
				$m = umask(0111);
				if (!@file_put_contents(CONTENT_DIR.'/user'.$x, $args[$x])) {
					umask($m);
					return response('Error saving user '.$x, 500);
				} else {
					umask($m);
				}
			}
		}
		return response(true);
	} else {
		drop_cache('page', $args['page']);
		load_modules('glue');
		foreach (array('head','body') as $x) {
			if (empty($args[$x])) {
				delete_object(array('name'=>$args['page'].'.user'.$x));

			} else {
				update_object(array('name'=>$args['page'].'.user'.$x, 'type'=>'user'.$x, 'module'=>'user_code', 'content'=>$args[$x]));
			}
		}
		return response(true);
	}
}

register_service('user_code.set_code', 'user_code_set_code', array('auth'=>true));
