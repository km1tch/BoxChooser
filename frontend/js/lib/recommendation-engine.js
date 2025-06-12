/**
 * Recommendation Engine for Box Selection
 * 
 * This module handles the core logic for recommending boxes based on
 * item dimensions, packing level, and various optimization criteria.
 */

class RecommendationEngine {
    constructor(config = {}) {
        // Config is required - no fallbacks
        if (!config.weights || !config.strategy_preferences) {
            throw new Error('RecommendationEngine requires complete configuration');
        }
        
        this.weights = config.weights;
        this.strategyPreferences = config.strategy_preferences;
        this.maxRecommendations = config.max_recommendations || 10;
        this.extremeCutThreshold = config.extreme_cut_threshold;
    }

    /**
     * Get ease score for a packing strategy
     */
    getStrategyPenalty(strategy, result) {
        // Map strategy names to config keys
        const strategyMap = {
            'Normal': 'normal',
            'Cut Down': result.isPreScored ? 'prescored' : 'manual_cut',
            'Flattened': 'flattened',
            'Telescoping': 'telescoping',
            'Cheating': 'cheating'
        };
        
        const configKey = strategyMap[strategy] || 'manual_cut';
        const preference = this.strategyPreferences[configKey] !== undefined 
            ? this.strategyPreferences[configKey] 
            : 5;
        
        // Convert preference (0-10, lower=better) to penalty (0-1, higher=worse)
        return preference / 10;
    }

    /**
     * Generate all possible strategies for given boxes and item
     */
    generateAllStrategies(boxes, itemDims, packingLevel) {
        const results = [];
        
        boxes.forEach(box => {
            const boxResults = box.gen_boxResults(itemDims);
            
            ['Normal', 'Cut Down', 'Telescoping', 'Cheating', 'Flattened'].forEach(strategy => {
                const result = boxResults[packingLevel][strategy];
                if (result.recomendationLevel === 'fits') {
                    // Filter out absurd manual cuts
                    if (strategy === 'Cut Down' && !result.isPreScored) {
                        // Skip cuts that remove more than threshold of the box
                        const originalDepth = Math.min(...box.dimensions);
                        const cutRatio = result.cutDepth / originalDepth;
                        if (cutRatio < this.extremeCutThreshold) {
                            return; // Skip this extreme cut
                        }
                    }
                    
                    results.push({
                        box: box,
                        result: result,
                        isAlternateDepth: result.isPreScored || false,
                        cutDepth: result.cutDepth,
                        strategyPenalty: this.getStrategyPenalty(strategy, result),
                        normalizedScore: null, // Will calculate after
                        normalizedPrice: null
                    });
                }
            });
        });
        
        return results;
    }

    /**
     * Calculate statistics and normalize scores
     */
    calculateScores(results) {
        if (results.length === 0) return results;
        
        // Calculate statistics
        const scores = results.map(r => r.result.score);
        const prices = results.map(r => r.result.price);
        
        const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const stdDev = Math.sqrt(scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length);
        const efficiencyThreshold = meanScore + stdDev;
        
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        // Add normalized values and flags
        results.forEach(r => {
            r.normalizedScore = maxScore > minScore ? (r.result.score - minScore) / (maxScore - minScore) : 0;
            r.normalizedPrice = maxPrice > minPrice ? (r.result.price - minPrice) / (maxPrice - minPrice) : 0;
            r.isReasonablyEfficient = r.result.score <= efficiencyThreshold;
        });
        
        return { results, stats: { meanScore, stdDev, minScore, maxScore, minPrice, maxPrice } };
    }

    /**
     * Rank results using simplified composite scoring
     */
    rankResults(results, stats) {
        // Calculate composite scores for all results
        results.forEach(r => {
            r.compositeScore = this.weights.price * r.normalizedPrice + 
                              this.weights.efficiency * r.normalizedScore + 
                              this.weights.ease * r.strategyPenalty;
        });
        
        // Sort by composite score (lower is better)
        const sorted = results.sort((a, b) => a.compositeScore - b.compositeScore);
        
        // Take top N recommendations
        const topResults = sorted.slice(0, this.maxRecommendations);
        
        // Add descriptive tags
        return topResults.map(result => this.addDescriptiveTag(result, sorted, stats));
    }
    
    /**
     * Add descriptive tag based on characteristics
     */
    addDescriptiveTag(result, allResults, stats) {
        let tag = '';
        let tagClass = 'default';
        let reason = '';
        
        // Strategy-based tags
        switch(result.result.strategy) {
            case 'Normal':
                tag = 'No Modifications';
                tagClass = 'standard';
                reason = 'Standard box, no modifications needed';
                break;
            case 'Cut Down':
                if (result.isAlternateDepth) {
                    tag = 'Pre-Scored Cut';
                    tagClass = 'pre-scored';
                    reason = `Pre-marked at ${result.cutDepth}" depth`;
                } else {
                    tag = 'Manual Cut Required';
                    tagClass = 'manual-cut';
                    reason = `Cut to ${result.cutDepth}" depth`;
                }
                break;
            case 'Telescoping':
                tag = 'Multiple Boxes';
                tagClass = 'multi-box';
                const boxCount = result.result.comment.match(/(\d+) boxes/);
                if (boxCount) {
                    reason = `Uses ${boxCount[1]} boxes`;
                }
                break;
            case 'Cheating':
                tag = 'Diagonal Pack';
                tagClass = 'diagonal';
                reason = 'Item packed diagonally';
                break;
            case 'Flattened':
                tag = 'Flat Pack';
                tagClass = 'flat';
                reason = 'Box laid flat';
                break;
        }
        
        // Check if this is the cheapest option
        if (result.result.price === stats.minPrice) {
            tag += tag ? ' • Lowest Price' : 'Lowest Price';
            tagClass = 'lowest-cost';
        }
        
        // Check if this is the tightest fit
        if (result.result.score === stats.minScore) {
            tag += tag ? ' • Tightest Fit' : 'Tightest Fit';
            if (!tagClass || tagClass === 'default') {
                tagClass = 'efficient';
            }
        }
        
        return {
            ...result,
            tag: tag,
            tagClass: tagClass,
            reason: reason
        };
    }

    /**
     * Main method to get recommendations
     */
    getRecommendations(boxes, itemDims, packingLevel) {
        // Generate all possible strategies
        const allStrategies = this.generateAllStrategies(boxes, itemDims, packingLevel);
        
        if (allStrategies.length === 0) {
            return [];
        }
        
        // Calculate scores and statistics
        const { results, stats } = this.calculateScores(allStrategies);
        
        // Rank by composite score
        return this.rankResults(results, stats);
    }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
} else if (typeof window !== 'undefined') {
    window.RecommendationEngine = RecommendationEngine;
}