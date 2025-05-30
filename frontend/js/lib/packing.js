/**
 * Core packing algorithms and box manipulation functionality
 */

// NOTE: When served as a script, itemizedToStandard is available globally from pricing.js

/**
 * Represents the result of a box calculation with specific parameters
 */
class BoxResult {
    constructor(dimensions, packLevel, price, recomendationLevel, comment, score, strategy) {
        this.dimensions = dimensions;    // Box dims
        this.packLevel = packLevel;      // Packing level
        this.price = price;              // Selection price
        this.recomendationLevel = recomendationLevel;    // fits vs possible vs no space vs impossible
        this.comment = comment;          // Might be needed to explain the status?
        this.score = score;              // How good is the fit?
        this.strategy = strategy;        // What packing strategy was used?
    }
}

/**
 * Core Box class for all box-related operations and calculations
 */
class Box {
    constructor(dimensions, open_dim, prices, model = null, alternateDepths = null) {
        // dimensions: [int, int, int] -> What are the dimensions of the box
        // open_dim: int -> Along which dimension does the box open (for tele)
        // prices: [np_float, sp_float, fp_float, cp_float] -> price for each packing level OR itemized-prices object
        // model: string -> Model name/identifier for the box
        // alternateDepths: array -> Pre-scored alternate depths available
        this.originalDimensions = [...dimensions]; // Store original order
        const open_dim_val = dimensions[open_dim];
        this.dimensions = dimensions.toSorted((a, b) => b - a);     // Just to presort by size
        // Find where the open dimension ended up after sorting
        this.open_dim = this.dimensions.indexOf(open_dim_val);
        // Handle case where multiple dimensions have the same value
        if (this.open_dim === -1 || dimensions.filter(d => d === open_dim_val).length > 1) {
            // If dimensions are not unique, we need to track more carefully
            const dimWithIndex = dimensions.map((d, i) => ({value: d, originalIndex: i}));
            dimWithIndex.sort((a, b) => b.value - a.value);
            this.open_dim = dimWithIndex.findIndex(d => d.originalIndex === open_dim);
        }
        this.model = model;
        this.alternateDepths = alternateDepths || [];
        
        // Handle both standard and itemized pricing
        this.itemizedPrices = null; // Store original itemized pricing if available
        
        if (Array.isArray(prices)) {
            // Standard pricing - array of 4 values
            this.prices = prices;
        } else if (prices && prices['itemized-prices']) {
            // Itemized pricing - convert to standard format for compatibility
            this.itemizedPrices = prices['itemized-prices'];
            this.prices = this.convertItemizedToStandard(prices['itemized-prices']);
        } else if (prices && typeof prices === 'object') {
            // Direct itemized prices object
            this.itemizedPrices = prices;
            this.prices = this.convertItemizedToStandard(prices);
        } else {
            // Fallback to zeros if no pricing info
            this.prices = [0, 0, 0, 0];
        }
        
        this.packingLevelNames = ["No Pack", "Standard Pack", "Fragile Pack", "Custom Pack"];
        this.altPackingNames = ["Normal", "Telescoping", "Cheating", "Flattened"];
        // Packing offsets - must be loaded dynamically via API
        this.packingOffsets = {
            "No Pack": 0,
            "Standard Pack": 0,
            "Fragile Pack": 0,
            "Custom Pack": 0
        };
        
        // Initialize box properties
        this.initializeBoxProperties();
    }
    
    // Update packing offsets with dynamic values
    updatePackingOffsets(offsets) {
        if (offsets) {
            this.packingOffsets = { ...this.packingOffsets, ...offsets };
        }
    }
    
    // Convert itemized pricing to standard pricing array
    convertItemizedToStandard(itemizedPrices) {
        // Use the itemizedToStandard function from pricing.js if available
        if (typeof itemizedToStandard === 'function') {
            return itemizedToStandard(itemizedPrices);
        }
        
        // Standard conversion implementation
        const boxPrice = itemizedPrices['box-price'] || 0;
        const basicMaterials = itemizedPrices['basic-materials'] || 0;
        const basicServices = itemizedPrices['basic-services'] || 0;
        const standardMaterials = itemizedPrices['standard-materials'] || 0;
        const standardServices = itemizedPrices['standard-services'] || 0;
        const fragileMaterials = itemizedPrices['fragile-materials'] || 0;
        const fragileServices = itemizedPrices['fragile-services'] || 0;
        const customMaterials = itemizedPrices['custom-materials'] || 0;
        const customServices = itemizedPrices['custom-services'] || 0;
        
        return [
            boxPrice + basicMaterials + basicServices,      // Basic (No Pack)
            boxPrice + standardMaterials + standardServices, // Standard Pack
            boxPrice + fragileMaterials + fragileServices,   // Fragile Pack
            boxPrice + customMaterials + customServices      // Custom Pack
        ];
    }

    initializeBoxProperties() {
        this.openLength = this.dimensions[this.open_dim];
        if (this.open_dim == 0) {
            this.largerConstraint = this.dimensions[1];
            this.smallerConstraint = this.dimensions[2];
        } else if (this.open_dim == 1) {
            this.largerConstraint = this.dimensions[0];
            this.smallerConstraint = this.dimensions[2];
        } else {
            this.largerConstraint = this.dimensions[0];
            this.smallerConstraint = this.dimensions[1];
        }
        this.flapLength = this.smallerConstraint / 2;

        // Debug flags - disabled by default
        this.debug = false;
        this.debugState = null;
    }

    static NormalBox(dimensions, prices, model = null, alternateDepths = null) {
        // Assumes the last dimension is the open dimension
        return new Box(dimensions, 2, prices, model, alternateDepths);
    }

    pushDebug(val) {
        this.debugState = this.debug;
        this.debug = val;
    }

    popDebug() {
        this.debug = this.debugState;
        this.debugState = null;
    }

    boxSpace(boxDims, itemDims) {
        // itemDims: [x, y, z] -> dimensions of the item to be packed
        // How much space between box and item(s) based on passed dimensions
        return [boxDims[0] - itemDims[0], boxDims[1] - itemDims[1], boxDims[2] - itemDims[2]];
    }

    calcScore(extraSpace) {
        // space: [x, y, z] -> space in each dimension in the box
        // expected space: int -> how much space each dimension should have
        return extraSpace[0] ** 2 + extraSpace[1] ** 2 + extraSpace[2] ** 2;
    }

    getPrice(packingLevel) {
        // packingLevel: str -> packing level to be used
        // returns: float -> price of the box
        return this.prices[this.packingLevelNames.findIndex(e => e == packingLevel)];
    }

    // Return the verdict on whether what the calculated offsets are in terms of feasibility
    // offsets: [x, y, z] -> space in each dimension in the box
    // packingLevel: str -> packing level to be used
    // returns: str -> "impossible", "no space", "possible", "fits"
    calcRecomendation(offsets, packingLevel) {
        const lowestDim = Math.min(...offsets);
        if (lowestDim < 0) {
            return "impossible";
        } else if (lowestDim == 0 && packingLevel != "No Pack") {
            return "no space";
        } else if (lowestDim > 0 && lowestDim < this.packingOffsets[packingLevel]) {
            return "possible";
        }
        return "fits";
    }

    gen_normalBoxResults(packingLevel, inputDimsSorted) {
        // Handle normal boxes
        const offsetSpace = this.boxSpace(this.dimensions, inputDimsSorted);
        return new BoxResult(this.dimensions, packingLevel, this.getPrice(packingLevel), 
            this.calcRecomendation(offsetSpace, packingLevel), "", this.calcScore(offsetSpace), "Normal");
    }

    gen_cutDownBoxResults(packingLevel, inputDimsSorted) {
        // Handle cut down boxes
        let bestScore = 1000000;
        let bestResult = null;
        for (const openInputIndex of [0, 1, 2]) {
            const largerInput = Math.max(inputDimsSorted[(openInputIndex + 1) % 3], inputDimsSorted[(openInputIndex + 2) % 3]);
            const smallerInput = Math.min(inputDimsSorted[(openInputIndex + 1) % 3], inputDimsSorted[(openInputIndex + 2) % 3]);
            
            // Calculate minimum required depth
            const minRequiredDepth = inputDimsSorted[openInputIndex] + this.packingOffsets[packingLevel];
            
            // First check if any alternate depths work (for pre-scored cuts)
            let bestAlternateDepth = null;
            if (this.alternateDepths && this.alternateDepths.length > 0) {
                // Sort alternate depths from smallest to largest and find the smallest that fits
                const sortedAltDepths = [...this.alternateDepths].sort((a, b) => a - b);
                for (const altDepth of sortedAltDepths) {
                    if (altDepth >= minRequiredDepth) {
                        bestAlternateDepth = altDepth;
                        break;
                    }
                }
            }
            
            // Use alternate depth if available, otherwise calculate manual cut
            const cutDepth = bestAlternateDepth || Math.min(this.openLength, minRequiredDepth);
            
            const testOffset = [
                this.largerConstraint - largerInput,
                this.smallerConstraint - smallerInput,
                cutDepth - inputDimsSorted[openInputIndex]
            ];
            const score = this.calcScore(testOffset);
            if (score < bestScore) {
                bestScore = score;
                const comment = bestAlternateDepth 
                    ? `Pre-scored cut to: [${this.largerConstraint}, ${this.smallerConstraint}, ${cutDepth}]`
                    : `Expected dims: [${this.largerConstraint}, ${this.smallerConstraint}, ${cutDepth}]`;
                bestResult = new BoxResult(this.dimensions, packingLevel, this.getPrice(packingLevel), 
                    this.calcRecomendation(testOffset, packingLevel), comment, score, "Cut Down");
                // Store whether this is a pre-scored cut for later use
                bestResult.isPreScored = bestAlternateDepth !== null;
                bestResult.cutDepth = cutDepth;
            }
        }
        return bestResult;
    }

    nextLevel(packingLevel) {
        const index = this.packingLevelNames.findIndex(e => e == packingLevel);
        return this.packingLevelNames[Math.min(index + 1, this.packingLevelNames.length - 1)];
    }

    gen_telescopingBoxResults(packingLevel, inputDimsSorted) {
        // Handle Telescoping boxes
        const minLength = inputDimsSorted[0] + this.packingOffsets[packingLevel];
        const largerOffset = this.largerConstraint - inputDimsSorted[1];
        const smallerOffset = this.smallerConstraint - inputDimsSorted[2];
        const score = this.calcScore([largerOffset, smallerOffset, 0]);
        const endBoxLength = this.openLength + this.flapLength;
        const centerBoxLength = endBoxLength + this.flapLength;
        const centerRemaining = minLength - 2 * endBoxLength;
        let centerBoxes = 0;
        if (centerRemaining > 0) {
            centerBoxes = Math.ceil(centerRemaining / centerBoxLength);
        }
        const totalBoxes = 2 + centerBoxes;
        // TODO one box should be next level
        const totalCost = this.getPrice(packingLevel) * (totalBoxes - 1) + this.getPrice(this.nextLevel(packingLevel));
        return new BoxResult(this.dimensions, packingLevel,
            totalCost, this.calcRecomendation([largerOffset, smallerOffset, this.packingOffsets[packingLevel]], packingLevel),
            `Expected dims: [${minLength}, ${this.largerConstraint}, ${this.smallerConstraint}] with ${totalBoxes} boxes`, score, "Telescoping");
    }

    gen_cheatingBoxResults(packingLevel, inputDimsSorted) {
        function calcRotatedSize(outerHight, outerWidth, innerHight, innerWidth) {
            const angle = Math.atan(outerWidth / outerHight);
            // Not sure if the angle is correct or needs to be inverted
            // I think there is an assumption that the height is the larger dimension
            const rotatedHight = Math.sin(angle) * innerWidth + Math.cos(angle) * innerHight;
            const rotatedWidth = Math.cos(angle) * innerWidth + Math.sin(angle) * innerHight;
            return [rotatedHight, rotatedWidth];
        }

        // Handle cheating boxes
        let bestScore = 1000000;
        let bestResult = null;
        for (const normalIndex of [0, 1, 2]) {
            const largerDim = Math.max(this.dimensions[(normalIndex + 1) % 3], this.dimensions[(normalIndex + 2) % 3]);
            const smallerDim = Math.min(this.dimensions[(normalIndex + 1) % 3], this.dimensions[(normalIndex + 2) % 3]);
            const largerInput = Math.max(inputDimsSorted[(normalIndex + 1) % 3], inputDimsSorted[(normalIndex + 2) % 3]);
            const smallerInput = Math.min(inputDimsSorted[(normalIndex + 1) % 3], inputDimsSorted[(normalIndex + 2) % 3]);
            const rotatedSize = calcRotatedSize(largerDim, smallerDim, largerInput, smallerInput);
            const newInputDims = [0, 0, 0];
            newInputDims[normalIndex] = inputDimsSorted[normalIndex];
            newInputDims[(normalIndex + 1) % 3] = rotatedSize[0];
            newInputDims[(normalIndex + 2) % 3] = rotatedSize[1];
            const boxOffset = this.boxSpace(this.dimensions, newInputDims);
            const score = this.calcScore(boxOffset);
            if (score < bestScore) {
                bestScore = score;
                bestResult = new BoxResult(this.dimensions, packingLevel, this.getPrice(packingLevel), this.calcRecomendation(boxOffset, packingLevel),
                    `Internal dims: [${newInputDims[0].toFixed(1)}, ${newInputDims[1].toFixed(1)}, ${newInputDims[2].toFixed(1)}]`, score, "Cheating");
            }
        }
        return bestResult;
    }

    gen_flattenedBoxResults(packingLevel, inputDimsSorted) {
        // Handle Flattened boxes
        const flatBoxLength = this.openLength + this.flapLength * 2;
        const flatBoxWidth = this.smallerConstraint + this.largerConstraint;
        const largerOffset = Math.max(flatBoxLength, flatBoxWidth) - inputDimsSorted[0] - this.packingOffsets[packingLevel];
        const smallerOffset = Math.min(flatBoxLength, flatBoxWidth) - inputDimsSorted[1] - this.packingOffsets[packingLevel];
        const heightOffset = 1 - inputDimsSorted[2];
        const offsets = [largerOffset, smallerOffset, heightOffset];
        const recomendation = this.calcRecomendation(offsets, packingLevel) == "impossible" ? "impossible" : "fits";     // If the user wants to see flat, then it should be impossible or not
        return new BoxResult(this.dimensions, packingLevel, this.getPrice(packingLevel), recomendation,
            `Expected dims: [${flatBoxLength}, ${flatBoxWidth}, ${1}]`, this.calcScore(offsets), "Flattened");
    }

    gen_boxResults(inputDimsSorted) {
        // Based on current state
        const result = {};
        for (const packingLevel of this.packingLevelNames) {
            result[packingLevel] = {};

            // TODO Could check for which alt packing strategies are selected and only calculate those
            result[packingLevel]["Normal"] = this.gen_normalBoxResults(packingLevel, inputDimsSorted);
            result[packingLevel]["Cut Down"] = this.gen_cutDownBoxResults(packingLevel, inputDimsSorted);
            result[packingLevel]["Telescoping"] = this.gen_telescopingBoxResults(packingLevel, inputDimsSorted);
            result[packingLevel]["Cheating"] = this.gen_cheatingBoxResults(packingLevel, inputDimsSorted);
            result[packingLevel]["Flattened"] = this.gen_flattenedBoxResults(packingLevel, inputDimsSorted);
        }            

        return result;
    }
}

/**
 * Loads boxes for a specific store from the API
 * @param {string} storeId - The store ID to load boxes for
 * @returns {Promise<Array<Box>>} - A promise that resolves to an array of Box instances
 */
async function loadBoxes(storeId = '1') {
    try {
        // Make sure storeId is a number between 1-9999 or demo store 999999
        if (!/^\d{1,6}$/.test(storeId)) {
            throw new Error(`Invalid store ID: ${storeId}. Must be a number between 1-9999 or 999999 for demo.`);
        }

        const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/boxes`, storeId)
            .catch(networkError => {
                console.error("Network error:", networkError);
                throw new Error(`Network error: ${networkError.message}. Make sure the server is running.`);
            });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server responded with status ${response.status}:`, errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const boxes = [];

        if (data.boxes && Array.isArray(data.boxes)) {
            data.boxes.forEach(boxData => {
                let box;

                let pricingData;
                
                // Handle different pricing structures
                if (boxData.prices) {
                    pricingData = boxData.prices;
                } else if (boxData['itemized-prices']) {
                    pricingData = { 'itemized-prices': boxData['itemized-prices'] };
                } else {
                    // Use default pricing when no pricing data is provided
                    pricingData = [0, 0, 0, 0]; // Default to zeros
                }
                
                if (boxData.type === 'NormalBox') {
                    box = Box.NormalBox(boxData.dimensions, pricingData, boxData.model, boxData.alternate_depths);
                } else if (boxData.type === 'CustomBox') {
                    box = new Box(boxData.dimensions, boxData.open_dim || 2, pricingData, boxData.model, boxData.alternate_depths);
                } else {
                    // Skip unknown box types
                    return;
                }
                
                // Add location if available
                if (boxData.location) {
                    box.location = boxData.location;
                }

                boxes.push(box);
            });
        } else {
            console.error("Invalid data format received from server");
            throw new Error("Invalid box data format from server");
        }

        // Always load dynamic padding
        if (typeof PackingRulesManager !== 'undefined') {
            const rulesManager = new PackingRulesManager(storeId);
            
            // Get padding for each packing type
            const packingTypes = ['Basic', 'Standard', 'Fragile', 'Custom'];
            const packingOffsets = {};
            
            for (const type of packingTypes) {
                try {
                    const padding = await rulesManager.getPaddingInches(type);
                    // Map from new names to old names used in Box class
                    const mappedName = type === 'Basic' ? 'No Pack' : `${type} Pack`;
                    packingOffsets[mappedName] = padding * 2; // Convert inches per side to total offset
                } catch (error) {
                    console.warn(`Could not load padding for ${type}, using defaults`, error);
                }
            }
            
            // Update all boxes with dynamic offsets
            boxes.forEach(box => {
                box.updatePackingOffsets(packingOffsets);
            });
        }

        return boxes;
    } catch (error) {
        console.error("Error loading boxes:", error);
        throw error;
    }
}

// Browser compatibility - export to window object
if (typeof window !== 'undefined') {
    window.Box = Box;
    window.BoxResult = BoxResult;
    window.loadBoxes = loadBoxes;
}

// Export the classes and functions for ES6 modules (when loaded as module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Box,
        BoxResult,
        loadBoxes
    };
}