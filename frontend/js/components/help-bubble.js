/**
 * Help/Feedback Bubble Component
 * Provides a floating help button that users can click to send feedback
 */

class HelpBubble {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
        // Create the bubble HTML
        const bubbleHtml = `
            <div id="help-bubble" class="help-bubble">
                <button id="help-bubble-btn" class="help-bubble-btn" title="Need help?">
                    <span class="help-icon">?</span>
                </button>
                
                <div id="help-bubble-content" class="help-bubble-content hidden">
                    <div class="help-bubble-header">
                        <h3>Send Feedback</h3>
                        <button class="help-bubble-close">&times;</button>
                    </div>
                    
                    <div class="help-bubble-body">
                        <div class="help-category-selector">
                            <label>
                                <input type="radio" name="feedback-category" value="bug" checked>
                                <span>Report a Bug</span>
                            </label>
                            <label>
                                <input type="radio" name="feedback-category" value="feature">
                                <span>Feature Request</span>
                            </label>
                            <label>
                                <input type="radio" name="feedback-category" value="question">
                                <span>Question</span>
                            </label>
                        </div>
                        
                        <textarea 
                            id="feedback-message" 
                            class="help-bubble-textarea" 
                            placeholder="Tell us what's on your mind..."
                            rows="4"
                            maxlength="1000"
                        ></textarea>
                        
                        <div class="help-bubble-footer">
                            <button id="send-feedback-btn" class="btn btn-primary">Send</button>
                            <span id="feedback-status" class="feedback-status"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to page
        document.body.insertAdjacentHTML('beforeend', bubbleHtml);

        // Add styles
        this.addStyles();

        // Bind events
        this.bindEvents();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .help-bubble {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
            }

            .help-bubble-btn {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: #007bff;
                color: white;
                border: none;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .help-bubble-btn:hover {
                background: #0056b3;
                transform: scale(1.1);
            }

            .help-bubble-content {
                position: absolute;
                bottom: 70px;
                right: 0;
                width: 320px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
                transform-origin: bottom right;
            }

            .help-bubble-content.hidden {
                opacity: 0;
                transform: scale(0.8);
                pointer-events: none;
            }

            .help-bubble-header {
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .help-bubble-header h3 {
                margin: 0;
                font-size: 18px;
                color: #333;
            }

            .help-bubble-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
            }

            .help-bubble-close:hover {
                color: #333;
            }

            .help-bubble-body {
                padding: 16px;
            }

            .help-category-selector {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 16px;
            }

            .help-category-selector label {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .help-category-selector label:hover {
                background: #f5f5f5;
            }

            .help-category-selector input[type="radio"] {
                width: auto !important;
                margin-right: 8px;
            }

            .help-bubble-textarea {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                resize: vertical;
                font-family: inherit;
                font-size: 14px;
            }

            .help-bubble-textarea:focus {
                outline: none;
                border-color: #007bff;
            }

            .help-bubble-footer {
                margin-top: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .feedback-status {
                font-size: 14px;
                color: #666;
            }

            .feedback-status.success {
                color: #28a745;
            }

            .feedback-status.error {
                color: #dc3545;
            }

            @media (max-width: 640px) {
                .help-bubble-content {
                    width: calc(100vw - 40px);
                    right: -10px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        const bubbleBtn = document.getElementById('help-bubble-btn');
        const closeBtn = document.querySelector('.help-bubble-close');
        const sendBtn = document.getElementById('send-feedback-btn');
        const content = document.getElementById('help-bubble-content');

        bubbleBtn.addEventListener('click', () => this.toggle());
        closeBtn.addEventListener('click', () => this.close());
        sendBtn.addEventListener('click', () => this.sendFeedback());

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && !e.target.closest('#help-bubble')) {
                this.close();
            }
        });

        // Submit on Enter (with Ctrl/Cmd)
        document.getElementById('feedback-message').addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.sendFeedback();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        const content = document.getElementById('help-bubble-content');
        content.classList.remove('hidden');
        this.isOpen = true;
        
        // Focus the textarea
        setTimeout(() => {
            document.getElementById('feedback-message').focus();
        }, 300);
    }

    close() {
        const content = document.getElementById('help-bubble-content');
        content.classList.add('hidden');
        this.isOpen = false;
        
        // Clear form
        this.clearForm();
    }

    clearForm() {
        document.getElementById('feedback-message').value = '';
        document.querySelector('input[name="feedback-category"][value="bug"]').checked = true;
        this.setStatus('');
    }

    setStatus(message, type = '') {
        const status = document.getElementById('feedback-status');
        status.textContent = message;
        status.className = 'feedback-status';
        if (type) {
            status.classList.add(type);
        }
    }

    async sendFeedback() {
        const message = document.getElementById('feedback-message').value.trim();
        const category = document.querySelector('input[name="feedback-category"]:checked').value;

        if (!message) {
            this.setStatus('Please enter a message', 'error');
            return;
        }

        const sendBtn = document.getElementById('send-feedback-btn');
        sendBtn.disabled = true;
        this.setStatus('Sending...');

        try {
            // Get the current store token if available
            let authHeader = '';
            if (window.AuthManager && window.AuthManager.getCurrentStoreId) {
                const storeId = window.AuthManager.getCurrentStoreId();
                if (storeId) {
                    const token = localStorage.getItem(`store_${storeId}_token`);
                    if (token) {
                        authHeader = `Bearer ${token}`;
                    }
                }
            }
            // Fallback to access_token (for non-store pages)
            if (!authHeader) {
                const accessToken = localStorage.getItem('access_token');
                if (accessToken) {
                    authHeader = `Bearer ${accessToken}`;
                }
            }
            
            const response = await fetch('/api/feedback/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },
                body: JSON.stringify({
                    message: message,
                    category: category,
                    page: window.location.pathname
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.setStatus('Sent!', 'success');
                setTimeout(() => {
                    this.close();
                }, 1500);
            } else {
                this.setStatus(data.detail || 'Failed to send', 'error');
            }
        } catch (error) {
            console.error('Failed to send feedback:', error);
            this.setStatus('Network error', 'error');
        } finally {
            sendBtn.disabled = false;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new HelpBubble());
} else {
    new HelpBubble();
}