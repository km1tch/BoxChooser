// Main component that manages floorplan viewing and location editing
// Uses coordinate-based lookup system for efficient location operations
import { FloorplanViewer } from './floorplan-viewer.js';
import { FloorplanUpload } from './floorplan-upload.js';

export class FloorplanLocationEditor {
    constructor(storeId) {
        this.storeId = storeId;
        this.mode = 'view'; // 'view' or 'edit'
        this.boxes = [];
        this.locations = {}; // maps box index to location
        this.locationsByCoords = {}; // Maps coordinate string "x_y" to array of box indices
        this.selectedLocation = null;
        this.floorplanViewer = null;
        this.floorplanUpload = null;
        
        this.init();
    }
    
    /**
     * Helper method to make authenticated requests
     */
    async authenticatedFetch(url, options = {}) {
        // Add auth token if available
        if (typeof AuthManager !== 'undefined') {
            const token = AuthManager.getToken(this.storeId);
            if (token) {
                options.headers = options.headers || {};
                options.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return fetch(url, options);
    }

    async init() {
        // Check floorplan status first before initializing components
        await this.checkFloorplanStatus();
        
        // Only initialize viewer and controls if we have a floorplan
        if (this.hasFloorplan) {
            await this.initViewer();
            this.initUpload();
            this.initModeControls();
            this.initPanels();
            await this.loadData();
            
            // Show unassigned boxes in view mode
            setTimeout(() => {
                if (this.mode === 'view') {
                    this.showUnassignedInPanel();
                }
            }, 500);
        }
    }

    async initViewer() {
        const viewerElement = document.getElementById('floorplan-viewer');
        this.floorplanViewer = new FloorplanViewer(viewerElement, {
            mode: 'view',
            storeId: this.storeId,
            showMarkers: true,
            onLocationSelect: (location) => this.handleLocationClick(location),
            onFloorplanClick: (coords) => this.handleFloorplanClick(coords),
            onMarkerDelete: (marker) => this.handleMarkerDelete(marker),
            onMarkerMove: (markerData) => this.handleMarkerMove(markerData)
        });
        // The FloorplanViewer constructor calls init() automatically, but it's async
        // We need to wait for it to complete
        // Wait a bit longer to ensure the viewer is fully initialized
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Wait for the floorplan image to load before adding markers
        if (this.floorplanViewer.image) {
            await new Promise((resolve) => {
                if (this.floorplanViewer.image.complete) {
                    resolve();
                } else {
                    this.floorplanViewer.image.addEventListener('load', resolve, { once: true });
                }
            });
        }
        
        // Now update the viewer with markers
        this.updateViewer();
    }

    initUpload() {
        const uploadContainer = document.getElementById('upload-container');
        if (uploadContainer) {
            this.floorplanUpload = new FloorplanUpload(uploadContainer, this.storeId, {
                onUploadSuccess: (result) => {
                    let message = 'Floorplan uploaded successfully!';
                    if (result.locations_cleared > 0) {
                        message += ` ${result.locations_cleared} location coordinates were cleared.`;
                    }
                    alert(message);
                    // Refresh the page to show the new floorplan
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                },
                onUploadError: (error) => {
                    console.error('Upload error:', error);
                    alert('Failed to upload floorplan');
                }
            });
        }
    }

    initModeControls() {
        // Toggle switch
        const toggleSwitch = document.getElementById('mode-toggle-switch');
        const viewLabel = document.getElementById('view-label');
        const editLabel = document.getElementById('edit-label');
        
        toggleSwitch.addEventListener('click', () => {
            const isEdit = toggleSwitch.classList.contains('active');
            const newMode = isEdit ? 'view' : 'edit';
            
            // Update switch visual state
            toggleSwitch.classList.toggle('active');
            
            // Update labels
            viewLabel.classList.toggle('active', newMode === 'view');
            editLabel.classList.toggle('active', newMode === 'edit');
            
            // Set the mode
            this.setMode(newMode);
        });

        // Removed show unassigned button - now automatic in view mode
    }

    initPanels() {
        // Box selector panel
        const closeBoxSelector = document.getElementById('close-box-selector');
        closeBoxSelector.addEventListener('click', () => this.closeBoxSelector());
        
        const saveLocation = document.getElementById('save-location');
        saveLocation.addEventListener('click', () => this.saveLocationAssignment());
        
        const cancelLocation = document.getElementById('cancel-location');
        cancelLocation.addEventListener('click', () => this.closeBoxSelector());
        
        // Search functionality
        const boxSearch = document.getElementById('box-search');
        boxSearch.addEventListener('input', (e) => this.filterBoxes(e.target.value));
    }

    async loadData() {
        try {
            // Load boxes
            const boxesResponse = await this.authenticatedFetch(`/api/store/${this.storeId}/boxes`);
            if (boxesResponse.ok) {
                const data = await boxesResponse.json();
                this.boxes = data.boxes || []; // Extract boxes array from YAML data
                
                // Clear locations before repopulating
                this.locations = {};
                this.locationsByCoords = {};
                
                // Build locations from the boxes data directly
                this.boxes.forEach((box, index) => {
                    if (box.location && box.location.coords && box.location.coords.length === 2) {
                        // Store the location
                        this.locations[index] = {
                            coords: box.location.coords
                        };
                        
                        // Update locationsByCoords map
                        const coordKey = `${box.location.coords[0]}_${box.location.coords[1]}`;
                        if (!this.locationsByCoords[coordKey]) {
                            this.locationsByCoords[coordKey] = [];
                        }
                        this.locationsByCoords[coordKey].push(index.toString());
                    }
                });
                
                // Update viewer if it exists
                if (this.floorplanViewer) {
                    this.updateViewer();
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    setMode(mode) {
        this.mode = mode;
        const modeIndicator = document.getElementById('mode-indicator');
        
        // Only proceed with viewer-related operations if viewer exists
        if (!this.floorplanViewer) {
            return;
        }
        
        if (mode === 'edit') {
            if (modeIndicator) modeIndicator.classList.add('visible');
            this.floorplanViewer.setMode('edit');
            this.floorplanViewer.options.mode = 'edit'; // Ensure the viewer knows it's in edit mode
            
            // Make marker layer clickable
            const markerLayer = document.querySelector('.marker-layer');
            if (markerLayer) {
                markerLayer.classList.add('edit-mode');
            }
            
            // Close any open panel to prepare for edit mode
            const panel = document.getElementById('box-selector-panel');
            if (panel && panel.classList.contains('open')) {
                panel.classList.remove('open');
            }
            
            // Force marker refresh to show controls
            this.floorplanViewer.clearMarkers('all');
            this.updateViewer();
        } else {
            if (modeIndicator) modeIndicator.classList.remove('visible');
            this.floorplanViewer.setMode('view');
            this.floorplanViewer.options.mode = 'view'; // Ensure the viewer knows it's in view mode
            
            // Make marker layer non-clickable
            const markerLayer = document.querySelector('.marker-layer');
            if (markerLayer) {
                markerLayer.classList.remove('edit-mode');
            }
            
            // In view mode, show unassigned boxes in the panel
            this.showUnassignedInPanel();
            
            // Force marker refresh to hide controls
            this.floorplanViewer.clearMarkers('all');
            this.updateViewer();
        }
        
        // Only show action buttons if we have a floorplan
        if (this.hasFloorplan) {
            const actionControls = document.querySelector('.location-action-controls');
            if (actionControls) {
                actionControls.style.display = 'flex';
            } else {
                // Initialize the buttons if they don't exist yet
                this.updateModeControls();
            }
        }
    }
    
    // New methods for handling marker operations
    
    /**
     * Handles deletion of a marker
     */
    async handleMarkerDelete(marker) {
        // Always allow delete operation regardless of mode
        
        // Ask for confirmation with clearer message
        if (!confirm('Are you sure you want to delete this location? Any boxes currently assigned here will become unassigned.')) {
            return;
        }
        
        try {
            // Get all boxes at this location using the coordinate lookup
            const coordKey = `${marker.coords[0]}_${marker.coords[1]}`;
            const boxesAtLocation = this.locationsByCoords[coordKey] || [];
            
            if (boxesAtLocation.length === 0) {
                console.warn('No boxes found at this location for deletion');
                return;
            }
            
            // Create changes object with model keys for all affected boxes
            const changes = {};
            const modelMapping = this.boxes.map((box, index) => {
                const model = box.model || `Unknown-${box.dimensions.length}-${box.dimensions[0]}-${box.dimensions[1]}-${box.dimensions[2]}`;
                return { index, model };
            });
            
            // Set up the changes to clear locations
            boxesAtLocation.forEach(boxId => {
                const boxInfo = modelMapping.find(m => m.index === parseInt(boxId));
                if (boxInfo) {
                    changes[boxInfo.model] = {};
                }
            });
            
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substr(2) + Date.now().toString(36);
            
            // Process box deletion
            
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (response.ok) {
                // Update local locations data
                boxesAtLocation.forEach(boxId => {
                    if (this.locations[boxId]) {
                        this.locations[boxId] = {};
                    }
                });
                
                // Remove this entry from locationsByCoords
                delete this.locationsByCoords[coordKey];
                
                // Clear the marker
                this.floorplanViewer.clearMarkers('all');
                this.updateViewer();
                
                // Re-apply box list filter if active
                this.refreshBoxListFilter();
                
                // Refresh unassigned boxes
                setTimeout(() => {
                    if (this.mode === 'view') {
                        this.showUnassignedInPanel();
                    }
                }, 100);
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'success-message';
                successMsg.textContent = `Successfully removed ${boxesAtLocation.length} boxes from this location.`;
                successMsg.style.cssText = `
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #dff0d8;
                    color: #3c763d;
                    padding: 15px 25px;
                    border-radius: 4px;
                    font-size: 16px;
                    z-index: 1000;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                `;
                document.body.appendChild(successMsg);
                
                // Remove after 3 seconds
                setTimeout(() => {
                    successMsg.remove();
                }, 3000);
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to delete location: ${errorData?.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting location:', error);
            alert('Failed to delete location: ' + error.message);
        }
    }
    
    /**
     * Handles moving a marker to a new position
     * Works in both view and edit modes
     */
    async handleMarkerMove(markerData) {
        // Allow moves in both view and edit modes
        
        try {
            // Get all boxes at the old location using the coordinate lookup
            const oldCoordKey = `${markerData.oldCoords[0]}_${markerData.oldCoords[1]}`;
            const boxesAtLocation = this.locationsByCoords[oldCoordKey] || [];
            
            if (boxesAtLocation.length === 0) {
                console.warn('No boxes found at this location for movement');
                return;
            }
            
            // Create changes object with model keys for all affected boxes
            const changes = {};
            const modelMapping = this.boxes.map((box, index) => {
                const model = box.model || `Unknown-${box.dimensions.length}-${box.dimensions[0]}-${box.dimensions[1]}-${box.dimensions[2]}`;
                return { index, model };
            });
            
            // Set up the changes to update locations
            boxesAtLocation.forEach(boxId => {
                const boxInfo = modelMapping.find(m => m.index === parseInt(boxId));
                if (boxInfo) {
                    changes[boxInfo.model] = {
                        coords: markerData.newCoords
                    };
                }
            });
            
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substr(2) + Date.now().toString(36);
            
            // Process marker movement
            
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (response.ok) {
                // Update local locations data and locationsByCoords
                const newCoordKey = `${markerData.newCoords[0]}_${markerData.newCoords[1]}`;
                
                // Remove the boxes from the old location in locationsByCoords
                delete this.locationsByCoords[oldCoordKey];
                
                // Initialize the new location array if it doesn't exist
                if (!this.locationsByCoords[newCoordKey]) {
                    this.locationsByCoords[newCoordKey] = [];
                }
                
                // Update both locations object and locationsByCoords map
                boxesAtLocation.forEach(boxId => {
                    if (this.locations[boxId]) {
                        this.locations[boxId] = {
                            coords: markerData.newCoords
                        };
                        
                        // Add to the new location in locationsByCoords
                        this.locationsByCoords[newCoordKey].push(boxId.toString());
                    }
                });
                
                // Refresh the markers
                this.updateViewer();
                
                // Re-apply box list filter if active
                this.refreshBoxListFilter();
                
                // Refresh unassigned boxes list if in view mode
                setTimeout(() => {
                    if (this.mode === 'view') {
                        this.showUnassignedInPanel();
                    }
                }, 100);
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to move location: ${errorData?.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error moving location:', error);
            alert('Failed to move location: ' + error.message);
            
            // Reset the marker to its original position
            this.updateViewer();
        }
    }

    handleFloorplanClick(coords) {
        if (this.mode !== 'edit') return;
        
        // If we're in move or delete mode, don't create new markers
        if (this.markerCreationDisabled) return;
        
        // Create a new location at this point
        this.selectedLocation = {
            coords: coords,
            id: `${coords[0]}_${coords[1]}`
        };
        
        // Add a temporary marker at this location
        this.floorplanViewer.clearMarkers('temp');
        this.floorplanViewer.addMarker(coords[0], coords[1], 'temp', '');
        
        // Check if we have a box selected for quick assignment
        if (this.selectedBoxForQuickAssign !== undefined) {
            // Directly assign this box to the location
            const updatedLocations = { ...this.locations };
            updatedLocations[this.selectedBoxForQuickAssign] = {
                coords: coords
            };
            
            // Save the assignment
            this.saveQuickAssignment(updatedLocations);
            
            // Clear the instruction
            const instruction = document.getElementById('assignment-instruction');
            if (instruction) {
                instruction.style.display = 'none';
            }
            
            this.selectedBoxForQuickAssign = undefined;
        } else {
            // Open box selector for normal assignment
            this.openBoxSelector();
        }
    }
    
    async saveQuickAssignment(updatedLocations) {
        try {
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substr(2) + Date.now().toString(36);
            
            // Create changes object with box models as keys instead of indices
            const changes = {};
            
            // Create a mapping from box index to model
            const modelMapping = this.boxes.map((box, index) => {
                const model = box.model || `Unknown-${box.dimensions.length}-${box.dimensions[0]}-${box.dimensions[1]}-${box.dimensions[2]}`;
                return { index, model };
            });
            
            // Convert the updatedLocations (with indices as keys) to use models as keys
            Object.entries(updatedLocations).forEach(([boxIndex, location]) => {
                const boxInfo = modelMapping.find(m => m.index === parseInt(boxIndex));
                if (boxInfo) {
                    changes[boxInfo.model] = location;
                }
            });
            
            // Use models as keys for API
            
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (response.ok) {
                // Process each updated location
                Object.entries(updatedLocations).forEach(([boxIndex, location]) => {
                    const boxIdInt = parseInt(boxIndex, 10);
                    const oldLocation = this.locations[boxIdInt];
                    
                    // Remove from old location in locationsByCoords if it exists
                    if (oldLocation && oldLocation.coords) {
                        const oldCoordKey = `${oldLocation.coords[0]}_${oldLocation.coords[1]}`;
                        
                        if (this.locationsByCoords[oldCoordKey]) {
                            // Remove this box from the old location
                            this.locationsByCoords[oldCoordKey] = this.locationsByCoords[oldCoordKey].filter(
                                id => parseInt(id, 10) !== boxIdInt
                            );
                            
                            // Clean up empty locations
                            if (this.locationsByCoords[oldCoordKey].length === 0) {
                                delete this.locationsByCoords[oldCoordKey];
                            }
                        }
                    }
                    
                    // Add to new location in locationsByCoords if it has coords
                    if (location && location.coords) {
                        const newCoordKey = `${location.coords[0]}_${location.coords[1]}`;
                        
                        // Ensure the destination exists in locationsByCoords
                        if (!this.locationsByCoords[newCoordKey]) {
                            this.locationsByCoords[newCoordKey] = [];
                        }
                        
                        // Add to the new location if not already there
                        if (!this.locationsByCoords[newCoordKey].includes(boxIndex.toString())) {
                            this.locationsByCoords[newCoordKey].push(boxIndex.toString());
                        }
                    }
                });
                
                // Update locations object
                this.locations = updatedLocations;
                this.updateViewer();
                
                // Re-apply box list filter if active
                this.refreshBoxListFilter();
                
                // Switch back to view mode
                this.setMode('view');
                
                // Update the toggle switch UI
                const toggleSwitch = document.getElementById('mode-toggle-switch');
                const viewLabel = document.getElementById('view-label');
                const editLabel = document.getElementById('edit-label');
                toggleSwitch.classList.remove('active');
                viewLabel.classList.add('active');
                editLabel.classList.remove('active');
                
                // Refresh the unassigned box list to reflect the change
                setTimeout(() => {
                    if (this.mode === 'view') {
                        this.showUnassignedInPanel();
                    }
                }, 100);
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to save locations: ${errorData?.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving locations:', error);
            alert('Failed to save location assignment: ' + error.message);
        }
    }

    handleLocationClick(location) {
        // Handle location click event
        
        // If in merge mode, handle merge selection
        if (this.mergeMode === true) {
            this.handleMergeSelection(location);
            return;
        }
        
        // If in delete mode, handle delete operation
        if (this.deleteMode === true) {
            // Delete the marker
            this.handleMarkerDelete(location);
            
            // Stay in delete mode to allow deleting multiple markers
            return;
        }
        
        // If in move mode, don't do anything (handled by drag event)
        if (this.moveMode === true) {
            return;
        }
        
        // Default action based on mode
        if (this.mode === 'view') {
            // Show boxes assigned to this location in the panel
            this.showLocationBoxes(location);
        } else if (this.mode === 'edit') {
            // Edit this location
            this.selectedLocation = location;
            this.openBoxSelector();
            
            // Re-apply the filter if active - use our helper method for consistency
            this.refreshBoxListFilter();
        }
    }
    
    handleMergeSelection(location) {
        // Handle based on current step
        if (this.mergeStep === 1) {
            // First selection - source marker
            this.mergeSource = location;
            
            // Mark the marker visually
            const markers = document.querySelectorAll('.location-marker');
            markers.forEach(marker => {
                if (marker.dataset.id !== 'temp' && 
                    parseFloat(marker.dataset.x) === location.coords[0] && 
                    parseFloat(marker.dataset.y) === location.coords[1]) {
                    marker.classList.add('merge-source');
                }
            });
            
            // Move to step 2
            this.mergeStep = 2;
            this.updateMergeStep();
        } else if (this.mergeStep === 2) {
            // Second selection - destination marker
            // Don't allow selecting the same marker
            if (this.mergeSource.coords[0] === location.coords[0] && 
                this.mergeSource.coords[1] === location.coords[1]) {
                alert("Please select a different destination marker. You can't merge a marker with itself.");
                return;
            }
            
            this.mergeDestination = location;
            
            // Mark the marker visually
            const markers = document.querySelectorAll('.location-marker');
            markers.forEach(marker => {
                if (marker.dataset.id !== 'temp' && 
                    parseFloat(marker.dataset.x) === location.coords[0] && 
                    parseFloat(marker.dataset.y) === location.coords[1]) {
                    marker.classList.add('merge-destination');
                }
            });
            
            // Show confirmation dialog
            this.showMergeConfirmation();
        }
    }
    
    showMergeConfirmation() {
        // Get boxes at each location using coordinate lookup
        const sourceCoordKey = `${this.mergeSource.coords[0]}_${this.mergeSource.coords[1]}`;
        const destCoordKey = `${this.mergeDestination.coords[0]}_${this.mergeDestination.coords[1]}`;
        
        const sourceBoxes = this.locationsByCoords[sourceCoordKey] || [];
        const destBoxes = this.locationsByCoords[destCoordKey] || [];
        
        // Create confirmation popup
        if (confirm(`Merge ${sourceBoxes.length} boxes from the selected source location to the destination location? This action cannot be undone.`)) {
            this.performMerge(sourceBoxes);
        } else {
            // Just clear the destination selection and go back to step 2
            const destMarker = document.querySelector('.merge-destination');
            if (destMarker) destMarker.classList.remove('merge-destination');
            this.mergeDestination = null;
        }
    }
    
    async performMerge(sourceBoxes) {
        try {
            // Create changes object with model keys for all affected boxes
            const changes = {};
            const modelMapping = this.boxes.map((box, index) => {
                const model = box.model || `Unknown-${box.dimensions.length}-${box.dimensions[0]}-${box.dimensions[1]}-${box.dimensions[2]}`;
                return { index, model };
            });
            
            // Set up the changes to update source locations to destination
            sourceBoxes.forEach(boxId => {
                const boxInfo = modelMapping.find(m => m.index === parseInt(boxId));
                if (boxInfo) {
                    changes[boxInfo.model] = {
                        coords: this.mergeDestination.coords
                    };
                }
            });
            
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substr(2) + Date.now().toString(36);
            
            // Process marker merging
            
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (response.ok) {
                // Get coordinate keys
                const sourceCoordKey = `${this.mergeSource.coords[0]}_${this.mergeSource.coords[1]}`;
                const destCoordKey = `${this.mergeDestination.coords[0]}_${this.mergeDestination.coords[1]}`;
                
                // Update local locations data
                sourceBoxes.forEach(boxId => {
                    if (this.locations[boxId]) {
                        this.locations[boxId] = {
                            coords: this.mergeDestination.coords
                        };
                    }
                });
                
                // Update locationsByCoords
                // 1. Remove the old source location
                delete this.locationsByCoords[sourceCoordKey];
                
                // 2. Ensure destination location exists
                if (!this.locationsByCoords[destCoordKey]) {
                    this.locationsByCoords[destCoordKey] = [];
                }
                
                // 3. Add all source boxes to destination location
                sourceBoxes.forEach(boxId => {
                    this.locationsByCoords[destCoordKey].push(boxId.toString());
                });
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'success-message';
                successMsg.textContent = `Successfully merged ${sourceBoxes.length} boxes to the destination location.`;
                successMsg.style.cssText = `
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #dff0d8;
                    color: #3c763d;
                    padding: 15px 25px;
                    border-radius: 4px;
                    font-size: 16px;
                    z-index: 1000;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                `;
                document.body.appendChild(successMsg);
                
                // Remove after 3 seconds
                setTimeout(() => {
                    successMsg.remove();
                }, 3000);
                
                // Exit merge mode and refresh the viewer
                this.exitMergeMode();
                this.updateViewer();
                
                // Re-apply box list filter if in edit mode
                this.refreshBoxListFilter();
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to merge locations: ${errorData?.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error merging locations:', error);
            alert('Failed to merge locations: ' + error.message);
            this.exitMergeMode();
        }
    }

    openBoxSelector() {
        const panel = document.getElementById('box-selector-panel');
        const header = panel.querySelector('.box-selector-header h3');
        const saveButton = document.getElementById('save-location');
        const cancelButton = document.getElementById('cancel-location');
        const searchBox = document.getElementById('box-search');
        
        // Set up UI for box selection
        header.textContent = 'Select Boxes for Location';
        saveButton.style.display = '';
        cancelButton.textContent = 'Cancel';
        cancelButton.style.display = '';
        searchBox.style.display = '';
        searchBox.value = '';
        
        // Show filter checkbox in edit mode
        this.addFilterCheckbox();
        const filterContainer = document.getElementById('filter-container');
        if (filterContainer) {
            filterContainer.style.display = 'block';
        }
        
        panel.classList.add('open');
        
        // Check if filter is active and respect its status
        const hideAssignedCheckbox = document.getElementById('hide-assigned');
        const shouldHideAssigned = hideAssignedCheckbox && hideAssignedCheckbox.checked;
        
        // Load boxes into the panel with current filter state
        this.renderBoxList(shouldHideAssigned);
    }

    closeBoxSelector() {
        const panel = document.getElementById('box-selector-panel');
        panel.classList.remove('open');
        this.selectedLocation = null;
        
        // Clear selections
        const boxItems = document.querySelectorAll('.box-item');
        boxItems.forEach(item => item.classList.remove('selected'));
        
        // Clear temporary marker
        this.floorplanViewer.clearMarkers('temp');
        
        // Restore UI for edit mode
        const header = panel.querySelector('.box-selector-header h3');
        const saveButton = document.getElementById('save-location');
        const cancelButton = document.getElementById('cancel-location');
        const searchBox = document.getElementById('box-search');
        
        header.textContent = 'Select Boxes for Location';
        saveButton.style.display = '';
        cancelButton.textContent = 'Cancel';
        searchBox.style.display = '';
    }

    renderBoxList(onlyUnassigned = false) {
        const boxList = document.getElementById('box-list');
        boxList.innerHTML = '';
        
        this.boxes.forEach((box, index) => {
            // Skip boxes that don't have valid data
            if (!box || !box.dimensions) {
                console.warn(`Box at index ${index} is missing data or undefined`);
                return;
            }
            
            // Check if the box has a valid location
            const hasValidLocation = this.hasValidLocation(index);
            const locationId = this.getLocationForBox(index);
            // Use the more reliable method to check if box is actually in a location
            const isInMapping = this.isBoxInLocationMapping(index);
            const isAssigned = hasValidLocation && isInMapping;
            
            // Check if this box is currently at the selected location
            const isAtSelectedLocation = this.selectedLocation && locationId === this.selectedLocation.id;
            
            // Skip boxes assigned to other locations if filter is on
            // Show: boxes at current location OR boxes not on floorplan
            if (onlyUnassigned && isAssigned && !isAtSelectedLocation) return;
            
            const boxItem = document.createElement('div');
            boxItem.className = 'box-item';
            if (isAssigned) boxItem.classList.add('assigned');
            if (isAtSelectedLocation) boxItem.classList.add('selected');
            
            // Store the actual box index as a data attribute to handle filtered views correctly
            boxItem.dataset.boxIndex = index.toString();
            
            // Format dimensions - safer version that checks if dimensions are valid
            const dims = box.dimensions;
            const dimensionStr = Array.isArray(dims) && dims.length >= 3 
                ? `${dims[0]}"×${dims[1]}"×${dims[2]}"`
                : "Unknown dimensions";
            
            const modelStr = box.model || `Box ${index + 1}`;
            const typeStr = box.type || 'Unknown';
            
            // Add an indicator for boxes with invalid locations
            const statusHtml = hasValidLocation 
                ? (isAssigned && !isAtSelectedLocation ? '<div class="box-status">Assigned</div>' : '')
                : '<div class="box-status" style="background-color: #ffd2d2; color: #721c24;">Not on Floorplan</div>';
            
            boxItem.innerHTML = `
                <div class="box-info">
                    <div class="box-details">
                        <div class="box-model">${modelStr}</div>
                        <div class="box-dimensions">${dimensionStr} - ${typeStr}</div>
                    </div>
                    ${statusHtml}
                </div>
            `;
            
            boxItem.addEventListener('click', () => this.toggleBoxSelection(index, boxItem));
            boxList.appendChild(boxItem);
        });
        
        // If no boxes shown, display message
        if (boxList.children.length === 0) {
            boxList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No unassigned boxes</div>';
        }
    }

    toggleBoxSelection(boxIndex, boxElement) {
        if (this.mode === 'view') {
            // In view mode, clicking an unassigned box should let you assign it
            const isAssigned = this.getLocationForBox(boxIndex) !== null;
            if (!isAssigned) {
                // Switch to edit mode to assign this box
                this.setMode('edit');
                
                // Update the toggle switch UI
                const toggleSwitch = document.getElementById('mode-toggle-switch');
                const viewLabel = document.getElementById('view-label');
                const editLabel = document.getElementById('edit-label');
                toggleSwitch.classList.add('active');
                viewLabel.classList.remove('active');
                editLabel.classList.add('active');
                
                // Select this box
                this.selectedBoxForQuickAssign = boxIndex;
                
                // Close the panel and prompt to click floorplan
                const panel = document.getElementById('box-selector-panel');
                panel.classList.remove('open');
                
                // Show instruction
                this.showAssignmentInstruction(boxIndex);
            } else {
                // For assigned boxes, offer option to unassign
                this.showUnassignBoxOption(boxIndex, boxElement);
            }
        } else {
            // In edit mode, toggle selection normally
            boxElement.classList.toggle('selected');
        }
    }
    
    /**
     * Shows options to unassign a box
     */
    showUnassignBoxOption(boxIndex, boxElement) {
        // Create options dropdown
        const box = this.boxes[boxIndex];
        const modelStr = box.model || `Box ${boxIndex + 1}`;
        
        // Position the dropdown near the box item
        const rect = boxElement.getBoundingClientRect();
        
        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'box-action-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: ${rect.top + rect.height}px;
            left: ${rect.left}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            padding: 10px;
            z-index: 1000;
        `;
        
        // Add remove option
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove from Location';
        removeBtn.style.cssText = `
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
        `;
        
        removeBtn.onclick = () => this.removeBoxFromLocation(boxIndex);
        
        dropdown.appendChild(removeBtn);
        document.body.appendChild(dropdown);
        
        // Close when clicking outside
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== boxElement) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };
        
        // Add small delay to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
        }, 100);
    }
    
    /**
     * Removes a box from its current location
     */
    async removeBoxFromLocation(boxIndex) {
        if (!confirm(`Are you sure you want to remove this box from its location?`)) {
            return;
        }
        
        try {
            // Get the box's model
            const box = this.boxes[boxIndex];
            const model = box.model || `Unknown-${box.dimensions.length}-${box.dimensions[0]}-${box.dimensions[1]}-${box.dimensions[2]}`;
            
            // Create changes object with just this box
            const changes = {
                [model]: {}
            };
            
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substr(2) + Date.now().toString(36);
            
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (response.ok) {
                // Get the old location before updating
                const oldLocation = this.locations[boxIndex];
                
                // Update locationsByCoords if the box had a location
                if (oldLocation && oldLocation.coords) {
                    const oldCoordKey = `${oldLocation.coords[0]}_${oldLocation.coords[1]}`;
                    
                    if (this.locationsByCoords[oldCoordKey]) {
                        // Remove this box from the old location
                        this.locationsByCoords[oldCoordKey] = this.locationsByCoords[oldCoordKey].filter(
                            id => parseInt(id, 10) !== boxIndex
                        );
                        
                        // Clean up empty locations
                        if (this.locationsByCoords[oldCoordKey].length === 0) {
                            delete this.locationsByCoords[oldCoordKey];
                        }
                    }
                }
                
                // Update local data
                this.locations[boxIndex] = {};
                
                // Update markers
                this.updateViewer();
                
                // Refresh unassigned boxes list
                setTimeout(() => {
                    if (this.mode === 'view') {
                        this.showUnassignedInPanel();
                    }
                }, 100);
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'success-message';
                successMsg.textContent = `Box successfully removed from location.`;
                successMsg.style.cssText = `
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #dff0d8;
                    color: #3c763d;
                    padding: 15px 25px;
                    border-radius: 4px;
                    font-size: 16px;
                    z-index: 1000;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                `;
                document.body.appendChild(successMsg);
                
                // Remove after 3 seconds
                setTimeout(() => {
                    successMsg.remove();
                }, 3000);
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to remove box: ${errorData?.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error removing box from location:', error);
            alert('Failed to remove box: ' + error.message);
        }
    }
    
    showAssignmentInstruction(boxIndex) {
        const box = this.boxes[boxIndex];
        const modelStr = box.model || `Box ${boxIndex + 1}`;
        
        // Create or update instruction overlay
        let instruction = document.getElementById('assignment-instruction');
        if (!instruction) {
            instruction = document.createElement('div');
            instruction.id = 'assignment-instruction';
            instruction.style.cssText = `
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                padding: 15px 25px;
                border-radius: 4px;
                font-size: 16px;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(instruction);
        }
        
        instruction.textContent = `Click on the floorplan to assign location for ${modelStr}`;
        instruction.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            instruction.style.display = 'none';
        }, 5000);
    }

    filterBoxes(searchTerm) {
        const boxItems = document.querySelectorAll('.box-item');
        const term = searchTerm.toLowerCase().replace(/[\s"']/g, ''); // Remove spaces and quotes
        
        boxItems.forEach((item, index) => {
            const text = item.textContent.toLowerCase().replace(/[\s"']/g, ''); // Remove spaces and quotes
            const box = this.boxes[index];
            
            // Check multiple properties for search
            const modelMatch = box.model && box.model.toLowerCase().replace(/[\s"']/g, '').includes(term);
            const typeMatch = box.type && box.type.toLowerCase().replace(/[\s"']/g, '').includes(term);
            const dimMatch = box.dimensions.some(dim => dim.toString().includes(term));
            
            // Also check dimension string without spaces and quotes
            const dimensionStr = box.dimensions.join('x').toLowerCase();
            const dimStringMatch = dimensionStr.includes(term);
            
            const matchesSearch = text.includes(term) || modelMatch || typeMatch || dimMatch || dimStringMatch;
            
            item.style.display = matchesSearch ? 'block' : 'none';
        });
    }

    async saveLocationAssignment() {
        if (!this.selectedLocation) return;
        
        // Get selected boxes - use data attributes to ensure correct indices
        const selectedBoxes = [];
        const boxItems = document.querySelectorAll('.box-item.selected');
        boxItems.forEach((item) => {
            // Get the box index from the data attribute we'll add
            const boxIndex = parseInt(item.dataset.boxIndex, 10);
            if (!isNaN(boxIndex) && boxIndex >= 0) {
                selectedBoxes.push(boxIndex);
            }
        });
        
        if (selectedBoxes.length === 0) {
            alert('Please select at least one box');
            return;
        }
        
        // Create changes object with box models as keys
        const changes = {};
        
        // Create a mapping from box index to model
        const modelMapping = this.boxes.map((box, index) => {
            const model = box.model || `Unknown-${box.dimensions.length}-${box.dimensions[0]}-${box.dimensions[1]}-${box.dimensions[2]}`;
            return { index, model };
        });
        
        // Find ALL boxes currently at this location (before the update)
        const coordKey = `${this.selectedLocation.coords[0]}_${this.selectedLocation.coords[1]}`;
        const currentBoxesAtLocation = this.locationsByCoords[coordKey] || [];
        
        // First, add all boxes that were at this location with empty coords to remove them
        currentBoxesAtLocation.forEach(boxId => {
            const boxIndex = parseInt(boxId, 10);
            const boxInfo = modelMapping.find(m => m.index === boxIndex);
            if (boxInfo && !selectedBoxes.includes(boxIndex)) {
                // This box was at the location but is no longer selected, so remove it
                changes[boxInfo.model] = {};
            }
        });
        
        // Then, set up the changes for selected boxes
        selectedBoxes.forEach(boxIndex => {
            const boxInfo = modelMapping.find(m => m.index === boxIndex);
            if (boxInfo) {
                changes[boxInfo.model] = {
                    coords: this.selectedLocation.coords
                };
            }
        });
        
        try {
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substr(2) + Date.now().toString(36);
            
            // Send changes to API
            
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (response.ok) {
                // First, handle boxes that were removed from this location
                currentBoxesAtLocation.forEach(boxId => {
                    const boxIndex = parseInt(boxId, 10);
                    if (!selectedBoxes.includes(boxIndex)) {
                        // This box was removed from the location
                        delete this.locations[boxIndex];
                    }
                });
                
                // Clear the current location in locationsByCoords (we'll rebuild it)
                const coordKey = `${this.selectedLocation.coords[0]}_${this.selectedLocation.coords[1]}`;
                delete this.locationsByCoords[coordKey];
                
                // Remove selected boxes from their old locations in locationsByCoords
                selectedBoxes.forEach(boxIndex => {
                    const oldLocation = this.locations[boxIndex];
                    if (oldLocation && oldLocation.coords) {
                        const oldCoordKey = `${oldLocation.coords[0]}_${oldLocation.coords[1]}`;
                        if (this.locationsByCoords[oldCoordKey]) {
                            // Remove this box from the old location
                            this.locationsByCoords[oldCoordKey] = this.locationsByCoords[oldCoordKey].filter(
                                id => parseInt(id, 10) !== boxIndex
                            );
                            
                            // Clean up empty locations
                            if (this.locationsByCoords[oldCoordKey].length === 0) {
                                delete this.locationsByCoords[oldCoordKey];
                            }
                        }
                    }
                });
                
                // Rebuild the location with only selected boxes
                if (selectedBoxes.length > 0) {
                    this.locationsByCoords[coordKey] = [];
                    
                    // Update local locations data and add to the location in locationsByCoords
                    selectedBoxes.forEach(boxIndex => {
                        this.locations[boxIndex] = {
                            coords: this.selectedLocation.coords
                        };
                        
                        // Add to the location in locationsByCoords
                        this.locationsByCoords[coordKey].push(boxIndex.toString());
                    });
                }
                
                this.closeBoxSelector(); // This will clear the temp marker
                this.updateViewer(); // This will redraw all markers including the new one
                
                // Always refresh the unassigned boxes list after updating locations
                // This ensures the list is updated whether we're in view or edit mode
                setTimeout(() => {
                    if (this.mode === 'view') {
                        this.showUnassignedInPanel();
                    } else {
                        // In edit mode, just refresh the box list to update statuses
                        this.refreshBoxListFilter();
                    }
                }, 100);
                
                // No alert - the visual feedback is enough
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to save locations: ${errorData?.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving locations:', error);
            alert('Failed to save location assignments: ' + error.message);
        }
    }

    getLocationForBox(boxIndex) {
        const location = this.locations[boxIndex];
        if (!location || !location.coords) return null;
        
        // Generate a location ID based on coordinates
        return `${location.coords[0]}_${location.coords[1]}`;
    }
    
    /**
     * Checks if a box has a valid location assigned
     */
    hasValidLocation(boxIndex) {
        const location = this.locations[boxIndex];
        return location && location.coords && 
               location.coords.length === 2 && 
               !isNaN(location.coords[0]) && 
               !isNaN(location.coords[1]);
    }
    
    /**
     * Checks if a box is actually present in the locationsByCoords mapping
     * This is more reliable than just checking this.locations
     */
    isBoxInLocationMapping(boxIndex) {
        const boxIdStr = boxIndex.toString();
        for (const coordKey in this.locationsByCoords) {
            if (this.locationsByCoords[coordKey].includes(boxIdStr)) {
                return true;
            }
        }
        return false;
    }

    showLocationBoxes(location) {
        // Find boxes at this location using the coordinate lookup
        const coordKey = `${location.coords[0]}_${location.coords[1]}`;
        const boxIds = this.locationsByCoords[coordKey] || [];
        
        if (boxIds.length === 0) {
            return;
        }
        
        // Create array of box objects with their data
        const boxesAtLocation = boxIds.map(boxId => {
            // Parse boxId to integer to ensure correct indexing
            const boxIdInt = parseInt(boxId, 10);
            
            // Only include boxes that exist in the boxes array
            if (boxIdInt >= 0 && boxIdInt < this.boxes.length) {
                return {
                    id: boxId,
                    box: this.boxes[boxIdInt],
                    location: this.locations[boxIdInt]
                };
            }
            return null;
        }).filter(item => item !== null); // Remove any nulls
        
        if (boxesAtLocation.length === 0) {
            return;
        }
        
        // Show boxes in the right panel
        const panel = document.getElementById('box-selector-panel');
        const header = panel.querySelector('.box-selector-header h3');
        const saveButton = document.getElementById('save-location');
        const cancelButton = document.getElementById('cancel-location');
        const searchBox = document.getElementById('box-search');
        
        // Update UI for view mode
        header.textContent = 'Boxes at This Location';
        saveButton.style.display = 'none';
        cancelButton.textContent = 'Close';
        searchBox.style.display = 'none';
        
        // Render only the boxes at this location
        const boxList = document.getElementById('box-list');
        boxList.innerHTML = '';
        
        boxesAtLocation.forEach(item => {
            const box = item.box;
            const boxId = item.id;
            
            // Skip if box is undefined or missing required data
            if (!box || !box.dimensions) {
                console.warn(`Box at index ${boxId} is missing data or undefined`);
                return;
            }
            
            const boxElement = document.createElement('div');
            boxElement.className = 'box-item';
            
            // Store the actual box index as a data attribute
            boxElement.dataset.boxIndex = boxId;
            
            const dims = box.dimensions;
            const modelStr = box.model || `Box ${boxId}`;
            const typeStr = box.type || 'Unknown';
            
            // Safely format dimensions
            const dimensionStr = Array.isArray(dims) && dims.length >= 3 
                ? `${dims[0]}"×${dims[1]}"×${dims[2]}"`
                : "Unknown dimensions";
            
            boxElement.innerHTML = `
                <div class="box-info">
                    <div class="box-details">
                        <div class="box-model">${modelStr}</div>
                        <div class="box-dimensions">${dimensionStr} - ${typeStr}</div>
                    </div>
                </div>
            `;
            
            boxList.appendChild(boxElement);
        });
        
        panel.classList.add('open');
    }

    // Helper method to refresh the box list filter
    refreshBoxListFilter() {
        if (this.mode === 'edit') {
            const hideAssignedCheckbox = document.getElementById('hide-assigned');
            if (hideAssignedCheckbox && hideAssignedCheckbox.checked) {
                // Re-apply the filter to hide assigned boxes
                this.renderBoxList(true);
            } else if (hideAssignedCheckbox) {
                // Show all boxes
                this.renderBoxList(false);
            }
        }
    }
    
    showUnassignedInPanel() {
        const panel = document.getElementById('box-selector-panel');
        if (!panel) return; // Exit if panel doesn't exist
        
        const header = panel.querySelector('.box-selector-header h3');
        const saveButton = document.getElementById('save-location');
        const cancelButton = document.getElementById('cancel-location');
        const searchBox = document.getElementById('box-search');
        
        // Update UI for unassigned view
        if (header) header.textContent = 'Unassigned Boxes';
        if (saveButton) saveButton.style.display = 'none';
        if (cancelButton) cancelButton.textContent = 'Close';
        if (searchBox) {
            searchBox.style.display = '';
            searchBox.value = '';
        }
        
        // Add filter checkbox for edit mode
        this.addFilterCheckbox();
        
        // Render unassigned boxes
        this.renderBoxList(true); // true = only show unassigned
        
        panel.classList.add('open');
    }
    
    addFilterCheckbox() {
        // Handle filter checkbox for box list
        this.updateFilterCheckbox();
        
        // Handle Move/Delete buttons in the mode controls area
        this.updateModeControls();
    }
    
    updateFilterCheckbox() {
        // Check if filter already exists
        let filterContainer = document.getElementById('filter-container');
        if (!filterContainer) {
            filterContainer = document.createElement('div');
            filterContainer.id = 'filter-container';
            filterContainer.className = 'filter-container';
            
            // Create checkbox group
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'filter-checkbox-group';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'hide-assigned';
            checkbox.checked = false;
            
            const label = document.createElement('label');
            label.htmlFor = 'hide-assigned';
            label.textContent = 'Hide Assigned Elsewhere';
            
            checkboxGroup.appendChild(checkbox);
            checkboxGroup.appendChild(label);
            filterContainer.appendChild(checkboxGroup);
            
            // Insert after header
            const header = document.querySelector('.box-selector-header');
            header.parentNode.insertBefore(filterContainer, header.nextSibling);
            
            checkbox.addEventListener('change', () => {
                this.renderBoxList(checkbox.checked);
            });
        }
        
        // Show/hide based on mode
        filterContainer.style.display = this.mode === 'edit' ? 'flex' : 'none';
        
        // Respect current checkbox state
        const checkbox = document.getElementById('hide-assigned');
        if (checkbox && this.mode === 'edit') {
            this.renderBoxList(checkbox.checked);
        }
    }
    
    updateModeControls() {
        // Add Move and Delete buttons to the mode controls
        const modeControls = document.getElementById('mode-controls');
        
        // Return if already setup or controls don't exist
        if (!modeControls || document.querySelector('.location-action-controls')) return;
        
        // Create action buttons container
        const actionButtons = document.createElement('div');
        actionButtons.className = 'location-action-controls';
        
        // Move button
        const moveButton = document.createElement('button');
        moveButton.className = 'location-move-btn';
        moveButton.innerHTML = '↕️ Move';
        moveButton.onclick = () => this.initiateMoveMode();
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'location-delete-btn';
        deleteButton.innerHTML = '🗑️ Delete';
        deleteButton.onclick = () => this.initiateDeleteMode();
        
        // Merge button
        const mergeButton = document.createElement('button');
        mergeButton.className = 'location-merge-btn';
        mergeButton.innerHTML = '🔄 Merge';
        mergeButton.onclick = () => this.initiateMergeMode();
        
        actionButtons.appendChild(moveButton);
        actionButtons.appendChild(deleteButton);
        actionButtons.appendChild(mergeButton);
        
        // Find the toggle container and add the buttons after it
        const toggleContainer = modeControls.querySelector('.mode-toggle');
        if (toggleContainer) {
            toggleContainer.parentNode.insertBefore(actionButtons, toggleContainer.nextSibling);
        } else {
            modeControls.appendChild(actionButtons);
        }
    }
    
    // New methods for the Move, Delete, and Merge actions
    initiateMoveMode() {
        // Exit other modes if active
        this.exitMergeMode();
        if (this.deleteMode) this.exitDeleteMode();
        
        // If already in move mode, just return
        if (this.moveMode) return;
        
        // Create instruction element
        const instruction = document.createElement('div');
        instruction.id = 'move-instruction';
        instruction.className = 'action-instruction';
        instruction.textContent = 'Click and drag a location marker to move it';
        instruction.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: #fff3cd; color: #856404; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        
        // Create done button
        const doneButton = document.createElement('button');
        doneButton.textContent = 'Done';
        doneButton.style.cssText = 'margin-left: 10px; padding: 3px 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
        doneButton.onclick = () => this.exitMoveMode();
        
        instruction.appendChild(doneButton);
        document.body.appendChild(instruction);
        
        // Disable marker creation while in move mode
        this.markerCreationDisabled = true;
        
        // Set move mode
        this.moveMode = true;
        
        // Make all markers draggable - works in both view and edit modes
        const markers = document.querySelectorAll('.location-marker');
        markers.forEach(marker => {
            if (marker.dataset.id !== 'temp') {
                marker.classList.add('draggable');
                marker.style.cursor = 'move';
                
                // Add drag handlers directly to the marker - make sure to remove any existing handlers first
                marker.onmousedown = null; // Clear existing handlers
                marker.onmousedown = (e) => {
                    // Only process in move mode
                    if (!this.moveMode) return;
                    
                    e.preventDefault();
                    e.stopPropagation(); // Stop event propagation to prevent other handlers
                    
                    const markerLayer = marker.parentElement;
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startLeft = marker.offsetLeft;
                    const startTop = marker.offsetTop;
                    
                    const handleMouseMove = (e) => {
                        e.preventDefault(); // Prevent text selection during drag
                        
                        // Calculate new position
                        const newLeft = startLeft + (e.clientX - startX);
                        const newTop = startTop + (e.clientY - startY);
                        
                        // Ensure marker stays within the bounds of the marker layer
                        const markerLayer = marker.parentElement;
                        const rect = markerLayer.getBoundingClientRect();
                        
                        const maxLeft = rect.width;
                        const maxTop = rect.height;
                        
                        const boundedLeft = Math.max(0, Math.min(newLeft, maxLeft));
                        const boundedTop = Math.max(0, Math.min(newTop, maxTop));
                        
                        // Update marker position with constrained values
                        marker.style.left = `${boundedLeft}px`;
                        marker.style.top = `${boundedTop}px`;
                        
                        // Add active drag class
                        marker.classList.add('dragging');
                    };
                    
                    const handleMouseUp = (e) => {
                        // Remove event listeners
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        
                        // Remove dragging class
                        marker.classList.remove('dragging');
                        
                        // Calculate new coordinates as percentages
                        const rect = markerLayer.getBoundingClientRect();
                        const newX = marker.offsetLeft / rect.width;
                        const newY = marker.offsetTop / rect.height;
                        
                        // Update data attributes
                        const oldX = parseFloat(marker.dataset.x);
                        const oldY = parseFloat(marker.dataset.y);
                        
                        // Call the marker move handler
                        this.handleMarkerMove({
                            id: marker.dataset.id,
                            oldCoords: [oldX, oldY],
                            newCoords: [newX, newY],
                            label: marker.dataset.label
                        });
                    };
                    
                    // Add event listeners
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                };
            }
        });
        
        // Set escape key to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.exitMoveMode();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Store the escape handler for cleanup
        this.moveEscHandler = escHandler;
    }
    
    exitMoveMode() {
        // Remove instruction element
        const instruction = document.getElementById('move-instruction');
        if (instruction) instruction.remove();
        
        // Remove escape key handler
        if (this.moveEscHandler) {
            document.removeEventListener('keydown', this.moveEscHandler);
            this.moveEscHandler = null;
        }
        
        // Remove draggable from all markers and restore cursor
        const markers = document.querySelectorAll('.location-marker');
        markers.forEach(marker => {
            marker.classList.remove('draggable');
            // Set cursor based on current mode
            marker.style.cursor = this.mode === 'edit' ? 'pointer' : 'pointer';
            // Remove mouse handlers completely
            marker.onmousedown = null;
            marker.onmousemove = null;
            marker.onmouseup = null;
        });
        
        // Re-enable marker creation
        this.markerCreationDisabled = false;
        
        // Exit move mode
        this.moveMode = false;
        
        // Force refresh viewer to ensure all markers are properly displayed
        this.updateViewer();
    }
    
    initiateDeleteMode() {
        // Exit other modes if active
        this.exitMergeMode();
        if (this.moveMode) this.exitMoveMode();
        
        // If already in delete mode, just return
        if (this.deleteMode) return;
        
        // Create instruction element
        const instruction = document.createElement('div');
        instruction.id = 'delete-instruction';
        instruction.className = 'action-instruction';
        instruction.textContent = 'Click on a location marker to delete it';
        instruction.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: #f8d7da; color: #721c24; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        
        // Create done button
        const doneButton = document.createElement('button');
        doneButton.textContent = 'Done';
        doneButton.style.cssText = 'margin-left: 10px; padding: 3px 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
        doneButton.onclick = () => this.exitDeleteMode();
        
        instruction.appendChild(doneButton);
        document.body.appendChild(instruction);
        
        // Disable marker creation while in delete mode
        this.markerCreationDisabled = true;
        
        // Set delete mode
        this.deleteMode = true;
        
        // Set escape key to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.exitDeleteMode();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Store the escape handler for cleanup
        this.deleteEscHandler = escHandler;
    }
    
    exitDeleteMode() {
        // Remove instruction element
        const instruction = document.getElementById('delete-instruction');
        if (instruction) instruction.remove();
        
        // Remove escape key handler
        if (this.deleteEscHandler) {
            document.removeEventListener('keydown', this.deleteEscHandler);
            this.deleteEscHandler = null;
        }
        
        // Re-enable marker creation
        this.markerCreationDisabled = false;
        
        // Exit delete mode
        this.deleteMode = false;
    }
    
    initiateMergeMode() {
        // Exit other modes if active
        if (this.moveMode) this.exitMoveMode();
        if (this.deleteMode) this.exitDeleteMode();
        
        // If already in merge mode, just return
        if (this.mergeMode) return;
        
        // Create instruction element
        const instruction = document.createElement('div');
        instruction.id = 'merge-instruction';
        instruction.className = 'action-instruction';
        instruction.textContent = 'Select the source location (will be removed)';
        instruction.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: #e3f2fd; color: #0d47a1; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        
        // Create status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'merge-status';
        statusIndicator.innerHTML = '<strong>Step 1:</strong> Select source location';
        statusIndicator.style.cssText = 'margin-top: 8px; font-size: 14px;';
        instruction.appendChild(statusIndicator);
        
        // Create done button
        const doneButton = document.createElement('button');
        doneButton.textContent = 'Cancel';
        doneButton.style.cssText = 'margin-left: 10px; padding: 3px 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
        doneButton.onclick = () => this.exitMergeMode();
        
        instruction.appendChild(doneButton);
        document.body.appendChild(instruction);
        
        // Disable marker creation while in merge mode
        this.markerCreationDisabled = true;
        
        // Set merge mode
        this.mergeMode = true;
        this.mergeStep = 1; // 1 = select source, 2 = select destination
        this.mergeSource = null;
        this.mergeDestination = null;
        
        // Set escape key to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.exitMergeMode();
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Store the escape handler for cleanup
        this.mergeEscHandler = escHandler;
        
        // Update marker appearance to indicate they can be selected
        const markers = document.querySelectorAll('.location-marker');
        markers.forEach(marker => {
            if (marker.dataset.id !== 'temp') {
                marker.classList.add('selectable-marker');
                marker.style.cursor = 'pointer';
            }
        });
    }
    
    exitMergeMode() {
        // Remove instruction element
        const instruction = document.getElementById('merge-instruction');
        if (instruction) instruction.remove();
        
        // Remove escape key handler
        if (this.mergeEscHandler) {
            document.removeEventListener('keydown', this.mergeEscHandler);
            this.mergeEscHandler = null;
        }
        
        // Remove selection highlights
        this.clearMergeSelections();
        
        // Remove selectable class
        const markers = document.querySelectorAll('.location-marker');
        markers.forEach(marker => {
            marker.classList.remove('selectable-marker', 'merge-source', 'merge-destination');
            marker.style.cursor = this.mode === 'edit' ? 'move' : 'pointer';
        });
        
        // Re-enable marker creation
        this.markerCreationDisabled = false;
        
        // Exit merge mode
        this.mergeMode = false;
        this.mergeStep = 0;
        this.mergeSource = null;
        this.mergeDestination = null;
    }
    
    clearMergeSelections() {
        const sourceMarker = document.querySelector('.merge-source');
        const destMarker = document.querySelector('.merge-destination');
        
        if (sourceMarker) sourceMarker.classList.remove('merge-source');
        if (destMarker) destMarker.classList.remove('merge-destination');
    }
    
    updateMergeStep() {
        if (!this.mergeMode) return;
        
        const instruction = document.getElementById('merge-instruction');
        const statusIndicator = document.getElementById('merge-status');
        
        if (this.mergeStep === 1) {
            // First step: select source
            if (instruction) instruction.style.background = '#e3f2fd';
            if (statusIndicator) statusIndicator.innerHTML = '<strong>Step 1:</strong> Select source location';
        } else if (this.mergeStep === 2) {
            // Second step: select destination
            if (instruction) {
                instruction.style.background = '#d1e7dd';
                instruction.textContent = 'Select the destination location (will remain)';
            }
            if (statusIndicator) {
                statusIndicator.innerHTML = '<strong>Step 2:</strong> Select destination location';
                instruction.appendChild(statusIndicator);
                
                // Add confirm button
                const confirmButton = document.createElement('button');
                confirmButton.textContent = 'Cancel';
                confirmButton.style.cssText = 'margin-left: 10px; padding: 3px 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
                confirmButton.onclick = () => this.exitMergeMode();
                instruction.appendChild(confirmButton);
            }
        }
    }

    updateViewer() {
        if (!this.floorplanViewer) return;
        
        // Clear existing markers
        this.floorplanViewer.clearMarkers('all');
        
        // Add markers for all locations
        const locationMap = new Map();
        
        Object.entries(this.locations).forEach(([boxId, location]) => {
            // Skip locations without coordinates
            if (!location || !location.coords) return;
            
            const key = `${location.coords[0]}_${location.coords[1]}`;
            if (!locationMap.has(key)) {
                locationMap.set(key, {
                    coords: location.coords,
                    boxes: []
                });
            }
            locationMap.get(key).boxes.push(boxId);
        });
        
        // Add markers
        locationMap.forEach((location, key) => {
            const label = `${location.boxes.length} box${location.boxes.length > 1 ? 'es' : ''}`;
            this.floorplanViewer.addMarker(location.coords[0], location.coords[1], key, label);
        });
    }
    
    async checkFloorplanStatus() {
        try {
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/floorplan`);
            this.hasFloorplan = response.ok;
            
            const floorplanContent = document.getElementById('floorplan-content');
            const noFloorplanContent = document.getElementById('no-floorplan-content');
            
            if (this.hasFloorplan) {
                // Show normal floorplan editor
                if (floorplanContent) floorplanContent.style.display = 'block';
                if (noFloorplanContent) noFloorplanContent.style.display = 'none';
                
                const viewerElement = document.getElementById('floorplan-viewer');
                const noFloorplanMsg = document.getElementById('no-floorplan-message');
                
                if (viewerElement) {
                    viewerElement.classList.add('has-floorplan');
                }
                if (noFloorplanMsg) {
                    noFloorplanMsg.style.display = 'none';
                }
            } else {
                // NO FLOORPLAN - show only upload interface
                if (floorplanContent) floorplanContent.style.display = 'none';
                if (noFloorplanContent) noFloorplanContent.style.display = 'block';
                
                // Initialize upload in the main container
                const uploadMainContainer = document.getElementById('upload-container-main');
                if (uploadMainContainer && !this.mainUploader) {
                    this.mainUploader = new FloorplanUpload(uploadMainContainer, this.storeId, {
                        onUploadSuccess: (result) => {
                            let message = 'Floorplan uploaded successfully!';
                            if (result.locations_cleared > 0) {
                                message += ` ${result.locations_cleared} location coordinates were cleared.`;
                            }
                            alert(message);
                            // Refresh the page to show the new floorplan
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
                        },
                        onUploadError: (error) => {
                            console.error('Upload error:', error);
                            alert('Failed to upload floorplan');
                        }
                    });
                }
                
                this.setMode('view'); // Force view mode when no floorplan
                
                // Close panel if no floorplan
                const panel = document.getElementById('box-selector-panel');
                if (panel) {
                    panel.classList.remove('open');
                }
            }
        } catch (error) {
            // Only log non-TypeError errors (TypeErrors are expected when viewer isn't initialized)
            if (!(error instanceof TypeError)) {
                console.error('Error checking floorplan status:', error);
            }
            this.hasFloorplan = false;
        }
    }
}