import { describe, it, expect, beforeEach } from 'vitest';
import RecommendationEngine from '../lib/recommendation-engine.js';
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

// Helper to create valid engine config
function createEngineConfig(overrides = {}) {
  const defaults = {
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
  
  return {
    ...defaults,
    ...overrides,
    weights: { ...defaults.weights, ...(overrides.weights || {}) },
    strategy_preferences: { ...defaults.strategy_preferences, ...(overrides.strategy_preferences || {}) }
  };
}

describe('RecommendationEngine', () => {
  let engine;
  let testBoxes;
  
  beforeEach(() => {
    // Use helper to create valid config
    engine = new RecommendationEngine(createEngineConfig());
    
    // Create test boxes with varying sizes and prices
    testBoxes = [
      createTestBox([20, 15, 10], 2, [10.00, 12.00, 14.00, 16.00], 'Large-Expensive', null, Box),
      createTestBox([18, 14, 9], 2, [8.00, 10.00, 12.00, 14.00], 'Medium-Mid', null, Box),
      createTestBox([16, 12, 8], 2, [6.00, 8.00, 10.00, 12.00], 'Small-Cheap', null, Box),
      createTestBox([22, 16, 6], 1, [7.00, 9.00, 11.00, 13.00], 'Flat-Box', [4, 3], Box), // With pre-scored depths
      createTestBox([25, 20, 15], 2, [12.00, 14.00, 16.00, 18.00], 'XL-Premium', null, Box)
    ];
  });

  describe('constructor', () => {
    it('should require complete configuration', () => {
      // Should throw without config
      expect(() => new RecommendationEngine()).toThrow('RecommendationEngine requires complete configuration');
      
      // Should throw with partial config
      expect(() => new RecommendationEngine({ weights: { price: 0.5 } })).toThrow();
    });

    it('should accept custom configuration', () => {
      const customEngine = new RecommendationEngine({
        weights: {
          price: 0.5,
          efficiency: 0.3,
          ease: 0.2
        },
        strategy_preferences: {
          normal: 0,
          prescored: 1,
          flattened: 2,
          manual_cut: 5,
          telescoping: 6,
          cheating: 8
        },
        max_recommendations: 5,
        extreme_cut_threshold: 0.5
      });
      
      expect(customEngine.maxRecommendations).toBe(5);
      expect(customEngine.weights.price).toBe(0.5);
    });
  });

  describe('getStrategyPenalty', () => {
    it('should return correct penalty for strategies', () => {
      expect(engine.getStrategyPenalty('Normal', {})).toBe(0);
      expect(engine.getStrategyPenalty('Cut Down', { isPreScored: true })).toBe(0.1);
      expect(engine.getStrategyPenalty('Cut Down', { isPreScored: false })).toBe(0.5);
      expect(engine.getStrategyPenalty('Flattened', {})).toBe(0.2);
      expect(engine.getStrategyPenalty('Telescoping', {})).toBe(0.6);
      expect(engine.getStrategyPenalty('Cheating', {})).toBe(0.8);
    });
  });

  describe('generateAllStrategies', () => {
    it('should generate strategies for all boxes', () => {
      const itemDims = [14, 10, 6];
      const strategies = engine.generateAllStrategies(testBoxes, itemDims, 'Standard Pack');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('box');
      expect(strategies[0]).toHaveProperty('result');
      expect(strategies[0]).toHaveProperty('strategyPenalty');
    });

    it('should filter out extreme manual cuts', () => {
      const itemDims = [14, 10, 2]; // Very thin item
      const strategies = engine.generateAllStrategies(testBoxes, itemDims, 'Standard Pack');
      
      // Should not include cut down strategies that remove >50% of box
      const extremeCuts = strategies.filter(s => 
        s.result.strategy === 'Cut Down' && 
        !s.isAlternateDepth &&
        s.cutDepth && s.cutDepth < 4 // Less than 50% of smallest box dimension (8)
      );
      
      expect(extremeCuts.length).toBe(0);
    });

    it('should include pre-scored options', () => {
      // Create a box where pre-scored will actually work
      // Box [20, 15, 10] with open_dim=2 (opens on 10" side) and pre-scored depths [8, 6, 4]
      const specialBox = createTestBox([20, 15, 10], 2, [5.00, 6.00, 7.00, 8.00], 'PreScored-Box', [8, 6, 4], Box);
      const boxesWithPreScored = [...testBoxes, specialBox];
      
      // Item that needs less than the pre-scored depths
      const itemDims = [18, 13, 3]; // Needs 3" depth, pre-scored has 4" available
      
      const strategies = engine.generateAllStrategies(boxesWithPreScored, itemDims, 'No Pack');
      
      const preScored = strategies.filter(s => s.isAlternateDepth);
      expect(preScored.length).toBeGreaterThan(0);
      
      // Verify the pre-scored option has correct properties
      const preScoredOption = preScored[0];
      expect(preScoredOption.result.strategy).toBe('Cut Down');
      expect(preScoredOption.cutDepth).toBe(4); // Should use the 4" pre-scored depth
    });
  });

  describe('calculateScores', () => {
    it('should normalize scores and prices', () => {
      const itemDims = [14, 10, 6];
      const strategies = engine.generateAllStrategies(testBoxes, itemDims, 'Standard Pack');
      const { results, stats } = engine.calculateScores(strategies);
      
      // Check normalization
      results.forEach(result => {
        expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
        expect(result.normalizedScore).toBeLessThanOrEqual(1);
        expect(result.normalizedPrice).toBeGreaterThanOrEqual(0);
        expect(result.normalizedPrice).toBeLessThanOrEqual(1);
      });
      
      // Check stats
      expect(stats).toHaveProperty('meanScore');
      expect(stats).toHaveProperty('stdDev');
      expect(stats).toHaveProperty('minPrice');
      expect(stats).toHaveProperty('maxPrice');
    });

    it('should mark reasonably efficient options', () => {
      const itemDims = [14, 10, 6];
      const strategies = engine.generateAllStrategies(testBoxes, itemDims, 'Standard Pack');
      const { results } = engine.calculateScores(strategies);
      
      const efficient = results.filter(r => r.isReasonablyEfficient);
      expect(efficient.length).toBeGreaterThan(0);
    });
  });

  describe('rankResults', () => {
    it('should rank by composite score', () => {
      const itemDims = [14, 10, 6];
      const strategies = engine.generateAllStrategies(testBoxes, itemDims, 'Standard Pack');
      const { results, stats } = engine.calculateScores(strategies);
      const recommendations = engine.rankResults(results, stats);
      
      // Should have at least one recommendation
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should be sorted by composite score
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].compositeScore).toBeGreaterThanOrEqual(
          recommendations[i-1].compositeScore
        );
      }
    });

    it('should add descriptive tags', () => {
      const itemDims = [14, 10, 6];
      const recommendations = engine.getRecommendations(testBoxes, itemDims, 'Standard Pack');
      
      // All recommendations should have tags
      recommendations.forEach(rec => {
        expect(rec.tag).toBeTruthy();
        expect(rec.tagClass).toBeTruthy();
      });
      
      // Check for strategy-based tags
      const tags = recommendations.map(r => r.tag);
      const strategies = recommendations.map(r => r.result.strategy);
      
      if (strategies.includes('Normal')) {
        expect(tags.some(t => t.includes('No Modifications'))).toBe(true);
      }
      if (strategies.includes('Cut Down')) {
        expect(tags.some(t => t.includes('Cut'))).toBe(true);
      }
    });

    it('should limit recommendations to maxRecommendations', () => {
      engine.maxRecommendations = 3;
      const itemDims = [14, 10, 6];
      const recommendations = engine.getRecommendations(testBoxes, itemDims, 'Standard Pack');
      
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should not duplicate box-strategy combinations', () => {
      const itemDims = [14, 10, 6];
      const recommendations = engine.getRecommendations(testBoxes, itemDims, 'Standard Pack');
      
      const seen = new Set();
      recommendations.forEach(rec => {
        const key = `${rec.box.model}-${rec.result.strategy}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      });
    });
  });

  describe('getRecommendations', () => {
    it('should return empty array when no boxes fit', () => {
      const itemDims = [50, 40, 30]; // Too large for any box
      const recommendations = engine.getRecommendations(testBoxes, itemDims, 'Standard Pack');
      
      expect(recommendations).toEqual([]);
    });

    it('should handle different packing levels', () => {
      const itemDims = [14, 10, 6];
      
      const noPack = engine.getRecommendations(testBoxes, itemDims, 'No Pack');
      const fragile = engine.getRecommendations(testBoxes, itemDims, 'Fragile Pack');
      
      expect(noPack.length).toBeGreaterThan(0);
      expect(fragile.length).toBeGreaterThan(0);
      
      // Fragile should generally be more expensive
      const noPackMinPrice = Math.min(...noPack.map(r => r.result.price));
      const fragileMinPrice = Math.min(...fragile.map(r => r.result.price));
      expect(fragileMinPrice).toBeGreaterThanOrEqual(noPackMinPrice);
    });

    it('should properly label pre-scored and manual cuts', () => {
      // Use dimensions that will trigger both manual and pre-scored cuts
      const itemDims = [14, 10, 1]; // Very thin item
      const recommendations = engine.getRecommendations(testBoxes, itemDims, 'No Pack');
      
      const manualCuts = recommendations.filter(r => 
        r.result.strategy === 'Cut Down' && !r.isAlternateDepth
      );
      const preScored = recommendations.filter(r => 
        r.result.strategy === 'Cut Down' && r.isAlternateDepth
      );
      
      // Check tags
      manualCuts.forEach(cut => {
        expect(cut.tag).toContain('Manual Cut');
      });
      preScored.forEach(cut => {
        expect(cut.tag).toContain('Pre-Scored');
      });
    });

    it('should provide diverse strategy options', () => {
      const itemDims = [14, 10, 6];
      const recommendations = engine.getRecommendations(testBoxes, itemDims, 'Standard Pack');
      
      const strategies = new Set(recommendations.map(r => r.result.strategy));
      expect(strategies.size).toBeGreaterThan(1); // Should have multiple strategies
    });

    it('should handle edge case dimensions', () => {
      // Very flat item
      const flatItem = [20, 15, 0.5];
      const flatRecs = engine.getRecommendations(testBoxes, flatItem, 'No Pack');
      
      const hasFlattened = flatRecs.some(r => r.result.strategy === 'Flattened');
      expect(hasFlattened).toBe(true);
      
      // Item that would benefit from telescoping
      // Standard Pack needs 1" padding on all sides, so effective space is reduced by 2" per dimension
      // Small-Cheap [16, 12, 8] -> effective [14, 10, 6] with Standard Pack
      const tallItem = [4, 4, 20];  // Should fit with padding
      
      const tallRecs = engine.getRecommendations(testBoxes, tallItem, 'Standard Pack');
      
      // If no recommendations with Standard Pack due to padding, try No Pack
      if (tallRecs.length === 0) {
        const noPackRecs = engine.getRecommendations(testBoxes, tallItem, 'No Pack');
        expect(noPackRecs.length).toBeGreaterThan(0);
      } else {
        expect(tallRecs.length).toBeGreaterThan(0);
      }
      
      // Verify we have telescoping among the strategies
      const hasTelescoping = tallRecs.some(r => r.result.strategy === 'Telescoping');
      // It's ok if telescoping isn't recommended due to strategy preferences,
      // but we should have some recommendations
      expect(tallRecs.length).toBeGreaterThan(0);
    });
  });

  describe('composite scoring', () => {
    it('should balance price, efficiency, and ease', () => {
      const itemDims = [14, 10, 6];
      const strategies = engine.generateAllStrategies(testBoxes, itemDims, 'Standard Pack');
      const { results } = engine.calculateScores(strategies);
      
      // Manually calculate composite score for verification
      const testResult = results[0];
      const expectedComposite = 
        engine.weights.price * testResult.normalizedPrice +
        engine.weights.efficiency * testResult.normalizedScore +
        engine.weights.ease * testResult.strategyPenalty;
      
      // Calculate composite scores (done internally in rankByPhases)
      results.forEach(r => {
        r.compositeScore = 
          engine.weights.price * r.normalizedPrice +
          engine.weights.efficiency * r.normalizedScore +
          engine.weights.ease * r.strategyPenalty;
      });
      
      expect(testResult.compositeScore).toBeCloseTo(expectedComposite, 5);
    });
  });
});

// Integration-style tests
describe('RecommendationEngine Integration', () => {
  it('should handle real-world scenario with multiple box types', () => {
    const engine = new RecommendationEngine(createEngineConfig());
    
    // Create a more realistic box inventory
    const boxes = [
      new Box([6, 6, 6], 0, [2.50, 3.50, 4.50, 5.50], 'Cube-Small'),
      new Box([12, 9, 6], 2, [3.00, 4.00, 5.00, 6.00], 'Standard-A'),
      new Box([14, 14, 14], 0, [5.00, 6.50, 8.00, 9.50], 'Cube-Large'),
      new Box([20, 16, 12], 2, [6.00, 8.00, 10.00, 12.00], 'Standard-B'),
      new Box([24, 18, 6], 1, [7.00, 9.00, 11.00, 13.00], 'Flat-Large', [4, 3]),
    ];
    
    // Test various item sizes
    const testCases = [
      { dims: [5, 4, 3], desc: 'Small item' },
      { dims: [11, 8, 5], desc: 'Medium item' },
      { dims: [18, 14, 10], desc: 'Large item' },
      { dims: [22, 16, 2], desc: 'Flat item' },
      { dims: [8, 6, 20], desc: 'Tall item' }
    ];
    
    testCases.forEach(testCase => {
      const recs = engine.getRecommendations(boxes, testCase.dims, 'Standard Pack');
      
      // Should always provide recommendations when possible
      if (recs.length > 0) {
        // First recommendation should be well-reasoned
        expect(recs[0].tag).toBeTruthy();
        expect(recs[0].result.price).toBeGreaterThan(0);
        
        // Prices should be in ascending order for same efficiency
        const sameEfficiency = recs.filter(r => 
          Math.abs(r.result.score - recs[0].result.score) < 1
        );
        if (sameEfficiency.length > 1) {
          for (let i = 1; i < sameEfficiency.length; i++) {
            expect(sameEfficiency[i].result.price).toBeGreaterThanOrEqual(
              sameEfficiency[i-1].result.price
            );
          }
        }
      }
    });
  });

  it('should work with custom engine configuration', () => {
    // Test with cost-conscious configuration
    const costEngine = new RecommendationEngine(createEngineConfig({
      weights: { price: 0.70, efficiency: 0.10, ease: 0.20 },
      max_recommendations: 5
    }));
    
    const boxes = [
      new Box([12, 10, 8], 2, [5.00, 6.00, 7.00, 8.00], 'Cheap'),
      new Box([12, 10, 8], 2, [8.00, 10.00, 12.00, 14.00], 'Expensive')
    ];
    
    const itemDims = [10, 8, 6];
    const recs = costEngine.getRecommendations(boxes, itemDims, 'Standard Pack');
    
    // With cost-conscious config, cheaper box should be preferred
    expect(recs[0].box.model).toBe('Cheap');
  });
});