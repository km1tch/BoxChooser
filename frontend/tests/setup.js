// Setup file for tests
// This file runs before all tests

// Mock window object for browser-specific code
global.window = global;

// Ensure modules can be loaded properly
global.module = { exports: {} };