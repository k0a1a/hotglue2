<?php

/*
 *	module_glue.inc.php
 *	Main hotglue module
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('common.inc.php');
// html{,_parse}.inc.php are only included where needed
require_once('modules.inc.php');
require_once('util.inc.php');


// module_image.inc.php has more information on what's going on inside modules 
// (they can be easier than that one though)


// TODO (later): switch services to using $args['args'] for input validation?


/**
 *	helper function for revisions_info()
 *
 *	@param array $a array to compare
 *	@param array $b array to compare
 *	@return int comparison result
 */
function _cmp_time($a, $b)
{
	if ($a['time'] == $b['time']) {
		return 0;
	}
	return ($a['time'] < $b['time']) ? 1 : -1;
}


/**
 *	lock an object file
 *
 *	@param string $name object name (i.e. page.rev.obj)
 *	@param mixed $wait false = give up right away, true = wait until successful, 
 *		integer values = wait up to $wait ms
 *	@return mixed true (on Win32 for now) or lock handle for success, NULL if 
 *		the object doesn't exist, and false if the lock could not be acquired
 */
function _obj_lock($name, $wait = true)
{
	// TODO (later): make this work on Windows (opening and writing to files 
	// after taking the lock doesn't work there atm)
	// bandaid below
	if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
		log_msg('warn', 'lock: locking is not supported on WIN32 at the moment');
		return true;
	}
	
	$start = intval(microtime(true)*1000.0);
	$fn = CONTENT_DIR.'/'.str_replace('.', '/', $name);
	// resolve symlinks
	if (@is_link($fn)) {
		$target = @readlink($fn);
		if (substr($target, 0, 1) == '/') {
			$fn = $target;
		} else {
			$fn = dirname($fn).'/'.$target;
		}
		log_msg('debug', 'lock: resolved '.$name.' -> '.$fn);
	}
	do {
		$f = @fopen($fn, 'rb');
		if ($f === false) {
			// file does not exist
			log_msg('debug', 'lock: file '.$fn.' does not exist');
			return NULL;
		}
		// try to acquire lock
		if (@flock($f, LOCK_EX|LOCK_NB)) {
			// success
			log_msg('debug', 'lock: acquired lock for '.$name);
			return $f;
		} elseif ($wait === false) {
			// give up right away
			log_msg('debug', 'lock: could not acquire lock');
			return false;
		} elseif (is_int($wait) && $wait < abs(intval(microtime(true)*1000.0)-$start)) {
			// timeout
			log_msg('debug', 'lock: could not acquire lock in '.$wait.'ms');
			return false;
		}
		// sleep for a tenth of a second (not sure if this works)
		usleep(100000);
	} while (true);
}


/**
 *	unlock an object file
 *
 *	@param mixed $f lock handle (or anything on Win32)
 */
function _obj_unlock($f)
{
	// bandaid below
	if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
		log_msg('warn', 'unlock: locking is not supported on WIN32 at the moment');
		return;
	}
	
	if ($f) {
		@flock($f, LOCK_UN);
		log_msg('debug', 'lock: released lock');
		@fclose($f);
	}
}


/**
 *	create and delete auto- revisions
 *
 *	this function operates on a specific page and takes SNAPSHOT_MIN_AGE and
 *	SNAPSHOT_MAX_AGE into account.
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *	@return array response
 *		true if successful
 */
function check_auto_snapshot($args)
{
	if (!isset($args['page'])) {
		return response('Required argument "page" missing', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 400);
	}
	
	$a = expl('.', $args['page']);
	$revs = revisions_info(array('pagename'=>$a[0], 'sort'=>'time'));
	$revs = $revs['#data'];
	
	if ($a[1] == 'head' && SNAPSHOT_MIN_AGE != 0) {
		// we're dealing with a head revision and taking snapshots
		// find the previous auto- revision
		for ($i=0; $i < count($revs); $i++) {
			if (substr($revs[$i]['revision'], 0, 5) == 'auto-') {
				// got it, check age
				if (time()-$revs[$i]['time'] < SNAPSHOT_MIN_AGE) {
					log_msg('debug', 'check_auto_snapshot: age is '.(time()-$revs[$i]['time']).' seconds, not creating a snapshot');
					break;
				}
				// check if different
				if (dir_is_different(CONTENT_DIR.'/'.str_replace('.', '/', $args['page']), CONTENT_DIR.'/'.str_replace('.', '/', $revs[$i]['page']))) {
					snapshot($args);
				} else {
					log_msg('debug', 'check_auto_snapshot: head is identical to '.$revs[$i]['revision'].', not creating a snapshot');
				}
				break;
			}
			if ($i == count($revs)-1) {
				// no auto- revision?, create one now
				snapshot($args);
			}
		}
	}
	
	// delete old auto- revisions
	if (SNAPSHOT_MAX_AGE != 0) {
		for ($i=count($revs)-1; 0 <= $i; $i--) {
			if (substr($revs[$i]['revision'], 0, 5) == 'auto-' && SNAPSHOT_MAX_AGE < time()-$revs[$i]['time']) {
				log_msg('info', 'check_auto_snapshot: deleting an old snapshot');
				delete_page(array('page'=>$revs[$i]['page']));
				$i--;
			}
		}
	}
	
	return response(true);
}

register_service('glue.check_auto_snapshot', 'check_auto_snapshot', array('auth'=>true));


/**
 *	duplicate an object
 *
 *	@param array $args arguments
 *		key 'name' name of the object to duplicate
 *	@return array response
 *		string name of new object if successful
 */
function clone_object($args)
{
	// load old object
	$old = load_object($args);
	if ($old['#error']) {
		return $old;
	} else {
		$old = $old['#data'];
	}
	
	// create new object
	$a = expl('.', $old['name']);
	$new = create_object(array('page'=>$a[0].'.'.$a[1]));
	if ($new['#error']) {
		return $new;
	} else {
		$new = $new['#data'];
	}
	
	// save old object as new
	$new = array_merge($old, $new);
	$ret = save_object($new);
	if ($ret['#error']) {
		return $ret;
	} else {
		// return name
		return response($new['name']);
	}
}

register_service('glue.clone_object', 'clone_object', array('auth'=>true));


/**
 *	create an empty object in the content directory
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *	@return array response
 *		key 'name' is the name of the object created
 */
function create_object($args)
{
	if (!isset($args['page'])) {
		return response('Required argument "page" missing', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 400);
	}
	
	// try to create new file
	$f = false;
	$tries = 0;
	$mtime = microtime(true);
	do {
		// use a finer granularity than unix time by default
		$name = $args['page'].'.'.intval(floor($mtime)).intval(($mtime-floor($mtime))*100.0+$tries);
		$m = umask(0111);
		$f = @fopen(CONTENT_DIR.'/'.str_replace('.', '/', $name), 'x');
		umask($m);
	}
	while ($f === false && $tries++ < 9);
	
	if (!$f) {
		return response('Error creating an object in page '.quot($args['page']), 500);
	} else {
		fclose($f);
		log_msg('info', 'create_object: created '.quot($name));
		return response(array('name'=>$name));
	}
}

register_service('glue.create_object', 'create_object', array('auth'=>true));


/**
 *	create a page
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *	@return array response
 */
function create_page($args)
{
	if (empty($args['page'])) {
		return response('Required argument "page" missing or empty', 400);
	}
	if (page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' already exists', 400);
	}
	if (!valid_pagename($args['page'])) {
		return response('Invalid page name '.quot($args['page']), 400);	
	}
	
	$a = expl('.', $args['page']);	
	$d = CONTENT_DIR.'/'.$a[0];
	if (!is_dir($d)) {
		$m = umask(0000);
		if (!@mkdir($d, 0777)) {
			umask($m);
			return response('Error creating directory '.quot($d), 500);
		}
		umask($m);
	}
	
	$d .= '/'.$a[1];
	if (!is_dir($d)) {
		$m = umask(0000);
		if (!@mkdir($d, 0777)) {
			umask($m);
			return response('Error creating directory '.quot($d), 500);
		}
		umask($m);
	}

	log_msg('info', 'create_page: created '.quot($args['page']));
	invoke_hook('create_page', array('page'=>$args['page']));
	return response(true);
}

register_service('glue.create_page', 'create_page', array('auth'=>true));
register_hook('create_page', 'invoked when a page has been created');


/**
 *	delete an object from the content directory
 *
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *	@return array response
 */
function delete_object($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing or empty', 400);
	}
	if (!object_exists($args['name'])) {
		return response('Object '.quot($args['name']).' does not exist', 404);
	}
	// check if the object file is writable
	// this allows us to make singular objects read-only by setting the file 
	// permissions to 0444 or similar
	if (!is_writable(CONTENT_DIR.'/'.str_replace('.', '/', $args['name']))) {
		return response('Object '.quot($args['name']).' is read-only, not deleting it', 500);
	}
	
	// call delete_object unless the object is a symlink
	// this is because referenced resources are not part of the current page 
	// anyway, and this way it is easier to handle for the modules
	$ret = object_get_symlink($args);
	$ret = $ret['#data'];
	if ($ret === false) {
		$obj = load_object($args);
		if ($obj['#error']) {
			return $obj;
		} else {
			$obj = $obj['#data'];
		}
		invoke_hook('delete_object', array('obj'=>$obj));
	}
	
	if (!@unlink(CONTENT_DIR.'/'.str_replace('.', '/', $args['name']))) {
		return response('Error deleting object '.quot($args['name']), 500);
	} else {
		log_msg('info', 'delete_object: deleted '.quot($args['name']));
		// drop the object's page from cache
		$a = expl('.', $args['name']);
		drop_cache('page', $a[0].'.'.$a[1]);
		return response(true);
	}
}

register_service('glue.delete_object', 'delete_object', array('auth'=>true));
register_hook('delete_object', 'invoked when an object is going to be deleted, should be used for deleting referenced resources');


/**
 *	delete a page
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *	@return array response
 */
function delete_page($args)
{
	if (empty($args['page'])) {
		return response('Required argument "page" missing or empty', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 404);
	}
	
	log_msg('info', 'delete_page: deleting '.quot($args['page']));
	invoke_hook('delete_page', array('page'=>$args['page']));
	
	// TODO (later): make it possible to delete all revisions at once 
	// (optimization for frontend)
	// it's objects first
	$files = @scandir(CONTENT_DIR.'/'.str_replace('.', '/', $args['page']));
	foreach ($files as $f) {
		if ($f == '.' || $f == '..') {
			continue;
		}
		$ret = delete_object(array('name'=>$args['page'].'.'.$f));
		if ($ret['#error']) {
			// try to delete dangling symlinks
			$fn = CONTENT_DIR.'/'.str_replace('.', '/', $args['page']).'/'.$f;
			if (is_link($fn) && !is_file($fn) && !is_dir($fn)) {
				if (@unlink($fn)) {
					log_msg('info', 'delete_page: deleted dangling symlink '.quot($args['page'].'.'.$f));
				} else {
					log_msg('error', 'delete_page: error deleting dangling symlink '.quot($args['page'].'.'.$f));
				}
			} else {
				log_msg('error', 'delete_object: '.$ret['#data']);
			}
		}
	}
	
	// then the revision directory
	if (!@rmdir(CONTENT_DIR.'/'.str_replace('.', '/', $args['page']))) {
		return response('Error deleting page '.$args['page'], 500);
	} else {
		log_msg('debug', 'delete_page: deleted '.quot($args['page']));
		// drop the page from cache
		drop_cache('page', $args['page']);
	}
	
	// finally try the shared directory and page directory
	$a = expl('.', $args['page']);
	@rmdir(CONTENT_DIR.'/'.$a[0].'/shared');
	if (@rmdir(CONTENT_DIR.'/'.$a[0])) {
		log_msg('info', 'delete_page: parent page directory empty, removing '.quot($a[0]));
	}
	
	return response(true);
}

register_service('glue.delete_page', 'delete_page', array('auth'=>true));
register_hook('delete_page', 'invoked when a page is going to be deleted');
register_hook('has_reference', 'used for deleting referenced resources');


/**
 *	delete a file in the shared directory of a page
 *
 *	this function only deletes the file when there are no references to it 
 *	left. this is not meant to be called directly from the frontend, but 
 *	modules should use it when implementing delete_object.
 *	@param array $args arguments
 *		key 'pagename' is the pagename (i.e. page)
 *		key 'file' filename of file in the shared directory
 *		key 'max_cnt' delete the file if there are <= max_cnt references (defaults to zero)
 *	@return array response
 *		true if the file got deleted for good, false if not
 */
function delete_upload($args)
{
	if (@is_numeric($args['max_cnt'])) {
		$max_cnt = intval($args['max_cnt']);
	} else {
		$max_cnt = 0;
	}
	
	$refs = upload_references(array_merge($args, array('stop_after'=>$max_cnt+1)));
	if ($refs['#error']) {
		return $refs;
	} else {
		$refs = $refs['#data'];
	}
	
	$f = CONTENT_DIR.'/'.$args['pagename'].'/shared/'.$args['file'];
	if (count($refs) <= $max_cnt) {
		if (@unlink($f)) {
			log_msg('info', 'delete_upload: deleted '.quot($f));
			// being overly tidy, remove the shared dir if empty
			@rmdir(CONTENT_DIR.'/'.$args['pagename'].'/shared');
			return response(true);
		} else {
			return response('Error deleting '.quot($f), 500);
		}
	} else {
		log_msg('info', 'delete_upload: not deleting '.quot($f).' because there are still other objects referencing it');
		return response(false);
	}
}

register_service('glue.delete_upload', 'delete_upload', array('auth'=>true));


/**
 *	load an object from the content directory
 *
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *	@return array response
 */
function load_object($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing or empty', 400);
	}
	
	// open file for reading
	if (($f = @fopen(CONTENT_DIR.'/'.str_replace('.', '/', $args['name']), 'rb')) === false) {
		return response('Error opening '.quot($args['name']).' for reading', 404);
	}
	
	// set the name attribute
	// TODO (later): declaring arrays like this is probably unnecessary
	$ret = array();
	$ret['name'] = $args['name'];
	
	// read lines and fill object array
	$doing_attribs = true;
	while (!feof($f)) {
		$l = fgets($f, 4096);
		if ($doing_attribs) {
			// read attributes first
			if (substr($l, -2) == "\r\n") {
				$l = substr($l, 0, -2);
			} elseif (substr($l, -1) == "\n") {
				$l = substr($l, 0, -1);
			} elseif (substr($l, -1) == "\r") {
				$l = substr($l, 0, -1);
			}
			$a = expl(':', $l);
			if (count($a) == 0) {
				$doing_attribs = false;
			} elseif (count($a) == 1) {
				// value missing, ignoring
			} else {
				$ret[$a[0]] = implode(':', array_slice($a, 1));
			}
		} else {
			// content starts after the first empty line
			if (isset($ret['content'])) {
				$ret['content'] .= $l;
			} else {
				$ret['content'] = $l;
			}
		}
	}
	fclose($f);
	
	// re-set the name attribute (in case it got overwritten)
	$ret['name'] = $args['name'];
	
	return response($ret);
}

register_service('glue.load_object', 'load_object', array('auth'=>true));


/**
 *	return the target of an object symlink
 *
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *	@return array response
 *		key '#data' either has the target as object name, an 
 *		empty string if the target is outside the content directory or 
 *		false if the object is no symlink
 */
function object_get_symlink($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing or empty', 400);
	}
	
	// TODO (later): think the symlink situation on Windows through
	if (is_link(CONTENT_DIR.'/'.str_replace('.', '/', $args['name']))) {
		$f = readlink(CONTENT_DIR.'/'.str_replace('.', '/', $args['name']));
		if (substr($f, 0, 6) != '../../' || substr($f, 6, 2) == '..') {
			log_msg('warn', 'object_get_symlink: target outside of content directory: '.quot($args['name']).' -> '.quot($f));
			return response('');
		} else {
			return response(str_replace('/', '.', substr($f, 6)));
		}
	} else {
		return response(false);
	}
}

register_service('glue.object_get_symlink', 'object_get_symlink', array('auth'=>true));


/**
 *	create a symlink pointing to an object in all other pagename's head revisions
 *
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *	@return array response
 */
function object_make_symlink($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing or empty', 400);
	}
	if (!object_exists($args['name'])) {
		return response('Object '.quot($args['name']).' does not exist', 404);
	}

	$a = expl('.', $args['name']);
	// see if the object is itself a symlink
	$ret = object_get_symlink($args);
	$ret = $ret['#data'];
	if ($ret !== false && $ret !== '') {
		// create a symlink pointing to the object's target instead
		$target = '../../'.str_replace('.', '/', $ret);
		// skip both the original object's pagename and the new target's pagename
		$a_target = expl('.', $ret);
		$skip_pns = array($a[0], $a_target[0]);
	} else {
		$target = '../../'.str_replace('.', '/', $args['name']);
		$skip_pns = array($a[0]);
	}
	
	$pns = pagenames(array());
	$pns = $pns['#data'];
	// for every pagename
	foreach ($pns as $pn) {
		if (in_array($pn, $skip_pns)) {
			continue;
		}
		// check if the head revision exists
		if (is_dir(CONTENT_DIR.'/'.$pn.'/head')) {
			$link = CONTENT_DIR.'/'.$pn.'/head/'.$a[2];
			if (is_file($link) && !is_link($link)) {
				// delete objects with the same name
				// these should have been created when shapshotting and the 
				// revision has later been reverted to
				delete_object(array('name'=>$pn.'.head.'.$a[2]));
			} elseif (is_link($link) && !is_file($link) && !is_dir($link)) {
				// delete dangling symlinks too
				if (@unlink($link)) {
					log_msg('info', 'object_make_symlink: deleted dangling symlink '.quot($pn.'.head.'.$a[2]));
				} else {
					log_msg('error', 'object_make_symlink: error deleting dangling symlink '.quot($pn.'.head.'.$a[2]));
				}
			}
					
			// try to create symlink
			if (@symlink($target, $link)) {
				log_msg('debug', 'object_make_symlink: '.quot($pn.'.head.'.$a[2]).' -> '.quot($target));
				// drop the page from cache
				drop_cache('page', $pn.'.head');
			}
		}
	}
	
	return response(true);
}

register_service('glue.object_make_symlink', 'object_make_symlink', array('auth'=>true));


/**
 *	remove one or more attributes from an object in the content directory
 *
 *	this function takes the object lock.
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *		key 'attr' is either a string or an array containing the attribute 
 *			names (keys) to remove
 *	@return array response
 */
function object_remove_attr($args)
{
	if (!isset($args['attr'])) {
		return response('Required argument "attr" missing', 400);
	}
	
	// LOCK
	// TODO (later): $args['name'] might not be set
	$_l = _obj_lock($args['name'], LOCK_TIME);
	if ($_l === false) {
		return response('Could not acquire lock to '.quot($args['name']).' in '.LOCK_TIME.'ms', 500);
	}
	$obj = load_object($args);
	if ($obj['#error']) {
		// UNLOCK
		_obj_unlock($_l);
		return $obj;
	} else {
		$obj = $obj['#data'];
	}
	
	if (is_array($args['attr'])) {
		foreach ($args['attr'] as $a) {
			if (isset($obj[$a])) {
				unset($obj[$a]);
			}
		}
	} elseif (is_string($args['attr'])) {
		if (isset($obj[$args['attr']])) {
			unset($obj[$args['attr']]);
		}
	} else {
		// UNLOCK
		_obj_unlock($_l);
		return response('Argument "attr" need to be either array or string', 400);
	}
	
	$ret = save_object($obj);
	// UNLOCK
	_obj_unlock($_l);
	return $ret;
}

register_service('glue.object_remove_attr', 'object_remove_attr', array('auth'=>true));


/**
 *	return an array of all pagenames in the content directory
 *
 *	@param array $args unused
 *	@return array response
 */
function pagenames($args)
{
	if (is_dir(CONTENT_DIR)) {
		$files = @scandir(CONTENT_DIR);
		$ret = array();
		foreach ($files as $f) {
			if ($f == '.' || $f == '..' || $f == 'cache' || $f == 'shared') {
				continue;
			} elseif (!is_dir(CONTENT_DIR.'/'.$f)) {
				// skip files
				continue;
			} elseif (substr($f, 0, 1) == '.') {
				// skip directories starting with a dot (like .svn)
				continue;
			} else {
				$ret[] = $f;
			}
		}
		return response($ret);
	} else {
		return response(array());
	}
}

register_service('glue.pagenames', 'pagenames');


/**
 *	turn an object into an html string
 *
 *	the function also appends the resulting string to the output in 
 *	html.inc.php.
 *	@param array $args arguments
 *		string 'name' is the object name (i.e. page.rev.obj)
 *		bool 'edit' are we editing or not
 *	@return array response
 *		html
 */
function render_object($args)
{
	// maybe move this to common.inc.php in the future and get rid of some of 
	// these checks in the beginning
	$obj = load_object($args);
	if ($obj['#error']) {
		return $obj;
	} else {
		$obj = $obj['#data'];
	}
	if (!isset($args['edit'])) {
		return response('Required argument "edit" missing', 400);
	}
	if ($args['edit']) {
		$args['edit'] = true;
	} else {
		$args['edit'] = false;
	}
	
	log_msg('debug', 'render_object: rendering '.quot($args['name']));
	$ret = invoke_hook_while('render_object', false, array('obj'=>$obj, 'edit'=>$args['edit']));
	if (empty($ret)) {
		log_msg('warn', 'render_object: nobody claimed '.quot($obj['name']));
		return response('');
	} else {
		$temp = array_keys($ret);
		log_msg('debug', 'render_object: '.quot($obj['name']).' was handled by '.quot($temp[0]));
		$temp = array_values($ret);
		// make sure object has a tailing newline
		if (0 < strlen($temp[0]) && substr($temp[0], -1) != "\n") {
			$temp[0] .= nl();
		}
		body_append($temp[0]);
		// return the element as html-string as well
		return response($temp[0]);
	}
}

register_service('glue.render_object', 'render_object');
register_hook('render_object', 'render an object');


/**
 *	turn a page into an html string
 *
 *	the function also appends the resulting string to the output in 
 *	html.inc.php.
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *		key 'edit' are we editing or not
 *	@return array response
 *		html
 */
function render_page($args)
{
	// maybe move this to common.inc.php in the future and get rid of some of 
	// these checks in the beginning
	if (empty($args['page'])) {
		return response('Required argument "page" missing or empty', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 404);
	}
	if (!isset($args['edit'])) {
		return response('Required argument "edit" missing', 400);
	}
	if ($args['edit']) {
		$args['edit'] = true;
	} else {
		$args['edit'] = false;
	}
	
	log_msg('debug', 'render_page: rendering '.quot($args['page']));
	$bdy = &body();
	elem_add_class($bdy, 'page');
	elem_attr($bdy, 'id', $args['page']);
	invoke_hook('render_page_early', array('page'=>$args['page'], 'edit'=>$args['edit']));
	
	// for every file in the page directory
	$files = @scandir(CONTENT_DIR.'/'.str_replace('.', '/', $args['page']));
	foreach ($files as $f) {
		$fn = CONTENT_DIR.'/'.str_replace('.', '/', $args['page']).'/'.$f;
		if ($f == '.' || $f == '..') {
			continue;
		} elseif (is_link($fn) && !is_file($fn) && !is_dir($fn)) {
			// delete dangling symlink
			if (@unlink($fn)) {
				log_msg('info', 'render_page: deleted dangling symlink '.quot($args['page'].'.'.$f));
			} else {
				log_msg('error', 'render_page: error deleting dangling symlink '.quot($args['page'].'.'.$f));
			}
			continue;
		}
		// render object
		render_object(array('name'=>$args['page'].'.'.$f, 'edit'=>$args['edit']));
	}
	
	invoke_hook('render_page_late', array('page'=>$args['page'], 'edit'=>$args['edit']));
	log_msg('debug', 'render_page: finished '.quot($args['page']));
	
	// return the body element as html-string as well
	return response(elem_finalize($bdy));
}

register_service('glue.render_page', 'render_page');
register_hook('render_page_early', 'invoked early in the page rendering');
register_hook('render_page_late', 'invoked after the objects have been rendered');


/**
 *	rename a page
 *	@param array $args arguments
 *		key 'old' old page (i.e. page1.rev)
 *		key 'new' new page (i.e. page2.rev)
 *	@return array response
 */
function rename_page($args)
{
	if (empty($args['old'])) {
		return response('Required argument "old" missing or empty', 400);
	}
	$pns = pagenames(array());
	$pns = $pns['#data'];
	if (!in_array($args['old'], $pns)) {
		return response('Page name '.quot($args['old']).' does not exist', 404);
	}
	if (empty($args['new'])) {
		return response('Required argument "new" missing or empty', 400);
	}
	if (in_array($args['new'], $pns)) {
		return response('Page name '.quot($args['new']).' already exists', 400);
	}
	if (!valid_pagename($args['new'].'.head')) {
		return response('Invalid page name '.quot($args['new']), 400);
	}
	
	if (!@rename(CONTENT_DIR.'/'.$args['old'], CONTENT_DIR.'/'.$args['new'])) {
		return response('Error renaming page '.quot($args['old']).' to '.quot($args['new']), 500);	
	} else {
		log_msg('info', 'rename_page: renamed '.quot($args['old']).' to '.quot($args['new']));
		// clean up cache as well
		$revs = revisions(array('pagename'=>$args['new']));
		$revs = $revs['#data'];
		foreach ($revs as $rev) {
			drop_cache('page', $args['old'].'.'.$rev);
		}
		invoke_hook('rename_page', array('pagename'=>$args['new']));
		return response(true);
	}
}

register_service('glue.rename_page', 'rename_page', array('auth'=>true));
register_hook('rename_page', 'invoked when a page has been renamed');


/**
 *	revert to a specific revision of a page
 *
 *	this function makes the revision the page's new head revision by copying it.
 *	@param array $args arguments
 *		key 'page' page to revert to (i.e. page.rev)
 *	@return array response
 */
function revert($args)
{
	if (empty($args['page'])) {
		return response('Required argument "page" missing or empty', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 404);
	}
	$a = expl('.', $args['page']);
	if ($a[1] == 'head') {
		return response('Cannot revert to head revision', 400);
	}
	
	log_msg('info', 'revert: reverting to '.quot($args['page']));
	
	// delete current head revision
	if (page_exists($a[0].'.head')) {
		$ret = delete_page(array('page'=>$a[0].'.head'));
		if ($ret['#error']) {
			return $ret;
		}
	}
	
	// create new head revision
	$dest = CONTENT_DIR.'/'.$a[0].'/head';
	$m = umask(0000);
	if (!@mkdir($dest, 0777)) {
		umask($m);
		return response('Error creating directory '.quot($dest), 500);
	}
	umask($m);
	
	// copy files
	$src = CONTENT_DIR.'/'.$a[0].'/'.$a[1];
	$files = scandir($src);
	foreach ($files as $f) {
		if ($f == '.' || $f == '..') {
			continue;
		} elseif (is_file($src.'/'.$f)) {
			// copy file
			$m = umask(0111);
			if (!@copy($src.'/'.$f, $dest.'/'.$f)) {
				log_msg('error', 'revert: error copying '.quot($src.'/'.$f).' to '.quot($dest.'/'.$f).', skipping file');
			}
			umask($m);
		}
	}
	
	log_msg('info', 'revert: reverted to '.quot($args['page']));
	invoke_hook('revert', array('page'=>$args['page']));
	
	return response(true);
}

register_service('glue.revert', 'revert', array('auth'=>true));
register_hook('revert', 'invoked after a page has been reverted to');


/**
 *	return an array of all revisions of a page
 *
 *	@param array $args arguments
 *		key 'pagename' is the pagename (i.e. page)
 *	@return array response
 */
function revisions($args)
{
	if (empty($args['pagename'])) {
		return response('Required argument "pagename" missing or empty', 400);
	}
	if (!is_dir(CONTENT_DIR.'/'.$args['pagename'])) {
		return response('Page name '.quot($args['pagename']).' does not exist', 404);
	}
	
	$files = @scandir(CONTENT_DIR.'/'.$args['pagename']);
	$ret = array();
	foreach ($files as $f) {
		if ($f == '.' || $f == '..' || $f == 'shared') {
			continue;
		} elseif (!is_dir(CONTENT_DIR.'/'.$args['pagename'].'/'.$f)) {
			// skip files
			continue;
		} else {
			$ret[] = $f;
		}
	}
	return response($ret);
}

register_service('glue.revisions', 'revisions');


/**
 *	return an array with informations about all revisions of a page
 *
 *	@param array $args arguments
 *		key 'pagename' is the pagename (i.e. page)
 *		key 'sort' can be either 'time' (descending) or 'name' (ascending, the 
 *		default)
 *	@return array response
 */
function revisions_info($args)
{
	$revs = revisions($args);
	if ($revs['#error']) {
		return $revs;
	}
	
	$ret = array();
	foreach ($revs['#data'] as $r) {
		$d = CONTENT_DIR.'/'.$args['pagename'].'/'.$r;
		$ret[] = array('revision'=>$r, 'time'=>@filemtime($d), 'num_objs'=>count(@scandir($d))-2, 'page'=>$args['pagename'].'.'.$r);
	}
	
	if (isset($args['sort']) && $args['sort'] == 'time') {
		// make head revision always most recent one
		$head = false;
		for ($i=0; $i < count($ret); $i++) {
			if ($ret[$i]['revision'] == 'head') {
				$head = $ret[$i];
				array_splice($ret, $i, 1);
				$i--;
			}
		}
		usort($ret, '_cmp_time');
		if ($head !== false) {
			$ret = array_merge(array($head), $ret);
		}
	}
	
	return response($ret);
}

register_service('glue.revisions_info', 'revisions_info');


/**
 *	save an object to the content directory
 *
 *	use update_object() whenever possible as we want to preserve any object 
 *	metadata that is stored in as attributes.
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *		key 'content' is the object's content
 *		all other key/value pairs are treated as attributes
 *	@return array response
 */
function save_object($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing or empty', 400);
	}
	
	// open file for writing
	$m = umask(0111);
	if (($f = @fopen(CONTENT_DIR.'/'.str_replace('.', '/', $args['name']), 'wb')) === false) {
		umask($m);
		return response('Error opening '.quot($args['name']).' for writing', 500);
	}
	umask($m);
	
	// save attributes
	foreach ($args as $key=>$val) {
		if ($key == 'name' || $key == 'content') {
			continue;
		}
		// check for delimiter character in key
		if (strpos($key, ':') !== false) {
			log_msg('warn', 'save_object: skipping attribute '.quot($key).' in object '.quot($args['name']));
			continue;
		}
		// filter newlines from value
		$val = str_replace("\r\n", '', $val);
		$val = str_replace("\n", '', $val);
		$val = str_replace("\r", '', $val);
		fwrite($f, $key.':'.$val."\n");
	}
	
	// save content
	if (isset($args['content'])) {
		fwrite($f, "\n");
		fwrite($f, $args['content']);
	}
	
	fclose($f);
	// drop the page from cache
	// TODO (later): also drop related caches if object is a symlink or target 
	// of a symlink
	$a = expl('.', $args['name']);
	drop_cache('page', $a[0].'.'.$a[1]);
	
	return response(true);
}

register_service('glue.save_object', 'save_object', array('auth'=>true));


/**
 *	save the state of a html element corresponding to an object to disk
 *
 *	this function takes the object lock.
 *	@param array $args arguments
 *		key 'html' one html element
 *	@return array response
 *		true if successful
 */
function save_state($args)
{
	if (empty($args['html'])) {
		return response('Required argument "html" missing or empty', 400);
	}
	
	require_once('html.inc.php');
	require_once('html_parse.inc.php');
	
	$elem = html_parse_elem($args['html']);
	if (!elem_has_class($elem, 'object')) {
		return response('Error saving state as class "object" is not set', 400);
	} elseif (!object_exists(elem_attr($elem, 'id'))) {
		return response('Error saving state as object does not exist', 404);
	}
	
	// LOCK
	$L = _obj_lock(elem_attr($elem, 'id'), LOCK_TIME);
	if ($L === false) {
		return response('Could not acquire lock to '.quot($args['name']).' in '.LOCK_TIME.'ms', 500);
	}
	$obj = load_object(array('name'=>elem_attr($elem, 'id')));
	if ($obj['#error']) {
		// UNLOCK
		_obj_unlock($L);
		return response('Error saving state, cannot load '.quot(elem_attr($elem, 'id')), 500);
	} else {
		$obj = $obj['#data'];
	}
	$ret = invoke_hook_while('save_state', false, array('elem'=>$elem, 'obj'=>$obj));
	// UNLOCK
	_obj_unlock($L);
	if (count($ret) == 0) {
		return response('Error saving state as nobody claimed element', 500);
	} else {
		$temp = array_keys($ret);
		log_msg('info', 'save_state: '.quot($obj['name']).' was handled by '.quot($temp[0]));
		return response(true);
	}
}

register_service('glue.save_state', 'save_state', array('auth'=>true));
// modules handling this hook need to make sure that they are not calling 
// either update_object() or object_remove_attr(), but rather save_object() 
// directly
register_hook('save_state', 'save the current state of an object to disk');


/**
 *	set the startpage
 *
 *	@param array $args arguments
 *		key 'page' is the page (i.e. page.rev)
 *	@return array response
 *		true if successful
 */
function set_startpage($args)
{
	if (!isset($args['page'])) {
		return response('Required argument "page" missing', 400);
	}
	
	$m = umask(0111);
	if (file_put_contents(CONTENT_DIR.'/startpage', $args['page']) === false) {
		umask($m);
		return response('Error setting start page', 500);
	} else {
		umask($m);
		return response(true);
	}
}

register_service('glue.set_startpage', 'set_startpage', array('auth'=>true));


/**
 *	create a snapshot from a page
 *
 *	@param array $args arguments
 *		key 'page' page to shapshot (i.e. page.rev)
 *		key 'rev' (optional) new revision name (i.e. rev2) (if empty or not set 
 *			a revision starting with 'auto-' and the current date will be 
 *			created)
 *	@return array response (holding the page of the newly created revision 
 *		if successful)
 */
function snapshot($args)
{
	if (empty($args['page'])) {
		return response('Required argument "page" missing or empty', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 404);
	}
	// setup revision name
	$a = expl('.', $args['page']);
	if (empty($args['rev'])) {
		$args['rev'] = 'auto-'.date('YmdHis');
	} elseif (page_exists($a[0].'.'.$args['rev'])) {
		return response('Revision '.quot($args['rev']).' already exists', 400);
	} elseif (!valid_pagename($a[0].'.'.$args['rev'])) {
		return response('Invalid revision '.quot($args['rev']), 400);
	}
	
	// create revision
	$dest = CONTENT_DIR.'/'.$a[0].'/'.$args['rev'];
	$m = umask(0000);
	if (!@mkdir($dest)) {
		umask($m);
		return response('Error creating directory '.quot($dest), 500);
	}
	umask($m);
	
	// copy files
	// we go through the files one by one in order to spot symlinks hiding
	$src = CONTENT_DIR.'/'.str_replace('.', '/', $args['page']);
	$files = scandir($src);
	foreach ($files as $f) {
		if ($f == '.' || $f == '..') {
			continue;
		} elseif (is_dir($src.'/'.$f)) {
			log_msg('warn', 'snapshot: skipping '.quot($src.'/'.$f).' as we don\'t support directories inside pages');
		} elseif (is_link($src.'/'.$f) && is_file($src.'/'.$f)) {
			// a proper symlink, copy content
			$s = @file_get_contents($src.'/'.$f);
			$m = umask(0111);
			if (!@file_put_contents($dest.'/'.$f, $s)) {
				log_msg('error', 'snapshot: error writing to '.quot($dest.'/'.$f). ', skipping file');
			} else {
				log_msg('debug', 'snapshot: copied the content of symlink '.quot($args['page'].'.'.$f));
			}
			umask($m);
			// load the newly created snapshot and give modules a chance to 
			// copy referenced files as well
			$dest_name = $a[0].'.'.$args['rev'].'.'.$f;
			$dest_obj = load_object(array('name'=>$dest_name));
			if ($dest_obj['#error']) {
				log_msg('error', 'snapshot: error loading snapshotted object '.quot($dest_name).', skipping hook');
			} else {
				$dest_obj = $dest_obj['#data'];
				// get the source object's target
				$src_name = $args['page'].'.'.$f;
				$src_target = object_get_symlink(array('name'=>$src_name));
				if ($src_target['#error']) {
					log_msg('error', 'snapshot: error getting the symlink target of source object '.quot($src_name).', skipping hook');
				} else {
					$src_target = $src_target['#data'];
					// hook
					invoke_hook('snapshot_symlink', array('obj'=>$dest_obj, 'origin'=>implode('.', array_slice(expl('.', $src_target), 0, 2))));
				}
			}
		} elseif (is_file($src.'/'.$f)) {
			// copy file
			$m = umask(0111);
			if (!@copy($src.'/'.$f, $dest.'/'.$f)) {
				log_msg('error', 'snapshot: error copying '.quot($src.'/'.$f).' to '.quot($dest.'/'.$f).', skipping file');
			}
			umask($m);
		}
	}
	
	log_msg('info', 'snapshot: created snapshot '.quot($a[0].'.'.$args['rev']).' from '.quot($args['page']));
	return response($a[0].'.'.$args['rev']);
}

register_service('glue.snapshot', 'snapshot', array('auth'=>true));
register_hook('snapshot_symlink', 'invoked when a symlink is part of a page that gets snapshotted; the module in question is supposed to copy all referenced files to the shared directory of the destination page');


/**
 *	update an object
 *
 *	this function merges the attributes in $args with the object already on 
 *	disk. the object need not exist before, though.
 *	this function takes the object lock.
 *	@param array $args arguments
 *		key 'name' is the object name (i.e. page.rev.obj)
 *		key 'content' is the object's content
 *		all other key/value pairs are treated as attributes
 *	@return array response
 */
function update_object($args)
{
	if (empty($args['name'])) {
		return response('Required argument "name" missing or empty', 400);
	}
	
	// LOCK
	$L = _obj_lock($args['name'], LOCK_TIME);
	// the object need not exist, so we're not checking against 
	// $L being NULL here
	if ($L === false) {
		return response('Could not acquire lock to '.quot($args['name']).' in '.LOCK_TIME.'ms', 500);
	}
	$old = load_object($args);
	if ($old['#error']) {
		$old = array();
	} else {
		$old = $old['#data'];
	}
	$new = array_merge($old, $args);
	
	$ret = save_object($new);
	// UNLOCK
	_obj_unlock($L);
	return $ret;
}

register_service('glue.update_object', 'update_object', array('auth'=>true));


/**
 *	upload one or more files
 *
 *	@param array $args arguments
 *		key 'page' page to upload the files to (i.e. page.rev)
 *		key 'preferred_module' (optional) try first to invoke the upload method 
 *			on this module
 *	@return array response
 *		array of rendered, newly created objects
 */
function upload_files($args)
{
	if (empty($args['page'])) {
		return response('Required argument "page" missing or empty', 400);
	}
	if (!page_exists($args['page'])) {
		return response('Page '.quot($args['page']).' does not exist', 404);
	}
	
	$ret = array();
	
	log_msg('debug', 'upload_files: $_FILES is '.var_dump_inl($_FILES));
	foreach ($_FILES as $f) {
		$existed = false;
		$fn = upload_file($f['tmp_name'], $args['page'], $f['name'], $existed);
		if ($fn === false) {
			continue;
		} else {
			$args = array_merge($args, array('file'=>$fn, 'mime'=>$f['type'], 'size'=>$f['size']));
			// clear mime type if set to default application/octet-stream
			if ($args['mime'] == 'application/octet-stream') {
				$args['mime'] = '';
			}
		}
		$s = false;
		// check preferred_module first
		if (!empty($args['preferred_module'])) {
			// make sure all modules are loaded
			load_modules();
			$func = $args['preferred_module'].'_upload';
			if (is_callable($func)) {
				log_msg('debug', 'upload_files: invoking hook upload, calling '.$func);
				$s = $func($args);
				if ($s !== false) {
					log_msg('info', 'upload_object: '.quot($fn).' was handled by '.quot($args['preferred_module']));
				}
			}
		}
		// check all other modules next
		if ($s === false) {
			$r = invoke_hook_while('upload', false, $args);
			if (count($r) == 1) {
				$s = array_pop(array_values($r));
				log_msg('info', 'upload_object: '.quot($fn).' was handled by '.quot(array_pop(array_keys($r))));
			}
		}
		// check fallback hook last
		if ($s === false) {
			$r = invoke_hook_while('upload_fallback', false, $args);
			if (count($r) == 1) {
				$s = array_pop(array_values($r));
				log_msg('info', 'upload_object: '.quot($fn).' was (fallback-) handled by '.quot(array_pop(array_keys($r))));
			}
		}
		
		if ($s === false) {
			log_msg('warn', 'upload_files: nobody cared about file '.quot($fn).', type '.$f['type']);
			// delete file again unless it did already exist
			if (!$existed) {
				$a = expl('.', $args['page']);
				@unlink(CONTENT_DIR.'/'.$a[0].'/shared/'.$fn);
			}
		} else {
			$ret[] = $s;
		}
	}
	
	return response($ret);
}

register_service('glue.upload_files', 'upload_files', array('auth'=>true));


/**
 *	list all objects referencing a certain file in the shared directory
 *
 *	@param array $args arguments
 *		key 'pagename' is the pagename (i.e. page)
 *		key 'file' filename of file in the shared directory
 *		key 'stop_after' n references
 *	@return array response
 *		array of objects (i.e. page.rev.obj)
 */
function upload_references($args)
{
	$revs = revisions($args);
	if ($revs['#error']) {
		return $revs;
	} else {
		$revs = $revs['#data'];
	}
	if (empty($args['file'])) {
		return response('Required argument "file" missing or empty', 400);
	}
	// this is an optimization for delete_upload()
	if (@is_numeric($args['stop_after'])) {
		$stop_after = intval($args['stop_after']);
	} else {
		$stop_after = 0;
	}
	
	$ret = array();
	
	// for each revision
	foreach ($revs as $rev) {
		// load all objects
		$files = @scandir(CONTENT_DIR.'/'.$args['pagename'].'/'.$rev);
		foreach ($files as $f) {
			if ($f == '.' || $f == '..') {
				continue;
			}
			$obj = load_object(array('name'=>$args['pagename'].'.'.$rev.'.'.$f));
			if ($obj['#error']) {
				continue;
			} else {
				$obj = $obj['#data'];
			}
			// and handle the object to our modules
			log_msg('debug', 'upload_references: checking '.quot($obj['name']));
			$revs = invoke_hook_while('has_reference', false, array('file'=>$args['file'], 'obj'=>$obj));
			if (count($revs)) {
				$ret[] = $args['pagename'].'.'.$rev.'.'.$f;
				if (count($ret) == $stop_after) {
					// return prematurely
					return response($ret);
				}
			}
		}
	}
	
	return response($ret);
}

register_service('glue.upload_references', 'upload_references', array('auth'=>true));
register_hook('has_reference', 'check if an object references an uploaded file');


?>