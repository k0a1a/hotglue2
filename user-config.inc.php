<?php
//$s = microtime(true);

## get $host and $loc from query if set
parse_str($_SERVER['QUERY_STRING'], $result);
//error_log(print_r($_SERVER['QUERY_STRING'],2));

$host = $result['host'] ?? '';
$loc = $result['loc'] ?? '';

//$m = trim(isset($host) ? $host : '' . $loc);

$m = trim(($host !== '' ? '1' : '') . $loc);

//$m = trim(isset($host).$loc);

switch ($m) {
	## domains from ./srv
	case ('1srv'):
		$host = str_replace('www.', '', $host);
    $loc = '/var/www-hotglue/srv';
		break;
	## bound domains alised to ./usr
	case ('1usr'):
		$host = explode('.', $host);
		$host = trim($host[0]);
		$host = substr($host, 0, 1).'/'.$host;
    $loc0 = '/var/www-hotglue/usr';
    $loc1 = '/srv/slow/hotglue/usr';
    $loc = $loc0;
		## if $host came empty we are dealing with non registered domain
		## source hotglue.me pages then
		if (empty($host)) { $host = 'hotglue.me'; $loc = 'srv'; }
		break;
	## user domains (no rewrite rule fired)
	case (''):
		$host = $_SERVER['HTTP_HOST'];
		$host = explode('.', $host);
		$host = $host[0];
		$host = substr($host, 0, 1).'/'.$host;
    $loc0 = '/var/www-hotglue/usr';
    $loc1 = '/srv/slow/hotglue/usr';
    $loc = $loc0;
//		$userdir = substr($user, 0, 1).'/'.$user;
//    header("Cache-Control: no-cache, must-revalidate"); //HTTP 1.1
//    header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past
		break;
	default:
		header('Location:http://hotglue.me');
}

$userconf = $loc .'/'. $host .'/user-config.inc.php';
if (!file_exists($userconf)) {
  $loc = $loc1; 
  $userconf = $loc .'/'. $host .'/user-config.inc.php';
}
//error_log("DEBUG userconf: $userconf | loc: $loc | host: $host | m: $m");
if (file_exists($userconf)) {
  require_once($userconf);
} else {
  header("HTTP/1.0 404 Not Found");
  echo "<html><head><meta http-equiv='refresh' content='5;url=//hotglue.me'/><title>404 - No such Hotglue site!</title></head><body></body><h1>404 - Not found</h1><h2>No such Hotglue site found!</h2><h3><a href='//hotglue.me'>Back to Hotglue.me</a></h3></html>";
  exit;
}
//require_once('../'. $loc .'/'. $host .'/user-config.inc.php');
//error_log(sprintf("%.5f\n", microtime(true) - $s), 3, 'php_map_time.log');
