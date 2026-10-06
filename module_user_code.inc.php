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
	$code = ['head'=>'','body'=>''];
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
			$obj = load_object(['name'=>$page.'.user'.$x]);
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
	echo html_finalize();
}

register_controller('code', '', 'controller_user_code_stylesheet', ['auth'=>true]);
register_controller('*', 'code', 'controller_user_code_stylesheet', ['auth'=>true]);


function user_code_render_object($args)
{
	$obj = $args['obj'];
	if (isset($obj['type']) && $obj['type'] == 'objcode') {
		return user_code_render_object_code($obj, !empty($args['edit']));
	}
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
	foreach (['head','body'] as $x) {
		if (@is_file(CONTENT_DIR.'/user'.$x)) {
			$func = 'html_add_'.$x.'_inline'; 
			$func(@file_get_contents(CONTENT_DIR.'/user'.$x), 5);
		}
	}
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/user_code/user_code-edit.min.js');
		} else {
			html_add_js(base_url().'modules/user_code/user_code-edit.js');
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
		foreach (['head','body'] as $x) {
			if (empty($args[$x])) {
				@unlink(CONTENT_DIR.'/user'.$x);
			} else {
				$m = umask(0111);
				if (!@file_put_contents(CONTENT_DIR.'/user'.$x, $args[$x])) {
					umask($m);
					log_user_issue('save', 'could not save user '.$x);
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
		foreach (['head','body'] as $x) {
			if (empty($args[$x])) {
				delete_object(['name'=>$args['page'].'.user'.$x]);

			} else {
				update_object(['name'=>$args['page'].'.user'.$x, 'type'=>'user'.$x, 'module'=>'user_code', 'content'=>$args[$x]]);
			}
		}
		return response(true);
	}
}

register_service('user_code.set_code', 'user_code_set_code', ['auth'=>true]);


/*
 *	Per-object code.
 *
 *	An object can carry its own <style> and <script> blocks, written in the
 *	object's "code" panel. They are stored in a separate object of their own
 *	next to it - <page>.<rev>.code<id> for the object <page>.<rev>.<id>, type
 *	'objcode', the author's raw input as its content - and turned into
 *	scoped css and a wrapped script when the page is rendered. The object file
 *	itself is never touched, so code can neither corrupt it nor travel with it
 *	by accident. The code object's name is derived from the object's, which is
 *	what makes it follow the page through a rename or a copy for free, and its
 *	target is read back from the name rather than stored.
 */

// the most raw input one object may carry; anything bigger is not a snippet
define('USER_CODE_OBJECT_MAX', 65536);


/**
 *	the name of the code object belonging to an object
 *
 *	@param string $name name of an object (page.rev.id)
 *	@return string|bool the code object's name, or false if the object cannot
 *		carry code (only the numbered objects can: not the page pseudo-object,
 *		not userhead/userbody, and not a code object itself)
 */
function user_code_object_code_name($name)
{
	$a = expl('.', $name);
	if (count($a) != 3 || !preg_match('/^[0-9]+$/', $a[2])) {
		return false;
	}
	return $a[0].'.'.$a[1].'.code'.$a[2];
}


/**
 *	the name of the object a code object belongs to
 *
 *	@param string $name name of a code object (page.rev.code<id>)
 *	@return string|bool the object's name, or false if it is not one
 */
function user_code_object_of_code($name)
{
	$a = expl('.', $name);
	if (count($a) != 3 || !preg_match('/^code([0-9]+)$/', $a[2], $m)) {
		return false;
	}
	return $a[0].'.'.$a[1].'.'.$m[1];
}


/**
 *	split the raw input into its blocks
 *
 *	@param string $raw the author's input
 *	@return array 'style' and 'script', each an array of block contents
 */
function user_code_blocks($raw)
{
	$ret = ['style'=>[], 'script'=>[]];
	foreach (['style', 'script'] as $tag) {
		if (preg_match_all('#<'.$tag.'\b[^>]*>(.*?)</'.$tag.'\s*>#is', $raw, $m)) {
			$ret[$tag] = $m[1];
		}
	}
	return $ret;
}


/**
 *	a css selector that matches exactly one element by its id
 *
 *	The ids in hotglue are dotted (page.rev.object) and start with whatever
 *	the page is called, so they cannot go after a # as they are: every
 *	character that is not a letter, digit, - or _ is escaped, and a leading
 *	digit as its code point. It is still an id selector, with an id selector's
 *	weight.
 *
 *	@param string $id element id
 *	@return string selector
 */
function user_code_id_selector($id)
{
	$out = '';
	$len = strlen($id);
	for ($i = 0; $i < $len; $i++) {
		$c = $id[$i];
		if (ctype_alnum($c) || $c == '-' || $c == '_') {
			if ($i == 0 && ctype_digit($c)) {
				$out .= '\\3'.$c.' ';
			} else {
				$out .= $c;
			}
		} else {
			$out .= '\\'.$c;
		}
	}
	return '#'.$out;
}


/**
 *	split a string at the top-level occurrences of one character
 *
 *	Anything inside quotes, (), [] is left alone, so a selector like
 *	a:not(.x, .y) is one piece.
 *
 *	@param string $str the string
 *	@param string $sep a single character
 *	@return array pieces
 */
function user_code_css_split($str, $sep)
{
	$out = [];
	$cur = '';
	$depth = 0;
	$q = '';
	$len = strlen($str);
	for ($i = 0; $i < $len; $i++) {
		$c = $str[$i];
		if ($q !== '') {
			$cur .= $c;
			if ($c == '\\' && $i + 1 < $len) {
				$cur .= $str[++$i];
			} elseif ($c == $q) {
				$q = '';
			}
			continue;
		}
		if ($c == '"' || $c == "'") {
			$q = $c;
		} elseif ($c == '(' || $c == '[') {
			$depth++;
		} elseif ($c == ')' || $c == ']') {
			$depth = max(0, $depth - 1);
		} elseif ($c == $sep && $depth == 0) {
			$out[] = $cur;
			$cur = '';
			continue;
		}
		$cur .= $c;
	}
	$out[] = $cur;
	return $out;
}


/**
 *	confine a stylesheet to one element
 *
 *	What it covers, and the limits, because this is a prefixer and not a css
 *	parser:
 *	- a rule gets the scope in front of each of its selectors: .a, .b becomes
 *	  #id .a, #id .b. A selector that starts with : or & belongs to the
 *	  element itself (:hover -> #id:hover, &.on -> #id.on)
 *	- & on its own is the element: & { color: red; }. Declarations written
 *	  with no selector at all are dropped - there is nothing to say what they
 *	  are for - and the panel warns about them
 *	- @media, @supports, @layer and @container are scoped inside
 *	- @keyframes, @font-face, @property, @page, @import, @charset and the like
 *	  pass through untouched. Keyframe names are global to the page.
 *	- nested rules (css nesting) are not rewritten, and a selector that
 *	  reaches outside the element (html, body) simply matches nothing
 *
 *	@param string $css the author's stylesheet
 *	@param string $scope selector of the element (see user_code_id_selector())
 *	@return string the scoped stylesheet
 */
function user_code_scope_css($css, $scope)
{
	// comments go first: a brace or a comma in one must not be read as css
	$css = preg_replace('#/\*.*?\*/#s', '', $css);
	$out = '';
	$len = strlen($css);
	$i = 0;
	while ($i < $len) {
		// read up to the { or ; that ends the next statement, outside quotes
		// and parentheses
		$j = $i;
		$q = '';
		$paren = 0;
		while ($j < $len) {
			$c = $css[$j];
			if ($q !== '') {
				if ($c == '\\') {
					$j++;
				} elseif ($c == $q) {
					$q = '';
				}
			} elseif ($c == '"' || $c == "'") {
				$q = $c;
			} elseif ($c == '(') {
				$paren++;
			} elseif ($c == ')') {
				$paren = max(0, $paren - 1);
			} elseif (($c == '{' || $c == ';') && $paren == 0) {
				break;
			}
			$j++;
		}
		$head = trim(substr($css, $i, $j - $i));
		if ($j >= $len || $css[$j] == ';') {
			// no block: an at-rule like @import passes through; a declaration
			// with no selector is dropped
			if ($head !== '' && $head[0] == '@') {
				$out .= $head.';';
			}
			$i = $j + 1;
			continue;
		}
		// a block: find the brace that closes it
		$depth = 1;
		$k = $j + 1;
		$q = '';
		while ($k < $len && 0 < $depth) {
			$c = $css[$k];
			if ($q !== '') {
				if ($c == '\\') {
					$k++;
				} elseif ($c == $q) {
					$q = '';
				}
			} elseif ($c == '"' || $c == "'") {
				$q = $c;
			} elseif ($c == '{') {
				$depth++;
			} elseif ($c == '}') {
				$depth--;
			}
			$k++;
		}
		// the body is what lies between the braces; a block left open at the
		// end of the input runs to the end
		$body = substr($css, $j + 1, ($depth == 0 ? $k - 1 : $k) - $j - 1);
		$i = $k;
		if ($head === '') {
			continue;
		}
		if ($head[0] == '@') {
			if (preg_match('/^@(media|supports|layer|container)\b/i', $head)) {
				$out .= $head.'{'.user_code_scope_css($body, $scope).'}';
			} else {
				$out .= $head.'{'.$body.'}';
			}
			continue;
		}
		$sels = [];
		foreach (user_code_css_split($head, ',') as $sel) {
			$sel = trim($sel);
			if ($sel === '') {
				continue;
			}
			if ($sel[0] == '&') {
				$sels[] = $scope.substr($sel, 1);
			} elseif ($sel[0] == ':') {
				$sels[] = $scope.$sel;
			} else {
				$sels[] = $scope.' '.$sel;
			}
		}
		if (!empty($sels)) {
			$out .= implode(',', $sels).'{'.trim($body).'}';
		}
	}
	return $out;
}


/**
 *	the css of an object's code, scoped to the object
 *
 *	@param string $raw the author's input
 *	@param string $name name of the object
 *	@return string the css, '' if there is none
 */
function user_code_object_css($raw, $name)
{
	$blocks = user_code_blocks($raw);
	$css = trim(implode("\n", $blocks['style']));
	if ($css === '') {
		return '';
	}
	return user_code_scope_css($css, user_code_id_selector($name));
}


/**
 *	render a code object: its css goes into the head, scoped to its object,
 *	and its scripts too, wrapped so that they run once the object is there and
 *	are handed it
 *
 *	The scripts are NOT confined to the object: they run in the page like any
 *	other script and can reach everything on it. They are handed el, the
 *	object's element (also this), so that "this object" needs no id.
 *
 *	In the editor the script is handed timers that stand still while the
 *	object is selected (see user_code_hold_timers()), so that an object moved by
 *	a timer can be taken hold of and edited. On a published page it gets the
 *	page's own.
 *
 *	@param array $obj the code object
 *	@param bool $edit are we editing or not
 *	@return string empty - nothing is placed in the body
 */
function user_code_render_object_code($obj, $edit = false)
{
	$target = user_code_object_of_code($obj['name']);
	if ($target === false || empty($obj['content'])) {
		return '';
	}
	$blocks = user_code_blocks($obj['content']);
	$css = user_code_object_css($obj['content'], $target);
	if ($css !== '') {
		// the marker is what lets the editor swap this very element for the
		// new css when the author changes it, instead of stacking a second
		// stylesheet on top of a stale one
		html_add_head_inline('<style data-glue-code="'.htmlspecialchars($target, ENT_QUOTES).'">'.nl().$css.nl().'</style>', 5);
	}
	$js = trim(implode("\n", $blocks['script']));
	if ($js !== '') {
		$id = json_encode($target, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES);
		if ($edit) {
			html_add_head_inline('<script>document.addEventListener("DOMContentLoaded",function(){var el=document.getElementById('.$id.');if(!el){return;}'.user_code_hold_timers().'(function(el,setInterval,clearInterval,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame){'.nl().$js.nl().'}).call(el,el,hold.setInterval,hold.clearInterval,hold.setTimeout,hold.clearTimeout,hold.requestAnimationFrame,hold.cancelAnimationFrame);});</script>', 5);
		} else {
			html_add_head_inline('<script>document.addEventListener("DOMContentLoaded",function(){var el=document.getElementById('.$id.');if(!el){return;}(function(el){'.nl().$js.nl().'}).call(el,el);});</script>', 5);
		}
	}
	return '';
}


/**
 *	javascript: timers that stand still while the object is selected
 *
 *	An object that a script keeps moving or resizing is hard to select, drag or
 *	edit, and its menu and panels are open exactly while it is selected. So in
 *	the editor the script's setInterval, setTimeout and requestAnimationFrame
 *	(and their clear/cancel pairs) are shadowed by these: a callback that comes
 *	due while the object is selected does not run - an interval skips its tick,
 *	a timeout or frame waits and runs when the object is let go - and
 *	everything runs as usual after that.
 *
 *	The limits: only these three timers, and only as the script calls them by
 *	those names (window.setInterval is the page's own); event handlers,
 *	promises and the like are not held. Animations are held separately, by
 *	css/edit.css and js/edit.js.
 *
 *	@return string javascript that declares a variable named hold
 */
function user_code_hold_timers()
{
	return 'var hold=(function(){'
		.'var held=function(){return el.classList.contains("glue-selected");};'
		.'var gone={};'
		.'return {'
		.'setInterval:function(f,t){var a=[].slice.call(arguments,2);return window.setInterval(function(){if(!held()){f.apply(null,a);}},t);},'
		.'clearInterval:function(i){window.clearInterval(i);},'
		.'setTimeout:function(f,t){var a=[].slice.call(arguments,2);var id=window.setTimeout(function run(){if(gone[id]){return;}if(held()){window.setTimeout(run,200);}else{f.apply(null,a);}},t);return id;},'
		.'clearTimeout:function(i){gone[i]=true;window.clearTimeout(i);},'
		.'requestAnimationFrame:function(f){var id=window.requestAnimationFrame(function frame(n){if(gone["f"+id]){return;}if(held()){window.requestAnimationFrame(frame);}else{f(n);}});return id;},'
		.'cancelAnimationFrame:function(i){gone["f"+i]=true;window.cancelAnimationFrame(i);}'
		.'};})();';
}


/**
 *	the raw code of an object
 *
 *	@param string $name name of the object
 *	@return string the code, '' if there is none
 */
function user_code_object_code($name)
{
	$code_name = user_code_object_code_name($name);
	if ($code_name === false || !object_exists($code_name)) {
		return '';
	}
	load_modules('glue');
	$obj = load_object(['name'=>$code_name]);
	if ($obj['#error'] || empty($obj['#data']['content'])) {
		return '';
	}
	return strval($obj['#data']['content']);
}


/**
 *	set or clear the raw code of an object
 *
 *	@param string $name name of the object
 *	@param string $code the author's input; '' removes the code
 *	@return array response
 */
function user_code_store_object_code($name, $code)
{
	$code_name = user_code_object_code_name($name);
	if ($code_name === false) {
		return response('Object '.quot($name).' cannot carry code', 400);
	}
	load_modules('glue');
	if (trim($code) === '') {
		if (object_exists($code_name)) {
			$ret = delete_object(['name'=>$code_name]);
			if ($ret['#error']) {
				return $ret;
			}
		}
		return response(true);
	}
	if (USER_CODE_OBJECT_MAX < strlen($code)) {
		return response('The code is too long (over '.USER_CODE_OBJECT_MAX.' bytes)', 400);
	}
	$ret = update_object(['name'=>$code_name, 'type'=>'objcode', 'module'=>'user_code', 'content'=>$code]);
	if ($ret['#error']) {
		return $ret;
	}
	// the page is cached with the head code in it
	drop_cache('page');
	return response(true);
}


/**
 *	get the code of an object
 *
 *	@param array $args arguments
 *		key 'name' name of the object (page.rev.id)
 *	@return array response
 *		string the author's raw input, '' if the object has none
 */
function user_code_get_object_code($args)
{
	if (empty($args['name']) || user_code_object_code_name($args['name']) === false) {
		return response('Required argument "name" missing or not an object', 400);
	}
	if (!object_exists($args['name'])) {
		return response('Object '.quot($args['name']).' does not exist', 404);
	}
	return response(user_code_object_code($args['name']));
}

register_service('user_code.get_object_code', 'user_code_get_object_code', ['auth'=>true]);


/**
 *	set the code of an object
 *
 *	@param array $args arguments
 *		key 'name' name of the object (page.rev.id)
 *		key 'code' the raw input; empty removes the code
 *	@return array response
 *		key 'css' the object's code as css scoped to it ('' if none)
 */
function user_code_set_object_code($args)
{
	if (empty($args['name']) || user_code_object_code_name($args['name']) === false) {
		return response('Required argument "name" missing or not an object', 400);
	}
	if (!isset($args['code']) || !is_string($args['code'])) {
		return response('Required argument "code" missing', 400);
	}
	if (!object_exists($args['name'])) {
		return response('Object '.quot($args['name']).' does not exist', 404);
	}
	// a block that closes its own tag early would turn the rest of the
	// author's code into markup: the tag has to be written escaped
	$blocks = user_code_blocks($args['code']);
	foreach (['script', 'style'] as $tag) {
		foreach ($blocks[$tag] as $b) {
			if (preg_match('#</'.$tag.'#i', $b)) {
				return response('The '.$tag.' contains a closing </'.$tag.'> tag - write <\\/'.$tag.'> instead', 400);
			}
		}
	}
	$ret = user_code_store_object_code($args['name'], $args['code']);
	if ($ret['#error']) {
		return $ret;
	}
	// the scoped css comes back so that the editor can show it at once; the
	// script runs when the page is loaded
	return response(['css'=>user_code_object_css($args['code'], $args['name'])]);
}

register_service('user_code.set_object_code', 'user_code_set_object_code', ['auth'=>true]);


/**
 *	hook: an object is going to be deleted - its code goes with it
 */
function user_code_delete_object($args)
{
	$code_name = user_code_object_code_name($args['obj']['name']);
	if ($code_name !== false && object_exists($code_name)) {
		delete_object(['name'=>$code_name]);
	}
}


/**
 *	hook: an object has been cloned - the clone gets its own copy of the code
 *
 *	@param array $args key 'old' and 'new' are the two object names
 */
function user_code_clone_object($args)
{
	$code = user_code_object_code($args['old']);
	if ($code !== '') {
		user_code_store_object_code($args['new'], $code);
	}
}


/**
 *	hook: an object is handed over for copying - its code travels with it
 *
 *	@param array $args key 'name' is the object's name
 *	@return array extra keys for the clipboard
 */
function user_code_export_object($args)
{
	return ['code'=>user_code_object_code($args['name'])];
}


/**
 *	hook: an object has been pasted - the code on the clipboard goes with it
 *
 *	@param array $args key 'name' is the new object, 'clipboard' the snapshot
 */
function user_code_import_object($args)
{
	if (!empty($args['clipboard']['code']) && is_string($args['clipboard']['code'])) {
		user_code_store_object_code($args['name'], $args['clipboard']['code']);
	}
}
