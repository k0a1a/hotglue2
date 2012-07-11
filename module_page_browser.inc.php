<?php

/*
 *	module_page_browser.inc.php
 *	Module for listing and managing all available pages
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


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


function controller_pages($args)
{
	default_html(true);
	html_add_css(base_url().'modules/page_browser/page_browser.css');
	if (USE_MIN_FILES) {
		html_add_js(base_url().'modules/page_browser/page_browser.min.js');
	} else {
		html_add_js(base_url().'modules/page_browser/page_browser.js');
	}
	html_add_js_var('$.glue.conf.page.startpage', startpage());
	$bdy = &body();
	elem_attr($bdy, 'id', 'pages');
	body_append('<h1>All pages</h1>');
	load_modules('glue');
	$pns = pagenames(array());
	$pns = $pns['#data'];
	foreach ($pns as $pn) {
		body_append('<div class="page_browser_entry" id="'.htmlspecialchars($pn, ENT_COMPAT, 'UTF-8').'"><span class="page_browser_pagename"><a href="'.base_url().'?'.htmlspecialchars(urlencode($pn), ENT_COMPAT, 'UTF-8').'">'.htmlspecialchars($pn, ENT_NOQUOTES, 'UTF-8').'</a></span> ');
		if ($pn.'.head' == startpage()) {
			body_append('<span id="page_browser_startpage">[startpage]</span> ');
		}
		body_append('</div>');
	}
	echo html_finalize();
}

register_controller('pages', '', 'controller_pages', array('auth'=>PAGES_NEED_AUTH));


function page_browser_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/page_browser/page_browser-edit.min.js');
		} else {
			html_add_js(base_url().'modules/page_browser/page_browser-edit.js');
		}
	}
}
