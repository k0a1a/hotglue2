<?php

/**
 *	module_iframe.inc.php
 *	Module for embedding iframe elements
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


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


function iframe_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'iframe')) {
		return false;
	}
	
	// parse children elements to find iframe
	$childs = html_parse(elem_val($elem));
	$i = false;
	foreach ($childs as $c) {
		if (elem_tag($c) == 'iframe') {
			$i = $c;
			break;
		}
	}
	if (!$i) {
		log_msg('warn', 'iframe_alter_save: no iframe element found, inner html is '.var_dump_inl($childs));
		return false;
	}
	
	// url - an uploaded html file is shown through its object's own url, which
	// is the server's to say, so the src is not read back over it
	if (!empty($obj['iframe-file'])) {
		// nothing to store
	} elseif (elem_attr($i, 'src') !== NULL) {
    // strip schema from url
		$obj['iframe-url'] = strstr(elem_attr($i, 'src'), '//');
	} else {
		unset($obj['iframe-url']);
	}
	// scrolling
	if (elem_css($i, 'overflow') == 'hidden' || (elem_css($i, 'overflow-x') == 'hidden' && elem_css($i, 'overflow-y') == 'hidden')) {
		unset($obj['iframe-scroll']);
	} else {
		$obj['iframe-scroll'] = 'scroll';
	}
	
	return true;
}


function iframe_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'iframe')) {
		return false;
	}
	
	// add iframe
	$i = elem('iframe');
	// set the name attribute
	elem_attr($i, 'name', $obj['name']);
	if (!empty($obj['iframe-file'])) {
		// an uploaded html file runs in a sandbox of its own, in the editor
		// as on the page: scripts and forms work, but without
		// allow-same-origin it is a stranger to the site, and cannot reach
		// the page around it or the editor's session
		elem_attr($i, 'sandbox', 'allow-forms allow-modals allow-popups allow-scripts');
	} elseif (!$args['edit']) {
		// try to lift any restrictions
		elem_attr($i, 'sandbox', 'allow-forms allow-same-origin allow-scripts allow-top-navigation');
	}
	elem_css($i, 'background-color', 'transparent');
	elem_css($i, 'border-width', '0px');
	elem_css($i, 'height', '100%');
	elem_css($i, 'position', 'absolute');
	elem_css($i, 'width', '100%');
	// url
	if (!empty($obj['iframe-file'])) {
		// the url points to the object name, not the filename in the shared
		// directory (the file gets served in iframe_serve_resource()), and
		// stays relative - see module_image.inc.php for why
		elem_attr($i, 'src', SHORT_URLS ? urlencode($obj['name']) : '?'.urlencode($obj['name']));
	} elseif (!empty($obj['iframe-url'])) {
    // use protocol relative url
		//elem_attr($i, 'src', $obj['iframe-url']);
		elem_attr($i, 'src', strstr($obj['iframe-url'], '//'));
	} else {
		elem_attr($i, 'src', '');
	}
	// scrolling
	if (isset($obj['iframe-scroll']) && $obj['iframe-scroll'] == 'scroll') {
		elem_css($i, 'overflow', 'auto');
		// attribute scrolling is not available in html5 but this effectivly 
		// removes the scrollbars on Chrome, so..
		elem_attr($i, 'scrolling', 'auto');
	} else {
		elem_css($i, 'overflow', 'hidden');
		elem_attr($i, 'scrolling', 'no');
		elem_attr($i, 'seamless', 'seamless');
	}
	elem_append($elem, $i);
	if ($args['edit']) {
		// add shield as well
		// over the upper part of the embed, like the webvideo's: see
		// .glue-iframe-shield in css/edit.css
		$s = elem('div');
		elem_add_class($s, 'glue-iframe-shield');
		elem_add_class($s, 'glue-ui');
		elem_attr($s, 'title', 'click here to select/edit this embed');
		elem_append($elem, $s);
	}
	
	return true;
}


function iframe_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'iframe') {
		return false;
	}
	
	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'iframe');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'iframe', ['obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']]);
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'iframe', ['obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']]);
	
	return $html;
}


function iframe_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/iframe/iframe-edit.min.js');
		} else {
			html_add_js(base_url().'modules/iframe/iframe-edit.js');
		}
		html_add_css(base_url().'modules/iframe/iframe-edit.css');
	}
}


function iframe_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (get_first_item(elem_classes($elem)) != 'iframe') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'iframe';
	$obj['module'] = 'iframe';
	
	// hook
	invoke_hook('alter_save', ['obj'=>&$obj, 'elem'=>$elem]);
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'iframe_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function iframe_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'iframe' || empty($obj['iframe-file'])) {
		return false;
	}
	load_modules('glue');
	$a = expl('.', $obj['name']);
	$ret = delete_upload(['pagename'=>$a[0], 'file'=>$obj['iframe-file'], 'max_cnt'=>1]);
	if ($ret['#error']) {
		log_msg('error', 'iframe_delete_object: delete_upload returned '.quot($ret['#data']));
	}
}


function iframe_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'iframe' || empty($obj['iframe-file'])) {
		return false;
	}
	// symlinks have their referenced files in a different page that's why
	// they are not relevant here
	if (@is_link(CONTENT_DIR.'/'.str_replace('.', '/', $obj['name']))) {
		return false;
	}
	return $obj['iframe-file'] == $args['file'];
}


/**
 *	implements serve_resource: the uploaded html file, which is the page the
 *	iframe shows
 */
function iframe_serve_resource($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'iframe' || empty($obj['iframe-file'])) {
		return false;
	}

	$a = expl('.', $obj['name']);
	if (!$args['dl']) {
		// an html document served from the site's own origin is as much the
		// site as its own pages are: a script inside it could act as whoever
		// opens the url, the editor included. The sandbox policy keeps the
		// scripts (the page is meant to run) and takes the origin away, and
		// it is on the response itself, so it holds when the url is opened
		// directly as well as in the frame. The download path is an
		// attachment, not a document.
		header('Content-Security-Policy: sandbox allow-forms allow-modals allow-popups allow-scripts');
		header('X-Content-Type-Options: nosniff');
	}
	serve_file(CONTENT_DIR.'/'.$a[0].'/shared/'.$obj['iframe-file'], $args['dl'], 'text/html');
}


/**
 *	an uploaded html file becomes an iframe object that shows it, which
 *	resizes like any embed
 */
function iframe_upload($args)
{
	$ext = strtolower(filext($args['file']));
	if (!in_array($ext, ['html', 'htm', 'xhtml']) && $args['mime'] != 'text/html') {
		return false;
	}
	// a page menu's 'upload a file' asks for a download object by name, and a
	// wrap target is a download's business: neither is ours
	if (isset($args['preferred_module']) && $args['preferred_module'] == 'download') {
		return false;
	}

	load_modules('glue');
	$obj = create_object($args);
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	$obj['type'] = 'iframe';
	$obj['module'] = 'iframe';
	$obj['iframe-file'] = $args['file'];
	// a document is longer than the frame it starts in: scrollbars on, the
	// menu toggle takes them away
	$obj['iframe-scroll'] = 'scroll';
	save_object($obj);

	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}
