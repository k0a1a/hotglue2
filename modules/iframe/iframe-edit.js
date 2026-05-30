/**
 *	modules/iframe/iframe-edit.js
 *	Frontend code for iframe objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	//
	// menu items
	//
	var elem = $('<img src="'+$.glue.base_url+'modules/iframe/iframe.png" alt="btn" title="embed another webpage" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var url = prompt('Enter the URL to show');
		if (!url) {
			return;
		}
    // use protocol relative url
    url = '//' + url.split('//')[1];
		// create new object
		$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
			var elem = $('<div class="iframe resizable object" style="position: absolute;"></div>');
			$(elem).attr('id', data['name']);
			// default width and height is set in the css
			var child = $('<iframe style="background-color: transparent; border-width: 0px; height: 100%; position: absolute; width: 100%;"></iframe>');
			$(child).attr('name', data['name']);
			$(child).attr('src', url);
			$(elem).append(child);
			// put the iframe behind some shield for editing
			child = $('<div class="glue-iframe-shield glue-ui" style="height: 100%; position: absolute; width: 100%;" title="visitors will be able to interact with the webpage below"></div>');
			$(elem).append(child);
			$('body').append(elem);
			// make width and height explicit
			$(elem).css('width', $(elem).width()+'px');
			$(elem).css('height', $(elem).height()+'px');
			// move to mouseclick
			$(elem).css('left', (e.pageX-$(elem).outerWidth()/2)+'px');
			$(elem).css('top', (e.pageY-$(elem).outerHeight()/2)+'px');
			$.glue.object.register(elem);
			$.glue.object.save(elem);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem, 12);
	
	//
	// context menu items
	//
	elem = $('<img src="'+$.glue.base_url+'modules/iframe/iframe-url.png" alt="btn" title="change webpage url" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var child = $(obj).children('iframe').first();
		var url = prompt('Enter the URL to show', window.location.protocol + $(child).attr('src'));
		if (!url) {
			return;
		}
    // use protocol relative url
    url = '//' + url.split('//')[1];
		$(child).attr('src', url);
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('iframe', 'iframe-url', elem);
	
	elem = $('<div style="height: 32px; width: 32px;" title="toggle scrollbars on and off">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var child = $(obj).children('iframe').first();
		if ($(child).css('overflow') == 'hidden') {
			// show scrollbars
			$(child).css('overflow', 'auto');
			// attribute scrolling is not supported in html5 (but works on Chrome)
			$(child).attr('scrolling', 'auto');
			$(child).removeAttr('seamless');
			// this does not seem to work on recent Chrome without reloading the 
			// iframe
			if ($.browser.webkit) {
				$(child).attr('src', $(child).attr('src'));
			}
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
		} else {
			// hide scrollbars
			$(child).css('overflow', 'hidden');
			$(child).attr('scrolling', 'no');
			// this is html5, it supposedly also removes the scrollbars though, 
			// that's why we don't use it all the time
			$(child).attr('seamless', 'seamless');
			// this does not seem to work on recent Chrome without reloading the 
			// iframe
			if ($.browser.webkit) {
				$(child).attr('src', $(child).attr('src'));
			}
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		}
		$.glue.object.save(obj);
	});
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var child = $(obj).children('iframe').first();
		if ($(child).css('overflow') == 'hidden') {
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		} else {
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
		}
	});
	$.glue.contextmenu.register('iframe', 'iframe-scroll', elem);
	
	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('iframe', function(obj, orig) {
		$(obj).children('iframe').html('');
		$(obj).children('.glue-iframe-shield').remove();
	});
});
