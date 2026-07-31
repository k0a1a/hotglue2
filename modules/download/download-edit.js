/**
 *	modules/download/download-edit.js
 *	Frontend code for download objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 *
 */

<script>
	document.addEventListener('glue-upload-dynamic-early', function(e) {
		const mode = e.detail.mode;
		const targetX = e.detail.target_x;
		const targetY = e.detail.target_y;
		const el = e.currentTarget;

		if (mode === 'center') {
			el.style.left = (targetX - el.offsetWidth / 2) + 'px';
			el.style.top = (targetY - el.offsetHeight / 2) + 'px';
		} else {
			el.style.left = targetX + 'px';
			el.style.top = targetY + 'px';
		}

		// restore visibility
		el.style.visibility = el.dataset.origVisibility;
		delete el.dataset.origVisibility;

		// register object
		glue.object.register(el);
		// save object
		glue.object.save(el);
	}, false);
</script>

<div x-data="{ owner: null, isPublic: false }" x-init="owner = $el.dataset.owner">
	<img
		:src="'{{ $.glue.base_url }}img/download.png'"
		alt="btn"
		title="download file"
		width="32"
		height="32"
		@click="window.location = '{{ $.glue.base_url }}?{{ owner }}&download=1'"
		style="cursor: pointer;">
</div>

<div x-data="{ owner: null }" x-init="owner = $el.dataset.owner">
	<div
		@glue-menu-activate="checkPublicStatus(owner)"
		:class="{ 'glue-menu-enabled': isPublic, 'glue-menu-disabled': !isPublic }"
		style="height: 32px; width: 32px;">
	</div>
</div>

<script>
	function checkPublicStatus(owner) {
		glue.backend({ method: 'glue.load_object', name: owner }, function(data) {
			this.isPublic = data['download-public'] === 'public';
			this.updateTitle();
		}.bind(this));
	}

	function updateTitle() {
		if (this.isPublic) {
			this.$el.classList.add('glue-menu-enabled');
			this.$el.classList.remove('glue-menu-disabled');
			this.$el.setAttribute('title', 'this object is shown to everyone - click to make it private');
		} else {
			this.$el.classList.remove('glue-menu-enabled');
			this.$el.classList.add('glue-menu-disabled');
			this.$el.setAttribute('title', 'this object is only shown while editing - click to make it public');
		}
	}
</script>

<!-- Context menu toggle handler -->
<div x-data="{ owner: null }" x-init="owner = $el.dataset.owner">
	<div
		@click="togglePublicStatus(owner)"
		:class="{ 'glue-menu-enabled': isPublic, 'glue-menu-disabled': !isPublic }"
		style="height: 32px; width: 32px;">
	</div>
</div>

<script>
	function togglePublicStatus(owner) {
		if (this.isPublic) {
			this.isPublic = false;
			glue.backend({ method: 'glue.object_remove_attr', name: owner, attr: 'download-public' });
			this.updateTitle();
		} else {
			this.isPublic = true;
			glue.backend({ method: 'glue.update_object', name: owner, 'download-public': 'public' });
			this.updateTitle();
		}
	}
</script>
