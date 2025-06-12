/**
 * Packing Rules Manager
 * 
 * Handles fetching and caching of store-specific packing rules
 * Falls back to defaults when custom rules aren't defined
 */

class PackingRulesManager {
    constructor(storeId) {
        this.storeId = storeId;
        this.cache = null;
        this.cacheExpiry = null;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        this.pendingRequest = null; // Track in-flight requests
    }


    /**
     * Get all packing requirements, using cache when available
     */
    async getAllRequirements() {
        // Check cache
        if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
            return this.cache;
        }

        // If there's already a pending request, return it to avoid duplicate calls
        if (this.pendingRequest) {
            return this.pendingRequest;
        }

        // Fetch from API
        this.pendingRequest = (async () => {
            try {
                const response = await apiUtils.authenticatedFetch(`/api/store/${this.storeId}/packing-rules`, this.storeId);
                if (!response.ok) {
                    throw new Error(`Failed to fetch packing rules: ${response.statusText}`);
                }

                const data = await response.json();
                
                // Cache the effective rules
                this.cache = data.effective_rules;
                this.cacheExpiry = Date.now() + this.cacheDuration;
                
                return data.effective_rules;
            } catch (error) {
                console.error('Error fetching packing rules:', error);
                // Return default rules on error
                return this.getDefaultRules();
            } finally {
                // Clear pending request
                this.pendingRequest = null;
            }
        })();

        return this.pendingRequest;
    }

    /**
     * Get specific packing requirements for type
     */
    async getRequirements(packingType) {
        try {
            // Use cached data from getAllRequirements
            const allRules = await this.getAllRequirements();
            
            // Find the matching rule
            const rule = allRules.find(r => r.packing_type === packingType);
            
            if (rule) {
                return {
                    padding_inches: rule.padding_inches,
                    wizard_description: rule.wizard_description,
                    label_instructions: rule.label_instructions,
                    is_custom: rule.is_custom || false
                };
            }
            
            // If not found, return default
            return this.getDefaultRequirement(packingType);
        } catch (error) {
            console.error('Error getting specific requirements:', error);
            // Return sensible defaults on error
            return this.getDefaultRequirement(packingType);
        }
    }

    /**
     * Get wizard description for a specific packing type
     */
    async getWizardDescription(packingType) {
        const req = await this.getRequirements(packingType);
        return req.wizard_description;
    }

    /**
     * Get padding inches for a specific packing type
     */
    async getPaddingInches(packingType) {
        const req = await this.getRequirements(packingType);
        return req.padding_inches;
    }

    /**
     * Get label instructions for a specific packing type
     */
    async getLabelInstructions(packingType) {
        const req = await this.getRequirements(packingType);
        return req.label_instructions;
    }

    /**
     * Clear the cache (useful after updates)
     */
    clearCache() {
        this.cache = null;
        this.cacheExpiry = null;
    }

    /**
     * Get default rules (fallback when API is unavailable)
     */
    getDefaultRules() {
        return [
            {
                packing_type: 'Basic',
                padding_inches: 0,
                wizard_description: 'For non-sensitive items like clothing, toys, books',
                label_instructions: '- Inflatable void fill as needed',
                is_custom: false
            },
            {
                packing_type: 'Standard',
                padding_inches: 1,
                wizard_description: 'For electronics, jewelry, and medium-sensitive items',
                label_instructions: '- Two (2) layers of large bubble or inflatable air cushioning\n- Inflatable void fill as needed\n- 1" between item and edge of box',
                is_custom: false
            },
            {
                packing_type: 'Fragile',
                padding_inches: 2,
                wizard_description: 'For china, crystal, art, and sensitive equipment',
                label_instructions: '- One (1) layer of small bubble or foam wrap\n- Two (2) layers of large bubble or inflatable air cushioning\n- Inflatable void fill as needed\n- Corrugated dividers for layering multiple items\n- 2" between item and edge of box',
                is_custom: false
            },
            {
                packing_type: 'Custom',
                padding_inches: 3,
                wizard_description: 'Maximum protection for highly sensitive items',
                label_instructions: '- 1" foam plank on all sides of the box\n- One (1) layer of small bubble or foam wrap\n- Two (2) layers of small bubble or foam wrap\n- Inflatable void fill as needed\n- 3" between item and edge of box',
                is_custom: false
            }
        ];
    }

    /**
     * Get default requirement for specific type (fallback)
     */
    getDefaultRequirement(packingType) {
        const rules = this.getDefaultRules();
        
        // Find matching rule
        const rule = rules.find(r => r.packing_type === packingType);
        
        if (rule) {
            return {
                padding_inches: rule.padding_inches,
                wizard_description: rule.wizard_description,
                label_instructions: rule.label_instructions,
                is_custom: false
            };
        }
        
        // Ultimate fallback
        return {
            padding_inches: 0,
            wizard_description: 'Standard packing',
            label_instructions: '- Pack according to best practices',
            is_custom: false
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PackingRulesManager;
}