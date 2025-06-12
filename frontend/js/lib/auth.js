/**
 * Central authentication library for the Packing Website
 * 
 * Supports two-tier authentication:
 * - User (PIN) access - read-only
 * - Admin (Email) access - full access
 */

const AuthManager = (function() {
  // Auth status cache to avoid repeated API calls
  let authStatusCache = {};
  let cacheExpiry = {};
  const CACHE_DURATION = 30000; // 30 seconds
  const pendingRequests = {}; // Track in-flight requests
  
  /**
   * Get the authentication token for a store
   * @param {string} storeId 
   * @returns {string|null}
   */
  function getToken(storeId) {
    return localStorage.getItem(`store_${storeId}_token`);
  }
  
  /**
   * Set the authentication token for a store
   * @param {string} storeId 
   * @param {string} token 
   */
  function setToken(storeId, token) {
    localStorage.setItem(`store_${storeId}_token`, token);
  }
  
  /**
   * Remove the authentication token for a store
   * @param {string} storeId 
   */
  function removeToken(storeId) {
    localStorage.removeItem(`store_${storeId}_token`);
  }
  
  /**
   * Check authentication status for current user
   * @param {string} storeId - Used to get the token for this store
   * @returns {Promise<{authenticated: boolean, authLevel: string|null, storeId: string|null}>}
   */
  async function getAuthStatus(storeId) {
    // Check cache first
    if (authStatusCache[storeId] && cacheExpiry[storeId] && Date.now() < cacheExpiry[storeId]) {
      return authStatusCache[storeId];
    }
    
    // Check if there's already a request in flight for this store
    if (pendingRequests[storeId]) {
      return pendingRequests[storeId];
    }
    
    // Create the request promise
    pendingRequests[storeId] = (async () => {
      try {
        const token = getToken(storeId);
        const headers = {};
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/status`, {
          headers
        });
        
        if (!response.ok) {
          throw new Error('Failed to get auth status');
        }
        
        const data = await response.json();
        
        // Transform to match old interface for backward compatibility
        const result = {
          hasAuth: true,  // All stores require auth now
          isAuthenticated: data.authenticated,
          authLevel: data.authLevel,
          isDemo: data.isDemo,
          actualStoreId: data.storeId  // The store they're actually logged into
        };
        
        // Cache the result
        authStatusCache[storeId] = result;
        cacheExpiry[storeId] = Date.now() + CACHE_DURATION;
        
        return result;
      } catch (error) {
        console.error('Error checking auth status:', error);
        const result = {
          hasAuth: true,  // All stores require auth now
          isAuthenticated: false,
          authLevel: null,
          isDemo: false,
          actualStoreId: null
        };
        
        // Don't cache error results
        return result;
      } finally {
        // Clean up pending request
        delete pendingRequests[storeId];
      }
    })();
    
    return pendingRequests[storeId];
  }
  
  /**
   * Make an authenticated API request
   * @param {string} url 
   * @param {RequestInit} options 
   * @param {string} storeId 
   * @returns {Promise<Response>}
   */
  async function makeAuthenticatedRequest(url, options = {}, storeId) {
    const token = getToken(storeId);
    
    if (!token) {
      // Redirect to login
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      throw new Error('Not authenticated');
    }
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      removeToken(storeId);
      
      // Show clean message before redirect
      const message = document.createElement('div');
      message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-align: center;
        z-index: 10000;
      `;
      message.innerHTML = `
        <h3 style="margin: 0 0 15px 0;">Session Expired</h3>
        <p style="margin: 0;">Please log in again.</p>
      `;
      document.body.appendChild(message);
      
      // Redirect after brief delay so user can see the message
      setTimeout(() => {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 1500);
      
      throw new Error('Session expired');
    }
    
    return response;
  }
  
  /**
   * Logout from a store
   * @param {string} storeId 
   */
  async function logout(storeId) {
    const token = getToken(storeId);
    
    if (token) {
      try {
        // Call logout endpoint
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
    
    // Check if this was a sudo session before removing
    const isSudo = localStorage.getItem(`store_${storeId}_is_sudo`) === 'true';
    
    // Always remove token and sudo flag locally
    removeToken(storeId);
    localStorage.removeItem(`store_${storeId}_is_sudo`);
    localStorage.removeItem('current_store_id');
    
    // Clear auth cache
    delete authStatusCache[storeId];
    delete cacheExpiry[storeId];
    // Also clear any pending requests
    delete pendingRequests[storeId];
    
    // Redirect appropriately
    if (isSudo) {
      // Close the tab if it's a sudo session
      window.close();
      // If window.close() doesn't work (not opened by script), redirect
      window.location.href = '/';
    } else {
      // Redirect to home page (clean URL without store ID)
      window.location.href = '/';
    }
  }
  
  /**
   * Require authentication for a page
   * Redirects to login if not authenticated
   * @param {string} storeId 
   * @param {boolean} adminRequired - If true, requires admin auth level
   */
  async function requireAuth(storeId, adminRequired = false) {
    const status = await getAuthStatus(storeId);
    
    // Check if authenticated
    if (!status.isAuthenticated) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    
    // Check if admin required
    if (adminRequired && status.authLevel !== 'admin') {
      // User trying to access admin page
      alert('Admin access required');
      window.location.href = `/wizard`;
      return;
    }
  }
  
  /**
   * Initialize auth UI elements (login/logout buttons)
   * @param {string} containerId 
   * @param {string} storeId 
   */
  async function initAuthUI(containerId, storeId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const status = await getAuthStatus(storeId);
    
    if (!status.hasAuth || status.isLegacy) {
      // No auth configured or legacy mode
      container.innerHTML = '';
      return;
    }
    
    if (status.isAuthenticated) {
      // Show auth info in dropdown
      container.innerHTML = `
        <div class="auth-info">
          ${status.authLevel === 'admin' ? '<span class="admin-indicator">ADMIN</span>' : ''}
          <span class="auth-status">${status.authLevel === 'admin' ? 'Back Office' : 'Point-of-Sale'}</span>
          <button class="logout-button" onclick="AuthManager.logout('${storeId}')">
            Sign Out
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <a href="/login?redirect=${encodeURIComponent(window.location.pathname)}" class="login-link">
          Sign In
        </a>
      `;
    }
  }
  
  /**
   * Get the current store ID from context
   * @returns {string|null}
   */
  function getCurrentStoreId() {
    // First check if we have a current store in localStorage
    const currentStore = localStorage.getItem('current_store_id');
    if (currentStore) return currentStore;
    
    // Otherwise try to extract from URL (for backwards compatibility)
    const pathParts = window.location.pathname.split('/');
    const storeId = pathParts[1];
    if (storeId && /^\d+$/.test(storeId)) {
      // Set it as current for future use
      setCurrentStoreId(storeId);
      return storeId;
    }
    
    // Finally, check if we have any token and use that store
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('store_') && key.endsWith('_token')) {
        const match = key.match(/store_(\d+)_token/);
        if (match) {
          const storeId = match[1];
          setCurrentStoreId(storeId);
          return storeId;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Set the current store ID
   * @param {string} storeId 
   */
  function setCurrentStoreId(storeId) {
    localStorage.setItem('current_store_id', storeId);
  }
  
  
  // Public API
  return {
    getToken,
    setToken,
    removeToken,
    getAuthStatus,
    makeAuthenticatedRequest,
    logout,
    requireAuth,
    initAuthUI,
    getCurrentStoreId,
    setCurrentStoreId
  };
  
})();

// Export to window for use in other scripts
if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}