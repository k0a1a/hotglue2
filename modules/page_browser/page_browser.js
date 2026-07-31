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
});
