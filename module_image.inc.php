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
		return array(0, 0);
	} else {
		return array($ret[0], $ret[1]);
	}
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
	
	// try to calculate original-{width,height} if not already set
	if (!empty($obj['image-file']) && (empty($obj['image-file-width']) || intval($obj['image-file-width']) == 0)) {
		if (_gd_available()) {
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
			$size = _gd_get_imagesize($fn);
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
	
	// setup url
	// note: the url points to the object name, not the 
	// filename in the shared directory (the file eventually gets served 
	// in image_serve_resource())
	// TODO (later): support URLs as well
	if (SHORT_URLS) {
		$url = base_url().urlencode($obj['name']);
	} else {
		$url = base_url().'?'.urlencode($obj['name']);
	}
	
	// render a div with background if we have original-{width,height}
	// otherwise a div with an img inside
	if (empty($obj['image-file-width']) || intval($obj['image-file-width']) == 0) {
		// render a div with an img inside
		$i = elem('img');
		elem_attr($i, 'src', $url);
		if (!empty($obj['image-title'])) {
			elem_attr($i, 'alt', $obj['image-title']);
		} else {
			elem_attr($i, 'alt', '');
		}
		// make sure you only append to the element in alter_render_early 
		// handlers, don't assume that nothing is in there yet
		elem_append($elem, $i);
	} else {
		if (!$args['edit'] && IE8_COMPAT && (empty($obj['image-background-repeat']) || $obj['image-background-repeat'] == 'no-repeat')) {
			// background-size is not supported by IE8, so render a div with an img inside instead
			$i = elem('img');
			elem_attr($i, 'src', $url);
			if (!empty($obj['image-title'])) {
				elem_attr($i, 'alt', $obj['image-title']);
			} else {
				elem_attr($i, 'alt', '');
			}
			elem_css($i, 'width', '100%');
			elem_css($i, 'height', '100%');
			elem_css($i, 'padding', '0px');
			elem_css($i, 'border', '0px');
			if (!empty($obj['image-background-position']) && $obj['image-background-position'] != '0px 0px' && $obj['image-background-position'] != '0% 0%') {
				elem_css($elem, 'max-width', $obj['object-width']);
				elem_css($elem, 'max-height', $obj['object-height']);
				elem_css($elem, 'overflow', 'hidden');
				// assume px
				$a = expl(' ', $obj['image-background-position']);
				elem_css($i, 'margin-left', @intval($a[0]).'px');
				elem_css($i, 'margin-top', @intval($a[1]).'px');
				elem_css($i, 'margin-right', '0px');
				elem_css($i, 'margin-bottom', '0px');
			} else {
				elem_css($i, 'margin', '0px');
			}
			elem_append($elem, $i);
		} else {
			// this is the regular case
			// render a div with background
			elem_css($elem, 'background-image', 'url('.$url.')');
			// default to no tiling
			if (empty($obj['image-background-repeat']) || $obj['image-background-repeat'] == 'no-repeat') {
				elem_css($elem, 'background-repeat', 'no-repeat');
				// set hardcoded background-size as well
				elem_css($elem, 'background-size', '100% 100%');
				// this is for Firefox 3.6
				elem_css($elem, '-moz-background-size', '100% 100%');
			} else {
				elem_css($elem, 'background-repeat', $obj['image-background-repeat']);
			}
			if (!empty($obj['image-background-position'])) {
				elem_css($elem, 'background-position', $obj['image-background-position']);
			}
		}
	}
	
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
	if (elem_css($elem, 'background-repeat') !== NULL) {
		$val = elem_css($elem, 'background-repeat');
		// normalize
		if ($val == 'no-repeat no-repeat') {
			$val = 'no-repeat';
		}
		$obj['image-background-repeat'] = $val;
	} else {
		unset($obj['image-background-repeat']);
	}
	if (elem_css($elem, 'background-position') !== NULL) {
		$obj['image-background-position'] = elem_css($elem, 'background-position');
	} else {
		unset($obj['image-background-position']);
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
		delete_upload(array('pagename'=>$a[0], 'file'=>$obj['image-file'], 'max_cnt'=>1));
	}
	// and resized one
	if (!empty($obj['image-resized-file'])) {
		$a = expl('.', $obj['name']);
		delete_upload(array('pagename'=>$a[0], 'file'=>$obj['image-resized-file'], 'max_cnt'=>1));
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
	invoke_hook_first('alter_render_early', 'image', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	// html is passed as reference here
	// it is suggested that we call our own function after all others
	invoke_hook_last('alter_render_late', 'image', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
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
	// set pagename
	$pn = get_first_item(expl('.', $obj['name']));
	
	// resizing might not be necessary at all
	if (!empty($obj['image-resized-file']) && @intval($obj['image-resized-width']) == $width && @intval($obj['image-resized-height'] == $height)) {
		log_msg('debug', 'image_resize: width and height match the current resized file, no resize necessary');
		return response(false);
	}
	
	// else remove any currently resized file
	if (!empty($obj['image-resized-file'])) {
		log_msg('info', 'image_resize: dropping reference to previous resized file '.quot($obj['image-resized-file']));
		delete_upload(array('pagename'=>$pn, 'file'=>$obj['image-resized-file'], 'max_cnt'=>1));
		unset($obj['image-resized-file']);
		unset($obj['image-resized-width']);
		unset($obj['image-resized-height']);
		// update object file as well
		$ret = object_remove_attr(array('name'=>$obj['name'], 'attr'=>array('image-resized-file', 'image-resized-width', 'image-resized-height')));
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
	if ($obj['image-file-mime'] == 'image/jpeg' || in_array($ext, array('jpg', 'jpeg'))) {
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
	$update = array();
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

register_service('image.resize', 'image_resize', array('auth'=>true));


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
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
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
		serve_file(CONTENT_DIR.'/'.$pn.'/shared/'.$obj['image-file'], $args['dl'], $obj['image-file-mime']);
	}
	
	// if everything fails
	return false;
}


/**
 *	implements snapshot_symlink
 *
 *	see snapshot() in module_glue.inc.php
 */
function image_snapshot_symlink($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'image') {
		return false;
	}
	
	// consider the following:
	// * an image object is on page a, which at some point got distributed to all 
	// other pages through symlinks
	// * we are now creating a snapshot of any page b, come across the symlink 
	// pointing to an object and page a
	// in this case we don't copy the symlink but the current content of the 
	// object, as we by all means want to preserve the current _state_ we copy 
	// the symlink's content (this happens in snapshot() in module_glue.inc.php) 
	// - thus turning it into a first-class object on the new snapshot-page
	// because of this we need to copy any referenced files as well from the 
	// shared directory in page a to the one on page b, this happens in this 
	// hook
	
	$dest_dir = CONTENT_DIR.'/'.get_first_item(expl('.', $obj['name'])).'/shared';
	$src_dir = CONTENT_DIR.'/'.get_first_item(expl('.', $args['origin'])).'/shared';
	
	// we do this for image-file and image-resized-file
	// .. to add a bit of complexity ;)
	foreach (array('image-file', 'image-resized-file') as $field) {
		if (empty($obj[$field])) {
			continue;
		} else {
			$src_file = $src_dir.'/'.$obj[$field];
		}
		if (($f = dir_has_same_file($dest_dir, $src_file)) !== false) {
			$obj[$field] = $f;
		} else {
			// copy file
			$dest_file = $dest_dir.'/'.unique_filename($dest_dir, $src_file);
			$m = umask(0111);
			if (!(@copy($src_file, $dest_file))) {
				umask($m);
				log_msg('error', 'image_snapshot_symlink: error copying referenced file '.quot($src_file).' to '.quot($dest_file));
				return false;
			}
			umask($m);
			$obj[$field] = basename($dest_file);
			log_msg('info', 'image_snapshot_symlink: copied referenced file to '.quot($dest_file));
		}
	}
	
	// save changes in the object
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'image_snapshot_symlink: error saving object '.quot($obj['name']));
		return false;
	} else {
		return true;
	}
}


/**
 *	implements upload
 */
function image_upload($args)
{
	// check if supported file
	if (!in_array($args['mime'], array('image/jpeg', 'image/png', 'image/gif')) || ($args['mime'] == '' && !in_array(filext($args['file']), array('jpg', 'jpeg', 'png', 'gif')))) {
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
	if (_gd_available()) {
		$a = expl('.', $args['page']);
		$size = _gd_get_imagesize(CONTENT_DIR.'/'.$a[0].'/shared/'.$obj['image-file']);
		$obj['image-file-width'] = $size[0];
		$obj['object-width'] = $size[0].'px';
		$obj['image-file-height'] = $size[1];
		$obj['object-height'] = $size[1].'px';
	}
	save_object($obj);
	
	// render object and return html
	$ret = render_object(array('name'=>$obj['name'], 'edit'=>true));
	log_msg('debug', 'image_upload: '.print_r($ret, 1));
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}
