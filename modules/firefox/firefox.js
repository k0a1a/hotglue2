document.addEventListener('DOMContentLoaded', function() {
	var isFirefox = /Firefox\//.test(navigator.userAgent);
	if (!isFirefox) {
		document.body.insertAdjacentHTML('beforeend', '<div id=\'firefox-msg\'><span id=\'firefox-text\'>We recommend <a href=\'http://getfirefox.org\' target=\'_new\'>Mozilla Firefox</a> for editing Hotglue pages. It seems like you are using a web-browser that is not yet fully compatible with Hotglue.<span id=\'firefox-dismiss\'>dismiss</span></span></div>');
		var msg = document.getElementById('firefox-msg');
		msg.style.overflow = 'hidden';
		msg.style.height = '0px';
		msg.style.display = 'block';
		msg.style.transition = 'height 600ms';
		setTimeout(function() {
			msg.style.height = msg.scrollHeight + 'px';
		}, 1000);
		document.getElementById('firefox-dismiss').addEventListener('click', function(e) {
			msg.remove();
		});
	}
});
