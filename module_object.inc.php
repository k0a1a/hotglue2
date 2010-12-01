<?php

/**
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
	if (!elem_has_class($args['elem'], 'object')) {
		return false;
	}
	
	$obj = $args['obj'];
	if (!empty($obj['object-height'])) {
		elem_css($args['elem'], 'height', $obj['object-height']);
	}
	if (!empty($obj['object-left'])) {
		elem_css($args['elem'], 'left', $obj['object-left']);
	}
	if (!empty($obj['object-opacity'])) {
		elem_css($args['elem'], 'opacity', $obj['object-opacity']);
	}
	elem_css($args['elem'], 'position', 'absolute');
	if (!empty($obj['object-top'])) {
		elem_css($args['elem'], 'top', $obj['object-top']);
	}
	if (!empty($obj['object-width'])) {
		elem_css($args['elem'], 'width', $obj['object-width']);
	}
	if (!empty($obj['object-zindex'])) {
		elem_css($args['elem'], 'z-index', $obj['object-zindex']);
	}
	return true;
}


function object_alter_render_late($args)
{
	if (!elem_has_class($args['elem'], 'object')) {
		return false;
	}
	
	if (!$args['edit']) {
		// add links only for viewing
		if (!empty($args['obj']['object-link'])) {
			$link = $args['obj']['object-link'];
			// resolve any aliases
			$link = resolve_aliases($link, $args['obj']['name']);
			if (!is_url($link) && substr($link, 0, 1) != '#') {
				// add base url for relative links that are not directed towards anchors
				if (SHORT_URLS) {
					$link = base_url().urlencode($link);
				} else {
					$link = base_url().'?'.urlencode($link);
				}
			}
			// <a> can include block elements in html5
			$html = $args['html'];
			if (substr($html, -1) == "\n") {
				$html = substr($html, 0, -1);
			}
			$args['html'] = '<a href="'.htmlspecialchars($link, ENT_COMPAT, 'UTF-8').'">'."\n\t".str_replace("\n", "\n\t", $html)."\n".'</a>'."\n";
			return true;
		}
	}
	return false;
}


function object_alter_save($args)
{
	if (!elem_has_class($args['elem'], 'object')) {
		return false;
	}
	
	if (elem_css($args['elem'], 'height') !== NULL) {
		$args['obj']['object-height'] = elem_css($args['elem'], 'height');
	}
	if (elem_css($args['elem'], 'left') !== NULL) {
		$args['obj']['object-left'] = elem_css($args['elem'], 'left');
	}
	if (elem_css($args['elem'], 'opacity') !== NULL) {
		$args['obj']['object-opacity'] = elem_css($args['elem'], 'opacity');
	}
	if (elem_css($args['elem'], 'top') !== NULL) {
		$args['obj']['object-top'] = elem_css($args['elem'], 'top');
	}
	if (elem_css($args['elem'], 'width') !== NULL) {
		$args['obj']['object-width'] = elem_css($args['elem'], 'width');
	}
	if (elem_css($args['elem'], 'z-index') !== NULL) {
		$args['obj']['object-zindex'] = elem_css($args['elem'], 'z-index');
	}
	return true;
}


function object_render_page_early($args)
{
	if ($args['edit']) {
		html_add_js(base_url().'modules/object/object-edit.js');
		
		// add default colors
		html_add_js_var('$.glue.conf.object.default_colors', expl(' ', OBJECT_DEFAULT_COLORS));
	}
}


?>
