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
	return child.getAttribute('scrolling') == 'no';
}

function iframe_scroll_sync(elem) {
	var child = $.glue.owner(elem).querySelector(':scope > iframe');
	Alpine.$data(elem).enabled = !iframe_scroll_hidden(child);
}

function iframe_scroll_toggle(elem) {
	var obj = $.glue.owner(elem);
	var child = obj.querySelector(':scope > iframe');
	var data = Alpine.$data(elem);
	if (iframe_scroll_hidden(child)) {
		// show scrollbars
		child.style.overflow = 'auto';
		// attribute scrolling is not supported in html5 (but works on Chrome)
		child.setAttribute('scrolling', 'auto');
		child.removeAttribute('seamless');
		data.enabled = true;
	} else {
		// hide scrollbars
		child.style.overflow = 'hidden';
		child.setAttribute('scrolling', 'no');
		// this is html5, it supposedly also removes the scrollbars though,
		// that's why we don't use it all the time
		child.setAttribute('seamless', 'seamless');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/iframe/iframe.png';
	elem.alt = 'btn';
	elem.title = 'embed another webpage';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var url = prompt('Enter the URL to show');
		if (!url) {
			return;
		}
    // use protocol relative url
    url = '//' + url.split('//')[1];
		// create new object
		$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
			var elem = document.createElement('div');
			elem.className = 'iframe resizable object';
			elem.style.position = 'absolute';
			elem.id = data['name'];
			// default width and height is set in the css
			var child = document.createElement('iframe');
			child.style.backgroundColor = 'transparent';
			child.style.borderWidth = '0px';
			child.style.height = '100%';
			child.style.position = 'absolute';
			child.style.width = '100%';
			child.setAttribute('name', data['name']);
			child.setAttribute('src', url);
			elem.appendChild(child);
			// put the iframe behind some shield for editing
			var shield = document.createElement('div');
			shield.className = 'glue-iframe-shield glue-ui';
			shield.style.height = '100%';
			shield.style.position = 'absolute';
			shield.style.width = '100%';
			shield.title = 'visitors will be able to interact with the webpage below';
			elem.appendChild(shield);
			document.body.appendChild(elem);
			// make width and height explicit
			elem.style.width = elem.offsetWidth+'px';
			elem.style.height = elem.offsetHeight+'px';
			// move to mouseclick
			elem.style.left = (e.pageX-elem.offsetWidth/2)+'px';
			elem.style.top = (e.pageY-elem.offsetHeight/2)+'px';
			$.glue.object.register(elem);
			$.glue.object.save(elem);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem, 12);

	//
	// context menu items
	//
	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/iframe/iframe-url.png';
	elem.alt = 'btn';
	elem.title = 'change webpage url';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var child = obj.querySelector(':scope > iframe');
		var url = prompt('Enter the URL to show', window.location.protocol + child.getAttribute('src'));
		if (!url) {
			return;
		}
    // use protocol relative url
    url = '//' + url.split('//')[1];
		child.setAttribute('src', url);
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('iframe', 'iframe-url', elem);

	elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'iframe_scroll_sync', 'iframe_scroll_toggle',
		'scrollbars are shown - click to hide them', 'toggle scrollbars on and off');
	$.glue.contextmenu.register('iframe', 'iframe-scroll', elem);

	// make sure we don't send to much over the wire for every save
	// (obj here is edit.js's still-jQuery-wrapped save clone - kept as
	// jQuery until edit.js's save() is converted)
	$.glue.object.register_alter_pre_save('iframe', function(obj, orig) {
		$(obj).children('iframe').html('');
		$(obj).children('.glue-iframe-shield').remove();
	});
});
