/**
 * js/edit.js
 * Main hotglue frontend code (Alpine.js version)
 *
 * Copyright Gottfried Haider, Danja Vasiliev 2010.
 * This source code is licensed under the GNU General Public License.
 * See the file COPYING for more details.
 */

// Alpine.js data and methods
document.addEventListener('alpine:init', () => {
    Alpine.data('hotglueApp', () => ({
        // Application state
        objects: [],
        selectedObjects: [],
        canvasSize: { width: 0, height: 0 },
        gridMode: 0,
        gridX: 50,
        gridY: 50,
        colorpicker: {
            shown: false,
            color: null,
            changeFunc: null,
            finishFunc: null,
            transparency: false
        },
        contextMenu: {
            shown: false,
            owner: null,
            items: []
        },
        menu: {
            shown: false,
            currentMenu: null,
            spawnCoords: { x: 0, y: 0 }
        },
        dragState: {
            isDragging: false,
            startX: 0,
            startY: 0,
            mouseStartX: 0,
            mouseStartY: 0,
            prevGrid: false,
            prevX: 0,
            prevY: 0
        },
        resizeState: {
            prevGrid: false
        },
        keyMoving: false,
        upload: {
            uploading: 0,
            status: null
        },

        // Initialize the application
        init() {
            // Initialize objects array from DOM
            this.objects = Array.from(document.querySelectorAll('.object'));

            // Set up event listeners
            x-on:resize="handleResize()"
            x-on:click="handleGlobalClick($event)"
            document.body.addEventListener('keydown', this.handleKeyDown.bind(this));
            document.body.addEventListener('keyup', this.handleKeyUp.bind(this));

            // Initialize canvas size
            this.updateCanvasSize();

            // Set up drag and drop for objects
            this.setupDragAndDrop();

            // Setup keyboard events
            this.setupKeyboardEvents();
        },

        // Setup drag and drop functionality
        setupDragAndDrop() {
            const objects = document.querySelectorAll('.object');

            objects.forEach(obj => {
                // Setup drag start
                x-on:dragstart="handleDragStart($event, $el)"

                // Setup drag
                x-on:drag="handleDrag($event, $el)"

                // Setup drag end
                x-on:dragend="handleDragEnd($event, $el)"

                // Setup click for selection
                x-on:click="handleObjectClick($event, $el)"

                // Setup resize events
                if (obj.classList.contains('resizable')) {
                    obj.addEventListener('resize', (e) => {
                        this.handleResizeEvent(e, obj);
                    });
                }
            });
        },

        // Setup keyboard events
        setupKeyboardEvents() {
            // Keyboard events are already set up via event listeners above
        },

        // Handle window resize
        handleResize() {
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                this.updateCanvasSize();
            });
        },

        // Update canvas size based on objects
        updateCanvasSize() {
            let max_x = 0;
            let max_y = 0;

            this.objects.forEach(obj => {
                const rect = obj.getBoundingClientRect();
                const width = obj.offsetWidth;
                const height = obj.offsetHeight;

                if (max_x < rect.left + width) {
                    max_x = rect.left + width;
                }
                if (max_y < rect.top + height) {
                    max_y = rect.top + height;
                }
            });

            // Make body at least match the window width and height
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            if (max_x < windowWidth) {
                max_x = windowWidth;
            }
            if (max_y < windowHeight) {
                max_y = windowHeight;
            }

            // Set body dimensions
            document.body.style.width = max_x + 'px';
            document.body.style.height = max_y + 'px';

            // Update canvas size state
            this.canvasSize = { width: max_x, height: max_y };
        },

        // Handle drag start
        handleDragStart(e, obj) {
            // Store initial positions
            const rect = obj.getBoundingClientRect();
            this.dragState.startX = rect.left;
            this.dragState.startY = rect.top;
            this.dragState.mouseStartX = e.pageX;
            this.dragState.mouseStartY = e.pageY;

            // Trigger move start
            this.triggerEvent(obj, 'glue-movestart');
        },

        // Handle drag
        handleDrag(e, obj) {
            // Handle grid snapping when Ctrl is pressed
            if (e.ctrlKey) {
                if (this.gridMode & 1) { // Grid mode is enabled
                    // Apply grid snapping
                    const snappedX = Math.round(e.pageX / this.gridX) * this.gridX;
                    const snappedY = Math.round(e.pageY / this.gridY) * this.gridY;
                    obj.style.left = snappedX + 'px';
                    obj.style.top = snappedY + 'px';
                }
            }

            // Handle shift key for axis constraint
            if (e.shiftKey) {
                // Constrain to axis
                const dx = Math.abs(e.pageX - this.dragState.mouseStartX);
                const dy = Math.abs(e.pageY - this.dragState.mouseStartY);

                if (dx > dy) {
                    obj.style.left = this.dragState.startX + 'px';
                } else {
                    obj.style.top = this.dragState.startY + 'px';
                }
            }

            // Handle multi-object dragging
            if (this.selectedObjects.length > 1 && this.selectedObjects.includes(obj)) {
                // Drag all selected objects together
                const rect = obj.getBoundingClientRect();
                const offsetX = rect.left - this.dragState.startX;
                const offsetY = rect.top - this.dragState.startY;

                this.selectedObjects.forEach(selectedObj => {
                    if (selectedObj !== obj) {
                        const selectedRect = selectedObj.getBoundingClientRect();
                        selectedObj.style.left = (selectedRect.left + offsetX) + 'px';
                        selectedObj.style.top = (selectedRect.top + offsetY) + 'px';
                    }
                });
            }
        },

        // Handle drag end
        handleDragEnd(e, obj) {
            // Trigger move stop
            this.triggerEvent(obj, 'glue-movestop');

            // Save object position
            this.saveObject(obj);
        },

        // Handle object click for selection
        handleObjectClick(e, obj) {
            // Handle shift key for multi-select
            if (e.shiftKey) {
                if (this.isSelected(obj)) {
                    this.deselectObject(obj);
                } else {
                    this.selectObject(obj);
                }
            } else {
                // Clicking on non-selected object deselects all
                if (!this.isSelected(obj)) {
                    this.deselectAll();
                    this.selectObject(obj);
                }
            }

            // Prevent menu from firing
            e.stopPropagation();
        },

        // Handle global click for closing menus
        handleGlobalClick(e) {
            // Close colorpicker if clicked outside
            if (this.colorpicker.shown) {
                const colorpicker = document.getElementById('glue-colorpicker');
                if (colorpicker && !colorpicker.contains(e.target)) {
                    this.hideColorpicker();
                }
            }

            // Close menus if clicked outside
            if (!e.target.closest('.glue-ui')) {
                this.hideContextMenu();
                this.hideMenu();
            }

            // Deselect when clicking on background
            if (e.target === document.body) {
                this.deselectAll();
            }
        },

        // Handle key down events
        handleKeyDown(e) {
            switch (e.which) {
                case 9: // Tab
                    this.handleTabKey(e);
                    break;
                case 37: case 38: case 39: case 40: // Arrow keys
                    this.handleArrowKeys(e);
                    break;
                case 65: // Ctrl+A
                    if (e.ctrlKey) {
                        this.selectAll();
                        e.preventDefault();
                    }
                    break;
                case 68: // Ctrl+D
                    if (e.ctrlKey) {
                        this.deselectAll();
                        e.preventDefault();
                    }
                    break;
                case 73: // Ctrl+I
                    if (e.ctrlKey) {
                        this.invertSelection();
                        e.preventDefault();
                    }
                    break;
                case 46: // Delete
                    if (this.selectedObjects.length > 0) {
                        this.deleteSelectedObjects();
                        e.preventDefault();
                    }
                    break;
                case 33: // PageUp
                    if (e.shiftKey) {
                        this.moveSelectedToTop();
                        e.preventDefault();
                    }
                    break;
                case 34: // PageDown
                    if (e.shiftKey) {
                        this.moveSelectedToBottom();
                        e.preventDefault();
                    }
                    break;
                case 90: // Ctrl+Z
                    if (e.ctrlKey) {
                        this.showRevisionsBrowser();
                        e.preventDefault();
                    }
                    break;
            }
        },

        // Handle key up events
        handleKeyUp(e) {
            if (e.shiftKey && (e.which === 33 || e.which === 34)) {
                // Handle shift+pageup/page down
                e.preventDefault();
            } else if (e.which >= 37 && e.which <= 40) {
                // Stop key movement
                this.keyMoving = false;
                e.preventDefault();
            }
        },

        // Handle tab key for object navigation
        handleTabKey(e) {
            if (this.selectedObjects.length < 2) {
                const next = this.getNextObject();
                if (next) {
                    this.deselectAll();
                    this.selectObject(next);
                    // Scroll to object
                    this.scrollToObject(next);
                }
            }
            e.preventDefault();
        },

        // Handle arrow keys for movement
        handleArrowKeys(e) {
            if (this.selectedObjects.length > 0) {
                let addX = 0;
                let addY = 0;

                switch (e.which) {
                    case 37: addX = -1; break; // Left
                    case 38: addY = -1; break; // Up
                    case 39: addX = 1; break;  // Right
                    case 40: addY = 1; break;  // Down
                }

                // Shift multiplier
                if (e.shiftKey) {
                    addX *= this.gridX;
                    addY *= this.gridY;
                }

                this.moveSelectedObjects(addX, addY);
                e.preventDefault();
            }
        },

        // Get next object in sequence
        getNextObject() {
            const selected = this.selectedObjects[0];
            if (!selected) {
                return document.querySelector('.object');
            }

            const next = selected.nextElementSibling;
            if (next && next.classList.contains('object')) {
                return next;
            }

            return document.querySelector('.object');
        },

        // Scroll to object
        scrollToObject(obj) {
            const rect = obj.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            if (rect.left < 0) {
                window.scrollBy(rect.left, 0);
            } else if (rect.right > windowWidth) {
                window.scrollBy(rect.right - windowWidth, 0);
            }

            if (rect.top < 0) {
                window.scrollBy(0, rect.top);
            } else if (rect.bottom > windowHeight) {
                window.scrollBy(0, rect.bottom - windowHeight);
            }
        },

        // Select an object
        selectObject(obj) {
            if (!this.isSelected(obj)) {
                obj.classList.add('glue-selected');
                this.selectedObjects.push(obj);
                this.triggerEvent(obj, 'glue-select');
            }
        },

        // Deselect an object
        deselectObject(obj) {
            if (this.isSelected(obj)) {
                obj.classList.remove('glue-selected');
                const index = this.selectedObjects.indexOf(obj);
                if (index > -1) {
                    this.selectedObjects.splice(index, 1);
                }
                this.triggerEvent(obj, 'glue-deselect');
            }
        },

        // Select all objects
        selectAll() {
            this.deselectAll();
            const objects = document.querySelectorAll('.object:not(.locked)');
            objects.forEach(obj => {
                this.selectObject(obj);
            });
        },

        // Deselect all objects
        deselectAll() {
            this.selectedObjects.forEach(obj => {
                obj.classList.remove('glue-selected');
                this.triggerEvent(obj, 'glue-deselect');
            });
            this.selectedObjects = [];
        },

        // Invert selection
        invertSelection() {
            const allObjects = document.querySelectorAll('.object:not(.locked)');
            const selected = new Set(this.selectedObjects);

            this.deselectAll();

            allObjects.forEach(obj => {
                if (!selected.has(obj)) {
                    this.selectObject(obj);
                }
            });
        },

        // Check if object is selected
        isSelected(obj) {
            return this.selectedObjects.includes(obj);
        },

        // Move selected objects
        moveSelectedObjects(dx, dy) {
            this.selectedObjects.forEach(obj => {
                if (!obj.classList.contains('locked')) {
                    const rect = obj.getBoundingClientRect();
                    obj.style.left = (rect.left + dx) + 'px';
                    obj.style.top = (rect.top + dy) + 'px';
                }
            });
        },

        // Delete selected objects
        deleteSelectedObjects() {
            const objectsToDelete = this.selectedObjects.filter(obj => !obj.classList.contains('locked'));

            objectsToDelete.forEach(obj => {
                const id = obj.id;
                this.triggerEvent(obj, 'glue-unregister');
                obj.remove();

                // Delete in backend
                this.backendCall('glue.delete_object', { name: id });
            });

            this.deselectAll();
            this.updateCanvasSize();
        },

        // Move selected objects to top
        moveSelectedToTop() {
            this.selectedObjects.forEach(obj => {
                if (!obj.classList.contains('locked')) {
                    this.moveToTop(obj);
                    this.saveObject(obj);
                }
            });
            this.compressStack();
        },

        // Move selected objects to bottom
        moveSelectedToBottom() {
            this.selectedObjects.forEach(obj => {
                if (!obj.classList.contains('locked')) {
                    this.moveToBottom(obj);
                    this.saveObject(obj);
                }
            });
            this.compressStack();
        },

        // Move object to top of stack
        moveToTop(obj) {
            const zIndex = parseInt(obj.style.zIndex) || 100;
            const maxZ = 199;
            if (zIndex < maxZ) {
                obj.style.zIndex = (zIndex + 1).toString();
            }
        },

        // Move object to bottom of stack
        moveToBottom(obj) {
            const zIndex = parseInt(obj.style.zIndex) || 100;
            const minZ = 0;
            if (zIndex > minZ) {
                obj.style.zIndex = (zIndex - 1).toString();
            }
        },

        // Compress stack
        compressStack() {
            // Implementation would go here
        },

        // Save object state
        saveObject(obj) {
            const html = obj.outerHTML;
            this.backendCall('glue.save_state', { html: html });
        },

        // Handle resize event
        handleResizeEvent(e, obj) {
            // Handle resize events
            this.triggerEvent(obj, 'glue-resize');
        },

        // Trigger custom events
        triggerEvent(obj, eventName) {
            const event = new CustomEvent(eventName, { detail: obj });
            obj.dispatchEvent(event);
        },

        // Backend call using fetch
        backendCall(method, params) {
            const url = window.hotglue.base_url + 'json.php';

            const data = {
                method: method,
                ...params
            };

            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                console.log('Backend response:', data);
            })
            .catch(error => {
                console.error('Backend error:', error);
            });
        },

        // Show color picker
        showColorpicker(def, transp, change, finish) {
            this.colorpicker.shown = true;
            this.colorpicker.color = def;
            this.colorpicker.changeFunc = change;
            this.colorpicker.finishFunc = finish;
            this.colorpicker.transparency = transp;
        },

        // Hide color picker
        hideColorpicker() {
            if (this.colorpicker.shown) {
                this.colorpicker.shown = false;
                this.colorpicker.changeFunc = null;
                this.colorpicker.finishFunc = null;
                this.colorpicker.color = null;
            }
        },

        // Show context menu
        showContextMenu(obj) {
            this.contextMenu.shown = true;
            this.contextMenu.owner = obj;
        },

        // Hide context menu
        hideContextMenu() {
            this.contextMenu.shown = false;
            this.contextMenu.owner = null;
        },

        // Show menu
        showMenu(menu, x, y) {
            this.menu.shown = true;
            this.menu.currentMenu = menu;
            this.menu.spawnCoords = { x, y };
        },

        // Hide menu
        hideMenu() {
            this.menu.shown = false;
            this.menu.currentMenu = null;
        },

        // Show revisions browser
        showRevisionsBrowser() {
            if (confirm('Looking for an "undo" option?\nHOTGLUE keeps record of your recent edits - it\'s called "revisions".\nWould you like to browse through the revisions of this page?')) {
                window.location = window.hotglue.base_url + '?' + window.hotglue.page + '/revisions';
            }
        }
    }));
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Hotglue Alpine.js initialized');
    Alpine.init();
});