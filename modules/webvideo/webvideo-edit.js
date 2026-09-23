/**
 *	modules/webvideo/webvideo-edit.js
 *	Frontend code for webvideo objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = $.glue.icon('embed-webvideo', 'embed a video or audio track');
	elem.addEventListener('click', function(e) {
		var url = prompt('Enter the URL of a video or audio track to embed (YouTube, Vimeo, PeerTube, Bandcamp, SoundCloud, Mixcloud, Spotify)');
		if (!url) {
			return;
		}
		// the server resolves the url through the oEmbed whitelist (or the
		// Bandcamp template, or discovery), validates the response, caches
		// the embed and creates the object - the callback gets the service's
		// #data, the upload-shaped array of html strings, so it lands in
		// handle_response exactly like an uploaded file (SOW-oembed-media.md;
		// errors are toasted by glue.backend itself)
		$.glue.backend({ method: 'webvideo.resolve', 'url': url, 'page': $.glue.page }, function(data) {
			if (!data || !data.length) {
				$.glue.error('There was a problem embedding the link');
				return;
			}
			$.glue.upload.handle_response({ '#data': data }, e.pageX, e.pageY);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem, 13);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('webvideo', function(obj, orig) {
		var child = obj.querySelector(':scope > iframe');
		if (child) {
			child.innerHTML = '';
		}
		var shield = obj.querySelector(':scope > .glue-webvideo-shield');
		if (shield) {
			shield.remove();
		}
	});
});
