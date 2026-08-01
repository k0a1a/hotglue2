<?php

/*
 *	module_page.inc.php
 *	Module for managing pages
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
require_once('controller.inc.php');
require_once('html.inc.php');
require_once('util.inc.php');


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


/**
 *	clear the page's current background image
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *	@return array response
 */
function page_clear_background_img($args)
{
	if (!isset($args['page'])) {
		return response('Required argument "page" missing', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 400);
	}
	
	load_modules('glue');
	$obj = load_object(['name'=>$args['page'].'.page']);
	if ($obj['#error']) {
		// page object does not exist, hence no background image to clear
		return response(true);
	} else {
		$obj = $obj['#data'];
	}
	
	if (!empty($obj['page-background-file'])) {
		// delete file
		delete_upload(['pagename'=>get_first_item(expl('.', $args['page'])), 'file'=>$obj['page-background-file'], 'max_cnt'=>1]);
		// and remove attributes
		return object_remove_attr(['name'=>$obj['name'], 'attr'=>['page-background-file', 'page-background-mime']]);
	} else {
		return response(true);
	}
}

register_service('page.clear_background_img', 'page_clear_background_img', ['auth'=>true]);


function page_delete_page($args)
{
	$page = $args['page'];

	// check if there is a page object
	$obj = load_object(['name'=>$page.'.page']);
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	$deleted = false;
	// check if there is a background-image
	if (!empty($obj['page-background-file'])) {
		// delete it
		delete_upload(['pagename'=>get_first_item(expl('.', $page)), 'file'=>$obj['page-background-file'], 'max_cnt'=>1]);
		$deleted = true;
	}
	// check if there is a site favicon (only ever set on the startpage, but
	// no harm checking any page - it'll simply never be set on others)
	if (!empty($obj['page-favicon-file'])) {
		delete_upload(['pagename'=>get_first_item(expl('.', $page)), 'file'=>$obj['page-favicon-file'], 'max_cnt'=>1]);
		$deleted = true;
	}
	return $deleted;
}


function page_has_reference($args)
{
	$obj = $args['obj'];
	$tmp = expl('.', $obj['name']);
	if (array_pop($tmp) != 'page') {
		return false;
	}

	if (!empty($obj['page-background-file']) && $obj['page-background-file'] == $args['file']) {
		return true;
	} elseif (!empty($obj['page-favicon-file']) && $obj['page-favicon-file'] == $args['file']) {
		return true;
	} else {
		return false;
	}
}


/**
 *	get the current grid size
 *
 *	@param array $args arguments
 *	@return array response
 *		'x', 'y' the grid size
 */
function page_get_grid($args)
{
	if (($s = @file_get_contents(CONTENT_DIR.'/grid')) !== false) {
		$a = expl(' ', $s);
		return response(['x'=>intval($a[0]), 'y'=>intval($a[1])]);
	} else {
		return response(['x'=>PAGE_DEFAULT_GRID_X, 'y'=>PAGE_DEFAULT_GRID_Y]);
	}
}

register_service('page.get_grid', 'page_get_grid');


function page_render_object($args)
{
	$obj = $args['obj'];
	$a = expl('.', $obj['name']);
	if ($a[2] != 'page') {
		return false;
	}
	
	// background-attachment
	if (!empty($obj['page-background-attachment'])) {
		html_css('background-attachment', $obj['page-background-attachment']);
	}
	// background-color
	if (!empty($obj['page-background-color'])) {
		html_css('background-color', $obj['page-background-color']);
	}
	// background-image - kept relative (not prefixed with base_url()) so it
	// still resolves correctly when viewed through a different domain than
	// the one configured/detected as the base url - see
	// module_object.inc.php's object_alter_render_late() for the full rationale
	if (!empty($obj['page-background-file'])) {
		if (SHORT_URLS) {
			html_css('background-image', 'url('.htmlspecialchars(urlencode($obj['name']), ENT_NOQUOTES, 'UTF-8').')');
		} else {
			html_css('background-image', 'url(?'.htmlspecialchars(urlencode($obj['name']), ENT_NOQUOTES, 'UTF-8').')');
		}
	}
	// background-image-position
	if (!empty($obj['page-background-image-position'])) {
		html_css('background-position', $obj['page-background-image-position']);
	}
	// set the html title
	if (isset($obj['page-title'])) {
		html_title($obj['page-title']);
	}
}


function page_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/page/page-edit.min.js');
		} else {
			html_add_js(base_url().'modules/page/page-edit.js');
		}
		html_add_css(base_url().'modules/page/page-edit.css');
		// so page-edit.js can tell whether the page currently being edited
		// is the startpage - the site favicon upload control only makes
		// sense there, since it's stored on the startpage's own page-object
		// regardless of which page it applies to
		html_add_js_var('$.glue.conf.page.startpage', startpage());

		// set default grid
		$grid = page_get_grid([]);
		$grid = $grid['#data'];
		html_add_js_var('$.glue.conf.page.default_grid_x', $grid['x']);
		html_add_js_var('$.glue.conf.page.default_grid_y', $grid['y']);
				
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


function page_serve_resource($args)
{
	$obj = $args['obj'];
	$tmp = expl('.', $obj['name']);
	if (array_pop($tmp) != 'page') {
		return false;
	}
	$pn = get_first_item($tmp);
	
	if (!empty($obj['page-background-file'])) {
		$fn = CONTENT_DIR.'/'.$pn.'/shared/'.$obj['page-background-file'];
		if (isset($obj['page-background-mime'])) {
			$mime = $obj['page-background-mime'];
		} else {
			$mime = '';
		}
		serve_file($fn, false, $mime);
	}
	
	// if everything fails
	return false;
}


/**
 *	get the current grid size
 *
 *	@param array $args arguments
 *		key 'x', 'y' is the grid size
 *	@return array response
 *		true if successful
 */
function page_set_grid($args)
{
	if (($x = @intval($args['x'])) == 0) {
		return response('Required argument "x" missing or invalid', 400);
	}
	if (($y = @intval($args['y'])) == 0) {
		return response('Required argument "y" missing or invalid', 400);
	}
	
	$m = umask(0111);
	if (!@file_put_contents(CONTENT_DIR.'/grid', $x.' '.$y)) {
		umask($m);
		return response('Error saving to global grid file', 500);
	} else {
		umask($m);
		return response(true);
	}
}

register_service('page.set_grid', 'page_set_grid', ['auth'=>true]);


/**
 *	implements upload for preferred_module 'page_favicon'
 *
 *	kept as its own top-level function (rather than a branch inside
 *	page_upload()) because upload_files() resolves its fast path by
 *	literally calling "{preferred_module}_upload" - a branch inside
 *	page_upload() would never be reached that way for this preferred_module
 *	value, falling through to the generic per-module upload loop instead,
 *	where e.g. image_upload() (which does no preferred_module check of its
 *	own) could wrongly claim a plain .png/.gif favicon before this ever got
 *	a chance to
 */
function page_favicon_upload($args)
{
	// site-wide favicon: stored on the startpage's own page-object
	// regardless of which page it's viewed from, since it applies to
	// every page - only accepted when uploaded from the startpage itself
	// so it's clear which site it's being set for (the upload button is
	// also only shown there, see page-edit.js)
	if (empty($args['page']) || $args['page'] != startpage()) {
		return false;
	}
	// check if supported file
	if (!in_array($args['mime'], ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/gif', 'image/svg+xml'])
		&& ($args['mime'] == '' && !in_array(filext($args['file']), ['ico', 'png', 'gif', 'svg']))) {
		return false;
	}

	load_modules('glue');
	// check if there is already a favicon and delete it
	$obj = load_object(['name'=>$args['page'].'.page']);
	if (!$obj['#error']) {
		$obj = $obj['#data'];
		if (!empty($obj['page-favicon-file'])) {
			delete_upload(['pagename'=>get_first_item(expl('.', $args['page'])), 'file'=>$obj['page-favicon-file'], 'max_cnt'=>1]);
		}
	}

	$obj = [];
	$obj['name'] = $args['page'].'.page';
	$obj['page-favicon-file'] = $args['file'];
	$obj['page-favicon-mime'] = $args['mime'];

	$ret = update_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'page_favicon_upload: error updating page object: '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function page_upload($args)
{
	// only handle the file if the frontend wants us to
	if (empty($args['preferred_module']) || $args['preferred_module'] != 'page') {
		return false;
	}
	// check if supported file
	if (!in_array($args['mime'], ['image/jpeg', 'image/png', 'image/gif']) || ($args['mime'] == '' && !in_array(filext($args['file']), ['jpg', 'jpeg', 'png', 'gif']))) {
		return false;
	}

	// check if there is already a background-image and delete it
	$obj = load_object(['name'=>$args['page'].'.page']);
	if (!$obj['#error']) {
		$obj = $obj['#data'];
		if (!empty($obj['page-background-file'])) {
			delete_upload(['pagename'=>get_first_item(expl('.', $args['page'])), 'file'=>$obj['page-background-file'], 'max_cnt'=>1]);
		}
	}

	// set as background-image in page object
	$obj = [];
	$obj['name'] = $args['page'].'.page';
	$obj['page-background-file'] = $args['file'];
	$obj['page-background-mime'] = $args['mime'];

	// update page object
	load_modules('glue');
	$ret = update_object($obj);
	if ($ret['#error']) {
		log_msg('page_upload: error updating page object: '.quot($ret['#data']));
		return false;
	} else {
		// we don't actually render the object here, but signal the
		// frontend that everything went okay
		return true;
	}
}


/**
 *	serve the site-wide favicon (uploaded on the startpage, applies to
 *	every page - see default_html()'s use of this same startpage lookup)
 */
function controller_favicon($args)
{
	load_modules('glue');
	$obj = load_object(['name'=>startpage().'.page']);
	if ($obj['#error'] || empty($obj['#data']['page-favicon-file'])) {
		hotglue_error(404);
		return;
	}
	$obj = $obj['#data'];
	$pn = get_first_item(expl('.', $obj['name']));
	$fn = CONTENT_DIR.'/'.$pn.'/shared/'.$obj['page-favicon-file'];
	$mime = !empty($obj['page-favicon-mime']) ? $obj['page-favicon-mime'] : '';
	serve_file($fn, false, $mime);
}

register_controller('favicon', '', 'controller_favicon');
