/**
 *	modules/user_code/user_code-edit.js
 *	Frontend code linking user code editor to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var elem = $.glue.icon('code-page', 'add custom JavaScript code and CSS definitions');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		// a new tab, so the page being worked on stays behind (danja's
		// call, 2026-09-24) - the click is a user gesture, so no popup
		// blocker applies
		window.open($.glue.base_url+'?'+$.glue.page+'/code', '_blank');
	});
	$.glue.menu.register('page', elem, 6);
});


/*
 *	Per-object code: the "code" panel of an object.
 *
 *	The author writes CSS and JavaScript "for this object" in two text areas.
 *	They are stored in a separate object next to it, as <style> and <script>
 *	blocks (see module_user_code.inc.php), and applied by the server when the
 *	page is rendered: the CSS confined to the object by its id, the script
 *	wrapped to run once the page is loaded and handed the object as el. The
 *	object's own file is never touched.
 *
 *	The panel has no OK: what is in it is saved a moment after typing stops,
 *	when a field is left, and when the panel closes by any door. A panel's
 *	close() removes it, and a removed field's blur is not reliable across
 *	browsers (see POPOUT-PANELS.md), so the closing save reads the fields
 *	itself through pop.on_close.
 */

// the author's input, cut back into its two parts
function user_code_split(raw)
{
	var parts = { style: [], script: [] };
	['style', 'script'].forEach(function(tag) {
		var re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '\\s*>', 'gi');
		var m;
		while ((m = re.exec(raw)) !== null) {
			parts[tag].push(m[1].replace(/^\n+/, '').replace(/\s+$/, ''));
		}
	});
	return { style: parts.style.join('\n'), script: parts.script.join('\n') };
}

// the two parts, put back together the way they are stored
function user_code_join(style, script)
{
	var out = [];
	if (style.trim() !== '') {
		out.push('<style>\n' + style.replace(/^\n+/, '').replace(/\s+$/, '') + '\n</style>');
	}
	if (script.trim() !== '') {
		out.push('<script>\n' + script.replace(/^\n+/, '').replace(/\s+$/, '') + '\n</script>');
	}
	return out.join('\n');
}

// Swap the object's stylesheet in the head for the new one, so the page shows
// the change now. The server marked the one it rendered with the object's id.
function user_code_apply_css(name, css)
{
	var el = null;
	document.querySelectorAll('style[data-glue-code]').forEach(function(s) {
		if (s.getAttribute('data-glue-code') === name) {
			el = s;
		}
	});
	if (!css) {
		if (el) {
			el.remove();
		}
		return;
	}
	if (!el) {
		el = document.createElement('style');
		el.setAttribute('data-glue-code', name);
		document.head.appendChild(el);
	}
	el.textContent = '\n' + css + '\n';
}

// Examples the author can insert from the panel. Each is a style, a script or
// both, and explains itself in a comment, so a snippet is something to read as
// well as to run. Written for how code reaches the page (see the notes above
// and in module_user_code.inc.php): the CSS is confined to the object, "&" is
// the object itself, a declaration with no selector applies to it, and what
// hotglue sets inline needs !important; the script is handed the object as el.
//
// Two rules for what goes in here, both learnt from how an object is saved: a
// script must not write the object's left, top, width or height (the editor
// saves what it finds, so an animation that wrote them would be stored where
// it happened to be stopped), and so the movers use the Web Animations API or
// the translate property, neither of which hotglue keeps. And keyframe names
// are global to the page, so the ones here carry an ex- prefix.
var USER_CODE_EXAMPLES = [
	{
		name: 'fade when the pointer is over it',
		style: '/* Fade this object while the pointer is over it. & is the object itself. */\n'
			+ '& { transition: opacity .3s; }\n'
			+ '&:hover { opacity: .4 !important; }'
	},
	{
		name: 'spin',
		style: '/* Turn once every six seconds. Keyframe names are shared by the whole\n'
			+ '   page, so give yours a name nobody else will use. */\n'
			+ '@keyframes ex-spin { to { transform: rotate(360deg); } }\n'
			+ '& { animation: ex-spin 6s linear infinite; }'
	},
	{
		name: 'orbit in a circle',
		style: '/* Go round in a circle of 60px radius, keeping upright. */\n'
			+ '@keyframes ex-orbit {\n'
			+ '  from { transform: rotate(0deg) translateX(60px) rotate(0deg); }\n'
			+ '  to   { transform: rotate(360deg) translateX(60px) rotate(-360deg); }\n'
			+ '}\n'
			+ '& { animation: ex-orbit 4s linear infinite; }'
	},
	{
		name: 'cycle through blend modes',
		style: '/* Go through four blend modes while the colour fades round. mix-blend-mode\n'
			+ '   cannot be tweened, so its animation uses step-end to hold each mode until\n'
			+ '   the next keyframe; the colour has an animation of its own, to fade. There\n'
			+ '   has to be something behind the object to blend with. */\n'
			+ '@keyframes ex-modes {\n'
			+ '  0%   { mix-blend-mode: multiply; }\n'
			+ '  25%  { mix-blend-mode: screen; }\n'
			+ '  50%  { mix-blend-mode: difference; }\n'
			+ '  75%  { mix-blend-mode: overlay; }\n'
			+ '  100% { mix-blend-mode: multiply; }\n'
			+ '}\n'
			+ '@keyframes ex-tint {\n'
			+ '  0%, 100% { background-color: #ff4d4d; }\n'
			+ '  33%      { background-color: #4d9fff; }\n'
			+ '  66%      { background-color: #ffd24d; }\n'
			+ '}\n'
			+ '& { animation: ex-modes 8s step-end infinite, ex-tint 8s linear infinite; }'
	},
	{
		name: 'breathe: grow and shrink by 20px, staying centred',
		script: '// Grow by 20px in both directions and back. The size grows by 20 and the\n'
			+ '// corner moves by 10, which is what keeps the middle where it is. Read from\n'
			+ '// the object as it is, so it follows the object when you move or resize it.\n'
			+ '// el.animate() draws the change without writing it into the object.\n'
			+ 'var cs = getComputedStyle(el);\n'
			+ 'var l = parseFloat(cs.left), t = parseFloat(cs.top);\n'
			+ 'var w = parseFloat(cs.width), h = parseFloat(cs.height);\n'
			+ 'el.animate([\n'
			+ '  { left: l + "px", top: t + "px", width: w + "px", height: h + "px" },\n'
			+ '  { left: (l - 10) + "px", top: (t - 10) + "px", width: (w + 20) + "px", height: (h + 20) + "px" }\n'
			+ '], { duration: 1000, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });'
	},
	{
		name: 'switch a class on and off by clicking',
		style: '/* "&" is the object itself: this applies while it has the class "on".\n'
			+ '   !important is what lets it beat the colours hotglue sets on the object. */\n'
			+ '& { transition: background .3s; }\n'
			+ '&.on { background: gold !important; }',
		script: '// Click the object to put the class "on" on it, and again to take it off.\n'
			+ 'el.addEventListener("click", function() {\n'
			+ '  el.classList.toggle("on");\n'
			+ '});'
	},
	{
		name: 'wander about at random',
		style: '/* Move smoothly to wherever the script sends it. translate is an offset\n'
			+ '   on top of the object\'s position, so the position itself is never touched. */\n'
			+ '& { transition: translate 1.5s ease-in-out; }',
		script: '// Every two seconds, drift to a random spot within 100px of where it is.\n'
			+ 'setInterval(function() {\n'
			+ '  var x = Math.round((Math.random() - .5) * 200);\n'
			+ '  var y = Math.round((Math.random() - .5) * 200);\n'
			+ '  el.style.translate = x + "px " + y + "px";\n'
			+ '}, 2000);'
	}
];

// put an example into the fields: added after what is there, never over it
function user_code_insert_example(example, style, script)
{
	var add = function(field, text) {
		if (!text) {
			return;
		}
		field.value = field.value.replace(/\s+$/, '');
		field.value += (field.value === '' ? '' : '\n\n') + text;
		field.dispatchEvent(new Event('input', { bubbles: true }));
	};
	add(style, example.style);
	add(script, example.script);
}

function user_code_object_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-code-popover');
	if (!pop) {
		return;
	}
	var name = obj.id;
	$.glue.backend({ method: 'user_code.get_object_code', name: name }, function(data) {
		if (data['#error']) {
			$.glue.error(data['#error']);
			return;
		}
		var parts = user_code_split(data['#data'] || '');

		var field = function(label, hint, value, rows, help) {
			var wrap = document.createElement('div');
			wrap.className = 'glue-code-field';
			var l = document.createElement('div');
			l.className = 'glue-code-label';
			l.textContent = label;
			var h = document.createElement('span');
			h.className = 'glue-code-hint';
			h.textContent = hint;
			l.appendChild(h);
			var t = document.createElement('textarea');
			t.className = 'glue-code-input';
			t.rows = rows;
			t.value = value;
			t.spellcheck = false;
			t.setAttribute('wrap', 'off');
			t.setAttribute('autocapitalize', 'off');
			t.setAttribute('autocomplete', 'off');
			t.setAttribute('aria-label', label);
			wrap.appendChild(l);
			if (help) {
				var e = document.createElement('div');
				e.className = 'glue-code-help';
				e.textContent = help;
				wrap.appendChild(e);
			}
			wrap.appendChild(t);
			pop.appendChild(wrap);
			return t;
		};
		var style = field('style', 'CSS, for this object only', parts.style, 7,
			'& { } is the object itself, &.name { } the object when it has the class name; a plain .name { } is for something inside it.');
		style.placeholder = '& { background: gold !important; }\n&:hover { opacity: .8 }\n.inner { color: red }';
		var script = field('script', 'JavaScript; el is this object', parts.script, 8);
		script.placeholder = 'el.addEventListener("click", function() {\n\tel.classList.toggle("on");\n});';
		var examples = document.createElement('select');
		examples.className = 'glue-code-examples';
		examples.setAttribute('aria-label', 'insert an example');
		var first = document.createElement('option');
		first.value = '';
		first.textContent = 'insert an example\u2026';
		examples.appendChild(first);
		USER_CODE_EXAMPLES.forEach(function(example, i) {
			var o = document.createElement('option');
			o.value = String(i);
			o.textContent = example.name;
			examples.appendChild(o);
		});
		examples.addEventListener('change', function() {
			if (examples.value !== '') {
				var example = USER_CODE_EXAMPLES[parseInt(examples.value, 10)];
				user_code_insert_example(example, style, script);
				examples.value = '';
				// into the field it went to: the style, unless it is script only
				(example.style ? style : script).focus();
			}
		});
		pop.insertBefore(examples, pop.firstChild);
		var problem = document.createElement('div');
		problem.className = 'glue-code-problem';
		pop.appendChild(problem);
		var note = document.createElement('div');
		note.className = 'glue-code-note';
		note.textContent = 'The style is confined to this object. What hotglue sets on an object itself (its colours, size, border) is inline and wins unless you add !important. The script is not confined: it runs on the whole page, after it has loaded (reload to run a changed one), and is only handed this object as el. While the object is selected here, its animations and its setInterval, setTimeout and requestAnimationFrame stand still, so it can be edited.\nNot sure how to write one? Ask your favourite AI chat to make a CSS or JavaScript snippet for you.';
		pop.appendChild(note);

		var saved = user_code_join(parts.style, parts.script);
		var commit = function() {
			var code = user_code_join(style.value, script.value);
			// the same refusal the server makes, said before the trip: a
			// closing tag inside the block would end it there
			var bad = null;
			if (/<\/style/i.test(style.value)) {
				bad = 'the style contains a closing style tag - write <\\/style> instead';
			} else if (/<\/script/i.test(script.value)) {
				bad = 'the script contains a closing script tag - write <\\/script> instead';
			}
			problem.textContent = bad || '';
			if (bad || code === saved) {
				return;
			}
			saved = code;
			$.glue.backend({ method: 'user_code.set_object_code', name: name, code: code }, function(resp) {
				if (resp['#error']) {
					// try again on the next change
					saved = null;
					var msg = resp['#data'] || resp['#error'];
					if (document.contains(pop)) {
						problem.textContent = msg;
					} else {
						$.glue.error(msg);
					}
					return;
				}
				user_code_apply_css(name, (resp['#data'] && resp['#data'].css) || '');
			}, false);
		};
		var timer = null;
		[style, script].forEach(function(t) {
			t.addEventListener('input', function() {
				clearTimeout(timer);
				timer = setTimeout(commit, 800);
			});
			t.addEventListener('change', commit);
		});
		pop.on_close = function() {
			clearTimeout(timer);
			commit();
		};

		$.glue.popover.show(pop);
		style.focus();
	}, false);
}

document.addEventListener('DOMContentLoaded', function() {
	var elem = $.glue.icon('code-object', 'code for this object: CSS that applies to it alone, and JavaScript that is handed it');
	elem.addEventListener('click', function(e) {
		user_code_object_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('object', 'object-code', elem, 9);
});
