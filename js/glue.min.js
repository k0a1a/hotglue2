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
// pages that never load edit.js. jQuery's own .bind()-registered handlers
// still work unchanged and don't need touching: verified that a native
// dispatchEvent(CustomEvent) does reach jQuery .bind() handlers (jQuery
// wires those up via a real addEventListener), but jQuery's .live()
// delegation is entirely internal to jQuery and never sees natively-
// dispatched events - so .live() and .trigger() have to be replaced
// together, as two halves of the same mechanism
$.fn.glueLive = function(eventName, handler) {
	// relies on jQuery still tracking the selector used to build this
	// object (true through jQuery 1.x), same as .live() itself did
	var selector = this.selector;
	document.addEventListener(eventName, function(e) {
		var matched = $(e.target).closest(selector);
		if (matched.length) {
			// preserve .trigger(name, [extra, args]) => handler(e, extra, args)
			var args = [e];
			if (e.detail !== undefined && e.detail !== null) {
				args = args.concat(e.detail);
			}
			handler.apply(matched.get(0), args);
		}
	}, false);
	return this;
};

$.fn.glueTrigger = function(eventName, data) {
	this.each(function() {
		this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, cancelable: true, detail: data }));
	});
	return this;
};

// jQuery-free equivalents of the two above, for modules converted away from
// jQuery. Both mechanisms are just addEventListener/dispatchEvent under the
// hood, so old ($.fn.glueLive) and new ($.glue.live) listeners interoperate
// freely during the file-by-file jQuery removal - it doesn't matter which
// side registered the listener vs. which side dispatched the event.
$.glue.live = function(selector, eventName, handler) {
	document.addEventListener(eventName, function(e) {
		var matched = e.target.closest ? e.target.closest(selector) : null;
		if (matched) {
			var args = [e];
			if (e.detail !== undefined && e.detail !== null) {
				args = args.concat(e.detail);
			}
			handler.apply(matched, args);
		}
	}, false);
};

$.glue.trigger = function(target, eventName, data) {
	var elems;
	if (typeof target == 'string') {
		elems = document.querySelectorAll(target);
	} else if (target instanceof Element) {
		elems = [target];
	} else {
		// array-like (NodeList, Array, jQuery object)
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
	// accepts either a raw DOM element or a jQuery-wrapped one (not-yet-
	// converted callers still pass jQuery objects during the jQuery
	// removal), always returns a raw element
	if (elem.jquery) {
		elem = elem.get(0);
	}
	elem.setAttribute('x-data', '{ enabled: false }');
	elem.setAttribute('x-bind:class', "enabled ? 'glue-menu-enabled' : 'glue-menu-disabled'");
	elem.setAttribute('x-bind:title', 'enabled ? '+JSON.stringify(enabled_title)+' : '+JSON.stringify(disabled_title));
	elem.setAttribute('x-on:glue-menu-activate', sync_fn+'($el)');
	elem.setAttribute('x-on:click', toggle_fn+'($el)');
	return elem;
};
