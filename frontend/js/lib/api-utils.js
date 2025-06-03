/**
 * API Utilities
 * 
 * Common utilities for making authenticated API requests
 */

/**
 * Makes an authenticated fetch request with automatic token validation and error handling
 * @param {string} url - The URL to fetch
 * @param {string} storeId - The store ID for getting the correct token
 * @param {Object} options - Standard fetch options
 * @returns {Promise<Response>} - The fetch response
 * @throws {Error} - Throws if not authenticated or on 401 errors
 */
async function authenticatedFetch(url, storeId, options = {}) {
    // Validate token exists
    const token = AuthManager.getToken(storeId);
    if (!token) {
        console.error('No authentication token found for store:', storeId);
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        throw new Error('Not authenticated');
    }
    
    // Add auth header to options
    const fetchOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    };
    
    try {
        const response = await fetch(url, fetchOptions);
        
        // Handle 401 Unauthorized (expired or invalid token)
        if (response.status === 401) {
            console.error('Authentication failed - token may be expired');
            AuthManager.removeToken(storeId);
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
            throw new Error('Session expired');
        }
        
        // Handle 403 Forbidden (wrong store access)
        if (response.status === 403) {
            console.error('Access denied - you may be trying to access the wrong store');
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.detail || 'Access denied');
        }
        
        return response;
    } catch (error) {
        // Re-throw known errors
        if (error.message === 'Not authenticated' || error.message === 'Session expired') {
            throw error;
        }
        
        // Handle network errors
        console.error('Network error during authenticated request:', error);
        throw new Error(`Network error: ${error.message}`);
    }
}

/**
 * Helper to get current store ID with validation
 * @returns {string} The current store ID
 * @throws {Error} If no store ID is found
 */
function getCurrentStoreIdOrRedirect() {
    const storeId = AuthManager.getCurrentStoreId();
    if (!storeId) {
        window.location.href = '/login';
        throw new Error('No store ID found');
    }
    return storeId;
}

/**
 * Helper to handle API errors consistently
 * @param {Response} response - The fetch response
 * @param {string} context - Context for the error (e.g., "loading rules")
 */
async function handleApiError(response, context) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.detail || response.statusText || 'Unknown error';
        console.error(`Error ${context}:`, message);
        throw new Error(`Failed to ${context}: ${message}`);
    }
}

// Export utilities for use in other files
if (typeof window !== 'undefined') {
    window.apiUtils = {
        authenticatedFetch,
        getCurrentStoreIdOrRedirect,
        handleApiError
    };
}