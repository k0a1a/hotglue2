<?php

/*
 *	log.inc.php
 *	Generic logging infrastructure
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('util.inc.php');

if (!isset($logfile)) {
	$logfile = false;
}
if (!isset($loglevels)) {
	$loglevels = array('error', 'warn', 'info', 'debug');
}
if (!isset($request_id)) {
	// mt_rand() is seeded automatically
	$request_id = mt_rand(1, 32768);
}


/**
 *	log a message to file
 *
 *	@param string $level can be error, warn, info or debug
 *	@param string $msg message
 *	@return bool true if successful, false if not
 */
function log_msg($level, $msg )
{
	global $logfile;
	global $loglevels;
	global $request_id;
	
	// open logfile
	if ($logfile === false) {
		$m = umask(0111);
		// having two processes appending to the same file should 
		// work fine (at least on Linux)
		$logfile = @fopen(LOG_FILE, 'ab');
		umask($m);
	}
	if ($logfile === false) {
		return false;
	}
	
	foreach ($loglevels as $ll) {
		if ($ll == $level) {
			fwrite($logfile, date('Y-m-d H:i:s').tab().pad($_SERVER['REMOTE_ADDR'], 15).tab().sprintf('%05u', $request_id).tab().$level.tab().$msg.nl());
			fflush($logfile);
			break;
		}
		if ($ll == LOG_LEVEL) {
			break;
		}
	}
	return true;
}


// we need no extra function to log response-arrays as they are logged further 
// down in the server (e.g. json.php)
