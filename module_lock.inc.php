<?php

/**
 *	module_lock.inc.php
 *	Module for locking objects
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


function lock_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'object')) {
		return false;
	}

	if (!empty($obj['object-lock'])) {
		elem_add_class($elem, 'locked');
	}
	
	return true;
}


function lock_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'object')) {
		return false;
	}

	if (elem_has_class($elem, 'locked')) {
		$obj['object-lock'] = 'locked';
	} else {
		unset($obj['object-lock']);
	}

	return true;
}


function lock_render_object($args)
{
	$elem = &$args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'object')) {
		return false;
	}
	
	if (!empty($obj['object-lock'])) {
		elem_css($elem, 'object-lock', $obj['object-lock']);
	}

}


function lock_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/lock/lock.min.js');
		} else {
			html_add_js(base_url().'modules/lock/lock.js');
		}
		return true;
	} else {
		return false;
	}
}


?>
