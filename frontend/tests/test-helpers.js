/**
 * Test helpers aligned with future API-driven configuration
 * Based on docs/recommendation-engine.md and packing_guidelines.yml
 */

// Mock pricing module functions that are globally available in browser
export function itemizedToStandard(itemizedPrices) {
  const boxPrice = itemizedPrices['box-price'] || 0;
  return [
    boxPrice + (itemizedPrices['basic-materials'] || 0) + (itemizedPrices['basic-services'] || 0),
    boxPrice + (itemizedPrices['standard-materials'] || 0) + (itemizedPrices['standard-services'] || 0),
    boxPrice + (itemizedPrices['fragile-materials'] || 0) + (itemizedPrices['fragile-services'] || 0),
    boxPrice + (itemizedPrices['custom-materials'] || 0) + (itemizedPrices['custom-services'] || 0)
  ];
}

// Make it globally available for tests
if (typeof global !== 'undefined') {
  global.itemizedToStandard = itemizedToStandard;
}

/**
 * Create default engine configuration matching packing_guidelines.yml
 * This will eventually come from /api/store/{id}/recommendation-config
 */
export function createDefaultEngineConfig() {
  return {
    weights: {
      price: 0.45,
      efficiency: 0.25,
      ease: 0.30
    },
    strategy_preferences: {
      normal: 0,
      prescored: 1,
      flattened: 2,
      manual_cut: 5,
      telescoping: 6,
      cheating: 8
    },
    max_recommendations: 10,
    extreme_cut_threshold: 0.5
  };
}

/**
 * Create test engine config with overrides
 * Mimics future store-specific configurations
 */
export function createTestEngineConfig(overrides = {}) {
  const defaults = createDefaultEngineConfig();
  return {
    ...defaults,
    ...overrides,
    weights: { ...defaults.weights, ...(overrides.weights || {}) },
    strategy_preferences: { ...defaults.strategy_preferences, ...(overrides.strategy_preferences || {}) }
  };
}

/**
 * Create default packing rules matching packing_guidelines.yml
 * This will eventually come from /api/store/{id}/packing-rules
 */
export function createDefaultPackingRules() {
  return {
    Basic: {
      padding_inches: 0,
      wizard_description: "For non-sensitive items like clothing, toys, books",
      label_instructions: "- Inflatable void fill as needed"
    },
    Standard: {
      padding_inches: 1,
      wizard_description: "For electronics, jewelry, and medium-sensitive items",
      label_instructions: "- Two (2) layers of large bubble or inflatable air cushioning\n- Inflatable void fill as needed\n- 1\" between item and edge of box"
    },
    Fragile: {
      padding_inches: 2,
      wizard_description: "For china, crystal, art, and sensitive equipment",
      label_instructions: "- One (1) layer of small bubble or foam wrap\n- Two (2) layers of large bubble or inflatable air cushioning\n- Inflatable void fill as needed\n- Corrugated dividers for layering multiple items\n- 2\" between item and edge of box"
    },
    Custom: {
      padding_inches: 3,
      wizard_description: "Maximum protection for highly sensitive items",
      label_instructions: "- 1\" foam plank on all sides of the box\n- One (1) layer of small bubble or foam wrap\n- Two (2) layers of small bubble or foam wrap\n- Inflatable void fill as needed\n- 3\" between item and edge of box"
    }
  };
}

/**
 * Create a Box instance with proper API padding applied
 * This mimics the behavior of loadBoxes() for tests
 */
export function createTestBox(dimensions, open_dim, prices, model = null, alternateDepths = null, BoxClass) {
  // Create the box
  const box = new BoxClass(dimensions, open_dim, prices, model, alternateDepths);
  
  // Apply standard padding offsets from API defaults
  const packingRules = createDefaultPackingRules();
  const packingOffsets = {
    "No Pack": packingRules.Basic.padding_inches * 2,        // 0
    "Standard Pack": packingRules.Standard.padding_inches * 2, // 2
    "Fragile Pack": packingRules.Fragile.padding_inches * 2,  // 4
    "Custom Pack": packingRules.Custom.padding_inches * 2     // 6
  };
  
  box.updatePackingOffsets(packingOffsets);
  
  return box;
}

/**
 * Create a NormalBox instance with proper API padding applied
 */
export function createTestNormalBox(dimensions, prices, model = null, alternateDepths = null, BoxClass) {
  // Create the box using static factory
  const box = BoxClass.NormalBox(dimensions, prices, model, alternateDepths);
  
  // Apply standard padding offsets from API defaults
  const packingRules = createDefaultPackingRules();
  const packingOffsets = {
    "No Pack": packingRules.Basic.padding_inches * 2,        // 0
    "Standard Pack": packingRules.Standard.padding_inches * 2, // 2
    "Fragile Pack": packingRules.Fragile.padding_inches * 2,  // 4
    "Custom Pack": packingRules.Custom.padding_inches * 2     // 6
  };
  
  box.updatePackingOffsets(packingOffsets);
  
  return box;
}

/**
 * Map current strategy names to future normalized names
 * Helps tests remain stable during transition
 */
export function normalizeStrategyName(strategy) {
  const mapping = {
    'Normal': 'normal',
    'Cut Down': 'manual_cut',  // or 'prescored' if isPreScored
    'Telescoping': 'telescoping',
    'Cheating': 'cheating',
    'Flattened': 'flattened'
  };
  return mapping[strategy] || strategy.toLowerCase();
}

/**
 * Create strategy preference score based on future config
 * @param {string} strategy - Current strategy name
 * @param {boolean} isPreScored - Whether it's a pre-scored cut
 * @param {object} config - Engine configuration
 */
export function getStrategyPreference(strategy, isPreScored, config) {
  const normalized = normalizeStrategyName(strategy);
  
  // Special handling for cuts
  if (strategy === 'Cut Down') {
    return isPreScored ? 
      config.strategy_preferences.prescored : 
      config.strategy_preferences.manual_cut;
  }
  
  return config.strategy_preferences[normalized] || 10;
}

/**
 * Create a test recommendation engine with future-compatible config
 */
export function createTestEngine(configOverrides = {}) {
  const config = createTestEngineConfig(configOverrides);
  
  // When RecommendationEngine is updated to accept config object,
  // this will just pass the config. For now, translate to current API:
  return {
    maxRecommendations: config.max_recommendations,
    extremeCutThreshold: config.extreme_cut_threshold,
    weights: config.weights
  };
}

/**
 * Create test box inventory with various configurations
 */
export function createTestBoxInventory() {
  return [
    // Standard boxes
    { dims: [6, 6, 6], open: 0, prices: [2.50, 3.50, 4.50, 5.50], model: 'Cube-S' },
    { dims: [12, 9, 6], open: 2, prices: [3.00, 4.00, 5.00, 6.00], model: 'Std-A' },
    { dims: [14, 14, 14], open: 0, prices: [5.00, 6.50, 8.00, 9.50], model: 'Cube-L' },
    { dims: [20, 16, 12], open: 2, prices: [6.00, 8.00, 10.00, 12.00], model: 'Std-B' },
    
    // Box with pre-scored depths (future: prescored strategy)
    { dims: [24, 18, 6], open: 1, prices: [7.00, 9.00, 11.00, 13.00], model: 'Flat-L', alternates: [4, 3] },
    
    // Itemized pricing example
    {
      dims: [16, 12, 8], 
      open: 2, 
      prices: {
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
      },
      model: 'Item-A'
    }
  ];
}

/**
 * Assert that a recommendation has expected properties
 */
export function assertValidRecommendation(rec) {
  expect(rec).toHaveProperty('box');
  expect(rec).toHaveProperty('result');
  expect(rec).toHaveProperty('tag');
  expect(rec).toHaveProperty('tagClass');
  expect(rec.result).toHaveProperty('price');
  expect(rec.result).toHaveProperty('strategy');
  expect(rec.result).toHaveProperty('recomendationLevel');
  expect(rec.result.price).toBeGreaterThan(0);
}

/**
 * Example test configurations for different scenarios
 * Based on docs/recommendation-engine.md examples
 */
export const TEST_CONFIGS = {
  costConscious: createTestEngineConfig({
    weights: { price: 0.70, efficiency: 0.10, ease: 0.20 }
  }),
  
  efficiencyFocused: createTestEngineConfig({
    weights: { price: 0.20, efficiency: 0.60, ease: 0.20 }
  }),
  
  easeFirst: createTestEngineConfig({
    weights: { price: 0.25, efficiency: 0.25, ease: 0.50 },
    strategy_preferences: {
      normal: 0,
      prescored: 1,
      flattened: 2,
      manual_cut: 9,  // Strongly avoid
      telescoping: 8,
      cheating: 9
    }
  }),
  
  highVolume: createTestEngineConfig({
    weights: { price: 0.30, efficiency: 0.20, ease: 0.50 },
    strategy_preferences: {
      normal: 0,
      prescored: 2,
      manual_cut: 8,
      telescoping: 9
    }
  })
};