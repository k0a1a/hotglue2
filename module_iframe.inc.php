<?php

/**
 *	module_iframe.inc.php
 *	Module for embedding iframe elements
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


function iframe_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'iframe')) {
		return false;
	}
	
	// parse children elements to find iframe
	$childs = html_parse(elem_val($elem));
	$i = false;
	foreach ($childs as $c) {
		if (elem_tag($c) == 'iframe') {
			$i = $c;
			break;
		}
	}
	if (!$i) {
		log_msg('warn', 'iframe_alter_save: no iframe element found, inner html is '.var_dump_inl($childs));
		return false;
	}
	
	// url
	if (elem_attr($i, 'src') !== NULL) {
		$obj['iframe-url'] = elem_attr($i, 'src');
	} else {
		unset($obj['iframe-url']);
	}
	// scrolling
	if (elem_css($i, 'overflow') == 'hidden' || (elem_css($i, 'overflow-x') == 'hidden' && elem_css($i, 'overflow-y') == 'hidden')) {
		unset($obj['iframe-scroll']);
	} else {
		$obj['iframe-scroll'] = 'scroll';
	}
	
	return true;
}


function iframe_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'iframe')) {
		return false;
	}
	
	// add iframe
	$i = elem('iframe');
	// frameborder is not valid html5
	//if (!$args['edit'] && IE8_COMPAT) {
	//	elem_attr($i, 'frameborder', '0');
	//}
	// set the name attribute
	elem_attr($i, 'name', $obj['name']);
	if (!$args['edit']) {
		// try to lift any restrictions
		elem_attr($i, 'sandbox', 'allow-forms allow-same-origin allow-scripts allow-top-navigation');
	}
	elem_css($i, 'background-color', 'transparent');
	elem_css($i, 'border-width', '0px');
	elem_css($i, 'height', '100%');
	elem_css($i, 'position', 'absolute');
	elem_css($i, 'width', '100%');
	// url
	if (!empty($obj['iframe-url'])) {
		elem_attr($i, 'src', $obj['iframe-url']);
	} else {
		elem_attr($i, 'src', '');
	}
	// scrolling
	if (isset($obj['iframe-scroll']) && $obj['iframe-scroll'] == 'scroll') {
		elem_css($i, 'overflow', 'auto');
		// attribute scrolling is not available in html5 but this effectivly 
		// removes the scrollbars on Chrome, so..
		elem_attr($i, 'scrolling', 'auto');
	} else {
		elem_css($i, 'overflow', 'hidden');
		elem_attr($i, 'scrolling', 'no');
		elem_attr($i, 'seamless', 'seamless');
	}
	elem_append($elem, $i);
	if ($args['edit']) {
		// add shield as well
		$s = elem('div');
		elem_add_class($s, 'glue-iframe-shield');
		elem_add_class($s, 'glue-ui');
		elem_css($s, 'height', '100%');
		elem_css($s, 'position', 'absolute');
		elem_css($s, 'width', '100%');
		elem_attr($s, 'title', 'visitors will be able to interact with the webpage below');
		elem_append($elem, $s);
	}
	
	return true;
}


function iframe_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'iframe') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'iframe');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'iframe', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'iframe', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
	return $html;
}


function iframe_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/iframe/iframe-edit.min.js');
		} else {
			html_add_js(base_url().'modules/iframe/iframe-edit.js');
		}
		html_add_css(base_url().'modules/iframe/iframe-edit.css');
	}
}


function iframe_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (array_shift(elem_classes($elem)) != 'iframe') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'iframe';
	$obj['module'] = 'iframe';
	
	// hook
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'iframe_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}
