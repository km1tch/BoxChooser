/**
 * BoxTable Component
 * Shared component for rendering box tables across admin pages
 */
class BoxTable {
  /**
   * Render a vendor box table with DataTable support
   * @param {Array} boxes - Array of box objects
   * @param {string} containerId - ID of container element
   * @param {Object} options - Configuration options
   * @returns {DataTable} - DataTable instance
   */
  static renderVendorBoxTable(boxes, containerId, options = {}) {
    const defaults = {
      showCategory: true,
      showAlternateDepths: true,
      showVolume: true,
      showActions: false,
      pageLength: 50,
      tableId: 'vendor-boxes-table',
      wrapperClass: 'stores-table'
    };
    const config = { ...defaults, ...options };

    // Generate and insert table HTML
    const tableHtml = this.generateTableHtml(boxes, config);
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id '${containerId}' not found`);
      return null;
    }
    
    container.innerHTML = tableHtml;

    // Initialize DataTable with shared config
    return $(`#${config.tableId}`).DataTable({
      pageLength: config.pageLength,
      order: [[0, 'asc']], // Sort by model
      language: { 
        search: "Search boxes:",
        lengthMenu: "Show _MENU_ boxes",
        info: "Showing _START_ to _END_ of _TOTAL_ boxes"
      },
      destroy: true // Allow re-initialization
    });
  }

  /**
   * Generate HTML for box table
   * @private
   */
  static generateTableHtml(boxes, config) {
    if (!boxes || boxes.length === 0) {
      return '<p style="text-align: center; color: #999;">No boxes found.</p>';
    }

    const headers = this.generateHeaders(config);
    const rows = boxes.map(box => this.generateRow(box, config)).join('');

    return `
      <div class="${config.wrapperClass}">
        <table id="${config.tableId}" class="display">
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate table headers based on config
   * @private
   */
  static generateHeaders(config) {
    let headers = '<th>Model</th><th>Dimensions (L×W×D)</th>';
    
    if (config.showAlternateDepths) {
      headers += '<th>Alternate Depths</th>';
    }
    
    if (config.showCategory) {
      headers += '<th>Category</th>';
    }
    
    if (config.showVolume) {
      headers += '<th>Volume (cu in)</th>';
    }
    
    if (config.showActions) {
      headers += '<th>Actions</th>';
    }
    
    return headers;
  }

  /**
   * Generate a single table row
   * @private
   */
  static generateRow(box, config) {
    const [l, w, d] = box.dimensions || [0, 0, 0];
    const volume = Math.round(l * w * d);
    
    let row = `
      <tr>
        <td>${this.escapeHtml(box.model)}</td>
        <td class="dimension-cell">${l} × ${w} × ${d}</td>
    `;
    
    if (config.showAlternateDepths) {
      const depths = box.alternate_depths || box.prescored_heights || [];
      row += `<td class="alternate-depths">${depths.length > 0 ? depths.join(', ') : '-'}</td>`;
    }
    
    if (config.showCategory) {
      row += `<td>${this.renderCategory(box.category)}</td>`;
    }
    
    if (config.showVolume) {
      row += `<td data-order="${volume}">${volume.toLocaleString()}</td>`;
    }
    
    if (config.showActions) {
      row += `<td>${config.renderActions ? config.renderActions(box) : ''}</td>`;
    }
    
    row += '</tr>';
    return row;
  }

  /**
   * Render category with styling
   * @private
   */
  static renderCategory(category) {
    if (!category) return '-';
    
    const categoryClass = `category-${category.toLowerCase()}`;
    return `<span class="category-badge ${categoryClass}">${category}</span>`;
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Render a simple box list (no DataTable)
   */
  static renderSimpleBoxList(boxes, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!boxes || boxes.length === 0) {
      container.innerHTML = '<p>No boxes available.</p>';
      return;
    }

    const html = boxes.map(box => {
      const [l, w, d] = box.dimensions || [0, 0, 0];
      return `
        <div class="box-item">
          <strong>${this.escapeHtml(box.model)}</strong>
          <span class="dimensions">${l} × ${w} × ${d}</span>
          ${box.category ? `<span class="category">${box.category}</span>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="box-list">${html}</div>`;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.BoxTable = BoxTable;
}