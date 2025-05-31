/**
 * Superadmin API Utilities
 * 
 * API client for superadmin operations
 */

class SuperadminAPI {
    /**
     * Get the superadmin token from localStorage
     */
    static getToken() {
        return localStorage.getItem('superadmin_token');
    }

    /**
     * Make an authenticated superadmin API request
     * @param {string} url - The URL to fetch
     * @param {Object} options - Standard fetch options
     * @returns {Promise<any>} - The parsed JSON response
     * @throws {Error} - Throws if not authenticated or on errors
     */
    static async request(url, options = {}) {
        const token = this.getToken();
        if (!token) {
            window.location.href = '/admin-login.html';
            throw new Error('Not authenticated as superadmin');
        }

        const fetchOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        };

        try {
            const response = await fetch(url, fetchOptions);

            // Handle 401 Unauthorized
            if (response.status === 401) {
                localStorage.removeItem('superadmin_token');
                window.location.href = '/admin-login.html';
                throw new Error('Session expired');
            }

            // Handle 403 Forbidden
            if (response.status === 403) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || 'Superadmin access required');
            }

            // Handle other errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || `HTTP ${response.status}`);
            }

            // Return parsed JSON
            return await response.json();

        } catch (error) {
            console.error('Superadmin API request failed:', error);
            throw error;
        }
    }

    /**
     * Login as superadmin
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<{access_token: string, username: string}>}
     */
    static async login(username, password) {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.detail || 'Login failed');
        }

        const data = await response.json();
        
        // Check if TOTP is required
        if (data.requires_totp) {
            return data;  // Return the TOTP requirement to the caller
        }
        
        // Otherwise, store token and return
        localStorage.setItem('superadmin_token', data.access_token);
        return data;
    }

    /**
     * Verify TOTP and complete login
     * @param {string} username 
     * @param {string} totpToken 
     * @returns {Promise<{access_token: string, username: string}>}
     */
    static async verifyTOTPLogin(username, totpToken) {
        const response = await fetch('/api/admin/login/totp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: username,
                totp_token: totpToken 
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.detail || 'Invalid TOTP code');
        }

        const data = await response.json();
        localStorage.setItem('superadmin_token', data.access_token);
        return data;
    }

    /**
     * Logout
     */
    static logout() {
        localStorage.removeItem('superadmin_token');
        window.location.href = '/admin-login.html';
    }

    /**
     * Get dashboard info
     * @returns {Promise<{message: string, username: string, auth_level: string}>}
     */
    static async getDashboard() {
        return this.request('/api/admin/');
    }

    /**
     * List all stores
     * @returns {Promise<Array<{store_id: string, admin_email: string, status: string}>>}
     */
    static async listStores() {
        return this.request('/api/admin/stores');
    }

    /**
     * Disable a store
     * @param {string} storeId 
     * @param {string} reason 
     * @returns {Promise<{status: string}>}
     */
    static async disableStore(storeId, reason = '') {
        return this.request(`/api/admin/stores/${storeId}/disable`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }

    /**
     * Enable a store
     * @param {string} storeId 
     * @returns {Promise<{status: string}>}
     */
    static async enableStore(storeId) {
        return this.request(`/api/admin/stores/${storeId}/enable`, {
            method: 'POST'
        });
    }

    /**
     * Create sudo token for a store
     * @param {string} storeId 
     * @returns {Promise<{token: string, store_id: string, expires_in: number}>}
     */
    static async createSudoToken(storeId) {
        return this.request(`/api/admin/stores/${storeId}/sudo`, {
            method: 'POST'
        });
    }

    /**
     * Get store details
     * @param {string} storeId
     * @returns {Promise<Object>}
     */
    static async getStoreDetails(storeId) {
        return this.request(`/api/admin/stores/${storeId}`);
    }

    /**
     * Create a new store
     * @param {Object} data
     * @param {string} data.store_id
     * @param {string} data.admin_email
     * @param {string} data.store_name
     * @param {string} data.copy_from_store
     * @returns {Promise<{status: string, store_id: string, pin: string}>}
     */
    static async createStore(data) {
        return this.request('/api/admin/stores', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Get audit log
     * @param {Object} params - Query parameters
     * @param {number} params.limit - Number of entries
     * @param {string} params.superadmin - Filter by superadmin
     * @param {string} params.store_id - Filter by store
     * @returns {Promise<Array>}
     */
    static async getAuditLog(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `/api/admin/audit${queryString ? `?${queryString}` : ''}`;
        return this.request(url);
    }

    /**
     * Update store metadata (name/description)
     * @param {string} storeId
     * @param {Object} metadata
     * @param {string} metadata.name
     * @param {string} metadata.description
     * @returns {Promise<Object>}
     */
    static async updateStoreMetadata(storeId, metadata) {
        return this.request(`/api/admin/stores/${storeId}/metadata`, {
            method: 'PUT',
            body: JSON.stringify(metadata)
        });
    }

    /**
     * Get TOTP status
     * @returns {Promise<{enabled: boolean, username: string}>}
     */
    static async getTOTPStatus() {
        return this.request('/api/admin/totp/status');
    }

    /**
     * Setup TOTP
     * @returns {Promise<{secret: string, qr_code: string, manual_entry: string}>}
     */
    static async setupTOTP() {
        return this.request('/api/admin/totp/setup');
    }

    /**
     * Verify TOTP token
     * @param {string} token
     * @returns {Promise<{status: string}>}
     */
    static async verifyTOTP(token) {
        return this.request('/api/admin/totp/verify', {
            method: 'POST',
            body: JSON.stringify({ totp_token: token })
        });
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SuperadminAPI;
}