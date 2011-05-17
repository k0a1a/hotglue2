<?php

/*
 *	module_revisions_browser.inc.php
 *	Module for browsing through revisions of a page
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
require_once('controller.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');
// module glue gets loaded on demand
require_once('util.inc.php');


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


function controller_revisions($args)
{
	page_canonical($args[0][0]);
	$page = $args[0][0];
	if (!page_exists($page)) {
		hotglue_error(404);
	}
	
	// get all revisions of page and determine the current revision's index
	load_modules('glue');
	$a = expl('.', $page);
	$revs = revisions_info(array('pagename'=>$a[0], 'sort'=>'time'));
	$revs = $revs['#data'];
	$cur_rev = false;
	for ($i=0; $i < count($revs); $i++) {
		if ($revs[$i]['revision'] == $a[1]) {
			$cur_rev = $i;
			break;
		}
	}
	if ($cur_rev === false) {
		// we didn't find the current revision
		hotglue_error(500);
	}
	
	default_html(true);
	html_add_css(base_url().'modules/revisions_browser/revisions_browser.css');
	if (USE_MIN_FILES) {
		html_add_js(base_url().'modules/revisions_browser/revisions_browser.min.js');
	} else {
		html_add_js(base_url().'modules/revisions_browser/revisions_browser.js');
	}
	html_add_js_var('$.glue.page', $page);
	$bdy = &body();
	elem_attr($bdy, 'id', 'revisions');
	render_page(array('page'=>$page, 'edit'=>false));
	body_append('<div id="revisions_browser_ctrl">');
	body_append('<div id="revisions_browser_prev">');
	if ($cur_rev+1 < count($revs)) {
		body_append('<a href="'.base_url().'?'.htmlspecialchars(urlencode($revs[$cur_rev+1]['page']), ENT_COMPAT, 'UTF-8').'/revisions">prev</a>');
	}
	body_append('</div><div id="revisions_browser_cur">');
	if (substr($revs[$cur_rev]['revision'], 0, 5) == 'auto-') {
		body_append(date('d M y H:i', $revs[$cur_rev]['time']));
	} else {
		body_append(htmlspecialchars($revs[$cur_rev]['revision'], ENT_NOQUOTES, 'UTF-8'));
	}
	body_append('<br>');
	if ($a[1] == 'head') {
		body_append('<a href="'.base_url().'?'.htmlspecialchars(urlencode($page, ENT_COMPAT, 'UTF-8')).'/edit">back to editing</a>');
	} else {
		body_append('<a id="revisions_browser_revert_btn" href="#">revert</a>');
	}
	body_append('</div><div id="revisions_browser_next">');
	if (0 < $cur_rev) {
		body_append('<a href="'.base_url().'?'.htmlspecialchars(urlencode($revs[$cur_rev-1]['page']), ENT_COMPAT, 'UTF-8').'/revisions">next</a>');
	}
	body_append('</div>');
	body_append('</div>');
	echo html_finalize();
}

register_controller('*', 'revisions', 'controller_revisions', array('auth'=>REVISIONS_NEED_AUTH));


function revisions_browser_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/revisions_browser/revisions_browser-edit.min.js');
		} else {
			html_add_js(base_url().'modules/revisions_browser/revisions_browser-edit.js');
		}
	}
}
