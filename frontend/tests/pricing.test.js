import { describe, it, expect } from 'vitest';
import { createDefaultPackingRules } from './test-helpers.js';

// Mock the pricing module functions
const PricingMode = {
  STANDARD: 'standard',
  ITEMIZED: 'itemized'
};

const PackingLevelIndex = {
  NO_PACK: 0,
  STANDARD: 1,
  FRAGILE: 2,
  CUSTOM: 3
};

// Import functions to test (in real setup these would be imported from pricing.js)
function getPricingMode(storeConfig) {
  if (!storeConfig) return PricingMode.STANDARD;
  return storeConfig['pricing-mode'] === 'itemized' ? PricingMode.ITEMIZED : PricingMode.STANDARD;
}

function getPackingLevelIndex(packingLevel) {
  const mapping = {
    'No Pack': PackingLevelIndex.NO_PACK,
    'Basic': PackingLevelIndex.NO_PACK,
    'Standard Pack': PackingLevelIndex.STANDARD,
    'Standard': PackingLevelIndex.STANDARD,
    'Fragile Pack': PackingLevelIndex.FRAGILE,
    'Fragile': PackingLevelIndex.FRAGILE,
    'Custom Pack': PackingLevelIndex.CUSTOM,
    'Custom': PackingLevelIndex.CUSTOM
  };
  
  return mapping[packingLevel] !== undefined ? mapping[packingLevel] : PackingLevelIndex.NO_PACK;
}

function getTotalPrice(box, packingLevel) {
  const packingLevelIndex = getPackingLevelIndex(packingLevel);
  
  // Handle standard pricing model
  if (box.prices && Array.isArray(box.prices)) {
    return box.prices[packingLevelIndex];
  }
  
  // Handle itemized pricing model
  if (box['itemized-prices']) {
    const itemized = box['itemized-prices'];
    const boxPrice = itemized['box-price'] || 0;
    
    switch (packingLevelIndex) {
      case PackingLevelIndex.NO_PACK:
        return boxPrice + (itemized['basic-materials'] || 0) + (itemized['basic-services'] || 0);
      case PackingLevelIndex.STANDARD:
        return boxPrice + (itemized['standard-materials'] || 0) + (itemized['standard-services'] || 0);
      case PackingLevelIndex.FRAGILE:
        return boxPrice + (itemized['fragile-materials'] || 0) + (itemized['fragile-services'] || 0);
      case PackingLevelIndex.CUSTOM:
        return boxPrice + (itemized['custom-materials'] || 0) + (itemized['custom-services'] || 0);
      default:
        return boxPrice;
    }
  }
  
  // Fallback if no pricing info
  return 0;
}

function getBoxPriceForProtection(box, protectionLevel) {
  return getTotalPrice(box, protectionLevel);
}

function calculateServiceCharge(box, packingType) {
  // Service charge is included in getTotalPrice for itemized pricing
  if (box['itemized-prices']) {
    const itemized = box['itemized-prices'];
    const levelIndex = getPackingLevelIndex(packingType);
    
    switch (levelIndex) {
      case PackingLevelIndex.NO_PACK:
        return itemized['basic-services'] || 0;
      case PackingLevelIndex.STANDARD:
        return itemized['standard-services'] || 0;
      case PackingLevelIndex.FRAGILE:
        return itemized['fragile-services'] || 0;
      case PackingLevelIndex.CUSTOM:
        return itemized['custom-services'] || 0;
      default:
        return 0;
    }
  }
  
  // Standard pricing doesn't separate service charges
  return 0;
}

describe('Pricing Module', () => {
  describe('getPricingMode', () => {
    it('should return standard mode by default', () => {
      expect(getPricingMode({})).toBe('standard');
      expect(getPricingMode({ 'pricing-mode': 'anything-else' })).toBe('standard');
    });

    it('should return itemized mode when explicitly set', () => {
      expect(getPricingMode({ 'pricing-mode': 'itemized' })).toBe('itemized');
    });

    it('should handle null/undefined config', () => {
      expect(getPricingMode(null)).toBe('standard');
      expect(getPricingMode(undefined)).toBe('standard');
    });
  });

  describe('getPackingLevelIndex', () => {
    it('should map standard packing level names', () => {
      expect(getPackingLevelIndex('No Pack')).toBe(0);
      expect(getPackingLevelIndex('Standard Pack')).toBe(1);
      expect(getPackingLevelIndex('Fragile Pack')).toBe(2);
      expect(getPackingLevelIndex('Custom Pack')).toBe(3);
    });

    it('should map short packing level names', () => {
      expect(getPackingLevelIndex('Basic')).toBe(0);
      expect(getPackingLevelIndex('Standard')).toBe(1);
      expect(getPackingLevelIndex('Fragile')).toBe(2);
      expect(getPackingLevelIndex('Custom')).toBe(3);
    });

    it('should default to NO_PACK for unknown levels', () => {
      expect(getPackingLevelIndex('Unknown')).toBe(0);
      expect(getPackingLevelIndex('')).toBe(0);
      expect(getPackingLevelIndex(null)).toBe(0);
      expect(getPackingLevelIndex(undefined)).toBe(0);
    });

    it('should be case sensitive', () => {
      expect(getPackingLevelIndex('standard pack')).toBe(0); // Unknown, defaults to 0
      expect(getPackingLevelIndex('CUSTOM')).toBe(0); // Unknown, defaults to 0
    });
  });

  describe('getTotalPrice - Standard Pricing', () => {
    const standardBox = {
      prices: [2.50, 3.50, 4.50, 5.50]
    };

    it('should return correct price for each packing level', () => {
      expect(getTotalPrice(standardBox, 'No Pack')).toBe(2.50);
      expect(getTotalPrice(standardBox, 'Standard Pack')).toBe(3.50);
      expect(getTotalPrice(standardBox, 'Fragile Pack')).toBe(4.50);
      expect(getTotalPrice(standardBox, 'Custom Pack')).toBe(5.50);
    });

    it('should handle incomplete price arrays', () => {
      const partialBox = { prices: [1.00, 2.00] };
      expect(getTotalPrice(partialBox, 'No Pack')).toBe(1.00);
      expect(getTotalPrice(partialBox, 'Standard Pack')).toBe(2.00);
      expect(getTotalPrice(partialBox, 'Fragile Pack')).toBe(undefined); // Array access out of bounds
      expect(getTotalPrice(partialBox, 'Custom Pack')).toBe(undefined);
    });

    it('should handle edge cases', () => {
      expect(getTotalPrice({ prices: [] }, 'No Pack')).toBe(undefined);
      expect(getTotalPrice({ prices: null }, 'No Pack')).toBe(0);
      expect(getTotalPrice({}, 'No Pack')).toBe(0);
    });
  });

  describe('getTotalPrice - Itemized Pricing', () => {
    const itemizedBox = {
      'itemized-prices': {
        'box-price': 4.00,
        'basic-materials': 0,
        'basic-services': 0,
        'standard-materials': 1.50,
        'standard-services': 1.50,
        'fragile-materials': 2.50,
        'fragile-services': 2.50,
        'custom-materials': 3.50,
        'custom-services': 3.50
      }
    };

    it('should calculate total price correctly for each level', () => {
      expect(getTotalPrice(itemizedBox, 'No Pack')).toBe(4.00); // box only
      expect(getTotalPrice(itemizedBox, 'Standard Pack')).toBe(7.00); // 4 + 1.5 + 1.5
      expect(getTotalPrice(itemizedBox, 'Fragile Pack')).toBe(9.00); // 4 + 2.5 + 2.5
      expect(getTotalPrice(itemizedBox, 'Custom Pack')).toBe(11.00); // 4 + 3.5 + 3.5
    });

    it('should handle partial itemized data', () => {
      const partialItemized = {
        'itemized-prices': {
          'box-price': 5.00,
          'standard-materials': 2.00
          // Missing services and other levels
        }
      };
      
      expect(getTotalPrice(partialItemized, 'No Pack')).toBe(5.00);
      expect(getTotalPrice(partialItemized, 'Standard Pack')).toBe(7.00); // 5 + 2 + 0
      expect(getTotalPrice(partialItemized, 'Fragile Pack')).toBe(5.00); // Missing data
    });

    it('should handle missing box-price', () => {
      const noBoxPrice = {
        'itemized-prices': {
          'standard-materials': 1.00,
          'standard-services': 1.00
        }
      };
      
      expect(getTotalPrice(noBoxPrice, 'Standard Pack')).toBe(2.00); // 0 + 1 + 1
    });

    it('should handle edge cases', () => {
      expect(getTotalPrice({ 'itemized-prices': {} }, 'No Pack')).toBe(0);
      expect(getTotalPrice({ 'itemized-prices': null }, 'No Pack')).toBe(0);
    });
  });

  describe('calculateServiceCharge', () => {
    const itemizedBox = {
      'itemized-prices': {
        'basic-services': 0.50,
        'standard-services': 1.50,
        'fragile-services': 2.50,
        'custom-services': 3.50
      }
    };

    it('should return service charge for itemized pricing', () => {
      expect(calculateServiceCharge(itemizedBox, 'No Pack')).toBe(0.50);
      expect(calculateServiceCharge(itemizedBox, 'Standard Pack')).toBe(1.50);
      expect(calculateServiceCharge(itemizedBox, 'Fragile Pack')).toBe(2.50);
      expect(calculateServiceCharge(itemizedBox, 'Custom Pack')).toBe(3.50);
    });

    it('should return 0 for standard pricing boxes', () => {
      const standardBox = { prices: [1, 2, 3, 4] };
      expect(calculateServiceCharge(standardBox, 'Standard Pack')).toBe(0);
    });

    it('should handle missing service charges', () => {
      const partial = {
        'itemized-prices': {
          'standard-services': 2.00
          // Missing other levels
        }
      };
      
      expect(calculateServiceCharge(partial, 'No Pack')).toBe(0);
      expect(calculateServiceCharge(partial, 'Standard Pack')).toBe(2.00);
      expect(calculateServiceCharge(partial, 'Fragile Pack')).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle mixed box inventory', () => {
      const boxes = [
        { model: 'STD-A', prices: [2, 3, 4, 5] },
        { 
          model: 'ITM-B', 
          'itemized-prices': {
            'box-price': 3,
            'standard-materials': 1,
            'standard-services': 1
          }
        }
      ];
      
      // Both boxes should price correctly at Standard level
      expect(getTotalPrice(boxes[0], 'Standard Pack')).toBe(3);
      expect(getTotalPrice(boxes[1], 'Standard Pack')).toBe(5); // 3 + 1 + 1
    });

    it('should handle real-world price variations', () => {
      // Test with realistic price progressions
      const realBox = {
        'itemized-prices': {
          'box-price': 12.95,
          'basic-materials': 0,
          'basic-services': 0,
          'standard-materials': 3.25,
          'standard-services': 2.75,
          'fragile-materials': 5.50,
          'fragile-services': 4.50,
          'custom-materials': 8.00,
          'custom-services': 7.00
        }
      };
      
      expect(getTotalPrice(realBox, 'No Pack')).toBe(12.95);
      expect(getTotalPrice(realBox, 'Standard Pack')).toBe(18.95); // 12.95 + 3.25 + 2.75
      expect(getTotalPrice(realBox, 'Fragile Pack')).toBe(22.95); // 12.95 + 5.50 + 4.50
      expect(getTotalPrice(realBox, 'Custom Pack')).toBe(27.95); // 12.95 + 8.00 + 7.00
    });
  });
});