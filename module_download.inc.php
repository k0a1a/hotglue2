<?php

/*
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
	if (elem_has_class($elem, 'download')) {
		if ($args['edit']) {
			elem_attr($elem, 'title', 'this is '.$obj['name'].', original file name was '.$obj['download-file']);
		} else {
			elem_attr($elem, 'title', 'download file');
		}
		// the file's type, inside the 50x50 box: the MIME subtype where it
		// fits (full MIMEs don't), the extension otherwise, the full MIME as
		// the tooltip (2026-09-22, danja's call)
		$label = download_mime_label($obj);
		$v = elem('div');
		elem_add_class($v, 'download-mime');
		elem_val($v, htmlspecialchars($label, ENT_NOQUOTES, 'UTF-8'));
		if (isset($obj['download-file-mime']) && $obj['download-file-mime'] != '') {
			elem_attr($v, 'title', htmlspecialchars($obj['download-file-mime'], ENT_COMPAT, 'UTF-8'));
		}
		elem_append($elem, $v);
		return true;
	}
	// the wrapped target's editor indicator: the title only, so the
	// association says itself on hover. The dashed outline is GONE (danja's
	// call, 2026-09-22) - the menus carry the association now.
	if ((elem_has_class($elem, 'text') || elem_has_class($elem, 'image')) &&
			$args['edit'] && !empty($obj['download-wrap'])) {
		load_modules('glue');
		$dl = load_object(['name'=>$obj['download-wrap']]);
		if (!$dl['#error'] && !empty($dl['#data']['download-file-name'])) {
			elem_attr($elem, 'title', 'downloads '.$dl['#data']['download-file-name']);
		} else {
			elem_attr($elem, 'title', 'this object is a download');
		}
		return true;
	}
	return false;
}

// the short label for the box: the MIME subtype, or the extension when the
// mime is unknown
function download_mime_label($obj)
{
	if (isset($obj['download-file-mime']) && $obj['download-file-mime'] != '') {
		$a = expl('/', $obj['download-file-mime']);
		if (1 < count($a) && $a[1] != '') {
			return $a[1];
		}
	}
	$a = expl('.', $obj['download-file']);
	if (1 < count($a)) {
		return array_pop($a);
	}
	return 'file';
}


function download_alter_render_late($args)
{
	$elem = $args['elem'];
	$html = &$args['html'];
	$obj = $args['obj'];
	if (elem_has_class($elem, 'download')) {
		if (!$args['edit'] && (isset($obj['download-public']) && $obj['download-public'] == 'private')) {
			// hide it in viewing mode when made private - public is the
			// default, so the attribute only ever says 'private'
			$html = '';
		} elseif (!$args['edit']) {
			// otherwise add the css only on-demand in viewing mode
			html_add_css(base_url().'modules/download/download.css');
		}
		return true;
	}
	// the WRAP (2026-09-22, SOW-download-object): a text or image object
	// carrying download-wrap renders its own markup inside the download's
	// <a>, in view mode only - the editor keeps the object untouched so it
	// edits normally (the link pattern). Mirrors object_alter_render_late().
	if (!elem_has_class($elem, 'text') && !elem_has_class($elem, 'image')) {
		return false;
	}
	if ($args['edit'] || empty($obj['download-wrap']) || !empty($obj['object-link'])) {
		return false;		// editor untouched; object-link wins
	}
	load_modules('glue');
	$dl = load_object(['name'=>$obj['download-wrap']]);
	if ($dl['#error'] || $dl['#data']['type'] != 'download') {
		return false;
	}
	$dl = $dl['#data'];
	if (isset($dl['download-public']) && $dl['download-public'] == 'private') {
		return false;		// a private download wraps nothing in view
	}
	if (SHORT_URLS) {
		$link = urlencode($dl['name']).'&download=1';
	} else {
		$link = '?'.urlencode($dl['name']).'&download=1';
	}
	$fname = !empty($dl['download-file-name']) ? $dl['download-file-name'] : $dl['download-file'];
	if (substr($html, 0, 3) == '<a ') {
		return false;		// already wrapped by someone
	}
	if (substr($html, -1) == "\n") {
		$html = substr($html, 0, -1);
	}
	$html = '<a href="'.htmlspecialchars($link, ENT_COMPAT, 'UTF-8').'" download="'.
		htmlspecialchars($fname, ENT_COMPAT, 'UTF-8').'">'."\n\t".
		str_replace("\n", "\n\t", $html)."\n".'</a>'."\n";
	return true;
}


function download_delete_object($args)
{
	$obj = $args['obj'];
	load_modules('glue');
	// a wrapped pair must never leave its counterpart dangling: whichever
	// half is deleted, the other half is unwrapped (2026-09-22,
	// SOW-download-object). Runs for every deletion - the hook fires for
	// all objects, and this handles both directions before the type guard.
	if (!empty($obj['download-wrap'])) {
		$dl = load_object(['name'=>$obj['download-wrap']]);
		if (!$dl['#error']) {
			object_remove_attr(['name'=>$obj['download-wrap'], 'attr'=>'download-wrap-target']);
		}
	}
	if (!empty($obj['download-wrap-target'])) {
		$t = load_object(['name'=>$obj['download-wrap-target']]);
		if (!$t['#error']) {
			object_remove_attr(['name'=>$obj['download-wrap-target'], 'attr'=>'download-wrap']);
		}
	}
	if (!isset($obj['type']) || $obj['type'] != 'download') {
		return false;
	}

	$a = expl('.', $obj['name']);
	$ret = delete_upload(['pagename'=>$a[0], 'file'=>$obj['download-file'], 'max_cnt'=>1]);
	if ($ret['#error']) {
		log_msg('error', 'upload_delete_object: delete_upload returned '.quot($ret['#error']));
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

	load_modules('glue');
	// wrapped: the target carries the download (2026-09-22,
	// SOW-download-object). object_exists is the second line of defense,
	// so a deleted target can never hide the box forever even if the
	// delete cleanup crashed between the two writes. The editor still
	// renders the box - hidden by a class, so undo/detach have something
	// to reach - and the view render blanks it entirely.
	$wrapped = !empty($obj['download-wrap-target']) && object_exists($obj['download-wrap-target']);

	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'download');
	elem_add_class($e, 'object');
	if ($wrapped && $args['edit']) {
		elem_add_class($e, 'glue-download-wrapped');
	}
	
	// hooks
	invoke_hook_first('alter_render_early', 'download', ['obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']]);
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'download', ['obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']]);
	
	if (!$args['edit'] && $wrapped) {
		// wrapped: no box in view - the target's own render emits the
		// download anchor
		return '';
	}
	if (!$args['edit']) {
		// put link to file around the element - kept relative (not prefixed
		// with base_url()) so it still resolves correctly when viewed
		// through a different domain than the one configured/detected as
		// the base url - see module_object.inc.php's object_alter_render_late()
		if (SHORT_URLS) {
			$link = urlencode($obj['name']).'&download=1';
		} else {
			$link = '?'.urlencode($obj['name']).'&download=1';
		}
		$fname = !empty($obj['download-file-name']) ? $obj['download-file-name'] : $obj['download-file'];
		$html = '<a href="'.htmlspecialchars($link, ENT_COMPAT, 'UTF-8').'" download="'.
			htmlspecialchars($fname, ENT_COMPAT, 'UTF-8').'">'."\n\t".str_replace("\n", "\n\t", $html)."\n".'</a>'."\n";
	}
	
	return $html;
}


function download_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/download/download-edit.min.js');
		} else {
			html_add_js(base_url().'modules/download/download-edit.js');
		}
		html_add_css(base_url().'modules/download/download.css');
	}
}


function download_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (get_first_item(elem_classes($elem)) != 'download') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'download';
	$obj['module'] = 'download';
	
	// hook
	invoke_hook('alter_save', ['obj'=>&$obj, 'elem'=>$elem]);
	
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

	// public is the default; a download made private serves only to a
	// logged-in editor (danja's call, 2026-09-23). The 401 is sent here
	// rather than through prompt_auth(): its hotglue_error page render
	// gets discarded inside the serve flow (the hook returning "handled"
	// leaves the response to whatever the controller does next), so the
	// client used to receive a silent 200 with an empty body.
	if (isset($obj['download-public']) && $obj['download-public'] == 'private' && !is_auth()) {
		header('WWW-Authenticate: Basic realm="'.str_replace("\"", '', SITE_NAME).'"');
		header($_SERVER['SERVER_PROTOCOL'].' 401 Unauthorized');
		return true;
	}
	serve_file(CONTENT_DIR.'/'.$a[0].'/shared/'.$obj['download-file'], $args['dl'], $obj['download-file-mime']);
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
	// the friendly download name starts as the uploaded filename; the
	// rename UI is a later enhancement (2026-09-22)
	$obj['download-file-name'] = $args['file'];
	save_object($obj);

	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}

// the wrap-targeted upload (2026-09-22, SOW-download-object): the text or
// image menu's "attach" sends preferred_module 'download' plus the wrap
// target's name; the uploaded file becomes a NEW download object wrapped
// around it. Runs before the generic upload pass (upload_files dispatches
// {preferred_module}_upload first), which matters - otherwise image_upload
// would claim any image file before the fallback ever saw it.
function download_upload($args)
{
	load_modules('glue');
	if (!isset($args['preferred_module']) || $args['preferred_module'] != 'download' ||
			empty($args['wrap'])) {
		return false;		// fall through to the generic pass / fallback
	}
	$t = load_object(['name'=>$args['wrap']]);
	if ($t['#error']) {
		return false;
	}
	$t = $t['#data'];
	if (!isset($t['type']) || ($t['type'] != 'text' && $t['type'] != 'image')) {
		return false;
	}
	// the wrap target must live on the page the object is created on
	$a = expl('.', $args['wrap']);
	if ($a[0].'.'.$a[1] != $args['page']) {
		return false;
	}
	if (!empty($t['object-link']) || !empty($t['download-wrap'])) {
		return false;		// object-link wins; no re-wrapping
	}

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
	$obj['download-file-name'] = $args['file'];
	save_object($obj);

	// render BEFORE the wrap attrs land: a wrapped download renders '' by
	// design, and the client needs the box's html to position and hide it
	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	if ($ret['#error']) {
		return false;
	}
	$html = $ret['#data'];

	$ret = update_object(['name'=>$obj['name'], 'download-wrap-target'=>$args['wrap']]);
	if ($ret['#error']) {
		return false;
	}
	$ret = update_object(['name'=>$args['wrap'], 'download-wrap'=>$obj['name']]);
	if ($ret['#error']) {
		return false;
	}
	return $html;
}
