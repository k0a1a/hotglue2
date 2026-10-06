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

		var field = function(label, hint, value, rows) {
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
			wrap.appendChild(t);
			pop.appendChild(wrap);
			return t;
		};
		var style = field('style', 'CSS, for this object only', parts.style, 7);
		style.placeholder = 'background: gold;\n:hover { opacity: .8 }\n.inner { color: red }';
		var script = field('script', 'JavaScript; el is this object', parts.script, 8);
		script.placeholder = 'el.addEventListener("click", function() {\n\tel.classList.toggle("on");\n});';
		var problem = document.createElement('div');
		problem.className = 'glue-code-problem';
		pop.appendChild(problem);
		var note = document.createElement('div');
		note.className = 'glue-code-note';
		note.textContent = 'The style is confined to this object. What hotglue sets on an object itself (its colours, size, border) is inline and wins unless you add !important. The script is not confined: it runs on the whole page, after it has loaded (reload to run a changed one), and is only handed this object as el.';
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
	$.glue.contextmenu.register('object', 'object-code', elem, 8);
});
