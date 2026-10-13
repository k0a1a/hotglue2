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

	// site settings: options that apply to every page rather than to the
	// look of one particular page - stored on the startpage's own
	// page-object regardless of which page is currently being viewed (see
	// common.inc.php's startpage()/site_custom_fonts(), and
	// module_page.inc.php's page_favicon_upload()/page_font_upload())
	load_modules('glue');
	$site_obj = load_object(['name'=>startpage().'.page']);
	$site_obj = $site_obj['#error'] ? [] : $site_obj['#data'];

	// the page's own name for itself, and the same two words the editor's
	// page-menu button uses to get here (page_browser-edit.js)
	body_append('<h1>Site options</h1>'.nl());

	body_append('<h2>Favicon</h2>'.nl());
	body_append('<div id="site_settings_favicon">'.nl());
	if (!empty($site_obj['page-favicon-file'])) {
		body_append(tab().'<img id="site_settings_favicon_preview" src="'.base_path().'?favicon" alt="current favicon">'.nl());
	} else {
		body_append(tab().'<span id="site_settings_favicon_preview_empty">no favicon set</span>'.nl());
	}
	body_append(tab().'<label class="site_settings_upload_btn">upload favicon<input type="file" id="site_settings_favicon_input" accept=".ico,.png,.gif,.svg" hidden></label>'.nl());
	body_append(tab().'<a href="#" id="site_settings_favicon_clear"'.(empty($site_obj['page-favicon-file']) ? ' style="display: none;"' : '').'>clear</a>'.nl());
	body_append('</div>'.nl());

	body_append('<h2>Mobile view</h2>'.nl());
	body_append('<div id="site_settings_guided">'.nl());
	// on unless the site switched it off (stored by absence, see
	// module_page.inc.php's page_set_guided())
	$guided_on = @$site_obj['page-guided'] !== 'off';
	body_append(tab().'<label id="site_settings_guided_on_label"><input type="checkbox" id="site_settings_guided_on"'.($guided_on ? ' checked' : '').'> guided view on phones (pan and zoom between the objects)</label>'.nl());
	body_append(tab().'<span id="site_settings_guided_label">zoom of the guided view</span>'.nl());
	$current_zoom = intval(@$site_obj['page-guided-zoom']);
	if (!in_array($current_zoom, guided_zoom_choices(), true)) {
		$current_zoom = 100;
	}
	body_append(tab().'<span id="site_settings_guided_zoom" role="radiogroup" aria-labelledby="site_settings_guided_label">'.nl());
	foreach (guided_zoom_choices() as $z) {
		body_append(tab(2).'<label><input type="radio" name="guided_zoom" value="'.$z.'"'.($z == $current_zoom ? ' checked' : '').($guided_on ? '' : ' disabled').'> '.$z.'%'.($z == 100 ? ' (default)' : '').'</label>'.nl());
	}
	body_append(tab().'</span>'.nl());
	body_append('</div>'.nl());

	body_append('<h2>Custom fonts</h2>'.nl());
	body_append('<div id="site_settings_fonts">'.nl());
	body_append(tab().'<ul id="site_settings_fonts_list">'.nl());
	foreach (site_custom_fonts() as $font) {
		if (empty($font['file']) || empty($font['name'])) {
			continue;
		}
		// the "remove" action is shown on hover only, added by
		// page_browser.js (matching the .page_browser_entry pattern below)
		body_append(tab(2).'<li data-file="'.htmlspecialchars($font['file'], ENT_COMPAT, 'UTF-8').'"><span class="site_settings_font_name">'.htmlspecialchars($font['name'], ENT_NOQUOTES, 'UTF-8').'</span></li>'.nl());
	}
	body_append(tab().'</ul>'.nl());
	body_append(tab().'<label class="site_settings_upload_btn">upload font<input type="file" id="site_settings_fonts_input" accept=".woff,.woff2,.ttf,.otf" hidden></label>'.nl());
	body_append(tab().' <a href="https://www.dafont.com/theme.php?cat=402&amp;l[]=10&amp;l[]=1&amp;l[]=6" target="_blank" rel="noopener">free fonts on <u>dafont.com</u> &#8605;</a>'.nl());
	body_append('</div>'.nl());

	body_append('<h2>All pages</h2>'.nl());
	$pns = pagenames([]);
	$pns = $pns['#data'];
	foreach ($pns as $pn) {
		// display only pages with 'head'
		if (is_dir(CONTENT_DIR.'/'.$pn.'/head')) {
			// the per-page password state (SOW-page-password.md) rides the
			// entry as a data attribute for the actions, and as a marker
			// next to the name, like [startpage]
			$protected = page_password_required($pn.'.head');
			body_append('<div class="page_browser_entry" id="'.htmlspecialchars($pn, ENT_COMPAT, 'UTF-8').'"'.($protected ? ' data-protected="1"' : '').'><span class="page_browser_pagename"><a href="'.base_path().'?'.htmlspecialchars(urlencode($pn), ENT_COMPAT, 'UTF-8').'">'.htmlspecialchars($pn, ENT_NOQUOTES, 'UTF-8').'</a></span> ');
			if ($pn.'.head' == startpage()) {
				body_append('<span id="page_browser_startpage">[startpage]</span> ');
			}
			if ($protected) {
				body_append('<span class="page_browser_protected">[protected] </span>');
			}
		}
		body_append('</div>');
	}
	echo html_finalize();
}

register_controller('pages', '', 'controller_pages', ['auth'=>PAGES_NEED_AUTH]);
register_controller('options', '', 'controller_pages', ['auth'=>PAGES_NEED_AUTH]);


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
