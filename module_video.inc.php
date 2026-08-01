<?php

/*
 *	module_video.inc.php
 *	Module for embedding video elements on a page
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


// module_image.inc.php has more information on what's going on inside modules
// (they can be easier than that one though)


/**
 *	return if ffmpeg is available
 *
 *	@return bool
 */
function _ffmpeg_available()
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
 *	return the pixel dimensions of a video file's first video stream
 *
 *	@param string $file filename
 *
 *	@return array with width and height, or false on error
 */
function _video_dimensions($file)
{
	$dir = dirname(FFMPEG_BINARY);
	$ffprobe = ($dir == '.') ? 'ffprobe' : $dir.'/ffprobe';
	$cmd = escapeshellarg($ffprobe).' -v quiet -print_format json -show_streams '.escapeshellarg($file);
	exec($cmd, $out, $ret);
	if ($ret !== 0 || empty($out)) {
		return false;
	}
	$data = json_decode(implode("\n", $out), true);
	if (empty($data['streams'])) {
		return false;
	}
	foreach ($data['streams'] as $s) {
		if (isset($s['codec_type']) && $s['codec_type'] == 'video' && !empty($s['width']) && !empty($s['height'])) {
			return ['width'=>intval($s['width']), 'height'=>intval($s['height'])];
		}
	}
	return false;
}


/**
 *	check on a pending background video encode, finalizing it (swapping in
 *	the encoded variant, recording the poster file, discarding the
 *	original) if the expected output files have appeared on disk, or
 *	reverting to serving the original indefinitely if it's been pending
 *	for too long
 *
 *	the only piggybacked-on-render deferred-work check in this codebase
 *
 *	@param array $obj video object
 *
 *	@return array the (possibly updated) object
 */
function video_check_pending_encode($obj)
{
	if (empty($obj['video-encode-status']) || $obj['video-encode-status'] != 'pending') {
		return $obj;
	}

	load_modules('glue');
	$pn = get_first_item(expl('.', $obj['name']));
	$dir = CONTENT_DIR.'/'.$pn.'/shared';
	$out = $obj['video-encode-file'];
	$poster = $obj['video-encode-poster-file'];

	if (is_file($dir.'/'.$out) && is_file($dir.'/'.$poster)) {
		$orig_file = $obj['video-file'];
		object_remove_attr(['name'=>$obj['name'], 'attr'=>['video-encode-status', 'video-encode-started', 'video-encode-file', 'video-encode-poster-file']]);
		$update = [];
		$update['name'] = $obj['name'];
		$update['video-file'] = $out;
		$update['video-file-mime'] = 'video/mp4';
		$update['video-poster-file'] = $poster;
		// size the object to the encoded video's actual dimensions - the
		// client can't do this itself via <video loadedmetadata> while the
		// placeholder is showing (no real <video> element exists yet)
		$dim = _video_dimensions($dir.'/'.$out);
		if ($dim !== false) {
			$w = $dim['width'];
			$h = $dim['height'];
			// cap the on-canvas display size (independent of the encoded
			// resolution cap above) - never upscales, only shrinks to fit
			if (VIDEO_DISPLAY_MAX_WIDTH && VIDEO_DISPLAY_MAX_HEIGHT
				&& (VIDEO_DISPLAY_MAX_WIDTH < $w || VIDEO_DISPLAY_MAX_HEIGHT < $h)) {
				$scale = min(VIDEO_DISPLAY_MAX_WIDTH/$w, VIDEO_DISPLAY_MAX_HEIGHT/$h);
				$w = round($w*$scale);
				$h = round($h*$scale);
			}
			$update['object-width'] = $w.'px';
			$update['object-height'] = $h.'px';
		}
		$ret = update_object($update);
		if ($ret['#error']) {
			log_msg('error', 'video_check_pending_encode: error updating object '.quot($obj['name']).': '.quot($ret['#data']));
			return $obj;
		}
		if ($orig_file != $out) {
			delete_upload(['pagename'=>$pn, 'file'=>$orig_file, 'max_cnt'=>0]);
		}
		log_msg('info', 'video_check_pending_encode: encode finished for '.quot($obj['name']));
		// re-read so this same render already reflects the finished encode
		$fresh = load_object(['name'=>$obj['name']]);
		if (!$fresh['#error']) {
			$obj = $fresh['#data'];
		}
	} elseif (time() - intval($obj['video-encode-started']) > VIDEO_ENCODE_TIMEOUT) {
		log_msg('warn', 'video_check_pending_encode: timed out waiting for encode of '.quot($obj['name']).', falling back to the original');
		object_remove_attr(['name'=>$obj['name'], 'attr'=>['video-encode-status', 'video-encode-started', 'video-encode-file', 'video-encode-poster-file']]);
		unset($obj['video-encode-status']);
		unset($obj['video-encode-started']);
		unset($obj['video-encode-file']);
		unset($obj['video-encode-poster-file']);
	}

	return $obj;
}


function video_alter_save($args)
{
	$elem = $args['elem'];
	$obj = &$args['obj'];
	if (!elem_has_class($elem, 'video')) {
		return false;
	}
	
	// parse children elements to find video
	$childs = html_parse(elem_val($elem));
	$v = false;
	foreach ($childs as $c) {
		if (elem_tag($c) == 'video') {
			$v = $c;
			break;
		}
	}
	if (!$v) {
		log_msg('warn', 'video_alter_save: no video element found, inner html is '.var_dump_inl($childs));
		return false;
	}
	
	// autoplay
	if (elem_attr($v, 'autoplay') !== NULL) {
		$obj['video-autoplay'] = 'autoplay';
	} else {
		$obj['video-autoplay'] = '';
	}
	// loop
	if (elem_attr($v, 'loop') !== NULL) {
		$obj['video-loop'] = 'loop';
	} else {
		unset($obj['video-loop']);
	}
	// controls
	if (elem_attr($v, 'controls') !== NULL) {
		$obj['video-controls'] = 'controls';
	} else {
		unset($obj['video-controls']);
	}
	// volume
	if (elem_attr($v, 'audio') == 'muted') {
		$obj['video-volume'] = '0';
	} else {
		unset($obj['video-volume']);
	}
}


function video_delete_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}

	load_modules('glue');
	$pn = get_first_item(expl('.', $obj['name']));
	foreach (['video-file', 'video-poster-file', 'video-encode-file', 'video-encode-poster-file'] as $attr) {
		if (!empty($obj[$attr])) {
			delete_upload(['pagename'=>$pn, 'file'=>$obj[$attr], 'max_cnt'=>1]);
		}
	}
}


function video_has_reference($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	// symlinks have their referenced files in a different page that's why
	// they are not relevant here
	if (@is_link(CONTENT_DIR.'/'.str_replace('.', '/', $obj['name']))) {
		return false;
	}

	foreach (['video-file', 'video-poster-file', 'video-encode-file', 'video-encode-poster-file'] as $attr) {
		if (!empty($obj[$attr]) && $obj[$attr] == $args['file']) {
			return true;
		}
	}
	return false;
}


function video_alter_render_early($args)
{
	$elem = &$args['elem'];
	$obj = $args['obj'];
	if (!elem_has_class($elem, 'video')) {
		return false;
	}
	// note: pending-encode finalization already happened in
	// video_render_object() before this hook ran, so object_alter_render_early()
	// (dispatched in the same pass) sees the corrected size too

	// add a css (for viewing as well as editing)
	html_add_css(base_url().'modules/video/video.css');

	// still encoding: don't serve the (potentially huge, untrimmed)
	// original while we wait - show a placeholder instead, so nothing gets
	// downloaded until the capped/trimmed variant is ready
	if (!empty($obj['video-encode-status']) && $obj['video-encode-status'] == 'pending') {
		$ph = elem('div');
		elem_add_class($ph, 'video-processing');
		elem_val($ph, 'Video is being processed, reload in a moment to see it');
		elem_append($elem, $ph);
		return true;
	}

	$v = elem('video');
	if (empty($obj['video-file'])) {
		elem_attr($v, 'src', '');
	} else {
		// kept relative (not prefixed with base_url()) so it still resolves
		// correctly when viewed through a different domain than the one
		// configured/detected as the base url - see module_object.inc.php's
		// object_alter_render_late() for the full rationale
		// TODO (later): support URLs as well
		if (SHORT_URLS) {
			elem_attr($v, 'src', urlencode($obj['name']));
		} else {
			elem_attr($v, 'src', '?'.urlencode($obj['name']));
		}
	}
	elem_css($v, 'width', '100%');
	elem_css($v, 'height', '100%');
	// poster frame (served directly as a static file, same as the other
	// files under content/<page>/shared/)
	if (!empty($obj['video-poster-file'])) {
		$pn = get_first_item(expl('.', $obj['name']));
		elem_attr($v, 'poster', CONTENT_DIR.'/'.$pn.'/shared/'.rawurlencode($obj['video-poster-file']));
	}
	// we're currently not preloading the video due to some troubles on 
	// Firefox
	//elem_css($v, 'preload', 'preload');
	// set some fallback text
	if (!empty($obj['video-file']) && !empty($obj['video-file-mime'])) {
		elem_val($v, '<div class="video-fallback">You are not seeing the video because your browser does not support '.htmlspecialchars($obj['video-file-mime'], ENT_NOQUOTES, 'UTF-8').'. Consider using a contemporary web browser.</div>');
	} else {
		elem_val($v, '<div class="video-fallback">You are not seeing the video because your browser does not support it. Consider using a contemporary web browser.</div>');
	}
	// autoplay
	if (!isset($obj['video-autoplay']) || $obj['video-autoplay'] == 'autoplay') {
		// autoplay is the default
		elem_attr($v, 'autoplay', 'autoplay');
	} else {
		if (VIDEO_START_ON_CLICK) {
			elem_attr($v, 'onclick', 'this.play()');
		}
	}
	// loop
	if (!empty($obj['video-loop'])) {
		elem_attr($v, 'loop', 'loop');
	}
	// controls
	if (!empty($obj['video-controls'])) {
		elem_attr($v, 'controls', 'controls');
	}
	// volume
	if (isset($obj['video-volume']) && $obj['video-volume'] == '0') {
		elem_attr($v, 'audio', 'muted');
	}
	elem_append($elem, $v);

	if ($args['edit']) {
		// shield over the upper part of the video: without it, clicks meant
		// for the editor (select the object, open its menu) get swallowed
		// by the <video> element's own playback/controls handling instead -
		// same problem iframe/webvideo objects have with their embedded
		// content, see their glue-iframe-shield/glue-webvideo-shield
		// elements. Left uncovered below so playback can still be tested
		// while editing.
		$s = elem('div');
		elem_add_class($s, 'glue-video-shield');
		elem_add_class($s, 'glue-ui');
		elem_attr($s, 'title', 'click here to select/edit this video');
		elem_append($elem, $s);
	}

	return true;
}


function video_render_object($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}

	// finalize a pending encode (if it just completed) *before* $obj is
	// handed to alter_render_early - that hook is dispatched to multiple
	// modules (video_alter_render_early() and the generic
	// object_alter_render_early(), which applies object-width/-height as
	// CSS) via the same $args array passed by value, so freshening $obj
	// only inside one of those hooks never reaches the other within the
	// same render pass - only a later, separate render call would have
	// picked up the corrected size, which is exactly the one render pass
	// the polling in video-edit.js stops at as soon as it sees a
	// non-pending response
	if (!empty($obj['video-encode-status'])) {
		load_modules('glue');
		$obj = video_check_pending_encode($obj);
	}

	$e = elem('div');
	elem_attr($e, 'id', $obj['name']);
	elem_add_class($e, 'video');
	elem_add_class($e, 'resizable');
	elem_add_class($e, 'object');
	
	// hooks
	invoke_hook_first('alter_render_early', 'video', ['obj'=>$obj, 'elem'=>&$e, 'edit'=>$args['edit']]);
	$html = elem_finalize($e);
	invoke_hook_last('alter_render_late', 'video', ['obj'=>$obj, 'html'=>&$html, 'elem'=>$e, 'edit'=>$args['edit']]);
	
	return $html;
}


function video_render_page_early($args)
{
	if ($args['edit']) {
		if (USE_MIN_FILES) {
			html_add_js(base_url().'modules/video/video-edit.min.js');
		} else {
			html_add_js(base_url().'modules/video/video-edit.js');
		}
		html_add_css(base_url().'modules/video/video-edit.css');
	}
}


function video_save_state($args)
{
	$elem = $args['elem'];
	$obj = $args['obj'];
	if (get_first_item(elem_classes($elem)) != 'video') {
		return false;
	}
	
	// make sure the type is set
	$obj['type'] = 'video';
	$obj['module'] = 'video';
	
	// hook
	invoke_hook('alter_save', ['obj'=>&$obj, 'elem'=>$elem]);
	
	load_modules('glue');
	$ret = save_object($obj);
	if ($ret['#error']) {
		log_msg('error', 'video_save_state: save_object returned '.quot($ret['#data']));
		return false;
	} else {
		return true;
	}
}


function video_serve_resource($args)
{
	$obj = $args['obj'];
	if (!isset($obj['type']) || $obj['type'] != 'video') {
		return false;
	}
	
	if (!empty($obj['video-file'])) {
		$pn = get_first_item(expl('.', $obj['name']));
		if (empty($obj['video-file-mime'])) {
			$obj['video-file-mime'] = '';
		}
		serve_file(CONTENT_DIR.'/'.$pn.'/shared/'.$obj['video-file'], $args['dl'], $obj['video-file-mime']);
	}
	
	return false;
}


function video_upload($args)
{
	$ext = filext($args['file']);
	if ($args['mime'] == 'video/ogg' || $ext == 'ogv' || $ext == 'ogg') {
		// notice: we also handle ogg here although this also could be a 
		// different mime type
		// make sure mime type is set
		$mime = 'video/ogg';
	} elseif ($args['mime'] == 'video/h264' || $ext == 'h264') {
		// haven't seen these out there
		$mime = 'video/h264';
	} elseif ($args['mime'] == 'video/mp4' || $ext == 'mp4') {
		// think this need not be h264, but well
		$mime = 'video/mp4';
	} elseif ($args['mime'] == 'video/webm' || $ext == 'webm') {
		// again, webm could also be audio/webm
		$mime = 'video/webm';
	} elseif ($args['mime'] == 'video/quicktime' || $ext == 'mov') {
		// QuickTime - not natively playable in most browsers, but every
		// upload gets re-encoded to mp4 anyway (see below), so this is fine
		$mime = 'video/quicktime';
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
	$obj['type'] = 'video';
	$obj['module'] = 'video';
	$obj['video-file'] = $args['file'];
	$obj['video-file-mime'] = $mime;

	// kick off ffmpeg-based transcoding + poster generation, if available -
	// every upload gets re-encoded, regardless of its original resolution/
	// duration/bitrate, so all served video is uniformly capped/trimmed
	if (VIDEO_ENCODING && _ffmpeg_available()) {
		$pn = get_first_item(expl('.', $obj['name']));
		$dir = CONTENT_DIR.'/'.$pn.'/shared';
		$orig = $dir.'/'.$args['file'];
		$a = expl('.', $args['file']);
		$base = (1 < count($a)) ? implode('.', array_slice($a, 0, -1)) : $a[0];
		$poster = $base.'-poster.jpg';
		$out = $base.'-720p.mp4';

		// cap the short side of the frame at VIDEO_MAX_HEIGHT, whichever
		// side that is (landscape: height, portrait: width) - never
		// upscales a smaller original
		$vf = "scale=w='if(gte(iw,ih),-2,min(".intval(VIDEO_MAX_HEIGHT).",iw))':h='if(gte(iw,ih),min(".intval(VIDEO_MAX_HEIGHT).",ih),-2)'";
		// -t as an input option so ffmpeg stops reading once it has enough
		// source material, rather than decoding the whole file and
		// discarding everything past VIDEO_MAX_DURATION
		$cmd = escapeshellarg(FFMPEG_BINARY).' -y -t '.intval(VIDEO_MAX_DURATION).' -i '.escapeshellarg($orig).' -vf '.escapeshellarg($vf).' -c:v libx264 -crf '.intval(VIDEO_ENCODE_CRF).' -c:a aac -b:a '.escapeshellarg(VIDEO_ENCODE_AUDIO_BITRATE).' -movflags +faststart '.escapeshellarg($dir.'/'.$out)
			.' && '.escapeshellarg(FFMPEG_BINARY).' -y -ss '.intval(VIDEO_POSTER_TIME).' -i '.escapeshellarg($orig).' -vframes 1 '.escapeshellarg($dir.'/'.$poster);
		exec($cmd.' > /dev/null 2>&1 &');
		$obj['video-encode-status'] = 'pending';
		$obj['video-encode-started'] = time();
		$obj['video-encode-file'] = $out;
		$obj['video-encode-poster-file'] = $poster;
	}

	save_object($obj);

	$ret = render_object(['name'=>$obj['name'], 'edit'=>true]);
	if ($ret['#error']) {
		return false;
	} else {
		return $ret['#data'];
	}
}
