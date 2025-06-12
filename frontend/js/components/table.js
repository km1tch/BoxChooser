/**
 * Table component for displaying data in a structured format
 * 
 * Provides functionality for sorting, filtering, and editing table data
 */

/**
 * Creates a sortable, filterable data table
 * @param {Object} config - Table configuration
 * @param {string} config.containerId - ID of the container element
 * @param {Array} config.data - Array of data objects
 * @param {Array} config.columns - Column definitions
 * @param {Object} config.options - Additional options
 * @returns {Object} - Table controller
 */
function createDataTable(config) {
  const { containerId, data = [], columns = [], options = {} } = config;
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container #${containerId} not found`);
    return null;
  }
  
  // Default options
  const defaultOptions = {
    sortable: true,
    filterable: true,
    pagination: true,
    rowsPerPage: 20,
    rowClassName: row => '', // Function to add class to rows
    onRowClick: null, // Row click handler
    onCellEdit: null, // Cell edit handler
  };
  
  const tableOptions = { ...defaultOptions, ...options };
  
  // Create table elements
  const table = document.createElement('table');
  table.className = 'data-table';
  
  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column.title || column.field || '';
    
    if (column.width) {
      th.style.width = typeof column.width === 'number' ? `${column.width}px` : column.width;
    }
    
    if (column.className) {
      th.className = column.className;
    }
    
    if (tableOptions.sortable && column.sortable !== false) {
      th.classList.add('sortable');
      th.addEventListener('click', () => sortTable(column.field));
    }
    
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  
  // Add to container
  container.innerHTML = '';
  
  // Add filter row if filterable
  if (tableOptions.filterable) {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'table-filters';
    
    // Global search
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.addEventListener('input', e => {
      filterTable(e.target.value);
    });
    
    searchContainer.appendChild(searchInput);
    filterContainer.appendChild(searchContainer);
    
    // Column filters
    columns.forEach(column => {
      if (column.filterable) {
        const filterSelect = document.createElement('select');
        filterSelect.className = 'column-filter';
        filterSelect.dataset.field = column.field;
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = `All ${column.title || column.field}`;
        filterSelect.appendChild(defaultOption);
        
        // Get unique values for this column
        const uniqueValues = [...new Set(data.map(item => item[column.field]))].filter(Boolean);
        uniqueValues.sort().forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          filterSelect.appendChild(option);
        });
        
        filterSelect.addEventListener('change', e => {
          filterTableByColumn(column.field, e.target.value);
        });
        
        filterContainer.appendChild(filterSelect);
      }
    });
    
    container.appendChild(filterContainer);
  }
  
  container.appendChild(table);
  
  // Add pagination if enabled
  if (tableOptions.pagination) {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'table-pagination';
    container.appendChild(paginationContainer);
  }
  
  // Current state
  const state = {
    data: [...data],
    filteredData: [...data],
    displayedData: [...data],
    sortField: null,
    sortDirection: 'asc',
    currentPage: 1,
    filters: {},
    globalFilter: ''
  };
  
  // Methods
  
  // Sort table by column
  function sortTable(field) {
    if (state.sortField === field) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortField = field;
      state.sortDirection = 'asc';
    }
    
    state.filteredData.sort((a, b) => {
      const valueA = a[field];
      const valueB = b[field];
      
      if (valueA === valueB) return 0;
      
      let comparison;
      if (valueA === null || valueA === undefined) {
        comparison = -1;
      } else if (valueB === null || valueB === undefined) {
        comparison = 1;
      } else if (typeof valueA === 'string') {
        comparison = valueA.localeCompare(valueB);
      } else {
        comparison = valueA < valueB ? -1 : 1;
      }
      
      return state.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    renderTable();
    
    // Update sort indicators
    const headers = thead.querySelectorAll('th');
    headers.forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const activeHeader = Array.from(headers).find(th => {
      const colField = columns[Array.from(headers).indexOf(th)].field;
      return colField === field;
    });
    
    if (activeHeader) {
      activeHeader.classList.add(`sort-${state.sortDirection}`);
    }
  }
  
  // Filter table by global search
  function filterTable(query) {
    state.globalFilter = query.toLowerCase();
    applyFilters();
  }
  
  // Filter table by column
  function filterTableByColumn(field, value) {
    if (value) {
      state.filters[field] = value;
    } else {
      delete state.filters[field];
    }
    
    applyFilters();
  }
  
  // Apply all filters
  function applyFilters() {
    // Start with all data
    let filtered = [...state.data];
    
    // Apply column filters
    Object.keys(state.filters).forEach(field => {
      const value = state.filters[field];
      filtered = filtered.filter(row => {
        const rowValue = String(row[field] || '');
        return rowValue === value;
      });
    });
    
    // Apply global filter
    if (state.globalFilter) {
      filtered = filtered.filter(row => {
        return columns.some(column => {
          const value = row[column.field];
          return value !== null && 
                 value !== undefined && 
                 String(value).toLowerCase().includes(state.globalFilter);
        });
      });
    }
    
    state.filteredData = filtered;
    state.currentPage = 1;  // Reset to first page
    
    if (state.sortField) {
      sortTable(state.sortField);  // Re-sort with new filtered data
    } else {
      renderTable();
    }
  }
  
  // Render table based on current state
  function renderTable() {
    tbody.innerHTML = '';
    
    // Calculate pagination
    const totalRows = state.filteredData.length;
    let displayData;
    
    if (tableOptions.pagination) {
      const startIndex = (state.currentPage - 1) * tableOptions.rowsPerPage;
      const endIndex = startIndex + tableOptions.rowsPerPage;
      displayData = state.filteredData.slice(startIndex, endIndex);
      state.displayedData = displayData;
      
      renderPagination(totalRows);
    } else {
      displayData = state.filteredData;
      state.displayedData = displayData;
    }
    
    // Render rows
    displayData.forEach((rowData, rowIndex) => {
      const tr = document.createElement('tr');
      
      // Add custom class if provided
      const customClass = tableOptions.rowClassName(rowData, rowIndex);
      if (customClass) {
        tr.className = customClass;
      }
      
      // Add data-id attribute if the row has an id
      if (rowData.id) {
        tr.dataset.id = rowData.id;
      }
      
      // Add click handler if provided
      if (tableOptions.onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
          // Only trigger if the click wasn't on an interactive element
          if (!e.target.matches('button, input, select, a')) {
            tableOptions.onRowClick(rowData, rowIndex, e);
          }
        });
      }
      
      // Create cells
      columns.forEach((column, colIndex) => {
        const td = document.createElement('td');
        
        // Add class if specified
        if (column.cellClassName) {
          td.className = typeof column.cellClassName === 'function' 
            ? column.cellClassName(rowData) 
            : column.cellClassName;
        }
        
        // Set cell content
        if (column.render) {
          // Custom render function
          const rendered = column.render(rowData[column.field], rowData, rowIndex);
          if (typeof rendered === 'string') {
            td.innerHTML = rendered;
          } else if (rendered instanceof Node) {
            td.appendChild(rendered);
          }
        } else {
          // Default rendering
          td.textContent = rowData[column.field] !== undefined 
            ? rowData[column.field] 
            : '';
        }
        
        // Make cell editable if requested
        if (column.editable && tableOptions.onCellEdit) {
          td.classList.add('editable');
          td.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click
            
            // Already in edit mode?
            if (td.querySelector('input, select, textarea')) {
              return;
            }
            
            const currentValue = rowData[column.field];
            const originalContent = td.innerHTML;
            
            // Create edit input
            const input = document.createElement(column.editComponent || 'input');
            input.type = column.editType || 'text';
            
            if (input.tagName === 'SELECT' && column.editOptions) {
              column.editOptions.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.label;
                if (option.value === currentValue) {
                  opt.selected = true;
                }
                input.appendChild(opt);
              });
            } else {
              input.value = currentValue !== undefined ? currentValue : '';
            }
            
            // Style the input
            input.style.width = '100%';
            input.style.boxSizing = 'border-box';
            input.style.padding = '4px';
            
            // Clear and add input
            td.innerHTML = '';
            td.appendChild(input);
            input.focus();
            
            // Handle completion
            function completeEdit(save) {
              if (save) {
                const newValue = input.value;
                if (newValue !== currentValue) {
                  tableOptions.onCellEdit(rowData, column.field, newValue, rowIndex, colIndex);
                }
              } else {
                td.innerHTML = originalContent;
              }
            }
            
            // Setup event handlers
            input.addEventListener('blur', () => {
              completeEdit(true);
            });
            
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                completeEdit(true);
              } else if (e.key === 'Escape') {
                completeEdit(false);
              }
            });
          });
        }
        
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
    
    // Show message if no data
    if (displayData.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.textContent = 'No data available';
      td.style.textAlign = 'center';
      td.style.padding = '20px';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }
  
  // Render pagination controls
  function renderPagination(totalRows) {
    const paginationContainer = container.querySelector('.table-pagination');
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    
    const totalPages = Math.ceil(totalRows / tableOptions.rowsPerPage);
    
    if (totalPages <= 1) {
      return;
    }
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '←';
    prevButton.disabled = state.currentPage === 1;
    prevButton.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    });
    paginationContainer.appendChild(prevButton);
    
    // Page buttons
    const maxPageButtons = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    
    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement('button');
      pageButton.textContent = i;
      pageButton.className = i === state.currentPage ? 'active' : '';
      pageButton.addEventListener('click', () => {
        state.currentPage = i;
        renderTable();
      });
      paginationContainer.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = '→';
    nextButton.disabled = state.currentPage === totalPages;
    nextButton.addEventListener('click', () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderTable();
      }
    });
    paginationContainer.appendChild(nextButton);
    
    // Page size selector
    const pageSizeContainer = document.createElement('div');
    pageSizeContainer.className = 'page-size-container';
    
    const pageSizeLabel = document.createElement('span');
    pageSizeLabel.textContent = 'Rows per page: ';
    
    const pageSizeSelect = document.createElement('select');
    [10, 20, 50, 100].forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      option.selected = tableOptions.rowsPerPage === size;
      pageSizeSelect.appendChild(option);
    });
    
    pageSizeSelect.addEventListener('change', () => {
      tableOptions.rowsPerPage = parseInt(pageSizeSelect.value, 10);
      state.currentPage = 1;
      renderTable();
    });
    
    pageSizeContainer.appendChild(pageSizeLabel);
    pageSizeContainer.appendChild(pageSizeSelect);
    paginationContainer.appendChild(pageSizeContainer);
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    const startItem = (state.currentPage - 1) * tableOptions.rowsPerPage + 1;
    const endItem = Math.min(startItem + tableOptions.rowsPerPage - 1, totalRows);
    pageInfo.textContent = `${startItem}-${endItem} of ${totalRows}`;
    paginationContainer.appendChild(pageInfo);
  }
  
  // Add CSS
  const styleExists = document.getElementById('data-table-style');
  if (!styleExists) {
    const style = document.createElement('style');
    style.id = 'data-table-style';
    style.textContent = `
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      
      .data-table th, .data-table td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }
      
      .data-table thead th {
        background-color: #f8f9fa;
        font-weight: bold;
        border-bottom: 2px solid #dee2e6;
      }
      
      .data-table th.sortable {
        cursor: pointer;
        position: relative;
      }
      
      .data-table th.sortable:after {
        content: '↕';
        position: absolute;
        right: 8px;
        opacity: 0.3;
      }
      
      .data-table th.sort-asc:after {
        content: '↑';
        opacity: 1;
      }
      
      .data-table th.sort-desc:after {
        content: '↓';
        opacity: 1;
      }
      
      .data-table tbody tr:hover {
        background-color: rgba(0, 0, 0, 0.03);
      }
      
      .data-table .editable {
        cursor: pointer;
        position: relative;
      }
      
      .data-table .editable:hover:before {
        content: '✎';
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.5;
        font-size: 12px;
      }
      
      .table-filters {
        margin-bottom: 15px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      
      .table-filters input, .table-filters select {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .search-container {
        flex: 1;
        min-width: 200px;
      }
      
      .search-container input {
        width: 100%;
      }
      
      .column-filter {
        min-width: 150px;
      }
      
      .table-pagination {
        margin-top: 15px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 5px;
      }
      
      .table-pagination button {
        border: 1px solid #ddd;
        background: white;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .table-pagination button.active {
        background-color: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      .table-pagination button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      
      .page-size-container {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .page-info {
        margin-left: 15px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Initialize table
  renderTable();
  
  // Return controller
  return {
    // Get current state
    getState: () => ({ ...state }),
    
    // Refresh data
    setData: (newData) => {
      state.data = [...newData];
      applyFilters();
    },
    
    // Sort by field
    sort: sortTable,
    
    // Apply filter
    filter: filterTable,
    
    // Filter by column
    filterByColumn: filterTableByColumn,
    
    // Go to page
    goToPage: (page) => {
      if (page >= 1 && page <= Math.ceil(state.filteredData.length / tableOptions.rowsPerPage)) {
        state.currentPage = page;
        renderTable();
      }
    },
    
    // Refresh rendering
    refresh: renderTable,
    
    // Get displayed data
    getDisplayedData: () => [...state.displayedData],
    
    // Get filtered data
    getFilteredData: () => [...state.filteredData],
    
    // Clear all filters
    clearFilters: () => {
      state.filters = {};
      state.globalFilter = '';
      
      // Reset filter inputs
      const filterInputs = container.querySelectorAll('.table-filters input, .table-filters select');
      filterInputs.forEach(input => {
        if (input.tagName === 'SELECT') {
          input.selectedIndex = 0;
        } else {
          input.value = '';
        }
      });
      
      applyFilters();
    }
  };
}

// Export function for module usage
if (typeof window !== 'undefined') {
  window.createDataTable = createDataTable;
}

export { createDataTable };