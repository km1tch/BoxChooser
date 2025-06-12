/**
 * Pricing utilities for handling both standard and itemized pricing models
 * 
 * This module abstracts away the details of pricing models to provide a consistent
 * interface for the rest of the application.
 */

/**
 * Pricing model enumeration
 */
const PricingMode = {
  STANDARD: 'standard',
  ITEMIZED: 'itemized'
};

/**
 * Packing level indices
 */
const PackingLevelIndex = {
  NO_PACK: 0,
  STANDARD: 1,
  FRAGILE: 2,
  CUSTOM: 3
};

/**
 * Gets total price for a box at a specific packing level using the appropriate pricing model
 * @param {Object} box - The box object
 * @param {string} packingLevel - The packing level name (e.g., "No Pack", "Standard Pack")
 * @returns {number} - The total price
 */
function getTotalPrice(box, packingLevel) {
  const packingLevelIndex = getPackingLevelIndex(packingLevel);
  
  // Handle standard pricing model
  if (box.prices && Array.isArray(box.prices)) {
    return box.prices[packingLevelIndex];
  }
  
  // Handle itemized pricing model
  if (box['itemized-prices']) {
    const itemizedPrices = box['itemized-prices'];
    let total = itemizedPrices['box-price'] || 0;
    
    // Add appropriate materials and services based on packing level
    switch (packingLevelIndex) {
      case PackingLevelIndex.STANDARD:
        total += (itemizedPrices['standard-materials'] || 0) + (itemizedPrices['standard-services'] || 0);
        break;
      case PackingLevelIndex.FRAGILE:
        total += (itemizedPrices['fragile-materials'] || 0) + (itemizedPrices['fragile-services'] || 0);
        break;
      case PackingLevelIndex.CUSTOM:
        total += (itemizedPrices['custom-materials'] || 0) + (itemizedPrices['custom-services'] || 0);
        break;
      // NO_PACK just uses box price, already added above
    }
    
    return total;
  }
  
  return 0; // Default if no pricing information is available
}

/**
 * Gets the packing level index from name
 * @param {string} packingLevel - The packing level name
 * @returns {number} - The packing level index
 */
function getPackingLevelIndex(packingLevel) {
  switch (packingLevel) {
    case "No Pack": return PackingLevelIndex.NO_PACK;
    case "Standard Pack": return PackingLevelIndex.STANDARD;
    case "Fragile Pack": return PackingLevelIndex.FRAGILE;
    case "Custom Pack": return PackingLevelIndex.CUSTOM;
    default: return PackingLevelIndex.NO_PACK;
  }
}

/**
 * Gets prices array from a box using the appropriate pricing model
 * for compatibility with existing code
 * @param {Object} box - The box object
 * @returns {Array} - The prices array [nopack, standard, fragile, custom]
 */
function getPricesArray(box) {
  // If standard pricing, return the prices array directly
  if (box.prices && Array.isArray(box.prices)) {
    return box.prices;
  }
  
  // If itemized pricing, calculate total prices for each level
  if (box['itemized-prices']) {
    const ip = box['itemized-prices'];
    return [
      ip['box-price'] || 0,
      (ip['box-price'] || 0) + (ip['standard-materials'] || 0) + (ip['standard-services'] || 0),
      (ip['box-price'] || 0) + (ip['fragile-materials'] || 0) + (ip['fragile-services'] || 0),
      (ip['box-price'] || 0) + (ip['custom-materials'] || 0) + (ip['custom-services'] || 0)
    ];
  }
  
  return [0, 0, 0, 0]; // Default if no pricing information
}

/**
 * Converts standard pricing to itemized pricing format
 * @param {Array} pricesArray - The standard format prices array
 * @returns {Object} - The itemized prices object
 */
function standardToItemized(pricesArray) {
  if (!Array.isArray(pricesArray) || pricesArray.length !== 4) {
    return {
      'box-price': 0,
      'basic-materials': 0,
      'basic-services': 0,
      'standard-materials': 0,
      'standard-services': 0,
      'fragile-materials': 0,
      'fragile-services': 0,
      'custom-materials': 0,
      'custom-services': 0
    };
  }
  
  // pricesArray[0] is already the full basic price (box + basic materials + services)
  // We need to extract the box price from it
  // Assume basic has minimal materials/services (10% of basic price)
  const basicTotal = pricesArray[0];
  const boxPrice = basicTotal * 0.9; // Assume 90% is box, 10% is basic materials/services
  const basicAddons = basicTotal - boxPrice;
  
  const standardTotal = pricesArray[1] - boxPrice;
  const fragileTotal = pricesArray[2] - boxPrice;
  const customTotal = pricesArray[3] - boxPrice;
  
  return {
    'box-price': boxPrice,
    'basic-materials': basicAddons * 0.7,     // 70% to materials
    'basic-services': basicAddons * 0.3,      // 30% to services
    'standard-materials': standardTotal * 0.7, // 70% to materials
    'standard-services': standardTotal * 0.3,  // 30% to services
    'fragile-materials': fragileTotal * 0.7,
    'fragile-services': fragileTotal * 0.3,
    'custom-materials': customTotal * 0.7,
    'custom-services': customTotal * 0.3
  };
}

/**
 * Converts itemized pricing to standard pricing format
 * @param {Object} itemizedPrices - The itemized prices object
 * @returns {Array} - The standard format prices array
 */
function itemizedToStandard(itemizedPrices) {
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

/**
 * Creates a new box object with the specified pricing model
 * @param {Object} box - The original box object
 * @param {string} targetMode - The target pricing mode
 * @returns {Object} - A new box object with the specified pricing model
 */
function convertBoxPricing(box, targetMode) {
  const newBox = { ...box };
  
  if (targetMode === PricingMode.ITEMIZED) {
    if (box.prices && Array.isArray(box.prices)) {
      newBox['itemized-prices'] = standardToItemized(box.prices);
      delete newBox.prices;
    }
  } else if (targetMode === PricingMode.STANDARD) {
    if (box['itemized-prices']) {
      newBox.prices = itemizedToStandard(box['itemized-prices']);
      delete newBox['itemized-prices'];
    }
  }
  
  return newBox;
}

/**
 * Update a specific price component in itemized pricing model
 * @param {Object} box - The box object
 * @param {string} component - The price component ('box-price', 'standard-materials', etc.)
 * @param {number} value - The new price value
 * @returns {Object} - A new box object with the updated price
 */
function updateItemizedPrice(box, component, value) {
  if (!box['itemized-prices']) {
    return box;
  }
  
  const newBox = { ...box };
  const newItemizedPrices = { ...newBox['itemized-prices'] };
  
  if (component in newItemizedPrices) {
    newItemizedPrices[component] = value;
  }
  
  newBox['itemized-prices'] = newItemizedPrices;
  return newBox;
}

/**
 * Update a specific price level in standard pricing model
 * @param {Object} box - The box object
 * @param {number} index - The price index (0-3)
 * @param {number} value - The new price value
 * @returns {Object} - A new box object with the updated price
 */
function updateStandardPrice(box, index, value) {
  if (!box.prices || !Array.isArray(box.prices)) {
    return box;
  }
  
  const newBox = { ...box };
  const newPrices = [...newBox.prices];
  
  if (index >= 0 && index < 4) {
    newPrices[index] = value;
  }
  
  newBox.prices = newPrices;
  return newBox;
}

// Export for browser environments
if (typeof window !== 'undefined') {
  window.PricingMode = PricingMode;
  window.PackingLevelIndex = PackingLevelIndex;
  window.getTotalPrice = getTotalPrice;
  window.getPricesArray = getPricesArray;
  window.standardToItemized = standardToItemized;
  window.itemizedToStandard = itemizedToStandard;
  window.convertBoxPricing = convertBoxPricing;
  window.updateItemizedPrice = updateItemizedPrice;
  window.updateStandardPrice = updateStandardPrice;
  window.getPackingLevelIndex = getPackingLevelIndex;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PricingMode,
    PackingLevelIndex,
    getTotalPrice,
    getPricesArray,
    standardToItemized,
    itemizedToStandard,
    convertBoxPricing,
    updateItemizedPrice,
    updateStandardPrice,
    getPackingLevelIndex
  };
}