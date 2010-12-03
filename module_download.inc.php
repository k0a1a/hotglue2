<?php

/**
 *	module_download.inc.php
 *	Module for allowing to download arbitrary files that were uploaded 
 *	by the user
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


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


function download_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'download')) {
		return false;
	}
	
	if ($args['edit']) {
		elem_attr($elem, 'title', 'this is '.$obj['name'].', original file name was '.$obj['download-file']);
	} else {
		elem_attr($elem, 'title', 'download file');
	}
	// get file extension
	$a = expl('.', $obj['download-file']);
	if (1 < count($a)) {
		$v = elem('div');
		elem_add_class($v, 'download-ext');
		elem_val($v, htmlspecialchars(array_pop($a), ENT_NOQUOTES, 'UTF-8'));
		elem_append($elem, $v);
	}
	
	return true;
}


function download_alter_render_late($args)
{
	$elem = $args['elem'];
	$html = &$args['html'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'download')) {
		return false;
	}
	
	if (!$args['edit'] && (!isset($obj['download-public']) || $obj['download-public'] != 'public')) {
		// hide it in viewing mode if not public
		$html = '';
	} elseif (!$args['edit']) {
		// otherwise add the css only on-demand in viewing mode
		html_add_css(base_url().'modules/download/download.css');
	}
	
	return true;
}


function download_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'download') {
		return false;
	}
	
	load_modules('glue');
	$a = expl('.', $obj['name']);
	$ret = delete_upload(array('pagename'=>$a[0], 'file'=>$obj['download-file'], 'max_cnt'=>1));
	if ($ret['#error']) {
		log_error('error', 'upload_delete_object: delete_upload returned '.quot($ret['#error']));
	}
}


function download_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'download') {
		return false;
	}
	// symlinks have their referenced files in a different page that's why 
	// they are not relevant here
	if (@is_link(CONTENT_DIR.'/'.str_replace('.', '/', $obj['name']))) {
		return false;
	}
	
	if ($obj['download-file'] != $args['file']) {
		return false;
	} else {
		return true;
	}
}


function download_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'download') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'download');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'download', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'download', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
	if (!$args['edit']) {
		// put link to file around the element
		if (SHORT_URLS) {
			$link = base_url().urlencode($obj['name']).'&download=1';
		} else {
			$link = base_url().'?'.urlencode($obj['name']).'&download=1';
		}
		$html = '<a href="'.htmlspecialchars($link, ENT_COMPAT, 'UTF-8').'">'."\n\t".str_replace("\n", "\n\t", $html)."\n".'</a>'."\n";
	}
	
	return $html;
}


function download_render_page_early($args)
{
	if ($args['edit']) {
		html_add_js(base_url().'modules/download/download-edit.js');
		html_add_css(base_url().'modules/download/download.css');
	}
}


function download_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (array_shift(elem_classes($elem)) != 'download') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'download';
	$obj['module'] = 'download';
	
	// hook
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
	
	// make width and height only be determined by the css
	if (isset($obj['object-width'])) {
		unset($obj['object-width']);
	}
	if (isset($obj['object-height'])) {
		unset($obj['object-height']);
	}
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'download_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function download_serve_resource($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'download') {
		return false;
	}
	
	$a = expl('.', $obj['name']);
	
	// serve the resource only when it's public or we're logged in (i.e. editing)
	if ((isset($obj['download-public']) && $obj['download-public'] == 'public') || is_auth()) {
		serve_file(CONTENT_DIR.'/'.$a[0].'/shared/'.$obj['download-file'], $args['dl'], $obj['download-file-mime']);
	} else if (!is_auth()) {
		prompt_auth(true);
	}
}


function download_upload_fallback($args)
{
	// we handle everything
	load_modules('glue');
	
	$obj = create_object($args);
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	$obj['type'] = 'download';
	$obj['module'] = 'download';
	$obj['download-file'] = $args['file'];
	$obj['download-file-mime'] = $args['mime'];
	save_object($obj);
	
	$ret = render_object(array('name'=>$obj['name'], 'edit'=>true));
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}


?>