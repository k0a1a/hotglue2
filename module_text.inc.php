<?php

/**
 *	module_text.inc.php
 *	Module for placing text elements on a page
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
require_once('html.inc.php');
require_once('html_parse.inc.php');
require_once('modules.inc.php');
// module glue gets loaded on demand
require_once('util.inc.php');


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


// TODO: document
function _text_render_content($s, $name)
{
	// resolve any aliases
	$s = resolve_aliases($s, $name);
	$s = html_encode_str_smart($s);
	// automatically add <br> elements for newlines
	if (TEXT_AUTO_BR) {
		$s = str_replace("\r\n", "\n", $s);
		$s = str_replace("\n", "<br>\n", $s);
	}
	// encode non-breakable spaces (160, 0xc2 0xa0 in utf-8)
	$s = str_replace("\xc2\xa0", '&nbsp;', $s);
	// resolve any relative urls
	$s = resolve_relative_urls($s);
	return $s;
}


function text_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'text')) {
		return false;
	}
	
	// background-color
	if (elem_css($elem, 'background-color') !== NULL) {
		$obj['text-background-color'] = elem_css($elem, 'background-color');
	} else {
		unset($obj['text-background-color']);
	}
	// we don't handle content here
	// see the comments in $.glue.object.register_alter_pre_save (at text-edit.js)
	// font-color
	if (elem_css($elem, 'color') !== NULL) {
		$obj['text-font-color'] = elem_css($elem, 'color');
	} else {
		unset($obj['text-font-color']);
	}
	// font-family
	if (elem_css($elem, 'font-family') !== NULL) {
		$obj['text-font-family'] = elem_css($elem, 'font-family');
	} else {
		unset($obj['text-font-family']);
	}
	// font-size
	if (elem_css($elem, 'font-size') !== NULL) {
		$obj['text-font-size'] = elem_css($elem, 'font-size');
	} else {
		unset($obj['text-font-size']);
	}
	// font-style
	if (elem_css($elem, 'font-style') !== NULL) {
		$obj['text-font-style'] = elem_css($elem, 'font-style');
	} else {
		unset($obj['text-font-style']);
	}
	// font-weight
	if (elem_css($elem, 'font-weight') !== NULL) {
		$obj['text-font-weight'] = elem_css($elem, 'font-weight');
	} else {
		unset($obj['text-font-weight']);
	}
	// letter-spacing
	if (elem_css($elem, 'letter-spacing') !== NULL) {
		$obj['text-letter-spacing'] = elem_css($elem, 'letter-spacing');
	} else {
		unset($obj['text-letter-spacing']);
	}
	// line-height
	if (elem_css($elem, 'line-height') !== NULL) {
		$obj['text-line-height'] = elem_css($elem, 'line-height');
	} else {
		unset($obj['text-line-height']);
	}
	if (elem_css($elem, 'padding') !== NULL) {
		// parse padding
		// this is needed for Firefox
		$s = expl(' ', elem_css($elem, 'padding'));
		if (count($s) == 1) {
			// padding-x = padding-y
			$obj['text-padding-x'] = $s[0];
			$obj['text-padding-y'] = $s[0];
		} elseif (1 < count($s)) {
			// padding-x
			$obj['text-padding-x'] = $s[1];
			// padding-y
			$obj['text-padding-y'] = $s[0];
		}
	} else {
		// padding-x
		if (elem_css($elem, 'padding-left') !== NULL) {
			$obj['text-padding-x'] = elem_css($elem, 'padding-left');
		} else {
			unset($obj['text-padding-x']);
		}
		// padding-y
		if (elem_css($elem, 'padding-top') !== NULL) {
			$obj['text-padding-y'] = elem_css($elem, 'padding-top');
		} else {
			unset($obj['text-padding-y']);
		}
	}
	// text-align
	if (elem_css($elem, 'text-align') !== NULL) {
		$obj['text-align'] = elem_css($elem, 'text-align');
	} else {
		unset($obj['text-align']);
	}
	// word-spacing
	if (elem_css($elem, 'word-spacing') !== NULL) {
		$obj['text-word-spacing'] = elem_css($elem, 'word-spacing');
	} else {
		unset($obj['text-word-spacing']);
	}
	
	return true;
}


function text_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'text')) {
		return false;
	}
	
	// background-color
	if (!empty($obj['text-background-color'])) {
		elem_css($elem, 'background-color', $obj['text-background-color']);
	}
	// content
	if (!isset($obj['content'])) {
		$obj['content'] = '';
	}
	if ($args['edit']) {
		// add a textarea
		$i = elem('textarea');
		elem_add_class($i, 'glue-text-input');
		elem_css($i, 'width', '100%');
		elem_css($i, 'height', '100%');
		// hide the text area by default
		elem_css($i, 'display', 'none');
		// set the context to the textarea to the (unrendered) object content
		$content = htmlspecialchars($obj['content'], ENT_NOQUOTES, 'UTF-8');
		// replace newline characters by an entity to prevent render_object() 
		// from adding some indentation
		$content = str_replace("\r\n", '&#10;', $content);
		$content = str_replace("\n", '&#10;', $content);
		// why not replace tabs as well why we are at it
		$content = str_replace("\t", '&#09;', $content);
		elem_val($i, $content);
		elem_append($elem, $i);
		// and a nested div
		$r = elem('div');
		elem_add_class($r, 'glue-text-render');
		elem_css($r, 'width', '100%');
		elem_css($r, 'height', '100%');
		// set the content of the div to the rendered object content
		elem_val($r, _text_render_content($obj['content'], $obj['name']));
		elem_append($elem, $r);
	} else {
		elem_append($elem, _text_render_content($obj['content'], $obj['name']));
	}
	// font-color
	if (!empty($obj['text-font-color'])) {
		elem_css($elem, 'color', $obj['text-font-color']);
	}
	// font-family
	if (!empty($obj['text-font-family'])) {
		elem_css($elem, 'font-family', $obj['text-font-family']);
	}
	// font-size
	if (!empty($obj['text-font-size'])) {
		elem_css($elem, 'font-size', $obj['text-font-size']);
	}
	// font-style
	if (!empty($obj['text-font-style'])) {
		elem_css($elem, 'font-style', $obj['text-font-style']);
	}
	// font-weight
	if (!empty($obj['text-font-weight'])) {
		elem_css($elem, 'font-weight', $obj['text-font-weight']);
	}
	// letter-spacing
	if (!empty($obj['text-letter-spacing'])) {
		elem_css($elem, 'letter-spacing', $obj['text-letter-spacing']);
	}
	// line-height
	if (!empty($obj['text-line-height'])) {
		elem_css($elem, 'line-height', $obj['text-line-height']);
	}
	// padding-x
	if (!empty($obj['text-padding-x'])) {
		elem_css($elem, 'padding-left', $obj['text-padding-x']);
		elem_css($elem, 'padding-right', $obj['text-padding-x']);
	}
	// padding-y
	if (!empty($obj['text-padding-y'])) {
		elem_css($elem, 'padding-top', $obj['text-padding-y']);
		elem_css($elem, 'padding-bottom', $obj['text-padding-y']);
	}
	// text-align
	if (!empty($obj['text-align'])) {
		elem_css($elem, 'text-align', $obj['text-align']);
	}
	// word-spacing
	if (!empty($obj['text-word-spacing'])) {
		elem_css($elem, 'word-spacing', $obj['text-word-spacing']);
	}
	
	return true;
}


function text_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'text') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'text');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'text', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'text', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
	return $html;
}


function text_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/text/text-edit.min.js');
		} else {
			html_add_js(base_url().'modules/text/text-edit.js');
		}
		html_add_css(base_url().'modules/text/text-edit.css');
		html_add_js_var('$.glue.conf.text.auto_br', TEXT_AUTO_BR);
	}
}


function text_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (array_shift(elem_classes($elem)) != 'text') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'text';
	$obj['module'] = 'text';
	
	// hook
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		load_msg('error', 'text_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


?>
