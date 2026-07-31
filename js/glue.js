/**
 *	js/glue.js
 *	Auxiliary hotglue frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// create dummy console functions
if (!window.console) {
	console = {};
}
console.log = console.log || function(){};
console.error = console.error || function(){};
console.warn = console.warn || function(){};
console.info = console.info || function(){};

$.glue = {};

// communication with the backend
$.glue.backend = function()
{
	return function(param, func, print_errors) {
		if (print_errors === undefined) {
			print_errors = true;
		}
		// make sure parameters are json encoded
		// otherwise we would get complaints from the php parser for empty
		// strings, arrays and thelike
		var body = new URLSearchParams();
		for (var p in param) {
			body.append(p, JSON.stringify(param[p]));
		}
		// ten seconds timeout
		var controller = new AbortController();
		var timeout = setTimeout(function() { controller.abort(); }, 10000);
		fetch($.glue.base_url+'json.php', {
			method: 'POST',
			body: body,
			signal: controller.signal
		}).then(function(response) {
			if (!response.ok) {
				throw new Error('status '+response.status);
			}
			return response.json();
		}).then(function(data) {
			if (data === null) {
				if (print_errors) {
					$.glue.error('There was a problem communicating with the server');
				} else if (typeof func == 'function') {
					func({ '#error': true, '#data':'There was a problem communicating with the server' });
				}
			} else if (print_errors) {
				if (data['#error']) {
					$.glue.error(data['#data']);
				} else if (typeof func == 'function') {
					func(data['#data']);
				}
			} else if (typeof func == 'function') {
				func(data);
			}
		}).catch(function(err) {
			if (err.name == 'AbortError') {
				// not really an error
				// these happen when navigating away while a request is in flight, or on timeout
				// see http://stackoverflow.com/questions/866771/jquery-ambiguous-ajax-error
			} else {
				$.glue.error('There was a problem communicating with the server ('+err.message+')');
			}
		}).finally(function() {
			clearTimeout(timeout);
		});
	};
}();

$.glue.error = function()
{
	return function(s) {
		if ($.glue.conf.show_frontend_errors) {
			alert('The glue gun manufacturer says: '+s);
		}
	};
}();
