// Floorplan upload component with drag-and-drop support
export class FloorplanUpload {
    constructor(container, storeId, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.storeId = storeId;
        this.options = {
            maxSize: 5 * 1024 * 1024, // 5MB
            allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp'],
            onUploadSuccess: () => {},
            onUploadError: () => {},
            ...options
        };
        
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
    
    init() {
        this.render();
        this.attachEventListeners();
    }
    
    render() {
        this.container.innerHTML = `
            <div class="floorplan-upload">
                <div class="upload-zone" id="upload-zone">
                    <svg class="upload-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M2 12h20M5 19l7-7 7 7M7 7l5-5 5 5"/>
                    </svg>
                    <h3>Upload Store Floorplan</h3>
                    <p>Drag and drop an image here, or click to select</p>
                    <p class="file-types">PNG, JPEG, GIF, BMP, TIFF, or WebP (max 5MB)</p>
                    <input type="file" id="file-input" accept="image/*" style="display: none;">
                </div>
                <div class="upload-preview" id="upload-preview" style="display: none;">
                    <img id="preview-image" src="" alt="Floorplan preview">
                    <div class="preview-actions">
                        <button id="upload-button" class="btn btn-primary">Upload Floorplan</button>
                        <button id="cancel-button" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
                <div class="upload-status" id="upload-status"></div>
            </div>
        `;
        
        // Cache DOM elements
        this.uploadZone = this.container.querySelector('#upload-zone');
        this.fileInput = this.container.querySelector('#file-input');
        this.uploadPreview = this.container.querySelector('#upload-preview');
        this.previewImage = this.container.querySelector('#preview-image');
        this.uploadButton = this.container.querySelector('#upload-button');
        this.cancelButton = this.container.querySelector('#cancel-button');
        this.uploadStatus = this.container.querySelector('#upload-status');
    }
    
    attachEventListeners() {
        // Click to open file dialog
        this.uploadZone.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });
        
        // Drag and drop events
        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('drag-over');
        });
        
        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.classList.remove('drag-over');
        });
        
        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFile(file);
            }
        });
        
        // Upload and cancel buttons
        this.uploadButton.addEventListener('click', () => {
            this.uploadFile();
        });
        
        this.cancelButton.addEventListener('click', () => {
            this.reset();
        });
    }
    
    handleFile(file) {
        // Validate file type
        if (!this.options.allowedTypes.includes(file.type)) {
            this.showError('Invalid file type. Please upload PNG, JPEG, GIF, BMP, TIFF, or WebP files.');
            return;
        }
        
        // Validate file size
        if (file.size > this.options.maxSize) {
            this.showError(`File too large. Maximum size is ${this.options.maxSize / 1024 / 1024}MB.`);
            return;
        }
        
        // Store file for upload
        this.selectedFile = file;
        
        // Preview image
        const reader = new FileReader();
        reader.onload = (e) => {
            this.previewImage.src = e.target.result;
            this.showPreview();
        };
        reader.readAsDataURL(file);
    }
    
    showPreview() {
        this.uploadZone.style.display = 'none';
        this.uploadPreview.style.display = 'block';
        this.uploadStatus.innerHTML = '';
    }
    
    async uploadFile() {
        if (!this.selectedFile) return;
        
        // Check if there are any existing locations with coordinates
        const shouldCheckLocations = await this.checkExistingLocations();
        
        if (shouldCheckLocations) {
            // Show confirmation dialog
            const confirmed = confirm(
                'Warning: Uploading a new floorplan will clear all existing location coordinates for this store.\n\n' +
                'Are you sure you want to continue?'
            );
            
            if (!confirmed) {
                this.uploadButton.disabled = false;
                return;
            }
        }
        
        this.uploadButton.disabled = true;
        this.showStatus('Uploading floorplan...', 'loading');
        
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        
        try {
            // Add auth token if available
            const headers = {};
            if (typeof AuthManager !== 'undefined') {
                const token = AuthManager.getToken(this.storeId);
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }
            
            const response = await fetch(`/api/store/${this.storeId}/floorplan`, {
                method: 'POST',
                headers: headers,
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }
            
            const result = await response.json();
            
            // Show success message with conversion info if applicable
            let successMessage = 'Floorplan uploaded successfully!';
            if (result.original_type !== result.saved_type) {
                successMessage += ` (converted to ${result.saved_type === 'image/png' ? 'PNG' : result.saved_type})`;
            }
            this.showStatus(successMessage, 'success');
            
            // Call success callback
            this.options.onUploadSuccess(result);
            
            // Reset after delay
            setTimeout(() => {
                this.reset();
            }, 2000);
            
        } catch (error) {
            this.showError(error.message || 'Upload failed');
            this.uploadButton.disabled = false;
            this.options.onUploadError(error);
        }
    }
    
    async checkExistingLocations() {
        try {
            const response = await this.authenticatedFetch(`/api/store/${this.storeId}/box-locations`);
            if (!response.ok) return false;
            
            const locations = await response.json();
            
            // Check if any location has coordinates
            return locations.some(loc => loc.coords !== null);
        } catch (error) {
            console.error('Error checking locations:', error);
            return false;
        }
    }
    
    showStatus(message, type) {
        this.uploadStatus.className = `upload-status ${type}`;
        this.uploadStatus.textContent = message;
    }
    
    showError(message) {
        this.showStatus(message, 'error');
    }
    
    reset() {
        this.uploadZone.style.display = 'block';
        this.uploadPreview.style.display = 'none';
        this.fileInput.value = '';
        this.selectedFile = null;
        this.uploadButton.disabled = false;
        this.uploadStatus.innerHTML = '';
    }
}

// Default styles - add to your CSS file
const styles = `
.floorplan-upload {
    max-width: 600px;
    margin: 0 auto;
}

.upload-zone {
    border: 3px dashed #ccc;
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
}

.upload-zone:hover {
    border-color: #999;
    background-color: #f9f9f9;
}

.upload-zone.drag-over {
    border-color: #4CAF50;
    background-color: #f0f8ff;
}

.upload-icon {
    color: #666;
    margin-bottom: 20px;
}

.upload-zone h3 {
    margin: 0 0 10px 0;
    color: #333;
}

.upload-zone p {
    margin: 5px 0;
    color: #666;
}

.file-types {
    font-size: 0.9em;
    color: #999;
}

.upload-preview {
    text-align: center;
}

.upload-preview img {
    max-width: 100%;
    max-height: 400px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 20px;
}

.preview-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}

.btn-primary {
    background-color: #4CAF50;
    color: white;
}

.btn-primary:hover {
    background-color: #45a049;
}

.btn-secondary {
    background-color: #666;
    color: white;
}

.btn-secondary:hover {
    background-color: #555;
}

.upload-status {
    margin-top: 20px;
    padding: 10px;
    border-radius: 4px;
    text-align: center;
}

.upload-status.loading {
    background-color: #e3f2fd;
    color: #1976d2;
}

.upload-status.success {
    background-color: #e8f5e9;
    color: #4caf50;
}

.upload-status.error {
    background-color: #ffebee;
    color: #f44336;
}
`;