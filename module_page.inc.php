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


/**
 *	clear the site's favicon (site settings, see /pages)
 *
 *	@return array response
 */
function page_clear_favicon($args)
{
	$page = startpage();
	load_modules('glue');
	$obj = load_object(['name'=>$page.'.page']);
	if ($obj['#error']) {
		return response(true);
	}
	$obj = $obj['#data'];
	if (!empty($obj['page-favicon-file'])) {
		delete_upload(['pagename'=>get_first_item(expl('.', $page)), 'file'=>$obj['page-favicon-file'], 'max_cnt'=>1]);
		return object_remove_attr(['name'=>$obj['name'], 'attr'=>['page-favicon-file', 'page-favicon-mime']]);
	} else {
		return response(true);
	}
}

register_service('page.clear_favicon', 'page_clear_favicon', ['auth'=>true]);


/**
 *	remove one of the site's uploaded custom fonts (site settings, see /pages)
 *
 *	@param array $args arguments
 *		key 'file' the font's stored filename, as returned in the fonts list
 *	@return array response
 */
function page_remove_font($args)
{
	if (empty($args['file'])) {
		return response('Required argument "file" missing', 400);
	}
	$page = startpage();
	load_modules('glue');
	$obj = load_object(['name'=>$page.'.page']);
	if ($obj['#error'] || empty($obj['#data']['page-custom-fonts'])) {
		return response(true);
	}
	$obj = $obj['#data'];
	$fonts = @json_decode($obj['page-custom-fonts'], true);
	if (!is_array($fonts)) {
		return response(true);
	}

	$found = false;
	$remaining = [];
	foreach ($fonts as $f) {
		if (isset($f['file']) && $f['file'] == $args['file']) {
			$found = true;
			continue;
		}
		$remaining[] = $f;
	}
	if (!$found) {
		return response(true);
	}

	delete_upload(['pagename'=>get_first_item(expl('.', $page)), 'file'=>$args['file'], 'max_cnt'=>1]);

	if (empty($remaining)) {
		return object_remove_attr(['name'=>$obj['name'], 'attr'=>['page-custom-fonts']]);
	} else {
		return update_object(['name'=>$obj['name'], 'page-custom-fonts'=>json_encode($remaining)]);
	}
}

register_service('page.remove_font', 'page_remove_font', ['auth'=>true]);


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
	// check if there is a site favicon/custom fonts (only ever set on the
	// startpage, but no harm checking any page - it'll simply never be set
	// on others)
	if (!empty($obj['page-favicon-file'])) {
		delete_upload(['pagename'=>get_first_item(expl('.', $page)), 'file'=>$obj['page-favicon-file'], 'max_cnt'=>1]);
		$deleted = true;
	}
	if (!empty($obj['page-custom-fonts'])) {
		$fonts = @json_decode($obj['page-custom-fonts'], true);
		if (is_array($fonts)) {
			foreach ($fonts as $f) {
				if (!empty($f['file'])) {
					delete_upload(['pagename'=>get_first_item(expl('.', $page)), 'file'=>$f['file'], 'max_cnt'=>1]);
					$deleted = true;
				}
			}
		}
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
	}
	if (!empty($obj['page-custom-fonts'])) {
		$fonts = @json_decode($obj['page-custom-fonts'], true);
		if (is_array($fonts)) {
			foreach ($fonts as $f) {
				if (!empty($f['file']) && $f['file'] == $args['file']) {
					return true;
				}
			}
		}
	}
	return false;
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


/**
 *	the page's layout mode and container width
 *
 *	@param string $page page name (page.revision)
 *	@return array keys 'mode' ('infinite'|'centered') and 'width' (int px)
 */
function page_layout($page)
{
	$mode = 'infinite';
	$width = PAGE_DEFAULT_CONTAINER_WIDTH;
	$obj = load_object(['name'=>$page.'.page']);
	if (!$obj['#error']) {
		$obj = $obj['#data'];
		if (!empty($obj['page-layout-mode']) && $obj['page-layout-mode'] == 'centered') {
			$mode = 'centered';
		}
		if (!empty($obj['page-container-width'])) {
			$width = intval($obj['page-container-width']);
		}
	}
	if ($width < PAGE_MIN_CONTAINER_WIDTH) {
		$width = PAGE_MIN_CONTAINER_WIDTH;
	} elseif (PAGE_MAX_CONTAINER_WIDTH < $width) {
		$width = PAGE_MAX_CONTAINER_WIDTH;
	}
	return ['mode'=>$mode, 'width'=>$width];
}


/**
 *	remember where the page's objects begin in the body
 *
 *	render_object() appends each object to the body as an HTML STRING, not as an
 *	element tree, so the container cannot be built by moving child elements
 *	around - it has to be spliced into the markup. This runs before any object
 *	is rendered, so whatever is in the body now is what comes before them.
 */
function _page_body_offset($set = NULL)
{
	static $offset = 0;
	if ($set !== NULL) {
		$offset = $set;
	}
	return $offset;
}


/**
 *	wrap the page's objects in a centering container, in centered layout mode
 *
 *	The objects keep their exact stored coordinates: they stay
 *	position:absolute, and the wrapper is position:relative, so the origin they
 *	are measured from moves with the wrapper instead of being the page origin.
 *	Nothing about an object file changes, and switching modes is only a question
 *	of whether this wrapper is emitted.
 *
 *	margin:0 auto does the centering, in CSS, including on resize - but only for
 *	as long as nothing pins a pixel width on body. In the EDITOR something does:
 *	$.glue.canvas.update() sizes body to the content bounding box, which would
 *	center the container once and never again. js/edit.js branches on the mode
 *	for exactly that reason.
 *
 *	In INFINITE mode this emits nothing at all, so existing pages render exactly
 *	as they always have.
 */
function page_render_page_late($args)
{
	$layout = page_layout($args['page']);
	if ($args['edit']) {
		html_add_js_var('$.glue.conf.page.layout_mode', $layout['mode']);
		html_add_js_var('$.glue.conf.page.container_width', $layout['width']);
		html_add_js_var('$.glue.conf.page.container_min', PAGE_MIN_CONTAINER_WIDTH);
		html_add_js_var('$.glue.conf.page.container_max', PAGE_MAX_CONTAINER_WIDTH);
	}
	if ($layout['mode'] != 'centered') {
		return false;
	}

	$bdy = &body();
	if (!isset($bdy['val']) || !is_string($bdy['val'])) {
		return false;
	}
	$offset = _page_body_offset();
	if (strlen($bdy['val']) <= $offset) {
		// no objects on this page - nothing to center
		return false;
	}
	$before = substr($bdy['val'], 0, $offset);
	$objects = substr($bdy['val'], $offset);

	// position:relative is load bearing - without it the absolutely positioned
	// objects inside would resolve against the viewport instead of the container
	$bdy['val'] = $before.
		'<div id="hg-centered-wrapper" style="position: relative; width: '.
		intval($layout['width']).'px; margin: 0 auto;">'.nl().
		$objects.
		'</div>'.nl();
	return true;
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

	// note where the objects will start, for the centering container
	$bdy = &body();
	_page_body_offset(isset($bdy['val']) && is_string($bdy['val']) ? strlen($bdy['val']) : 0);
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
 *	set a page's layout mode and container width
 *
 *	@param array $args arguments
 *		key 'page' is the page (page.revision)
 *		key 'mode' is 'infinite' or 'centered' (optional)
 *		key 'width' is the container width in px (optional)
 *	@return array response
 *		true if successful
 */
function page_set_layout($args)
{
	if (empty($args['page'])) {
		return response('Required argument "page" missing', 400);
	}
	load_modules('glue');
	$update = ['name'=>$args['page'].'.page'];
	$remove = [];

	if (isset($args['mode'])) {
		if ($args['mode'] == 'centered') {
			$update['page-layout-mode'] = 'centered';
		} elseif ($args['mode'] == 'infinite') {
			// infinite is the default, so it is stored by ABSENCE - a page that
			// has never been switched keeps exactly the file it had
			$remove[] = 'page-layout-mode';
		} else {
			return response('Invalid layout mode '.quot($args['mode']), 400);
		}
	}

	if (isset($args['width'])) {
		$width = intval($args['width']);
		if ($width < PAGE_MIN_CONTAINER_WIDTH || PAGE_MAX_CONTAINER_WIDTH < $width) {
			return response('Container width must be between '.PAGE_MIN_CONTAINER_WIDTH.
				' and '.PAGE_MAX_CONTAINER_WIDTH.'px', 400);
		}
		$update['page-container-width'] = $width;
	}

	if (1 < count($update)) {
		$ret = update_object($update);
		if ($ret['#error']) {
			return $ret;
		}
	}
	foreach ($remove as $attr) {
		$ret = object_remove_attr(['name'=>$args['page'].'.page', 'attr'=>$attr]);
		if ($ret['#error']) {
			return $ret;
		}
	}
	return response(true);
}

register_service('page.set_layout', 'page_set_layout', ['auth'=>true]);


/**
 *	remember the last typeface picked via "change typeface", applied as
 *	the default for newly created text objects (see
 *	modules/text/text-edit.js) instead of the browser default - site-wide,
 *	stored on the startpage's own page-object like the other site settings
 *
 *	@param array $args arguments
 *		key 'font' the font-family string last selected
 *	@return array response
 */
function page_set_last_font($args)
{
	if (!isset($args['font']) || $args['font'] === '') {
		return response('Required argument "font" missing', 400);
	}
	load_modules('glue');
	return update_object(['name'=>startpage().'.page', 'page-last-text-font'=>$args['font']]);
}

register_service('page.set_last_font', 'page_set_last_font', ['auth'=>true]);


/**
 *	remember the last font size picked via "change font size", applied as
 *	the default for newly created text objects - same rationale as
 *	page_set_last_font()
 *
 *	@param array $args arguments
 *		key 'size' the font-size string last selected (e.g. '18px')
 *	@return array response
 */
function page_set_last_font_size($args)
{
	if (!isset($args['size']) || $args['size'] === '') {
		return response('Required argument "size" missing', 400);
	}
	load_modules('glue');
	return update_object(['name'=>startpage().'.page', 'page-last-text-font-size'=>$args['size']]);
}

register_service('page.set_last_font_size', 'page_set_last_font_size', ['auth'=>true]);


/**
 *	remember the last line height picked via "change line height", applied
 *	as the default for newly created text objects - same rationale as
 *	page_set_last_font()
 *
 *	@param array $args arguments
 *		key 'height' the line-height string last selected (e.g. '1.2em')
 *	@return array response
 */
function page_set_last_line_height($args)
{
	if (!isset($args['height']) || $args['height'] === '') {
		return response('Required argument "height" missing', 400);
	}
	load_modules('glue');
	return update_object(['name'=>startpage().'.page', 'page-last-text-line-height'=>$args['height']]);
}

register_service('page.set_last_line_height', 'page_set_last_line_height', ['auth'=>true]);


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
	// check if supported file: accept a recognized mime, or (since
	// browsers are inconsistent about reporting mime types for less common
	// formats, often falling back to a generic type that upload_files()
	// already clears to '') an empty mime paired with a recognized
	// extension - reject anything else, including an unrecognized *non*-
	// empty mime regardless of extension
	$mime_ok = in_array($args['mime'], ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/gif', 'image/svg+xml']);
	$ext_ok = in_array(filext($args['file']), ['ico', 'png', 'gif', 'svg']);
	if (!$mime_ok && !($args['mime'] == '' && $ext_ok)) {
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


/**
 *	implements upload for preferred_module 'page_font'
 *
 *	same rationale as page_favicon_upload() for being a standalone
 *	top-level function rather than a branch inside page_upload() - see its
 *	docblock
 */
function page_font_upload($args)
{
	// site-wide custom fonts: same storage/restriction rationale as
	// page_favicon_upload()
	if (empty($args['page']) || $args['page'] != startpage()) {
		return false;
	}
	// woff/woff2/ttf accepted - see module_text.inc.php's
	// _include_custom_font() for the format() mapping used when declaring
	// these via @font-face. Browsers are especially inconsistent about
	// reporting mime types for font files (often falling back to a generic
	// type that upload_files() already clears to ''), so an empty mime
	// paired with a recognized extension is accepted too - see
	// page_favicon_upload()'s identical reasoning
	$mime_ok = in_array($args['mime'], ['font/woff', 'application/font-woff', 'application/x-font-woff',
		'font/woff2', 'application/font-woff2', 'application/x-font-woff2',
		'font/ttf', 'font/sfnt', 'application/x-font-ttf', 'application/x-font-truetype']);
	$ext_ok = in_array(filext($args['file']), ['woff', 'woff2', 'ttf']);
	if (!$mime_ok && !($args['mime'] == '' && $ext_ok)) {
		return false;
	}

	load_modules('glue');
	$obj = load_object(['name'=>$args['page'].'.page']);
	$fonts = [];
	if (!$obj['#error'] && !empty($obj['#data']['page-custom-fonts'])) {
		$fonts = @json_decode($obj['#data']['page-custom-fonts'], true);
		if (!is_array($fonts)) {
			$fonts = [];
		}
	}

	if (10 <= count($fonts)) {
		// reject cleanly rather than returning false, which would fall
		// through to another module's generic upload handler and silently
		// store this as an unrelated object (e.g. a plain download) - the
		// file was already saved to disk by upload_files() before this
		// function was called, so it needs cleaning up here
		delete_upload(['pagename'=>get_first_item(expl('.', $args['page'])), 'file'=>$args['file'], 'max_cnt'=>1]);
		return 'limit';
	}

	// derive a font-family name from the filename, deduplicating against
	// any already-uploaded font of the same name
	$name = preg_replace('/[^A-Za-z0-9_-]/', '', pathinfo($args['file'], PATHINFO_FILENAME));
	if (empty($name)) {
		$name = 'Font';
	}
	$base = $name;
	$i = 2;
	while (in_array($name, array_column($fonts, 'name'))) {
		$name = $base.'-'.$i;
		$i++;
	}
	$fonts[] = ['file'=>$args['file'], 'name'=>$name];

	$ret = update_object(['name'=>$args['page'].'.page', 'page-custom-fonts'=>json_encode($fonts)]);
	if ($ret['#error']) {
		log_msg('error', 'page_font_upload: error updating page object: '.quot($ret['#data']));
		return false;
	} else {
		// the frontend needs both to show the new entry (and later remove
		// it) without a reload - $args['file'] is the server-assigned
		// stored filename, which can differ from the originally uploaded one
		return ['file'=>$args['file'], 'name'=>$name];
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
