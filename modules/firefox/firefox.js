$(document).ready(function() {
	$firefox = $.browser.mozilla;
	if ($firefox != true) {
		$('body').append('<div id=\'firefox-msg\'><span id=\'firefox-text\'>We recommend <a href=\'http://getfirefox.org\' target=\'_new\'>Mozilla Firefox</a> for editing Hotglue pages. It seems like you are using a web-browser that is not yet fully compatible with Hotglue.<span id=\'firefox-dismiss\'>dismiss</span></span></div>');
		$('#firefox-msg').delay(1000).slideDown('slow');
		$('#firefox-dismiss').bind('click', function(e) {
			$('#firefox-msg').remove();
		});
	}
});
