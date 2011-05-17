$(document).ready(function() {
	$('#welcome-msg').delay(1000).fadeIn(500);
	$('#welcome-msg').bind('click', function(e) {
		$(this).hide(333);
	});
});
