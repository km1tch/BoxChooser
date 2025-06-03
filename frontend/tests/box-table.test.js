import { describe, it, expect, beforeEach } from 'vitest';

// Mock BoxTable class (in real setup this would be imported)
class BoxTable {
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

    // In tests, we can't initialize DataTable, so just return a mock
    return { mockDataTable: true };
  }

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

  static renderCategory(category) {
    if (!category) return '-';
    
    const categoryClass = `category-${category.toLowerCase()}`;
    return `<span class="category-badge ${categoryClass}">${category}</span>`;
  }

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

describe('BoxTable Component', () => {
  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = '<div id="test-container"></div>';
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(BoxTable.escapeHtml('Box & Co.')).toBe('Box &amp; Co.');
      expect(BoxTable.escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(BoxTable.escapeHtml("O'Brien's Box")).toBe('O&#039;Brien&#039;s Box');
    });

    it('should handle non-string inputs', () => {
      expect(BoxTable.escapeHtml(123)).toBe('123');
      expect(BoxTable.escapeHtml(null)).toBe('null');
      expect(BoxTable.escapeHtml(undefined)).toBe('undefined');
    });

    it('should handle empty strings', () => {
      expect(BoxTable.escapeHtml('')).toBe('');
    });
  });

  describe('renderCategory', () => {
    it('should render category with proper class', () => {
      expect(BoxTable.renderCategory('cube')).toBe('<span class="category-badge category-cube">cube</span>');
      expect(BoxTable.renderCategory('LARGE')).toBe('<span class="category-badge category-large">LARGE</span>');
    });

    it('should handle missing category', () => {
      expect(BoxTable.renderCategory(null)).toBe('-');
      expect(BoxTable.renderCategory(undefined)).toBe('-');
      expect(BoxTable.renderCategory('')).toBe('-');
    });

    it('should handle special characters in category', () => {
      expect(BoxTable.renderCategory('special-item')).toBe('<span class="category-badge category-special-item">special-item</span>');
    });
  });

  describe('generateHeaders', () => {
    it('should generate default headers', () => {
      const config = {
        showCategory: true,
        showAlternateDepths: true,
        showVolume: true,
        showActions: false
      };
      
      const headers = BoxTable.generateHeaders(config);
      expect(headers).toContain('<th>Model</th>');
      expect(headers).toContain('<th>Dimensions (L×W×D)</th>');
      expect(headers).toContain('<th>Alternate Depths</th>');
      expect(headers).toContain('<th>Category</th>');
      expect(headers).toContain('<th>Volume (cu in)</th>');
      expect(headers).not.toContain('<th>Actions</th>');
    });

    it('should generate minimal headers', () => {
      const config = {
        showCategory: false,
        showAlternateDepths: false,
        showVolume: false,
        showActions: false
      };
      
      const headers = BoxTable.generateHeaders(config);
      expect(headers).toBe('<th>Model</th><th>Dimensions (L×W×D)</th>');
    });

    it('should include actions when requested', () => {
      const config = { showActions: true };
      const headers = BoxTable.generateHeaders(config);
      expect(headers).toContain('<th>Actions</th>');
    });
  });

  describe('generateRow', () => {
    const testBox = {
      model: 'TEST-123',
      dimensions: [12, 9, 6],
      alternate_depths: [4, 3],
      category: 'medium'
    };

    it('should generate complete row with all features', () => {
      const config = {
        showCategory: true,
        showAlternateDepths: true,
        showVolume: true,
        showActions: false
      };
      
      const row = BoxTable.generateRow(testBox, config);
      
      expect(row).toContain('<td>TEST-123</td>');
      expect(row).toContain('<td class="dimension-cell">12 × 9 × 6</td>');
      expect(row).toContain('<td class="alternate-depths">4, 3</td>');
      expect(row).toContain('category-medium');
      expect(row).toContain('<td data-order="648">648</td>'); // 12*9*6
    });

    it('should handle prescored_heights as alternate name', () => {
      const box = {
        model: 'BOX',
        dimensions: [10, 10, 10],
        prescored_heights: [8, 6] // Alternative field name
      };
      
      const config = { showAlternateDepths: true };
      const row = BoxTable.generateRow(box, config);
      
      expect(row).toContain('<td class="alternate-depths">8, 6</td>');
    });

    it('should handle missing alternate depths', () => {
      const box = {
        model: 'BOX',
        dimensions: [10, 10, 10]
      };
      
      const config = { showAlternateDepths: true };
      const row = BoxTable.generateRow(box, config);
      
      expect(row).toContain('<td class="alternate-depths">-</td>');
    });

    it('should calculate volume correctly', () => {
      const boxes = [
        { dimensions: [10, 10, 10], expected: 1000 },
        { dimensions: [24, 18, 6], expected: 2592 },
        { dimensions: [5.5, 4.5, 3.5], expected: 87 } // Rounds to nearest
      ];
      
      const config = { showVolume: true };
      
      boxes.forEach(({ dimensions, expected }) => {
        const box = { model: 'TEST', dimensions };
        const row = BoxTable.generateRow(box, config);
        expect(row).toContain(`<td data-order="${expected}">${expected.toLocaleString()}</td>`);
      });
    });

    it('should handle custom renderActions', () => {
      const box = { model: 'TEST', dimensions: [1, 1, 1] };
      const config = {
        showActions: true,
        renderActions: (b) => `<button data-model="${b.model}">Edit</button>`
      };
      
      const row = BoxTable.generateRow(box, config);
      expect(row).toContain('<button data-model="TEST">Edit</button>');
    });

    it('should handle missing dimensions gracefully', () => {
      const box = { model: 'BROKEN' };
      const config = { showVolume: true };
      
      const row = BoxTable.generateRow(box, config);
      expect(row).toContain('<td class="dimension-cell">0 × 0 × 0</td>');
      expect(row).toContain('<td data-order="0">0</td>');
    });

    it('should escape HTML in model names', () => {
      const box = {
        model: '<script>alert("xss")</script>',
        dimensions: [1, 1, 1]
      };
      
      const row = BoxTable.generateRow(box, {});
      expect(row).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(row).not.toContain('<script>');
    });
  });

  describe('generateTableHtml', () => {
    it('should generate complete table HTML', () => {
      const boxes = [
        { model: 'BOX-A', dimensions: [10, 10, 10], category: 'cube' },
        { model: 'BOX-B', dimensions: [20, 15, 10], category: 'medium' }
      ];
      
      const config = {
        tableId: 'test-table',
        wrapperClass: 'test-wrapper',
        showCategory: true,
        showVolume: true
      };
      
      const html = BoxTable.generateTableHtml(boxes, config);
      
      expect(html).toContain('class="test-wrapper"');
      expect(html).toContain('id="test-table"');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('BOX-A');
      expect(html).toContain('BOX-B');
    });

    it('should handle empty box list', () => {
      const html = BoxTable.generateTableHtml([], {});
      expect(html).toBe('<p style="text-align: center; color: #999;">No boxes found.</p>');
    });

    it('should handle null/undefined box list', () => {
      expect(BoxTable.generateTableHtml(null, {})).toBe('<p style="text-align: center; color: #999;">No boxes found.</p>');
      expect(BoxTable.generateTableHtml(undefined, {})).toBe('<p style="text-align: center; color: #999;">No boxes found.</p>');
    });
  });

  describe('renderSimpleBoxList', () => {
    it('should render simple box list', () => {
      const boxes = [
        { model: 'SIMPLE-A', dimensions: [10, 8, 6], category: 'small' },
        { model: 'SIMPLE-B', dimensions: [20, 16, 12] }
      ];
      
      BoxTable.renderSimpleBoxList(boxes, 'test-container');
      
      const container = document.getElementById('test-container');
      expect(container.innerHTML).toContain('class="box-list"');
      expect(container.innerHTML).toContain('SIMPLE-A');
      expect(container.innerHTML).toContain('10 × 8 × 6');
      expect(container.innerHTML).toContain('<span class="category">small</span>');
      expect(container.innerHTML).toContain('SIMPLE-B');
      expect(container.innerHTML).not.toContain('undefined'); // No category for B
    });

    it('should handle empty box list', () => {
      BoxTable.renderSimpleBoxList([], 'test-container');
      
      const container = document.getElementById('test-container');
      expect(container.innerHTML).toBe('<p>No boxes available.</p>');
    });

    it('should handle missing container gracefully', () => {
      // Should not throw
      expect(() => {
        BoxTable.renderSimpleBoxList([{ model: 'TEST' }], 'non-existent');
      }).not.toThrow();
    });

    it('should escape HTML in simple list', () => {
      const boxes = [{ 
        model: 'Box & <script>', 
        dimensions: [1, 1, 1] 
      }];
      
      BoxTable.renderSimpleBoxList(boxes, 'test-container');
      
      const container = document.getElementById('test-container');
      expect(container.innerHTML).toContain('Box &amp; &lt;script&gt;');
      expect(container.innerHTML).not.toContain('<script>');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle vendor box data format', () => {
      const vendorBoxes = [
        {
          model: '10C-UPS',
          dimensions: [10, 10, 10],
          alternate_depths: [7.5, 5.0],
          category: 'cube'
        },
        {
          model: 'CHAIR',
          dimensions: [30, 29, 34],
          alternate_depths: [30, 26],
          category: 'specialty'
        }
      ];
      
      const config = {
        showCategory: true,
        showAlternateDepths: true,
        showVolume: true
      };
      
      const html = BoxTable.generateTableHtml(vendorBoxes, config);
      
      // Check first box
      expect(html).toContain('10C-UPS');
      expect(html).toContain('10 × 10 × 10');
      expect(html).toContain('7.5, 5');
      expect(html).toContain('category-cube');
      
      // Check second box
      expect(html).toContain('CHAIR');
      expect(html).toContain('30 × 29 × 34');
      expect(html).toContain('30, 26');
      expect(html).toContain('category-specialty');
    });

    it('should handle mixed data quality', () => {
      const mixedBoxes = [
        { model: 'GOOD', dimensions: [10, 10, 10], category: 'cube' },
        { model: 'NO-DIMS' }, // Missing dimensions
        { dimensions: [5, 5, 5] }, // Missing model
        { model: 'PARTIAL', dimensions: [8, 8] }, // Incomplete dimensions
      ];
      
      const html = BoxTable.generateTableHtml(mixedBoxes, { showVolume: true });
      
      // Should handle all cases without throwing
      expect(html).toContain('GOOD');
      expect(html).toContain('NO-DIMS');
      expect(html).toContain('0 × 0 × 0'); // Missing/incomplete dimensions
    });
  });
});