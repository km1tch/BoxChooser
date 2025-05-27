// Reusable floorplan viewer component with X marking capabilities
export class FloorplanViewer {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            mode: 'view', // 'view', 'edit', 'multi'
            storeId: null,
            showAllMarkers: false,
            onLocationSelect: null,
            onLocationHover: null,
            initialLocation: null,
            boxData: [], // For showing which boxes are at each location
            ...options
        };
        
        this.markers = [];
        this.selectedLocation = null;
        this.image = null;
        
        this.init();
    }
    
    async init() {
        if (!this.options.storeId) {
            console.error('FloorplanViewer: storeId is required');
            return;
        }
        
        await this.loadFloorplan();
        this.render();
        this.attachEventListeners();
        
        if (this.options.mode === 'multi' && this.options.showAllMarkers) {
            await this.loadAllMarkers();
        }
    }
    
    async loadFloorplan() {
        try {
            const response = await fetch(`/api/store/${this.options.storeId}/floorplan`);
            if (!response.ok) {
                throw new Error('Floorplan not found');
            }
            
            const blob = await response.blob();
            this.imageUrl = URL.createObjectURL(blob);
        } catch (error) {
            console.error('Error loading floorplan:', error);
            this.imageUrl = null;
        }
    }
    
    render() {
        this.container.innerHTML = `
            <div class="floorplan-viewer ${this.options.mode}-mode">
                ${this.imageUrl ? `
                    <div class="floorplan-container">
                        <img class="floorplan-image" src="${this.imageUrl}" alt="Store floorplan">
                        <div class="marker-layer"></div>
                        ${this.options.mode === 'multi' ? `
                            <div class="toggle-markers">
                                <button class="toggle-btn" id="toggle-markers">
                                    ${this.options.showAllMarkers ? 'Hide' : 'Show'} All Locations
                                </button>
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="no-floorplan">
                        <p>No floorplan available for this store.</p>
                    </div>
                `}
                <!-- Removed label input as requested -->
                <!-- Removed location label display as requested -->
            </div>
        `;
        
        // Cache DOM elements
        this.image = this.container.querySelector('.floorplan-image');
        this.markerLayer = this.container.querySelector('.marker-layer');
        this.toggleBtn = this.container.querySelector('#toggle-markers');
        this.labelInput = this.container.querySelector('#location-label');
        
        // Add initial marker if provided
        if (this.options.initialLocation?.coords) {
            this.addMarker(
                this.options.initialLocation.coords[0],
                this.options.initialLocation.coords[1],
                'current'
                // No label parameter - we don't want it in the UX
            );
        }
    }
    
    attachEventListeners() {
        if (!this.image) return;
        
        // Wait for image to load before setting up positioning
        this.image.addEventListener('load', () => {
            this.updateMarkerPositions();
        });
        
        // Handle clicks on floorplan
        this.markerLayer.addEventListener('click', (e) => {
            const rect = this.markerLayer.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            // Check if click is on a marker
            const clickedMarker = this.getMarkerAtPosition(x, y);
            
            if (clickedMarker) {
                // Clicked on existing marker
                if (this.options.onLocationSelect) {
                    this.options.onLocationSelect(clickedMarker);
                }
            } else if (this.options.mode === 'edit') {
                // Clicked on empty space in edit mode
                if (this.options.onFloorplanClick) {
                    // Store the selected location
                    this.selectedLocation = {
                        coords: [x, y]
                    };
                    
                    // Notify parent component
                    this.options.onFloorplanClick([x, y]);
                }
            }
        });
        
        // Toggle button for multi mode
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.options.showAllMarkers = !this.options.showAllMarkers;
                this.toggleBtn.textContent = this.options.showAllMarkers ? 'Hide All Locations' : 'Show All Locations';
                
                if (this.options.showAllMarkers) {
                    this.loadAllMarkers();
                } else {
                    this.clearMarkers('all');
                }
            });
        }
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.updateMarkerPositions();
        });
    }
    
    async loadAllMarkers() {
        if (this.options.mode !== 'multi') return;
        
        try {
            const response = await fetch(`/api/store/${this.options.storeId}/box-locations`);
            const locations = await response.json();
            
            // Group boxes by location
            const locationMap = new Map();
            
            locations.forEach(box => {
                if (box.coords) {
                    const key = box.coords.join(',');
                    if (!locationMap.has(key)) {
                        locationMap.set(key, {
                            coords: box.coords,
                            label: box.label,
                            boxes: []
                        });
                    }
                    locationMap.get(key).boxes.push(box);
                }
            });
            
            // Clear existing "all" markers
            this.clearMarkers('all');
            
            // Add markers for each unique location
            locationMap.forEach((location, key) => {
                const marker = this.addMarker(
                    location.coords[0],
                    location.coords[1],
                    'all',
                    location.label,
                    location.boxes
                );
                
                // Add hover tooltip
                marker.addEventListener('mouseenter', () => {
                    this.showTooltip(marker, location.boxes);
                });
                
                marker.addEventListener('mouseleave', () => {
                    this.hideTooltip();
                });
            });
        } catch (error) {
            console.error('Error loading markers:', error);
        }
    }
    
    addMarker(x, y, id = '', label = '', boxes = []) {
        const marker = document.createElement('div');
        marker.className = `location-marker marker-${id || 'default'}`;
        marker.dataset.x = x;
        marker.dataset.y = y;
        marker.dataset.id = id;
        // Store the label in the dataset but don't display it visually
        marker.dataset.label = label;
        marker.innerHTML = 'X'; // Bold X symbol only, no label text
        
        // Get edit mode status
        const isEditMode = this.container.classList.contains('edit-mode');
        
        // Create hidden controls element to maintain marker layout
        const controls = document.createElement('div');
        controls.className = 'marker-controls';
        controls.style.display = 'none';
        
        // Only add controls in edit mode and for non-temp markers
        if (isEditMode && id !== 'temp') {
            marker.appendChild(controls);
        }
        
        // We're not adding any tooltips or labels to keep the UI clean with just 'X' markers
        
        this.markerLayer.appendChild(marker);
        this.markers.push({ element: marker, x, y, type: id });
        
        this.updateMarkerPosition(marker);
        
        return marker;
    }
    
    clearMarkers(type) {
        this.markers = this.markers.filter(marker => {
            if (type === 'all' || marker.type === type) {
                marker.element.remove();
                return false;
            }
            return true;
        });
    }
    
    updateMarkerPositions() {
        this.markers.forEach(marker => {
            this.updateMarkerPosition(marker.element);
        });
    }
    
    updateMarkerPosition(marker) {
        const rect = this.markerLayer.getBoundingClientRect();
        const x = parseFloat(marker.dataset.x);
        const y = parseFloat(marker.dataset.y);
        
        // Set position directly with left/top
        marker.style.left = `${x * rect.width}px`;
        marker.style.top = `${y * rect.height}px`;
    }
    
    showTooltip(marker, boxes) {
        // Only show tooltips in multi mode for markers showing multiple box locations
        // Don't show tooltips for the current box marker or in view mode with single box
        if (marker.classList.contains('marker-current') || this.options.mode === 'view') {
            return;
        }
        
        const tooltip = document.createElement('div');
        tooltip.className = 'marker-tooltip';
        
        const content = boxes.slice(0, 5).map(box => 
            `<div>${box.model} (${box.dimensions.join('x')})</div>`
        ).join('');
        
        const more = boxes.length > 5 ? `<div>...and ${boxes.length - 5} more</div>` : '';
        
        tooltip.innerHTML = `
            <div class="tooltip-content">
                ${content}
                ${more}
            </div>
        `;
        
        marker.appendChild(tooltip);
    }
    
    hideTooltip() {
        const tooltips = this.container.querySelectorAll('.marker-tooltip');
        tooltips.forEach(t => t.remove());
    }
    
    getLocation() {
        if (this.options.mode !== 'edit') return null;
        
        if (this.selectedLocation) {
            return {
                coords: this.selectedLocation.coords
                // No label included - we don't want it in the UX
            };
        }
        
        return null;
    }
    
    clearLocation() {
        this.selectedLocation = null;
        this.clearMarkers('current');
        // Label input removed from UX
    }
    
    setMode(mode) {
        this.options.mode = mode;
        
        // Add a class to the container
        if (mode === 'edit') {
            this.container.classList.add('edit-mode');
            this.container.classList.remove('view-mode');
            this.markerLayer.style.pointerEvents = 'auto';
            this.markerLayer.style.cursor = 'crosshair';
        } else {
            this.container.classList.add('view-mode');
            this.container.classList.remove('edit-mode');
            this.markerLayer.style.pointerEvents = 'none';
            this.markerLayer.style.cursor = 'default';
        }
        
        // Force a refresh of all markers to update controls visibility
        const oldMarkers = [...this.markers];
        this.clearMarkers('all');
        
        // Re-add the markers
        oldMarkers.forEach(marker => {
            if (marker.type !== 'temp') {
                this.addMarker(marker.x, marker.y, marker.type, marker.element.dataset.label);
            }
        });
    }
    
    getMarkerAtPosition(x, y) {
        // Find if click is on any existing marker
        for (const markerData of this.markers) {
            const markerX = parseFloat(markerData.element.dataset.x);
            const markerY = parseFloat(markerData.element.dataset.y);
            
            // Check if click is within marker bounds (approximate)
            const distance = Math.sqrt(Math.pow(x - markerX, 2) + Math.pow(y - markerY, 2));
            if (distance < 0.03) { // Adjust threshold as needed
                return {
                    id: markerData.element.dataset.id || markerData.type,
                    coords: [markerX, markerY],
                    label: markerData.element.dataset.label || '',
                    element: markerData.element
                };
            }
        }
        
        return null;
    }
}

// CSS styles - add to your CSS file
const styles = `
.floorplan-viewer {
    position: relative;
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
}

.floorplan-container {
    position: relative;
    width: 100%;
    border: 2px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
}

.floorplan-image {
    width: 100%;
    height: auto;
    display: block;
}

.marker-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.edit-mode .marker-layer {
    pointer-events: auto;
    cursor: crosshair;
}

.location-marker {
    position: absolute;
    width: 80px;
    height: 80px;
    margin-left: -40px;
    margin-top: -40px;
    color: #FF0000;
    font-size: 72px;
    font-weight: 900;
    text-align: center;
    line-height: 80px;
    pointer-events: auto;
    cursor: pointer;
    text-shadow: 
        3px 3px 0px #000,
        -3px -3px 0px #000,
        3px -3px 0px #000,
        -3px 3px 0px #000,
        0px 0px 8px rgba(0,0,0,0.5);
    z-index: 10;
    user-select: none;
    transition: transform 0.2s ease-in-out;
}

.location-marker.draggable {
    opacity: 0.8;
    transform: scale(1.1);
}

.marker-controls {
    position: absolute;
    bottom: 75px;  /* Position below the X marker */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    opacity: 1; /* Always visible in edit mode */
    z-index: 20;
    background: rgba(255, 255, 255, 0.9);
    padding: 6px 10px;
    border-radius: 8px;
    border: 2px solid #333;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.marker-delete-btn, .marker-move-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid #333;
    background-color: white;
    font-size: 22px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0,0,0,0.4);
    margin: 0 4px;
    font-weight: bold;
    transition: all 0.2s ease;
}

.marker-delete-btn {
    background-color: #ffebee;
    color: #c62828;
    border-color: #c62828;
}

.marker-move-btn {
    background-color: #e3f2fd;
    color: #1565c0;
    border-color: #1565c0;
}

.marker-delete-btn:hover {
    background-color: #ffcdd2;
    transform: scale(1.15);
    box-shadow: 0 6px 8px rgba(0,0,0,0.5);
}

.marker-move-btn:hover {
    background-color: #bbdefb;
    transform: scale(1.15);
    box-shadow: 0 6px 8px rgba(0,0,0,0.5);
}

.marker-current {
    color: #FF0000;
    font-size: 72px;
}

.marker-temp {
    color: #FFD700;
}

.marker-all {
    color: blue;
}

.marker-all:hover {
    color: darkblue;
    transform: scale(1.2);
}

.marker-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 8px;
    font-size: 12px;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    z-index: 1000;
}

.location-label-input {
    margin-top: 15px;
}

.location-label-input label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.location-label-input input {
    width: 100%;
    max-width: 300px;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.location-label-display {
    margin-top: 15px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 4px;
}

.toggle-markers {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 100;
}

.toggle-btn {
    padding: 8px 15px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.toggle-btn:hover {
    background: #f5f5f5;
}

.no-floorplan {
    padding: 40px;
    text-align: center;
    background: #f5f5f5;
    border-radius: 4px;
}
`;