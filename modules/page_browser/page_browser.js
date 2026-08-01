/**
 *	modules/page_browser/page_browser.js
 *	Page browser frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var span = false;

	// native mouseenter/mouseleave don't bubble, so unlike the click
	// handlers below they can't be delegated with $.glue.live - bound
	// directly instead, at both points .page_browser_entry elements get
	// created (initial page render, and the clone in the copy handler)
	var bind_hover = function(entry) {
		entry.addEventListener('mouseenter', function(e) {
			if (span) {
				span.remove();
			}
			var html = '<span class="page_browser_actions">';
			html += '<a href="'+$.glue.base_url+'?'+this.id+'/edit">edit</a> | ';
			html += '<a href="#" class="page_browser_copy">copy</a> | ';
			html += '<a href="#" class="page_browser_rename">rename</a> | ';
			html += '<a href="#" class="page_browser_delete">delete</a>';
			if (this.id+'.head' != $.glue.conf.page.startpage) {
				html += ' | <a href="#" class="page_browser_set_startpage">startpage</a>';
			}
			html += '</span>';

			var tmp = document.createElement('div');
			tmp.innerHTML = html;
			span = tmp.firstElementChild;
			this.appendChild(span);
		});

		entry.addEventListener('mouseleave', function(e) {
			if (span) {
				span.remove();
				span = false;
			}
		});
	};

	document.querySelectorAll('.page_browser_entry').forEach(function(entry) {
		bind_hover(entry);
	});

	$.glue.live('.page_browser_rename', 'click', function(e) {
		var entry = this.closest('.page_browser_entry');
		var old = entry.id;
		var pn = prompt('Change the page URL', old);
		if (pn != null && pn != old) {
			$.glue.backend({ method: 'glue.rename_page', 'old': old, 'new': pn }, function(data) {
				entry.id = pn;
				entry.querySelector(':scope > .page_browser_pagename').innerHTML = '<a href="'+$.glue.base_url+'?'+pn+'">'+pn+'</a>';
			});
		}
		e.preventDefault();
	});

	$.glue.live('.page_browser_copy', 'click', function(e) {
		var entry = this.closest('.page_browser_entry');
		var old = entry.id;
		var pn = prompt('Specify a name', old+'-copy');
		if (pn != null && pn != old) {
			$.glue.backend({ method: 'glue.copy_page', 'old': old, 'new': pn }, function(data) {
				var copy = entry.cloneNode(true);
				copy.id = pn;
				var pagenameSpan = copy.querySelector('span.page_browser_pagename');
				Array.from(pagenameSpan.parentNode.children).forEach(function(el) {
					if (el !== pagenameSpan) {
						el.remove();
					}
				});
				pagenameSpan.innerHTML = '<a href="'+$.glue.base_url+'?'+pn+'">'+pn+'</a>';
				entry.after(copy);
				bind_hover(copy);
			});
		}
		e.preventDefault();
	});

	$.glue.live('.page_browser_delete', 'click', function(e) {
		var entry = this.closest('.page_browser_entry');
		var pn = entry.id;
		if (confirm('Really delete page '+pn+'?')) {
			// get all revisions
			var pages = [];
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
				// remove entry
				entry.style.transition = 'opacity 200ms, max-height 200ms';
				entry.style.overflow = 'hidden';
				entry.style.maxHeight = entry.scrollHeight + 'px';
				requestAnimationFrame(function() {
					requestAnimationFrame(function() {
						entry.style.opacity = '0';
						entry.style.maxHeight = '0px';
					});
				});
				setTimeout(function() {
					entry.remove();
				}, 200);
			});
		}
		e.preventDefault();
	});

	$.glue.live('.page_browser_set_startpage', 'click', function(e) {
		var entry = this.closest('.page_browser_entry');
		var pn = entry.id;
		$.glue.backend({ method: 'glue.set_startpage', page: pn+'.head' }, function(data) {
			var sp = document.getElementById('page_browser_startpage');
			if (sp) {
				sp.remove();
			}
			entry.querySelector(':scope > .page_browser_pagename').insertAdjacentHTML('afterend', ' <span id="page_browser_startpage">[startpage]</span>');
			$.glue.conf.page.startpage = pn+'.head';
			if (span) {
				entry.dispatchEvent(new MouseEvent('mouseenter'));
			}
		});
	});

	//
	// site settings (favicon, custom fonts) - this page doesn't load
	// edit.js (that's only pulled in for actual page-canvas editing), so
	// uploads here use a small standalone multipart helper rather than
	// $.glue.upload
	//
	var upload_file = function(file, fields, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', $.glue.base_url+'json.php', true);
		xhr.onload = function() {
			var data = null;
			try {
				data = JSON.parse(xhr.responseText);
			} catch (e) {}
			callback(data);
		};
		xhr.onerror = function() {
			callback(null);
		};
		var fd = new FormData();
		for (var key in fields) {
			fd.append(key, JSON.stringify(fields[key]));
		}
		fd.append('file', file);
		xhr.send(fd);
	};

	var favicon_input = document.getElementById('site_settings_favicon_input');
	if (favicon_input) {
		favicon_input.addEventListener('change', function(e) {
			var file = this.files[0];
			this.value = '';
			if (!file) {
				return;
			}
			upload_file(file, { method: 'glue.upload_files', page: $.glue.conf.page.startpage, preferred_module: 'page_favicon' }, function(data) {
				if (!data || data['#error'] || !data['#data'] || !data['#data'].length) {
					$.glue.error('There was a problem uploading the favicon');
					return;
				}
				var preview = document.getElementById('site_settings_favicon_preview');
				var empty = document.getElementById('site_settings_favicon_preview_empty');
				if (!preview) {
					preview = document.createElement('img');
					preview.id = 'site_settings_favicon_preview';
					preview.alt = 'current favicon';
					if (empty) {
						empty.replaceWith(preview);
					}
				}
				// the timestamp here is to trick any caching going on
				preview.src = $.glue.base_url+'?favicon&'+(new Date().getTime());
				document.getElementById('site_settings_favicon_clear').style.display = '';
				var link = document.querySelector('link[rel="shortcut icon"]');
				if (!link) {
					link = document.createElement('link');
					link.rel = 'shortcut icon';
					document.head.appendChild(link);
				}
				link.href = preview.src;
			});
		});
	}

	$.glue.live('#site_settings_favicon_clear', 'click', function(e) {
		e.preventDefault();
		$.glue.backend({ method: 'page.clear_favicon' }, function(data) {
			var preview = document.getElementById('site_settings_favicon_preview');
			if (preview) {
				var empty = document.createElement('span');
				empty.id = 'site_settings_favicon_preview_empty';
				empty.textContent = 'no favicon set';
				preview.replaceWith(empty);
			}
			document.getElementById('site_settings_favicon_clear').style.display = 'none';
		});
	});

	// "remove" is only shown on hover, same pattern (and re-using the same
	// .page_browser_actions styling) as the "All pages" list above
	var font_span = false;
	var bind_font_hover = function(li) {
		li.addEventListener('mouseenter', function(e) {
			if (font_span) {
				font_span.remove();
			}
			var tmp = document.createElement('div');
			tmp.innerHTML = '<span class="page_browser_actions"><a href="#" class="site_settings_font_remove">remove</a></span>';
			font_span = tmp.firstElementChild;
			this.appendChild(font_span);
		});
		li.addEventListener('mouseleave', function(e) {
			if (font_span) {
				font_span.remove();
				font_span = false;
			}
		});
	};

	document.querySelectorAll('#site_settings_fonts_list li').forEach(function(li) {
		bind_font_hover(li);
	});

	var add_font_entry = function(fontFile, fontName) {
		var li = document.createElement('li');
		li.setAttribute('data-file', fontFile);
		var name = document.createElement('span');
		name.className = 'site_settings_font_name';
		name.textContent = fontName;
		li.appendChild(name);
		bind_font_hover(li);
		document.getElementById('site_settings_fonts_list').appendChild(li);
	};

	var fonts_input = document.getElementById('site_settings_fonts_input');
	if (fonts_input) {
		fonts_input.addEventListener('change', function(e) {
			var file = this.files[0];
			this.value = '';
			if (!file) {
				return;
			}
			upload_file(file, { method: 'glue.upload_files', page: $.glue.conf.page.startpage, preferred_module: 'page_font' }, function(data) {
				if (!data || data['#error'] || !data['#data'] || !data['#data'].length || !data['#data'][0]) {
					$.glue.error('There was a problem uploading the font');
					return;
				}
				if (data['#data'][0] === 'limit') {
					$.glue.error('You can upload up to 10 custom fonts - remove one before adding another');
					return;
				}
				add_font_entry(data['#data'][0].file, data['#data'][0].name);
			});
		});
	}

	$.glue.live('.site_settings_font_remove', 'click', function(e) {
		e.preventDefault();
		var li = this.closest('li');
		var fontFile = li.getAttribute('data-file');
		$.glue.backend({ method: 'page.remove_font', file: fontFile }, function(data) {
			li.remove();
		});
	});
});
