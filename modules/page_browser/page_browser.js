/**
 *	modules/page_browser/page_browser.js
 *	Page browser frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	var span = false;
	
	$('.page_browser_entry').live('mouseenter', function(e) {
		if (span) {
			$(span).remove();
		}
		var html = '<span class="page_browser_actions">';
		html += '<a href="'+$.glue.base_url+'?'+$(this).attr('id')+'/edit">edit</a> | ';
		html += '<a href="#" class="page_browser_copy">copy</a> | ';
		html += '<a href="#" class="page_browser_rename">rename</a> | ';
		html += '<a href="#" class="page_browser_delete">delete</a>';
		if ($(this).attr('id')+'.head' != $.glue.conf.page.startpage) {
			html += ' | <a href="#" class="page_browser_set_startpage">startpage</a>';
		}
		html += '</span>';
		
		span = $(html);
		$(this).append(span);
	});
	
	$('.page_browser_entry').bind('mouseleave', function(e) {
		if (span) {
			$(span).remove();
			span = false;
		}
	});
	
	$('.page_browser_rename').live('click', function(e) {
		var entry = $(this).parents('.page_browser_entry');
		var old = $(entry).attr('id');
		var pn = prompt('Change the page URL', old);
		if (pn != null && pn != old) {
			$.glue.backend({ method: 'glue.rename_page', 'old': old, 'new': pn }, function(data) {
				$(entry).attr('id', pn);
				$(entry).children('.page_browser_pagename').html('<a href="'+$.glue.base_url+'?'+pn+'">'+pn+'</a>');
			});
		}
		return false;
	});
	
	$('.page_browser_copy').live('click', function(e) {
		var entry = $(this).parents('.page_browser_entry');
		var old = $(entry).attr('id');
		var pn = prompt('Specify a name', old+'-copy');
		if (pn != null && pn != old) {
			$.glue.backend({ method: 'glue.copy_page', 'old': old, 'new': pn }, function(data) {
				copy = $(entry).clone();
				$(copy).attr('id', pn);
				$(copy).find('span.page_browser_pagename').siblings().remove();
				$(copy).children('.page_browser_pagename').html('<a href="'+$.glue.base_url+'?'+pn+'">'+pn+'</a>');
				$(entry).after(copy);
			});
		}
		return false;
	});

	$('.page_browser_delete').live('click', function(e) {
		var entry = $(this).parents('.page_browser_entry');
		var pn = $(entry).attr('id');
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
				$(entry).hide('fast', function() {
					$(this).remove();
				});
			});
		}
		return false;
	});
	
	$('.page_browser_set_startpage').live('click', function(e) {
		var entry = $(this).parents('.page_browser_entry');
		var pn = $(entry).attr('id');
		$.glue.backend({ method: 'glue.set_startpage', page: pn+'.head' }, function(data) {
			$('#page_browser_startpage').remove();
			$(entry).children('.page_browser_pagename').after(' <span id="page_browser_startpage">[startpage]</span>');
			$.glue.conf.page.startpage = pn+'.head';
			if (span) {
				$(entry).trigger('mouseenter');
			}
		});
	});
});
