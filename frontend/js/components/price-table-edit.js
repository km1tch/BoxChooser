// Price Table Edit Mode Renderer
// Handles editable table rendering with separate Model and Dimensions columns

class PriceTableEdit {
    constructor(priceTable) {
        this.priceTable = priceTable;
        this.hasRealModels = false;
        this.hasLocations = false;
        this.currentEditCell = null;
    }
    
    // Build table HTML structure
    buildTableStructure(data) {
        // Check what columns we need
        this.hasRealModels = data.some(item => 
            item.model && item.model !== '' && !item.model.startsWith('Unknown-')
        );
        // Only show locations column if floorplan exists AND there are locations
        this.hasLocations = window.hasFloorplan && data.some(item => item.location && item.location !== '???');
        
        let html = '<table id="priceTable" class="display price-table editable-mode" style="width:100%">';
        
        // Always use itemized pricing header
        html += this.buildItemizedHeader();
        
        html += '<tbody></tbody></table>';
        return html;
    }
    
    
    // Build header for itemized pricing mode
    buildItemizedHeader() {
        let html = '<thead>';
        
        // First row with group headers
        html += '<tr>';
        html += '<th rowspan="2">Section</th>';
        
        if (this.hasRealModels) {
            html += '<th rowspan="2">Model</th>';
        }
        
        html += '<th rowspan="2">Dimensions</th>';
        html += '<th rowspan="2">Box Price</th>';
        
        // Group headers
        html += '<th colspan="3" class="group-header basic-group">Basic Pack</th>';
        html += '<th colspan="3" class="group-header standard-group">Standard Pack</th>';
        html += '<th colspan="3" class="group-header fragile-group">Fragile Pack</th>';
        html += '<th colspan="3" class="group-header custom-group">Custom Pack</th>';
        
        if (this.hasLocations) {
            html += '<th rowspan="2" title="Location">📍</th>';
        }
        html += '</tr>';
        
        // Second row with individual column headers
        html += '<tr>';
        
        // Note: No need to add headers for columns with rowspan="2" from first row
        // They already occupy this row
        
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
            { data: 'section', searchable: false }
        ];
        
        // Add model column if needed
        if (this.hasRealModels) {
            columns.push({ 
                data: 'model',
                render: (data, type, row) => {
                    // For search/filter, return the text content
                    if (type === 'filter' || type === 'search') {
                        return data || '';
                    }
                    return data;
                }
            });
        }
        
        columns.push({ 
            data: 'dimensions',
            render: (data, type, row) => {
                // For search/filter, return the text content
                if (type === 'filter' || type === 'search') {
                    return data || '';
                }
                return data;
            }
        });
        
        // Always use itemized pricing columns - all non-searchable
        columns.push(
                { 
                    data: 'box_price',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable box-price-cell',
                    searchable: false
                },
                // Basic group
                { 
                    data: 'basic_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable basic-group',
                    searchable: false
                },
                { 
                    data: 'basic_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable basic-group',
                    searchable: false
                },
                { 
                    data: 'basic_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell basic-group',
                    searchable: false
                },
                // Standard group
                { 
                    data: 'standard_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable standard-group',
                    searchable: false
                },
                { 
                    data: 'standard_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable standard-group',
                    searchable: false
                },
                { 
                    data: 'standard_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell standard-group',
                    searchable: false
                },
                // Fragile group
                { 
                    data: 'fragile_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable fragile-group',
                    searchable: false
                },
                { 
                    data: 'fragile_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable fragile-group',
                    searchable: false
                },
                { 
                    data: 'fragile_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell fragile-group',
                    searchable: false
                },
                // Custom group
                { 
                    data: 'custom_materials',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable custom-group',
                    searchable: false
                },
                { 
                    data: 'custom_services',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'editable custom-group',
                    searchable: false
                },
                { 
                    data: 'custom_total',
                    render: (data) => parseFloat(data).toFixed(2),
                    className: 'total-cell custom-group',
                    searchable: false
                }
            );
        
        // Location column if needed
        if (this.hasLocations) {
            columns.push({
                data: 'location',
                searchable: false,
                render: (data, type, row) => {
                    const hasCoords = data && typeof data === 'object' && 
                                     data.coords && data.coords.length > 0;
                    
                    let label = '';
                    let isTextBasedLocation = false;
                    
                    if (typeof data === 'string') {
                        label = data !== '???' ? data : '';
                        isTextBasedLocation = data !== '???';
                    } else if (data && typeof data === 'object') {
                        label = data.label || '';
                        isTextBasedLocation = !!data.label && !hasCoords;
                    }
                    
                    const hasChanges = this.priceTable.changedData[row.model] !== undefined;
                    const undoClasses = hasChanges ? 'undo-btn show-undo' : 'undo-btn';
                    
                    // Use LocationUtils to render location buttons
                    return LocationUtils.renderLocationButtons(row.model, row.location, {
                        includeUndo: true,
                        undoClass: undoClasses
                    });
                }
            });
        }
        
        return columns;
    }
    
    // Row created callback
    onRowCreated(row, data, dataIndex) {
        // Add row coloring based on section
        const $row = $(row);
        
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
        // Re-add undo button visibility for changed rows
        for (const model in this.priceTable.changedData) {
            $(`.undo-btn[data-model="${model}"]`).addClass('show-undo');
        }
        for (const model in this.priceTable.changedLocations) {
            $(`.location-cell .undo-btn[data-model="${model}"]`).addClass('show-undo');
        }
    }
    
    // Setup event handlers
    setupEventHandlers() {
        const $table = $('#priceTable');
        
        // Editable cell click handler
        $table.on('click', 'td.editable', (e) => {
            this.handleCellEdit(e);
        });
        
        // Undo button handler
        $table.on('click', '.undo-btn', (e) => {
            // Only handle if button has show-undo class
            if ($(e.currentTarget).hasClass('show-undo')) {
                this.handleUndo(e);
            }
        });
        
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
        
        // Listen for the custom event from LocationUtils
        document.addEventListener('location-edit-requested', (event) => {
            const model = event.detail.model;
            // Create a fake event object to match the expected format
            const fakeEvent = {
                preventDefault: () => {},
                currentTarget: { dataset: { model } }
            };
            this.handleLocationEdit(fakeEvent);
        });
        
        // ESC key handler for edit cancel
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape' && this.currentEditCell) {
                this.cancelEdit();
            }
        });
    }
    
    // Handle cell edit
    handleCellEdit(e) {
        const $cell = $(e.currentTarget);
        const row = this.priceTable.dataTable.row($cell.closest('tr'));
        const rowData = row.data();
        const columnIndex = $cell.index();
        
        // Get field name based on column
        const field = this.getFieldFromColumnIndex(columnIndex, rowData);
        if (!field) return;
        
        // Create input
        const currentValue = parseFloat(rowData[field]);
        const $input = $('<input>')
            .attr('type', 'number')
            .attr('step', '0.01')
            .val(currentValue)
            .css({
                width: '70px',  // Fixed width for price inputs
                padding: '2px 4px',
                border: '2px solid #007bff',
                textAlign: 'right',  // Right-align numbers
                fontSize: '13px'
            });
        
        // Replace cell content
        $cell.html($input);
        $input.focus().select();
        
        this.currentEditCell = {
            cell: $cell,
            row: row,
            field: field,
            originalValue: currentValue
        };
        
        // Handle input events
        $input.on('blur', (e) => {
            // Check if blur is caused by clicking an undo button
            const relatedTarget = e.relatedTarget || document.activeElement;
            if (relatedTarget && $(relatedTarget).hasClass('undo-btn')) {
                // Cancel the edit instead of saving
                this.cancelEdit();
                return;
            }
            this.saveEdit();
        });
        $input.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveEdit();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                
                // Store references before saveEdit clears currentEditCell
                const $currentCell = this.currentEditCell.cell;
                const $row = $currentCell.closest('tr');
                
                // Remove blur handler to prevent double-save
                $input.off('blur');
                
                // Save the current edit
                this.saveEdit();
                
                // Find next/previous editable cell
                const $editableCells = $row.find('td.editable');
                const currentIndex = $editableCells.index($currentCell);
                
                let $targetCell = null;
                
                if (e.shiftKey) {
                    // Shift+Tab - go to previous cell
                    if (currentIndex > 0) {
                        $targetCell = $editableCells.eq(currentIndex - 1);
                    } else {
                        // Go to previous row's last editable cell
                        const $prevRow = $row.prev('tr');
                        if ($prevRow.length) {
                            $targetCell = $prevRow.find('td.editable').last();
                        }
                    }
                } else {
                    // Tab - go to next cell
                    if (currentIndex < $editableCells.length - 1) {
                        $targetCell = $editableCells.eq(currentIndex + 1);
                    } else {
                        // Go to next row's first editable cell
                        const $nextRow = $row.next('tr');
                        if ($nextRow.length) {
                            $targetCell = $nextRow.find('td.editable').first();
                        }
                    }
                }
                
                // Click the target cell to start editing
                if ($targetCell && $targetCell.length) {
                    setTimeout(() => $targetCell.click(), 0);
                }
            }
        });
    }
    
    // Save edit
    saveEdit() {
        if (!this.currentEditCell) return;
        
        const { cell, row, field, originalValue } = this.currentEditCell;
        const $input = cell.find('input');
        const newValue = parseFloat($input.val()) || 0;
        
        // Update data
        const rowData = row.data();
        rowData[field] = newValue;
        
        // Update totals (always itemized now)
        this.updateTotals(rowData);
        
        // Track change
        if (newValue !== originalValue) {
            this.priceTable.trackChange(rowData.model, field, originalValue, newValue);
            // Show undo button
            $(`.undo-btn[data-model="${rowData.model}"]`).addClass('show-undo');
        }
        
        // Update row and redraw cell
        row.data(rowData).draw(false);
        
        // Re-apply show-undo class after redraw if there are changes
        if (newValue !== originalValue) {
            setTimeout(() => {
                $(`.undo-btn[data-model="${rowData.model}"]`).addClass('show-undo');
            }, 0);
        }
        
        this.currentEditCell = null;
    }
    
    // Cancel edit
    cancelEdit() {
        if (!this.currentEditCell) return;
        
        const { cell, originalValue } = this.currentEditCell;
        cell.html(originalValue.toFixed(2));
        
        this.currentEditCell = null;
    }
    
    // Handle undo
    handleUndo(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Stop any other handlers
        
        const $button = $(e.currentTarget);
        const model = $button.data('model');
        const $tr = $button.closest('tr');
        const row = this.priceTable.dataTable.row($tr);
        const rowData = row.data();
        
        // Remove changes for this row
        if (this.priceTable.changedData[model]) {
            // Delete the change record first
            delete this.priceTable.changedData[model];
            this.priceTable.updateChangeCounter();
            
            // Restore original values
            const originalRow = this.priceTable.originalData.find(r => r.model === model);
            if (originalRow) {
                Object.assign(rowData, originalRow);
                row.data(rowData).draw(false);
            }
            
            // Ensure the undo button is hidden after the redraw completes
            setTimeout(() => {
                $(`.undo-btn[data-model="${model}"]`).removeClass('show-undo');
            }, 0);
        }
    }
    
    // Handle location edit
    handleLocationEdit(e) {
        e.preventDefault();
        // Handle both jQuery event and custom event format
        const model = e.currentTarget.dataset ? e.currentTarget.dataset.model : $(e.currentTarget).data('model');
        
        // Get current location
        const row = this.priceTable.dataTable.rows().data().toArray()
            .find(r => r.model === model);
        const currentLocation = row ? row.location : null;
        
        // Open location editor
        if (typeof openLocationEditor === 'function') {
            openLocationEditor(model, currentLocation, async (newLocation) => {
                // Save location immediately via API
                try {
                    const updates = {};
                    updates[model] = newLocation;
                    
                    // Use the global CSRF token if available
                    const token = window.csrfToken || Math.random().toString(36).substring(2, 15) +
                                                      Math.random().toString(36).substring(2, 15);
                    
                    const response = await window.api.updateLocations(this.priceTable.storeId, updates, token);
                    
                    // If we got here without throwing, it was successful
                    if (response) {
                        // Update the location in the table
                        if (row) {
                            row.location = newLocation;
                            
                            // Update the data in the DataTable
                            const rowIndex = this.priceTable.dataTable.rows().data().toArray().indexOf(row);
                            if (rowIndex >= 0) {
                                // Update the row data directly
                                this.priceTable.dataTable.row(rowIndex).data(row).draw(false);
                            }
                        }
                        
                        // Show success message
                        if (typeof showStatus === 'function') {
                            showStatus('Location updated successfully', 'success');
                        }
                    } else {
                        throw new Error(response?.error || 'Failed to update location');
                    }
                } catch (error) {
                    console.error('Error updating location:', error);
                    alert('Failed to update location. Please try again.');
                }
            });
        }
    }
    
    // Update totals for itemized pricing
    updateTotals(rowData) {
        rowData.basic_total = rowData.box_price + rowData.basic_materials + rowData.basic_services;
        rowData.standard_total = rowData.box_price + rowData.standard_materials + rowData.standard_services;
        rowData.fragile_total = rowData.box_price + rowData.fragile_materials + rowData.fragile_services;
        rowData.custom_total = rowData.box_price + rowData.custom_materials + rowData.custom_services;
    }
    
    // Get field name from column index
    getFieldFromColumnIndex(columnIndex, rowData) {
        // Adjust for dynamic columns
        let baseIndex = 1; // Skip section
        
        if (this.hasRealModels) {
            if (columnIndex === baseIndex) return null; // Model column
            baseIndex++;
        }
        
        if (columnIndex === baseIndex) return null; // Dimensions column
        baseIndex++;
        
        // Price columns (always itemized now)
        const priceColumns = ['box_price', 'basic_materials', 'basic_services', 'basic_total',
                            'standard_materials', 'standard_services', 'standard_total',
                            'fragile_materials', 'fragile_services', 'fragile_total',
                            'custom_materials', 'custom_services', 'custom_total'];
        
        const fieldIndex = columnIndex - baseIndex;
        if (fieldIndex >= 0 && fieldIndex < priceColumns.length) {
            const field = priceColumns[fieldIndex];
            // Skip total columns in itemized mode
            if (field.endsWith('_total')) return null;
            return field;
        }
        
        return null;
    }
    
    // Update change counter UI
    updateChangeCounter(count) {
        const $saveButton = $('#saveChanges');
        const $changeCount = $('#changeCount');
        
        if (count > 0) {
            $saveButton.prop('disabled', false);
            $changeCount.text(count + ' change' + (count > 1 ? 's' : '') + ' pending');
            $changeCount.addClass('changes-pending');
        } else {
            $saveButton.prop('disabled', true);
            $changeCount.text('No changes pending');
            $changeCount.removeClass('changes-pending');
        }
    }
}

// Make available globally
window.PriceTableEdit = PriceTableEdit;