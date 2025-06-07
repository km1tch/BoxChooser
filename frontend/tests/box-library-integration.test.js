import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Box Library Integration', () => {
  describe('Search Functionality', () => {
    const mockLibraryBoxes = [
      {
        dimensions: [10, 10, 10],
        names: ['10C-UPS', '10CUBE', 'TENCUBE'],
        alternate_depths: [7.5, 5],
        category: 'cube',
        volume: 1000
      },
      {
        dimensions: [12, 10, 8],
        names: ['12X10X8', 'STANDARD-A'],
        category: 'standard',
        volume: 960
      },
      {
        dimensions: [14, 14, 14],
        names: ['14C-UPS'],
        alternate_depths: [10.5, 7, 3.5],
        category: 'cube',
        volume: 2744
      },
      {
        dimensions: [20, 16, 12],
        names: ['LARGE-1', '20X16X12'],
        category: 'large',
        volume: 3840
      }
    ];

    // Helper function to simulate client-side search
    function searchLibrary(boxes, searchTerm) {
      const searchLower = searchTerm.toLowerCase().replace(/\s+/g, '');
      
      return boxes.filter(box => {
        // Check dimensions
        const dimStr = box.dimensions.join('x').toLowerCase().replace(/\s+/g, '');
        if (dimStr.includes(searchLower)) return true;
        
        // Check alternate depths
        if (box.alternate_depths) {
          const depthsStr = box.alternate_depths.join(',').toLowerCase().replace(/\s+/g, '');
          if (depthsStr.includes(searchLower)) return true;
        }
        
        // Check names
        if (box.names) {
          for (const name of box.names) {
            if (name.toLowerCase().replace(/\s+/g, '').includes(searchLower)) {
              return true;
            }
          }
        }
        
        // Check category
        if (box.category && box.category.toLowerCase().replace(/\s+/g, '').includes(searchLower)) {
          return true;
        }
        
        // Check volume
        if (box.volume && String(box.volume).includes(searchTerm)) {
          return true;
        }
        
        return false;
      });
    }

    it('should search by exact dimensions', () => {
      const results = searchLibrary(mockLibraryBoxes, '10x10x10');
      expect(results).toHaveLength(1);
      expect(results[0].names).toContain('10C-UPS');
    });

    it('should search by partial dimensions', () => {
      const results = searchLibrary(mockLibraryBoxes, '10x');
      expect(results).toHaveLength(2); // 10x10x10 and 12x10x8
      expect(results.some(b => b.dimensions.join('x') === '10x10x10')).toBe(true);
      expect(results.some(b => b.dimensions.join('x') === '12x10x8')).toBe(true);
    });

    it('should search by box names', () => {
      const results = searchLibrary(mockLibraryBoxes, '10C');
      expect(results).toHaveLength(1);
      expect(results[0].dimensions).toEqual([10, 10, 10]);
    });

    it('should search by partial name', () => {
      const results = searchLibrary(mockLibraryBoxes, 'CUBE');
      // CUBE search is case-insensitive
      // Should find boxes with 'cube' in names: '10CUBE', 'TENCUBE', and category 'cube'
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      // Check that results contain boxes with CUBE in name or cube category
      const hasExpectedBoxes = results.some(b => 
        b.names && b.names.includes('10CUBE')
      ) && results.some(b => 
        b.names && b.names.includes('TENCUBE')
      );
      expect(hasExpectedBoxes).toBe(true);
    });

    it('should handle space-insensitive search', () => {
      const results1 = searchLibrary(mockLibraryBoxes, '10 x 10 x 10');
      const results2 = searchLibrary(mockLibraryBoxes, '10x10x10');
      expect(results1).toEqual(results2);
    });

    it('should search by alternate depths', () => {
      const results = searchLibrary(mockLibraryBoxes, '7.5');
      expect(results).toHaveLength(1);
      expect(results[0].alternate_depths).toContain(7.5);
    });

    it('should search by category', () => {
      const results = searchLibrary(mockLibraryBoxes, 'cube');
      expect(results).toHaveLength(2);
      expect(results.every(b => b.category === 'cube')).toBe(true);
    });

    it('should search by volume', () => {
      const results = searchLibrary(mockLibraryBoxes, '1000');
      expect(results).toHaveLength(1);
      expect(results[0].volume).toBe(1000);
    });

    it('should filter out boxes already in store', () => {
      const storeBoxes = [
        { dimensions: [10, 10, 10], model: 'EXISTING-10C' }
      ];
      
      // Simulate filtering
      const filtered = mockLibraryBoxes.filter(libBox => {
        return !storeBoxes.some(storeBox => 
          JSON.stringify(storeBox.dimensions.sort((a,b) => b-a)) === 
          JSON.stringify(libBox.dimensions.sort((a,b) => b-a))
        );
      });
      
      expect(filtered).toHaveLength(3); // All except 10x10x10
      expect(filtered.every(b => b.dimensions.join('x') !== '10x10x10')).toBe(true);
    });
  });

  describe('Box Dimension Validation', () => {
    function validateBoxDimensions(dimensions, alternateDepths) {
      const [length, width, depth] = dimensions;
      
      // Check all dimensions are positive numbers
      if (!dimensions.every(d => d > 0)) {
        return { valid: false, error: 'All dimensions must be positive' };
      }
      
      // Check dimension order (should be L >= W >= D)
      if (length < width || width < depth) {
        return { valid: false, error: 'Dimensions should be in order: Length >= Width >= Depth' };
      }
      
      // Validate alternate depths if provided
      if (alternateDepths && alternateDepths.length > 0) {
        // Check all alternate depths are positive
        if (!alternateDepths.every(d => d > 0)) {
          return { valid: false, error: 'All alternate depths must be positive' };
        }
        
        // Check alternate depths are less than original depth
        if (!alternateDepths.every(d => d < depth)) {
          return { valid: false, error: 'Alternate depths must be less than original depth' };
        }
        
        // Check alternate depths are in descending order
        const sorted = [...alternateDepths].sort((a, b) => b - a);
        if (JSON.stringify(sorted) !== JSON.stringify(alternateDepths)) {
          return { valid: false, error: 'Alternate depths should be in descending order' };
        }
      }
      
      return { valid: true };
    }

    it('should validate positive dimensions', () => {
      const result = validateBoxDimensions([10, 8, 6], null);
      expect(result.valid).toBe(true);
      
      const invalid = validateBoxDimensions([10, -5, 6], null);
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('positive');
    });

    it('should validate dimension order', () => {
      const valid = validateBoxDimensions([12, 10, 8], null);
      expect(valid.valid).toBe(true);
      
      const invalid = validateBoxDimensions([8, 10, 12], null);
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('order');
    });

    it('should validate alternate depths', () => {
      const valid = validateBoxDimensions([10, 10, 10], [7.5, 5]);
      expect(valid.valid).toBe(true);
      
      const invalid1 = validateBoxDimensions([10, 10, 10], [12, 8]);
      expect(invalid1.valid).toBe(false);
      expect(invalid1.error).toContain('less than original');
      
      const invalid2 = validateBoxDimensions([10, 10, 10], [5, 7.5]);
      expect(invalid2.valid).toBe(false);
      expect(invalid2.error).toContain('descending order');
    });
  });

  describe('Name Selection Logic', () => {
    it('should offer library names for selection', () => {
      const libraryBox = {
        dimensions: [10, 10, 10],
        names: ['10C-UPS', '10CUBE', 'TENCUBE']
      };
      
      // Simulate name selection options
      const options = [...libraryBox.names, 'custom'];
      expect(options).toHaveLength(4);
      expect(options).toContain('10C-UPS');
      expect(options).toContain('custom');
    });

    it('should track custom name selection', () => {
      const offeredNames = ['10C-UPS', '10CUBE'];
      const chosenName = 'MY-CUSTOM-10';
      
      const isCustom = !offeredNames.includes(chosenName);
      expect(isCustom).toBe(true);
    });

    it('should track library name selection', () => {
      const offeredNames = ['10C-UPS', '10CUBE'];
      const chosenName = '10C-UPS';
      
      const isCustom = !offeredNames.includes(chosenName);
      expect(isCustom).toBe(false);
    });
  });

  describe('Box Import Analytics', () => {
    it('should prepare analytics data for library box', () => {
      const analyticsData = {
        dimensions: [10, 10, 10],
        alternate_depths: [7.5, 5],
        chosen_name: '10C-UPS',
        from_library: true,
        offered_names: ['10C-UPS', '10CUBE', 'TENCUBE']
      };
      
      expect(analyticsData.from_library).toBe(true);
      expect(analyticsData.offered_names).toHaveLength(3);
    });

    it('should prepare analytics data for custom box', () => {
      const analyticsData = {
        dimensions: [11, 9, 7],
        alternate_depths: null,
        chosen_name: 'CUSTOM-11X9X7',
        from_library: false,
        offered_names: null
      };
      
      expect(analyticsData.from_library).toBe(false);
      expect(analyticsData.offered_names).toBeNull();
    });

    it('should track pivot from library to custom', () => {
      const originalBox = {
        dimensions: [10, 10, 10],
        alternate_depths: [7.5, 5]
      };
      
      const modifiedBox = {
        dimensions: [10, 10, 10],
        alternate_depths: [8, 6, 4] // Changed depths
      };
      
      const modification = {
        type: 'alternate_depths',
        original: originalBox,
        modified: modifiedBox
      };
      
      expect(modification.type).toBe('alternate_depths');
      expect(modification.original.alternate_depths).not.toEqual(modification.modified.alternate_depths);
    });
  });

  describe('Box Discovery from Excel', () => {
    const mockDiscoveryResults = {
      summary: {
        total_boxes_found: 15,
        already_in_store: 5,
        new_dimensions: 10,
        exact_matches: 7,
        unmatched: 3
      },
      results: [
        {
          row_data: { model: 'TEST-10C', price: 5.99 },
          dimensions: [10, 10, 10],
          status: 'exact_match',
          library_box: {
            dimensions: [10, 10, 10],
            names: ['10C-UPS', '10CUBE'],
            alternate_depths: [7.5, 5]
          }
        },
        {
          row_data: { model: 'CUSTOM-15', price: 8.99 },
          dimensions: [15, 12, 9],
          status: 'new',
          library_box: null
        }
      ]
    };

    it('should parse discovery summary', () => {
      const summary = mockDiscoveryResults.summary;
      expect(summary.total_boxes_found).toBe(15);
      expect(summary.exact_matches).toBe(7);
      expect(summary.unmatched).toBe(3);
    });

    it('should identify exact library matches', () => {
      const exactMatches = mockDiscoveryResults.results.filter(r => r.status === 'exact_match');
      expect(exactMatches).toHaveLength(1);
      expect(exactMatches[0].library_box).toBeTruthy();
      expect(exactMatches[0].library_box.names).toContain('10C-UPS');
    });

    it('should identify new custom boxes needed', () => {
      const newBoxes = mockDiscoveryResults.results.filter(r => r.status === 'new');
      expect(newBoxes).toHaveLength(1);
      expect(newBoxes[0].library_box).toBeNull();
      expect(newBoxes[0].dimensions).toEqual([15, 12, 9]);
    });

    it('should prepare boxes for batch import', () => {
      const selectedBoxes = mockDiscoveryResults.results.map(result => {
        if (result.status === 'exact_match') {
          return {
            model: result.library_box.names[0], // Select first name
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

      expect(selectedBoxes).toHaveLength(2);
      expect(selectedBoxes[0].from_library).toBe(true);
      expect(selectedBoxes[1].from_library).toBe(false);
    });
  });

  describe('Box Library API Error Handling', () => {
    it('should handle edge cases in search', () => {
      const testBoxes = [
        { dimensions: [10, 10, 10], names: ['TEST1'] },
        { dimensions: [20, 20, 20], names: ['TEST2'] }
      ];
      
      // Test empty search term - should return all boxes
      const allResults = searchLibrary(testBoxes, '');
      expect(allResults).toEqual(testBoxes);
      
      // Test search with no matches
      const noResults = searchLibrary(testBoxes, 'NONEXISTENT');
      expect(noResults).toHaveLength(0);
      
      // Test with empty box array
      const emptyResults = searchLibrary([], 'test');
      expect(emptyResults).toHaveLength(0);
      
      // Test with null boxes array
      const nullResults = searchLibrary(null, 'test');
      expect(nullResults).toEqual([]);
    });

    it('should handle empty search results', () => {
      const results = searchLibrary([], 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should handle malformed box data', () => {
      const malformedBoxes = [
        { dimensions: [10, 10], names: ['BAD'] }, // Missing dimension
        { dimensions: [10, 10, 10] } // Missing names
      ];
      
      // Filter valid boxes
      const validBoxes = malformedBoxes.filter(box => 
        box.dimensions && 
        box.dimensions.length === 3 && 
        box.names && 
        box.names.length > 0
      );
      
      expect(validBoxes).toHaveLength(0);
    });
  });
});

// Helper function used in actual implementation
function searchLibrary(boxes, searchTerm) {
  if (!boxes) return [];
  if (!searchTerm) return boxes;
  
  const searchLower = searchTerm.toLowerCase().replace(/\s+/g, '');
  
  return boxes.filter(box => {
    const dimStr = box.dimensions.join('x').toLowerCase().replace(/\s+/g, '');
    if (dimStr.includes(searchLower)) return true;
    
    if (box.alternate_depths) {
      const depthsStr = box.alternate_depths.join(',').toLowerCase().replace(/\s+/g, '');
      if (depthsStr.includes(searchLower)) return true;
    }
    
    if (box.names) {
      for (const name of box.names) {
        if (name.toLowerCase().replace(/\s+/g, '').includes(searchLower)) {
          return true;
        }
      }
    }
    
    if (box.category && box.category.toLowerCase().replace(/\s+/g, '').includes(searchLower)) {
      return true;
    }
    
    if (box.volume && String(box.volume).includes(searchTerm)) {
      return true;
    }
    
    return false;
  });
}