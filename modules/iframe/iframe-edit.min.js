/**
 *	modules/iframe/iframe-edit.js
 *	Frontend code for iframe objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// CSS overflow doesn't meaningfully apply to <iframe> internal scrolling in
// modern browsers - any authored value (hidden, auto, unset) computes as
// "clip" via getComputedStyle, making it useless for state detection here.
// the scrolling attribute this same toggle sets is a reliable source of
// truth instead (defaults to shown/not-hidden for a never-toggled iframe)
function iframe_scroll_hidden(child) {
	return $(child).attr('scrolling') == 'no';
}

function iframe_scroll_sync(elem) {
	var child = $($.glue.owner(elem)).children('iframe').first();
	Alpine.$data(elem).enabled = !iframe_scroll_hidden(child);
}

function iframe_scroll_toggle(elem) {
	var obj = $.glue.owner(elem);
	var child = $(obj).children('iframe').first();
	var data = Alpine.$data(elem);
	if (iframe_scroll_hidden(child)) {
		// show scrollbars
		$(child).css('overflow', 'auto');
		// attribute scrolling is not supported in html5 (but works on Chrome)
		$(child).attr('scrolling', 'auto');
		$(child).removeAttr('seamless');
		data.enabled = true;
	} else {
		// hide scrollbars
		$(child).css('overflow', 'hidden');
		$(child).attr('scrolling', 'no');
		// this is html5, it supposedly also removes the scrollbars though,
		// that's why we don't use it all the time
		$(child).attr('seamless', 'seamless');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

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
		var obj = $.glue.owner(this);
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

	elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'iframe_scroll_sync', 'iframe_scroll_toggle',
		'scrollbars are shown - click to hide them', 'toggle scrollbars on and off');
	$.glue.contextmenu.register('iframe', 'iframe-scroll', elem);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('iframe', function(obj, orig) {
		$(obj).children('iframe').html('');
		$(obj).children('.glue-iframe-shield').remove();
	});
});
