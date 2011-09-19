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
	body_append(tab().'<span id="welcome-first"><img style="float:left; margin:5px 10px 0 5px" src="modules/welcome/gun32.gif">Welcome to HOTGLUE!</span><br>'.nl());
	body_append(tab().'Your Content Manipulation System is ready to go!'.nl());
	body_append(tab().'<p>A short intro before you start:</p>'.nl());
	body_append(tab().'<span id="cont"><span id="text"><b>1.</b> Right now you are in <u>editing mode</u>. You can use single and double click to access the menus - they will appear next to the mouse pointer.</span>'.nl());
	body_append(tab().'<span id="text"><b>2.</b> Click on the canvas (white background of the page) to open a menu which will let you create new objects, upload files and embed YouTube and Vimeo videos! Once you made an object click on it to activate its contextual menu.</span>'.nl());
	body_append(tab().'<span id="text"><b>3.</b> Double-click on the canvas will give you a menu of options to change preferences, show a grid, make new pages, set background picture and more!</span>'.nl());
	body_append(tab().'<span id="text"><b>4.</b> Remove "'.(SHORT_URLS ? '' : '?').'edit" from the address of the page (the URL) to see the "view-only" version. That\'s how your page will look to everyone else!</span>'.nl());
	body_append(tab().'<span id="text"><b>5.</b> To get back to editing mode add "'.(SHORT_URLS ? '' : '?').'edit" to the URL of the page.<br>(for example: '.base_url().'<b>'.(SHORT_URLS ? '' : '?').'edit</b>)</span></span>'.nl());
	body_append(tab().'<p>We recommend you to use <a href="http://firefox.com" target="_blank">Mozilla Firefox</a> browser when editing in HOTGLUE. Firefox is a very reliable and modern web-browser, it is our favorite!'.nl());
body_append(tab().'<p>You can find more information on how to work with HOTGLUE on our <a href="http://hotglue.me" target="_blank">web-site</a>. Make sure to checkout "<a href="http://hotglue.me/what" target="_blank">What is HOTGLUE?</a>" and "<a href="http://hotglue.me/how" target="_blank">How to HOTGLUE?</a>" pages!'.nl());
	body_append(tab().'<p>Enjoy! <span id="welcome-light">[click this message to make it go away]</span></p>'.nl());
	body_append('</div>'.nl());
	return true;
}
