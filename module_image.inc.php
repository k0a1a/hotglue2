<?php

/*
 *	module_image.inc.php
 *	Module for displaying images uploaded by the user
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');
// module glue gets loaded on demand
require_once('util.inc.php');


/**
 *	return if GD image functions are available
 *
 *	@return bool
 */
function _gd_available()
{
	return function_exists('gd_info');
}


/**
 *	return the width and height of an image file
 *
 *	@param string $f filename
 *
 *	@return array with width and height in pixels
 */
function _gd_get_imagesize($f)
{
	$ret = @getimagesize($f);
	if ($ret === false) {
		return [0, 0];
	} else {
		return [$ret[0], $ret[1]];
	}
}


/**
 *	fill in image-file-{width,height} (and default object-{width,height}
 *	if not already set) for an image object that doesn't have them yet,
 *	persisting the result
 *
 *	must be called before invoke_hook_first('alter_render_early', 'image',
 *	...) in image_render_object(), not from within the hook itself -
 *	invoke_hook() passes the same $args array by value to every hook it
 *	calls, so a reassignment made inside image_alter_render_early() would
 *	only be visible to itself, not to object_alter_render_early()
 *	(dispatched afterwards in the same pass), which sets the container
 *	div's width/height CSS from object-width/object-height - it would see
 *	the pre-backfill (missing) values on the very first render of a newly
 *	uploaded image, only correcting itself on the next reload. See
 *	video_render_object()'s equivalent fix for video-file dimensions.
 *
 *	@param array $obj
 *	@return array the (possibly updated) object
 */
function _image_finalize_dimensions($obj)
{
	if (!empty($obj['image-file']) && (empty($obj['image-file-width']) || intval($obj['image-file-width']) == 0)) {
		$a = expl('.', $obj['name']);
		$fn = CONTENT_DIR.'/'.$a[0].'/shared/'.$obj['image-file'];
		// resolve symlinks
		if (@is_link($fn)) {
			$target = @readlink($fn);
			if (substr($target, 0, 1) == '/') {
				$fn = $target;
			} else {
				$fn = dirname($fn).'/'.$target;
			}
		}
		$size = _image_size($fn);
		if ($size !== false) {
			$obj['image-file-width'] = $size[0];
			// update regular with as well if not set
			if (empty($obj['object-width']) || intval($obj['object-width']) == 0) {
				$obj['object-width'] = $size[0].'px';
			}
			$obj['image-file-height'] = $size[1];
			if (empty($obj['object-height']) || intval($obj['object-height']) == 0) {
				$obj['object-height'] = $size[1].'px';
			}
		}
		save_object($obj);
	}
	return $obj;
}


/**
 *	return the dimensions of an SVG file: the root element's width/height
 *	attributes in px when present, the viewBox as the fallback, a 200x200
 *	default when neither says. GD cannot read SVGs, so this little parse
 *	is their only size source.
 *
 *	@param string $file filename
 *
 *	@return array with width and height
 */
function _svg_dimensions($file)
{
	$h = @fopen($file, 'r');
	if (!$h) {
		return [200, 200];
	}
	// the root element always sits in the first chunk
	$head = fread($h, 4096);
	fclose($h);
	$w = false;
	$hh = false;
	if (preg_match('/<svg\b[^>]*>/i', $head, $m)) {
		$tag = $m[0];
		if (preg_match('/\bwidth\s*=\s*["\']([0-9]+)(?:px)?["\']/i', $tag, $a)) {
			$w = intval($a[1]);
		}
		if (preg_match('/\bheight\s*=\s*["\']([0-9]+)(?:px)?["\']/i', $tag, $a)) {
			$hh = intval($a[1]);
		}
		// the last two numbers of the viewBox are its width and height
		if ((!$w || !$hh) && preg_match('/\bviewBox\s*=\s*["\'][-0-9. ]+?\s([0-9.]+)\s+([0-9.]+)\s*["\']/i', $tag, $a)) {
			if (!$w) {
				$w = intval(round(floatval($a[1])));
			}
			if (!$hh) {
				$hh = intval(round(floatval($a[2])));
			}
		}
	}
	return [($w > 0 ? $w : 200), ($hh > 0 ? $hh : 200)];
}


/**
 *	return a size for an image file: the svg parser for vectors (GD cannot
 *	read them), _gd_get_imagesize() for everything else when gd is there
 *
 *	@param string $fn filename
 *	@return array with width and height, or false
 */
function _image_size($fn)
{
	if (filext($fn) == 'svg') {
		return _svg_dimensions($fn);
	} elseif (_gd_available()) {
		return _gd_get_imagesize($fn);
	}
	return false;
}


/**
 *	implements alter_render_early
 *
 *	see image_render_object()
 */
function image_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'image')) {
		return false;
	}
	// note: image-file-{width,height} backfill already happened in
	// image_render_object() before this hook ran, see
	// _image_finalize_dimensions()

	// setup url
	// note: the url points to the object name, not the
	// filename in the shared directory (the file eventually gets served
	// in image_serve_resource())
	// kept relative (not prefixed with base_url()) so it still resolves
	// correctly when viewed through a different domain than the one
	// configured/detected as the base url - see module_object.inc.php's
	// object_alter_render_late() for the full rationale
	// TODO (later): support URLs as well
	if (SHORT_URLS) {
		$url = urlencode($obj['name']);
	} else {
		$url = '?'.urlencode($obj['name']);
	}
	
	// accessibility (SOW-accessibility.md): image-alt is the description,
	// image-decorative marks the image as pure decoration. The legacy
	// image-title still acts as the fallback description.
	$decorative = !empty($obj['image-decorative']);
	$alt = isset($obj['image-alt']) ? $obj['image-alt']
		: (isset($obj['image-title']) ? $obj['image-title'] : '');

	// the picture is always a child img filling the frame (danja's call,
	// 2026-09-23). The object's own background-image used to carry it,
	// which put the picture and the object's background section in each
	// other's way - the panel had to skip the section for image objects,
	// and an unproportionally resized frame could leave the picture at
	// its natural size with bars where the background showed through.
	// The img stretches with the frame, and the background properties
	// belong to the background section alone.
	$i = elem('img');
	elem_attr($i, 'src', $url);
	if ($decorative) {
		// a decorative image must have EMPTY alt text and the role
		// says so explicitly, so screen readers skip it
		elem_attr($i, 'alt', '');
		elem_attr($i, 'role', 'presentation');
	} else {
		elem_attr($i, 'alt', $alt);
	}
	elem_css($i, 'width', '100%');
	elem_css($i, 'height', '100%');
	// the picture keeps its proportions: it letterboxes inside the frame,
	// and the bars show the object's background colour or image through -
	// that is deliberate, danja's call 2026-09-23
	elem_css($i, 'object-fit', 'contain');
	// in the editor the picture must not swallow the clicks meant for the
	// object (select, menus) - the img fills the frame, so it covers
	// every pixel; a visitor's page never needs to click through it
	if ($args['edit']) {
		elem_css($i, 'pointer-events', 'none');
	}
	// make sure you only append to the element in alter_render_early
	// handlers, don't assume that nothing is in there yet
	elem_append($elem, $i);

	// additional properties for both
	if (!empty($obj['image-title'])) {
		elem_attr($elem, 'title', $obj['image-title']);
	}

	return true;
}


/**
 *	implements alter_save
 *
 *	see image_save_state()
 */
function image_alter_save($args)
{
	$elem = $args['elem'];
	// make sure that obj is a reference to the other object here
	$obj = &$args['obj'];
	// only handle the element when we are one of its classes
	// notice the difference to image_save_state()?
	if (!elem_has_class($elem, 'image')) {
		return false;
	}
	
	// update the object based on the element's properties
	// by convention all properties are prefixed with the module name, in order
	// to prevent any naming collisions
	// note: the legacy image-background-repeat/-position are no longer read
	// or rendered (the picture is a child img now) - attrs already in
	// content stay stored but inert

	// accessibility round-trip (SOW-accessibility.md): the serialized DOM
	// carries role/alt on the img child (the picture is always a child
	// img). save_state() parses the object non-recursively, so the img
	// child has to be fished out of the raw inner HTML.
	$stored_alt = '';
	if (is_string(elem_val($elem)) && preg_match('#<img\b[^>]*>#i', elem_val($elem), $m)) {
		$img = html_parse_elem($m[0]);
		if (elem_attr($img, 'role') === 'presentation') {
			$obj['image-decorative'] = 'yes';
			unset($obj['image-alt']);	// decorative implies empty alt
		} else {
			unset($obj['image-decorative']);
			$stored_alt = elem_attr($img, 'alt');
			if ($stored_alt !== '' && $stored_alt !== @$obj['image-title']) {
				$obj['image-alt'] = $stored_alt;
			} else {
				// empty, or identical to the legacy image-title (the render
				// fallback covers that) - keep the file byte-idempotent
				unset($obj['image-alt']);
			}
		}
	} else {
		unset($obj['image-decorative']);
		unset($obj['image-alt']);
	}

	// this is more out of courtesy than anything else
	return true;
}


/**
 *	implements delete_object
 */
function image_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'image') {
		return false;
	}
	// we don't have to care about symlinks here as this hook is not called 
	// for those
	
	load_modules('glue');
	// delete original file
	if (!empty($obj['image-file'])) {
		$a = expl('.', $obj['name']);
		delete_upload(['pagename'=>$a[0], 'file'=>$obj['image-file'], 'max_cnt'=>1]);
	}
	// and resized one
	if (!empty($obj['image-resized-file'])) {
		$a = expl('.', $obj['name']);
		delete_upload(['pagename'=>$a[0], 'file'=>$obj['image-resized-file'], 'max_cnt'=>1]);
	}
}


/**
 *	implements has_reference
 */
function image_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'image') {
		return false;
	}
	// symlinks have their referenced files in a different page that's why 
	// they are not relevant here
	if (@is_link(CONTENT_DIR.'/'.str_replace('.', '/', $obj['name']))) {
		return false;
	}
	
	if (!empty($obj['image-file']) && $obj['image-file'] == $args['file']) {
		return true;
	}
	if (!empty($obj['image-resized-file']) && $obj['image-resized-file'] == $args['file']) {
		return true;
	}
	
	return false;
}


/**
 *	implements render_object
 */
function image_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'image') {
		return false;
	}
	// must happen before the hook dispatch below - see
	// _image_finalize_dimensions()
	$obj = _image_finalize_dimensions($obj);

	// the outer element must be a div or something else that can contain
	// other elements
	// we only set up the most basic element here - all the other work is 
	// done inside the alter_render_early hook
	// this way also object that "derive" from this (which don't have their 
	// $obj['type'] set to image) can use this code
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'image');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hook
	// elem is passed as reference here
	// it is suggested that we first call our own function before any others 
	// that might want to modify the element that is being set up
	invoke_hook_first('alter_render_early', 'image', ['obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']]);
	$html = elem_finalize($e);
	// html is passed as reference here
	// it is suggested that we call our own function after all others
	invoke_hook_last('alter_render_late', 'image', ['obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']]);
	
	return $html;
}

register_hook('alter_render_early', 'invoked early in the object rendering process (possible to change array representation)');
register_hook('alter_render_late', 'invoked late in the object rendering process (possible to change html string)');


/**
 *	implements render_page_early
 */
function image_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/image/image-edit.min.js');
		} else {
			html_add_js(base_url().'modules/image/image-edit.js');
		}
		if (!_gd_available()) {
			html_add_js_var('$.glue.conf.image.resizing', false);
			log_msg('debug', 'image: disabling image resizing as gd is not available');
		} else {
			html_add_js_var('$.glue.conf.image.resizing', IMAGE_RESIZING);		
		}
		html_add_js_var('$.glue.conf.image.upload_resize_larger', IMAGE_UPLOAD_RESIZE_LARGER);
		html_add_js_var('$.glue.conf.image.upload_resize_to', IMAGE_UPLOAD_RESIZE_TO);
		html_add_js_var('$.glue.conf.image.upload_max_width', IMAGE_UPLOAD_MAX_WIDTH);
		html_add_js_var('$.glue.conf.image.upload_max_height', IMAGE_UPLOAD_MAX_HEIGHT);
		html_add_js_var('$.glue.conf.image.resize_max_dpr', IMAGE_RESIZE_MAX_DPR);
	}
}

/**
 *	determine if file is animated gif
 *	
 *	function takes filename and returns 'true' if the file header contains
 *	multiple frames:
 *	* a static 4-byte sequence (\x00\x21\xF9\x04)
 *	* 4 variable bytes
 *	* a static 2-byte sequence (\x00\x2C) (some variants may use \x00\x21 ?)
 *	
 *	based on: http://www.php.net/manual/en/function.imagecreatefromgif.php#104473
 */
function is_ani($filename) {
	if(!($fh = @fopen($filename, 'rb')))
		return false;
	$count = 0;
	while(!feof($fh) && $count < 2) {
		$chunk = fread($fh, 1024 * 100); //read 100kb at a time
		$count += preg_match_all('#\x00\x21\xF9\x04.{4}\x00(\x2C|\x21)#s', $chunk, $matches);
	}
	fclose($fh);
	return $count > 1;
}

/**
 *	resize an image object
 *
 *	this function drops the reference to any currently resized version, 
 *	saves the resized image together with the original image in the page's 
 *	shared folder and updates the object file to use the resized version.
 *	@param array $args arguments
 *		key 'name' name of the objects
 *		key 'width' width in px
 *		key 'height' height in px
 *	@return array response
 *		true if the client is advised to reload the image, false if not
 */
function image_resize($args)
{
	// check for gd
	if (!_gd_available()) {
		return response('Host does not have gd', 500);
	}
	// set requested width & height
	if (($width = @intval($args['width'])) == 0) {
		return response('Required argument "width" is zero or does not exist', 400);
	}
	if (($height = @intval($args['height'])) == 0) {
		return response('Required argument "height" is zero or does not exist', 400);
	}
	load_modules('glue');
	// resolve symlinks
	$ret = object_get_symlink($args);
	if ($ret['#error']) {
		return $ret;
	} elseif ($ret['#data'] !== false) {
		log_msg('debug', 'image_resize: resolved object '.quot($args['name']).' into '.quot($ret['#data']));
		$args['name'] = $ret['#data'];
	}	
	// load object
	$obj = load_object($args);
	if ($obj['#error']) {
		return $obj;
	} else {
		$obj = $obj['#data'];
	}
	if (@intval($obj['image-file-width']) == 0 || @intval($obj['image-file-height']) == 0) {
		return response('Original dimensions are not available', 500);
	}
	// SVG is vector: the original scales losslessly to any frame, and GD
	// cannot read it to rasterize anyway - no resized variant, ever
	if (filext($obj['image-file']) == 'svg') {
		return response(false);
	}
	// set pagename
	$pn = get_first_item(expl('.', $obj['name']));
	
	// resizing might not be necessary at all
	if (!empty($obj['image-resized-file']) && @intval($obj['image-resized-width']) == $width && @intval($obj['image-resized-height']) == $height) {
		log_msg('debug', 'image_resize: width and height match the current resized file, no resize necessary');
		return response(false);
	}
	
	// else remove any currently resized file
	if (!empty($obj['image-resized-file'])) {
		log_msg('info', 'image_resize: dropping reference to previous resized file '.quot($obj['image-resized-file']));
		delete_upload(['pagename'=>$pn, 'file'=>$obj['image-resized-file'], 'max_cnt'=>1]);
		unset($obj['image-resized-file']);
		unset($obj['image-resized-width']);
		unset($obj['image-resized-height']);
		// update object file as well
		$ret = object_remove_attr(['name'=>$obj['name'], 'attr'=>['image-resized-file', 'image-resized-width', 'image-resized-height']]);
		if ($ret['#error']) {
			return $ret;
		}
		$was_resized = true;
	} else {
		$was_resized = false;
	}
	
	// check if width or height are larger than the original
	if (@intval($obj['image-file-width']) <= $width || @intval($obj['image-file-height']) <= $height) {
		log_msg('debug', 'image_resize: dimensions requested are larger or equal than the original file is, no resize necessary');
		// the client need not reload the the image if we were using the 
		// original before
		if (!$was_resized) {
			return response(false);
		} else {
			return response(true);
		}
	}
	
	// check if we really have a source image
	if (empty($obj['image-file-mime']) && empty($obj['image-file'])) {
		return response(false);
	}
	
	// TODO (later): make this a generic function
	// load source file
	$ext = filext($obj['image-file']);
	$fn = CONTENT_DIR.'/'.$pn.'/shared/'.$obj['image-file'];
	if ($obj['image-file-mime'] == 'image/jpeg' || in_array($ext, ['jpg', 'jpeg'])) {
		$orig = @imagecreatefromjpeg($fn);
		$dest_ext = 'jpg';
	} elseif ($obj['image-file-mime'] == 'image/png' || $ext == 'png') {
		$orig = @imagecreatefrompng($fn);
		$dest_ext = 'png';
	} elseif (is_ani($fn)) {
		// animated images shall not be resized
		log_msg('debug', 'image_resize: animated image, not resizing');
		return response(true);
	} elseif ($obj['image-file-mime'] == 'image/gif' || $ext == 'gif') {
		$orig = @imagecreatefromgif($fn);
		// save gifs as png
		// TODO (later): check for animated gif (see php.net/manual/en/function.imagecreatefromgif.php)
		$dest_ext = 'png';
	} elseif (($obj['image-file-mime'] == 'image/webp' || $ext == 'webp') && function_exists('imagecreatefromwebp')) {
		$orig = @imagecreatefromwebp($fn);
		$dest_ext = 'webp';
	} else {
		return response('Unsupported source file format '.quot($obj['image-file']), 500);
	}
	if ($orig === false) {
		return response('Error loading source file '.quot($obj['image-file']), 500);
	}
	// get source file dimensions
	$orig_size = @getimagesize($fn);
	// create resized image
	if (($resized = @imagecreatetruecolor($width, $height)) === false) {
		@imagedestroy($orig);
		return response('Error creating the resized image', 500);
	}
	// preserve any alpha channel
	@imagealphablending($resized, false);
	@imagesavealpha($resized, true);
	// try to resize
	if (!@imagecopyresampled($resized, $orig, 0, 0, 0, 0, $width, $height, $orig_size[0], $orig_size[1])) {
		@imagedestroy($resized);
		@imagedestroy($orig);
		return response('Error resizing the source image', 500);
	}
	// setup destination filename
	$a = expl('.', $obj['image-file']);
	if (1 < count($a)) {
		// throw the previous extension away
		$fn = CONTENT_DIR.'/'.$pn.'/shared/'.implode('.', array_slice($a, 0, -1)).'-'.$width.'x'.$height.'.'.$dest_ext;
	} else {
		$fn = CONTENT_DIR.'/'.$pn.'/shared/'.$a[0].'-'.$width.'x'.$height.'.'.$dest_ext;
	}
	$m = umask(0111);
	if ($dest_ext == 'jpg') {
		$ret = @imagejpeg($resized, $fn, IMAGE_JPEG_QUAL);
	} else if ($dest_ext == 'png') {
		// preserve any alpha channel
		@imagealphablending($resized, false);
		@imagesavealpha($resized, true);
		$ret = @imagepng($resized, $fn, IMAGE_PNG_QUAL);
	} else if ($dest_ext == 'webp') {
		// preserve any alpha channel
		@imagealphablending($resized, false);
		@imagesavealpha($resized, true);
		$ret = @imagewebp($resized, $fn, IMAGE_WEBP_QUAL);
	}
	umask($m);
	// destroy images again
	@imagedestroy($resized);
	@imagedestroy($orig);
	if (!$ret) {
		return response('Error saving the resized image', 500);
	} else {
		log_msg('info', 'image_resize: created a resized image of '.quot($obj['name']).' -> '.quot(basename($fn)));
	}
	
	// the code above can take a while, so read in the object anew via 
	// update_object()
	$update = [];
	$update['name'] = $obj['name'];
	$update['image-resized-file'] = basename($fn);
	$update['image-resized-width'] = $width;
	$update['image-resized-height'] = $height;
	// we change width and height here as well since we are racing with the 
	// save_object from the frontend after resize
	$update['object-width'] = $width.'px';
	$update['object-height'] = $height.'px';
	
	return update_object($update);
}

register_service('image.resize', 'image_resize', ['auth'=>true]);


/**
 *	implements save_state
 */
function image_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	// only take responsibility for the element when we are its main class
	if (get_first_item(elem_classes($elem)) != 'image') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'image';
	$obj['module'] = 'image';
	
	// by convention the main retrieving of the elements properties takes 
	// place in alter_state
	// this way other objects types may "derive" from this one
	// it also allows other modules to chime in
	// notice: obj is passed as reference here
	// obj might be (almost) empty for newly created objects, so rely only 
	// on $elem
	invoke_hook('alter_save', ['obj'=>&$obj, 'elem'=>$elem]);
	// see image_alter_save() above
	
	// we could do some overriding here if we wanted to
	
	// finally save the object
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'image_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}

register_hook('alter_save', 'invoked in the object saving process (possible to augment the object to be saved)');


/**
 *	implements serve_resource
 */
function image_serve_resource($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'image') {
		return false;
	}
	// we don't have to care about symlinks here as they are being resolved 
	// before this hook is called
	$pn = get_first_item(expl('.', $obj['name']));
	
	if (!empty($obj['image-resized-file']) && !$args['dl']) {
		// we have a resized file and don't want to download the original
		$fn = CONTENT_DIR.'/'.$pn.'/shared/'.$obj['image-resized-file'];
		$ext = filext($fn);
		if ($ext == 'jpg' || $ext == 'jpeg') {
			serve_file($fn, false, 'image/jpeg');
		} else if ($ext == 'png') {
			serve_file($fn, false, 'image/png');
		} else if ($ext == 'webp') {
			serve_file($fn, false, 'image/webp');
		} else {
			log_msg('warn', 'image_serve_resource: unsupported image-resized-file '.quot($fn));
		}
		// if we're still alive it means that the resized file has not been 
		// found
		log_msg('warn', 'image_serve_resource: could not serve image-resized-file '.quot($fn).', falling back to original');
		$need_auth = false;
	} elseif (empty($obj['image-resized-file'])) {
		// we don't have a resized file
		$need_auth = false;
	} else {
		// we really want to download the original
		$need_auth = true;
	}
	
	if (!empty($obj['image-file'])) {
		// we have the original file
		if ($need_auth && !is_auth()) {
			// require authentication
			prompt_auth(true);
		}
		if (empty($obj['image-file-mime'])) {
			$obj['image-file-mime'] = '';
		}
		// an SVG served inline is an active document: a script inside it
		// would run in the site's own origin when the URL is opened
		// directly (the render only ever shows it through an <img>, where
		// scripts never execute, but the direct URL is anyone's to visit).
		// The sandbox CSP renders the document inert - no scripts, no
		// navigation - while it still paints inside an <img> or a
		// background, and the download path (an attachment, not a
		// document) is unaffected.
		if ($obj['image-file-mime'] == 'image/svg+xml' && !$args['dl']) {
			header('Content-Security-Policy: sandbox');
		}
		serve_file(CONTENT_DIR.'/'.$pn.'/shared/'.$obj['image-file'], $args['dl'], $obj['image-file-mime']);
	}
	
	// if everything fails
	return false;
}


/**
 *	implements upload
 */
function image_upload($args)
{
	// check if supported file
	if (!in_array($args['mime'], ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']) || ($args['mime'] == '' && !in_array(filext($args['file']), ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']))) {
		return false;
	}

	load_modules('glue');
	// create new object
	$obj = create_object($args);
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	$obj['type'] = 'image';
	// this is for a potential future speedup
	$obj['module'] = 'image';
	$obj['image-file'] = $args['file'];
	$obj['image-file-mime'] = $args['mime'];
	// save original-{width,height} if we can calculate it
	$a = expl('.', $args['page']);
	$size = _image_size(CONTENT_DIR.'/'.$a[0].'/shared/'.$obj['image-file']);
	if ($size !== false) {
		$obj['image-file-width'] = $size[0];
		$obj['object-width'] = $size[0].'px';
		$obj['image-file-height'] = $size[1];
		$obj['object-height'] = $size[1].'px';
	}
	save_object($obj);
	
	// render object and return html
	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	log_msg('debug', 'image_upload: '.print_r($ret, 1));
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}
