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
				// add base url for relative links that are not directed towards anchors
				if (SHORT_URLS) {
					$link = base_url().urlencode($link);
				} else {
					$link = base_url().'?'.urlencode($link);
				}
			}
			// <a> can include block elements in html5
			if (substr($html, -1) == "\n") {
				$html = substr($html, 0, -1);
			}
			// if target is specified use it in link
			if ($target) {
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
