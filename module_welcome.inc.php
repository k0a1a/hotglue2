<?php


/*
 *	module_welcome.inc.php
 *	Module for displaying a short informative message for new users
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2011.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */


@require_once('config.inc.php');
require_once('html.inc.php');
require_once('modules.inc.php');
$page_has_object = false;


function welcome_alter_render_late($args)
{
	global $page_has_object;
	// we only display the informative div if there are no object already 
	// on the page we're starting to edit
	$page_has_object = true;
}


function welcome_render_page_late($args)
{
	global $page_has_object;
	if (!$args['edit'] || $page_has_object) {
		return false;
	}
	// we only display the information when there are no other pages in the 
	// content directory except the current one
	load_modules('glue');
	$pns = pagenames(array());
	$pns = $pns['#data'];
	if (1 < count($pns)) {
		return false;
	}
	
	html_add_css(base_url().'modules/welcome/welcome-edit.css');
	html_add_js(base_url().'modules/welcome/welcome.js');
	body_append('<div id="welcome-msg">'.nl());
	body_append(tab().'<p>Welcome to the Hotglue content manipulation system!</p>'.nl());
	body_append(tab().'<p>Click the background to launch the menu for creating new objects.</p>'.nl());
	body_append(tab().'<p>Or double-click to launch a menu that allows you to change the some of the page\'s preferences.</p>'.nl());
	body_append(tab().'<p>More ideas on how to use Hotglue can be found on the <a href="http://hotglue.me/">hotglue.me screencast section</a>.</p>'.nl());
	body_append(tab().'<p>Happy gluing! (This message goes away when you click it.)</p>'.nl());
	body_append('</div>'.nl());
	return true;
}
