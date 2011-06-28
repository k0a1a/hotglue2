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
	body_append(tab().'<span id="welcome-first">Welcome to HOTGLUE!</span><br>'.nl());
	body_append(tab().'Your Content Manipulation System is ready to go!'.nl());
	body_append(tab().'<p>A short intro before you start:<br>'.nl());
	body_append(tab().'&#164; To get back to editing mode in the future, add "'.(SHORT_URLS ? '' : '?').'edit" to the address in the address bar (i.e.: '.base_url().'<b>'.(SHORT_URLS ? '' : '?').'edit</b>)<br>'.nl());
	body_append(tab().'&#164; In editing mode, you can use single and double click to access the menus.<br>'.nl());
	body_append(tab().'&#164; Click the page\'s background once to open a menu that lets you create new objects, upload files and embed videos (YouTube and Vimeo).<br>'.nl());
	body_append(tab().'&#164; Double-click to open a menu that allows you to change preferences, show a grid, make new pages and more.<br>'.nl());
	body_append(tab().'&#164; Remove "'.(SHORT_URLS ? '' : '?').'edit" from the address in the address bar to go to the viewing-only mode of this page.</p>'.nl());
	body_append(tab().'<p>You can find more ideas on how to use HOTGLUE at the <a href="http://hotglue.me/how_basic" target="_blank">"How-to" section of our website</a>!'.nl());
	body_append(tab().'<p>Enjoy!<br>'.nl());
	body_append(tab().'<span id="welcome-light">[This message goes away when you click it]</span></p>'.nl());
	body_append('</div>'.nl());
	return true;
}
