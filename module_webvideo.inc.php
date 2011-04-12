<?php

/*
 *	module_webvideo.inc.php
 *	Module for embedding youtube and vimeo videos
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');


function webvideo_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'webvideo')) {
		return false;
	}
	
	if (empty($obj['webvideo-provider']) || empty($obj['webvideo-id'])) {
		return false;
	}
	
	$i = elem('iframe');
	if ($obj['webvideo-provider'] == 'youtube') {
		if (empty($_SERVER['HTTPS'])) {
			$src = 'http://';
		} else {
			$src = 'https://';
		}
		$src .= 'www.youtube.com/embed/'.$obj['webvideo-id'].'?rel=0';
		if (isset($obj['webvideo-autoplay']) && $obj['webvideo-autoplay'] == 'autoplay') {
			$src .= '&autoplay=1';
		}
		if (isset($obj['webvideo-loop']) && $obj['webvideo-loop'] == 'loop') {
			// this is not yet supported by the new youtube embed player
			$src .= '&loop=1';
		}
		elem_attr($i, 'src', $src);
		elem_add_class($i, 'youtube-player');		
	} elseif ($obj['webvideo-provider'] == 'vimeo') {
		$src = 'http://player.vimeo.com/video/'.$obj['webvideo-id'].'?title=0&byline=0&portrait=0&color=ffffff';
		if (isset($obj['webvideo-autoplay']) && $obj['webvideo-autoplay'] == 'autoplay') {
			$src .= '&autoplay=1';
		}
		if (isset($obj['webvideo-loop']) && $obj['webvideo-loop'] == 'loop') {
			$src .= '&loop=1';
		}
		elem_attr($i, 'src', $src);
	}
	// frameborder is not valid html
	//elem_attr($i, 'frameborder', '0');
	elem_css($i, 'border-width', '0px');
	elem_css($i, 'height', '100%');
	elem_css($i, 'position', 'absolute');
	elem_css($i, 'width', '100%');		
	elem_append($elem, $i);
	
	if ($args['edit']) {
		// add handle as well
		$h = elem('div');
		elem_add_class($h, 'glue-webvideo-handle');
		elem_add_class($h, 'glue-ui');
		elem_attr($h, 'title', 'drag here');
		elem_append($elem, $h);
	}
	
	return true;
}


function webvideo_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'webvideo') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'webvideo');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'webvideo', array('obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']));
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'webvideo', array('obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']));
	
	return $html;
}


function webvideo_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/webvideo/webvideo-edit.min.js');
		} else {
			html_add_js(base_url().'modules/webvideo/webvideo-edit.js');
		}
		html_add_css(base_url().'modules/webvideo/webvideo-edit.css');
	}
}


function webvideo_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (array_shift(elem_classes($elem)) != 'webvideo') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'webvideo';
	$obj['module'] = 'webvideo';
	
	// hook
	invoke_hook('alter_save', array('obj'=>&$obj, 'elem'=>$elem));
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'webvideo_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}
