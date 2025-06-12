/**
 * Location utility functions for viewing and editing box locations on floorplans
 * Extracted from prices.html for reuse across the application
 */

// Modal HTML template
const FLOORPLAN_MODAL_HTML = `
    <div id="floorplanModal" class="floorplan-modal">
        <div class="floorplan-modal-content">
            <div class="floorplan-modal-header">
                <h3 id="floorplanModalTitle">Box Location</h3>
                <button class="floorplan-modal-close" onclick="LocationUtils.closeModal()">&times;</button>
            </div>
            <div class="floorplan-container" id="floorplanContainer">
                <!-- Floorplan image and marker will be inserted here -->
            </div>
        </div>
    </div>
`;

// Modal CSS styles
const FLOORPLAN_MODAL_STYLES = `
    .floorplan-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
    }
    
    .floorplan-modal-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    .floorplan-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .floorplan-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    
    .floorplan-container {
        position: relative;
        display: inline-block;
    }
    
    .floorplan-container img {
        max-width: 800px;
        max-height: 600px;
        display: block;
    }
    
    .location-marker {
        position: absolute;
        width: 30px;
        height: 30px;
        margin-left: -15px;
        margin-top: -15px;
        background: red;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    
    .btn-primary {
        background: #007bff;
        color: white;
    }
    
    .btn-primary:hover {
        background: #0056b3;
    }
`;

// Location button styles
const LOCATION_BUTTON_STYLES = `
    .location-buttons {
        display: flex;
        gap: 5px;
        justify-content: center;
    }
    
    .location-btn {
        background: none;
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 4px 8px;
        cursor: pointer;
        color: #666;
        transition: all 0.2s;
    }
    
    .location-btn:hover:not(:disabled) {
        background: #f0f0f0;
        border-color: #999;
        color: #333;
    }
    
    .location-btn:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
    
    .location-btn svg {
        vertical-align: middle;
    }
`;

class LocationUtils {
    static initialized = false;
    static storeId = null;
    
    /**
     * Initialize the location utilities
     * @param {string} storeId - The current store ID
     */
    static init(storeId) {
        this.storeId = storeId;
        
        if (!this.initialized) {
            // Add styles to page
            const style = document.createElement('style');
            style.textContent = FLOORPLAN_MODAL_STYLES + LOCATION_BUTTON_STYLES;
            document.head.appendChild(style);
            
            // Add modal HTML to page
            const modalDiv = document.createElement('div');
            modalDiv.innerHTML = FLOORPLAN_MODAL_HTML;
            document.body.appendChild(modalDiv.firstElementChild);
            
            // Add click outside handler
            document.getElementById('floorplanModal').onclick = function(e) {
                if (e.target === this) {
                    LocationUtils.closeModal();
                }
            };
            
            this.initialized = true;
        }
    }
    
    /**
     * Parse location coordinates from various formats
     * @param {Object} location - The location object
     * @returns {Object|null} - {x, y} or null if no valid coordinates
     */
    static parseCoordinates(location) {
        if (!location || !location.coords || location.coords.length === 0) {
            return null;
        }
        
        let x, y;
        if (Array.isArray(location.coords[0])) {
            // Format: [[x, y]]
            [x, y] = location.coords[0];
        } else if (typeof location.coords[0] === 'object' && location.coords[0].x !== undefined) {
            // Format: [{x: val, y: val}]
            x = location.coords[0].x;
            y = location.coords[0].y;
        } else if (location.coords.length === 2 && typeof location.coords[0] === 'number') {
            // Format: [x, y]
            [x, y] = location.coords;
        } else {
            console.error('Unknown coordinate format:', location.coords);
            return null;
        }
        
        return {x, y};
    }
    
    /**
     * View location on floorplan (read-only)
     * @param {string} model - Box model name
     * @param {Object} location - Location object with coords
     */
    static async viewLocation(model, location) {
        const coords = this.parseCoordinates(location);
        if (!coords) {
            alert('No location coordinates set for this box.');
            return;
        }
        
        try {
            const response = await apiUtils.authenticatedFetch(
                `/api/store/${this.storeId}/floorplan`,
                this.storeId
            );
            
            if (!response.ok) {
                alert('No floorplan available for this store.');
                return;
            }
            
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Update modal
            const modal = document.getElementById('floorplanModal');
            const container = document.getElementById('floorplanContainer');
            const title = document.getElementById('floorplanModalTitle');
            
            title.textContent = `${model} - ${location.label || 'Location'}`;
            
            // Clear and setup container
            container.innerHTML = '';
            container.style.cursor = 'default';
            
            // Create image
            const img = document.createElement('img');
            img.src = imageUrl;
            img.onload = function() {
                // Add marker
                const marker = document.createElement('div');
                marker.className = 'location-marker';
                marker.style.left = (coords.x * 100) + '%';
                marker.style.top = (coords.y * 100) + '%';
                marker.title = model;
                
                container.appendChild(img);
                container.appendChild(marker);
            };
            
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading floorplan:', error);
            alert('Failed to load floorplan.');
        }
    }
    
    /**
     * Edit location on floorplan
     * @param {string} model - Box model name
     * @param {Object} currentLocation - Current location object
     * @param {Function} callback - Callback function when location is saved
     */
    static async editLocation(model, currentLocation, callback) {
        try {
            const response = await apiUtils.authenticatedFetch(
                `/api/store/${this.storeId}/floorplan`,
                this.storeId
            );
            
            if (!response.ok) {
                alert('No floorplan available for this store.');
                return;
            }
            
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Update modal
            const modal = document.getElementById('floorplanModal');
            const container = document.getElementById('floorplanContainer');
            const title = document.getElementById('floorplanModalTitle');
            
            title.textContent = `Set Location for ${model}`;
            
            // Clear container
            container.innerHTML = '';
            
            // Create image
            const img = document.createElement('img');
            img.src = imageUrl;
            
            let marker = null;
            let currentCoords = null;
            
            // Parse existing location
            if (currentLocation) {
                currentCoords = this.parseCoordinates(currentLocation);
            }
            
            img.onload = function() {
                container.appendChild(img);
                
                // Add existing marker if location exists
                if (currentCoords) {
                    marker = document.createElement('div');
                    marker.className = 'location-marker';
                    marker.style.left = (currentCoords.x * 100) + '%';
                    marker.style.top = (currentCoords.y * 100) + '%';
                    container.appendChild(marker);
                }
                
                // Make container clickable
                container.style.cursor = 'crosshair';
                container.onclick = function(e) {
                    const imgRect = img.getBoundingClientRect();
                    
                    // Calculate click position relative to image
                    const x = (e.clientX - imgRect.left) / imgRect.width;
                    const y = (e.clientY - imgRect.top) / imgRect.height;
                    
                    // Remove old marker if exists
                    if (marker) {
                        marker.remove();
                    }
                    
                    // Add new marker
                    marker = document.createElement('div');
                    marker.className = 'location-marker';
                    marker.style.left = (x * 100) + '%';
                    marker.style.top = (y * 100) + '%';
                    container.appendChild(marker);
                    
                    currentCoords = {x, y};
                };
            };
            
            // Add save/cancel buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'margin-top: 15px; text-align: center;';
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save Location';
            saveBtn.className = 'btn btn-primary';
            saveBtn.style.marginRight = '10px';
            saveBtn.onclick = function() {
                if (currentCoords) {
                    const newLocation = {
                        label: currentLocation?.label || '',
                        coords: [currentCoords.x, currentCoords.y]
                    };
                    callback(newLocation);
                    LocationUtils.closeModal();
                } else {
                    alert('Please click on the floorplan to set a location.');
                }
            };
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'btn';
            cancelBtn.onclick = LocationUtils.closeModal;
            
            buttonContainer.appendChild(saveBtn);
            buttonContainer.appendChild(cancelBtn);
            
            // Remove any existing button container before adding new one
            const modalContent = modal.querySelector('.floorplan-modal-content');
            const existingButtons = modalContent.querySelector('div[style*="margin-top: 15px"]');
            if (existingButtons) {
                existingButtons.remove();
            }
            
            modalContent.appendChild(buttonContainer);
            
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading floorplan:', error);
            alert('Failed to load floorplan.');
        }
    }
    
    /**
     * Close the floorplan modal
     */
    static closeModal() {
        const modal = document.getElementById('floorplanModal');
        modal.style.display = 'none';
        
        // Clean up any buttons added for edit mode
        const modalContent = modal.querySelector('.floorplan-modal-content');
        const buttonContainer = modalContent.querySelector('div[style*="margin-top: 15px"]');
        
        if (buttonContainer) {
            buttonContainer.remove();
        }
        
        // Reset container
        const container = document.getElementById('floorplanContainer');
        container.onclick = null;
        container.style.cursor = 'default';
    }
    
    /**
     * Store location data for view buttons
     */
    static locationData = {};
    
    /**
     * Create location buttons (view/edit) for a table cell
     * @param {string} model - Box model
     * @param {Object} location - Location object
     * @param {Function} onEdit - Edit callback function
     * @returns {string} HTML for location buttons
     */
    static createLocationButtons(model, location, onEdit) {
        const hasCoords = location && location.coords && location.coords.length > 0;
        
        // Store location data for the view button
        if (location) {
            this.locationData[model] = location;
        }
        
        return `
            <div class="location-buttons">
                <button class="location-btn view-location" 
                        onclick="LocationUtils.viewLocationForModel('${model}')"
                        ${!hasCoords ? 'disabled' : ''} 
                        title="${hasCoords ? 'View location on floorplan' : 'No coordinates set'}">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                    </svg>
                </button>
                
                <button class="location-btn edit-location" 
                        onclick="LocationUtils.editLocationForModel('${model}')"
                        title="Edit location">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                    </svg>
                </button>
            </div>
        `;
    }
    
    /**
     * View location for a specific model (called from button onclick)
     * @param {string} model - Box model
     */
    static viewLocationForModel(model) {
        const location = this.locationData[model];
        if (location) {
            this.viewLocation(model, location);
        }
    }
    
    /**
     * Edit location for a specific model (called from button onclick)
     * @param {string} model - Box model
     * @param {Function} callback - Optional callback function
     */
    static editLocationForModel(model, callback) {
        // Use callback if provided
        if (callback && typeof callback === 'function') {
            callback(model);
            return;
        }
        
        // Check for stored callback from renderLocationButtons
        if (this._editCallbacks && this._editCallbacks[model]) {
            this._editCallbacks[model](model);
            return;
        }
        
        // Emit custom event as primary method
        const event = new CustomEvent('location-edit-requested', {
            detail: { model },
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Render location buttons for a box
     * @param {string} model - Box model
     * @param {Object} location - Location object with coords
     * @param {Object} options - Optional configuration
     * @param {Function} options.onEdit - Edit callback function
     * @param {boolean} options.includeUndo - Include undo button (for price tables)
     * @returns {string} HTML for location buttons
     */
    static renderLocationButtons(model, location, options = {}) {
        const hasCoords = location?.coords?.length > 0;
        const escapedModel = model.replace(/'/g, "\\'");
        
        // Store location data for the view button
        if (location) {
            this.locationData[model] = location;
        }
        
        // Store callback if provided
        if (options.onEdit) {
            this._editCallbacks = this._editCallbacks || {};
            this._editCallbacks[model] = options.onEdit;
        }
        
        let buttons = `
            <div class="location-buttons">
                <button class="location-btn view-location" 
                        onclick="LocationUtils.viewLocationForModel('${escapedModel}')"
                        ${!hasCoords ? 'disabled' : ''} 
                        title="${hasCoords ? 'View location on floorplan' : 'No coordinates set'}">
                    ${this.icons.eye}
                </button>
                <button class="location-btn edit-location" 
                        onclick="LocationUtils.editLocationForModel('${escapedModel}')"
                        title="Edit location">
                    ${this.icons.pencil}
                </button>`;
        
        // Add undo button if requested (for price table)
        if (options.includeUndo) {
            buttons += `
                <button class="undo-btn ${options.undoClass || ''}" 
                        data-model="${model}" 
                        title="Undo changes for this row">↺</button>`;
        }
        
        buttons += `
            </div>
        `;
        
        return buttons;
    }
}

// Define icons as static properties
LocationUtils.icons = {
    eye: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>`,
    
    pencil: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>`
};

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.LocationUtils = LocationUtils;
}