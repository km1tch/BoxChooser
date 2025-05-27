// Enhanced modal component for viewing/editing box locations with improved interaction
import { FloorplanViewer } from './floorplan-viewer.js';

export class LocationModal {
    constructor(options = {}) {
        this.options = {
            mode: 'view', // 'view' or 'edit'
            storeId: null,
            boxModel: null,
            currentLocation: null,
            onSave: null,
            onClear: null,
            ...options
        };
        
        this.modal = null;
        this.viewer = null;
        this.selectedLocation = null;
        this.markerMoving = false;
        
        this.init();
    }
    
    init() {
        this.createModal();
        this.attachEventListeners();
    }
    
    createModal() {
        // Create modal structure with enhanced UI
        const modalHtml = `
            <div class="location-modal-overlay">
                <div class="location-modal">
                    <div class="modal-header">
                        <h3>${this.options.mode === 'view' ? 'View' : 'Edit'} Location - ${this.options.boxModel}</h3>
                        <button class="modal-close" id="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${this.options.mode === 'edit' ? `
                            <div class="location-edit-instructions" id="edit-instructions">
                                Click to select a new location
                            </div>
                        ` : ''}
                        <div id="floorplan-viewer-container" class="${this.options.mode === 'edit' ? 'edit-mode' : ''}"></div>
                    </div>
                    ${this.options.mode === 'edit' ? `
                        <div class="modal-footer">
                            <div class="button-container">
                                <button id="delete-location" class="delete-button" ${!this.options.currentLocation?.coords ? 'style="display:none"' : ''}>
                                    Delete Location
                                </button>
                                <button id="cancel-location" class="cancel-button">
                                    Cancel
                                </button>
                                <button id="save-location" class="save-button" disabled>
                                    Save Location
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add to body
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        this.modal = modalElement.firstElementChild;
        document.body.appendChild(this.modal);
        
        // Initialize floorplan viewer with enhanced capabilities
        const viewerContainer = this.modal.querySelector('#floorplan-viewer-container');
        this.viewer = new FloorplanViewer(viewerContainer, {
            mode: this.options.mode,
            storeId: this.options.storeId,
            initialLocation: this.options.currentLocation,
            onLocationSelect: (location) => this.handleLocationSelect(location),
            onFloorplanClick: (coords) => this.handleFloorplanClick(coords)
        });
        
        // If we have an existing location, store it
        if (this.options.currentLocation?.coords) {
            this.selectedLocation = { ...this.options.currentLocation };
        }
        
        // Add custom styles for the location modal
        this.addCustomStyles();
    }
    
    addCustomStyles() {
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .location-edit-instructions {
                margin-bottom: 15px;
                padding: 10px;
                text-align: center;
                color: #666;
                font-size: 14px;
            }
            
            .button-container {
                display: flex;
                gap: 10px;
                width: 100%;
                justify-content: flex-end;
            }
            
            /* Standard button styling */
            .modal-footer button {
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
                border-radius: 4px;
                transition: all 0.2s;
            }
            
            .modal-footer button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Cancel button */
            .cancel-button {
                background-color: #f8f9fa;
                border: 1px solid #ced4da;
                color: #6c757d;
            }
            
            .cancel-button:hover {
                background-color: #e9ecef;
            }
            
            /* Delete button */
            .delete-button {
                background-color: #fff;
                border: 1px solid #dc3545;
                color: #dc3545;
            }
            
            .delete-button:hover {
                background-color: #dc3545;
                color: #fff;
            }
            
            /* Save button */
            .save-button {
                background-color: #28a745;
                border: 1px solid #28a745;
                color: white;
            }
            
            .save-button:hover:not(:disabled) {
                background-color: #218838;
                border-color: #1e7e34;
            }
            
            /* Make sure the marker is larger and more visible */
            .location-marker {
                width: 80px !important;
                height: 80px !important;
                margin-left: -40px !important;
                margin-top: -40px !important;
                font-size: 72px !important;
                color: #FF0000 !important;
                font-weight: 900 !important;
                text-shadow: 3px 3px 0px #000, -3px -3px 0px #000, 3px -3px 0px #000, -3px 3px 0px #000, 0px 0px 8px rgba(0,0,0,0.5) !important;
                cursor: ${this.options.mode === 'edit' ? 'move' : 'default'} !important;
            }
            
            /* Ensure marker layer is clickable in edit mode */
            .edit-mode .marker-layer {
                pointer-events: auto !important;
                cursor: crosshair !important;
            }
        `;
        document.head.appendChild(styleEl);
        
        // Store reference for cleanup
        this.customStyleElement = styleEl;
    }
    
    attachEventListeners() {
        // Close button
        this.modal.querySelector('#modal-close').addEventListener('click', () => {
            this.close();
        });
        
        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Edit mode buttons
        if (this.options.mode === 'edit') {
            const saveBtn = this.modal.querySelector('#save-location');
            const cancelBtn = this.modal.querySelector('#cancel-location');
            const deleteBtn = this.modal.querySelector('#delete-location');
            
            saveBtn.addEventListener('click', () => {
                this.save();
            });
            
            cancelBtn.addEventListener('click', () => {
                this.cancel();
            });
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    this.delete();
                });
            }
            
            // Initially enable save button if a location is already selected
            if (this.options.currentLocation?.coords) {
                saveBtn.disabled = false;
            }
            
            // Set up marker dragging
            this.setupMarkerDragging();
        }
        
        // ESC key to close
        document.addEventListener('keydown', this.handleKeyDown);
    }
    
    setupMarkerDragging() {
        if (this.options.mode !== 'edit') return;
        
        // Add mousedown event to existing markers for dragging
        setTimeout(() => {
            const markers = document.querySelectorAll('.location-marker');
            markers.forEach(marker => {
                if (marker.dataset.id !== 'temp') {
                    marker.style.cursor = 'move';
                    
                    marker.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        this.startMarkerDrag(marker, e);
                    });
                }
            });
        }, 300); // Small delay to ensure markers are rendered
    }
    
    startMarkerDrag(marker, e) {
        this.markerMoving = true;
        
        const markerLayer = marker.parentElement;
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = marker.offsetLeft;
        const startTop = marker.offsetTop;
        
        const handleMouseMove = (e) => {
            // Calculate new position
            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);
            
            // Update marker position
            marker.style.left = `${newLeft}px`;
            marker.style.top = `${newTop}px`;
        };
        
        const handleMouseUp = (e) => {
            // Remove event listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Calculate new coordinates as percentages
            const rect = markerLayer.getBoundingClientRect();
            const newX = marker.offsetLeft / rect.width;
            const newY = marker.offsetTop / rect.height;
            
            // Update the selected location
            if (this.selectedLocation) {
                this.selectedLocation.coords = [newX, newY];
                this.enableSaveButton();
            }
            
            this.markerMoving = false;
        };
        
        // Add event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            this.close();
        }
    }
    
    handleLocationSelect(location) {
        // Store the selected location
        this.selectedLocation = { ...location };
        
        // Update UI when location is selected
        if (this.options.mode === 'edit') {
            this.enableSaveButton();
            
            // Show delete button
            const deleteBtn = this.modal.querySelector('#delete-location');
            if (deleteBtn) {
                deleteBtn.style.display = '';
            }
        }
    }
    
    handleFloorplanClick(coords) {
        // Only handle clicks in edit mode and when not moving a marker
        if (this.options.mode !== 'edit' || this.markerMoving) return;
        
        // Clear existing markers
        this.viewer.clearMarkers('all');
        
        // Add a new marker at the clicked position
        this.viewer.addMarker(coords[0], coords[1], 'current');
        
        // Update selected location
        this.selectedLocation = {
            coords: coords
        };
        
        // Update UI
        this.enableSaveButton();
        
        // Show delete button
        const deleteBtn = this.modal.querySelector('#delete-location');
        if (deleteBtn) {
            deleteBtn.style.display = '';
        }
        
        // Update instructions
        const instructions = this.modal.querySelector('#edit-instructions');
        if (instructions) {
            instructions.textContent = 'Click and drag the marker to move it, or click elsewhere to place a new marker';
        }
    }
    
    enableSaveButton() {
        const saveBtn = this.modal.querySelector('#save-location');
        if (saveBtn) {
            saveBtn.disabled = false;
        }
    }
    
    async save() {
        if (!this.selectedLocation) {
            this.close();
            return;
        }
        
        try {
            // Save directly to the API to avoid the change pending state in price editor
            const boxModel = this.options.boxModel;
            const location = this.selectedLocation;
            
            // Create changes object with just this box
            const changes = {
                [boxModel]: location
            };
            
            // Generate CSRF token
            const csrfToken = Math.random().toString(36).substring(2, 15) + 
                             Math.random().toString(36).substring(2, 15);
            
            // Save to API
            const response = await fetch(`/api/store/${this.options.storeId}/update-locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changes: changes,
                    csrf_token: csrfToken
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Failed to save location: ${errorData?.detail || response.statusText}`);
            }
            
            // If we have an onSave callback, call it to update the UI without tracking this as a pending change
            if (this.options.onSave) {
                this.options.onSave(location, true); // Pass true to indicate this was already saved to API
            }
            
            // Close the modal
            this.close();
        } catch (error) {
            console.error("Error saving location:", error);
            alert("Failed to save location: " + error.message);
        }
    }
    
    // Just close without saving
    cancel() {
        this.close();
    }
    
    delete() {
        if (confirm('Are you sure you want to remove this location?')) {
            try {
                // Save directly to the API with null to clear location
                const boxModel = this.options.boxModel;
                
                // Create changes object with just this box
                const changes = {
                    [boxModel]: null
                };
                
                // Generate CSRF token
                const csrfToken = Math.random().toString(36).substring(2, 15) + 
                                 Math.random().toString(36).substring(2, 15);
                
                // Send API request
                fetch(`/api/store/${this.options.storeId}/update-locations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        changes: changes,
                        csrf_token: csrfToken
                    })
                }).then(response => {
                    if (!response.ok) {
                        return response.json().then(errorData => {
                            throw new Error(`Failed to delete location: ${errorData?.detail || response.statusText}`);
                        });
                    }
                    
                    // If we have an onClear callback, call it to update the UI without tracking as a pending change
                    if (this.options.onClear) {
                        this.options.onClear(true); // Pass true to indicate this was already saved to API
                    }
                }).catch(error => {
                    console.error("Error deleting location:", error);
                    alert("Failed to delete location: " + error.message);
                });
            } catch (error) {
                console.error("Error deleting location:", error);
                alert("Failed to delete location: " + error.message);
            }
            
            this.close();
        }
    }
    
    close() {
        // Clean up event listener
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Remove custom styles
        if (this.customStyleElement) {
            this.customStyleElement.remove();
        }
        
        // Remove modal from DOM
        this.modal.remove();
        
        // Clean up viewer
        if (this.viewer) {
            // Any additional cleanup needed
        }
    }
    
    static show(options) {
        return new LocationModal(options);
    }
}

// CSS styles - add to your CSS file
const styles = `
.location-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.location-modal {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
    color: #333;
}

.modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.modal-close:hover {
    background: #f5f5f5;
    color: #333;
}

.modal-body {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
}

.modal-footer {
    display: flex;
    justify-content: space-between;
    padding: 15px 20px;
    border-top: 1px solid #eee;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
}

.btn-primary {
    background: #4CAF50;
    color: white;
}

.btn-primary:hover {
    background: #45a049;
}

.btn-primary:disabled {
    background: #cccccc;
    cursor: not-allowed;
}

.btn-secondary {
    background: #666;
    color: white;
}

.btn-secondary:hover {
    background: #555;
}
`;