/**
 *	js/page-background-video.js
 *	The tiled video background: the render emits an offscreen feeder
 *	<video> and a <canvas> layer (both only for a tiled background - a
 *	plain video background is the single <video> element, and this file
 *	does nothing then). The canvas repaints the feeder's current frame in
 *	a grid, once per animation frame: one playback, drawn many times, so
 *	every tile stays in sync for free.
 *
 *	The tile size: the canvas's data-scale attribute (a percentage of the
 *	page's width, the page-background-size key the picture uses - the
 *	video's own native size when absent).
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

(function() {
	var running = false;

	// Starts the paint loop for the current canvas + feeder pair, or does
	// nothing when the page has none. Called here at load (the server
	// renders a tiled background as the pair), and by the background panel
	// when its tile toggle swaps the layer live - the panel's swap creates
	// the pair long after this file first ran, so it cannot arm itself
	// once and be done.
	var start = function() {
		if (running) {
			return;
		}
		var canvas = document.querySelector('canvas.page-background-video');
		var video = document.querySelector('video.page-background-video-source');
		if (!canvas || !video) {
			return;
		}
		running = true;

		var draw = function() {
			// the offscreen feeder's autoplay attribute is not always
			// enough (policy differences between engines) - the tiler asks
			// for playback itself, muted so it is always allowed
			if (video.paused) {
				video.play();
			}
			if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
				// no frame to paint yet
				requestAnimationFrame(draw);
				return;
			}
			var pct = parseFloat(canvas.getAttribute('data-scale'));
			var vw = video.videoWidth;
			var vh = video.videoHeight;
			var tile_w, tile_h;
			if (pct > 0) {
				tile_w = canvas.clientWidth * pct / 100;
				tile_h = tile_w * vh / vw;
			} else {
				tile_w = vw;
				tile_h = vh;
			}
			if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
				canvas.width = canvas.clientWidth;
				canvas.height = canvas.clientHeight;
			}
			var ctx = canvas.getContext('2d');
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var y = 0; y < canvas.height; y += tile_h) {
				for (var x = 0; x < canvas.width; x += tile_w) {
					ctx.drawImage(video, x, y, tile_w, tile_h);
				}
			}
			requestAnimationFrame(draw);
		};

		draw();
	};

	window.start_page_background_video_tiler = start;

	if (document.readyState == 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
