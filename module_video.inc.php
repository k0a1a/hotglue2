<?php

/**
 *	module_video.inc.php
 *	Module for embedding video elements on a page
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
require_once('util.inc.php');


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


function video_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'video')) {
		return false;
	}
	
	// parse children elements to find video
	$childs = html_parse(elem_val($elem));
	$v = false;
	foreach ($childs as $c) {
		if (elem_tag($c) == 'video') {
			$v = $c;
			break;
		}
	}
	if (!$v) {
		log_msg('warn', 'video_alter_save: no video element found, inner html is '.var_dump_inl($childs));
		return false;
	}
	
	// autoplay
	if (elem_attr($v, 'autoplay') !== NULL) {
		$obj['video-autoplay'] = 'autoplay';
	} else {
		$obj['video-autoplay'] = '';
	}
	// loop
	if (elem_attr($v, 'loop') !== NULL) {
		$obj['video-loop'] = 'loop';
	} else {
		unset($obj['video-loop']);
	}
	// controls
	if (elem_attr($v, 'controls') !== NULL) {
		$obj['video-controls'] = 'controls';
	} else {
		unset($obj['video-controls']);
	}
	// volume
	if (elem_attr($v, 'audio') == 'muted') {
		$obj['video-volume'] = '0';
	} else {
		unset($obj['video-volume']);
	}
}


function video_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	
	load_modules('glue');
	if (!empty($obj['video-file'])) {
		$pn = array_shift(expl('.', $obj['name']));
		delete_upload(array('pagename'=>$pn, 'file'=>$obj['video-file'], 'max_cnt'=>1));
	}
}


function video_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	// symlinks have their referenced files in a different page that's why 
	// they are not relevant here
	if (@is_link(CONTENT_DIR.'/'.str_replace('.', '/', $obj['name']))) {
		return false;
	}
	
	if (!empty($obj['video-file']) && $obj['video-file'] == $args['file']) {
		return true;
	} else {
		return false;
	}
}


function video_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'video')) {
		return false;
	}
	
	// add a css (for viewing as well as editing)
	html_add_css(base_url().'modules/video/video.css');
	
	$v = elem('video');
	if (empty($obj['video-file'])) {
		elem_attr($v, 'src', '');
	} else {
		// TODO (later): support URLs as well
		if (SHORT_URLS) {
			elem_attr($v, 'src', base_url().urlencode($obj['name']));
		} else {
			elem_attr($v, 'src', base_url().'?'.urlencode($obj['name']));
		}
	}
	elem_css($v, 'width', '100%');
	elem_css($v, 'height', '100%');
	elem_css($v, 'preload', 'preload');
	// set some fallback text
	if (!empty($obj['video-file']) && !empty($obj['video-file-mime'])) {
		elem_val($v, '<div class="video-fallback">You are not seeing the video because your browser does not support '.htmlspecialchars($obj['video-file-mime'], ENT_NOQUOTES, 'UTF-8').'. Consider using a contemporary web browser.</div>');
	} else {
		elem_val($v, '<div class="video-fallback">You are not seeing the video because your browser does not support it. Consider using a contemporary web browser.</div>');
	}
	// autoplay
	if (!isset($obj['video-autoplay']) || $obj['video-autoplay'] == 'autoplay') {
		// autoplay is the default
		elem_attr($v, 'autoplay', 'autoplay');
	} else {
		if (VIDEO_START_ON_CLICK) {
			elem_attr($v, 'onclick', 'this.play()');
		}
	}
	// loop
	if (!empty($obj['video-loop'])) {
		elem_attr($v, 'loop', 'loop');
	}
	// controls
	if (!empty($obj['video-controls'])) {
		elem_attr($v, 'controls', 'controls');
	}
	// volume
	if (isset($obj['video-volume']) && $obj['video-volume'] == '0') {
		elem_attr($v, 'audio', 'muted');
	}
	elem_append($elem, $v);
	
	return true;
}


function video_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'video');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'video', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'video', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
	return $html;
}


function video_render_page_early($args)
{
	if ($args['edit']) {
		html_add_js(base_url().'modules/video/video-edit.js');
		html_add_css(base_url().'modules/video/video-edit.css');
	}
}


function video_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (array_shift(elem_classes($elem)) != 'video') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'video';
	$obj['module'] = 'video';
	
	// hook
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'video_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function video_serve_resource($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	
	if (!empty($obj['video-file'])) {
		$pn = array_shift(expl('.', $obj['name']));
		if (empty($obj['video-file-mime'])) {
			$obj['video-file-mime'] = '';
		}
		serve_file(CONTENT_DIR.'/'.$pn.'/shared/'.$obj['video-file'], $args['dl'], $obj['video-file-mime']);
	}
	
	return false;
}


function video_snapshot_symlink($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	
	$dest_dir = CONTENT_DIR.'/'.array_shift(expl('.', $obj['name'])).'/shared';
	$src_file = CONTENT_DIR.'/'.array_shift(expl('.', $args['origin'])).'/shared/'.$obj['video-file'];
	
	if (($f = dir_has_same_file($dest_dir, $src_file)) !== false) {
		$obj['video-file'] = $f;
	} else {
		// copy file
		$dest_file = $dest_dir.'/'.unique_filename($dest_dir, $src_file);
		$m = umask(0111);
		if (!(@copy($src_file, $dest_file))) {
			umask($m);
			log_msg('error', 'video_snapshot_symlink: error copying referenced file '.quot($src_file).' to '.quot($dest_file));
			return false;
		}
		umask($m);
		$obj['video-file'] = basename($dest_file);
		log_msg('info', 'video_snapshot_symlink: copied referenced file to '.quot($dest_file));
	}
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'video_snapshot_symlink: error saving object '.quot($obj['name']));
		return false;
	} else {
		return true;
	}
}


function video_upload($args)
{
	$ext = filext($args['file']);
	if ($args['mime'] == 'video/ogg' || $ext == 'ogv' || $ext == 'ogg') {
		// notice: we also handle ogg here although this also could be a 
		// different mime type
		// make sure mime type is set
		$mime = 'video/ogg';
	} elseif ($args['mime'] == 'video/h264' || $ext == 'h264') {
		// haven't seen these out there
		$mime = 'video/h264';
	} elseif ($args['mime'] == 'video/mp4' || $ext == 'mp4') {
		// think this need not be h264, but well
		$mime = 'video/mp4';
	} elseif ($args['mime'] == 'video/webm' || $ext == 'webm') {
		// again, webm could also be audio/webm
		$mime = 'video/webm';
	} else {
		return false;
	}
	
	load_modules('glue');
	$obj = create_object($args);
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	$obj['type'] = 'video';
	$obj['module'] = 'video';
	$obj['video-file'] = $args['file'];
	$obj['video-file-mime'] = $mime;
	save_object($obj);
	
	$ret = render_object(array('name'=>$obj['name'], 'edit'=>true));
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}


?>