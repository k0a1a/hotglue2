<?php

/**
 *	module_anchor.inc.php
 *	Module for adding named anchor elements
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('html_parse.inc.php');
require_once('modules.inc.php');
// module glue gets loaded on demand


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


function anchor_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'anchor')) {
		return false;
	}
	
	if (!empty($obj['anchor-name'])) {
		$a = elem('a');
		elem_attr($a, 'name', $obj['anchor-name']);
		elem_val($a, '&nbsp;');
		elem_append($elem, $a);
		if ($args['edit']) {
			elem_attr($elem, 'title', 'this is a named anchor, regular visitors won\'t be seing this icon');
			$d = elem('div');
			elem_add_class($d, 'glue-anchor-name');
			elem_add_class($d, 'glue-ui');
			elem_val($d, htmlspecialchars('#'.$obj['anchor-name'], ENT_NOQUOTES, 'UTF-8'));
			elem_append($elem, $d);
		}
	}
	
	return true;
}


function anchor_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'anchor')) {
		return false;
	}
	
	unset($obj['anchor-name']);
	$childs = html_parse(elem_val($elem));
	foreach ($childs as $child) {
		if (elem_tag($child) == 'a') {
			if (elem_attr($child, 'name') !== NULL) {
				$obj['anchor-name'] = elem_attr($child, 'name');
				break;
			}
		}
	}
	
	return true;
}


function anchor_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'anchor') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'anchor');
	elem_add_class($e, 'object');
	
	invoke_hook_first('alter_render_early', 'anchor', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'anchor', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
	return $html;
}


function anchor_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/anchor/anchor-edit.min.js');
		} else {
			html_add_js(base_url().'modules/anchor/anchor-edit.js');
		}
		html_add_css(base_url().'modules/anchor/anchor-edit.css');
		return true;
	} else {
		return false;
	}
}


function anchor_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (array_shift(elem_classes($elem)) != 'anchor') {
		return false;
	}
	
	$obj['type'] = 'anchor';
	$obj['module'] = 'anchor';
	
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'anchor_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


?>
