'use strict';

/* parity stage — SOW-parity-ab-stage.md, Part 3.
 *
 * Two same-origin iframes (the current engine on the left, ng on the right)
 * render the same page from the same content tree. For each Hotglue object
 * this reads the real bounding box out of both documents, draws a box at that
 * exact position over each pane, and compares the pair — geometry, key styles,
 * content. A green box means those two engines genuinely agree about that
 * object; nothing is staged.
 *
 * It is also the object-by-object triage view for the migration: Export writes
 * the per-object differences as JSON.
 *
 * Parameters (all optional)
 *   ?page=<name>          one page
 *   ?pages=<a,b,c>        a montage, in order
 *   ?all=1                every page in the content tree, asked of the engine
 *                         (with ?autoplay=1 and, to go round, ?loop=1)
 *   ?loop=1               come round to the first page at the end instead of stopping
 *   ?shuffle=1            play the run in random order instead of the list's
 *   ?layout=stack         portrait (top/bottom) instead of side-by-side
 *   ?layout=auto          let each page choose (see autoLayout): wide pages
 *                         stack, taller ones go side-by-side
 *   ?stackh=80            stacked panes: each pane's share of the stage height,
 *                         in % (default 50 — the most both panes can take and
 *                         still be whole on screen; above that the lower one
 *                         runs past the fold and the stage scrolls for it)
 *   ?fit=1                scale each page to fit its pane in both directions:
 *                         the whole page is on screen, and it is the pane's
 *                         height that sets how large the page is
 *   ?ms=2000 | ?bpm=30    per-object beat (three frame pulses, then on)
 *   ?speedup=1.12         each page ticks this much faster than the last
 *   ?max=30               cap the objects ticked per page
 *   ?audio=1              click track on the beat; the audio clock drives the ticks
 *   ?autoplay=1           start as soon as the first page has loaded
 */

const P = new URLSearchParams(location.search);
const MOUNT = { current: '/current/', ng: '/ng/' };

const DEFAULT_PAGES = [
	'aimeepo-presentacion',
	'catobarberien-eerstejaar',
	'baixasresolucoes-start',
	'limohair-dyed-of-natural-causes-RIP',
	'mul-made',
	'zermela-zermela',
];

/* Stacked panes: how much of the stage height each one takes. Half is the most
   the two can take and both still be whole — the sum is bounded by the window,
   so a taller pane is paid for out of the lower one's bottom, which goes under
   the fold and takes the stage's scrollbar with it. That is the right trade
   only on purpose, so it is the opt-in: 65 was the default while pane height
   was thought to be what put more page on screen; ?fit=1 is what actually does
   that, and it draws a bigger page out of a shorter pane all by itself.
   Garbage in the parameter falls back to the default rather than reaching the
   stylesheet as NaN, where the invalid calc() would leave the panes unsized. */
const rawStackh = P.has('stackh') ? +P.get('stackh') : 50;
const STACKH = Number.isFinite(rawStackh) ? Math.min(100, Math.max(20, rawStackh)) : 50;

const CFG = {
	pages: (P.get('pages') || P.get('page') || DEFAULT_PAGES.join(',')).split(',').map(s => s.trim()).filter(Boolean),
	single: !!P.get('page') && !P.get('pages'),
	// ?all=1 replaces that list with every page the content tree holds, asked of
	// the engine itself (see allPagenames): a run over the whole corpus must not
	// be a list kept here, which goes stale the moment a page is added. An
	// explicit ?pages= wins — it is the narrower request. ?loop=1 keeps going at
	// the end rather than stopping, which is what an unattended run wants.
	all: P.get('all') === '1' && !P.get('pages') && !P.get('page'),
	loop: P.get('loop') === '1',
	shuffle: P.get('shuffle') === '1',
	layout: ['stack', 'auto'].includes(P.get('layout')) ? P.get('layout') : 'side',
	stackh: STACKH,
	fit: P.get('fit') === '1',
	interval: P.has('ms') ? +P.get('ms') : (P.has('bpm') ? 60000 / +P.get('bpm') : 2000),
	speedup: P.has('speedup') ? +P.get('speedup') : 1,
	max: P.has('max') ? +P.get('max') : 0,
	audio: P.get('audio') === '1',
	autoplay: P.get('autoplay') === '1',
	k: P.has('k') ? +P.get('k') : 0,
	// control: render a DIFFERENT page on the ng side. A comparison tool with
	// no control cannot be trusted to report a difference at all — this is how
	// you prove it still can (?page=A&vs=B → the boxes should disagree).
	vs: P.get('vs') || '',
	hold: 1500,			// ms a fully-green page holds before the montage moves on
	floor: 300,			// ms — never tick faster than this (three pulses want room)
	scanMin: 200,		// ms — the scan pass takes a random time per object, in this
	scanMax: 800,		//      range, so the machine does not keep time like a metronome
};

const $ = s => document.querySelector(s);
const r1 = n => Math.round(n * 10) / 10;
const clip = (s, n = 40) => (s || '').length > n ? s.slice(0, n) + '…' : (s || '');

/* ---- panes ------------------------------------------------------------ */

const PANES = {
	current: { side: 'current', el: $('#if-current'), ov: $('#ov-current'), pane: $('#pane-current'), scroller: $('#pane-current .scroller'), viewport: $('#pane-current .viewport') },
	ng: { side: 'ng', el: $('#if-ng'), ov: $('#ov-ng'), pane: $('#pane-ng'), scroller: $('#pane-ng .scroller'), viewport: $('#pane-ng .viewport') },
};
const SIDES = ['current', 'ng'];

let view = { page: null, pageIndex: 0, seq: [], findings: [], ticked: 0 };
let drawn = [];			// boxes already placed for the current page

/* ---- audio: the beat is the timebase -------------------------------- */

const audio = {
	ctx: null, master: null, dest: null,
	on: false,
	init() {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return false;
		this.ctx = new AC();
		this.dest = this.ctx.createMediaStreamDestination();
		this.master = this.ctx.createGain();
		this.master.gain.value = 0.4;
		this.master.connect(this.ctx.destination);
		this.master.connect(this.dest);		// so a recording carries the score
		return true;
	},
	resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
	ready() { return !!(this.on && this.ctx && this.ctx.state === 'running'); },
	tick(t, i) {						// soft woodblock; a low thump every 4th
		if (!this.ready()) return;
		const down = (i % 4 === 0);
		const o = this.ctx.createOscillator(), g = this.ctx.createGain();
		o.type = 'triangle';
		o.frequency.setValueAtTime(down ? 196 : 840, t);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(down ? 0.20 : 0.08, t + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0001, t + (down ? 0.18 : 0.06));
		o.connect(g).connect(this.master);
		o.start(t);
		o.stop(t + 0.25);
	},
};

/* ---- clock: lookahead scheduler, audio time when it is running -------- */

const clock = {
	period: CFG.interval / 1000,
	gen: 0, timer: 0, running: false, next: 0, i: 0, cb: null,
	now() { return audio.ready() ? audio.ctx.currentTime : performance.now() / 1000; },
	start(cb, from) {
		this.cb = cb;
		this.running = true;
		this.gen++;
		this.i = from || 0;
		this.next = this.now() + 0.08;
		clearInterval(this.timer);
		this.timer = setInterval(() => this.pump(), 25);
		this.pump();
	},
	stop() { this.running = false; this.gen++; clearInterval(this.timer); },
	pump() {
		if (!this.running) return;
		const gen = this.gen;
		while (this.next < this.now() + 0.12) {
			const t = this.next, i = this.i;
			audio.tick(t, i);
			const wait = Math.max(0, (t - this.now()) * 1000);
			setTimeout(() => { if (this.running && this.gen === gen) this.cb(i); }, wait);
			this.next += this.period;
			this.i++;
		}
	},
};

/* ---- engine documents ------------------------------------------------- */

function objects(doc) {
	return [...doc.querySelectorAll('[class*="object"]')].filter(el => {
		const id = el.id;
		return id && id.indexOf('.') > 0 && /\d+$/.test(id);
	});
}

function measure(pane) {
	const doc = pane.el.contentDocument;
	if (!doc || !doc.documentElement) return null;
	const de = doc.documentElement, b = doc.body;
	let w = Math.max(de.scrollWidth, b ? b.scrollWidth : 0, 320);
	let h = Math.max(de.scrollHeight, b ? b.scrollHeight : 0, 240);
	for (const el of objects(doc)) {
		// the inline geometry hotglue writes on every object — unlike a rect it
		// is immune to any transform a viewing layer may have applied
		const l = parseFloat(el.style.left), t = parseFloat(el.style.top);
		const ew = parseFloat(el.style.width) || el.offsetWidth;
		const eh = parseFloat(el.style.height) || el.offsetHeight;
		if (!isNaN(l) && !isNaN(ew)) w = Math.max(w, l + ew);
		if (!isNaN(t) && !isNaN(eh)) h = Math.max(h, t + eh);
	}
	return { doc, w: Math.ceil(w), h: Math.ceil(h), missing: !!doc.getElementById('create_page') };
}

const PROBE_W = 1600, PROBE_H = 1200;

function loadPane(pane, page) {
	return new Promise(resolve => {
		pane.doc = null;		// the last page's document, let go before the next arrives
		// Load at a wide viewport. ng carries a mobile viewing layer whose gate is
		// "viewport <= 768 and the canvas wider than it" — it would wrap the page
		// in a scale() and every rect we read would be a scaled one. Parity is a
		// desktop-render question (the SOW excludes the mobile stratum), so we
		// load wide, measure, then set the frame to the page's own canvas size.
		pane.el.style.transform = 'none';
		pane.el.style.left = '0px';
		pane.el.style.width = PROBE_W + 'px';
		pane.el.style.height = PROBE_H + 'px';
		// a page carrying a slow or unreachable embed may never fire load; the
		// object layer is what we compare, and it is parsed long before that
		let done = false;
		const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
		const timer = setTimeout(finish, 12000);
		pane.el.onload = finish;
		pane.el.src = MOUNT[pane.side] + '?' + encodeURIComponent(page);
	});
}

/* ---- comparison ------------------------------------------------------- */

const MODULES = ['text', 'image', 'video', 'webvideo', 'iframe', 'embed', 'download', 'userhead', 'userbody'];
const NOISE = ['object', 'resizable', 'selected', 'glue', 'ui-draggable', 'ui-resizable', 'ui-selectable'];

function moduleOf(el) {
	const cls = (el.className || '').split(/\s+/).filter(Boolean);
	return cls.find(c => MODULES.includes(c)) || cls.find(c => !NOISE.includes(c)) || '?';
}

function normUrl(u) {
	if (!u) return '';
	u = String(u).trim().replace(/^url\(["']?(.*?)["']?\)$/i, '$1');
	if (u === 'none') return '';
	// the same asset is reached through two mounts (/current/ and /ng/); the
	// mount is not part of what the object points at
	u = u.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '')
	     .replace(/^(current|ng)\//, '').replace(/^[/?]+/, '');
	return u;
}

const normText = s => (s || '').replace(/\s+/g, ' ').trim();

function normColor(c) {
	c = (c || '').trim();
	return (c === 'transparent' || c === 'rgba(0, 0, 0, 0)') ? '' : c;
}

function contentOf(el, module) {
	switch (module) {
		case 'image': {
			const bg = normUrl(getComputedStyle(el).backgroundImage);
			if (bg) return bg;
			const img = el.querySelector('img');
			return img ? normUrl(img.getAttribute('src')) : '';
		}
		case 'iframe':
		case 'webvideo': {
			const f = el.querySelector('iframe, video, embed');
			return f ? normUrl(f.getAttribute('src')) : normText(el.textContent);
		}
		case 'download': {
			const a = el.querySelector('a');
			return a ? normUrl(a.getAttribute('href')) + '|' + normText(el.textContent) : normText(el.textContent);
		}
		case 'userhead':
		case 'userbody':
			return normText(el.textContent) || normText(el.innerHTML);
		default:
			return normText(el.textContent);
	}
}

/* Wrapper-only: the inner document of an embed is cross-origin even inside
 * our same-origin iframe, so the honest claim is "the wrapper matches". */
const isEmbed = m => m === 'iframe' || m === 'webvideo' || m === 'embed' || m === 'video';

function grab(el) {
	const r = el.getBoundingClientRect();
	const module = moduleOf(el);
	const cs = getComputedStyle(el);
	return {
		el, module,
		rect: { left: r.left, top: r.top, width: r.width, height: r.height },
		style: {
			'background-color': normColor(cs.backgroundColor),
			// no background-image here by design: the engines deliver an image
			// object differently (current paints an inner <img>, ng sets the
			// background), so the *source* is compared in contentOf — mechanism
			// is not a difference. Same call the A1 sweep makes.
			'font-size': cs.fontSize,
			'color': cs.color,
			'padding': cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
		},
		content: contentOf(el, module),
	};
}

function compare(a, b) {
	if (!a && !b) return { verdict: 'match', diffs: [] };
	if (!a) return { verdict: 'bad', diffs: ['missing on current'] };
	if (!b) return { verdict: 'bad', diffs: ['missing on ng'] };
	const diffs = [];
	for (const k of ['left', 'top', 'width', 'height']) {
		if (Math.abs(a.rect[k] - b.rect[k]) > 1) {
			diffs.push(k + ' ' + r1(a.rect[k]) + ' vs ' + r1(b.rect[k]));
		}
	}
	if (a.module !== b.module) diffs.push('module ' + a.module + ' vs ' + b.module);
	for (const p of Object.keys(a.style)) {
		if (a.style[p] !== b.style[p]) diffs.push(p + ' ' + clip(a.style[p], 28) + ' vs ' + clip(b.style[p], 28));
	}
	if (!isEmbed(a.module) && a.content !== b.content) {
		diffs.push('content «' + clip(a.content) + '» vs «' + clip(b.content) + '»');
	}
	return { verdict: diffs.length ? 'flag' : 'match', diffs, partial: isEmbed(a.module) };
}

/* ---- the sequence ----------------------------------------------------- */

function buildSequence() {
	const maps = { current: new Map(), ng: new Map() };
	for (const side of SIDES) {
		for (const el of objects(PANES[side].el.contentDocument)) {
			if (!maps[side].has(el.id)) maps[side].set(el.id, el);
		}
	}
	// order by ng's document order, then anything only current has
	const ids = [...maps.ng.keys()];
	for (const id of maps.current.keys()) if (!ids.includes(id)) ids.push(id);
	const capped = CFG.max > 0 ? ids.slice(0, CFG.max) : ids;
	return capped.map(id => {
		const a = maps.current.get(id), b = maps.ng.get(id);
		return { id, a: a ? grab(a) : null, b: b ? grab(b) : null };
	});
}

/* ---- drawing ---------------------------------------------------------- */

const NS = 'http://www.w3.org/2000/svg';
const WORD = { match: 'match', flag: 'differ', bad: 'missing' };

/* A seeded generator, so the wobble of a frame is a property of the object and
 * not of when it was drawn: both panes agree, and a second take of the same
 * page looks like the first. */
function rngFrom(seed) {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
	return () => {
		h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
		return ((h >>> 0) % 100000) / 100000;
	};
}

/* Four corners, each knocked about a little, and every edge bowed — a box
 * marked by hand rather than printed. Corners stay corners (miter joins). */
function roughPath(x0, y0, x1, y1, rnd, amp) {
	const j = () => (rnd() - 0.5) * 2 * amp;
	const c = [[x0 + j(), y0 + j()], [x1 + j(), y0 + j()], [x1 + j(), y1 + j()], [x0 + j(), y1 + j()]];
	const pts = [];
	const edge = (a, b, nx, ny) => {
		const N = 4;
		for (let i = 0; i < N; i++) {
			const t = i / N;
			const bow = (rnd() - 0.5) * 1.4 * amp * Math.sin(Math.PI * t);	// 0 at the corners, most mid-edge
			pts.push([a[0] + (b[0] - a[0]) * t + nx * bow, a[1] + (b[1] - a[1]) * t + ny * bow]);
		}
	};
	edge(c[0], c[1], 0, 1);
	edge(c[1], c[2], 1, 0);
	edge(c[2], c[3], 0, -1);
	edge(c[3], c[0], -1, 0);
	return 'M' + pts.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z';
}

/* The frame, sized and placed so its stroke falls entirely OUTSIDE the
 * object's bounds: the path runs 0.8 of a stroke-width away, so at the pulse's
 * peak the thickened stroke closes on the object and never crosses it. */
function frameFor(w, h, sw, seed) {
	const P = Math.ceil(sw * 2);
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('class', 'frame');
	svg.style.left = -P + 'px';
	svg.style.top = -P + 'px';
	svg.style.width = (w + 2 * P) + 'px';
	svg.style.height = (h + 2 * P) + 'px';
	const off = sw * 0.8;
	const path = document.createElementNS(NS, 'path');
	path.setAttribute('d', roughPath(P - off, P - off, P + w + off, P + h + off, rngFrom(seed), Math.min(2.5, sw * 0.4)));
	svg.appendChild(path);
	return svg;
}

function fitScale() {
	const w = PANES.ng.viewport.clientWidth || 1;
	const widest = Math.max(...SIDES.map(s => PANES[s].docW || 320));
	const k = CFG.k > 0 ? CFG.k : Math.min(1, w / widest);
	// ?fit=1 scales the page to the pane in BOTH directions, so no part of it is
	// ever cut off and the pane's height is what decides how large the page is —
	// which is the only thing that makes a taller pane worth having. Without it
	// the page is scaled to the pane's width alone, and in a stacked pane that is
	// as wide as the window the page renders several times the pane's height: at
	// 1280 wide a 1600x1368 page is 1094px tall and a 337px pane shows its top
	// 31%, whether the pane takes half the stage or two thirds of it. One k for
	// both panes (the larger of the two), or the engines would render at
	// different scales and the comparison would be between two sizes.
	if (!CFG.fit || CFG.k > 0) return k;
	const h = PANES.ng.viewport.clientHeight || 1;
	const tallest = Math.max(...SIDES.map(s => PANES[s].docH || 320));
	return Math.min(k, h / tallest);
}

function layoutPanes() {
	const k = fitScale();
	// The viewport size is measured once for both panes: they differ by the 1px
	// divider in stacked mode, and centring each page on its own height would put
	// the two panes a pixel apart from each other.
	const w = PANES.current.viewport.clientWidth || 1;
	const h = PANES.current.viewport.clientHeight || 1;
	for (const side of SIDES) {
		const pane = PANES[side];
		pane.k = k;
		pane.offX = Math.max(0, (w - pane.docW * k) / 2);
		// Only ?fit=1 centres vertically: a half-height page on the established
		// layouts sits at the top of its pane, and moving it now would change
		// every run's framing to fix something nobody reported.
		pane.offY = CFG.fit ? Math.max(0, (h - pane.docH * k) / 2) : 0;
		pane.el.style.width = pane.docW + 'px';
		pane.el.style.height = pane.docH + 'px';
		pane.el.style.left = pane.offX + 'px';
		pane.el.style.top = pane.offY + 'px';
		pane.el.style.transform = 'scale(' + k + ')';
		pane.ov.style.left = pane.offX + 'px';
		pane.ov.style.top = pane.offY + 'px';
		pane.ov.style.width = (pane.docW * k) + 'px';
		pane.ov.style.height = (pane.docH * k) + 'px';
	}
}

function boxFor(side, item) {
	const pane = PANES[side];
	const rec = side === 'current' ? item.a : item.b;
	const box = document.createElement('div');
	box.className = 'box';
	if (!rec) {
		// nothing to place a box on — a marker in the pane's corner instead
		const n = pane.viewport.querySelectorAll('.box.missing').length;
		box.classList.add('bad', 'missing');
		box.style.bottom = (10 + n * 28) + 'px';
		box.textContent = 'object missing here';
		pane.viewport.appendChild(box);
		return box;
	}
	const w = rec.rect.width * pane.k, h = rec.rect.height * pane.k;
	const sw = Math.max(5, Math.min(9, Math.round(Math.min(w, h) * 0.1)));
	// the stroke is drawn outside the object, so it can only be as thick as the
	// object can carry — 5px on a one-line text object, 9px on a hero image.
	// Both are thick enough to survive a phone-sized screencast.
	box.style.setProperty('--stroke', sw + 'px');
	box.style.left = (rec.rect.left * pane.k) + 'px';
	box.style.top = (rec.rect.top * pane.k) + 'px';
	box.style.width = w + 'px';
	box.style.height = h + 'px';
	box.appendChild(frameFor(w, h, sw, item.id));
	// the scan pass runs inside the object, clipped to its bounds: a wrapper,
	// because overflow on the bar itself would not clip its own transform
	const scan = document.createElement('div');
	const bar = document.createElement('div');
	scan.className = 'scan';
	bar.className = 'bar';
	scan.appendChild(bar);
	box.appendChild(scan);
	pane.ov.appendChild(box);
	return box;
}

const HEADROOM = 52;	// dark matte above the page, so the top object's badge isn't clipped

function scrollTo(item) {
	const pane = PANES.ng;
	const rec = item.b || item.a;
	if (!rec) return;
	const h = pane.viewport.clientHeight;
	const max = Math.max(0, pane.docH * pane.k - h);
	// ?fit=1: the whole page is already inside the pane, so there is nothing to
	// scroll to — and the headroom offset would push the page's bottom back out
	// of the pane it only just fits into.
	const y = CFG.fit ? 0 : Math.min(max, Math.max(-HEADROOM, rec.rect.top * pane.k - h * 0.34));
	for (const side of SIDES) {
		PANES[side].scroller.style.transform = 'translate3d(0,' + (-y) + 'px,0)';
	}
}

function tally() {
	const ok = view.findings.filter(x => x && x.verdict === 'match').length;
	const bad = view.ticked - ok;
	$('#tally').innerHTML = '<span class="ok">' + ok + '</span> ok / <span class="bad">' + bad + '</span> differ / <span class="total">' + view.seq.length + '</span>';
}

function tick(i) {
	if (!view.seq.length) return;
	if (i >= view.seq.length) return finishPage();
	if (i < view.ticked) return;			// already shown (resume / step guard)

	const item = view.seq[i];
	const verdict = compare(item.a, item.b);
	view.findings[i] = { id: item.id, module: (item.b || item.a || {}).module || '?', verdict: verdict.verdict, partial: !!verdict.partial, diffs: verdict.diffs };
	view.ticked = i + 1;

	for (const b of drawn) { b.el.classList.remove('now'); b.el.classList.add('on'); }
	for (const side of SIDES) {
		const el = boxFor(side, item);
		el.classList.add('now');
		// a box with no object behind it carries its own label — leave it alone
		if (!el.classList.contains('missing')) {
			if (verdict.verdict !== 'match') el.classList.add(verdict.verdict);
			const word = WORD[verdict.verdict] || 'match';
			const v = document.createElement('span');
			v.className = 'verdict';
			v.textContent = word;
			el.appendChild(v);
			// The word has to read as belonging to this object, so it has to fit
			// inside the frame it is reporting on: as tall as the object can carry,
			// but only as wide as the object is ('match' is a lot wider than the
			// tick that used to sit here). Measured: the plate is 4.46em wide for
			// 'match' — ~0.70em per bold character plus the padding — so budget a
			// little over that and let the height cap do the rest.
			const bw = parseFloat(el.style.width), bh = parseFloat(el.style.height);
			const fit = Math.min(bh * 0.42, bw / (word.length * 0.72 + 1.0));
			v.style.fontSize = Math.round(Math.max(12, Math.min(54, fit))) + 'px';
		}
		drawn.push({ side, el });
	}
	// How long the object's scan takes is a property of the object rather than
	// of the clock — somewhere between a fifth and four fifths of a second, so
	// the machine reads as a machine and not as a metronome. Seeded, like the
	// frame's wobble, so a second take of the page is the same take; and never
	// longer than the object's turn on the stage, or a fast montage would cut
	// the bar off mid-object. Each tick builds fresh boxes, so the bars animate
	// from the start without anyone having to restart them.
	const scan = Math.min(view.beat || Infinity,
		CFG.scanMin + (CFG.scanMax - CFG.scanMin) * rngFrom(item.id + ':scan')());
	document.documentElement.style.setProperty('--scan', Math.round(scan) + 'ms');
	scrollTo(item);
	tally();
	setStatus(view.page + '  ·  object ' + (i + 1) + '/' + view.seq.length + (verdict.diffs.length ? '  ·  ' + clip(verdict.diffs.join('; '), 46) : ''));
}

function finishPage() {
	clock.stop();
	playBtn(false);
	for (const side of SIDES) PANES[side].pane.classList.add('done');
	const bad = view.findings.filter(f => f && f.verdict !== 'match').length;
	setStatus(view.page + '  ·  ' + (bad ? bad + ' object(s) differ' : 'all ' + view.seq.length + ' objects match'));
	if (!CFG.single) advance();
}

/* ---- page flow -------------------------------------------------------- */

function setStatus(s) { $('#status').textContent = s; }

/* Where a run goes next. One place decides it, so the end of a page, the skip
   over an empty one and the Next/Prev buttons cannot disagree about where the
   run ends; with ?loop=1 there is no end and it comes round to the first page. */
const wrap = i => CFG.loop
	? (i + CFG.pages.length) % CFG.pages.length
	: Math.max(0, Math.min(CFG.pages.length - 1, i));

function advance(delay = CFG.hold) {
	const from = view.pageIndex;
	setTimeout(() => {
		if (view.pageIndex !== from) return;		// the run moved on while we waited
		const next = wrap(from + 1);
		if (next === from && !CFG.loop) return;		// the last page, and no looping: stop here
		showPage(next, CFG.autoplay);
	}, delay);
}

/* Every page the content tree holds, from the engine's own pagenames service
   (module_glue) rather than from a list kept here. The referer is suppressed on
   purpose: the parity copies pin BASE_URL relative, so the engine's xsrf check
   rejects any request that carries one — and skips the check entirely when there
   is none. Read-only and unauthenticated, so it works from the stage as it is. */
async function allPagenames() {
	const r = await fetch(MOUNT.current + 'json.php', {
		method: 'POST',
		referrerPolicy: 'no-referrer',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'method=' + encodeURIComponent('"glue.pagenames"'),
	});
	const j = await r.json();
	const list = j && j['#data'];
	if (!Array.isArray(list) || !list.length) throw new Error('the engine listed no pages');
	return list;
}

/* Which live site a page was copied from — window.SITES, generated out of the
   copy manifest by make-sites.sh, because the site cannot be read off the page
   name (see that file's header). Unknown page or absent map: no host, and the
   badge falls back to the engine word alone rather than inventing one. */
function hostOf(page) {
	const site = window.SITES && window.SITES[page];
	return site ? site + '.hotglue.me' : '';
}

/* The panes hold different pages only in control mode (?vs=), and there each
   badge has to name its own page's site — one shared host would be a lie about
   exactly the thing being tested. */
function labelHosts(page, vsPage) {
	for (const side of SIDES) {
		PANES[side].pane.querySelector('.pane-label .host').textContent =
			hostOf(side === 'ng' ? vsPage : page);
	}
}

async function showPage(index, play) {
	clock.stop();
	playBtn(false);
	const page = CFG.pages[index];
	view = { page, pageIndex: index, seq: [], findings: [], ticked: 0 };
	drawn = [];
	for (const side of SIDES) {
		PANES[side].ov.innerHTML = '';
		[...PANES[side].viewport.querySelectorAll('.box.missing')].forEach(e => e.remove());
		PANES[side].pane.classList.remove('done', 'missing');
	}
	$('#pagename').textContent = page;
	document.title = 'parity stage — ' + page;
	setStatus('loading ' + page + '…');
	tally();

	const vsPage = CFG.vs || page;
	PANES.ng.pane.querySelector('.pane-label .side').textContent = CFG.vs ? 'ng — ' + CFG.vs : 'ng';
	labelHosts(page, vsPage);
	await Promise.all([loadPane(PANES.current, page), loadPane(PANES.ng, vsPage)]);

	for (const side of SIDES) {
		const m = measure(PANES[side]);
		const pane = PANES[side];
		pane.doc = m ? m.doc : null;
		pane.docW = m ? m.w : 320;
		pane.docH = m ? m.h : 240;
		if (m && m.missing) pane.pane.classList.add('missing');
	}
	// before layoutPanes: the pane's shape decides the scale, and the iframes are
	// sized from the shape they are about to have
	if (CFG.layout === 'auto') autoLayout();
	layoutPanes();
	view.seq = buildSequence();
	view.findings = new Array(view.seq.length);

	if (!view.seq.length) {
		setStatus(page + '  ·  no objects on the page');
		if (!CFG.single) advance();
		return;
	}
	// the frame's three pulses ARE the beat: their length, and the moment the
	// verdict lands on the last of them, follow the tick interval — so ?ms= and
	// ?speedup= keep the picture and the clock together
	const beat = Math.max(CFG.floor, CFG.interval / Math.pow(CFG.speedup, index));
	view.beat = beat;
	clock.period = beat / 1000;
	document.documentElement.style.setProperty('--pulse', (beat / 3) + 'ms');
	document.documentElement.style.setProperty('--late', (beat * 2 / 3) + 'ms');
	setStatus(page + '  ·  ' + view.seq.length + ' objects' + (play ? '' : '  ·  press Play'));
	if (play) clock.start(i => tick(i), 0);
	playBtn(!!play);
}

/* ---- playback control ------------------------------------------------- */

function playBtn(on) {
	const b = $('#play');
	if (!b) return;
	b.setAttribute('aria-pressed', on ? 'true' : 'false');
	b.textContent = on ? 'Pause' : 'Play';
}

function playPause(force) {
	if (!view.seq.length) return;
	const want = (force === undefined) ? !clock.running : force;
	if (want) {
		audio.resume();
		clock.start(i => tick(i), view.ticked);
	} else {
		clock.stop();
	}
	playBtn(want);
}

/* ---- export ----------------------------------------------------------- */

function exportFindings() {
	const out = {
		generated: new Date().toISOString(),
		page: view.page,
		objects: view.findings.filter(Boolean),
	};
	const blob = new Blob([JSON.stringify(out, null, '\t')], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = 'parity-stage-' + (out.page || 'page') + '.json';
	a.click();
	URL.revokeObjectURL(a.href);
}

/* ---- recording -------------------------------------------------------- */

let recorder = null, recStream = null;

async function toggleRecord() {
	const btn = $('#record');
	if (recorder) { recorder.stop(); return; }
	if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
		setStatus('this browser cannot record — record the window with OBS instead');
		return;
	}
	try {
		recStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: true });
	} catch (e) {
		setStatus('recording cancelled');
		return;
	}
	const tracks = [...recStream.getVideoTracks()];
	if (audio.dest) tracks.push(...audio.dest.stream.getAudioTracks());
	const mixed = new MediaStream(tracks);
	recorder = new MediaRecorder(mixed, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 12e6 });
	const chunks = [];
	recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
	recorder.onstop = () => {
		const blob = new Blob(chunks, { type: 'video/webm' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'hotglue-parity-' + Date.now() + '.webm';
		a.click();
		URL.revokeObjectURL(a.href);
		recStream.getTracks().forEach(t => t.stop());
		recorder = null;
		btn.setAttribute('aria-pressed', 'false');
		btn.textContent = 'Record';
		setStatus('recording saved');
	};
	recorder.start(1000);
	btn.setAttribute('aria-pressed', 'true');
	btn.textContent = 'Stop';
	setStatus('recording — share this window (leave “share tab audio” off when the click track is on)');
}

/* ---- controls --------------------------------------------------------- */

function setLayout(mode) {
	CFG.layout = mode;			/* choosing a layout by hand ends ?layout=auto */
	applyLayout(mode);
}

function applyLayout(mode) {
	const stage = $('#stage');
	stage.dataset.layout = mode;
	stage.style.setProperty('--stackh', CFG.stackh);	/* read by the stacked rules in stage.css */
	$('#layout').setAttribute('aria-pressed', mode === 'stack' ? 'true' : 'false');
	if (view.seq.length) requestAnimationFrame(layoutPanes);
}

/* ?layout=auto: the panes take the shape of the page rather than the page being
   forced into one shape for the whole run — a page wider than tall goes stacked,
   a taller one keeps the portrait panes side-by-side.
   The test is the page's own shape, not the stage's aspect. Keying it to the
   stage (at which the two layouts are equally unlike the page, and are the same
   size under ?fit=1 — 1.9:1 on a 1280x720 window) sounds better and reads
   worse: it meant only pages wider than a letterbox stacked at all, one of the
   eight sampled off the corpus, and "stacked never kicks in" is the verdict on
   that. Page shape is also the thing you can see and predict. Both engines must
   agree on a layout, so the decision uses the larger of the two documents
   rather than one pane's. */
function autoLayout() {
	const w = Math.max(...SIDES.map(s => PANES[s].docW || 320));
	const h = Math.max(...SIDES.map(s => PANES[s].docH || 320));
	applyLayout(w > h ? 'stack' : 'side');
}

async function init() {
	if (CFG.all) {
		setStatus('asking the engine for the page list…');
		try {
			CFG.pages = await allPagenames();
		} catch (e) {
			// Not a fallback to the default six: silently testing six pages when
			// the run asked for all of them is the one outcome worth refusing.
			setStatus('could not list the pages — ' + e.message);
			return;
		}
	}
	// ?shuffle=1: the list the engine hands back is alphabetical, so a run always
	// shows the same sites in the same order and fronts one account's pages in a
	// block. Fisher-Yates once, at the start — ?loop=1 then replays that same
	// order, which is what a second lap of one run should be.
	if (CFG.shuffle) {
		for (let i = CFG.pages.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[CFG.pages[i], CFG.pages[j]] = [CFG.pages[j], CFG.pages[i]];
		}
	}

	const actions = {
		play: () => playPause(),
		step: () => tick(view.ticked),
		next: () => showPage(wrap(view.pageIndex + 1), CFG.autoplay),
		prev: () => showPage(wrap(view.pageIndex - 1), CFG.autoplay),
		layout: () => setLayout($('#stage').dataset.layout === 'stack' ? 'side' : 'stack'),
		interactive: () => {
			document.body.classList.toggle('interactive');
			const on = document.body.classList.contains('interactive');
			$('#interactive').setAttribute('aria-pressed', on ? 'true' : 'false');
		},
		record: () => toggleRecord(),
		export: () => exportFindings(),
	};
	for (const [act, fn] of Object.entries(actions)) {
		const b = document.querySelector('[data-act="' + act + '"]');
		if (b) { b.id = act; b.addEventListener('click', fn); }
	}

	// ?autoplay=1 is an unattended run: play/pause, step and prev/next page are
	// manual transport, and in a recording they are four buttons nobody is going
	// to press. Hidden rather than removed — the handlers and the play label stay
	// where they are, and the keyboard (space, arrows, n/p) still drives a run
	// that a human is watching after all.
	if (CFG.autoplay) {
		for (const act of ['play', 'step', 'prev', 'next']) {
			const b = document.querySelector('[data-act="' + act + '"]');
			if (b) b.hidden = true;
		}
	}

	if (CFG.audio) {
		audio.on = audio.init();
		if (!audio.on) setStatus('no web audio here — falling back to a plain clock');
	}
	// ?layout=auto starts side-by-side and lets the first page decide (showPage);
	// going through applyLayout leaves CFG.layout alone, which is what keeps the
	// run in auto — setLayout here would read as a manual choice of 'side'.
	applyLayout(CFG.layout === 'stack' ? 'stack' : 'side');

	addEventListener('keydown', e => {
		if (e.target.tagName === 'INPUT') return;
		if (e.code === 'Space') { e.preventDefault(); playPause(); }
		else if (e.code === 'ArrowRight') actions.step();
		else if (e.code === 'ArrowLeft') actions.prev();
		else if (e.key === 'n') actions.next();
		else if (e.key === 'p') actions.prev();
		else if (e.key === 'l') actions.layout();
		else if (e.key === 'i') actions.interactive();
		else if (e.key === 'r') toggleRecord();
		else if (e.key === 'e') exportFindings();
	});
	addEventListener('resize', () => { if (view.seq.length) layoutPanes(); });

	// console handle: inspecting a page's per-object findings by hand is the
	// triage half of this tool (window.stage.findings())
	window.stage = {
		CFG, showPage, tick, playPause, setLayout,
		findings: () => (view.findings.filter(Boolean)),
	};

	showPage(0, CFG.autoplay);
}

init();
