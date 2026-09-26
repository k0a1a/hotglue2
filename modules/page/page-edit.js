/**
 *	modules/page/page-edit.js
 *	Frontend code for general page properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// --- centered layout mode -------------------------------------------------
//
// The container is rendered server-side (module_page.inc.php,
// page_render_page_late) and objects live inside it with their coordinates
// untouched. What the editor adds is the two edge handles: they show where the
// container's boundary is while authoring, and dragging one sets its width.
//
// The container is centered, so moving one edge by dx changes the width by
// 2*dx - the opposite edge moves the same amount the other way.

function page_container_handles_update() {
	var wrap = $.glue.canvas.wrapper();
	var handles = document.querySelectorAll('.glue-container-handle');
	if (!wrap) {
		handles.forEach(function(h) { h.style.display = 'none'; });
		return;
	}
	var box = wrap.getBoundingClientRect();
	handles.forEach(function(h) {
		h.style.display = 'block';
		h.style.left = (h.dataset.edge == 'left' ? box.left : box.right) + 'px';
	});
}

function page_container_handle_make(edge) {
	var h = document.createElement('div');
	h.className = 'glue-container-handle glue-ui';
	h.dataset.edge = edge;
	h.title = 'drag to set how wide the centered container is';
	h.style.touchAction = 'none';
	h.addEventListener('pointerdown', function(e) {
		var wrap = $.glue.canvas.wrapper();
		if (!wrap) {
			return;
		}
		if (!e.isPrimary) {
			return;
		}
		e.preventDefault();
		var box = wrap.getBoundingClientRect();
		var centre = box.left + box.width/2;
		var min = $.glue.conf.page.container_min;
		var max = $.glue.conf.page.container_max;
		var width = box.width;

		function move(ev) {
			// centered: the distance from the centre IS half the width
			width = Math.round(Math.abs(ev.clientX - centre) * 2);
			width = Math.max(min, Math.min(max, width));
			wrap.style.width = width + 'px';
			page_container_handles_update();
			$.glue.grid.update();
		}
		function up() {
			document.removeEventListener('pointermove', move);
			document.removeEventListener('pointerup', up);
			document.removeEventListener('pointercancel', up);
			$.glue.backend({ method: 'page.set_layout', page: $.glue.page, width: width });
		}
		document.addEventListener('pointermove', move);
		document.addEventListener('pointerup', up);
		document.addEventListener('pointercancel', up);
	});
	document.body.appendChild(h);
	return h;
}

function page_layout_toggle() {
	var centered = !!$.glue.canvas.wrapper();
	$.glue.backend({
		method: 'page.set_layout',
		page: $.glue.page,
		mode: centered ? 'infinite' : 'centered'
	}, function(resp) {
		if (resp['#error']) {
			$.glue.error(resp['#data'] || resp['#error']);
			return;
		}
		// The container is part of the server-rendered markup, so reload rather
		// than rebuilding the DOM here - it keeps one definition of what each
		// mode renders as, instead of a second one in the editor that could
		// drift from it.
		window.location.reload();
	});
}

document.addEventListener('DOMContentLoaded', function() {
	// set grid (the page's own stored size, or the 100x100 default - the
	// server picks per page and pushes it here)
	$.glue.grid.x($.glue.conf.page.grid_x);
	$.glue.grid.y($.glue.conf.page.grid_y);

	// set guides
	for (i in $.glue.conf.page.guides_x) {
		$.glue.grid.add_guide_x($.glue.conf.page.guides_x[i]);
	}
	for (i in $.glue.conf.page.guides_y) {
		$.glue.grid.add_guide_y($.glue.conf.page.guides_y[i]);
	}

	//
	// register menu items
	//
	//
	// page settings: the page menu's page-level controls live here - title,
	// url, start page, delete - opened from the one menu button. The panel
	// opens anchored to the click, like the font popover.
	//
	var page_settings_popover = function() {
		var pop = $.glue.popover.open(document.documentElement, 'glue-page-settings-popover');
		if (!pop) {
			return;
		}

		// --- page title ---------------------------------------------------
		var row = $.glue.popover.row('page title');
		var title_field = document.createElement('input');
		title_field.type = 'text';
		title_field.className = 'glue-popover-field glue-page-title';
		title_field.value = document.title;
		title_field.title = 'the title shown in the browser tab and to search engines';
		// commit on change (blur or Enter), not per keystroke: the title is
		// an attribute of the page, not text being edited
		title_field.addEventListener('change', function() {
			var title = this.value.trim();
			if (title === document.title) {
				return;
			}
			document.title = title;
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-title': title });
		});
		row.appendChild(title_field);
		pop.appendChild(row);

		// --- page url -----------------------------------------------------
		row = $.glue.popover.row('page url');
		var url_field = document.createElement('input');
		url_field.type = 'text';
		url_field.className = 'glue-popover-field glue-page-url';
		url_field.value = $.glue.page.split('.').shift();
		url_field.title = 'the URL of this page';
		url_field.addEventListener('change', function() {
			var old_pn = $.glue.page.split('.').shift();
			var new_pn = this.value.trim();
			if (new_pn === old_pn) {
				return;
			}
			// check if the current page is also the starting page
			$.glue.backend({ method: 'glue.get_startpage' }, function(data) {
				var is_startpage = (data == $.glue.page);
				$.glue.backend({ method: 'glue.rename_page', 'old': old_pn, 'new': new_pn }, function(data) {
					if (is_startpage) {
						// change startpage accordingly
						$.glue.backend({ method: 'glue.set_startpage', page: new_pn+'.head' }, function(data) {
							// redirect to new url
							window.location = $.glue.base_url+'?'+new_pn+'/edit';
						});
					} else {
						// redirect to new url
						window.location = $.glue.base_url+'?'+new_pn+'/edit';
					}
				});
			});
		});
		row.appendChild(url_field);
		pop.appendChild(row);

		// --- start page ---------------------------------------------------
		row = $.glue.popover.row('start page');
		var start_check = document.createElement('input');
		start_check.type = 'checkbox';
		start_check.title = 'make this the page visitors land on';
		// sync with reality when the panel opens
		$.glue.backend({ method: 'glue.get_startpage' }, function(data) {
			start_check.checked = (data == $.glue.page);
		});
		start_check.addEventListener('change', function() {
			// an empty value clears the startpage - get_startpage then
			// falls back to the default page
			$.glue.backend({ method: 'glue.set_startpage',
				page: this.checked ? $.glue.page : '' });
		});
		row.appendChild(start_check);
		pop.appendChild(row);

		// --- password protection -------------------------------------------
		// per-page password (SOW-page-password.md): the field sets or
		// changes it, the button clears it when the page is protected.
		// The hashing happens server-side (page.set_password), the client
		// never sees the hash.
		row = $.glue.popover.row('password');
		var pw_field = document.createElement('input');
		pw_field.type = 'password';
		pw_field.className = 'glue-popover-field glue-page-password';
		pw_field.autocomplete = 'new-password';
		pw_field.title = 'protect this page with a password';
		var pw_btn = document.createElement('div');
		pw_btn.className = 'glue-popover-reset';
		pw_btn.title = 'protect this page with a password';
		var pw_sync = function(protected_) {
			pw_field.value = '';
			if (protected_) {
				pw_field.placeholder = 'page is protected';
				pw_btn.textContent = 'clear';
				pw_btn.title = 'remove the password';
			} else {
				pw_field.placeholder = 'set a password';
				pw_btn.textContent = 'set';
				pw_btn.title = 'protect this page with a password';
			}
		};
		var pw_commit = function() {
			var pw = pw_btn.textContent == 'clear' ? '' : pw_field.value;
			if (pw_btn.textContent != 'clear' && pw === '') {
				return;
			}
			$.glue.backend({ method: 'page.set_password', 'page': $.glue.page, 'password': pw }, function(data) {
				pw_sync(data === true);
			});
		};
		pw_btn.addEventListener('click', pw_commit);
		pw_field.addEventListener('keydown', function(e) {
			if (e.key == 'Enter') {
				pw_commit();
			}
		});
		row.appendChild(pw_field);
		row.appendChild(pw_btn);
		// sync with reality when the panel opens
		$.glue.backend({ method: 'glue.load_object', name: $.glue.page+'.page' }, function(data) {
			pw_sync(!!(data && data['page-password']));
		});
		pop.appendChild(row);

		// --- delete page --------------------------------------------------
		var footer = $.glue.popover.row(false);
		footer.appendChild($.glue.popover.delete('delete this page and all its revisions', function() {
			if (!confirm('Really delete the current page and all its revisions?')) {
				return;
			}
			var pn = $.glue.page.split('.').shift();
			var pages = [];
			// get all revisions
			$.glue.backend({ method: 'glue.revisions', pagename: pn }, function(data) {
				for (var rev in data) {
					pages.push(pn+'.'+data[rev]);
				}
				// and delete them
				for (var page in pages) {
					// DEBUG
					//console.log('deleting '+pages[page]);
					$.glue.backend({ method: 'glue.delete_page', 'page': pages[page] });
				}
				// TODO (later): check if all revisions were indeed deleted
				// redirect to "pages" controller
				window.location = $.glue.base_url+'?pages';
			});
		}));
		pop.appendChild(footer);

		$.glue.popover.show(pop);
	};

	var elem = $.glue.icon('page-title', 'page options: change title of the page, URL, make it a start page, or delete it');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		page_settings_popover();
	});
	$.glue.menu.register('page', elem, 3);

	// reading order (SOW-accessibility.md, Feature 2): the sequence screen
	// readers follow. The server emits objects in visual reading order by
	// default; this panel stores an explicit one for pages where position
	// isn't reading order. Moving an element in the DOM here is the editing
	// gesture - the objects are absolutely positioned, so the visual layout
	// does not move, and the stored order takes effect on the next render.
	var page_reading_order_popover = function() {
		var pop = $.glue.popover.open(document.documentElement, 'glue-reading-order-popover');
		if (!pop) {
			return;
		}

		var note = document.createElement('div');
		note.className = 'glue-popover-note';
		note.textContent = 'the order screen readers follow - top to bottom by position, unless you set one here';
		pop.appendChild(note);

		// one row per object, in DOM order - which IS the current reading
		// order, since the server emits it that way
		var commit = function() {
			var suffixes = Array.from(document.querySelectorAll('.object'))
				.map(function(el) { return el.id.slice($.glue.page.length + 1); });
			$.glue.backend({ method: 'glue.update_object',
				name: $.glue.page + '.page', 'page-reading-order': JSON.stringify(suffixes) });
		};
		var render = function() {
			pop.querySelectorAll('.glue-reading-order-row').forEach(function(el) { el.remove(); });
			var objs = document.querySelectorAll('.object');
			if (!objs.length) {
				var empty = $.glue.popover.row();
				empty.textContent = 'no objects on this page yet';
				pop.appendChild(empty);
			}
			objs.forEach(function(obj, i) {
				var row = document.createElement('div');
				row.className = 'glue-popover-row glue-reading-order-row';
				var label = document.createElement('div');
				label.className = 'glue-popover-label';
				label.textContent = obj.id.slice($.glue.page.length + 1);
				row.appendChild(label);
				var up = document.createElement('div');
				up.className = 'glue-reading-order-btn';
				up.textContent = '↑';
				up.title = 'move up in the reading order';
				up.addEventListener('click', function() {
					obj.parentNode.insertBefore(obj, obj.previousElementSibling);
					commit();
					render();
				});
				if (i == 0) {
					up.classList.add('glue-reading-order-btn-off');
				}
				row.appendChild(up);
				var down = document.createElement('div');
				down.className = 'glue-reading-order-btn';
				down.textContent = '↓';
				down.title = 'move down in the reading order';
				down.addEventListener('click', function() {
					obj.parentNode.insertBefore(obj.nextElementSibling, obj);
					commit();
					render();
				});
				if (i == objs.length - 1) {
					down.classList.add('glue-reading-order-btn-off');
				}
				row.appendChild(down);
				pop.appendChild(row);
			});
		};

		var hint = document.createElement('div');
		hint.className = 'glue-popover-note';
		hint.textContent = 'the order applies once the page is reloaded';
		pop.appendChild(hint);

		render();

		pop.appendChild($.glue.popover.reset('back to the automatic position order', function() {
			$.glue.backend({ method: 'glue.object_remove_attr',
				name: $.glue.page + '.page', attr: 'page-reading-order' });
		}));

		$.glue.popover.show(pop);
	};

	elem = $.glue.icon('list-ordered', 'reading order: assign element importance, H1 being of most importance, though H6');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		page_reading_order_popover();
	});
	// the reading-order button gave the layout toggle its centre slot in
	// the top row and took the row's end in exchange (danja's call,
	// 2026-09-25)
	$.glue.menu.register('page', elem, 8);

	// (the colour button that used to sit here is in the background panel now,
	// next to the picture it shares the background with - see
	// page_background_popover. Its shift-click "type a colour instead" went
	// with it: the picker is the one way in, in a panel where the button sits
	// next to the thing it colours.)

	elem = $.glue.icon('page-new', 'create a new page');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		var pn = prompt('Name the page to be created');
		if (pn === null) {
			return;
		}
		$.glue.backend({ method: 'glue.create_page', page: pn+'.head' }, function(data) {
			// redirect to newly created page
			window.location = $.glue.base_url+'?'+pn+'/edit';
		});
	});
	$.glue.menu.register('page', elem, 1);

	//
	// page background: one panel, the object properties panel's background
	// section's twin (the object background panel's, until that panel grew the
	// padding, the flip and the transparency on 2026-09-16), and the
	// menu button now only opens it. What the background IS gets decided in
	// there too - the colour and the picture both - which is why the menu's own
	// colour button is gone. The page stores its background as attrs on the
	// page object (page-background-file/-mime and -color, plus the repeat,
	// position and size attrs below), which page_render_object() applies for
	// visitors.
	//
	var page_bg_has = function() {
		var bg = getComputedStyle(document.documentElement).backgroundImage;
		return (bg.length != 0 && bg != 'none') || !!page_bg_video_mode();
	};
	// The video background's element, created on the page by the render
	// (page_render_page_late); the client makes one itself when a video is
	// dropped in with the panel open. Below the objects (z-index 0), out
	// of the pointer's way in the editor.
	var page_bg_video_el = function() {
		var v = document.querySelector('video.page-background-video');
		if (!v) {
			v = document.createElement('video');
			v.className = 'page-background-video';
			v.muted = true;
			v.loop = true;
			v.autoplay = true;
			v.setAttribute('playsinline', 'playsinline');
			v.style.position = 'absolute';
			v.style.left = '0px';
			v.style.top = '0px';
			v.style.width = '100%';
			v.style.height = '100%';
			v.style.objectFit = 'cover';
			v.style.zIndex = '0';
			v.style.pointerEvents = 'none';
			document.body.prepend(v);
		}
		return v;
	};
	// The layer that shows on the page: the tiled wallpaper's canvas, or
	// the single video element.
	var page_bg_video_layer = function() {
		var c = document.querySelector('canvas.page-background-video');
		return c || document.querySelector('video.page-background-video');
	};
	var page_bg_video_mode = function() {
		var c = document.querySelector('canvas.page-background-video');
		if (c) {
			return true;
		}
		var v = document.querySelector('video.page-background-video');
		return !!(v && v.getAttribute('src'));
	};
	// Take the picture off the page, and everything that described it off the
	// page object. The panel's remove button and its colour button both do
	// this - dropping the picture is the same act whether you asked for it or
	// asked for a colour to put in its place - so they share the one function.
	var page_bg_clear = function() {
		var doc = document.documentElement;
		doc.style.backgroundImage = '';
		doc.style.backgroundRepeat = '';
		doc.style.backgroundPosition = '';
		doc.style.backgroundSize = '';
		// the video layer goes with the rest, whichever look it wore
		document.querySelectorAll('video.page-background-video, video.page-background-video-source, canvas.page-background-video')
			.forEach(function(el) {
				el.remove();
			});
		$.glue.backend({ method: 'page.clear_background_img', page: $.glue.page }, function(data) {
			// the file and its settings are gone with it
			$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page',
				attr: ['page-background-repeat', 'page-background-image-position', 'page-background-size'] });
		});
	};
	// Where the page's background image sits, in px - the object panel's helper,
	// pointed at the page's own element. The computed value is the one place the
	// browser resolves '0% 0%', 'left top' and the pairs with only one number
	// into something with two of them.
	var page_background_position = function() {
		if (page_bg_video_mode()) {
			var el = page_bg_video_layer();
			var vx = parseInt(el.style.left);
			var vy = parseInt(el.style.top);
			return {
				x: isNaN(vx) ? 0 : vx,
				y: isNaN(vy) ? 0 : vy
			};
		}
		var start = getComputedStyle(document.documentElement).backgroundPosition.split(' ');
		var x = parseInt(start[0]);
		var y = parseInt(start[1]);
		return {
			x: isNaN(x) ? 0 : x,
			y: isNaN(y) ? 0 : y
		};
	};
	var page_background_popover = function() {
		var doc = document.documentElement;
		var pop = $.glue.popover.open(doc, 'glue-background-popover');
		if (!pop) {
			return;
		}

		// --- what the background is, and what it does -------------------------
		//
		// One unlabelled row of four: a colour and a picture to set the page's
		// background, and the two toggles that say what the picture does with
		// itself. The buttons are named in their tooltips and nowhere else -
		// the labels the two toggles used to wear were only there to fill the
		// panel's label column - and they are the toolbar's size rather than
		// the panel's 26px, the artwork at the 30px it is drawn at. Four in a
		// row read as a row, and an unlabelled row of full-size buttons is a
		// toolbar.
		//
		// What the row holds came from the page menu: the colour button, and
		// the picture, which used to be the menu button itself, a file picker
		// whenever the page had no background. The panel is the page's
		// background, so it is where its background is set.
		//
		// The panel is the house style since 2026-09-17 - the row of actions
		// over one "more knobs" fold - and this row became the panel's icon row
		// rather than a row in it. Where the picture sits and how big it is are
		// the fold's, with the delete and the reset as its last row.
		var icons = $.glue.popover.icon_row();
		var fold = $.glue.popover.fold(pop, 'more knobs');
		var body = fold.body;

		// The colour button. Deliberately not $.glue.popover.color_button():
		// that one sets the colour of a thing that is there, and this one
		// replaces what the background is. The colour sits BEHIND an opaque
		// picture, so picking one while a picture is up would look like
		// nothing had happened - hence the clear first, with the confirm it
		// has always had. That answer has to come before the picker opens,
		// which is also why this is not the shared button with a hook on it.
		// (It also sizes itself to the panel's 26px, and this row is not.)
		//
		// The glyph is the shared one, though - color, what every other
		// colour button in the editor wears. It wore background-color for a day
		// to say "this one replaces the background rather than recolouring
		// something", and danja's call on 09-16 was that a colour button is a
		// colour button: the difference is in what the click does, which the
		// tooltip says, not in the drawing.
		// the shared swatch button, with the panel's own pre-click: a colour
		// sits BEHIND an opaque picture, so picking one while a picture is
		// up would look like nothing had happened - the clear comes first,
		// with the confirm it has always had
		var colour = $.glue.popover.color_button('set page background color',
			function() {
				return getComputedStyle(doc).backgroundColor;
			},
			function(col) {
				doc.style.backgroundColor = col;
			},
			function(col) {
				// update grid as well
				$.glue.grid.update(true);
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-color': col });
			},
			function() {
				if (!page_bg_has()) {
					return;
				}
				if (!confirm('Do you want to clear the current background image?')) {
					return false;
				}
				page_bg_clear();
				// the picture the rest of this panel describes has just
				// gone, so the panel goes with it rather than sitting
				// there showing rows about a background that is not there
				// any more
				$.glue.popover.close();
			});
		colour.classList.add('glue-background-color');
		icons.appendChild(colour);

		// The picture itself: the page menu's upload, moved in with the rest.
		// $.glue.upload.button() lays a transparent file input over the icon,
		// so the button IS the picker and wants no click handler of its own.
		// The upload leaves the panel open, because what you do next - tiling,
		// sizing, moving - is all in here.
		var image = $.glue.popover.icon_button('background-image', 'set page background image');
		image.classList.add('glue-background-image');
		$.glue.upload.button(image, { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'page' }, {
			tooltip: 'set page background image',
			error: function(e) {
				if (e && e.target && e.target.status) {
					$.glue.error('There was a problem uploading a file (status '+e.target.status+')');
				} else {
					$.glue.error('There was a problem uploading a file. Make sure you are not exceeding the file size limits set in the server configuration.');
					// DEBUG
					console.error(e);
				}
			},
			finish: function(data) {
				if (!data) {
					$.glue.error('There was a problem communicating with the server');
				} else if (data['#error']) {
					$.glue.error('There was a problem uploading the file ('+data['#data']+')');
				} else {
					// the video the panel used to describe is gone - the
					// picture replaces it
					document.querySelectorAll('video.page-background-video, video.page-background-video-source, canvas.page-background-video')
						.forEach(function(el) {
							el.remove();
						});
					// the timestamp here is to trick any caching going on
					doc.style.backgroundImage = 'url('+$.glue.base_url+'?'+$.glue.page+'.page&'+(new Date().getTime())+')';
					// the two toggles have something to act on now. sync_has is
					// defined with them, below; a var, so it is here by now.
					sync_has();
				}
			}
		});
		icons.appendChild(image);

		// The moving picture, next to the still one: a video background
		// uploads the same way and the server (page_upload) tells the two
		// apart by the file's mime. What you do next - moving, sizing,
		// tiling - is the same rows as the image's.
		var video_btn = $.glue.popover.icon_button('background-video', 'set page background video');
		video_btn.classList.add('glue-background-video');
		$.glue.upload.button(video_btn, { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'page' }, {
			tooltip: 'set page background video',
			error: function(e) {
				if (e && e.target && e.target.status) {
					$.glue.error('There was a problem uploading a file (status '+e.target.status+')');
				} else {
					$.glue.error('There was a problem uploading a file. Make sure you are not exceeding the file size limits set in the server configuration.');
					// DEBUG
					console.error(e);
				}
			},
			finish: function(data) {
				if (!data) {
					$.glue.error('There was a problem communicating with the server');
				} else if (data['#error']) {
					$.glue.error('There was a problem uploading the file ('+data['#data']+')');
				} else {
					// the picture the panel used to describe is gone - the
					// video replaces it
					document.documentElement.style.backgroundImage = '';
					var v = page_bg_video_el();
					// the timestamp here is to trick any caching going on
					v.src = $.glue.base_url+'?'+$.glue.page+'.page&'+(new Date().getTime());
					v.play();
					sync_has();
				}
			}
		});
		icons.appendChild(video_btn);

		// --- tiled or once, scrolling or fixed --------------------------------
		//
		// The two toggles. Each wears the set's own drawing with its state in
		// the frame (glue-btn-active) rather than in a second glyph, the shape
		// the object panel's tile toggle takes too, and each says what it does
		// in its name and nowhere else.
		//
		// Tile first: tiled across the page is the browser's default, so that
		// is the lit state and the one that stores nothing - absent means
		// default, as everywhere else in this panel.
		var repeat = $.glue.popover.icon_button('tile', 'tile page background image');
		repeat.classList.add('glue-background-tile');
		var sync_repeat = function() {
			if (page_bg_video_mode()) {
				repeat.classList.toggle('glue-btn-active',
					!!document.querySelector('canvas.page-background-video'));
			} else {
				repeat.classList.toggle('glue-btn-active',
					getComputedStyle(doc).backgroundRepeat.indexOf('no-repeat') == -1);
			}
		};
		repeat.addEventListener('click', function() {
			if (page_bg_video_mode()) {
				// the wallpaper swap: the single video becomes the offscreen
				// feeder and a canvas takes its place (and the way back)
				var v = document.querySelector('video.page-background-video');
				if (v) {
					// tile it: the video's own place becomes the canvas's
					// grid origin
					var left = v.style.left, top = v.style.top;
					v.className = 'page-background-video-source';
					v.style.position = 'absolute';
					v.style.left = '-10000px';
					v.style.top = '0px';
					v.style.width = '320px';
					v.style.zIndex = '-1';
					var c = document.createElement('canvas');
					c.className = 'page-background-video';
					c.style.position = (getComputedStyle(v).position == 'fixed') ? 'fixed' : 'absolute';
					c.style.left = left;
					c.style.top = top;
					c.style.width = '100%';
					c.style.height = '100%';
					c.style.zIndex = '0';
					c.style.pointerEvents = 'none';
					c.setAttribute('data-scale', parseFloat(v.style.width) == 100 ? '' : String(parseFloat(v.style.width)));
					document.body.prepend(c);
					// the pair exists only now - the tiler arms itself at
					// load, so the live swap starts it itself
					if (typeof window.start_page_background_video_tiler == 'function') {
						window.start_page_background_video_tiler();
					}
					$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-repeat': 'repeat' });
				} else {
					// untiled: the canvas goes, the feeder comes back into
					// its place with the single video's usual look
					var c = document.querySelector('canvas.page-background-video');
					var left = c.style.left, top = c.style.top;
					var f = document.querySelector('video.page-background-video-source');
					c.remove();
					if (f) {
						f.className = 'page-background-video';
						f.style.position = (c.style.position == 'fixed') ? 'fixed' : 'absolute';
						f.style.left = left;
						f.style.top = top;
						f.style.width = c.getAttribute('data-scale') ? c.getAttribute('data-scale')+'%' : '100%';
						f.style.height = f.style.width;
						f.style.objectFit = 'cover';
						f.style.zIndex = '0';
						f.style.pointerEvents = 'none';
						f.play();
					}
					$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-repeat' });
				}
				sync_repeat();
				sync_scroll();
				return;
			}
			var tiled = getComputedStyle(doc).backgroundRepeat.indexOf('no-repeat') == -1;
			doc.style.backgroundRepeat = tiled ? 'no-repeat' : 'repeat';
			sync_repeat();
			if (tiled) {
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-repeat' });
			} else {
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-repeat': 'no-repeat' });
			}
		});
		icons.appendChild(repeat);

		// Then scroll, which came in from the page menu: it is a setting of the
		// background image like the rest of the panel, and it is the PAGE's
		// alone - an object and its background move together, so there is
		// nothing for it to say about one. On (the lit state, and what an
		// absent attribute means) is background-attachment: scroll, the image
		// going up the page with everything else.
		var scroll = $.glue.popover.icon_button('background-scroll', 'scroll page background image');
		scroll.classList.add('glue-background-scroll');
		var sync_scroll = function() {
			if (page_bg_video_mode()) {
				var el = page_bg_video_layer();
				scroll.classList.toggle('glue-btn-active',
					el && el.style.position != 'fixed');
			} else {
				scroll.classList.toggle('glue-btn-active',
					getComputedStyle(doc).backgroundAttachment != 'fixed');
			}
		};
		scroll.addEventListener('click', function() {
			if (page_bg_video_mode()) {
				var el = page_bg_video_layer();
				var fixed = el.style.position == 'fixed';
				el.style.position = fixed ? 'absolute' : 'fixed';
				sync_scroll();
				if (fixed) {
					$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-attachment' });
				} else {
					$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-attachment': 'fixed' });
				}
				return;
			}
			var fixed = getComputedStyle(doc).backgroundAttachment == 'fixed';
			// emptied rather than set to 'scroll', so going back to the
			// default leaves no inline style behind
			doc.style.backgroundAttachment = fixed ? '' : 'fixed';
			sync_scroll();
			if (fixed) {
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-attachment' });
			} else {
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-attachment': 'fixed' });
			}
		});
		icons.appendChild(scroll);

		// Both toggles are about the background: with none on the page they
		// would be toggling a background that is not there. So they grey out
		// and go inert until one arrives - the uploads above call this too,
		// so a picture or video dropped in while the panel is open wakes
		// them where they stand.
		var sync_has = function() {
			var off = !page_bg_has();
			repeat.classList.toggle('glue-background-off', off);
			scroll.classList.toggle('glue-background-off', off);
		};
		sync_repeat();
		sync_scroll();
		sync_has();

		// --- move it around -------------------------------------------------
		//
		// The object panel's two rows, to the letter: same labels, same range,
		// same arithmetic - only the thing underneath differs. There the panel
		// IS the move mode, because the object itself is there to grab; a page
		// has nothing behind it to grab (a drag out on the page belongs to the
		// objects and the canvas), so the page keeps the by-hand pair, which is
		// the whole of its move control.
		//
		// x 0 y 0 is the corner and is not written - absent means it, the way it
		// does everywhere else in this panel.
		var at = page_background_position();
		var write_at = function() {
			if (page_bg_video_mode()) {
				var el = page_bg_video_layer();
				el.style.left = (at.x == 0) ? '0px' : at.x+'px';
				el.style.top = (at.y == 0) ? '0px' : at.y+'px';
			} else {
				doc.style.backgroundPosition = (at.x == 0 && at.y == 0) ? '' : at.x+'px '+at.y+'px';
			}
		};
		var save_at = function() {
			if (at.x == 0 && at.y == 0) {
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-image-position' });
			} else {
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-image-position': at.x+'px '+at.y+'px' });
			}
		};
		// The min and max are a drag length, not a limit: the field keeps the real
		// number however far the drag went (see $.glue.popover.number_row).
		var x_row = $.glue.popover.number_row('x', {
			// coarse: a page position wants a finer hand than the default drag
			// gives - span/200 would move the picture 5px per pixel of drag
			min: -500, max: 500, step: 1, unit: 'px', coarse: true,
			value: at.x,
			apply: function(v, commit) {
				at.x = v;
				write_at();
				if (commit) {
					save_at();
				}
			}
		});
		var y_row = $.glue.popover.number_row('y', {
			// coarse: as x above
			min: -500, max: 500, step: 1, unit: 'px', coarse: true,
			value: at.y,
			apply: function(v, commit) {
				at.y = v;
				write_at();
				if (commit) {
					save_at();
				}
			}
		});
		var sync_rows = function() {
			x_row.set(at.x);
			y_row.set(at.y);
		};
		// the image moves up and left as readily as down and right, so these two
		// fields get the room for a sign (the shared one allows three digits)
		x_row.row.classList.add('glue-background-pos');
		y_row.row.classList.add('glue-background-pos');
		body.appendChild(x_row.row);
		body.appendChild(y_row.row);

		// --- size it ---------------------------------------------------------
		//
		// A percentage of the page's width, the height keeping the image's
		// own ratio - the object panel's row. 100 is what the row shows when
		// nothing is stored; it is not written until the scale is actually
		// touched, and a zero clears the attribute again.
		var scale_row = $.glue.popover.number_row('scale', {
			min: 10, max: 300, step: 1, unit: '%',
			value: (function() {
				if (page_bg_video_mode()) {
					var el = page_bg_video_layer();
					if (el.tagName == 'CANVAS') {
						// the tile size, native when nothing is stored
						return parseFloat(el.getAttribute('data-scale')) || 0;
					}
					return parseFloat(el.style.width) || 100;
				}
				return parseFloat(doc.style.backgroundSize) || 100;
			})(),
			apply: function(pct, commit) {
				if (page_bg_video_mode()) {
					var el = page_bg_video_layer();
					if (el.tagName == 'CANVAS') {
						// the tile size: a percentage of the page width
						if (!pct || pct < 0) {
							el.removeAttribute('data-scale');
							scale_row.set(0);
						} else {
							el.setAttribute('data-scale', pct);
						}
					} else {
						// the single video's zoomed cover: both sides grow
						// together, cropping to the frame
						if (!pct || pct < 0) {
							el.style.width = '100%';
							el.style.height = '100%';
							scale_row.set(100);
						} else {
							el.style.width = pct+'%';
							el.style.height = pct+'%';
						}
					}
				} else {
					if (!pct || pct < 0) {
						doc.style.backgroundSize = '';
						scale_row.set(0);
					} else {
						doc.style.backgroundSize = pct+'% auto';
					}
				}
				if (commit) {
					if (!pct || pct < 0) {
						$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-size' });
					} else {
						$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-size': pct+'% auto' });
					}
				}
			}
		});
		// the panel has three number fields now, so the scale one is named -
		// the two above share glue-background-pos, and the bare
		// .glue-popover-field would match all three
		scale_row.row.classList.add('glue-background-scale');
		body.appendChild(scale_row.row);

		// --- take it off, or put it back --------------------------------------
		//
		// The fold's last row, not a footer under the panel: the delete and the
		// reset are the two things you do to the panel's work rather than to the
		// page, and the house style keeps everything with a label in the fold.
		var footer = $.glue.popover.row(false);
		footer.appendChild($.glue.popover.delete('remove the background image', function() {
			page_bg_clear();
			$.glue.popover.close();
		}));
		footer.appendChild($.glue.popover.reset('reset tiling, position and scale to their defaults', function() {
			doc.style.backgroundRepeat = '';
			doc.style.backgroundPosition = '';
			doc.style.backgroundSize = '';
			if (page_bg_video_mode()) {
				var el = page_bg_video_layer();
				el.style.left = '0px';
				el.style.top = '0px';
				if (el.tagName == 'CANVAS') {
					el.removeAttribute('data-scale');
				} else {
					el.style.width = '100%';
					el.style.height = '100%';
					el.style.objectFit = 'cover';
				}
			}
			// and the panel says so: the rows, the tile toggle (the page's
			// default IS repeat, so it lights) and the scale field
			at.x = 0;
			at.y = 0;
			sync_rows();
			sync_repeat();
			scale_row.set(100);
			$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page',
				attr: ['page-background-repeat', 'page-background-image-position', 'page-background-size'] });
		}));
		body.appendChild(footer);

		pop.appendChild(icons);
		pop.appendChild(fold.toggle);
		pop.appendChild(body);

		$.glue.popover.show(pop);
	};
	// The menu button opens the panel, and that is all it does now: the upload
	// it used to be is in there with the colour button. It opens whether or
	// not the page has a background - it has to, since a page with none gets
	// one in there. "Page background" rather than "background image" because
	// what it opens is the page's background whole: the picture, the colour
	// under it, and what each of them does. The glyph followed the name on
	// 09-16: background-set, the half-filled frame, which says "the background
	// is set" where the old one only said "there is a picture back here".
	var page_bg_button = $.glue.icon('page-background', 'set page background');
	page_bg_button.addEventListener('click', function(e) {
		page_background_popover();
		e.stopPropagation();
	});
	$.glue.menu.register('page', page_bg_button, 4);

	// (the scroll toggle that used to sit in this menu is in the panel above
	// now, with the rest of the background's settings - see
	// page_background_popover)

	// grid: the button opens a panel - a show/hide toggle, and x/y size
	// rows that are interlocked by default (set one, both move) until
	// unlocked. The size is remembered per page (page-grid-x/y on the page
	// pseudo-object); the old drag-on-the-button gesture is gone.
	var grid_btn;
	var grid_popover = function() {
		var pop = $.glue.popover.open(document.documentElement, 'glue-grid-popover');
		if (!pop) {
			return;
		}
		var clamp = function(v) {
			return Math.max(10, Math.min(500, Math.round(v)));
		};
		// redraw the grid on every change so it moves with the rows;
		// the backend write only happens on commit
		var redraw = function() {
			$.glue.grid.update(true);
			grid_btn.title = 'grid ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')';
		};
		var commit = function() {
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page',
				'page-grid-x': String($.glue.grid.x()),
				'page-grid-y': String($.glue.grid.y()) });
		};

		// --- show / remove -------------------------------------------------
		var show_row = $.glue.popover.row('show grid');
		var show = document.createElement('div');
		show.className = 'glue-font-toggle glue-grid-show-toggle';
		show.textContent = '▦';
		show.title = 'the grid is drawn - click to remove it';
		var sync_show = function() {
			var on = ($.glue.grid.mode() & 1) !== 0;
			show.classList.toggle('glue-font-toggle-on', on);
			show.title = on ? 'the grid is drawn - click to remove it' : 'no grid - click to draw it';
		};
		show.addEventListener('click', function() {
			$.glue.grid.mode(($.glue.grid.mode() & 1) ? 0 : 1);
			$.glue.grid.update();
			sync_show();
		});
		sync_show();
		show_row.appendChild(show);
		pop.appendChild(show_row);

		// --- interlock -----------------------------------------------------
		// x and y move together while locked; a page whose stored x and y
		// differ opens unlocked, so the panel never quietly collapses them
		var locked = $.glue.grid.x() == $.glue.grid.y();
		var lock_row = $.glue.popover.row('interlocked');
		var lock = document.createElement('div');
		lock.className = 'glue-font-toggle glue-grid-lock';
		var sync_lock = function() {
			lock.classList.toggle('glue-font-toggle-on', locked);
			lock.textContent = locked ? 'x=y' : 'x≠y';
			lock.title = locked ?
				'x and y move together - click to set them separately' :
				'x and y are set separately - click to interlock them';
		};
		lock.addEventListener('click', function() {
			locked = !locked;
			if (locked) {
				// re-locking syncs y to x
				$.glue.grid.y($.glue.grid.x());
				y_row.set($.glue.grid.y());
				redraw();
				commit();
			}
			sync_lock();
		});
		sync_lock();
		lock_row.appendChild(lock);
		pop.appendChild(lock_row);

		// --- size ----------------------------------------------------------
		var set_x = function(v) {
			$.glue.grid.x(v);
			if (locked) {
				$.glue.grid.y(v);
				y_row.set(v);
			}
		};
		var set_y = function(v) {
			$.glue.grid.y(v);
			if (locked) {
				$.glue.grid.x(v);
				x_row.set(v);
			}
		};
		var x_row = $.glue.popover.number_row('x', {
			min: 10, max: 500, step: 1, unit: 'px',
			value: $.glue.grid.x(),
			apply: function(v, commit_save) {
				set_x(clamp(v));
				redraw();
				if (commit_save) {
					commit();
				}
			}
		});
		pop.appendChild(x_row.row);
		var y_row = $.glue.popover.number_row('y', {
			min: 10, max: 500, step: 1, unit: 'px',
			value: $.glue.grid.y(),
			apply: function(v, commit_save) {
				set_y(clamp(v));
				redraw();
				if (commit_save) {
					commit();
				}
			}
		});
		pop.appendChild(y_row.row);

		$.glue.popover.show(pop);
	};

	elem = $.glue.icon('adjust-grid-size', 'show grid ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		// clicking the button draws the grid (the panel's show toggle
		// removes it again)
		if (!($.glue.grid.mode() & 1)) {
			$.glue.grid.mode($.glue.grid.mode() | 1);
			$.glue.grid.update();
		}
		grid_popover();
	});
	$.glue.menu.register('page', elem, 5);
	grid_btn = elem;

	// centered/infinite layout toggle
	// The label used to name the destination ("wide" while centered) while the
	// tooltip described the present, and the icon keeps that split: it shows
	// the mode you are about to switch TO, not the one you are in. Picked once
	// here because toggling reloads the page.
	elem = $.glue.conf.page.layout_mode == 'centered' ?
		$.glue.icon('composition-mode-absolute',
			'center page content in a fixed-width container') :
		$.glue.icon('composition-mode-centered',
			'page content sits on an unbounded canvas');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		page_layout_toggle();
	});
	$.glue.menu.register('page', elem, 2);

	// the page menu's own upload button is gone (danja's call, 2026-09-25):
	// the new menu's 'upload an asset' is the way in, and it was a second
	// door to the same thing

	// container edge handles, in centered mode only
	if ($.glue.canvas.wrapper()) {
		page_container_handle_make('left');
		page_container_handle_make('right');
		page_container_handles_update();
		window.addEventListener('resize', page_container_handles_update);
		window.addEventListener('scroll', page_container_handles_update);
	}
});
