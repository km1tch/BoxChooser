// Price Table Core Component
// Handles data processing and shared logic for price tables

class PriceTable {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.storeId = options.storeId;
        this.isEditable = options.isEditable || false;
        this.onSave = options.onSave || (() => {});
        
        // Data management
        this.originalData = [];
        this.changedData = {};
        this.changeCount = 0;
        
        // DataTable instance
        this.dataTable = null;
        
        // Renderer based on edit mode
        if (this.isEditable && typeof PriceTableEdit !== 'undefined') {
            this.renderer = new PriceTableEdit(this);
        } else if (!this.isEditable && typeof PriceTableView !== 'undefined') {
            this.renderer = new PriceTableView(this);
        } else {
            console.error('Required renderer class not found:', this.isEditable ? 'PriceTableEdit' : 'PriceTableView');
            throw new Error('Table renderer not available');
        }
    }
    
    // Initialize with data
    async initialize(data) {
        this.originalData = JSON.parse(JSON.stringify(data));
        
        // Clear any existing table
        if (this.dataTable) {
            this.dataTable.destroy();
            $(`#${this.containerId}`).empty();
        }
        
        // Build the table structure
        const tableHtml = this.renderer.buildTableStructure(data);
        $(`#${this.containerId}`).html(tableHtml);
        
        // Initialize DataTable with appropriate columns
        const columns = this.renderer.getColumnDefinitions(data);
        
        this.dataTable = $(`#${this.containerId} table`).DataTable({
            data: data,
            columns: columns,
            paging: false,
            searching: true, // Enable search/filter box
            info: false,
            autoWidth: false,
            order: [], // No default sorting - we pre-sort the data
            ordering: true, // Enable sorting
            drawCallback: (settings) => this.onTableDraw(settings),
            createdRow: (row, data, dataIndex) => this.renderer.onRowCreated(row, data, dataIndex)
        });
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Change "Search:" to "Filter:"
        $('.dataTables_filter label').contents().filter(function() {
            return this.nodeType === 3; // Text node
        }).first().replaceWith('Filter:');
    }
    
    // Common event handlers
    setupEventHandlers() {
        // Delegate to renderer for specific handlers
        this.renderer.setupEventHandlers();
        
        // Common handlers (if any)
    }
    
    // Table draw callback
    onTableDraw(settings) {
        this.renderer.onTableDraw(settings);
    }
    
    // Track changes
    trackChange(model, field, oldValue, newValue) {
        if (!this.changedData[model]) {
            this.changedData[model] = {};
        }
        
        // Check if this is reverting to original
        const originalRow = this.originalData.find(r => r.model === model);
        if (originalRow && originalRow[field] == newValue) {
            delete this.changedData[model][field];
            if (Object.keys(this.changedData[model]).length === 0) {
                delete this.changedData[model];
            }
        } else {
            this.changedData[model][field] = {
                old: oldValue,
                new: newValue
            };
        }
        
        this.updateChangeCounter();
    }
    
    // Update change counter
    updateChangeCounter() {
        this.changeCount = Object.keys(this.changedData).length;
        
        // Update UI
        this.renderer.updateChangeCounter(this.changeCount);
    }
    
    // Get all changes
    getChanges() {
        const changes = [];
        
        // Price changes only (locations are saved immediately)
        for (const [model, fields] of Object.entries(this.changedData)) {
            for (const [field, values] of Object.entries(fields)) {
                changes.push({
                    model: model,
                    field: field,
                    oldValue: values.old,
                    newValue: values.new
                });
            }
        }
        
        return changes;
    }
    
    // Save changes
    async saveChanges() {
        const changes = this.getChanges();
        if (changes.length === 0) return;
        
        try {
            await this.onSave(changes);
            
            // Clear change tracking
            this.changedData = {};
            this.changeCount = 0;
            this.updateChangeCounter();
            
            // Update original data
            this.originalData = JSON.parse(JSON.stringify(
                this.dataTable.rows().data().toArray()
            ));
        } catch (error) {
            console.error('Error saving changes:', error);
            throw error;
        }
    }
    
    // Utility: Get box section - matches original logic
    static getBoxSection(model, boxType) {
        // First try to categorize based on model if it exists
        if (model && model !== '') {
            if (/C-UPS$|C$|Cube$/.test(model)) {
                return "CUBE";
            } else if (/X 4|X 3|X 6|J-11|J-14|J-15|J-16|SHIRTB/.test(model)) {
                return "SMALL";
            } else if (/J-20|WREATH|ST-6|MIR-3|MIR-8/.test(model)) {
                return "MEDIUM";
            } else if (/J-64|SUITCASE|VCR|24 X 18 X 18/.test(model)) {
                return "LARGE";
            } else {
                // Check if dimensions indicate a cube (all dimensions equal)
                // Model might be like "22x22x22" or "22 X 22 X 22"
                const normalizedModel = model.toLowerCase().replace(/\s+/g, '');
                const match = normalizedModel.match(/^(\d+)x(\d+)x(\d+)$/);
                if (match && match[1] === match[2] && match[2] === match[3]) {
                    return "CUBE";
                }
                return "SPECIALTY";
            }
        }
        
        // If no model or couldn't categorize, use box type
        if (boxType) {
            if (boxType === 'NormalBox') {
                return "NORMAL";
            } else if (boxType === 'CustomBox') {
                return "CUSTOM";
            }
        }
        
        // Fallback
        return "OTHER";
    }
}

// Make available globally
window.PriceTable = PriceTable;