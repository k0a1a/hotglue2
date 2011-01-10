<?php

/**
 *	json.php
 *	HTTP request handler for JSON-encoded AJAX calls
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('log.inc.php');
log_msg('info', '--- json request ---');
require_once('common.inc.php');
require_once('modules.inc.php');
require_once('util.inc.php');


// set mime type and encoding first
header('Content-Type: application/json; charset=UTF-8');

// get method and arguments
$args = array();
switch ($_SERVER['REQUEST_METHOD']) {
	// we don't use $_REQUEST here because this includes cookies as well
	// disable support for GET to make cross site request forgery (xsrf) 
	// at least harder to do
	//case 'GET':
	//	foreach ($_GET as $key=>$val) {
	//		if (get_magic_quotes_gpc()) {
	//			$val = stripslashes($val);
	//		}
	//		$dec = @json_decode($val, true);
	//		if ($dec === NULL) {
	//			$err = response('Error decoding the argument '.quot($key).' => '.var_dump_inl($val), 400);
	//			echo json_encode($err);
	//			log_msg('warn', 'json: '.$err['#data']);
	//			die();
	//		} else {
	//			$args[$key] = $dec;
	//		}
	//	}
	//	break;
	case 'POST':
		// DEBUG
		log_msg('debug', 'json: magic quotes are '.(get_magic_quotes_gpc()?'on':'off'));
		log_msg('debug', 'json: php version '.phpversion());
		log_msg('debug', 'json: raw post '.quot(var_dump_inl($_POST)));
		foreach ($_POST as $key=>$val) {
			if (get_magic_quotes_gpc()) {
				$val = stripslashes($val);
			}
			$dec = @json_decode($val, true);
			if ($dec === NULL) {
				$err = response('Error decoding the argument '.quot($key).' => '.var_dump_inl($val), 400);
				echo json_encode($err);
				log_msg('warn', 'json: '.$err['#data']);
				die();
			} else {
				$args[$key] = $dec;
			}
		}
		break;
	default:
		//$err = response('Only HTTP GET and POST requests supported', 400);
		$err = response('Only HTTP POST requests supported', 400);
		echo json_encode($err);
		log_msg('warn', 'json: '.$err['#data']);
		die();
}

// check if we got a method argument
if (!empty($args['method'])) {
	$method = $args['method'];
	unset($args['method']);
	log_msg('debug', 'json: method is '.quot($method));
	log_msg('debug', 'json: arguments are '.var_dump_inl($args));
	log_msg('debug', 'json: base url is '.quot(base_url()));
} else {
	// this can also be caused by an upload exceeding the limits 
	// set in php.ini
	$err = response('Required argument "method" missing', 400);
	echo json_encode($err);
	log_msg('warn', 'json: '.$err['#data']);
	die();
}

load_modules($method);

if (!($m = get_service($method))) {
	$err = response('Unknown method '.quot($method), 400);
	echo json_encode($err);
	log_msg('warn', 'json: '.$err['#data']);
	die();
}

// check authentication
if (isset($m['auth']) && $m['auth']) {
	if (!is_auth()) {
		prompt_auth(true);
	}
}

if (isset($m['cross-origin']) && $m['cross-origin']) {
	// output cross-origin header if requested
	header('Access-Controll-Allow-Origin: *');
} else {
	// otherwise check the referer to make xsrf harder
	if (!empty($_SERVER['HTTP_REFERER'])) {
		$bu = base_url();
		if (substr($_SERVER['HTTP_REFERER'], 0, strlen($bu)) != $bu) {
			echo json_encode(response('Cross-origin requests not supported for this method', 400));
			log_msg('warn', 'json: possible xsrf detected, referer is '.quot($_SERVER['HTTP_REFERER']).', arguments '.var_dump_inl($args));
			die();
		}
	}
}

// run service and output result
$ret = run_service($method, $args);
if (is_array($ret) && isset($ret['#error']) && $ret['#error']) {
	log_msg('warn', 'json: service '.$method.' returned error '.quot($ret['#data']));
} elseif (is_array($ret) && isset($ret['#data'])) {
	log_msg('debug', 'json: service returned '.var_dump_inl($ret['#data']));
}
echo json_encode($ret);


?>