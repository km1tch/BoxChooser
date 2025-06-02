/**
 * DataTable Configuration Utility
 * Centralized configuration for DataTables across the application
 */
const DataTableConfig = {
    /**
     * Preset configurations for different table types
     */
    presets: {
        // Box inventory tables
        boxTable: {
            pageLength: 50,
            order: [[0, 'asc']], // Sort by model name
            language: {
                search: "Search boxes:",
                lengthMenu: "Show _MENU_ boxes per page",
                info: "Showing _START_ to _END_ of _TOTAL_ boxes",
                infoEmpty: "No boxes found",
                infoFiltered: "(filtered from _MAX_ total boxes)",
                paginate: {
                    first: "First",
                    last: "Last",
                    next: "Next",
                    previous: "Previous"
                }
            },
            dom: 'lfrtip', // Default layout
            responsive: true,
            destroy: true // Allow re-initialization
        },

        // Store management tables
        storeTable: {
            pageLength: 25,
            order: [[0, 'asc']], // Sort by store ID
            language: {
                search: "Search stores:",
                lengthMenu: "Show _MENU_ stores per page",
                info: "Showing _START_ to _END_ of _TOTAL_ stores",
                infoEmpty: "No stores found",
                infoFiltered: "(filtered from _MAX_ total stores)"
            },
            responsive: true,
            destroy: true
        },

        // Audit log tables
        auditTable: {
            pageLength: 100,
            order: [[0, 'desc']], // Sort by timestamp (newest first)
            language: {
                search: "Search audit log:",
                lengthMenu: "Show _MENU_ entries per page",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                infoEmpty: "No audit entries found",
                infoFiltered: "(filtered from _MAX_ total entries)"
            },
            destroy: true
        },

        // Vendor box tables
        vendorBoxTable: {
            pageLength: 50,
            order: [[0, 'asc']], // Sort by model
            language: {
                search: "Search vendor boxes:",
                lengthMenu: "Show _MENU_ boxes per page",
                info: "Showing _START_ to _END_ of _TOTAL_ vendor boxes"
            },
            columnDefs: [
                { targets: -1, orderable: false } // Last column (actions) not sortable
            ],
            destroy: true
        },

        // Price editor tables
        priceTable: {
            pageLength: 100,
            order: [[0, 'asc']],
            language: {
                search: "Search boxes:",
                info: "Showing _START_ to _END_ of _TOTAL_ boxes"
            },
            paging: false, // Show all for editing
            destroy: true
        }
    },

    /**
     * Initialize a DataTable with preset configuration
     * @param {string} tableId - Table element ID (without #)
     * @param {string} preset - Name of preset configuration
     * @param {Object} customOptions - Custom options to override preset
     * @returns {DataTable} DataTable instance
     */
    init(tableId, preset = 'boxTable', customOptions = {}) {
        // Get preset config
        const presetConfig = this.presets[preset] || this.presets.boxTable;
        
        // Merge configurations
        const config = this.mergeConfig(presetConfig, customOptions);
        
        // Initialize DataTable
        const table = $(`#${tableId}`).DataTable(config);
        
        // Store reference for cleanup
        this.instances[tableId] = table;
        
        return table;
    },

    /**
     * Initialize multiple tables at once
     * @param {Array} tables - Array of {tableId, preset, options} objects
     * @returns {Object} Map of tableId to DataTable instances
     */
    initMultiple(tables) {
        const instances = {};
        
        tables.forEach(({ tableId, preset, options }) => {
            instances[tableId] = this.init(tableId, preset, options);
        });
        
        return instances;
    },

    /**
     * Destroy a DataTable instance
     * @param {string} tableId - Table element ID
     */
    destroy(tableId) {
        const table = this.instances[tableId];
        if (table) {
            table.destroy();
            delete this.instances[tableId];
        }
    },

    /**
     * Destroy all tracked DataTable instances
     */
    destroyAll() {
        Object.keys(this.instances).forEach(tableId => {
            this.destroy(tableId);
        });
    },

    /**
     * Get a DataTable instance
     * @param {string} tableId - Table element ID
     * @returns {DataTable|null} DataTable instance or null
     */
    getInstance(tableId) {
        return this.instances[tableId] || null;
    },

    /**
     * Merge configurations deeply
     * @private
     */
    mergeConfig(preset, custom) {
        // Deep clone preset to avoid mutations
        const config = JSON.parse(JSON.stringify(preset));
        
        // Merge custom options
        Object.keys(custom).forEach(key => {
            if (typeof custom[key] === 'object' && !Array.isArray(custom[key]) && custom[key] !== null) {
                config[key] = this.mergeConfig(config[key] || {}, custom[key]);
            } else {
                config[key] = custom[key];
            }
        });
        
        return config;
    },

    /**
     * Track DataTable instances for cleanup
     * @private
     */
    instances: {},

    /**
     * Common column definitions
     */
    columnDefs: {
        // Numeric sorting for dimension columns
        dimensions: {
            type: 'num',
            render: function(data) {
                if (Array.isArray(data)) {
                    return data.join(' × ');
                }
                return data;
            }
        },

        // Currency formatting
        currency: {
            type: 'num',
            render: function(data) {
                return '$' + parseFloat(data).toFixed(2);
            }
        },

        // Date formatting
        date: {
            type: 'date',
            render: function(data) {
                if (!data) return '';
                const date = new Date(data);
                return date.toLocaleDateString();
            }
        },

        // Timestamp formatting
        timestamp: {
            type: 'date',
            render: function(data) {
                if (!data) return '';
                const date = new Date(data);
                return date.toLocaleString();
            }
        },

        // Action buttons (not sortable)
        actions: {
            orderable: false,
            searchable: false,
            className: 'text-center'
        }
    },

    /**
     * Helper to create responsive breakpoints
     */
    responsive: {
        // Hide columns on mobile
        mobile: {
            breakpoint: 768,
            columns: {
                // Example: hide these columns on mobile
                hideOnMobile: [3, 4, 5]
            }
        },

        // Tablet breakpoints
        tablet: {
            breakpoint: 1024,
            columns: {
                hideOnTablet: [5]
            }
        }
    },

    /**
     * Export configuration for specific table types
     */
    exportConfig: {
        // Basic export buttons
        basic: {
            dom: 'Bfrtip',
            buttons: ['copy', 'csv', 'excel', 'pdf', 'print']
        },

        // Custom export with formatting
        formatted: {
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excel',
                    text: 'Export to Excel',
                    filename: 'export',
                    exportOptions: {
                        columns: ':visible'
                    }
                },
                {
                    extend: 'pdf',
                    text: 'Export to PDF',
                    filename: 'export',
                    orientation: 'landscape',
                    pageSize: 'A4',
                    exportOptions: {
                        columns: ':visible'
                    }
                }
            ]
        }
    },

    /**
     * Add DataTables dark theme support
     */
    applyDarkTheme() {
        const darkStyles = `
            .dataTables_wrapper {
                color: #ecf0f1;
            }
            
            .dataTables_wrapper .dataTables_length,
            .dataTables_wrapper .dataTables_filter,
            .dataTables_wrapper .dataTables_info,
            .dataTables_wrapper .dataTables_paginate {
                color: #ecf0f1;
            }
            
            .dataTables_wrapper .dataTables_paginate .paginate_button.current,
            .dataTables_wrapper .dataTables_paginate .paginate_button.current:hover {
                background: #3498db;
                border-color: #3498db;
                color: white !important;
            }
            
            .dataTables_wrapper .dataTables_paginate .paginate_button:hover {
                background: #34495e;
                border-color: #34495e;
                color: white !important;
            }
            
            table.dataTable tbody tr {
                background-color: transparent;
            }
            
            table.dataTable tbody tr:hover {
                background-color: rgba(52, 73, 94, 0.5);
            }
        `;

        if (!document.getElementById('datatable-dark-theme')) {
            const style = document.createElement('style');
            style.id = 'datatable-dark-theme';
            style.textContent = darkStyles;
            document.head.appendChild(style);
        }
    }
};

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.DataTableConfig = DataTableConfig;
}