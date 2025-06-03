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

describe('RecommendationEngine Edge Cases', () => {
  describe('configuration edge cases', () => {
    it('should throw with missing weights', () => {
      expect(() => new RecommendationEngine({
        strategy_preferences: { normal: 0 }
      })).toThrow('RecommendationEngine requires complete configuration');
    });

    it('should throw with missing strategy_preferences', () => {
      expect(() => new RecommendationEngine({
        weights: { price: 0.5, efficiency: 0.3, ease: 0.2 }
      })).toThrow('RecommendationEngine requires complete configuration');
    });

    it('should handle extreme weight values', () => {
      const engine = new RecommendationEngine({
        weights: { price: 1.0, efficiency: 0.0, ease: 0.0 }, // Only care about price
        strategy_preferences: { normal: 0, manual_cut: 10 },
        extreme_cut_threshold: 0.5
      });
      
      expect(engine.weights.price).toBe(1.0);
      expect(engine.weights.efficiency).toBe(0.0);
    });

    it('should handle negative weight values', () => {
      // This tests robustness - negative weights shouldn't normally be used
      const engine = new RecommendationEngine({
        weights: { price: -0.5, efficiency: 0.8, ease: 0.7 },
        strategy_preferences: { normal: 0 },
        extreme_cut_threshold: 0.5
      });
      
      expect(engine.weights.price).toBe(-0.5);
    });
  });

  describe('getStrategyPenalty edge cases', () => {
    let engine;
    
    beforeEach(() => {
      engine = new RecommendationEngine({
        weights: { price: 0.4, efficiency: 0.3, ease: 0.3 },
        strategy_preferences: {
          normal: 0,
          prescored: 2,
          manual_cut: 5
        },
        extreme_cut_threshold: 0.5
      });
    });

    it('should handle unknown strategy names', () => {
      const penalty = engine.getStrategyPenalty('Unknown Strategy', {});
      expect(penalty).toBe(0.5); // Should default to manual_cut value
    });

    it('should handle missing strategy in preferences', () => {
      const penalty = engine.getStrategyPenalty('Telescoping', {});
      expect(penalty).toBe(0.5); // Should use fallback value of 5/10
    });

    it('should handle strategy preference of 10', () => {
      engine.strategyPreferences.manual_cut = 10;
      const penalty = engine.getStrategyPenalty('Cut Down', { isPreScored: false });
      expect(penalty).toBe(1.0); // 10/10 = 1.0
    });

    it('should handle strategy preference of 0', () => {
      const penalty = engine.getStrategyPenalty('Normal', {});
      expect(penalty).toBe(0); // 0/10 = 0
    });
  });

  describe('generateAllStrategies edge cases', () => {
    let engine;
    
    beforeEach(() => {
      engine = new RecommendationEngine({
        weights: { price: 0.4, efficiency: 0.3, ease: 0.3 },
        strategy_preferences: { normal: 0, prescored: 1, manual_cut: 5 },
        extreme_cut_threshold: 0.5
      });
    });

    it('should handle empty box array', () => {
      const strategies = engine.generateAllStrategies([], [10, 10, 10], 'Standard Pack');
      expect(strategies).toEqual([]);
    });

    it('should filter extreme cuts at threshold boundary', () => {
      const box = createTestBox([20, 15, 10], 2, [5, 6, 7, 8], 'TestBox', null, Box);
      
      // Item that would require cutting to exactly 50% (threshold)
      const itemDims = [18, 13, 5];
      
      const strategies = engine.generateAllStrategies([box], itemDims, 'No Pack');
      const cutStrategies = strategies.filter(s => 
        s.result.strategy === 'Cut Down' && !s.isAlternateDepth
      );
      
      // Should include cuts at exactly 50%
      expect(cutStrategies.some(s => s.cutDepth === 5)).toBe(true);
      
      // Now test just below threshold (49%)
      const itemDims2 = [18, 13, 4.9]; // Would need to cut to 4.9 = 49% of 10
      engine.extremeCutThreshold = 0.5; // Reset to 50%
      const strategies2 = engine.generateAllStrategies([box], itemDims2, 'No Pack');
      const cutStrategies2 = strategies2.filter(s => 
        s.result.strategy === 'Cut Down' && !s.isAlternateDepth
      );
      
      // Should NOT include cuts below 50% threshold
      expect(cutStrategies2.length).toBe(0);
    });

    it('should handle boxes with no fitting strategies', () => {
      const box = createTestBox([5, 4, 3], 2, [5, 6, 7, 8], 'TinyBox', null, Box);
      const itemDims = [10, 10, 10]; // Too big for box
      
      const strategies = engine.generateAllStrategies([box], itemDims, 'Standard Pack');
      expect(strategies).toEqual([]); // No strategies should fit
    });

    it('should handle result without isPreScored property', () => {
      const box = createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box);
      const strategies = engine.generateAllStrategies([box], [10, 8, 6], 'No Pack');
      
      // Normal strategies don't have isPreScored
      const normalStrategies = strategies.filter(s => s.result.strategy === 'Normal');
      expect(normalStrategies.length).toBeGreaterThan(0);
      expect(normalStrategies[0].isAlternateDepth).toBe(false);
    });
  });

  describe('calculateScores edge cases', () => {
    let engine;
    
    beforeEach(() => {
      engine = new RecommendationEngine({
        weights: { price: 0.4, efficiency: 0.3, ease: 0.3 },
        strategy_preferences: { normal: 0 },
        extreme_cut_threshold: 0.5
      });
    });

    it('should handle empty results array', () => {
      const result = engine.calculateScores([]);
      expect(result).toEqual([]);
    });

    it('should handle single result', () => {
      const mockResult = {
        box: createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box),
        result: { score: 100, price: 10, strategy: 'Normal' },
        strategyPenalty: 0
      };
      
      const { results, stats } = engine.calculateScores([mockResult]);
      
      expect(results.length).toBe(1);
      expect(results[0].normalizedScore).toBe(0); // Single value normalizes to 0
      expect(results[0].normalizedPrice).toBe(0); // Single value normalizes to 0
      expect(stats.minScore).toBe(100);
      expect(stats.maxScore).toBe(100);
    });

    it('should handle all results with same score', () => {
      const mockResults = [
        {
          box: createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box),
          result: { score: 50, price: 10, strategy: 'Normal' },
          strategyPenalty: 0
        },
        {
          box: createTestBox([22, 16, 12], 2, [6, 7, 8, 9], null, null, Box),
          result: { score: 50, price: 15, strategy: 'Normal' },
          strategyPenalty: 0
        }
      ];
      
      const { results } = engine.calculateScores(mockResults);
      
      // All scores are same, so normalized scores should be 0
      expect(results[0].normalizedScore).toBe(0);
      expect(results[1].normalizedScore).toBe(0);
      
      // Prices are different, so should normalize properly
      expect(results[0].normalizedPrice).toBe(0); // Lowest price
      expect(results[1].normalizedPrice).toBe(1); // Highest price
    });

    it('should handle all results with same price', () => {
      const mockResults = [
        {
          box: createTestBox([20, 15, 10], 2, [5, 5, 5, 5], null, null, Box),
          result: { score: 50, price: 5, strategy: 'Normal' },
          strategyPenalty: 0
        },
        {
          box: createTestBox([22, 16, 12], 2, [5, 5, 5, 5], null, null, Box),
          result: { score: 100, price: 5, strategy: 'Normal' },
          strategyPenalty: 0
        }
      ];
      
      const { results } = engine.calculateScores(mockResults);
      
      // All prices are same, so normalized prices should be 0
      expect(results[0].normalizedPrice).toBe(0);
      expect(results[1].normalizedPrice).toBe(0);
      
      // Scores are different
      expect(results[0].normalizedScore).toBe(0); // Better score
      expect(results[1].normalizedScore).toBe(1); // Worse score
    });

    it('should calculate efficiency threshold correctly', () => {
      const mockResults = [
        { box: null, result: { score: 10, price: 5 }, strategyPenalty: 0 },
        { box: null, result: { score: 20, price: 5 }, strategyPenalty: 0 },
        { box: null, result: { score: 30, price: 5 }, strategyPenalty: 0 },
        { box: null, result: { score: 40, price: 5 }, strategyPenalty: 0 }
      ];
      
      const { results, stats } = engine.calculateScores(mockResults);
      
      // Mean = (10+20+30+40)/4 = 25
      // StdDev = sqrt(((15^2)+(5^2)+(5^2)+(15^2))/4) = sqrt(500/4) = 11.18
      // Threshold = 25 + 11.18 = 36.18
      
      expect(stats.meanScore).toBe(25);
      expect(stats.stdDev).toBeCloseTo(11.18, 1);
      
      // First three should be reasonably efficient
      expect(results[0].isReasonablyEfficient).toBe(true);
      expect(results[1].isReasonablyEfficient).toBe(true);
      expect(results[2].isReasonablyEfficient).toBe(true);
      expect(results[3].isReasonablyEfficient).toBe(false); // 40 > 36.18
    });
  });

  describe('rankResults edge cases', () => {
    let engine;
    
    beforeEach(() => {
      engine = new RecommendationEngine({
        weights: { price: 0.4, efficiency: 0.3, ease: 0.3 },
        strategy_preferences: { normal: 0 },
        extreme_cut_threshold: 0.5,
        max_recommendations: 3
      });
    });

    it('should limit results to max_recommendations', () => {
      const mockResults = Array(10).fill(null).map((_, i) => ({
        box: createTestBox([20, 15, 10], 2, [5+i, 6+i, 7+i, 8+i], `Box${i}`, null, Box),
        result: { 
          score: 50 + i, 
          price: 5 + i, 
          strategy: 'Normal',
          comment: ''
        },
        strategyPenalty: 0,
        normalizedScore: i / 9,
        normalizedPrice: i / 9,
        isReasonablyEfficient: true
      }));
      
      const stats = { 
        minPrice: 5, 
        maxPrice: 14, 
        minScore: 50, 
        maxScore: 59 
      };
      
      const ranked = engine.rankResults(mockResults, stats);
      expect(ranked.length).toBe(3);
    });

    it('should add multiple tags when applicable', () => {
      const mockResults = [
        {
          box: createTestBox([20, 15, 10], 2, [5, 6, 7, 8], 'CheapTight', null, Box),
          result: { 
            score: 10, // Lowest score
            price: 5,   // Lowest price
            strategy: 'Normal',
            comment: '',
            recomendationLevel: 'fits'
          },
          strategyPenalty: 0,
          normalizedScore: 0,
          normalizedPrice: 0,
          isReasonablyEfficient: true
        }
      ];
      
      const stats = { 
        minPrice: 5, 
        maxPrice: 10, 
        minScore: 10, 
        maxScore: 50 
      };
      
      const ranked = engine.rankResults(mockResults, stats);
      
      // Should have both "No Modifications" and special tags
      expect(ranked[0].tag).toContain('Lowest Price');
      expect(ranked[0].tag).toContain('Tightest Fit');
      expect(ranked[0].tagClass).toBe('lowest-cost'); // Price takes precedence
    });

    it('should handle empty stats gracefully', () => {
      const mockResults = [{
        box: createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box),
        result: { 
          score: 50, 
          price: 10, 
          strategy: 'Cut Down',
          comment: 'Pre-scored cut to: [20, 15, 6]',
          isPreScored: true
        },
        isAlternateDepth: true,
        cutDepth: 6,
        strategyPenalty: 0.1,
        normalizedScore: 0.5,
        normalizedPrice: 0.5,
        isReasonablyEfficient: true
      }];
      
      const stats = {}; // Empty stats
      
      const ranked = engine.rankResults(mockResults, stats);
      expect(ranked.length).toBe(1);
      expect(ranked[0].tag).toContain('Pre-Scored Cut');
      expect(ranked[0].reason).toContain('6"');
    });

    it('should extract box count from telescoping comment', () => {
      const mockResults = [{
        box: createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box),
        result: { 
          score: 100, 
          price: 15, 
          strategy: 'Telescoping',
          comment: 'Expected dims: [40, 15, 10] with 3 boxes'
        },
        strategyPenalty: 0.6,
        normalizedScore: 0.5,
        normalizedPrice: 0.5
      }];
      
      const stats = { minPrice: 10, maxPrice: 20, minScore: 50, maxScore: 150 };
      
      const ranked = engine.rankResults(mockResults, stats);
      expect(ranked[0].reason).toBe('Uses 3 boxes');
    });

    it('should handle malformed telescoping comment', () => {
      const mockResults = [{
        box: createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box),
        result: { 
          score: 100, 
          price: 15, 
          strategy: 'Telescoping',
          comment: 'Malformed comment without box count'
        },
        strategyPenalty: 0.6,
        normalizedScore: 0.5,
        normalizedPrice: 0.5
      }];
      
      const stats = { minPrice: 10, maxPrice: 20, minScore: 50, maxScore: 150 };
      
      const ranked = engine.rankResults(mockResults, stats);
      expect(ranked[0].tag).toBe('Multiple Boxes');
      expect(ranked[0].reason).toBe(''); // No box count to extract
    });
  });

  describe('composite scoring edge cases', () => {
    it('should handle zero weights', () => {
      const engine = new RecommendationEngine({
        weights: { price: 0, efficiency: 0, ease: 1.0 }, // Only care about ease
        strategy_preferences: { 
          normal: 0,      // Best
          prescored: 2,   // Good
          manual_cut: 10  // Worst
        },
        extreme_cut_threshold: 0.5
      });
      
      const boxes = [
        createTestBox([20, 15, 10], 2, [10, 12, 14, 16], 'Box1', null, Box),
        createTestBox([20, 15, 10], 2, [5, 6, 7, 8], 'Box2', null, Box)
      ];
      
      const recommendations = engine.getRecommendations(boxes, [15, 12, 8], 'Standard Pack');
      
      // Should prefer normal strategy regardless of price
      const normalStrategies = recommendations.filter(r => r.result.strategy === 'Normal');
      expect(normalStrategies.length).toBeGreaterThan(0);
      expect(recommendations[0].result.strategy).toBe('Normal'); // Should be first
    });

    it('should handle weights summing to more than 1', () => {
      const engine = new RecommendationEngine({
        weights: { price: 0.6, efficiency: 0.5, ease: 0.4 }, // Sum = 1.5
        strategy_preferences: { normal: 0 },
        extreme_cut_threshold: 0.5
      });
      
      const boxes = [createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box)];
      const recommendations = engine.getRecommendations(boxes, [15, 12, 8], 'Standard Pack');
      
      // Should still work, just with higher composite scores
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getRecommendations integration edge cases', () => {
    let engine;
    
    beforeEach(() => {
      engine = new RecommendationEngine({
        weights: { price: 0.4, efficiency: 0.3, ease: 0.3 },
        strategy_preferences: { 
          normal: 0,
          prescored: 1,
          manual_cut: 5,
          flattened: 2,
          telescoping: 6,
          cheating: 8
        },
        extreme_cut_threshold: 0.5,
        max_recommendations: 5
      });
    });

    it('should handle item exactly matching box dimensions', () => {
      const box = createTestBox([20, 15, 10], 2, [5, 6, 7, 8], 'PerfectFit', null, Box);
      const recommendations = engine.getRecommendations([box], [20, 15, 10], 'No Pack');
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].result.score).toBe(0); // Perfect fit
    });

    it('should handle very small items in large boxes', () => {
      const boxes = [
        createTestBox([100, 80, 60], 2, [20, 25, 30, 35], 'Huge', null, Box),
        createTestBox([20, 15, 10], 2, [5, 6, 7, 8], 'Normal', null, Box)
      ];
      
      const recommendations = engine.getRecommendations(boxes, [2, 2, 2], 'Standard Pack');
      
      // Should prefer smaller box despite both fitting
      expect(recommendations[0].box.model).toBe('Normal');
    });

    it('should handle packing level with extreme padding requirements', () => {
      const box = createTestBox([20, 15, 10], 2, [5, 6, 7, 8], null, null, Box);
      box.updatePackingOffsets({ 'Custom Pack': 15 }); // Ridiculous padding
      
      const recommendations = engine.getRecommendations([box], [4, 3, 2], 'Custom Pack');
      
      // No strategies should work with 15" padding in a 10" dimension
      expect(recommendations.length).toBe(0);
    });

    it('should handle boxes with identical dimensions but different prices', () => {
      const boxes = [
        createTestBox([20, 15, 10], 2, [10, 12, 14, 16], 'Expensive', null, Box),
        createTestBox([20, 15, 10], 2, [5, 6, 7, 8], 'Cheap', null, Box)
      ];
      
      const recommendations = engine.getRecommendations(boxes, [15, 12, 8], 'Standard Pack');
      
      // Should have recommendations from both boxes
      const models = new Set(recommendations.map(r => r.box.model));
      expect(models.size).toBe(2);
      
      // Cheaper box should generally rank higher
      const cheapIndex = recommendations.findIndex(r => r.box.model === 'Cheap');
      const expensiveIndex = recommendations.findIndex(r => r.box.model === 'Expensive');
      expect(cheapIndex).toBeLessThan(expensiveIndex);
    });

    it('should handle extreme aspect ratio items', () => {
      const boxes = [
        createTestBox([100, 10, 5], 2, [15, 18, 21, 24], 'Long', null, Box),
        createTestBox([50, 50, 50], 2, [20, 25, 30, 35], 'Cube', null, Box)
      ];
      
      // Very long thin item
      const recommendations = engine.getRecommendations(boxes, [90, 2, 2], 'No Pack');
      
      expect(recommendations.length).toBeGreaterThan(0);
      // Long box should be recommended for long item
      expect(recommendations.some(r => r.box.model === 'Long')).toBe(true);
    });

    it('should handle when only one strategy works', () => {
      const box = createTestBox([20, 20, 1], 2, [5, 6, 7, 8], 'UltraFlat', null, Box);
      
      // Item that only fits when box is flattened
      const recommendations = engine.getRecommendations([box], [25, 25, 0.5], 'No Pack');
      
      if (recommendations.length > 0) {
        // Should only have flattened strategy
        const strategies = new Set(recommendations.map(r => r.result.strategy));
        expect(strategies.size).toBe(1);
        expect(strategies.has('Flattened')).toBe(true);
      }
    });
  });
});