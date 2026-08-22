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
	var TOGGLE_MS = 400;		// double-tap zoom between the two views
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
		var fitHeight = vh / canvasH;

		// NO document padding. An earlier version widened the document with
		// blank space, believing the zoom-out floor was
		// max(minimum-scale, viewport / documentWidth) and could be lowered by
		// growing the denominator. Measured on device, on both engines, at two
		// viewport sizes, padded and unpadded: the floor sat at exactly 0.2500
		// every time. It does not depend on document width at all. The padding
		// was buying nothing and costing a screenful of blank canvas to scroll
		// into, so it is gone.
		DBG.docWidth = Math.round(canvasW) + ' (= canvas; padding does not move the floor)';

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
		var zoom0 = (window.visualViewport && window.visualViewport.scale) || 1;
		var zoomComp = 1 / Math.min(4, Math.max(0.25, zoom0));
		if (Math.abs(zoom0 - 1) > 0.01) {
			DBG.restoredZoom = zoom0.toFixed(3) + ' -> compensating x' + zoomComp.toFixed(2);
		}

		// Open showing 75% of the canvas WIDTH. No floor: the opening is
		// allowed to sit below what the browser will let the visitor pinch
		// back out to.
		//
		// That needs justifying, because it was briefly the other way round.
		// The browser's pinch range is a fixed 20x window: measured on device,
		// both blink and gecko stop at a quarter of the layout viewport
		// whatever the viewport meta declares, and will not zoom in past 5x.
		// So an opening below 0.25 cannot be returned to BY PINCH. It was therefore clamped to
		// 0.3125, which kept the guarantee and destroyed the view: at that
		// scale the opening shows at most 3.2x the viewport width, so
		// content/wide opened on 16% of its composition and content/mort on
		// 27%. A reveal that pulls back by a sixth is not a reveal.
		//
		// The clamp was only ever needed because pinch was the ONLY way back.
		// Double-tap is not: it moves the transform, which no floor touches.
		// After a double-tap to contain-fit the pinch window becomes
		// [0.25 x contain, 5 x contain], and the opening scale falls inside it
		// on every test page - wide 0.0687 in [0.0122, 0.2446], mort 0.1137 in
		// [0.0088, 0.1755], zinecamp 0.2923 in [0.0258, 0.516]. So the opening
		// stays reachable; it is reached by double-tapping out and pinching
		// back in, rather than by pinch alone.
		// The opening view: 75% of the LIMITING dimension, before the
		// pinch-restore compensation. Named separately because the double-tap
		// toggle targets this exact value - double-tap means "back to how it
		// opened", pan included.
		//
		// Limiting, not width. Keyed to width alone, a tall page opens on a
		// thin horizontal slice: content/zinecamp2015 is 1642x5976, so 75% of
		// its width is 37% of its height, and the visitor sees a band across
		// the top rather than a composition. Taking whichever dimension is
		// more constrained shows 75% of that one and 100% of the other, which
		// is the right reading of "pull back to show me the page" in both
		// orientations - a wide, short canvas like content/wide is unaffected,
		// since width is limiting there anyway.
		//
		// This is contain-fit divided by 0.75, i.e. deliberately one third
		// tighter than fitting the whole canvas.
		var openBase = Math.min(1, Math.min(fitWidth, fitHeight) / 0.75);
		// A canvas barely larger than the screen puts that at natural size,
		// which would leave the toggle with two identical states and nothing to
		// do. Show the whole canvas instead. The reveal is imperceptible on
		// those pages for the same reason.
		if (openBase > 0.95) {
			openBase = Math.min(fitWidth, fitHeight) * 0.95;
		}
		var startScale = openBase * zoomComp;

		// Report how far the browser ACTUALLY lets the visitor pinch out, versus
		// how far the opening view needs. Guessing at this from symptoms has
		// been unreliable; ask the browser.
		//
		// POLLED, not event-driven. visualViewport's resize event is the
		// obvious source and it is not dependable: three on-device runs came
		// back with no reading at all, which could equally mean "the zoom never
		// changed" or "the event never fired", and those need telling apart.
		// So sample, and sample three independent witnesses, because no single
		// one is trustworthy on both engines:
		//   visualViewport.scale - the direct answer, where it updates
		//   innerWidth           - the VISUAL viewport, so it grows as you
		//                          pinch out even if the event stays silent
		//                          (and reads 4x out on firefox android, which
		//                          is fine - we only watch it CHANGE)
		//   scrollLeftMax        - gecko-only, recomputed against the visual
		//                          viewport, so it shrinks as innerWidth grows
		// If all three sit still while you pinch, zoom-out is genuinely blocked.
		if (debugOn()) {
			var minScale = Infinity, maxInner = 0, minSLM = Infinity;
			var hasSLM = ('scrollLeftMax' in docEl);
			setInterval(function () {
				var s = (window.visualViewport && window.visualViewport.scale) || 1;
				var iw = window.innerWidth;
				if (s < minScale) minScale = s;
				if (iw > maxInner) maxInner = iw;
				if (hasSLM && docEl.scrollLeftMax < minSLM) minSLM = docEl.scrollLeftMax;
				// What the browser zoom has to reach to show the opening view
				// again: the transform is parked at targetScale, so the visitor
				// makes up the rest.
				var need = startScale / targetScale;
				DBG.pinch = 'scale now ' + s.toFixed(4) + ', min seen ' + minScale.toFixed(4) +
					' - need ' + need.toFixed(4) + ' to regain the opening view';
				DBG.pinchInner = 'innerWidth now ' + iw + ', max seen ' + maxInner;
				DBG.pinchSLM = hasSLM ?
					('scrollLeftMax now ' + Math.round(docEl.scrollLeftMax) +
						', min seen ' + Math.round(minSLM)) : 'n/a (blink)';
				// Canvas px on screen at the furthest pinch reached. Document px
				// are canvas px times the transform, hence the divide.
				var visW = vw / minScale / targetScale, visH = vh / minScale / targetScale;
				DBG.visibleAtMin = Math.round(visW) + 'x' + Math.round(visH) +
					' of ' + Math.round(canvasW) + 'x' + Math.round(canvasH) +
					' = ' + Math.round(Math.min(100, visW / canvasW * 100)) + '% w, ' +
					Math.round(Math.min(100, visH / canvasH * 100)) + '% h';
				showDebug();
			}, 250);
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
			document.body.style.width = (canvasW * scale) + 'px';
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

		// Land at the canvas ORIGIN at NATURAL size. Anything derived from
		// fitting the canvas to the screen lands zoomed OUT by construction -
		// fit-width on content/zinecamp2015 is 0.2192, at which its 18px body
		// text renders 4px - so the reveal would end with nothing legible and
		// nothing zoomed into. At 1:1 the page appears exactly as authored,
		// which is both the readable scale and the honest one, and needs no
		// content inspection to arrive at. The visitor pans from there.
		// No cap needed: 1.0 IS natural size, so it cannot upscale anything.
		var targetScale = 1 * zoomComp;
		DBG.fitHeight = fitHeight.toFixed(4);
		var end = panFor(targetScale);
		sizeSizer(targetScale);
		DBG.targetScale = targetScale.toFixed(4);

		// Where the view settled after the last move. The toggle animates from
		// here, and a transform cannot be read back reliably mid-gesture.
		var cur = { scale: 1, panX: 0, panY: 0 };

		function handoff(scale, panX, panY) {
			canvas.style.transition = '';
			cur.scale = scale; cur.panX = panX; cur.panY = panY;
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
			armToggle();
		}

		// --- double-tap: toggle between natural size and the opening view ----
		// The browser's pinch range is a fixed 20x window, [0.25, 5], and our
		// transform decides WHERE that window sits, since what the visitor sees
		// is browserZoom x transform. Parked at natural size the window reaches
		// 4x pulled back and no further - nowhere near the opening view on a
		// large canvas (content/mort opens at 0.1137, the floor is 0.25). So
		// offer it explicitly, as a deliberate gesture rather than by fighting
		// the floor: double-tap animates the TRANSFORM back to openBase, the
		// exact scale and pan the reveal opened with; double-tap again returns
		// to natural size, centred on whatever was tapped. A transform is ours,
		// so neither end is subject to the floor at all.
		//
		// The whole composition is still reachable, by pinching OUT from the
		// opening view: that state's window is [0.25 x openBase, 5 x openBase],
		// which contains contain-fit on every test page. It stops holding for a
		// canvas taller than about 5.4:1 on a 360x649 viewport, where even that
		// would not reach - no such page exists here, but that is the limit.
		//
		// Not a continuous zoom-out past 0.25, which is not buildable: once the
		// browser clamps, visualViewport.scale stops moving, so we get no signal
		// for how much further the fingers are still spreading. The gesture is
		// swallowed. A discrete, animated, user-initiated move is honest about
		// that instead of pretending to track a gesture we cannot see.
		function pinchNow() {
			var z = (window.visualViewport && window.visualViewport.scale) || 1;
			return Math.min(4, Math.max(0.25, z));
		}
		// Pan that centres a canvas point, clamped to the content, falling back
		// to centring when the scaled canvas is smaller than the viewport.
		function panCentredOn(scale, cx, cy) {
			var cw = canvasW * scale, ch = canvasH * scale;
			return {
				x: cw <= vw ? -(vw - cw) / 2 :
					Math.max(0, Math.min((cx - minX) * scale - vw / 2, cw - vw)),
				y: ch <= vh ? -(vh - ch) / 2 :
					Math.max(0, Math.min((cy - minY) * scale - vh / 2, ch - vh))
			};
		}
		// Page coordinates are document coordinates, so the current scroll is
		// already folded in; only the centring residue has to come back out.
		function canvasPointAt(pageX, pageY) {
			return {
				x: (pageX + Math.min(cur.panX, 0)) / cur.scale + minX,
				y: (pageY + Math.min(cur.panY, 0)) / cur.scale + minY
			};
		}
		var atOverview = false, toggling = false;
		function toggleView(pageX, pageY) {
			if (toggling) return;
			toggling = true;
			var at = canvasPointAt(pageX, pageY);
			var want = atOverview ? 1 : openBase;
			// Compensate for wherever the visitor's pinch currently sits, the
			// same way the load-time compensation does - our transform and the
			// browser's zoom multiply, and this is the third place that has
			// bitten. Without it, double-tapping while pinched out to the floor
			// would land at a quarter of the intended scale.
			var scale = want / pinchNow();
			var pan = atOverview ? panCentredOn(scale, at.x, at.y) : panFor(scale);
			atOverview = !atOverview;

			// Scroll cannot be transitioned, so fold it back into the transform
			// before animating, then hand it back to scroll at the end.
			window.scrollTo(0, 0);
			apply(cur.scale, cur.panX, cur.panY);
			canvas.getBoundingClientRect();		// make the start state stick
			canvas.style.transition = 'transform ' + TOGGLE_MS + 'ms ' + REVEAL_EASE;
			apply(scale, pan.x, pan.y);
			var settled = false;
			var settle = function (ev) {
				// transitionend BUBBLES - only our own transform counts.
				if (ev && (ev.target !== canvas || ev.propertyName !== 'transform')) return;
				// The backstop timer must not fire a SECOND time after
				// transitionend has already handed over: by then the visitor may
				// have panned, and re-running handoff would yank them back to
				// where the toggle happened to land.
				if (settled) return;
				settled = true;
				canvas.removeEventListener('transitionend', settle);
				toggling = false;
				handoff(scale, pan.x, pan.y);
			};
			canvas.addEventListener('transitionend', settle);
			setTimeout(settle, TOGGLE_MS + 250);	// in case the event is missed
		}

		var tapAt = 0, tapX = 0, tapY = 0, armed = false;
		function onTap(ev) {
			var t = (ev.changedTouches && ev.changedTouches[0]) || ev;
			var now = Date.now();
			if (now - tapAt < 350 &&
					Math.abs(t.pageX - tapX) < 40 && Math.abs(t.pageY - tapY) < 40) {
				tapAt = 0;
				toggleView(t.pageX, t.pageY);
			} else {
				tapAt = now; tapX = t.pageX; tapY = t.pageY;
			}
		}
		// Armed only once the view has settled, so it cannot fire while the
		// reveal is still running - a touch there means ABORT, not toggle.
		// width=device-width already disables the browser's own double-tap
		// zoom on both engines, so there is nothing to compete with.
		function armToggle() {
			if (armed) return;
			armed = true;
			window.addEventListener('touchend', onTap);
			window.addEventListener('dblclick', function (ev) {
				toggleView(ev.pageX, ev.pageY);		// desktop, for ?guided=1
			});
		}

		// --- the reveal ------------------------------------------------------
		// Open at startScale, anchored at the canvas origin - 75% of the WIDTH.
		// Both ends of the move are at the origin, so on a tall canvas this is
		// a pure zoom; the centring branch in panFor() engages only for a
		// canvas smaller than the viewport on an axis, which is the normal
		// case vertically for a wide, short page like content/wide.
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
