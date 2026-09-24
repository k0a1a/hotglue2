<?php

/*
 *	module_audio.inc.php
 *	Module for embedding audio elements on a page
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
require_once('util.inc.php');


// module_video.inc.php is the template this module follows: same
// upload -> background encode -> placeholder -> finalize flow, same
// serve/delete/reference hooks, same click-to-play affordance. The
// differences are the ones the medium forces: no poster, no pixel
// dimensions (the object is a fixed box with an icon in it), and a
// fresh upload is PAUSED by default - video's is playing.


/**
 *	return if ffmpeg is available
 *
 *	own copy of module_video.inc.php's _ffmpeg_available(): modules are
 *	standalone (each can be disabled on its own), so this one cannot
 *	lean on a function the video module defines
 *
 *	@return bool
 */
function _audio_ffmpeg_available()
{
	static $available = null;
	if ($available === null) {
		if (!function_exists('exec')) {
			$available = false;
		} else {
			exec(escapeshellarg(FFMPEG_BINARY).' -version 2>&1', $out, $ret);
			$available = ($ret === 0);
		}
	}
	return $available;
}


/**
 *	check on a pending background audio encode, finalizing it (swapping
 *	in the encoded variant and discarding the original) if the expected
 *	output file has appeared on disk, or reverting to serving the
 *	original indefinitely if it's been pending for too long
 *
 *	same piggybacked-on-render deferred-work pattern as
 *	video_check_pending_encode()
 *
 *	@param array $obj audio object
 *
 *	@return array the (possibly updated) object
 */
function audio_check_pending_encode($obj)
{
	if (empty($obj['audio-encode-status']) || $obj['audio-encode-status'] != 'pending') {
		return $obj;
	}

	load_modules('glue');
	$pn = get_first_item(expl('.', $obj['name']));
	$dir = CONTENT_DIR.'/'.$pn.'/shared';
	$out = $obj['audio-encode-file'];

	if (is_file($dir.'/'.$out)) {
		$orig_file = $obj['audio-file'];
		object_remove_attr(['name'=>$obj['name'], 'attr'=>['audio-encode-status', 'audio-encode-started', 'audio-encode-file']]);
		$update = [];
		$update['name'] = $obj['name'];
		$update['audio-file'] = $out;
		$update['audio-file-mime'] = 'audio/mp4';
		$ret = update_object($update);
		if ($ret['#error']) {
			log_msg('error', 'audio_check_pending_encode: error updating object '.quot($obj['name']).': '.quot($ret['#data']));
			return $obj;
		}
		if ($orig_file != $out) {
			delete_upload(['pagename'=>$pn, 'file'=>$orig_file, 'max_cnt'=>0]);
		}
		log_msg('info', 'audio_check_pending_encode: encode finished for '.quot($obj['name']));
		// re-read so this same render already reflects the finished encode
		$fresh = load_object(['name'=>$obj['name']]);
		if (!$fresh['#error']) {
			$obj = $fresh['#data'];
		}
	} elseif (time() - intval($obj['audio-encode-started']) > AUDIO_ENCODE_TIMEOUT) {
		log_msg('warn', 'audio_check_pending_encode: timed out waiting for encode of '.quot($obj['name']).', falling back to the original');
		// a dead encode leaves its .part behind - see audio_upload
		@unlink($dir.'/'.$out.'.part');
		object_remove_attr(['name'=>$obj['name'], 'attr'=>['audio-encode-status', 'audio-encode-started', 'audio-encode-file']]);
		unset($obj['audio-encode-status']);
		unset($obj['audio-encode-started']);
		unset($obj['audio-encode-file']);
	}

	return $obj;
}


function audio_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'audio')) {
		return false;
	}

	// parse children elements to find audio
	$childs = html_parse(elem_val($elem));
	$a = false;
	foreach ($childs as $c) {
		if (elem_tag($c) == 'audio') {
			$a = $c;
			break;
		}
	}
	if (!$a) {
		log_msg('warn', 'audio_alter_save: no audio element found, inner html is '.var_dump_inl($childs));
		return false;
	}

	// autoplay
	if (elem_attr($a, 'autoplay') !== NULL) {
		$obj['audio-autoplay'] = 'autoplay';
	} else {
		$obj['audio-autoplay'] = '';
	}
	// loop
	if (elem_attr($a, 'loop') !== NULL) {
		$obj['audio-loop'] = 'loop';
	} else {
		unset($obj['audio-loop']);
	}
	// controls
	if (elem_attr($a, 'controls') !== NULL) {
		$obj['audio-controls'] = 'controls';
	} else {
		unset($obj['audio-controls']);
	}
	// volume
	if (elem_attr($a, 'muted') !== NULL) {
		$obj['audio-volume'] = '0';
	} else {
		unset($obj['audio-volume']);
	}
}


function audio_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'audio') {
		return false;
	}

	load_modules('glue');
	$pn = get_first_item(expl('.', $obj['name']));
	foreach (['audio-file', 'audio-encode-file'] as $attr) {
		if (!empty($obj[$attr])) {
			delete_upload(['pagename'=>$pn, 'file'=>$obj[$attr], 'max_cnt'=>1]);
		}
	}
}


function audio_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'audio') {
		return false;
	}
	// symlinks have their referenced files in a different page that's why
	// they are not relevant here
	if (@is_link(CONTENT_DIR.'/'.str_replace('.', '/', $obj['name']))) {
		return false;
	}

	foreach (['audio-file', 'audio-encode-file'] as $attr) {
		if (!empty($obj[$attr]) && $obj[$attr] == $args['file']) {
			return true;
		}
	}
	return false;
}


function audio_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'audio')) {
		return false;
	}

	// add a css (for viewing as well as editing)
	html_add_css(base_url().'modules/audio/audio.css');

	// still encoding: don't serve the (potentially huge, untrimmed)
	// original while we wait - show a placeholder instead, so nothing gets
	// downloaded until the capped variant is ready
	if (!empty($obj['audio-encode-status']) && $obj['audio-encode-status'] == 'pending') {
		$ph = elem('div');
		elem_add_class($ph, 'audio-processing');
		elem_val($ph, 'converting audio');
		elem_append($elem, $ph);
		return true;
	}

	$a = elem('audio');
	if (empty($obj['audio-file'])) {
		elem_attr($a, 'src', '');
	} else {
		// kept relative (not prefixed with base_url()) so it still resolves
		// correctly when viewed through a different domain than the one
		// configured/detected as the base url - see module_object.inc.php's
		// object_alter_render_late() for the full rationale
		if (SHORT_URLS) {
			elem_attr($a, 'src', urlencode($obj['name']));
		} else {
			elem_attr($a, 'src', '?'.urlencode($obj['name']));
		}
	}
	// set some fallback text
	if (!empty($obj['audio-file']) && !empty($obj['audio-file-mime'])) {
		elem_val($a, '<div class="audio-fallback">You are not hearing the audio because your browser does not support '.htmlspecialchars($obj['audio-file-mime'], ENT_NOQUOTES, 'UTF-8').'. Consider using a contemporary web browser.</div>');
	} else {
		elem_val($a, '<div class="audio-fallback">You are not hearing the audio because your browser does not support it. Consider using a contemporary web browser.</div>');
	}
	// autoplay - unlike video, a fresh audio object is PAUSED by default
	// (danja's call, 2026-09-24): the render only plays it when the toggle
	// was switched on
	if (!empty($obj['audio-autoplay']) && $obj['audio-autoplay'] == 'autoplay') {
		elem_attr($a, 'autoplay', 'autoplay');
	}
	// loop
	if (!empty($obj['audio-loop'])) {
		elem_attr($a, 'loop', 'loop');
	}
	// controls
	if (!empty($obj['audio-controls'])) {
		elem_attr($a, 'controls', 'controls');
	}

	// clicking the object toggles pause/play, in viewing AND editing mode -
	// the <audio> element itself cannot carry the click: browsers hard-hide
	// one without the controls attribute (UA display:none that even
	// !important cannot override, verified empirically), so a transparent
	// surface div above it is the clickable whole of the object, and the
	// sound icon deliberately lets clicks pass through to it. Attached only
	// when there are no native controls: their own buttons would fight the
	// toggle, a click on the native play button pausing the audio right
	// back. (Same affordance the video module has.)
	if (AUDIO_START_ON_CLICK && empty($obj['audio-controls'])) {
		$p = elem('div');
		elem_add_class($p, 'audio-surface');
		elem_attr($p, 'onclick', 'var a=this.parentElement.querySelector("audio");a.paused?a.play():a.pause()');
		elem_append($elem, $p);
	}
	// volume
	if (isset($obj['audio-volume']) && $obj['audio-volume'] == '0') {
		elem_attr($a, 'muted', 'muted');
	}
	elem_append($elem, $a);

	// the sound icon: what the object looks like. Purely visual - it
	// never takes a click or a focus
	$i = elem('img');
	elem_add_class($i, 'audio-icon');
	elem_attr($i, 'src', base_url().'img/icons/audio.svg');
	elem_attr($i, 'alt', '');
	elem_append($elem, $i);

	if ($args['edit']) {
		// shield over the upper part of the object: without it, clicks meant
		// for the editor (select the object, open its menu) get swallowed by
		// the <audio> element's own playback handling instead - same problem
		// video objects have, see their glue-video-shield element. Left
		// uncovered below so playback can still be tested while editing.
		$s = elem('div');
		elem_add_class($s, 'glue-audio-shield');
		elem_add_class($s, 'glue-ui');
		elem_attr($s, 'title', 'click here to select/edit this audio');
		elem_append($elem, $s);
	}

	return true;
}


function audio_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'audio') {
		return false;
	}

	// finalize a pending encode (if it just completed) *before* $obj is
	// handed to alter_render_early - that hook is dispatched to multiple
	// modules (audio_alter_render_early() and the generic
	// object_alter_render_early(), which applies object-width/-height as
	// CSS) via the same $args array passed by value, so freshening $obj
	// only inside one of those hooks never reaches the other within the
	// same render pass - only a later, separate render call would have
	// picked up the corrected state, which is exactly the one render pass
	// the polling in audio-edit.js stops at as soon as it sees a
	// non-pending response
	if (!empty($obj['audio-encode-status'])) {
		load_modules('glue');
		$obj = audio_check_pending_encode($obj);
	}

	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'audio');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');

	// hooks
	invoke_hook_first('alter_render_early', 'audio', ['obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']]);
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'audio', ['obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']]);

	return $html;
}


function audio_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/audio/audio-edit.min.js');
		} else {
			html_add_js(base_url().'modules/audio/audio-edit.js');
		}
		// the object css on the whole editor page, the way the download
		// module does it: edit pages never include the per-object css that
		// alter_render_early queues (only the view pages do), and the
		// surface/icon rules are as much editor chrome as the shield is
		html_add_css(base_url().'modules/audio/audio.css');
		html_add_css(base_url().'modules/audio/audio-edit.css');
	}
}


function audio_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (get_first_item(elem_classes($elem)) != 'audio') {
		return false;
	}

	// make sure the type is set
	$obj['type'] = 'audio';
	$obj['module'] = 'audio';

	// hook
	invoke_hook('alter_save', ['obj'=>&$obj, 'elem'=>$elem]);

	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'audio_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function audio_serve_resource($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'audio') {
		return false;
	}

	if (!empty($obj['audio-file'])) {
		$pn = get_first_item(expl('.', $obj['name']));
		if (empty($obj['audio-file-mime'])) {
			$obj['audio-file-mime'] = '';
		}
		serve_file(CONTENT_DIR.'/'.$pn.'/shared/'.$obj['audio-file'], $args['dl'], $obj['audio-file-mime']);
	}

	return false;
}


function audio_upload($args)
{
	$ext = filext($args['file']);
	if ($args['mime'] == 'audio/mp4' || $args['mime'] == 'audio/x-m4a' || $ext == 'm4a') {
		// notice: m4a is an audio-only mp4 container, served as audio/mp4
		$mime = 'audio/mp4';
	} elseif ($args['mime'] == 'audio/mpeg' || $args['mime'] == 'audio/mp3' || $ext == 'mp3') {
		$mime = 'audio/mpeg';
	} elseif ($args['mime'] == 'audio/flac' || $args['mime'] == 'audio/x-flac' || $ext == 'flac') {
		$mime = 'audio/flac';
	} elseif ($args['mime'] == 'audio/wav' || $args['mime'] == 'audio/x-wav' || $args['mime'] == 'audio/wave' || $ext == 'wav') {
		// audio/wave is what Safari sends
		$mime = 'audio/wav';
	} elseif ($args['mime'] == 'audio/aac' || $args['mime'] == 'audio/x-aac' || $ext == 'aac') {
		$mime = 'audio/aac';
	} elseif ($args['mime'] == 'audio/ogg' || $args['mime'] == 'audio/oga' || $ext == 'oga') {
		// bare .ogg stays with the video module: an ogg container can hold a
		// Theora video stream, and .ogg uploads have always been video here
		$mime = 'audio/ogg';
	} elseif ($args['mime'] == 'audio/aiff' || $args['mime'] == 'audio/x-aiff' || $ext == 'aiff' || $ext == 'aif') {
		$mime = 'audio/aiff';
	} else {
		return false;
	}

	load_modules('glue');
	$obj = create_object($args);
	if ($obj['#error']) {
		return false;
	} else {
		$obj = $obj['#data'];
	}
	$obj['type'] = 'audio';
	$obj['module'] = 'audio';
	$obj['audio-file'] = $args['file'];
	$obj['audio-file-mime'] = $mime;
	// a fresh upload sits paused, unmuted, with the browser controls off -
	// the menu toggles can change any of it (danja's call, 2026-09-24).
	// All of that is already the render's default for audio, so nothing
	// to set here.

	// kick off ffmpeg-based transcoding, if available - every upload gets
	// re-encoded, regardless of its original sample rate/duration/bitrate,
	// so all served audio is uniformly 44.1kHz stereo 128kbps and capped
	// at AUDIO_MAX_DURATION
	if (AUDIO_ENCODING && _audio_ffmpeg_available()) {
		$pn = get_first_item(expl('.', $obj['name']));
		$dir = CONTENT_DIR.'/'.$pn.'/shared';
		$orig = $dir.'/'.$args['file'];
		$a = expl('.', $args['file']);
		$base = (1 < count($a)) ? implode('.', array_slice($a, 0, -1)) : $a[0];
		$out = $base.'-audio.m4a';

		// -t as an input option so ffmpeg stops reading once it has enough
		// source material, rather than decoding the whole file and
		// discarding everything past AUDIO_MAX_DURATION
		// the encode writes to a .part name and only the mv at the end of
		// the shell chain puts the final file in place - the finalize below
		// gates on is_file($out), and without this it would fire the moment
		// ffmpeg CREATED the file, mid-write, and the browser's first fetch
		// got a truncated m4a: the audio element errors once and stays dead
		$cmd = escapeshellarg(FFMPEG_BINARY).' -y -t '.intval(AUDIO_MAX_DURATION).' -i '.escapeshellarg($orig).' -vn -c:a aac -ar '.intval(AUDIO_SAMPLE_RATE).' -ac '.intval(AUDIO_CHANNELS).' -b:a '.escapeshellarg(AUDIO_BITRATE).' -f mp4 '.escapeshellarg($dir.'/'.$out.'.part')
			.' && mv '.escapeshellarg($dir.'/'.$out.'.part').' '.escapeshellarg($dir.'/'.$out);
		exec($cmd.' > /dev/null 2>&1 &');
		$obj['audio-encode-status'] = 'pending';
		$obj['audio-encode-started'] = time();
		$obj['audio-encode-file'] = $out;
	}

	save_object($obj);

	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}
