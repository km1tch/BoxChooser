import { describe, it, expect, beforeEach } from 'vitest';
import { Box, BoxResult, loadBoxes } from '../lib/packing.js';
import { createTestBox, createTestNormalBox } from './test-helpers.js';

describe('Box', () => {
  describe('constructor', () => {
    it('should create a box with standard pricing', () => {
      const box = createTestBox([12, 10, 6], 2, [5.00, 7.00, 9.00, 11.00], 'TestBox', null, Box);
      
      expect(box.dimensions).toEqual([12, 10, 6]); // Already sorted
      expect(box.open_dim).toBe(2); // Smallest dimension
      expect(box.model).toBe('TestBox');
      expect(box.prices).toEqual([5.00, 7.00, 9.00, 11.00]);
    });

    it('should sort dimensions in descending order', () => {
      const box = createTestBox([6, 12, 10], 1, [5.00, 7.00, 9.00, 11.00], null, null, Box);
      
      expect(box.dimensions).toEqual([12, 10, 6]);
    });

    it('should handle itemized pricing', () => {
      const itemizedPrices = {
        'box-price': 5.00,
        'basic-materials': 0,
        'basic-services': 0,
        'standard-materials': 1.00,
        'standard-services': 1.00,
        'fragile-materials': 2.00,
        'fragile-services': 2.00,
        'custom-materials': 3.00,
        'custom-services': 3.00
      };
      
      // Mock the global itemizedToStandard function
      global.itemizedToStandard = (prices) => {
        const bp = prices['box-price'] || 0;
        return [
          bp + (prices['basic-materials'] || 0) + (prices['basic-services'] || 0),
          bp + (prices['standard-materials'] || 0) + (prices['standard-services'] || 0),
          bp + (prices['fragile-materials'] || 0) + (prices['fragile-services'] || 0),
          bp + (prices['custom-materials'] || 0) + (prices['custom-services'] || 0)
        ];
      };
      
      const box = createTestBox([12, 10, 6], 2, { 'itemized-prices': itemizedPrices }, null, null, Box);
      
      // Should convert to standard format [basic, standard, fragile, custom]
      expect(box.prices).toEqual([5.00, 7.00, 9.00, 11.00]);
    });

    it('should handle alternate depths', () => {
      const box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], 'TestBox', [8, 6, 4], Box);
      
      expect(box.alternateDepths).toEqual([8, 6, 4]);
    });
  });

  describe('boxSpace', () => {
    let box;
    
    beforeEach(() => {
      box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], null, null, Box);
    });

    it('should calculate space between box and item', () => {
      const itemDims = [18, 13, 8];
      const space = box.boxSpace(box.dimensions, itemDims);
      
      expect(space).toEqual([2, 2, 2]);
    });

    it('should handle items larger than box (negative space)', () => {
      const itemDims = [22, 16, 11];
      const space = box.boxSpace(box.dimensions, itemDims);
      
      expect(space).toEqual([-2, -1, -1]);
    });
  });

  describe('calcScore', () => {
    let box;
    
    beforeEach(() => {
      box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], null, null, Box);
    });

    it('should calculate score based on extra space', () => {
      const extraSpace = [2, 2, 2];
      const score = box.calcScore(extraSpace);
      
      // Score = 2^2 + 2^2 + 2^2 = 12
      expect(score).toBe(12);
    });

    it('should handle zero space', () => {
      const extraSpace = [0, 0, 0];
      const score = box.calcScore(extraSpace);
      
      expect(score).toBe(0);
    });
  });

  describe('getPrice', () => {
    let box;
    
    beforeEach(() => {
      box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], null, null, Box);
    });

    it('should return correct price for each packing level', () => {
      expect(box.getPrice('No Pack')).toBe(5.00);
      expect(box.getPrice('Standard Pack')).toBe(7.00);
      expect(box.getPrice('Fragile Pack')).toBe(9.00);
      expect(box.getPrice('Custom Pack')).toBe(11.00);
    });
  });

  describe('calcRecomendation', () => {
    let box;
    
    beforeEach(() => {
      box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], null, null, Box);
    });

    it('should return "impossible" when item cannot fit', () => {
      const offsets = [-2, 1, 1]; // Negative offset
      const result = box.calcRecomendation(offsets, 'Standard Pack');
      
      expect(result).toBe('impossible');
    });

    it('should return "no space" when no padding space', () => {
      const offsets = [0, 2, 2]; // Zero offset with packing
      const result = box.calcRecomendation(offsets, 'Standard Pack');
      
      expect(result).toBe('no space');
    });

    it('should return "possible" when space is tight', () => {
      const offsets = [1, 1, 1]; // Less than required padding (Standard Pack needs 2)
      const result = box.calcRecomendation(offsets, 'Standard Pack');
      
      expect(result).toBe('possible');
    });

    it('should return "fits" when enough space', () => {
      const offsets = [3, 3, 3]; // More than required padding
      const result = box.calcRecomendation(offsets, 'Standard Pack');
      
      expect(result).toBe('fits');
    });
  });

  describe('packing result generators', () => {
    let box;
    
    beforeEach(() => {
      box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], null, null, Box);
    });

    describe('gen_normalBoxResults', () => {
      it('should generate normal packing results', () => {
        const itemDims = [18, 13, 8];
        const result = box.gen_normalBoxResults('Standard Pack', itemDims);
        
        expect(result).toBeInstanceOf(BoxResult);
        expect(result.strategy).toBe('Normal');
        expect(result.price).toBe(7.00); // Standard price
        expect(result.packLevel).toBe('Standard Pack');
      });
    });

    describe('gen_cutDownBoxResults', () => {
      it('should generate cut down results', () => {
        const itemDims = [15, 12, 5];
        const result = box.gen_cutDownBoxResults('Standard Pack', itemDims);
        
        expect(result).toBeInstanceOf(BoxResult);
        expect(result.strategy).toBe('Cut Down');
        // Comment format varies, just check it exists
        expect(result.comment).toBeTruthy();
      });

      it('should use pre-scored depths when available', () => {
        const boxWithAlternates = createTestBox(
          [20, 15, 10], 
          2, 
          [5.00, 7.00, 9.00, 11.00],
          'TestBox',
          [8, 6, 4], // Pre-scored depths
          Box
        );
        
        const itemDims = [15, 12, 5];
        const result = boxWithAlternates.gen_cutDownBoxResults('No Pack', itemDims);
        
        expect(result.isPreScored).toBe(true);
        expect(result.comment).toContain('Pre-scored');
      });
    });

    describe('gen_telescopingBoxResults', () => {
      it('should generate telescoping results', () => {
        const itemDims = [15, 12, 25]; // Tall item
        const result = box.gen_telescopingBoxResults('Standard Pack', itemDims);
        
        expect(result).toBeInstanceOf(BoxResult);
        expect(result.strategy).toBe('Telescoping');
        if (result.recomendationLevel === 'fits') {
          expect(result.comment).toMatch(/\d+ boxes/);
        }
      });
    });

    describe('gen_flattenedBoxResults', () => {
      it('should handle flat items', () => {
        const itemDims = [15, 12, 0.5]; // Very flat
        const result = box.gen_flattenedBoxResults('No Pack', itemDims);
        
        expect(result).toBeInstanceOf(BoxResult);
        expect(result.strategy).toBe('Flattened');
      });

      it('should reject thick items', () => {
        const itemDims = [15, 12, 2]; // Too thick
        const result = box.gen_flattenedBoxResults('No Pack', itemDims);
        
        expect(result.recomendationLevel).toBe('impossible');
      });
    });

    describe('gen_cheatingBoxResults', () => {
      it('should generate diagonal packing results', () => {
        const itemDims = [14, 10, 8];
        const result = box.gen_cheatingBoxResults('Standard Pack', itemDims);
        
        expect(result).toBeInstanceOf(BoxResult);
        expect(result.strategy).toBe('Cheating');
      });
    });
  });

  describe('gen_boxResults', () => {
    it('should generate results for all strategies and packing levels', () => {
      const box = createTestBox([20, 15, 10], 2, [5.00, 7.00, 9.00, 11.00], null, null, Box);
      const itemDims = [15, 12, 8];
      
      const results = box.gen_boxResults(itemDims);
      
      // Should have results for each packing level
      expect(results).toHaveProperty('No Pack');
      expect(results).toHaveProperty('Standard Pack');
      expect(results).toHaveProperty('Fragile Pack');
      expect(results).toHaveProperty('Custom Pack');
      
      // Each level should have all strategies
      const strategies = ['Normal', 'Cut Down', 'Telescoping', 'Cheating', 'Flattened'];
      strategies.forEach(strategy => {
        expect(results['Standard Pack']).toHaveProperty(strategy);
        expect(results['Standard Pack'][strategy]).toBeInstanceOf(BoxResult);
      });
    });
  });

  describe('static methods', () => {
    it('should create NormalBox with last dimension as open', () => {
      const box = createTestNormalBox([12, 10, 6], [5.00, 7.00, 9.00, 11.00], 'Normal', null, Box);
      
      expect(box.open_dim).toBe(2); // Last dimension
      expect(box.model).toBe('Normal');
    });
  });
});

describe('BoxResult', () => {
  it('should create a result with all properties', () => {
    const result = new BoxResult(
      [20, 15, 10],
      'Standard Pack',
      7.00,
      'fits',
      'Test comment',
      12,
      'Normal'
    );
    
    expect(result.dimensions).toEqual([20, 15, 10]);
    expect(result.packLevel).toBe('Standard Pack');
    expect(result.price).toBe(7.00);
    expect(result.recomendationLevel).toBe('fits');
    expect(result.comment).toBe('Test comment');
    expect(result.score).toBe(12);
    expect(result.strategy).toBe('Normal');
  });
});

// Test global loadBoxes function
describe('loadBoxes', () => {
  it('should be a function', () => {
    expect(typeof loadBoxes).toBe('function');
  });
});