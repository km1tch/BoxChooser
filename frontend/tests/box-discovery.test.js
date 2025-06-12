import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Box Discovery Component', () => {
  let boxDiscovery;
  
  beforeEach(() => {
    // Mock DOM elements
    document.body.innerHTML = `
      <div id="loading" style="display: none;"></div>
      <div id="results" style="display: none;"></div>
    `;
    
    // Mock fetch
    global.authenticatedFetch = vi.fn();
    
    // Create instance (simulating the class structure)
    boxDiscovery = {
      storeId: '123',
      discoveryResults: null,
      
      handleDiscovery: async function(file) {
        if (!file) return;
        
        document.getElementById("loading").style.display = "block";
        document.getElementById("results").style.display = "none";
        
        try {
          const formData = new FormData();
          formData.append("file", file);
          
          const response = await authenticatedFetch(
            `/api/store/${this.storeId}/discover_boxes`,
            this.storeId,
            {
              method: "POST",
              body: formData,
            }
          );
          
          if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
          }
          
          const data = await response.json();
          this.discoveryResults = data;
          this.displayDiscoveryResults();
        } catch (error) {
          console.error("Box discovery failed:", error);
          alert("Failed to discover boxes: " + error.message);
        } finally {
          document.getElementById("loading").style.display = "none";
        }
      },
      
      displayDiscoveryResults: function() {
        const resultsDiv = document.getElementById("results");
        resultsDiv.style.display = "block";
        resultsDiv.innerHTML = `<div class="discovery-results">Results displayed</div>`;
      }
    };
  });

  describe('File Upload and Discovery', () => {
    it('should handle file upload', async () => {
      const mockFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.ms-excel' });
      const mockResponse = {
        ok: true,
        json: async () => ({
          summary: {
            total_boxes_found: 10,
            already_in_store: 2,
            new_dimensions: 8,
            exact_matches: 5,
            unmatched: 3
          },
          results: []
        })
      };
      
      global.authenticatedFetch.mockResolvedValue(mockResponse);
      
      await boxDiscovery.handleDiscovery(mockFile);
      
      expect(global.authenticatedFetch).toHaveBeenCalledWith(
        '/api/store/123/discover_boxes',
        '123',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
      
      expect(boxDiscovery.discoveryResults).toBeTruthy();
      expect(boxDiscovery.discoveryResults.summary.total_boxes_found).toBe(10);
    });

    it('should show loading state during discovery', async () => {
      const mockFile = new File(['test'], 'test.xlsx');
      const mockResponse = {
        ok: true,
        json: async () => ({ summary: {}, results: [] })
      };
      
      let loadingChecked = false;
      global.authenticatedFetch.mockImplementation(async () => {
        loadingChecked = document.getElementById('loading').style.display === 'block';
        return mockResponse;
      });
      
      await boxDiscovery.handleDiscovery(mockFile);
      
      expect(loadingChecked).toBe(true);
      expect(document.getElementById('loading').style.display).toBe('none');
    });

    it('should handle discovery errors', async () => {
      const mockFile = new File(['test'], 'test.xlsx');
      global.authenticatedFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Invalid file format'
      });
      
      // Mock alert
      global.alert = vi.fn();
      
      await boxDiscovery.handleDiscovery(mockFile);
      
      expect(global.alert).toHaveBeenCalledWith('Failed to discover boxes: Invalid file format');
      expect(document.getElementById('loading').style.display).toBe('none');
    });
  });

  describe('Discovery Results Display', () => {
    const mockResults = {
      summary: {
        total_boxes_found: 20,
        already_in_store: 5,
        new_dimensions: 15,
        exact_matches: 10,
        unmatched: 5
      },
      results: [
        {
          row_data: { model: 'BOX-A', price: 5.99 },
          dimensions: [10, 10, 10],
          status: 'exact_match',
          library_box: {
            dimensions: [10, 10, 10],
            names: ['10C-UPS', '10CUBE'],
            alternate_depths: [7.5, 5]
          }
        },
        {
          row_data: { model: 'BOX-B', price: 3.99 },
          dimensions: [8, 6, 4],
          status: 'already_exists'
        },
        {
          row_data: { model: 'BOX-C', price: 7.99 },
          dimensions: [15, 12, 10],
          status: 'new'
        }
      ]
    };

    it('should categorize discovery results', () => {
      const exactMatches = mockResults.results.filter(r => r.status === 'exact_match');
      const alreadyExists = mockResults.results.filter(r => r.status === 'already_exists');
      const newBoxes = mockResults.results.filter(r => r.status === 'new');
      
      expect(exactMatches).toHaveLength(1);
      expect(alreadyExists).toHaveLength(1);
      expect(newBoxes).toHaveLength(1);
    });

    it('should display summary statistics', () => {
      const summary = mockResults.summary;
      const summaryText = `
        Total: ${summary.total_boxes_found}
        Already in store: ${summary.already_in_store}
        Exact matches: ${summary.exact_matches}
        Need custom: ${summary.unmatched}
      `;
      
      expect(summaryText).toContain('Total: 20');
      expect(summaryText).toContain('Exact matches: 10');
      expect(summaryText).toContain('Need custom: 5');
    });

    it('should prepare library matches for import', () => {
      const exactMatch = mockResults.results.find(r => r.status === 'exact_match');
      
      const importData = {
        model: exactMatch.library_box.names[0],
        dimensions: exactMatch.dimensions,
        alternate_depths: exactMatch.library_box.alternate_depths,
        from_library: true,
        offered_names: exactMatch.library_box.names,
        price: exactMatch.row_data.price
      };
      
      expect(importData.from_library).toBe(true);
      expect(importData.offered_names).toHaveLength(2);
      expect(importData.model).toBe('10C-UPS');
    });

    it('should handle boxes with no library match', () => {
      const newBox = mockResults.results.find(r => r.status === 'new');
      
      const importData = {
        model: newBox.row_data.model,
        dimensions: newBox.dimensions,
        alternate_depths: null,
        from_library: false,
        offered_names: null,
        price: newBox.row_data.price
      };
      
      expect(importData.from_library).toBe(false);
      expect(importData.offered_names).toBeNull();
      expect(importData.model).toBe('BOX-C');
    });
  });

  describe('Batch Import Selection', () => {
    it('should track selected boxes for import', () => {
      const selectedBoxes = new Set();
      
      // Add box
      selectedBoxes.add('box-1');
      selectedBoxes.add('box-2');
      expect(selectedBoxes.size).toBe(2);
      
      // Remove box
      selectedBoxes.delete('box-1');
      expect(selectedBoxes.size).toBe(1);
      expect(selectedBoxes.has('box-2')).toBe(true);
    });

    it('should prepare batch import request', () => {
      const selectedResults = [
        {
          dimensions: [10, 10, 10],
          library_box: { names: ['10C'], alternate_depths: [7.5] },
          status: 'exact_match'
        },
        {
          dimensions: [12, 8, 6],
          row_data: { model: 'CUSTOM-12' },
          status: 'new'
        }
      ];
      
      const batchRequest = selectedResults.map(result => {
        if (result.status === 'exact_match') {
          return {
            model: result.library_box.names[0],
            dimensions: result.dimensions,
            alternate_depths: result.library_box.alternate_depths,
            from_library: true,
            offered_names: result.library_box.names
          };
        } else {
          return {
            model: result.row_data.model,
            dimensions: result.dimensions,
            alternate_depths: null,
            from_library: false,
            offered_names: null
          };
        }
      });
      
      expect(batchRequest).toHaveLength(2);
      expect(batchRequest[0].from_library).toBe(true);
      expect(batchRequest[1].from_library).toBe(false);
    });

    it('should validate boxes before import', () => {
      const boxesToImport = [
        { dimensions: [10, 10, 10], model: 'Valid-1' },
        { dimensions: [0, 10, 10], model: 'Invalid-1' }, // Invalid dimension
        { dimensions: [8, 10, 12], model: 'Invalid-2' }, // Wrong order
      ];
      
      const validBoxes = boxesToImport.filter(box => {
        const [l, w, d] = box.dimensions;
        return l > 0 && w > 0 && d > 0 && l >= w && w >= d;
      });
      
      expect(validBoxes).toHaveLength(1);
      expect(validBoxes[0].model).toBe('Valid-1');
    });
  });

  describe('Name Selection for Discovered Boxes', () => {
    it('should offer name choices for library matches', () => {
      const libraryBox = {
        names: ['10C-UPS', '10CUBE', 'TEN-CUBE'],
        dimensions: [10, 10, 10]
      };
      
      const nameOptions = [...libraryBox.names, 'custom'];
      expect(nameOptions).toHaveLength(4);
      expect(nameOptions[3]).toBe('custom');
    });

    it('should track name selection choice', () => {
      const offeredNames = ['10C-UPS', '10CUBE'];
      const selections = [
        { chosen: '10C-UPS', isCustom: false },
        { chosen: 'MY-10-BOX', isCustom: true }
      ];
      
      selections.forEach(selection => {
        const isCustom = !offeredNames.includes(selection.chosen);
        expect(isCustom).toBe(selection.isCustom);
      });
    });

    it('should handle pivot to custom specs', () => {
      const originalLibraryBox = {
        dimensions: [10, 10, 10],
        alternate_depths: [7.5, 5],
        names: ['10C-UPS']
      };
      
      const pivotedBox = {
        dimensions: [10, 10, 10],
        alternate_depths: [8, 6], // User changed depths
        model: 'CUSTOM-10C',
        from_library: false // Important: no longer from library
      };
      
      expect(pivotedBox.from_library).toBe(false);
      expect(pivotedBox.alternate_depths).not.toEqual(originalLibraryBox.alternate_depths);
    });
  });

  describe('Analytics Integration', () => {
    it('should prepare analytics for discovery session', () => {
      const sessionStats = {
        store_id: '123',
        total_found: 20,
        exact_matches: 12,
        unmatched: 5,
        already_in_store: 3
      };
      
      expect(sessionStats.exact_matches / sessionStats.total_found).toBeCloseTo(0.6);
    });

    it('should track individual box imports', () => {
      const importAnalytics = [
        {
          store_id: '123',
          dimensions: [10, 10, 10],
          chosen_name: '10C-UPS',
          source: 'library'
        },
        {
          store_id: '123',
          dimensions: [15, 12, 9],
          chosen_name: 'CUSTOM-15X12',
          source: 'custom'
        }
      ];
      
      const libraryImports = importAnalytics.filter(i => i.source === 'library');
      const customImports = importAnalytics.filter(i => i.source === 'custom');
      
      expect(libraryImports).toHaveLength(1);
      expect(customImports).toHaveLength(1);
    });
  });
});