document.addEventListener('DOMContentLoaded', function() {
	var msg = document.getElementById('welcome-msg');
	setTimeout(function() {
		msg.style.transition = 'opacity 500ms';
		msg.style.opacity = '0';
		msg.style.display = 'block';
		requestAnimationFrame(function() {
			requestAnimationFrame(function() {
				msg.style.opacity = '1';
			});
		});
	}, 1000);
	msg.addEventListener('click', function(e) {
		msg.style.transition = 'opacity 333ms';
		msg.style.opacity = '0';
		setTimeout(function() {
			msg.style.display = 'none';
		}, 333);
	});
});
