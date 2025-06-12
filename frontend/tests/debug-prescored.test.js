import { describe, it, expect } from 'vitest';
import { Box } from '../lib/packing.js';
import { createTestBox } from './test-helpers.js';

// Mock the global itemizedToStandard function
global.itemizedToStandard = (prices) => {
  const bp = prices['box-price'] || 0;
  return [
    bp,
    bp + (prices['standard-materials'] || 0) + (prices['standard-services'] || 0),
    bp + (prices['fragile-materials'] || 0) + (prices['fragile-services'] || 0),
    bp + (prices['custom-materials'] || 0) + (prices['custom-services'] || 0)
  ];
};

describe('Debug pre-scored options', () => {
  it('should check if pre-scored options are generated', () => {
    // Create box with pre-scored depths
    const box = createTestBox([22, 16, 6], 1, [7.00, 9.00, 11.00, 13.00], 'Flat-Box', [4, 3], Box);
    const itemDims = [14, 10, 3];
    const results = box.gen_boxResults(itemDims);
    
    console.log('\n=== Box Info ===');
    console.log('Box dimensions:', box.dimensions);
    console.log('Box alternate depths:', box.alternateDepths);
    
    console.log('\n=== Item Info ===');
    console.log('Item dimensions:', itemDims);
    
    console.log('\n=== Cut Down Results ===');
    const cutDown = results['Standard Pack']['Cut Down'];
    console.log('Cut Down result:', JSON.stringify(cutDown, null, 2));
    console.log('isPreScored:', cutDown.isPreScored);
    console.log('cutDepth:', cutDown.cutDepth);
    
    console.log('\n=== All Strategies ===');
    Object.keys(results['Standard Pack']).forEach(strategy => {
      const result = results['Standard Pack'][strategy];
      console.log(`${strategy}: ${result.recomendationLevel}, isPreScored: ${result.isPreScored}`);
    });
    
    // This test is just for debugging
    expect(true).toBe(true);
  });
});