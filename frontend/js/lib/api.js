/**
 * API client functions for backend interactions
 * 
 * This module handles all server communication, abstracting away
 * the details of the API endpoints and request handling.
 */



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
 * Fetches all boxes for a specific store
 * @param {string} storeId - The store ID
 * @returns {Promise<Object>} - The response with boxes
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

/**
 * Updates a single box location
 * @param {string} storeId - The store ID
 * @param {string} model - The box model
 * @param {Object} location - The new location data
 * @returns {Promise<Object>} - The response data
 */
async function updateBoxLocation(storeId, model, location) {
  try {
    const response = await apiUtils.authenticatedFetch(
      `/api/store/${storeId}/box/${encodeURIComponent(model)}/location`,
      storeId,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: location })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to update location: ${response.status} - ${errorData?.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating box location:", error);
    throw error;
  }
}

/**
 * Deletes a box from inventory
 * @param {string} storeId - The store ID
 * @param {string} model - The box model to delete
 * @returns {Promise<Object>} - The response data
 */
async function deleteBox(storeId, model) {
  try {
    const response = await apiUtils.authenticatedFetch(
      `/api/store/${storeId}/box/${encodeURIComponent(model)}`,
      storeId,
      { method: 'DELETE' }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to delete box: ${response.status} - ${errorData?.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error deleting box:", error);
    throw error;
  }
}

/**
 * Creates a new box in inventory
 * @param {string} storeId - The store ID
 * @param {Object} boxData - The box data including model, supplier, dimensions, prices, etc.
 * @returns {Promise<Object>} - The response data
 */
async function createBox(storeId, boxData) {
  try {
    const response = await apiUtils.authenticatedFetch(
      `/api/store/${storeId}/box`,
      storeId,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boxData)
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Failed to create box: ${response.status} - ${errorData?.detail || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating box:", error);
    throw error;
  }
}


/**
 * Box Library API functions
 */

/**
 * Get all boxes from the library
 * @param {string} storeId - The store ID for auth
 * @returns {Promise<Array>} - Array of library boxes
 */
async function getLibraryBoxes(storeId) {
  try {
    const response = await apiUtils.authenticatedFetch('/api/boxes/library', storeId);
    if (!response.ok) {
      throw new Error(`Failed to fetch library boxes: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching library boxes:", error);
    throw error;
  }
}


/**
 * Check if a box exists in the library
 * @param {string} storeId - The store ID for auth
 * @param {Array<number>} dimensions - Box dimensions [L, W, D]
 * @param {Array<number>} alternateDepths - Optional prescored depths
 * @returns {Promise<Object>} - Check result with exact_match, box, and similar_boxes
 */
async function checkLibraryBox(storeId, dimensions, alternateDepths = null) {
  try {
    const response = await apiUtils.authenticatedFetch(
      '/api/boxes/library/check',
      storeId,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: dimensions,
          alternate_depths: alternateDepths
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to check library box: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking library box:", error);
    throw error;
  }
}


/**
 * Track box modifications (for analytics)
 * @param {string} storeId - The store ID for auth
 * @param {Object} modificationData - Modification details
 * @returns {Promise<Object>} - Response from server
 */
async function trackBoxModification(storeId, modificationData) {
  try {
    const response = await apiUtils.authenticatedFetch(
      `/api/store/${storeId}/stats/box-modification`,
      storeId,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modificationData)
      }
    );
    
    if (!response.ok) {
      // Don't throw for stats tracking - just log
      console.warn(`Failed to track box modification: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    // Don't throw for stats tracking - just log
    console.warn("Error tracking box modification:", error);
    return null;
  }
}

// Browser compatibility - export to window object
if (typeof window !== 'undefined') {
  window.api = {
    fetchBoxes,
    fetchBoxesWithSections,
    fetchAllBoxes,
    updateItemizedPrices,
    updateLocations,
    updateBoxLocation,
    deleteBox,
    createBox,
    // Box Library functions
    getLibraryBoxes,
    checkLibraryBox,
    // Statistics
    trackBoxModification
  };
}

// ES6 exports removed - all functions are available on window.api