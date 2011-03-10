<?php

/*
 *	util.inc.php
 *	Static utility functions
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

/**
 *	convert an associative array to a javascript block
 *
 *	@param array $container container array
 *	@return string
 */
function array_to_js($container)
{
	$ret = '<script type="text/javascript">'.nl();
	// sort container by keys
	ksort($container);
	$exists = array();
	foreach ($container as $key=>$val) {
		// make sure the keys exist
		$objs = expl('.', $key);
		for ($i=0; $i < count($objs)-1; $i++) {
			$obj = implode('.', array_slice($objs, 0, $i+1));
			if (!in_array($obj, $exists)) {
				if ($i == 0) {
					$ret .= tab().'var '.$obj.' = '.$obj.' || {};'.nl();
				} else {
					$ret .= tab().$obj.' = '.$obj.' || {};'.nl();
				}
				$exists[] = $obj;
			}
		}
		$ret .= tab().''.$key.' = '.json_encode($val).';'.nl();
	}
	$ret .= '</script>'.nl();
	return $ret;
}


/**
 *	make an array off associative array unique in a certain key-value
 *
 *	@param array &$a reference to array
 *	@param mixed $key key whose value we compare
 */
function array_unique_element(&$a, $key)
{
	// for each row
	for ($cur=0; $cur < count($a); $cur++) {
		// look in every row further down
		for ($i=$cur+1; $i < count($a); $i++) {
			// to see if the value of a key in the array is the same as in the 
			// current row
			if ($a[$i][$key] == $a[$cur][$key]) {
				// delete the row further down
				array_splice($a, $i, 1);
				$i--;
			}
		}
	}
}


/**
 *	check if a directory already contains a file (based on its content)
 *
 *	@param string $dir directory to check
 *	@param string $fn file to look for
 *	@param string $orig_fn first check this filename (optional)
 *	@return (basename) filename of identical file in $dir or false if 
 *	there is none
 */
function dir_has_same_file($dir, $fn, $orig_fn = '')
{
	// strip any slash at the end of $dir
	if (substr($dir, -1) == '/') {
		$dir = substr($dir, 0, -1);
	}
	if (empty($orig_fn)) {
		$orig_fn = basename($fn);
	} else {
		$orig_fn = basename($orig_fn);
	}
	
	if (($dir_fns = @scandir($dir)) === false) {
		return false;
	}
	// optimization: check $orig_fn first
	if (($i = array_search($orig_fn, $dir_fns)) !== false) {
		$a = array_splice($dir_fns, $i, 1);
		array_unshift($dir_fns, $a[0]);
	}
	foreach ($dir_fns as $f) {
		if ($f == '.' || $f == '..') {
			continue;
		}
		if (!file_is_different($fn, $dir.'/'.$f)) {
			return $f;
		}
	}
	return false;
}


/**
 *	check if two directories are different
 *
 *	@param string $a filename
 *	@param string $b filename
 *	@return bool
 */
function dir_is_different($a, $b)
{
	if (substr($a, -1) == '/') {
		$a = substr($a, 0, -1);
	}
	if (substr($b, -1) == '/') {
		$b = substr($b, 0, -1);
	}
	
	$a_fns = @scandir($a);
	$b_fns = @scandir($b);
	if ($a_fns !== $b_fns) {
		return true;
	}
	
	foreach ($a_fns as $fn) {
		if ($fn == '.' || $fn == '..') {
			continue;
		}
		if (is_dir($a.'/'.$fn) || is_dir($b.'/'.$fn)) {
			if (dir_is_different($a.'/'.$fn, $b.'/'.$fn)) {
				return true;
			}
		} else {
			if (file_is_different($a.'/'.$fn, $b.'/'.$fn)) {
				return true;
			}
		}
	}
	
	return false;
}


/**
 *	split a string by string
 *
 *	like php's explode() but handles empty strings better.
 *	@param string $delimiter boundary string
 *	@param string $string input string
 *	@return array
 */
function expl($delimiter, $string)
{
	$ret = explode($delimiter, $string);
	if (count($ret) == 1 && empty($ret[0])) {
		return array();
	} else {
		return $ret;
	}
}


/**
 *	explode a string splitting it by whitespace characters
 *
 *	@param string $s input string
 *	@param bool $honor_quot don't split inside quotation marks
 *	@return array of strings
 */
function expl_whitesp($s, $honor_quot = false)
{
	// same characters as trim() uses
	$whitesp = array(' ', "\t", "\n", "\r", "\0", "\x0B");
	$quot = array('"', "'");
	$ret = array();

	$prev = -1;
	$cur_quot = false;
	
	for ($i=0; $i < strlen($s); $i++) {
		if ($honor_quot && in_array($s[$i], $quot)) {
			if ($cur_quot === false) {
				// begin of quote
				$cur_quot = $s[$i];
			} elseif ($cur_quot == $s[$i] && ($i < 1 || $s[$i-1] != "\\")) {
				// end of quote
				$cur_quot = false;
			}
		}
		if ($cur_quot !== false) {
			// do nothing while on a quote
			continue;
		}
		if (in_array($s[$i], $whitesp)) {
			if ($prev+1 == $i) {
				$prev++;
			} else {
				$ret[] = substr($s, $prev+1, $i-$prev-1);
				$prev = $i;
			}
		}
	}
	if ($prev+2 < $i) {
		$ret[] = substr($s, $prev+1);
	}
	
	return $ret;
}


/**
 *	check if two files are different
 *
 *	@param string $a filename
 *	@param string $b filename
 *	@return bool
 */
function file_is_different($a, $b)
{
	if (@filesize($a) !== @filesize($b)) {
		return true;
	}
	if (@md5_file($a) !== @md5_file($b)) {
		return true;
	} else {
		return false;
	}
}


/**
 *	get the extension of a file
 *
 *	@param string $s filename
 *	@return string
 */
function filext($s)
{
	$a = expl('.', $s);
	if (1 < count($a)) {
		return(array_pop($a));
	} else {
		return '';
	}
}


/**
 *	return a http error message to the client
 *
 *	if $header_only is false (the default), the function doesn't 
 *	return if successful.
 *	@param int $code error code
 *	@param bool $header_only only output the header and return
 *	@return bool true if successful (only if $header_only is true), false 
 *	if not
 */
function http_error($code, $header_only = false)
{
	switch ($code) {
		case 400:
			$error = 'Bad Request';
			break;
		case 404:
			$error = 'Not Found';
			break;
		case 500:
			$error = 'Internal Server Error';
			break;
		default:
			// unsupported
			return false;
	}
	header($_SERVER['SERVER_PROTOCOL'].' '.$code.' '.$error);
	if (!$header_only) {
		echo $error;
		die();
	} else {
		return true;
	}
}


/**
 *	check if the user is http digest authenticated
 *
 *	@param array $users array of possible users (usernames as keys, 
 *	password as values)
 *	@param string $realm realm (e.g. name of the site)
 *	@retval 0 authenticated
 *	@retval -1 user did not request authentication
 *	@retval -2 parts of the response are missing
 *	@retval -3 unknown username
 *	@retval -4 invalid password
 */
function http_digest_check($users, $realm = '')
{
	// code based on the php documentation
	if (empty($_SERVER['PHP_AUTH_DIGEST'])) {
		return -1;
	} else {
		$auth = $_SERVER['PHP_AUTH_DIGEST'];
	}
	
	// taken from one of the comments
	$data = array();
	preg_match("/username=\"([^\"]+)\"/i", $auth, $match);
	if (isset($match[1])) {
		$data['username'] = $match[1];
	} else {
		return -2;
	}
	preg_match('/nonce=\"([^\"]+)\"/i', $auth, $match);
	if (isset($match[1])) {
		$data['nonce'] = $match[1];
	} else {
		return -2;
	}
	preg_match('/nc=([0-9a-f]+)/i', $auth, $match);
	if (isset($match[1])) {
		$data['nc'] = $match[1];
	} else {
		return -2;
	}
	preg_match('/cnonce=\"([^\"]+)\"/i', $auth, $match);
	if (isset($match[1])) {
		$data['cnonce'] = $match[1];
	} else {
		return -2;
	}
	// fixed for Safari
	// qop comes as qop="auth"
	preg_match('/qop=\"?([^,\"]+)/i', $auth, $match);
	if (isset($match[1])) {
		$data['qop'] = $match[1];
	} else {
		return -2;
	}
	preg_match('/uri=\"([^\"]+)\"/i', $auth, $match);
	if (isset($match[1])) {
		$data['uri'] = $match[1];
	} else {
		return -2;
	}
	preg_match('/response=\"([^\"]+)\"/i', $auth, $match);
	if (isset($match[1])) {
		$data['response'] = $match[1];
	} else {
		return -2;
	}
	
	// check username
	if (!array_key_exists($data['username'], $users)) {
		return -3;
	}
	
	// generate the valid response
	$a1 = md5($data['username'].':'.str_replace("\"", '', $realm).':'.$users[$data['username']]);
	$a2 = md5($_SERVER['REQUEST_METHOD'].':'.$data['uri']);
	$valid_response = md5($a1.':'.$data['nonce'].':'.$data['nc'].':'.$data['cnonce'].':'.$data['qop'].':'.$a2);
	
	if ($data['response'] != $valid_response) {
		return -4;
	} else {
		return 0;
	}
}


/**
 *	prompt the user for http digest authentication
 *
 *	make sure the script stops execution after calling this function.
 *	@param string $realm realm (e.g. name of the site)
 */
function http_digest_prompt($realm = '')
{
	// code based on the php documentation
	header($_SERVER['SERVER_PROTOCOL'].' 401 Unauthorized');
	header('WWW-Authenticate: Digest realm="'.str_replace("\"", '', $realm).'",qop="auth",nonce="'.uniqid().'",opaque="'.md5(str_replace("\"", '', $realm)).'"');
}


/**
 *	check if a string is a url
 *
 *	@param string $s
 *	@return bool
 */
function is_url($s)
{
	if (strpos($s, '://') || strtolower(substr($s, 0, 7)) == 'mailto:') {
		return true;
	} else {
		return false;
	}
}


/**
 *	return a number of newline characters
 *
 *	@param int $count count (one is default)
 *	@return string
 */
function nl($count = 1)
{
	$s = '';
	while (0 < $count--) {
		$s .= "\n";
	}
	return $s;
}


/**
 *	pad a string to have at least $num characters
 *
 *	@param string $s string to operate on
 *	@param int $num number of characters desired
 *	@param string $chr character to pad the string with
 *	@return string
 */
function pad($s, $num, $chr = ' ')
{
	for ($i=strlen($s); $i < $num; $i++) {
		$s .= $chr;
	}
	return $s;
}


/**
 *	return a string with double quotation marks wrapped around
 *
 *	@param string $s string
 *	@return string
 */
function quot($s)
{
	return '"'.$s.'"';
}


/**
 *	delete a file or directory
 *
 *	@param string $f file name
 *	@return true if successful, false if not
 */
function rm_recursive($f)
{
	if (@is_file($f) || @is_link($f)) {
		// note: symlinks get deleted right away, and not recursed into
		return @unlink($f);
	} else {
		if (($childs = @scandir($f)) === false) {
			return false;
		}
		// strip a tailing slash
		if (substr($f, -1) == '/') {
			$f = substr($f, 0, -1);
		}
		foreach ($childs as $child) {
			if ($child == '.' || $child == '..') {
				continue;
			} else {
				rm_recursive($f.'/'.$child);
			}
		}
		return @rmdir($f);
	}
}


/**
 *	serve a file to the client
 *
 *	this function only returns on errors.
 *	@param string $fn filename
 *	@param bool $dl download file
 *	@param string $mime mime type
 */
function serve_file($fn, $dl, $mime = '')
{
	if (($size = @filesize($fn)) === false) {
		return false;
	}
	if (empty($mime)) {
		// fall back to octet-stream
		$mime = 'application/octet-stream';
	}
	
	// TODO (later): optionally set the mime type based on the file extension only
	// see http://www.php.net/manual/en/function.readfile.php#52722
	// TODO (later): handle byte range
	// TODO (later): handle if-modified-since etc
	// TODO (later): also check apache_request_headers()
	
	if ($dl) {
		// these are taken from the php documentation (on readfile())
		header('Content-Description: File Transfer');
		header('Content-Type: application/octet-stream');
		header('Content-Disposition: attachment; filename='.basename($fn));
		header('Content-Transfer-Encoding: binary');
	} else {
		header('Content-Type: '.$mime);
	}
	header('Content-Length: '.$size);
	flush();
	@readfile($fn);
	die();
}


/**
 *	return a number of tab characters
 *
 *	@param int $count count (one is default)
 *	@return string
 */
function tab($count = 1)
{
	$s = '';
	while (0 < $count--) {
		$s .= "\t";
	}
	return $s;
}


/**
 *	find a unique filename for copying a file to destination directory
 *
 *	@param string $dir destination directory
 *	@param string $orig_fn original filename
 *	@return string (basename) proposed filename
 */
function unique_filename($dir, $orig_fn)
{
	// strip any slash at the end of $dir
	if (substr($dir, -1) == '/') {
		$dir = substr($dir, 0, -1);
	}
	
	$fn = basename($orig_fn);
	$num = 1;
	// is_link() is there to catch dangling symlinks
	while (is_file($dir.'/'.$fn) || is_dir($dir.'/'.$fn) || is_link($dir.'/'.$fn)) {
		// find first dot and prepend _$num there
		// TODO (later): we could handle the case where $orig_fn is already 
		// something like foo_2.bar
		$fn = basename($orig_fn);
		if (($p = strpos($fn, '.')) !== false) {
			$fn = substr($fn, 0, $p).'_'.(++$num).substr($fn, $p);
		} else {
			$fn .= '_'.(++$num);
		}
	}
	
	return $fn;
}


/**
 *	print human-readable information about a variable in inline format
 *
 *	@param mixed $var variable
 *	@return string
 */
function var_dump_inl($var)
{
	// print_r returns true/false as '1'/''
	// fix this at least for the value of $var itself
	if (is_bool($var) && $var) {
		return 'true';
	} elseif (is_bool($var)) {
		return 'false';
	}
	
	$ret = print_r($var, true);
	// remove control characters
	$ret = str_replace("\n", ' ', $ret);
	$ret = str_replace("\r", ' ', $ret);
	$ret = str_replace("\t", ' ', $ret);
	// remove double spaces
	do {
		$ret = str_replace('  ', ' ', $ret, $cnt);
	} while (0 < $cnt);
	return trim($ret);
}
