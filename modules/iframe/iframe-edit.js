/**
 *	modules/iframe/iframe-edit.js
 *	Frontend code for iframe objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

<!-- New iframe menu item -->
<div x-data="{ page: null }" x-init="page = '{{ $.glue.page }}'">
	<img
		:src="'{{ $.glue.base_url }}modules/iframe/iframe.png'"
		alt="btn"
		title="embed another webpage"
		width="32"
		height="32"
		@click="createIframe()"
		style="cursor: pointer;">
</div>

<script>
	function createIframe() {
		var url = prompt('Enter the URL to show');
		if (!url) {
			return;
		}
		// use protocol relative url
		url = '//' + url.split('//')[1];
		// create new object
		glue.backend({ method: 'glue.create_object', 'page': this.page }, function(data) {
			var elem = document.createElement('div');
			elem.className = 'iframe resizable object';
			elem.style.position = 'absolute';
			elem.setAttribute('id', data['name']);

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
			child = document.createElement('div');
			child.className = 'glue-iframe-shield glue-ui';
			child.style.height = '100%';
			child.style.position = 'absolute';
			child.style.width = '100%';
			child.setAttribute('title', 'visitors will be able to interact with the webpage below');

			elem.appendChild(child);

			document.body.appendChild(elem);

			// make width and height explicit
			elem.style.width = elem.offsetWidth + 'px';
			elem.style.height = elem.offsetHeight + 'px';

			// move to mouseclick (placeholder)
			// In a real implementation, you'd need to track the mouse position
			// For now, we'll just position it at a default location
			elem.style.left = '100px';
			elem.style.top = '100px';

			glue.object.register(elem);
			glue.object.save(elem);
		});
	}
</script>

<!-- Context menu items -->

<!-- Change URL menu item -->
<div x-data="{ owner: null }" x-init="owner = $el.dataset.owner">
	<img
		:src="'{{ $.glue.base_url }}modules/iframe/iframe-url.png'"
		alt="btn"
		title="change webpage url"
		width="32"
		height="32"
		@click="changeUrl(owner)"
		style="cursor: pointer;">
</div>

<script>
	function changeUrl(owner) {
		var obj = document.getElementById(owner);
		var child = obj.querySelector('iframe');
		var url = prompt('Enter the URL to show', window.location.protocol + child.getAttribute('src'));
		if (!url) {
			return;
		}
		// use protocol relative url
		url = '//' + url.split('//')[1];
		child.setAttribute('src', url);
		glue.object.save(obj);
	}
</script>

<!-- Toggle scrollbars menu item -->
<div x-data="{ owner: null }" x-init="owner = $el.dataset.owner">
	<div
		style="height: 32px; width: 32px;"
		title="toggle scrollbars on and off"
		@click="toggleScrollbars(owner)"
		@glue-menu-activate="checkScrollbars(owner)">
		<!-- Scrollbar toggle icon would be here -->
	</div>
</div>

<script>
	function toggleScrollbars(owner) {
		var obj = document.getElementById(owner);
		var child = obj.querySelector('iframe');
		var currentOverflow = child.style.overflow;

		if (currentOverflow === 'hidden' || currentOverflow === '') {
			// show scrollbars
			child.style.overflow = 'auto';
			// attribute scrolling is not supported in html5 (but works on Chrome)
			child.setAttribute('scrolling', 'auto');
			child.removeAttribute('seamless');
			// this does not seem to work on recent Chrome without reloading the
			// iframe
			if (navigator.userAgent.toLowerCase().includes('webkit')) {
				child.setAttribute('src', child.getAttribute('src'));
			}
			this.$el.classList.add('glue-menu-enabled');
			this.$el.classList.remove('glue-menu-disabled');
		} else {
			// hide scrollbars
			child.style.overflow = 'hidden';
			child.setAttribute('scrolling', 'no');
			// this is html5, it supposedly also removes the scrollbars though,
			// that's why we don't use it all the time
			child.setAttribute('seamless', 'seamless');
			// this does not seem to work on recent Chrome without reloading the
			// iframe
			if (navigator.userAgent.toLowerCase().includes('webkit')) {
				child.setAttribute('src', child.getAttribute('src'));
			}
			this.$el.classList.remove('glue-menu-enabled');
			this.$el.classList.add('glue-menu-disabled');
		}
		glue.object.save(obj);
	}

	function checkScrollbars(owner) {
		var obj = document.getElementById(owner);
		var child = obj.querySelector('iframe');
		var currentOverflow = child.style.overflow;

		if (currentOverflow === 'hidden' || currentOverflow === '') {
			this.$el.classList.remove('glue-menu-enabled');
			this.$el.classList.add('glue-menu-disabled');
		} else {
			this.$el.classList.add('glue-menu-enabled');
			this.$el.classList.remove('glue-menu-disabled');
		}
	}
</script>
