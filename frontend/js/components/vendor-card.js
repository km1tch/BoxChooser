/**
 * VendorCard Component
 * Reusable component for displaying vendor information cards
 */
class VendorCard {
    /**
     * Render a single vendor card
     * @param {Object} vendor - Vendor object with name, url, version, box_count, etc.
     * @param {Object} options - Rendering options
     * @returns {string} HTML string for the vendor card
     */
    static render(vendor, options = {}) {
        const {
            onClick,
            onClickAction,
            showComparison = false,
            showVersion = true,
            showUrl = true,
            showId = false,
            buttonText = 'View Boxes',
            buttonClass = 'btn btn-primary',
            comparison = null
        } = options;

        // Build onclick handler
        const clickHandler = onClick 
            ? `onclick="${onClick}"`
            : onClickAction 
                ? `onclick="${onClickAction}('${this.escapeQuotes(vendor.id || vendor.name)}', '${this.escapeQuotes(vendor.name)}')"` 
                : '';

        // Build vendor info
        const vendorInfo = this.buildVendorInfo(vendor, {
            showVersion,
            showUrl,
            showId,
            showComparison,
            comparison
        });

        // Build button if needed
        const button = (!onClick && onClickAction) 
            ? `<button class="${buttonClass}" data-vendor-id="${this.escapeHtml(vendor.id || vendor.name)}" data-vendor-name="${this.escapeHtml(vendor.name)}">${buttonText}</button>`
            : '';

        return `
            <div class="vendor-card" ${clickHandler}>
                <div class="vendor-info">
                    <h4>${this.escapeHtml(vendor.name)}</h4>
                    ${vendorInfo}
                </div>
                ${button}
            </div>
        `;
    }

    /**
     * Render multiple vendor cards
     * @param {Array} vendors - Array of vendor objects
     * @param {Object} options - Rendering options
     * @returns {string} HTML string for all vendor cards
     */
    static renderList(vendors, options = {}) {
        if (!vendors || vendors.length === 0) {
            return '<p class="no-vendors">No vendors available.</p>';
        }

        return vendors.map(vendor => this.render(vendor, options)).join('');
    }

    /**
     * Build vendor info section
     * @private
     */
    static buildVendorInfo(vendor, options) {
        const parts = [];

        // Box count and comparison
        if (vendor.box_count !== undefined) {
            let boxCountText = `${vendor.box_count} total boxes`;
            
            if (options.showComparison && options.comparison) {
                boxCountText += this.renderComparison(options.comparison);
            } else if (options.showComparison && vendor.new_count !== undefined) {
                boxCountText += this.renderComparison(vendor);
            }
            
            parts.push(`<p class="vendor-meta">${boxCountText}</p>`);
        }

        // URL
        if (options.showUrl && vendor.url) {
            parts.push(`<p class="vendor-url"><a href="${vendor.url}" target="_blank" class="vendor-link">${vendor.url}</a></p>`);
        }

        // Version
        if (options.showVersion && vendor.version) {
            parts.push(`<p class="vendor-version">Version: ${vendor.version}</p>`);
        }

        // ID (for admin views)
        if (options.showId && vendor.id) {
            parts.push(`<p class="vendor-id"><small>ID: ${vendor.id}</small></p>`);
        }

        return parts.join('');
    }

    /**
     * Render comparison information
     * @private
     */
    static renderComparison(comparison) {
        if (!comparison) return '';

        const parts = [];

        if (comparison.new_count !== undefined && comparison.new_count > 0) {
            parts.push(`<span class="new-boxes">${comparison.new_count} new boxes</span> not in your store`);
        }

        if (comparison.existing_count !== undefined && comparison.existing_count > 0) {
            parts.push(`<span class="existing-boxes">${comparison.existing_count} already in inventory</span>`);
        }

        if (comparison.updated_count !== undefined && comparison.updated_count > 0) {
            parts.push(`<span class="updated-boxes">${comparison.updated_count} with updates</span>`);
        }

        return parts.length > 0 ? ' • ' + parts.join(' • ') : '';
    }

    /**
     * Create a vendor selection grid
     * @param {Array} vendors - Array of vendor objects
     * @param {Object} options - Grid options
     * @returns {string} HTML string for vendor grid
     */
    static renderGrid(vendors, options = {}) {
        const {
            containerId,
            columns = 3,
            onSelect,
            ...cardOptions
        } = options;

        const gridClass = `vendor-grid vendor-grid-${columns}`;
        const cards = this.renderList(vendors, {
            ...cardOptions,
            onClickAction: onSelect || 'selectVendor'
        });

        const html = `<div class="${gridClass}">${cards}</div>`;

        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = html;
            }
        }

        return html;
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Escape quotes for onclick handlers
     * @private
     */
    static escapeQuotes(text) {
        return String(text).replace(/'/g, "\\'");
    }

    /**
     * Add default styles for vendor cards
     */
    static addStyles() {
        if (document.getElementById('vendor-card-styles')) return;

        const styles = `
            .vendor-card {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 15px;
                transition: box-shadow 0.2s;
                cursor: pointer;
            }
            
            .vendor-card:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .vendor-info h4 {
                margin: 0 0 10px 0;
                color: #333;
            }
            
            .vendor-meta {
                margin: 5px 0;
                color: #666;
                font-size: 14px;
            }
            
            .vendor-url {
                margin: 5px 0;
                font-size: 12px;
            }
            
            .vendor-link {
                color: #0066cc;
                text-decoration: none;
            }
            
            .vendor-link:hover {
                text-decoration: underline;
            }
            
            .vendor-version,
            .vendor-id {
                margin: 5px 0;
                color: #999;
                font-size: 12px;
            }
            
            .new-boxes {
                color: #27ae60;
                font-weight: bold;
            }
            
            .existing-boxes {
                color: #666;
            }
            
            .updated-boxes {
                color: #f39c12;
                font-weight: bold;
            }
            
            .vendor-grid {
                display: grid;
                gap: 20px;
            }
            
            .vendor-grid-2 {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .vendor-grid-3 {
                grid-template-columns: repeat(3, 1fr);
            }
            
            @media (max-width: 768px) {
                .vendor-grid-2,
                .vendor-grid-3 {
                    grid-template-columns: 1fr;
                }
            }
            
            .no-vendors {
                text-align: center;
                color: #999;
                padding: 40px 20px;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'vendor-card-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

// Auto-add styles when loaded
if (typeof document !== 'undefined') {
    VendorCard.addStyles();
}

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.VendorCard = VendorCard;
}