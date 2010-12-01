<?php

/**
 *	module_page.inc.php
 *	Module for managing pages
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


function page_render_object($args)
{
	$obj = $args['obj'];
	$a = expl('.', $obj['name']);
	if ($a[2] != 'page') {
		return false;
	}
	if (isset($obj['page-background-color'])) {
		html_css('background-color', $obj['page-background-color']);
	}
	// set the html title
	if (isset($obj['page-title'])) {
		html_title($obj['page-title']);
	}
}


function page_render_page_early($args)
{
	if ($args['edit']) {
		html_add_js(base_url().'modules/page/page-edit.js');
		
		// set default grid
		html_add_js_var('$.glue.conf.page.default_grid_x', intval(PAGE_DEFAULT_GRID_X));
		html_add_js_var('$.glue.conf.page.default_grid_y', intval(PAGE_DEFAULT_GRID_Y));
		
		// set guides
		$guide = expl(' ', PAGE_GUIDES_X);
		for ($i=0; $i < count($guide); $i++) {
			$guide[$i] = intval(trim($guide[$i]));
		}
		html_add_js_var('$.glue.conf.page.guides_x', $guide);
		$guide = expl(' ', PAGE_GUIDES_Y);
		for ($i=0; $i < count($guide); $i++) {
			$guide[$i] = intval(trim($guide[$i]));
		}
		html_add_js_var('$.glue.conf.page.guides_y', $guide);
	}

	// set the html title to the page name by default
	html_title(page_short($args['page']));
}


?>
