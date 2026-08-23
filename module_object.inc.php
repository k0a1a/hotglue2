<?php

/*
 *	module_object.inc.php
 *	Module for handling general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
require_once('html.inc.php');
require_once('util.inc.php');


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


/**
 *	Object Properties: user-supplied classes and attributes.
 *
 *	Both are stored on the object and merged into the container <div> at render
 *	time. Validation lives here, in the RENDER path, rather than only where the
 *	editor writes them - glue.update_object is a generic key/value setter, so
 *	anything that only guards the write can be walked around with one POST.
 *	Filtering as we render is the gate that actually holds.
 *
 *	Attribute NAMES are the dangerous half, and not for the obvious reason.
 *	html.inc.php:228 emits them with htmlspecialchars(..., ENT_NOQUOTES), which
 *	deliberately leaves quotes alone - so a name of  x" onload="alert(1)  would
 *	close the attribute and inject an event handler. Values are emitted with
 *	ENT_COMPAT and are safe. Hence the strict name charset below: it is load
 *	bearing, not tidiness.
 */

// letters, digits and dashes, starting with a letter - covers data-*, aria-*,
// role, title, name, and rejects everything that could break out
define('OBJECT_ATTR_NAME_RE', '/^[a-zA-Z][a-zA-Z0-9-]*$/');
// one CSS class token
define('OBJECT_CLASS_TOKEN_RE', '/^-?[A-Za-z_][A-Za-z0-9_-]*$/');

/**
 *	attribute names the user may not set on an object container
 *
 *	@return array lowercase names
 */
function object_attr_denylist()
{
	return [
		// identity and layout are hotglue's, not the user's
		'id',			// the editor's primary handle (selection, save, undo)
		'class',		// managed by the separate class field
		'style',		// would let a user override the absolute positioning
						// that IS hotglue; object styling has its own path
		// would fight the editor's own behaviour
		'contenteditable',
		'draggable',
	];
}

/**
 *	is this attribute name allowed on an object container?
 *
 *	@param string $name attribute name
 *	@return bool
 */
function object_attr_allowed($name)
{
	$name = strtolower(trim($name));
	if (!preg_match(OBJECT_ATTR_NAME_RE, $name)) {
		return false;
	}
	// every inline event handler - JS belongs in page-level /code
	if (substr($name, 0, 2) == 'on') {
		return false;
	}
	return !in_array($name, object_attr_denylist());
}

/**
 *	filter a class string down to the tokens that are valid CSS class names
 *
 *	@param string $str space-separated tokens
 *	@return array valid tokens
 */
function object_filter_classes($str)
{
	$out = [];
	foreach (preg_split('/\s+/', trim((string)$str)) as $token) {
		if ($token !== '' && preg_match(OBJECT_CLASS_TOKEN_RE, $token)) {
			$out[] = $token;
		}
	}
	return $out;
}

/**
 *	decode the stored object-attributes property
 *
 *	Stored as a single line of JSON, which suits the flat file format: it never
 *	contains a raw newline (save_object strips those from every value anyway,
 *	module_glue.inc.php), and a colon inside it is harmless because the parser
 *	splits each line on the FIRST colon only.
 *
 *	@param string $str stored value
 *	@return array name=>value, only the entries that pass validation
 */
function object_decode_attributes($str)
{
	if (empty($str)) {
		return [];
	}
	$decoded = @json_decode($str, true);
	if (!is_array($decoded)) {
		log_msg('warn', 'object: could not decode object-attributes '.quot($str));
		return [];
	}
	$out = [];
	foreach ($decoded as $name=>$val) {
		if (is_array($val) || is_object($val)) {
			continue;
		}
		if (object_attr_allowed($name)) {
			$out[strtolower(trim($name))] = (string)$val;
		} else {
			log_msg('warn', 'object: dropping disallowed attribute '.quot($name));
		}
	}
	return $out;
}


/**
 *	save an object's user classes and custom attributes
 *
 *	The editor could write these with glue.update_object directly - this exists
 *	so a bad value is REJECTED with a reason instead of being stored and then
 *	silently dropped at render time. Client-side validation is for feedback;
 *	this is where a save actually gets refused.
 *
 *	Note the render path filters independently (object_alter_render_early), and
 *	has to: glue.update_object is a generic key/value setter, so this service
 *	cannot be the only check without being trivially bypassed.
 *
 *	@param array $args arguments
 *		key 'name' is the object name
 *		key 'classes' space-separated user class tokens (optional, '' clears)
 *		key 'attributes' name=>value map of custom attributes (optional)
 *	@return array response
 *		true if successful
 */
function object_set_properties($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing', 400);
	}
	load_modules('glue');

	$update = ['name'=>$args['name']];
	$remove = [];

	if (isset($args['classes'])) {
		$raw = preg_split('/\s+/', trim((string)$args['classes']), -1, PREG_SPLIT_NO_EMPTY);
		$bad = [];
		foreach ($raw as $token) {
			if (!preg_match(OBJECT_CLASS_TOKEN_RE, $token)) {
				$bad[] = $token;
			}
		}
		if (count($bad)) {
			return response('Invalid class name(s): '.quot(implode(' ', $bad)).' - use letters, digits, - and _, not starting with a digit', 400);
		}
		if (count($raw)) {
			$update['object-custom-class'] = implode(' ', $raw);
		} else {
			$remove[] = 'object-custom-class';
		}
	}

	if (isset($args['attributes'])) {
		if (!is_array($args['attributes'])) {
			return response('Argument "attributes" must be an object', 400);
		}
		$attrs = [];
		foreach ($args['attributes'] as $name=>$val) {
			$name = strtolower(trim((string)$name));
			if ($name === '') {
				continue;
			}
			if (is_array($val) || is_object($val)) {
				return response('Attribute '.quot($name).' must have a text value', 400);
			}
			if (!preg_match(OBJECT_ATTR_NAME_RE, $name)) {
				return response('Invalid attribute name '.quot($name).' - use letters, digits and dashes, starting with a letter', 400);
			}
			if (substr($name, 0, 2) == 'on') {
				return response('Attribute '.quot($name).' can\'t be set here - inline event handlers are not allowed, put javascript in the page\'s code instead', 400);
			}
			if (in_array($name, object_attr_denylist())) {
				if ($name == 'style') {
					return response('Attribute "style" can\'t be set here - the object\'s position and size are managed by the object itself', 400);
				}
				return response('Attribute '.quot($name).' can\'t be set here - it is managed by hotglue', 400);
			}
			$attrs[$name] = (string)$val;
		}
		if (count($attrs)) {
			// one line of JSON - see object_decode_attributes()
			$update['object-attributes'] = json_encode($attrs, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
		} else {
			$remove[] = 'object-attributes';
		}
	}

	// nothing is written until every field has passed, so a rejected save
	// cannot leave half the properties updated
	if (1 < count($update)) {
		$ret = update_object($update);
		if ($ret['#error']) {
			return $ret;
		}
	}
	foreach ($remove as $attr) {
		$ret = object_remove_attr(['name'=>$args['name'], 'attr'=>$attr]);
		if ($ret['#error']) {
			return $ret;
		}
	}
	return response(true);
}

register_service('object.set_properties', 'object_set_properties', ['auth'=>true]);


function object_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'object')) {
		return false;
	}
	
	if (!empty($obj['object-height'])) {
		elem_css($elem, 'height', $obj['object-height']);
	}
	if (!empty($obj['object-left'])) {
		elem_css($elem, 'left', $obj['object-left']);
	}
	if (!empty($obj['object-opacity'])) {
		elem_css($elem, 'opacity', $obj['object-opacity']);
	}
	// whether content bigger than the object's box is cut off or spills out.
	// Absent means visible, which is the browser default and what hotglue has
	// always done - so only 'hidden' is ever stored, and an object that has
	// never been touched keeps exactly the markup it had.
	if (!empty($obj['object-overflow'])) {
		elem_css($elem, 'overflow', $obj['object-overflow']);
	}
	// rounded corners
	if (!empty($obj['object-border-radius'])) {
		elem_css($elem, 'border-radius', $obj['object-border-radius']);
	}
	// A soft edge: the NUMBER is stored, and one rule in css/main.css builds
	// the mask from it - see .glue-edge-fade there. Storing the gradient
	// itself would put commas and quotes in the object file and write the
	// same gradient out in two places (here and the editor) that would have
	// to agree forever. The class is what turns the rule on, so objects
	// nobody has faded carry no mask at all.
	if (!empty($obj['object-edge-fade'])) {
		elem_css($elem, '--glue-fade', $obj['object-edge-fade']);
		elem_add_class($elem, 'glue-edge-fade');
	}
	elem_css($elem, 'position', 'absolute');
	if (!empty($obj['object-top'])) {
		elem_css($elem, 'top', $obj['object-top']);
	}
	if (!empty($obj['object-width'])) {
		elem_css($elem, 'width', $obj['object-width']);
	}
	if (!empty($obj['object-zindex'])) {
		elem_css($elem, 'z-index', $obj['object-zindex']);
	}
	// custom class: appended alongside the internal classes (safe, classes
	// don't collide) so the user's own CSS/JS can target this object. Filtered
	// to valid class tokens - APPENDED, so a user can never remove or replace
	// the classes the editor and the modules key off.
	if (!empty($obj['object-custom-class'])) {
		foreach (object_filter_classes($obj['object-custom-class']) as $token) {
			elem_add_class($elem, $token);
		}
	}

	// custom attributes, denylist-filtered (see the note at the top)
	if (!empty($obj['object-attributes'])) {
		foreach (object_decode_attributes($obj['object-attributes']) as $name=>$val) {
			elem_attr($elem, $name, $val);
		}
	}

	return true;
}


function object_alter_render_late($args)
{
	$elem = $args['elem'];
	$html = &$args['html'];
	$obj = $args['obj'];
	if (!elem_has_class($args['elem'], 'object')) {
		return false;
	}
	if (!$args['edit']) {
		// add links only for viewing
		if (!empty($obj['object-link'])) {
			$link = $obj['object-link'];
			if(!empty($obj['object-target'])) {
				$target = $obj['object-target'];
			}
			// resolve any aliases
			$link = resolve_aliases($link, $obj['name']);
			if (!is_url($link) && substr($link, 0, 1) != '#') {
				// same-site page links are kept relative (not prefixed with
				// base_url()) so they still resolve correctly when the page
				// is viewed through a different domain (e.g. a custom
				// domain pointed at this install) than whatever BASE_URL is
				// configured/detected as - the browser resolves a relative
				// href against the domain the page is actually being viewed
				// on, not a hardcoded one
				if (SHORT_URLS) {
					$link = urlencode($link);
				} else {
					$link = '?'.urlencode($link);
				}
			}
			// <a> can include block elements in html5
			if (substr($html, -1) == "\n") {
				$html = substr($html, 0, -1);
			}
			// if target is specified use it in link
			if (isset($target)) {
				$html = '<a href="'.htmlspecialchars($link, ENT_COMPAT, 'UTF-8').'" target="'.htmlspecialchars($target, ENT_COMPAT, 'UTF-8').'">'."\n\t".str_replace("\n", "\n\t", $html)."\n".'</a>'."\n";
			} else {
				$html = '<a href="'.htmlspecialchars($link, ENT_COMPAT, 'UTF-8').'">'."\n\t".str_replace("\n", "\n\t", $html)."\n".'</a>'."\n";
			}
			return true;
		}
	}
	return false;
}


function object_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'object')) {
		return false;
	}
	
	if (elem_css($elem, 'height') !== NULL) {
		$obj['object-height'] = elem_css($elem, 'height');
	} else {
		unset($obj['object-height']);
	}
	if (elem_css($elem, 'left') !== NULL) {
		$obj['object-left'] = elem_css($elem, 'left');
	} else {
		unset($obj['object-left']);
	}
	if (elem_css($elem, 'opacity') !== NULL) {
		$obj['object-opacity'] = elem_css($elem, 'opacity');
	} else {
		unset($obj['object-opacity']);
	}
	if (elem_css($elem, 'overflow') !== NULL) {
		$obj['object-overflow'] = elem_css($elem, 'overflow');
	} else {
		unset($obj['object-overflow']);
	}
	if (elem_css($elem, 'border-radius') !== NULL) {
		$obj['object-border-radius'] = elem_css($elem, 'border-radius');
	} else {
		unset($obj['object-border-radius']);
	}
	// see object_render_object(): the number is what is stored, and the
	// class comes back with it
	if (elem_css($elem, '--glue-fade') !== NULL) {
		$obj['object-edge-fade'] = elem_css($elem, '--glue-fade');
	} else {
		unset($obj['object-edge-fade']);
	}
	if (elem_css($elem, 'top') !== NULL) {
		$obj['object-top'] = elem_css($elem, 'top');
	} else {
		unset($obj['object-top']);
	}
	if (elem_css($elem, 'width') !== NULL) {
		$obj['object-width'] = elem_css($elem, 'width');
	} else {
		unset($obj['object-width']);
	}
	if (elem_css($elem, 'z-index') !== NULL) {
		$obj['object-zindex'] = elem_css($elem, 'z-index');
	} else {
		unset($obj['object-zindex']);
	}
	
	return true;
}


function object_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/object/object-edit.min.js');
		} else {
			html_add_js(base_url().'modules/object/object-edit.js');
		}
		
		// add default colors
		html_add_js_var('$.glue.conf.object.default_colors', expl(' ', OBJECT_DEFAULT_COLORS));
	}
}
