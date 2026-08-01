<?php

/*
 *	tools/cleanup_auto_snapshots.php
 *	One-time maintenance script: removes leftover "auto-*" snapshot
 *	revisions left over from the now-removed auto-snapshot system (see
 *	git history around the removal of check_auto_snapshot()/snapshot()/
 *	revert() in module_glue.inc.php).
 *
 *	Not wired into any automatic trigger (no cron, no controller route) -
 *	run manually, once, by an operator:
 *
 *		php tools/cleanup_auto_snapshots.php            # dry run (default)
 *		php tools/cleanup_auto_snapshots.php --confirm  # actually delete
 *
 *	Uses delete_page() (not a raw rm -rf) so any module cleanup hooks still
 *	run correctly for objects inside the snapshot being removed.
 */

chdir(__DIR__.'/..');

require_once('module_glue.inc.php');
load_modules('glue');

function _dir_size($dir)
{
	$size = 0;
	$files = @scandir($dir);
	if ($files === false) {
		return 0;
	}
	foreach ($files as $f) {
		if ($f == '.' || $f == '..') {
			continue;
		}
		$fn = $dir.'/'.$f;
		if (is_dir($fn)) {
			$size += _dir_size($fn);
		} else {
			$size += @filesize($fn);
		}
	}
	return $size;
}

function _human_size($bytes)
{
	$units = ['B', 'KB', 'MB', 'GB'];
	$i = 0;
	while (1024 <= $bytes && $i < count($units)-1) {
		$bytes /= 1024;
		$i++;
	}
	return round($bytes, 1).' '.$units[$i];
}

$confirm = in_array('--confirm', $argv);

$candidates = glob(CONTENT_DIR.'/*/auto-*', GLOB_ONLYDIR);
if (empty($candidates)) {
	echo "No auto-* snapshot directories found under ".CONTENT_DIR."/*/.\n";
	exit(0);
}

$total = 0;
echo $confirm ? "Deleting the following snapshots:\n\n" : "Found the following snapshots (dry run - pass --confirm to delete):\n\n";
foreach ($candidates as $dir) {
	// dir is CONTENT_DIR/<pagename>/<rev>
	$rel = substr($dir, strlen(CONTENT_DIR)+1);
	$a = explode('/', $rel);
	$pagename = $a[0];
	$rev = $a[1];
	$size = _dir_size($dir);
	$total += $size;
	echo '  '.$pagename.'.'.$rev.' - '._human_size($size)."\n";

	if ($confirm) {
		$ret = delete_page(['page'=>$pagename.'.'.$rev]);
		if ($ret['#error']) {
			echo '    error: '.$ret['#data']."\n";
		}
	}
}

echo "\nTotal: "._human_size($total).' across '.count($candidates)." snapshot(s).\n";
if (!$confirm) {
	echo "\nRe-run with --confirm to actually delete these.\n";
}
