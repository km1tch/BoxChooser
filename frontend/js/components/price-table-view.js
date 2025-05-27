// Price Table View Mode Renderer
// Handles read-only view rendering with combined Model/Dimensions column

class PriceTableView {
    constructor(priceTable) {
        this.priceTable = priceTable;
        this.hasRealModels = false;
        this.hasLocations = false;
    }
    
    // Build table HTML structure
    buildTableStructure(data) {
        // Check what columns we need
        this.hasRealModels = data.some(item => 
            item.model && item.model !== '' && !item.model.startsWith('Unknown-')
        );
        this.hasLocations = data.some(item => item.location && item.location !== '???');
        
        let html = '<table id="priceTable" class="display price-table read-only" style="width:100%">';
        
        if (this.priceTable.pricingMode === 'standard') {
            html += this.buildStandardHeader();
        } else {
            html += this.buildItemizedHeader();
        }
        
        html += '<tbody></tbody></table>';
        return html;
    }
    
    // Build header for standard pricing mode
    buildStandardHeader() {
        let html = '<thead><tr>';
        
        // Section column (hidden via CSS in view mode)
        html += '<th>Section</th>';
        
        // Combined column for view mode
        html += '<th>Box Details</th>';
        
        // Price columns
        html += '<th>Box Price</th>';
        html += '<th><img src="/assets/icons/total.png" width="24" height="24" alt="Basic Total" title="Basic Total"></th>';
        html += '<th><img src="/assets/icons/total.png" width="24" height="24" alt="Standard Total" title="Standard Total"></th>';
        html += '<th><img src="/assets/icons/total.png" width="24" height="24" alt="Fragile Total" title="Fragile Total"></th>';
        html += '<th><img src="/assets/icons/total.png" width="24" height="24" alt="Custom Total" title="Custom Total"></th>';
        
        // No location column in view mode
        
        html += '</tr></thead>';
        return html;
    }
    
    // Build header for itemized pricing mode
    buildItemizedHeader() {
        let html = '<thead>';
        
        // First row with group headers
        html += '<tr>';
        html += '<th rowspan="2">Section</th>';
        
        // Combined column for view mode
        html += '<th rowspan="2">Box Details</th>';
        html += '<th rowspan="2">Box Price</th>';
        
        // Group headers
        html += '<th colspan="3" class="group-header basic-group">Basic Pack</th>';
        html += '<th colspan="3" class="group-header standard-group">Standard Pack</th>';
        html += '<th colspan="3" class="group-header fragile-group">Fragile Pack</th>';
        html += '<th colspan="3" class="group-header custom-group">Custom Pack</th>';
        
        // No location column in view mode
        html += '</tr>';
        
        // Second row with individual column headers
        html += '<tr>';
        
        // Basic group
        html += '<th class="basic-group"><img src="/assets/icons/materials.png" width="24" height="24" alt="Materials" title="Basic Materials"></th>';
        html += '<th class="basic-group"><img src="/assets/icons/services.png" width="24" height="24" alt="Services" title="Basic Services"></th>';
        html += '<th class="basic-group"><img src="/assets/icons/total.png" width="24" height="24" alt="Total" title="Basic Total"></th>';
        
        // Standard group
        html += '<th class="standard-group"><img src="/assets/icons/materials.png" width="24" height="24" alt="Materials" title="Standard Materials"></th>';
        html += '<th class="standard-group"><img src="/assets/icons/services.png" width="24" height="24" alt="Services" title="Standard Services"></th>';
        html += '<th class="standard-group"><img src="/assets/icons/total.png" width="24" height="24" alt="Total" title="Standard Total"></th>';
        
        // Fragile group
        html += '<th class="fragile-group"><img src="/assets/icons/materials.png" width="24" height="24" alt="Materials" title="Fragile Materials"></th>';
        html += '<th class="fragile-group"><img src="/assets/icons/services.png" width="24" height="24" alt="Services" title="Fragile Services"></th>';
        html += '<th class="fragile-group"><img src="/assets/icons/total.png" width="24" height="24" alt="Total" title="Fragile Total"></th>';
        
        // Custom group
        html += '<th class="custom-group"><img src="/assets/icons/materials.png" width="24" height="24" alt="Materials" title="Custom Materials"></th>';
        html += '<th class="custom-group"><img src="/assets/icons/services.png" width="24" height="24" alt="Services" title="Custom Services"></th>';
        html += '<th class="custom-group"><img src="/assets/icons/total.png" width="24" height="24" alt="Total" title="Custom Total"></th>';
        
        html += '</tr></thead>';
        return html;
    }
    
    // Get column definitions for DataTable
    getColumnDefinitions(data) {
        const columns = [
            { 
                data: 'section'
            },
            {
                // Combined Model/Dimensions column for screen
                data: null,
                render: (data, type, row) => {
                    const dimensions = row.dimensions;
                    const model = row.model || '';
                    const location = row.location;
                    
                    if (type === 'display') {
                        let html = `<div class="box-details">`;
                        html += `<div class="dimensions-line"><strong>${dimensions}</strong></div>`;
                        if (this.hasRealModels && model) {
                            html += `<div class="model-line">`;
                            html += model;
                            
                            // Add location eyeball icon if location exists
                            if (this.hasLocations) {
                                const hasCoords = location && typeof location === 'object' && 
                                                 location.coords && location.coords.length > 0;
                                html += ` <button class="location-btn view-location inline-location-btn" 
                                        data-model="${row.model}" 
                                        ${!hasCoords ? 'disabled' : ''} 
                                        title="${hasCoords ? 'View location on floorplan' : 'No coordinates set'}"
                                        style="opacity: ${hasCoords ? '1' : '0.4'}">
                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                                    </svg>
                                </button>`;
                            }
                            
                            html += `</div>`;
                        }
                        html += `</div>`;
                        return html;
                    }
                    return dimensions; // For sorting
                }
            }
        ];
        
        if (this.priceTable.pricingMode === 'standard') {
            columns.push(
                { 
                    data: 'box_price',
                    render: (data) => parseFloat(data).toFixed(2)
                },
                { 
                    data: 'basic',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'basic-group'
                },
                { 
                    data: 'standard',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'standard-group'
                },
                { 
                    data: 'fragile',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'fragile-group'
                },
                { 
                    data: 'custom',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'custom-group'
                }
            );
        } else {
            // Itemized pricing columns
            columns.push(
                { 
                    data: 'box_price',
                    render: (data) => parseFloat(data).toFixed(2)
                },
                // Basic group
                { 
                    data: 'basic_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'basic-group'
                },
                { 
                    data: 'basic_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'basic-group'
                },
                { 
                    data: 'basic_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell basic-group'
                },
                // Standard group
                { 
                    data: 'standard_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'standard-group'
                },
                { 
                    data: 'standard_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'standard-group'
                },
                { 
                    data: 'standard_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell standard-group'
                },
                // Fragile group
                { 
                    data: 'fragile_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'fragile-group'
                },
                { 
                    data: 'fragile_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'fragile-group'
                },
                { 
                    data: 'fragile_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell fragile-group'
                },
                // Custom group
                { 
                    data: 'custom_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'custom-group'
                },
                { 
                    data: 'custom_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'custom-group'
                },
                { 
                    data: 'custom_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell custom-group'
                }
            );
        }
        
        // No location column in view mode - eyeball is in box details
        
        return columns;
    }
    
    // Row created callback
    onRowCreated(row, data, dataIndex) {
        // Add row coloring based on section
        const $row = $(row);
        
        // Add data-section attribute for print page breaks
        $row.attr('data-section', data.section);
        
        if (data.section === 'CUBE') {
            $row.addClass('blue-row');
        } else if (data.section === 'SMALL') {
            $row.addClass('yellow-row');
        } else if (data.section === 'MEDIUM') {
            $row.addClass('green-row');
        } else if (data.section === 'LARGE') {
            $row.addClass('pink-row');
        } else if (data.section === 'SPECIALTY') {
            $row.addClass('orange-row');
        } else if (data.section === 'NORMAL') {
            $row.addClass('normal-row');
        } else if (data.section === 'CUSTOM') {
            $row.addClass('custom-row');
        }
    }
    
    // Table draw callback
    onTableDraw(settings) {
        // Any view-specific draw handling
    }
    
    // Setup event handlers
    setupEventHandlers() {
        const $table = $('#priceTable');
        
        // View location button handler
        $table.on('click', '.view-location:not(:disabled)', (e) => {
            e.preventDefault();
            const model = $(e.currentTarget).data('model');
            const row = this.priceTable.dataTable.rows().data().toArray()
                .find(r => r.model === model);
            
            if (row && row.location && typeof row.location === 'object' && row.location.coords) {
                // Open location viewer modal
                if (typeof openLocationViewer === 'function') {
                    openLocationViewer(model, row.location);
                }
            }
        });
    }
    
    // Update change counter (no-op in view mode)
    updateChangeCounter(count) {
        // View mode doesn't track changes
    }
}

// Make available globally
window.PriceTableView = PriceTableView;