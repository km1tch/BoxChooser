/**
 * API client functions for backend interactions
 * 
 * This module handles all server communication, abstracting away
 * the details of the API endpoints and request handling.
 */

/**
 * Fetches the current pricing mode for a store
 * @param {string} storeId - The store ID
 * @returns {Promise<string>} - 'standard' or 'itemized'
 */
async function fetchPricingMode(storeId) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/pricing_mode`, storeId);
    if (!response.ok) {
      throw new Error(`Failed to fetch pricing mode: ${response.status}`);
    }
    const data = await response.json();
    return data.mode || 'standard';
  } catch (error) {
    console.error("Error fetching pricing mode:", error);
    return 'standard';  // Default to standard mode
  }
}


/**
 * Fetches boxes for a specific store
 * @param {string} storeId - The store ID
 * @returns {Promise<Object>} - The boxes data
 */
async function fetchBoxes(storeId) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/boxes`, storeId);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching boxes:", error);
    throw error;
  }
}

/**
 * Fetches boxes with sections for the price editor
 * @param {string} storeId - The store ID
 * @returns {Promise<Array>} - The sectioned boxes data
 */
async function fetchBoxesWithSections(storeId) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/boxes_with_sections`, storeId);
    if (!response.ok) {
      throw new Error(`Failed to fetch boxes with sections: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching boxes with sections:", error);
    throw error;
  }
}

/**
 * Fetches all boxes with pricing mode for a specific store
 * @param {string} storeId - The store ID
 * @returns {Promise<Object>} - The response with pricing_mode and boxes
 */
async function fetchAllBoxes(storeId) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/all_boxes`, storeId);
    if (!response.ok) {
      throw new Error(`Failed to fetch all boxes: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching all boxes:", error);
    throw error;
  }
}

/**
 * Updates standard prices for multiple boxes
 * @param {string} storeId - The store ID
 * @param {Object} changes - The price changes
 * @param {string} csrfToken - The CSRF token
 * @returns {Promise<Object>} - The response data
 */
async function updateStandardPrices(storeId, changes, csrfToken) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/update_prices`, storeId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        changes: changes,
        csrf_token: csrfToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to update prices: ${response.status} - ${errorData?.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating standard prices:", error);
    throw error;
  }
}

/**
 * Updates itemized prices for multiple boxes
 * @param {string} storeId - The store ID
 * @param {Object} changes - The price changes
 * @param {string} csrfToken - The CSRF token
 * @returns {Promise<Object>} - The response data
 */
async function updateItemizedPrices(storeId, changes, csrfToken) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/update_itemized_prices`, storeId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        changes: changes,
        csrf_token: csrfToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to update itemized prices: ${response.status} - ${errorData?.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating itemized prices:", error);
    throw error;
  }
}

/**
 * Updates box locations
 * @param {string} storeId - The store ID
 * @param {Object} changes - The location changes
 * @param {string} csrfToken - The CSRF token
 * @returns {Promise<Object>} - The response data
 */
async function updateLocations(storeId, changes, csrfToken) {
  try {
    const response = await apiUtils.authenticatedFetch(`/api/store/${storeId}/update-locations`, storeId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        changes: changes,
        csrf_token: csrfToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to update locations: ${response.status} - ${errorData?.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating locations:", error);
    throw error;
  }
}

// Browser compatibility - export to window object
if (typeof window !== 'undefined') {
  window.api = {
    fetchPricingMode,
    fetchBoxes,
    fetchBoxesWithSections,
    fetchAllBoxes,
    updateStandardPrices,
    updateItemizedPrices,
    updateLocations
  };
}

// ES6 exports removed - all functions are available on window.api