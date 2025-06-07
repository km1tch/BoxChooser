/**
 * Common page initialization with authentication
 * Handles the repetitive pattern of hiding content, checking auth, then showing content
 */

window.AuthPageInit = {
    /**
     * Initialize a page with authentication check
     * @param {Object} options Configuration options
     * @param {string} options.pageName - Name for navigation (e.g., 'wizard', 'boxes')
     * @param {boolean} options.requireAdmin - Whether admin access is required
     * @param {string} options.containerSelector - CSS selector for main container to hide/show
     * @param {Function} options.onSuccess - Callback to run after successful auth
     * @param {Function} options.onError - Optional error handler (default redirects to login)
     * @param {boolean} options.allowReadOnly - Allow page to load in read-only mode without auth
     */
    async initPage(options) {
        const {
            pageName,
            requireAdmin = false,
            containerSelector = '.container',
            onSuccess,
            onError,
            allowReadOnly = false
        } = options;

        // Get store ID
        const storeId = AuthManager.getCurrentStoreId();
        if (!storeId && !allowReadOnly) {
            window.location.href = "/login.html";
            return;
        }

        // Hide container initially to prevent flash
        const container = document.querySelector(containerSelector);
        if (container) {
            container.style.display = 'none';
        }

        // Initialize navigation if available
        if (typeof initAdminNav !== 'undefined' && storeId) {
            await initAdminNav('nav-container', storeId, pageName);
        }

        try {
            // Check authentication
            if (storeId && !allowReadOnly) {
                await AuthManager.requireAuth(storeId, requireAdmin);
            } else if (allowReadOnly && storeId) {
                // For read-only pages, just check status without requiring
                try {
                    const authStatus = await AuthManager.getAuthStatus(storeId);
                    if (authStatus.isAuthenticated && authStatus.authLevel === 'admin') {
                        document.body.classList.add('admin-authenticated');
                    }
                } catch (error) {
                    // Continue in read-only mode
                }
            }

            // Show container after successful auth (or in read-only mode)
            if (container) {
                container.style.display = 'block';
            }

            // Call success callback
            if (onSuccess) {
                await onSuccess(storeId);
            }

        } catch (error) {
            // Handle auth failure
            if (onError) {
                onError(error);
            } else if (!allowReadOnly) {
                // Default behavior: auth failure redirects to login
                // requireAuth already handles the redirect
                return;
            }
        }
    }
};