// Setup file for tests
// This file runs before all tests

// Mock window object for browser-specific code
global.window = global;

// Ensure modules can be loaded properly
global.module = { exports: {} };

// Mock apiUtils for tests
global.apiUtils = {
    authenticatedFetch: (url, storeId, options = {}) => {
        // In tests, just pass through to fetch
        return fetch(url, options);
    }
};