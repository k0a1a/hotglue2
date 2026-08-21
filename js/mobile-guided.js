// Mobile guided view - see SOW-mobile-guided-view.md
//
// A VIEWING-mode-only pan/zoom layer for small screens. The page's fixed
// canvas is never reflowed, reordered or written back to. Everything sits in
// one wrapper under a single uniform scale(), so relative positions are exact
// and no object moves with respect to any other - the composition is untouched.
//
// The whole behaviour, in three steps:
//
//   1. Open showing 75% of the canvas WIDTH. Not 100%: the last quarter is one
//      drag away, and 75% is that much more legible. Width specifically,
//      because that is the only opening the visitor can ever pinch back out to
//      - see the note on the zoom floor below.
//   2. Zoom in to the canvas origin at natural size, where the page looks as
//      authored.
//   3. From there the visitor pinch-zooms freely (out as far as that opening
//      view, in as far as they like) and drags to reach the rest.
//
// Deliberately does NOT inspect content. An earlier version measured font
// sizes, classified pages as text-led or image-led, and picked an "entry point"
// from the objects. Every one of those was a guess and each guessed wrong on
// real pages: it chose a 68x21px label reading "*ZINES" over the 500x715 poster
// that opens content/zinecamp2015, and landed content/mort at a scale where its
// median image rendered 57px across. Natural size at the origin needs no
// guesses and behaves identically on every page and in every browser.
//
// Two things about the mechanism are load-bearing:
//
//   Scale lives in a CSS transform PERMANENTLY. Native page zoom cannot be set
//   or animated programmatically (visualViewport is read-only; scale is only
//   settable via the viewport meta, at parse time), and the reveal has to abort
//   on touch - so handing scale off to native zoom would mean swapping
//   coordinate spaces at the exact moment the user's finger lands.
//
//   Translation converts to DOCUMENT scrolling, with body sized to the scaled
//   canvas. Not an element scroll container - see the note at the wrapper.
(function () {
	'use strict';

	var REVEAL_MS = 1500;
	var REVEAL_DWELL_MS = 500;	// hold at the pulled-back view before moving
	var REVEAL_EASE = 'cubic-bezier(.3,.7,.2,1)';
	var LOAD_WAIT_MS = 2500;	// cap on waiting for images
	var SMALL_SCREEN_PX = 768;

	// ?guided=1 forces activation on a wide screen, ?guided=0 forces it off on
	// a phone. QA/demo tooling only - NOT a/b infrastructure (hotglue has no
	// analytics to measure against). Neither can override the view-mode guard:
	// the script is only ever loaded outside the editor, in common.inc.php.
	function override() {
		var m = /[?&]guided=([01])/.exec(location.search);
		return m ? m[1] === '1' : null;
	}

	// ?debug=1 paints state onto the page, because a phone's console is not
	// reachable from the dev machine. Inert without the param.
	var DBG = {};
	function debugOn() { return /[?&]debug=1/.test(location.search); }
	function showDebug() {
		var old = document.getElementById('hg-mg-dbg');
		if (old) old.remove();
		var d = document.createElement('div');
		d.id = 'hg-mg-dbg';
		d.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;right:0;' +
			'background:rgba(0,0,0,.88);color:#0f0;font:11px/1.4 monospace;' +
			'padding:6px;white-space:pre-wrap;pointer-events:none;';
		var s = '';
		for (var k in DBG) s += k + ': ' + DBG[k] + '\n';
		d.textContent = s;
		(document.body || document.documentElement).appendChild(d);
	}

	function num(v) { return parseFloat(v) || 0; }

	// Geometry comes from the inline styles hotglue writes on every object, so
	// it is correct before images finish loading.
	function measure(el) {
		return {
			x: num(el.style.left), y: num(el.style.top),
			w: num(el.style.width) || el.offsetWidth,
			h: num(el.style.height) || el.offsetHeight
		};
	}

	function init() {
		var forced = override();
		if (forced === false) return;

		var objects = [].slice.call(document.querySelectorAll('.object'));
		if (!objects.length) return;

		var boxes = objects.map(measure);
		// Coordinates go NEGATIVE on real pages (content/mort starts at y=-13),
		// so the bounding box is min/max - never assume an origin at (0,0).
		var minX = Math.min.apply(null, boxes.map(function (b) { return b.x; }));
		var minY = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
		var maxX = Math.max.apply(null, boxes.map(function (b) { return b.x + b.w; }));
		var maxY = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));
		var canvasW = maxX - minX, canvasH = maxY - minY;
		if (canvasW <= 0 || canvasH <= 0) return;

		// Measure the LAYOUT viewport, not window.innerWidth. innerWidth is the
		// visual viewport and is not trustworthy: on desktop it counts the
		// scrollbar (measured 512 against a real 497), and Firefox reports it
		// as 1572 for a 393px viewport - 4x out - on both responsive-design
		// mode and Android. Everything below divides by this, and keying off it
		// also made behaviour depend on which physical display the window was
		// on, via the OS scale factor.
		var docEl = document.documentElement;
		var vw = docEl.clientWidth, vh = docEl.clientHeight;

		// A page that already fits needs no intervention at all.
		if (forced !== true && (vw > SMALL_SCREEN_PX || canvasW <= vw)) return;

		var fitWidth = vw / canvasW;

		// Mobile browsers remember the visitor's pinch level per tab and restore
		// it on reload, so the page can load already zoomed out and everything
		// we draw comes out tiny - our transform and the browser's zoom
		// MULTIPLY. It cannot be reset from here: initial-scale is only advisory
		// on a reload, and forcing re-evaluation means mutating the viewport
		// meta, which firefox ignores. So measure it and divide it out instead.
		// The layout viewport does not move with zoom, so every figure above
		// stays correct; only the scales we hand to the transform need adjusting.
		// Clamped, because fully compensating a 0.1 restore would mean a 10x
		// transform and a document tens of thousands of pixels across.
		// Give the visitor real control of the zoom-out range.
		//
		// The floor is max(minimum-scale, viewport / documentWidth) - purely a
		// WIDTH rule. On a tall canvas the whole page needs a smaller scale than
		// fit-width, so it can never be reached: there is no more width to
		// justify zooming out, even though there is plenty more height. Fix that
		// by widening the DOCUMENT with empty space, until fitting its width
		// also fits the canvas height.
		//
		// Only when it actually helps: on a canvas so large that the spec's 0.1
		// floor binds anyway, padding would add blank space and buy nothing.
		var padTo = Math.max(canvasW, vw * canvasH / vh);
		if (Math.max(0.1, vw / padTo) >= Math.max(0.1, fitWidth)) {
			padTo = canvasW;
		}
		DBG.docWidth = Math.round(padTo) + (padTo > canvasW ?
			' (canvas ' + Math.round(canvasW) + ' + ' + Math.round(padTo - canvasW) +
			' blank, to lower the zoom floor to ' + (vw / padTo).toFixed(4) + ')' : ' (no padding)');

		var zoom0 = (window.visualViewport && window.visualViewport.scale) || 1;
		var zoomComp = 1 / Math.min(4, Math.max(0.25, zoom0));
		if (Math.abs(zoom0 - 1) > 0.01) {
			DBG.restoredZoom = zoom0.toFixed(3) + ' -> compensating x' + zoomComp.toFixed(2);
		}

		// Open showing 75% of the canvas WIDTH - and width specifically, not
		// whichever dimension happens to be limiting.
		//
		// Measured on a device: the browser refuses to zoom out past the point
		// where the document width fills the screen, so the floor is
		//     max(minimum-scale, viewport / documentWidth)
		// and because the document IS the canvas times our transform, the two
		// cancel: the effective floor is vw/canvasW = fit-width, no matter what
		// transform we use. (Confirmed both ways - at natural size the floor
		// measured 0.2199 against a fit-width of 0.2192; landing at fit-width
		// made the document exactly viewport-wide and zoom-out stopped dead.)
		//
		// So an opening view pulled back further than fit-width can never be
		// returned to. On a tall canvas, showing 75% of the HEIGHT needs 0.1448
		// while the floor is 0.2192 - unreachable for good. Keyed to width it is
		// always reachable, since fit-width shows MORE than the 75% we open at.
		// Also never open further out than the floor itself. The viewport spec
		// stops minimum-scale at 0.1, so a canvas more than 10x the viewport
		// width cannot be zoomed out to fit at all - content/wide, at 6990px on
		// a 360px screen, would open at 0.069 against a floor of 0.100 and be
		// stranded. Clamping to 0.1 opens it slightly tighter than 75% (52% of
		// its width) but keeps step 3 honest: whatever we open with, the visitor
		// can get back to.
		var startScale = Math.max(0.1, Math.min(1, fitWidth / 0.75)) * zoomComp;

		// Report how far the browser ACTUALLY lets the visitor pinch out, versus
		// how far the opening view needs. Guessing at this from symptoms has
		// been unreliable; ask the browser.
		if (debugOn() && window.visualViewport) {
			var minSeen = 1;
			window.visualViewport.addEventListener('resize', function () {
				var s = window.visualViewport.scale;
				if (s < minSeen - 0.001) {
					minSeen = s;
					DBG.zoomFloor = s.toFixed(4) + '  (need ' + startScale.toFixed(4) +
						' for the 75% view; fit-width is ' + fitWidth.toFixed(4) + ')';
					DBG.visibleAtFloor = Math.round(vw / s) + 'x' + Math.round(vh / s) +
						' of ' + Math.round(canvasW) + 'x' + Math.round(canvasH) +
						' = ' + Math.round(Math.min(100, vw / s / canvasW * 100)) + '% w, ' +
						Math.round(Math.min(100, vh / s / canvasH * 100)) + '% h';
					showDebug();
				}
			});
		}

		DBG.forced = forced;
		DBG.viewport = vw + 'x' + vh;
		DBG.objects = objects.length;
		DBG.canvas = Math.round(canvasW) + 'x' + Math.round(canvasH);
		DBG.origin = Math.round(minX) + ',' + Math.round(minY);
		DBG.fitWidth = fitWidth.toFixed(4);

		// --- wrapper ---------------------------------------------------------
		// Objects are position:absolute, so the canvas must sit at the origin of
		// a positioned ancestor for every offset to survive untouched.
		var canvas = document.createElement('div');
		canvas.id = 'hg-mg-canvas';
		canvas.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;';
		// Size BODY ITSELF to the scaled canvas, and let the document scroll.
		//
		// This must not become a fixed-position scroll container, however
		// tempting: a fixed box is pinned to the LAYOUT viewport while pinch
		// zoom acts on the VISUAL one, so zooming out merely shrinks the box
		// into blank space, and with no document overflow the browser may
		// refuse to zoom out at all. Pinch-zoom in AND out is a hard
		// requirement, and it needs real document overflow.
		//
		// An earlier attempt put an oversized DIV inside body; Firefox reported
		// scrollWidth 1460 while setting scrollLeftMax to 0.43 and refused to
		// scroll it. That was specifically about a CHILD overflowing body.
		// Body's own box is the ordinary scroll content, which is why it is
		// sized here rather than wrapped.
		while (document.body.firstChild) canvas.appendChild(document.body.firstChild);
		document.body.appendChild(canvas);
		document.body.style.position = 'relative';
		document.body.style.margin = '0';

		// transform reads right-to-left: shift the bounding box to the origin,
		// then scale, then pan. Pan is in post-scale (document) px.
		function apply(scale, panX, panY) {
			canvas.style.transform =
				'translate(' + (-panX) + 'px,' + (-panY) + 'px) scale(' + scale + ') ' +
				'translate(' + (-minX) + 'px,' + (-minY) + 'px)';
		}
		function sizeSizer(scale) {
			// padTo, not canvasW - the extra is empty space that exists only to
			// lower the browser's zoom-out floor. See the note where it is
			// computed.
			document.body.style.width = (padTo * scale) + 'px';
			document.body.style.height = (canvasH * scale) + 'px';
		}
		// A NEGATIVE result means the canvas is smaller than the viewport on
		// that axis and should be centred - the normal case when pulled back.
		function panFor(scale) {
			var cw = canvasW * scale, ch = canvasH * scale;
			return {
				x: cw <= vw ? -(vw - cw) / 2 : 0,
				y: ch <= vh ? -(vh - ch) / 2 : 0
			};
		}

		// Land at the canvas ORIGIN, filling the screen on whichever axis is
		// TIGHTER, and pan along the other. No content inspection, so nothing
		// to guess wrong.
		//
		// Fitting the WIDTH only makes sense for a tall canvas. On a wide one it
		// is backwards: content/wide is 6990x954, so fit-width is scale 0.0515
		// and renders the whole page as a 360x49px strip inside a 649px-tall
		// viewport - almost all screen wasted and nothing legible. Taking the
		// LARGER of the two ratios ("cover") means one dimension always fits
		// exactly and the visitor pans along the longer one, which is the right
		// reading mode in both orientations.
		var fitHeight = vh / canvasH;
		// Land at NATURAL size. Anything derived from fitting the canvas to the
		// screen lands zoomed OUT by construction - fit-width on
		// content/zinecamp2015 is scale 0.295, at which 18px text renders 5px -
		// so the reveal would end with nothing legible and nothing zoomed into.
		// At 1:1 the page appears exactly as authored, which is both the
		// readable scale and the honest one, and needs no content inspection to
		// arrive at. The visitor pans from there.
		// No cap needed: 1.0 IS natural size, so it cannot upscale anything.
		var targetScale = 1 * zoomComp;
		DBG.fitHeight = fitHeight.toFixed(4);
		var end = panFor(targetScale);
		sizeSizer(targetScale);
		DBG.targetScale = targetScale.toFixed(4);

		function handoff(scale, panX, panY) {
			canvas.style.transition = '';
			sizeSizer(scale);
			// A negative pan means "centre me" - a scroll offset cannot express
			// that, so keep only that residue in the transform.
			var resX = Math.min(panX, 0), resY = Math.min(panY, 0);
			canvas.style.transform =
				'translate(' + (-resX) + 'px,' + (-resY) + 'px) ' +
				'scale(' + scale + ') translate(' + (-minX) + 'px,' + (-minY) + 'px)';
			void docEl.scrollWidth;		// flush the new body box before scrolling
			var sx = Math.max(0, panX), sy = Math.max(0, panY);
			window.scrollTo(sx, sy);
			// Belt and braces - some engines honour one route and not the other.
			if (Math.abs(window.scrollX - sx) > 2) {
				(document.scrollingElement || docEl).scrollLeft = sx;
				(document.scrollingElement || docEl).scrollTop = sy;
			}
			DBG.finalScale = scale.toFixed(4);
			DBG.wantScroll = Math.round(sx) + ',' + Math.round(sy);
			DBG.scroll = Math.round(window.scrollX) + ',' + Math.round(window.scrollY);
			DBG.scrollMax = ('scrollLeftMax' in docEl) ?
				(Math.round(docEl.scrollLeftMax) + ',' + Math.round(docEl.scrollTopMax)) : 'n/a';
			if (debugOn()) setTimeout(showDebug, 50);
		}

		// --- the reveal ------------------------------------------------------
		// Pull back to contain-fit - the WHOLE canvas, both axes. Fit-width
		// alone left content/zinecamp2015 overflowing 2.0 screens vertically, so
		// the composition was never actually seen. Floored so a freakishly tall
		// or wide canvas cannot open on unrecognisable mush.
		var start = panFor(startScale);
		apply(startScale, start.x, start.y);
		DBG.startScale = startScale.toFixed(4);

		var done = false;
		function stop() {
			canvas.removeEventListener('transitionend', finish);
			window.removeEventListener('touchstart', abort, true);
			window.removeEventListener('pointerdown', abort, true);
		}
		function finish(ev) {
			// transitionend BUBBLES, so a transition on any descendant object
			// would otherwise end the reveal early. Only our own counts.
			if (ev && (ev.target !== canvas || ev.propertyName !== 'transform')) return;
			if (done) return;
			done = true;
			stop();
			handoff(targetScale, end.x, end.y);
		}
		// Abort on ANY touch, without waiting to classify it as a drag or a
		// pinch: if you wait for movement, the opening pixels of the gesture
		// fight the running animation and it feels broken. Freeze the computed
		// matrix in place, then hand over from exactly there.
		function abort() {
			if (done) return;
			done = true;
			stop();
			var m = new DOMMatrixReadOnly(getComputedStyle(canvas).transform);
			// m maps a canvas point p to m.a*p + m.e, and our transform is
			// translate(-pan) scale(s) translate(-min), so e = -panX - s*minX.
			handoff(m.a, -m.e - m.a * minX, -m.f - m.d * minY);
		}
		canvas.addEventListener('transitionend', finish);
		window.addEventListener('touchstart', abort, true);
		window.addEventListener('pointerdown', abort, true);

		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			done = true;
			stop();
			handoff(targetScale, end.x, end.y);
			return;
		}

		// Don't start moving the moment the DOM is ready: this script is
		// deferred, so it runs before a single image has painted, and animating
		// from there spends the pulled-back view on a blank page. Wait for
		// window.load (capped), then for the page to be VISIBLE - opened in a
		// background tab the reveal must survive until the visitor looks - then
		// dwell, so the composition registers before anything moves.
		function whenVisible(fn) {
			if (document.visibilityState === 'visible') return fn();
			document.addEventListener('visibilitychange', function once() {
				if (document.visibilityState !== 'visible') return;
				document.removeEventListener('visibilitychange', once);
				fn();
			});
		}
		function beginReveal() {
			if (done) return;
			whenVisible(function () {
				setTimeout(function () {
					if (done) return;
					canvas.getBoundingClientRect();	// force the start state to stick
					canvas.style.transition = 'transform ' + REVEAL_MS + 'ms ' + REVEAL_EASE;
					apply(targetScale, end.x, end.y);
				}, REVEAL_DWELL_MS);
			});
		}
		if (document.readyState === 'complete') {
			beginReveal();
		} else {
			var waiting = true;
			var go = function () {
				if (!waiting) return;
				waiting = false;
				window.removeEventListener('load', go);
				beginReveal();
			};
			window.addEventListener('load', go);
			setTimeout(go, LOAD_WAIT_MS);
		}
	}

	function boot() {
		if (!debugOn()) { init(); return; }
		try {
			init();
		} catch (e) {
			DBG.error = (e && e.message) + ' | ' +
				(e && e.stack ? String(e.stack).split('\n')[1] : '');
		}
		showDebug();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
