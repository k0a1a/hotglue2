/**
 *	js/glue.js
 *	Auxiliary hotglue frontend code (Alpine.js version)
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

// Create global Alpine.js data object that replaces the jQuery $.glue namespace
document.addEventListener('alpine:init', () => {
	Alpine.data('glue', () => ({
		// Error state for frontend errors
		showErrors: false,

		// Backend communication method
		backend(param, func, print_errors) {
			// ten seconds timeout
			const timeout = 10000;

			// make sure parameters are json encoded
			// otherwise we would get complaints from the php parser for empty
			// strings, arrays and thelike
			for (let p in param) {
				param[p] = JSON.stringify(param[p]);
			}

			// Create the fetch request
			fetch(window.hotglue.base_url + 'json.php', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(param),
				timeout: timeout
			})
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.json();
			})
			.then(data => {
				if (print_errors === undefined) {
					print_errors = true;
				}
				if (data === null) {
					if (print_errors) {
						this.error('There was a problem communicating with the server');
					} else if (typeof func == 'function') {
						func({ '#error': true, '#data':'There was a problem communicating with the server' });
					}
				} else if (print_errors) {
					if (data['#error']) {
						this.error(data['#data']);
					} else if (typeof func == 'function') {
						func(data['#data']);
					}
				} else if (typeof func == 'function') {
					func(data);
				}
			})
			.catch(error => {
				if (print_errors) {
					this.error('There was a problem communicating with the server (ready state '+error.readyState+', status '+ error.status+')');
				} else if (typeof func == 'function') {
					func({ '#error': true, '#data':'There was a problem communicating with the server' });
				}
			});
		},

		// Error handling method
		error(s) {
			if (this.showErrors) {
				alert('The glue gun manufacturer says: '+s);
			}
		},

		// Initialize the glue data
		init() {
			// Initialize any necessary state here
			// The error handling is managed via the Alpine data properties
		}
	}));
});

// Set up global access to the Alpine.js glue data (for backward compatibility)
document.addEventListener('DOMContentLoaded', function() {
	// Make the Alpine data available globally for compatibility with existing code
	window.glue = {
		backend: (param, func, print_errors) => {
			// Call the Alpine data method
			const glueData = Alpine.store('glue');
			if (glueData) {
				return glueData.backend(param, func, print_errors);
			} else {
				// Fallback for direct calls when Alpine isn't fully initialized yet
				console.warn('Alpine glue data not initialized yet');
				return null;
			}
		},
		error: (s) => {
			// Call the Alpine data method
			const glueData = Alpine.store('glue');
			if (glueData) {
				return glueData.error(s);
			} else {
				// Fallback for direct calls when Alpine isn't fully initialized yet
				console.warn('Alpine glue data not initialized yet');
				return null;
			}
		},
		conf: {
			show_frontend_errors: false
		}
	};
});