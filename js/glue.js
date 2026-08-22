/**
 *	js/glue.js
 *	Auxiliary hotglue frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// create dummy console functions
if (!window.console) {
	console = {};
}
console.log = console.log || function(){};
console.error = console.error || function(){};
console.warn = console.warn || function(){};
console.info = console.info || function(){};

// $ used to be jQuery's global function, which also served as a convenient
// namespace object for $.glue.* (a common jQuery-plugin pattern). Now that
// jQuery is gone, define our own bare namespace object in its place - $ is
// never called as a function anywhere in this codebase, only used for
// property access ($.glue.*)
window.$ = window.$ || {};

$.glue = {};

// communication with the backend
$.glue.backend = function()
{
	return function(param, func, print_errors) {
		if (print_errors === undefined) {
			print_errors = true;
		}
		// make sure parameters are json encoded
		// otherwise we would get complaints from the php parser for empty
		// strings, arrays and thelike
		var body = new URLSearchParams();
		for (var p in param) {
			body.append(p, JSON.stringify(param[p]));
		}
		// ten seconds timeout
		var controller = new AbortController();
		var timeout = setTimeout(function() { controller.abort(); }, 10000);
		fetch($.glue.base_url+'json.php', {
			method: 'POST',
			body: body,
			signal: controller.signal
		}).then(function(response) {
			if (!response.ok) {
				throw new Error('status '+response.status);
			}
			return response.json();
		}).then(function(data) {
			if (data === null) {
				if (print_errors) {
					$.glue.error('There was a problem communicating with the server');
				} else if (typeof func == 'function') {
					func({ '#error': true, '#data':'There was a problem communicating with the server' });
				}
			} else if (print_errors) {
				if (data['#error']) {
					$.glue.error(data['#data']);
				} else if (typeof func == 'function') {
					func(data['#data']);
				}
			} else if (typeof func == 'function') {
				func(data);
			}
		}).catch(function(err) {
			if (err.name == 'AbortError') {
				// not really an error
				// these happen when navigating away while a request is in flight, or on timeout
				// see http://stackoverflow.com/questions/866771/jquery-ambiguous-ajax-error
			} else {
				$.glue.error('There was a problem communicating with the server ('+err.message+')');
			}
		}).finally(function() {
			clearTimeout(timeout);
		});
	};
}();

$.glue.error = function()
{
	return function(s) {
		if ($.glue.conf.show_frontend_errors) {
			alert('The glue gun manufacturer says: '+s);
		}
	};
}();

// native replacements for jQuery's deprecated .live()/.trigger(), used
// throughout for the glue-* custom event bus. Defined here rather than in
// edit.js since some modules using them (e.g. page_browser.js) load on
// pages that never load edit.js.
var live_handlers = {};

$.glue.live = function(selector, eventName, handler) {
	if (!live_handlers[eventName]) {
		live_handlers[eventName] = [];
		document.addEventListener(eventName, function(e) {
			// Resolve EVERY registered selector against the event target
			// before invoking any handler, then invoke. This is what jQuery's
			// delegation did - it walked target to root once, up front, and
			// built its handler queue from that - and code here depends on it.
			//
			// An earlier version registered a separate document listener per
			// live() call, so each one evaluated closest() at the moment it
			// ran and therefore saw class changes made by handlers that ran
			// before it, within the same dispatch. That broke text objects:
			// live('.object', 'click') in edit.js adds .glue-selected, and
			// live('.text.glue-selected', 'click') in text-edit.js then
			// matched the class that had just been added, so a FIRST click
			// went straight into text editing and shift-clicking a second
			// text object deselected the first - making multi-select of text
			// impossible. Covered by tests/e2e/text-selection.spec.js.
			//
			// Only one registered selector depends on mutable state
			// (.text.glue-selected); the rest are static classes and ids, so
			// this changes nothing else.
			var regs = live_handlers[eventName];
			var matched = [];
			for (var i=0; i < regs.length; i++) {
				var el = e.target.closest ? e.target.closest(regs[i].selector) : null;
				if (el) {
					matched.push({ elem: el, handler: regs[i].handler });
				}
			}
			var args = [e];
			if (e.detail !== undefined && e.detail !== null) {
				args = args.concat(e.detail);
			}
			// registration order, as before - the queue is fixed now, so a
			// handler registering another live() mid-dispatch cannot join it
			for (var j=0; j < matched.length; j++) {
				matched[j].handler.apply(matched[j].elem, args);
			}
		}, false);
	}
	live_handlers[eventName].push({ selector: selector, handler: handler });
};

$.glue.trigger = function(target, eventName, data) {
	var elems;
	if (typeof target == 'string') {
		elems = document.querySelectorAll(target);
	} else if (target instanceof Element) {
		elems = [target];
	} else {
		// array-like (NodeList, Array)
		elems = target;
	}
	for (var i=0; i<elems.length; i++) {
		elems[i].dispatchEvent(new CustomEvent(eventName, { bubbles: true, cancelable: true, detail: data }));
	}
};

// replaces the single .data('owner', obj) contract (set once in
// $.glue.contextmenu.show, read at ~50 call sites across most modules) -
// a WeakMap instead of jQuery .data() avoids the same clone()-hangs-on-
// circular-data-cache issue worked around for Moveable instances.
// elem is always a raw DOM element at every call site (event handler
// `this`, Alpine's $el, or a plain Element param), never a jQuery object.
$.glue.owner = function()
{
	var owners = new WeakMap();
	return function(elem, obj) {
		if (obj === undefined) {
			return owners.get(elem);
		} else {
			owners.set(elem, obj);
		}
	};
}();

// wires up the Alpine x-data/x-bind/x-on plumbing shared by the many
// "boolean toggle" context-menu icons (download-public, video-autoplay/
// -loop/-controls/-mute, webvideo-autoplay/-loop, ...): an icon that shows
// enabled/disabled via the glue-menu-enabled/glue-menu-disabled classes and
// a matching tooltip, synced on glue-menu-activate and flipped on click.
// sync_fn/toggle_fn are the names of globally-defined functions taking the
// icon element, since Alpine expressions are evaluated as strings and can't
// close over local function references directly
$.glue.toggle_button = function(elem, sync_fn, toggle_fn, enabled_title, disabled_title) {
	elem.setAttribute('x-data', '{ enabled: false }');
	elem.setAttribute('x-bind:class', "enabled ? 'glue-menu-enabled' : 'glue-menu-disabled'");
	elem.setAttribute('x-bind:title', 'enabled ? '+JSON.stringify(enabled_title)+' : '+JSON.stringify(disabled_title));
	elem.setAttribute('x-on:glue-menu-activate', sync_fn+'($el)');
	elem.setAttribute('x-on:click', toggle_fn+'($el)');
	return elem;
};
