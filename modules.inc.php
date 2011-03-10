<?php

/*
 *	modules.inc.php
 *	Generic modules and services infrastructure
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('log.inc.php');

if (!isset($hooks)) {
	$hooks = array();
}
if (!isset($modules)) {
	$modules = array();
}
if (!isset($services)) {
	$services = array();
}


/**
 *	get an array of all currently registered hooks
 *
 *	@return array
 */
function get_hooks()
{
	global $hooks;
	return $hooks;
}


/**
 *	get an array of all currently loaded modules
 *
 *	@return array
 */
function get_modules()
{
	global $modules;
	// no need to sort the array since the modules were loaded by ordered 
	// by their filenames anyway
	return $modules;
}


/**
 *	return a service-array
 *
 *	call load_modules() before calling this function.
 *	@param string $service service name
 *	@return array or false if not found
 */
function get_service($service)
{
	global $services;
	if (!isset($services[$service])) {
		return false;
	} else {
		return $services[$service];
	}
}


/**
 *	invoke a hook
 *
 *	this function also takes care of loading all modules.
 *	@param string $hook hook to invoke
 *	@param array $args arguments-array (can include references)
 *	@param string $first_module first module to call (optional)
 *	@param string $last_module last module to call (optional)
 *	@return array of results (module=>result)
 */
function invoke_hook($hook, $args = array(), $first_module = '', $last_module = '')
{
	global $modules;
	
	$ret = array();
	// make sure all modules are loaded
	load_modules();
	
	// optionally call a module before the other ones
	$func = $first_module.'_'.$hook;
	if (!empty($first_module) && is_callable($func)) {
		// DEBUG
		log_msg('debug', 'modules: invoking hook '.$hook.', calling first '.$func);
		$cur = $func($args);
		$ret[$first_module] = $cur;
	}
	
	foreach ($modules as $m) {
		$func = $m.'_'.$hook;
		if ($m != $first_module && $m != $last_module && is_callable($func)) {
			// DEBUG
			log_msg('debug', 'modules: invoking hook '.$hook.', calling '.$func);
			// we can't pass on references with func_get_arg() etc
			// so use a container $args array, which can hold references it seems
			// tested on PHP 5.2.6, maybe test on others as well
			$cur = $func($args);
			$ret[$m] = $cur;
		}
	}
	
	// optionally call a module after the other ones
	$func = $last_module.'_'.$hook;
	if (!empty($last_module) && is_callable($func)) {
		// DEBUG
		log_msg('debug', 'modules: invoking hook '.$hook.', calling last '.$func);
		$cur = $func($args);
		$ret[$last_module] = $cur;
	}
	
	log_msg('debug', 'modules: invoke_hook on '.$hook.' returned '.var_dump_inl($ret));
	return $ret;
}


/**
 *	invoke a hook with a specified module being called first
 *
 *	this function also takes care of loading all modules.
 *	@param string $hook hook to invoke
 *	@param string $first_module name of first module to call
 *	@param array $args arguments-array (can include references)
 *	@return array of results (module=>result)
 */
function invoke_hook_first($hook, $first_module, $args = array())
{
	return invoke_hook($hook, $args, $first_module, '');
}


/**
 *	invoke a hook with a specified module being called last
 *
 *	this function also takes care of loading all modules.
 *	@param string $hook hook to invoke
 *	@param string $last_module name of last module to call
 *	@param array $args arguments-array (can include references)
 *	@return array of results (module=>result)
 */
function invoke_hook_last($hook, $last_module, $args = array())
{
	return invoke_hook($hook, $args, '', $last_module);
}


/**
 *	invoke a hook while the returned result is $while
 *
 *	this function also takes care of loading all modules.
 *	@param string $hook hook to invoke
 *	@param mixed $while value to compare the returned result with
 *	@param array $args arguments-array
 *	@return array with result (module=>result) or empty result if there was none
 */
function invoke_hook_while($hook, $while, $args = array())
{
	global $modules;
	
	// make sure all modules are loaded
	load_modules();
	
	foreach ($modules as $m) {
		if (is_callable($m.'_'.$hook)) {
			$func = $m.'_'.$hook;
			// DEBUG
			log_msg('debug', 'modules: invoking hook '.$hook.', calling '.$func);
			$cur = $func($args);
			if ($cur !== $while) {
				$ret = array($m=>$cur);
				// DEBUG
				//log_msg('debug', 'modules: invoke_hook_while on '.$hook.' returned '.var_dump_inl($ret));
				return $ret;
			}
		}
	}

	log_msg('debug', 'modules: invoke_hook_while on '.$hook.' returned '.var_dump_inl(array()));
	return array();
}


/**
 *	load modules
 *
 *	use this function instead of including module_* files directly.
 *	@param string $search module to load (by default all modules are loaded)
 *	@param bool $optional whether to log any error to locate the module
 *	@return bool true if successful, false if not
 */
function load_modules($search = '', $optional = false)
{
	global $modules;
	$late_loading = count($modules) ? true : false;
	
	// we only take $search up to the first dot
	if (($p = strpos($search, '.')) !== false) {
		$search = substr($search, 0, $p);
	}
	
	$files = scandir('.');
	foreach ($files as $f) {
		if (strtolower(substr($f, 0, 7)) != 'module_' || strtolower(substr($f, -4)) != '.php') {
			continue;
		}
		// check if already loaded
		if (substr($f, -8) == '.inc.php') {
			$name = substr($f, 7, -8);
		} else {
			$name = substr($f, 7, -4);
		}
		if (in_array($name, $modules)) {
			continue;
		}
		if ($search != '' && strtolower($name) != $search) {
			continue;
		}
		// TODO (later): log error messages while parsing if possible
		ob_start();
		if ($late_loading) {
			log_msg('debug', 'modules: late-loading module '.$name);
		} else {
			log_msg('debug', 'modules: loading module '.$name);
		}
		@include_once($f);
		$s = ob_get_contents();
		log_msg('debug', 'modules: finished loading module '.$name.', output '.quot($s));
		ob_end_clean();
		// add to modules array
		$modules[] = $name;
	}
	
	// check if we were successful
	if (!empty($search) && empty($modules) && !$optional) {
		log_msg('error', 'modules: cannot find required module '.$search.', make sure it is installed in the program directory');
		return false;
	} else {
		return true;
	}
}


/**
 *	register a service
 *
 *	you can specify the service's arguments in $args['args']. see 
 *	run_services().
 *	@param string $service service name
 *	@param string $func function name
 *	@param array $args optional arguments
 */
function register_service($service, $func, $args = array())
{
	global $services;
	$trace = debug_backtrace();
	$services[$service] = array_merge(array('args'=>array()), array_merge($args, array('func'=>$func, 'file'=>basename($trace[0]['file']), 'line'=>$trace[0]['line'])));
	log_msg('debug', 'modules: '.basename($trace[0]['file']).':'.$trace[0]['line'].' registered service '.quot($service));
}


/**
 *	register a hook
 *
 *	this function is for information purposes only. you can also use a hook 
 *	without registering it here. this is not recommended though.
 *	@param string $hook hook name
 *	@param string $info some words on the hook's purpose
 */
function register_hook($hook, $info = '')
{
	global $hooks;
	$trace = debug_backtrace();
	$hooks[$hook] = array('file'=>basename($trace[0]['file']), 'line'=>$trace[0]['line'], 'info'=>$info);
	log_msg('debug', 'modules: '.basename($trace[0]['file']).':'.$trace[0]['line'].' registered hook '.quot($hook));
}


/**
 *	return a response-array
 *
 *	@param mixed $data (payload) data (should be the error-message if 
 *	$error is true)
 *	@param mixed $error error core or true if an error occurred
 *	@return array
 */
function response($data, $error = false)
{
	$ret = array();
	if ($error === false) {
		$ret['#error'] = false;
	} else {
		$ret['#error'] = true;
	}
	if (is_numeric($error)) {
		$ret['#error_code'] = intval($error);
	}
	$ret['#data'] = $data;
	return $ret;
}


/**
 *	run a service
 *
 *	this function checks the arguments in $args against the (optional) 
 *	declaration given in register_service().
 *	@param string $service service name
 *	@param array $args arguments-array
 *	@return return value of the service function or a response-array 
 *	in case of an error
 */
function run_service($service, $args = array())
{
	global $services;
	
	if (!isset($services[$service])) {
		return response('Unknown service '.quot($service), 400);
	}
	
	// check arguments
	foreach ($services[$service]['args'] as $key=>$val) {
		if (!isset($args[$key])) {
			if (isset($val['req']) && $val['req']) {
				return response('Required argument '.quot($key).' missing', 400);
			} elseif (isset($val['def'])) {
				$args[$key] = $val['def'];
			}
		}
		if (isset($val['type'])) {
			if ($val['type'] == 'array') {
				if (is_array($args[$key])) {
					// nothing to do here
				} elseif (is_object($args[$key])) {
					// convert to array
					$args[$key] = (array)$args[$key];
				} else {
					return response('Invalid type of argument '.quot($key).', expected array', 400);
				}
			} elseif ($val['type'] == 'bool') {
				if (is_bool($args[$key])) {
					// nothing to do here
				} elseif (intval($args[$key]) === 1) {
					$args[$key] = true;
				} elseif (intval($args[$key]) === 0) {
					$args[$key] = false;
				} else {
					return response('Invalid type of argument '.quot($key).', expected bool', 400);
				}
			} elseif ($val['type'] == 'float') {
				if (!is_numeric($args[$key])) {
					return response('Invalid type of argument '.quot($key).', expected float', 400);
				} else {
					$args[$key] = floatval($args[$key]);
				}
			} elseif ($val['type'] == 'int') {
				if (!is_numeric($args[$key])) {
					return response('Invalid type of argument '.quot($key).', expected int', 400);
				} else {
					$args[$key] = intval($args[$key]);
				}
			} elseif ($val['type'] == 'string') {
				$args[$key] = strval($args[$key]);
			} else {
				log_msg('error', 'modules: invalid type given for argument '.quot($key).' of service '.quot($service));
			}
		}
	}
	
	log_msg('info', 'modules: running service '.quot($service));
	return $services[$service]['func']($args);
}


?>
