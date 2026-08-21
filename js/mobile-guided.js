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

		var vw = window.innerWidth, vh = window.innerHeight;
		// A page that already fits needs no intervention at all.
		if (forced !== true && (vw > SMALL_SCREEN_PX || canvasW <= vw)) return;

		var fitWidth = vw / canvasW;

		// Classify by RATIO, not by "has any text at all" - content/mort holds
		// exactly 1 text object among 95, and a boolean test would send a
		// visibly image-only page down the text path and anchor it on that one
		// stray object.
		var texts = objects.filter(function (el) { return el.classList.contains('text'); });
		var textLed = (texts.length / objects.length) > TEXT_LED_RATIO;

		var target = textLed ? textView() : { scale: fitWidth, x: minX, y: minY };

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
		var spacer = document.createElement('div');
		spacer.id = 'hg-mg-spacer';
		spacer.style.cssText = 'position:relative;overflow:hidden;';
		while (document.body.firstChild) canvas.appendChild(document.body.firstChild);
		spacer.appendChild(canvas);
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
			spacer.style.width = (canvasW * scale) + 'px';
			spacer.style.height = (canvasH * scale) + 'px';
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
			spacer.style.overflow = '';
			canvas.style.transition = '';
			sizeSpacer(scale);
			canvas.style.transform =
				'scale(' + scale + ') translate(' + (-minX) + 'px,' + (-minY) + 'px)';
			window.scrollTo(panX, panY);
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

		var done = false;
		function finish() {
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

		requestAnimationFrame(function () {
			canvas.getBoundingClientRect();	// force the start state to stick
			canvas.style.transition = 'transform ' + REVEAL_MS + 'ms ' + REVEAL_EASE;
			apply(target.scale, end.x, end.y);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
