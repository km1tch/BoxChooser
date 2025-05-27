/**
 * Central authentication library for the Packing Website
 * 
 * Supports two-tier authentication:
 * - User (PIN) access - read-only
 * - Admin (Email) access - full access
 */

const AuthManager = (function() {
  
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
   * Check authentication status for a store
   * @param {string} storeId 
   * @returns {Promise<{hasAuth: boolean, isAuthenticated: boolean, authLevel: string|null}>}
   */
  async function getAuthStatus(storeId) {
    try {
      const token = getToken(storeId);
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/auth/status?store_id=${storeId}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to get auth status');
      }
      
      const data = await response.json();
      
      // FIXME: Log warning if auto-login hack is active
      if (data._warning) {
        console.warn(data._warning);
      }
      
      return data;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return {
        hasAuth: false,
        isAuthenticated: false,
        authLevel: null,
        isLegacy: false
      };
    }
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
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
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
    
    // Always remove token locally
    removeToken(storeId);
    
    // Redirect to store page
    window.location.href = `/${storeId}`;
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
      window.location.href = `/${storeId}/wizard`;
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
  
  // Public API
  return {
    getToken,
    setToken,
    removeToken,
    getAuthStatus,
    makeAuthenticatedRequest,
    logout,
    requireAuth,
    initAuthUI
  };
  
})();