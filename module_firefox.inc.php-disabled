<?php


/*
 *	module_firefox.inc.php
 *	Display notification when user starts to edit pages using browser other then Firefox
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2012.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');

function firefox_render_page_late($args)
{
	if (!$args['edit']) {
		return false;
	}
	html_add_css(base_url().'modules/firefox/firefox-edit.css');
	html_add_js(base_url().'modules/firefox/firefox.js');
	return true;
}

