// Mobile guided view - see SOW-mobile-guided-view.md
//
// A VIEWING-mode-only pan/zoom layer for small screens. The page's fixed
// canvas is never reflowed, reordered or written back to - every object stays
// exactly where the author put it. All we add is a way to look at it.
//
// Architecture (settled after ruling out the alternatives - see the SOW):
//
//   Scale lives in a CSS transform PERMANENTLY. Native page zoom cannot be set
//   or animated programmatically (visualViewport is read-only; scale is only
//   settable via the viewport meta, at parse time), and the reveal has to abort
//   on touch - so handing scale off to native zoom would mean swapping
//   transform-space for native-scale-space at the exact moment the user's
//   finger lands. Any mismatch reads as a jump. So we keep it.
//
//   Translation converts to NATIVE SCROLL once the reveal is done. The canvas
//   sits inside a spacer sized canvasW*scale x canvasH*scale, which gives the
//   document a real scrollable area, so panning is native scrolling with real
//   momentum. Only the translate component moves out of the transform - scale
//   stays put - and the conversion is exact integer arithmetic, so no jump.
//
//   Native pinch-zoom still layers on top of our base scale as user zoom.
(function () {
	'use strict';

	var TARGET_TEXT_PX = 16;	// what body text should render at after scaling
	var REVEAL_MS = 1500;
	var REVEAL_DWELL_MS = 500;	// hold at the pulled-back view before moving
	var LOAD_WAIT_MS = 2500;	// cap on waiting for images; abort-on-touch still works meanwhile
	var REVEAL_EASE = 'cubic-bezier(.3,.7,.2,1)';
	var SMALL_SCREEN_PX = 768;
	var TEXT_LED_RATIO = 0.15;	// text objects / all objects, above which a page is text-led
	var MIN_SCALE = 0.4, MAX_SCALE = 3;

	// ?guided=1 forces activation on a wide screen, ?guided=0 forces it off on
	// a phone. QA/demo tooling only - this is NOT a/b infrastructure (there is
	// no analytics anywhere in hotglue to measure against). Neither value can
	// override the view-mode guard: the script is only ever loaded outside the
	// editor, in common.inc.php.
	function override() {
		var m = /[?&]guided=([01])/.exec(location.search);
		return m ? m[1] === '1' : null;
	}

	function num(v) { return parseFloat(v) || 0; }

	// TEMP diagnostic: ?debug=1 paints state onto the page itself, because a
	// phone's console isn't reachable from here. Remove once the device issue
	// is understood.
	var DBG = {};
	function debugOn() { return /[?&]debug=1/.test(location.search); }
	function showDebug() {
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

	// Geometry comes from the inline styles hotglue writes on every object, so
	// it is correct before images finish loading. offsetWidth/Height only backs
	// it up where a dimension is missing.
	function measure(el) {
		var w = num(el.style.width) || el.offsetWidth;
		var h = num(el.style.height) || el.offsetHeight;
		return { x: num(el.style.left), y: num(el.style.top), w: w, h: h };
	}

	function init() {
		var forced = override();
		if (forced === false) return;


		var objects = [].slice.call(document.querySelectorAll('.object'));
		if (!objects.length) return;

		var boxes = objects.map(measure);
		// coordinates go NEGATIVE on real pages (content/mort starts at
		// y=-13), so the bounding box is min/max - never assume (0,0).
		var minX = Math.min.apply(null, boxes.map(function (b) { return b.x; }));
		var minY = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
		var maxX = Math.max.apply(null, boxes.map(function (b) { return b.x + b.w; }));
		var maxY = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));
		var canvasW = maxX - minX, canvasH = maxY - minY;
		if (canvasW <= 0 || canvasH <= 0) return;

		// Measure the LAYOUT viewport, not window.innerWidth. innerWidth is the
		// visual viewport and it is not trustworthy here: on desktop it counts
		// the scrollbar (measured 512 against a real 497), and Firefox's
		// responsive-design mode reports it as 1572 for a 393px viewport - 4x
		// out. Every scale below divides by this, so a wrong value silently
		// rescales the whole reveal: at 1572 the pull-back computed 0.718
		// instead of 0.179, turning a 5x move into 1.24x, and panFor() then
		// clamped the scroll negative and parked the page at the canvas origin.
		// documentElement.clientWidth is the width the page is actually laid
		// out against, excludes scrollbars, and does not move under pinch-zoom.
		var docEl = document.documentElement;
		var vw = docEl.clientWidth, vh = docEl.clientHeight;
		DBG.forced = forced;
		// The three environments (desktop small window / real phone / RDM)
		// disagree about these, and every scale we compute keys off the first
		// one. innerWidth is the VISUAL viewport (moves when pinch-zoomed);
		// clientWidth is the LAYOUT viewport (stable). If they disagree, that
		// is the discrepancy.
		DBG.innerWH = vw + 'x' + vh;
		DBG.clientWH = document.documentElement.clientWidth + 'x' +
			document.documentElement.clientHeight;
		DBG.visualVP = window.visualViewport ?
			(Math.round(window.visualViewport.width) + 'x' +
			 Math.round(window.visualViewport.height) +
			 ' @' + window.visualViewport.scale.toFixed(3)) : 'n/a';
		DBG.dpr = window.devicePixelRatio;
		DBG.coarsePointer = matchMedia('(pointer: coarse)').matches;
		DBG.objects = objects.length;
		DBG.bbox = Math.round(minX) + ',' + Math.round(minY) + ' -> ' +
			Math.round(maxX) + ',' + Math.round(maxY);
		DBG.canvas = Math.round(canvasW) + 'x' + Math.round(canvasH);
		// A page that already fits needs no intervention at all.
		if (forced !== true && (vw > SMALL_SCREEN_PX || canvasW <= vw)) {
			DBG.result = 'INACTIVE (viewport ' + vw + ' vs canvasW ' + Math.round(canvasW) + ')';
			return;
		}

		var fitWidth = vw / canvasW;

		// Classify by RATIO, not by "has any text at all" - content/mort holds
		// exactly 1 text object among 95, and a boolean test would send a
		// visibly image-only page down the text path and anchor it on that one
		// stray object.
		var texts = objects.filter(function (el) { return el.classList.contains('text'); });
		var textLed = (texts.length / objects.length) > TEXT_LED_RATIO;

		var target = textLed ? textView() : { scale: fitWidth, x: minX, y: minY };
		DBG.texts = texts.length;
		DBG.ratio = (texts.length / objects.length).toFixed(3);
		DBG.mode = textLed ? 'TEXT-LED' : 'IMAGE-LED';
		DBG.fitWidth = fitWidth.toFixed(4);
		DBG.targetScale = target.scale.toFixed(4);
		DBG.entry = Math.round(target.x) + ',' + Math.round(target.y);

		// Entry point + readable scale, both MEASURED from the rendered page.
		// The object files can't answer this: on content/zinecamp2015 only 10
		// of 32 text objects carry an explicit text-font-size, and the ones
		// that do are unrepresentative - reading them alone reports a dominant
		// size of 17px when the page is really 18px.
		function textView() {
			var sized = texts.map(function (el) {
				var b = measure(el);
				b.font = parseFloat(getComputedStyle(el).fontSize) || 0;
				b.weight = (el.textContent || '').trim().length;
				return b;
			}).filter(function (b) { return b.font > 0; });
			if (!sized.length) return { scale: fitWidth, x: minX, y: minY };

			// Dominant body size, weighted by how much text is actually set at
			// it - so a long paragraph outweighs a short heading, and neither a
			// 72px title nor an 8px caption can drag the scale to an absurd
			// place on its own.
			var byFont = {};
			sized.forEach(function (b) { byFont[b.font] = (byFont[b.font] || 0) + Math.max(b.weight, 1); });
			var dominant = Object.keys(byFont).reduce(function (a, b) {
				return byFont[b] > byFont[a] ? b : a;
			});

			var scale = TARGET_TEXT_PX / parseFloat(dominant);
			scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

			// Entry = top-most then left-most text. NOT (0,0), which is often
			// empty canvas - on content/zinecamp2015 the top-most text sits at
			// x=1279 of a 1642px canvas, 78% of the way across.
			var entry = sized.slice().sort(function (a, b) {
				return (a.y - b.y) || (a.x - b.x);
			})[0];
			return { scale: scale, x: entry.x, y: entry.y };
		}

		// --- build the wrapper + spacer -------------------------------------
		// Objects are position:absolute, so the canvas must sit at the origin
		// of a positioned ancestor for every offset to survive untouched.
		var canvas = document.createElement('div');
		canvas.id = 'hg-mg-canvas';
		canvas.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;';
		// Do NOT lean on the document scrolling. Sizing a block that overflows
		// body gives the right scrollWidth but Firefox refuses to make it
		// scrollable - measured scrollWidth 1460 against scrollLeftMax 0.43 -
		// so scrollTo and scrollLeft alike silently do nothing there. Instead
		// use a real scroll container pinned to the viewport, with an inner
		// sizer that gives it genuine scrollable content.
		var sizer = document.createElement('div');
		sizer.id = 'hg-mg-sizer';
		sizer.style.cssText = 'position:relative;';
		var spacer = document.createElement('div');
		spacer.id = 'hg-mg-spacer';
		spacer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;' +
			'overflow:hidden;-webkit-overflow-scrolling:touch;';
		while (document.body.firstChild) canvas.appendChild(document.body.firstChild);
		sizer.appendChild(canvas);
		spacer.appendChild(sizer);
		document.body.appendChild(spacer);

		// transform reads right-to-left: shift the bounding box to the origin,
		// then scale, then pan. Pan is in post-scale (document) px.
		function apply(scale, panX, panY) {
			canvas.style.transform =
				'translate(' + (-panX) + 'px,' + (-panY) + 'px) scale(' + scale + ') ' +
				'translate(' + (-minX) + 'px,' + (-minY) + 'px)';
		}
		// Sized to the FINAL scale up front so the scrollable area never
		// resizes mid-animation (scrolling is locked during the reveal anyway).
		function sizeSpacer(scale) {
			sizer.style.width = (canvasW * scale) + 'px';
			sizer.style.height = (canvasH * scale) + 'px';
		}
		// Centre the entry point where we can, but never scroll past content.
		function panFor(scale, x, y) {
			return {
				x: Math.max(0, Math.min((x - minX) * scale - vw / 4, canvasW * scale - vw)),
				y: Math.max(0, Math.min((y - minY) * scale - vh / 4, canvasH * scale - vh))
			};
		}

		var end = panFor(target.scale, target.x, target.y);
		sizeSpacer(target.scale);

		// Hand control to native scrolling: drop the pan out of the transform
		// and re-express it as scroll offset. Exact, so there is no jump.
		function handoff(scale, panX, panY) {
			canvas.style.transition = '';
			sizeSpacer(scale);
			canvas.style.transform =
				'scale(' + scale + ') translate(' + (-minX) + 'px,' + (-minY) + 'px)';
			// Only now let the container scroll: during the reveal the pan
			// lives in the transform, and a scrollable box would fight it.
			spacer.style.overflow = 'auto';
			setScroll(panX, panY);
		}

		// Firefox restores the previous scroll position after load, which lands
		// AFTER handoff() and silently undoes it - measured wantScroll 1010,0
		// against gotScroll 0,0 while the extent (1460) allowed it fine. Taking
		// manual control of restoration stops that; re-applying on the next
		// frame and once more shortly after covers any other late clobber
		// (Chrome needed neither, so this is belt and braces there).
		// Scroll the container we built, not the document.
		function setScroll(panX, panY) {
			void sizer.offsetWidth;		// flush the new sizer box before scrolling
			spacer.scrollLeft = panX;
			spacer.scrollTop = panY;
			DBG.scrollable = (sizer.offsetWidth - spacer.clientWidth) + ',' +
				(sizer.offsetHeight - spacer.clientHeight);
			DBG.scrollImmediate = Math.round(spacer.scrollLeft) + ',' +
				Math.round(spacer.scrollTop);
			var again = function () {
				spacer.scrollLeft = panX;
				spacer.scrollTop = panY;
			};
			requestAnimationFrame(again);
			setTimeout(again, 80);
		}

		var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Image-led pages skip the reveal: their target IS composition-fit, so
		// start and end scales nearly coincide (1.33x on content/mort, against
		// 5x on zinecamp) and the move would be imperceptible.
		if (!textLed || reduced) {
			handoff(target.scale, end.x, end.y);
			return;
		}

		// --- the reveal -----------------------------------------------------
		// Pull back to the full WIDTH (not contain-fit: these canvases run
		// 1:3.6 and 1:4.2 against a phone's 1:2.2, so contain-fitting mort
		// would render it as a 202px sliver of unrecognisable mush), then move
		// continuously in to the entry point at the readable scale.
		var startScale = fitWidth * 0.75;
		var start = panFor(startScale, minX, minY);
		apply(startScale, start.x, start.y);
		DBG.startScale = startScale.toFixed(4);
		DBG.wantScroll = Math.round(end.x) + ',' + Math.round(end.y);
		DBG.result = 'reveal armed';
		// after the reveal, confirm the scroll actually took (the Firefox
		// layout-flush bug showed up precisely here)
		setTimeout(function () {
			DBG.gotScroll = Math.round(spacer.scrollLeft) + ',' + Math.round(spacer.scrollTop);
			DBG.scrollExtent = sizer.offsetWidth + 'x' + sizer.offsetHeight +
				' port=' + spacer.clientWidth + 'x' + spacer.clientHeight;
			DBG.finalScale = new DOMMatrixReadOnly(getComputedStyle(canvas).transform).a.toFixed(4);
			DBG.vpAfter = window.visualViewport ?
				(Math.round(window.visualViewport.width) + ' @' +
				 window.visualViewport.scale.toFixed(3)) : 'n/a';
			if (debugOn()) { var o = document.getElementById('hg-mg-dbg'); if (o) o.remove(); showDebug(); }
		}, REVEAL_MS + REVEAL_DWELL_MS + 800);

		var done = false;
		function finish(ev) {
			// transitionend bubbles, so a transition on any descendant object
			// would otherwise end the reveal early. Only our own transform
			// counts.
			if (ev && (ev.target !== canvas || ev.propertyName !== 'transform')) return;
			if (done) return;
			done = true;
			canvas.removeEventListener('transitionend', finish);
			window.removeEventListener('touchstart', abort, true);
			window.removeEventListener('pointerdown', abort, true);
			handoff(target.scale, end.x, end.y);
		}
		// Abort on ANY touch, without waiting to classify it as a drag or a
		// pinch: if you wait for movement, the opening pixels of the gesture
		// fight the running animation and it feels broken. Freeze the computed
		// matrix in place, then hand over from exactly there.
		function abort() {
			if (done) return;
			done = true;
			var m = new DOMMatrixReadOnly(getComputedStyle(canvas).transform);
			canvas.removeEventListener('transitionend', finish);
			window.removeEventListener('touchstart', abort, true);
			window.removeEventListener('pointerdown', abort, true);
			// m maps a canvas point p to m.a*p + m.e, and our transform is
			// translate(-pan) scale(s) translate(-min), so e = -panX - s*minX.
			handoff(m.a, -m.e - m.a * minX, -m.f - m.d * minY);
		}
		canvas.addEventListener('transitionend', finish);
		window.addEventListener('touchstart', abort, true);
		window.addEventListener('pointerdown', abort, true);

		// Don't start moving the moment the DOM is ready. This script is
		// deferred, so it runs before a single image has painted - animating
		// from there means the pulled-back view is spent on a blank page and
		// the composition, the entire point of the reveal, is never seen.
		//
		// The start transform is already applied above, so the page frames
		// itself correctly while it loads and the user watches it fill in.
		// Only the MOVE waits: for window.load, capped so a slow or broken
		// image can't strand the page zoomed out, then a short dwell so the
		// composition registers before anything moves (the easing is fast-out,
		// so without a dwell there is no still moment at all).
		// Wait for the page to be VISIBLE before moving, explicitly rather than
		// by relying on how a given browser throttles hidden tabs. Opened in a
		// background tab, the reveal must still be there when the visitor
		// finally looks: run it while hidden and they arrive to find it already
		// over. (Don't gate this on requestAnimationFrame instead - rAF happens
		// to be frozen while hidden today, but that is a scheduling detail, not
		// a promise about visibility.)
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
					apply(target.scale, end.x, end.y);
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
		DBG.readyState = document.readyState;
		try {
			init();
		} catch (e) {
			DBG.result = 'THREW: ' + (e && e.message);
			DBG.stack = (e && e.stack ? String(e.stack).split('\n').slice(0, 3).join(' | ') : '');
		}
		showDebug();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
