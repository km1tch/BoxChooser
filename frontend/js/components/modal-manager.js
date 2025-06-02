/**
 * ModalManager Component
 * Centralized modal management with consistent behavior
 */
class ModalManager {
    /**
     * Track active modals
     * @private
     */
    static activeModals = new Set();
    static initialized = false;

    /**
     * Initialize modal manager
     */
    static init() {
        if (this.initialized) return;

        // Global event listeners
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                // Close the most recently opened modal
                const lastModal = Array.from(this.activeModals).pop();
                if (lastModal) {
                    this.hide(lastModal);
                }
            }
        });

        // Click outside handler will be added per modal
        this.initialized = true;
    }

    /**
     * Show a modal
     * @param {string} modalId - Modal element ID
     * @param {Object} options - Display options
     */
    static show(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with id '${modalId}' not found`);
            return;
        }

        const {
            onShow,
            onHide,
            closeOnClickOutside = true,
            closeOnEsc = true,
            animate = true
        } = options;

        // Initialize if needed
        if (!this.initialized) {
            this.init();
        }

        // Store options
        modal._modalOptions = {
            onHide,
            closeOnClickOutside,
            closeOnEsc
        };

        // Add to active modals
        this.activeModals.add(modalId);

        // Show modal
        modal.style.display = 'block';
        
        // Add animation class if needed
        if (animate && !modal.classList.contains('modal-animate')) {
            modal.classList.add('modal-animate');
            // Trigger reflow for animation
            modal.offsetHeight;
            modal.classList.add('modal-show');
        }

        // Setup click outside handler
        if (closeOnClickOutside) {
            modal._clickOutsideHandler = (e) => {
                if (e.target === modal) {
                    this.hide(modalId);
                }
            };
            modal.addEventListener('click', modal._clickOutsideHandler);
        }

        // Focus management
        this.trapFocus(modal);

        // Callback
        if (typeof onShow === 'function') {
            onShow(modal);
        }

        // Prevent body scroll
        if (this.activeModals.size === 1) {
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Hide a modal
     * @param {string} modalId - Modal element ID
     */
    static hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Remove from active modals
        this.activeModals.delete(modalId);

        // Get options
        const options = modal._modalOptions || {};

        // Animation
        if (modal.classList.contains('modal-animate')) {
            modal.classList.remove('modal-show');
            
            // Wait for animation to complete
            modal.addEventListener('transitionend', () => {
                modal.style.display = 'none';
                modal.classList.remove('modal-animate');
            }, { once: true });
        } else {
            modal.style.display = 'none';
        }

        // Remove click outside handler
        if (modal._clickOutsideHandler) {
            modal.removeEventListener('click', modal._clickOutsideHandler);
            delete modal._clickOutsideHandler;
        }

        // Restore focus
        this.restoreFocus(modal);

        // Callback
        if (typeof options.onHide === 'function') {
            options.onHide(modal);
        }

        // Restore body scroll if no more modals
        if (this.activeModals.size === 0) {
            document.body.style.overflow = '';
        }

        // Cleanup
        delete modal._modalOptions;
    }

    /**
     * Toggle a modal
     * @param {string} modalId - Modal element ID
     * @param {Object} options - Display options
     */
    static toggle(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (modal.style.display === 'none' || !modal.style.display) {
            this.show(modalId, options);
        } else {
            this.hide(modalId);
        }
    }

    /**
     * Hide all active modals
     */
    static hideAll() {
        const modals = Array.from(this.activeModals);
        modals.forEach(modalId => this.hide(modalId));
    }

    /**
     * Setup close handlers for modal
     * @param {string} modalId - Modal element ID
     * @param {Object} options - Handler options
     */
    static setupCloseHandlers(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const {
            closeButtonSelector = '.close, .close-btn, .modal-close',
            cancelButtonSelector = '.cancel, .btn-cancel, .btn-secondary'
        } = options;

        // Close buttons
        modal.querySelectorAll(closeButtonSelector).forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hide(modalId);
            });
        });

        // Cancel buttons
        modal.querySelectorAll(cancelButtonSelector).forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hide(modalId);
            });
        });
    }

    /**
     * Create a modal from template
     * @param {string} modalId - Modal ID to create
     * @param {Object} options - Modal configuration
     * @returns {HTMLElement} Created modal element
     */
    static create(modalId, options = {}) {
        const {
            title = '',
            content = '',
            footer = '',
            className = '',
            closeButton = true,
            size = 'medium' // small, medium, large
        } = options;

        // Check if modal already exists
        if (document.getElementById(modalId)) {
            console.warn(`Modal with id '${modalId}' already exists`);
            return document.getElementById(modalId);
        }

        // Create modal structure
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = `modal ${className}`;
        modal.style.display = 'none';

        const modalContent = document.createElement('div');
        modalContent.className = `modal-content modal-${size}`;

        // Header
        if (title || closeButton) {
            const header = document.createElement('div');
            header.className = 'modal-header';
            
            if (title) {
                const titleElement = document.createElement('h3');
                titleElement.textContent = title;
                header.appendChild(titleElement);
            }
            
            if (closeButton) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'modal-close';
                closeBtn.innerHTML = '&times;';
                closeBtn.onclick = () => this.hide(modalId);
                header.appendChild(closeBtn);
            }
            
            modalContent.appendChild(header);
        }

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else {
            body.appendChild(content);
        }
        modalContent.appendChild(body);

        // Footer
        if (footer) {
            const footerElement = document.createElement('div');
            footerElement.className = 'modal-footer';
            if (typeof footer === 'string') {
                footerElement.innerHTML = footer;
            } else {
                footerElement.appendChild(footer);
            }
            modalContent.appendChild(footerElement);
        }

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Setup close handlers
        this.setupCloseHandlers(modalId);

        return modal;
    }

    /**
     * Confirm dialog helper
     * @param {Object} options - Confirmation options
     * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
     */
    static async confirm(options = {}) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'OK',
            cancelText = 'Cancel',
            confirmClass = 'btn btn-primary',
            cancelClass = 'btn btn-secondary'
        } = options;

        return new Promise((resolve) => {
            // Create unique modal ID
            const modalId = `confirm-modal-${Date.now()}`;

            // Create footer with buttons
            const footer = document.createElement('div');
            footer.style.textAlign = 'center';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = confirmClass;
            confirmBtn.textContent = confirmText;
            confirmBtn.onclick = () => {
                this.hide(modalId);
                resolve(true);
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.className = cancelClass;
            cancelBtn.textContent = cancelText;
            cancelBtn.style.marginLeft = '10px';
            cancelBtn.onclick = () => {
                this.hide(modalId);
                resolve(false);
            };

            footer.appendChild(confirmBtn);
            footer.appendChild(cancelBtn);

            // Create modal
            this.create(modalId, {
                title,
                content: `<p>${message}</p>`,
                footer,
                size: 'small'
            });

            // Show modal
            this.show(modalId, {
                onHide: () => {
                    // Clean up modal after hide
                    setTimeout(() => {
                        const modal = document.getElementById(modalId);
                        if (modal) modal.remove();
                    }, 300);
                }
            });
        });
    }

    /**
     * Alert dialog helper
     * @param {Object} options - Alert options
     * @returns {Promise<void>} Resolves when alert is closed
     */
    static async alert(options = {}) {
        const {
            title = 'Alert',
            message = '',
            confirmText = 'OK',
            confirmClass = 'btn btn-primary'
        } = options;

        return new Promise((resolve) => {
            // Create unique modal ID
            const modalId = `alert-modal-${Date.now()}`;

            // Create footer with button
            const footer = document.createElement('div');
            footer.style.textAlign = 'center';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = confirmClass;
            confirmBtn.textContent = confirmText;
            confirmBtn.onclick = () => {
                this.hide(modalId);
                resolve();
            };

            footer.appendChild(confirmBtn);

            // Create modal
            this.create(modalId, {
                title,
                content: `<p>${message}</p>`,
                footer,
                size: 'small'
            });

            // Show modal
            this.show(modalId, {
                onHide: () => {
                    // Clean up modal after hide
                    setTimeout(() => {
                        const modal = document.getElementById(modalId);
                        if (modal) modal.remove();
                    }, 300);
                }
            });
        });
    }

    /**
     * Focus management
     * @private
     */
    static trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        // Store previously focused element
        modal._previouslyFocused = document.activeElement;

        // Focus first element
        if (firstFocusable) {
            firstFocusable.focus();
        }

        // Trap focus
        modal._focusTrapHandler = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        };

        modal.addEventListener('keydown', modal._focusTrapHandler);
    }

    /**
     * Restore focus
     * @private
     */
    static restoreFocus(modal) {
        if (modal._focusTrapHandler) {
            modal.removeEventListener('keydown', modal._focusTrapHandler);
            delete modal._focusTrapHandler;
        }

        if (modal._previouslyFocused && modal._previouslyFocused.focus) {
            modal._previouslyFocused.focus();
            delete modal._previouslyFocused;
        }
    }

    /**
     * Add default modal styles
     */
    static addStyles() {
        if (document.getElementById('modal-manager-styles')) return;

        const styles = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                overflow: auto;
            }
            
            .modal-content {
                position: relative;
                background: white;
                margin: 50px auto;
                padding: 0;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                max-width: 90%;
                max-height: 90vh;
                overflow: auto;
            }
            
            .modal-small { width: 400px; }
            .modal-medium { width: 600px; }
            .modal-large { width: 800px; }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 1.25rem;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-close:hover {
                color: #000;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-footer {
                padding: 15px 20px;
                border-top: 1px solid #e0e0e0;
                text-align: right;
            }
            
            .modal-footer button {
                margin-left: 10px;
            }
            
            /* Animation */
            .modal-animate {
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .modal-animate.modal-show {
                opacity: 1;
            }
            
            .modal-animate .modal-content {
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .modal-animate.modal-show .modal-content {
                transform: scale(1);
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .modal-content {
                    margin: 20px;
                    width: auto !important;
                }
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'modal-manager-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

// Auto-add styles when loaded
if (typeof document !== 'undefined') {
    ModalManager.addStyles();
}

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.ModalManager = ModalManager;
}