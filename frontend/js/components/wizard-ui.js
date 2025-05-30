/**
 * Wizard UI Components
 *
 * This module handles all UI rendering and interaction for the packing wizard
 */

class WizardUI {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.storeId = options.storeId || this.getStoreIdFromPath();
    this.onFindBoxes = options.onFindBoxes || (() => {});

    // Initialize state
    this.state = {
      currentStep: 1,
      itemDims: null,
      selectedPackingLevel: null,
      recommendations: [],
    };
  }

  /**
   * Get store ID from URL path
   */
  getStoreIdFromPath() {
    const path = window.location.pathname;
    const match = path.match(/^\/(\d{1,4})\//);
    return match ? match[1] : "1";
  }

  /**
   * Get default padding for a packing type
   */
  getDefaultPadding(packingType) {
    switch (packingType) {
      case "Basic":
        return 0;
      case "Standard":
        return 1;
      case "Fragile":
        return 2;
      case "Custom":
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Get default description for a packing type
   */
  getDefaultDescription(packingType) {
    switch (packingType) {
      case "Basic":
        return "For non-sensitive items like clothing, toys, books";
      case "Standard":
        return "For electronics, jewelry, and medium-sensitive items";
      case "Fragile":
        return "For china, crystal, art, and sensitive equipment";
      case "Custom":
        return "Maximum protection for highly sensitive items";
      default:
        return "Standard packing";
    }
  }

  /**
   * Initialize the wizard
   */
  init() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the complete wizard
   */
  render() {
    this.container.innerHTML = `
            <div class="wizard-header">
                <h1>Box Selection Wizard</h1>
                <p>Find the perfect box in 3 easy steps</p>
            </div>
            
            ${this.renderStep1()}
            ${this.renderStep2()}
            ${this.renderStep3()}
        `;
  }

  /**
   * Render Step 1: Item dimensions
   */
  renderStep1() {
    return `
            <div id="step-1" class="wizard-step">
                <div class="step-header">
                    <div class="step-number ${
                      this.state.currentStep >= 1 ? "completed" : ""
                    }">1</div>
                    <div class="step-title">Enter Item Dimensions</div>
                </div>
                
                <div class="input-group">
                    <div class="input-field">
                        <label for="height">Height</label>
                        <input type="number" id="height" step="0.25" min="0.25" placeholder="inches">
                    </div>
                    <div class="input-field">
                        <label for="width">Width</label>
                        <input type="number" id="width" step="0.25" min="0.25" placeholder="inches">
                    </div>
                    <div class="input-field">
                        <label for="depth">Depth</label>
                        <input type="number" id="depth" step="0.25" min="0.25" placeholder="inches">
                    </div>
                </div>
                
                <button id="next-step-1" class="btn btn-primary" disabled>
                    Next: Select Packing Level
                </button>
            </div>
        `;
  }

  /**
   * Render Step 2: Packing level selection
   */
  renderStep2() {
    return `
            <div id="step-2" class="wizard-step hidden">
                <div class="step-header">
                    <div class="step-number">2</div>
                    <div class="step-title">Select Packing Level</div>
                </div>
                
                <div id="packing-levels" class="packing-grid">
                    <!-- Will be populated dynamically -->
                </div>
                
                <button id="find-boxes" class="btn btn-primary" disabled>
                    Find Best Boxes
                </button>
            </div>
        `;
  }

  /**
   * Render Step 3: Results
   */
  renderStep3() {
    return `
            <div id="step-3" class="wizard-step hidden">
                <div class="step-header">
                    <div class="step-number">3</div>
                    <div class="step-title">Recommended Boxes</div>
                </div>
                
                <div id="results-container" class="results-container">
                    <!-- Will be populated with recommendations -->
                </div>
            </div>
        `;
  }

  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Step 1: Dimension inputs
    const dimensionInputs = ["height", "width", "depth"];
    dimensionInputs.forEach((id, index) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.validateStep1());
        
        // Add Enter key listener to advance to next field
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            
            // If this is the last field and validation passes, proceed to step 2
            if (index === dimensionInputs.length - 1 && this.validateStep1()) {
              this.proceedToStep2();
            } else {
              // Otherwise, focus on the next field
              const nextIndex = index + 1;
              if (nextIndex < dimensionInputs.length) {
                const nextInput = document.getElementById(dimensionInputs[nextIndex]);
                if (nextInput) {
                  nextInput.focus();
                }
              }
            }
          }
        });
      }
    });

    // Next button for step 1
    const nextBtn = document.getElementById("next-step-1");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.proceedToStep2());
    }

    // Find boxes button
    const findBtn = document.getElementById("find-boxes");
    if (findBtn) {
      findBtn.addEventListener("click", () => this.findBestBoxes());
    }
  }

  /**
   * Validate step 1 inputs
   */
  validateStep1() {
    const height = parseFloat(document.getElementById("height").value);
    const width = parseFloat(document.getElementById("width").value);
    const depth = parseFloat(document.getElementById("depth").value);

    const isValid = height > 0 && width > 0 && depth > 0;
    document.getElementById("next-step-1").disabled = !isValid;

    return isValid;
  }

  /**
   * Proceed to step 2
   */
  proceedToStep2() {
    // Capture dimensions
    const height = parseFloat(document.getElementById("height").value);
    const width = parseFloat(document.getElementById("width").value);
    const depth = parseFloat(document.getElementById("depth").value);

    // Sort dimensions (largest to smallest)
    this.state.itemDims = [height, width, depth].sort((a, b) => b - a);

    // Update UI
    document.querySelector("#step-1 .step-number").classList.add("completed");
    document.getElementById("step-2").classList.remove("hidden");
    
    // Adaptive scrolling based on viewport height
    const step2Element = document.getElementById("step-2");
    const viewportHeight = window.innerHeight;
    
    if (viewportHeight < 800) {
      // Small screen: manually scroll to account for fixed nav
      const navElement = document.querySelector('nav');
      const navHeight = navElement ? navElement.offsetHeight : 0;
      const navIsFixed = navElement && window.getComputedStyle(navElement).position === 'fixed';
      
      // Calculate scroll position to put element at top (accounting for fixed nav)
      const targetScrollY = step2Element.offsetTop - (navIsFixed ? navHeight : 0);
      
      // Use a small delay to ensure DOM is ready
      setTimeout(() => {
        // Try direct scroll first
        window.scrollTo(0, targetScrollY);
        
        // Then try smooth scroll as backup
        setTimeout(() => {
          const currentScroll = window.scrollY;
          if (Math.abs(currentScroll - targetScrollY) > 10) {
            // Force scroll using scrollTop
            document.documentElement.scrollTop = targetScrollY;
            document.body.scrollTop = targetScrollY; // For some browsers
          }
        }, 100);
      }, 50);
    } else {
      // Normal screen: standard smooth scroll
      step2Element.scrollIntoView({ behavior: "smooth" });
    }

    // Show packing levels
    this.showPackingLevels();
  }

  /**
   * Show available packing levels
   */
  async showPackingLevels() {
    // Initialize packing rules manager
    let rulesManager;
    if (typeof PackingRulesManager !== "undefined") {
      rulesManager = new PackingRulesManager(this.storeId);
    }

    // Define packing levels with dynamic descriptions
    const packingTypes = [
      { apiName: "Basic", displayName: "Basic Pack", available: true },
      { apiName: "Standard", displayName: "Standard Pack", available: true },
      { apiName: "Fragile", displayName: "Fragile Pack", available: true },
      { apiName: "Custom", displayName: "Custom Pack", available: true },
    ];

    const levels = [];

    for (const type of packingTypes) {
      if (!type.available) continue;

      let padding = 0;
      let description = "";

      if (rulesManager) {
        try {
          // Get dynamic values
          padding = await rulesManager.getPaddingInches(type.apiName);
          description = await rulesManager.getWizardDescription(type.apiName);
        } catch (error) {
          console.warn(
            `Could not load dynamic rules for ${type.apiName}, using defaults`,
            error
          );
          // Use defaults on error
          padding = this.getDefaultPadding(type.apiName);
          description = this.getDefaultDescription(type.apiName);
        }
      } else {
        // No rules manager, use defaults
        padding = this.getDefaultPadding(type.apiName);
        description = this.getDefaultDescription(type.apiName);
      }

      levels.push({
        name: type.displayName,
        padding: padding,
        description: description,
        available: type.available,
      });
    }

    const container = document.getElementById("packing-levels");
    container.innerHTML = "";

    levels.forEach((level) => {
      if (!level.available) return;

      const option = document.createElement("div");
      option.className = "packing-option";
      const paddingText =
        level.padding === 0
          ? "No padding required"
          : `${level.padding}" padding on all sides`;
      // Create elements safely to prevent XSS
      const h4 = document.createElement('h4');
      h4.textContent = level.name;
      
      const paddingDiv = document.createElement('div');
      paddingDiv.className = 'padding-info';
      paddingDiv.textContent = paddingText;
      
      const descDiv = document.createElement('div');
      descDiv.className = 'text-muted';
      descDiv.textContent = level.description;
      
      option.appendChild(h4);
      option.appendChild(paddingDiv);
      option.appendChild(descDiv);

      option.addEventListener("click", () =>
        this.selectPackingLevel(level.name, option)
      );
      // Store the API name in data attribute for later use
      option.dataset.apiName = packingTypes.find(t => t.displayName === level.name)?.apiName || level.name;
      container.appendChild(option);
    });
  }

  /**
   * Select a packing level
   */
  selectPackingLevel(packingLevel, optionElement) {
    // Update visual selection
    document.querySelectorAll(".packing-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    optionElement.classList.add("selected");

    // Store selection
    this.state.selectedPackingLevel = packingLevel;

    // Enable find boxes button
    document.getElementById("find-boxes").disabled = false;
  }

  /**
   * Find best boxes
   */
  async findBestBoxes() {
    // Update step 2 visual
    document.querySelector("#step-2 .step-number").classList.add("completed");

    // Show loading state
    const resultsContainer = document.getElementById("results-container");
    resultsContainer.innerHTML =
      '<div class="loading"><div class="loading-spinner"></div><p>Finding best boxes...</p></div>';

    // Show step 3
    document.getElementById("step-3").classList.remove("hidden");
    
    // Adaptive scrolling based on viewport height
    const step3Element = document.getElementById("step-3");
    const viewportHeight = window.innerHeight;
    
    if (viewportHeight < 800) {
      // Small screen: manually scroll to account for fixed nav
      const navElement = document.querySelector('nav');
      const navHeight = navElement ? navElement.offsetHeight : 0;
      const navIsFixed = navElement && window.getComputedStyle(navElement).position === 'fixed';
      
      // Calculate scroll position to put element at top (accounting for fixed nav)
      const targetScrollY = step3Element.offsetTop - (navIsFixed ? navHeight : 0);
      
      // Use a small delay to ensure DOM is ready
      setTimeout(() => {
        // Try direct scroll first
        window.scrollTo(0, targetScrollY);
        
        // Then try smooth scroll as backup
        setTimeout(() => {
          const currentScroll = window.scrollY;
          if (Math.abs(currentScroll - targetScrollY) > 10) {
            // Force scroll using scrollTop
            document.documentElement.scrollTop = targetScrollY;
            document.body.scrollTop = targetScrollY; // For some browsers
          }
        }, 100);
      }, 50);
    } else {
      // Normal screen: standard smooth scroll
      step3Element.scrollIntoView({ behavior: "smooth" });
    }

    // Call the callback to get recommendations
    try {
      // Get the API name from the selected option's data attribute
      const selectedOption = document.querySelector('.packing-option.selected');
      const packingLevelApi = selectedOption?.dataset.apiName || 'Basic';
      
      // Map API names to Box class packing level names
      const packingLevelMap = {
        'Basic': 'No Pack',
        'Standard': 'Standard Pack',
        'Fragile': 'Fragile Pack',
        'Custom': 'Custom Pack'
      };
      
      const boxPackingLevel = packingLevelMap[packingLevelApi] || 'No Pack';
      
      const recommendations = await this.onFindBoxes(
        this.state.itemDims,
        boxPackingLevel
      );
      this.displayRecommendations(recommendations);
    } catch (error) {
      console.error("Error finding boxes:", error);
      resultsContainer.innerHTML =
        '<div class="error">Error finding boxes. Please try again.</div>';
    }
  }

  /**
   * Display recommendations
   */
  displayRecommendations(recommendations) {
    const container = document.getElementById("results-container");

    if (recommendations.length === 0) {
      container.innerHTML = `
                <div class="no-results">
                    <p>No suitable boxes found for your item with ${this.state.selectedPackingLevel}.</p>
                    <p>Try the <a href="/${this.storeId}">Advanced Packing Calculator</a> for more options.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = "";

    recommendations.forEach((rec, index) => {
      const card = this.createRecommendationCard(rec, index);
      container.appendChild(card);
    });
  }

  /**
   * Create a recommendation card
   */
  createRecommendationCard(rec, index) {
    const card = document.createElement("div");
    card.className = "recommendation-card" + (index === 0 ? " best" : "");

    const box = rec.box;
    const origDims = box.originalDimensions || box.dimensions;
    const model = box.model || "Unknown Box";

    // Build the box title
    let boxTitle = `${model} (${origDims[0]}"×${origDims[1]}"×${origDims[2]}")`;

    // If it's a cut-down strategy, show what it's being cut to
    if (rec.result.strategy === "Cut Down" && rec.cutDepth) {
      if (rec.isAlternateDepth) {
        boxTitle += ` scored to ${origDims[0]}"×${origDims[1]}"×${rec.cutDepth}"`;
      } else {
        boxTitle += ` cut to ${origDims[0]}"×${origDims[1]}"×${rec.cutDepth}"`;
      }
    }

    // Get box base price - only for itemized pricing
    let boxPriceDisplay = '';
    
    // Check if this box has itemized pricing info stored
    if (rec.box.itemizedPrices && rec.box.itemizedPrices['box-price'] !== undefined) {
      // We have itemized pricing - show the actual box-only price
      const boxPrice = rec.box.itemizedPrices['box-price'];
      boxPriceDisplay = `<div class="box-cost">Box: $${boxPrice.toFixed(2)}</div>`;
      
      // Extract box quantity for telescoping
      if (rec.result.strategy === "Telescoping" && rec.result.comment) {
        const match = rec.result.comment.match(/with (\d+) boxes/);
        if (match) {
          const boxQuantity = parseInt(match[1]);
          boxPriceDisplay = `<div class="box-cost">Box: $${boxPrice.toFixed(2)} <span style="color: black; background: yellow; padding: 0 4px; border-radius: 3px; font-weight: bold;">×${boxQuantity}</span></div>`;
        }
      }
    }
    // For standard pricing, we don't show box-only price since we can't separate it

    // Generate unique ID for this recommendation
    const recId = `rec-${index}-${Date.now()}`;

    card.innerHTML = `
            <div class="card-rank">#${index + 1}</div>
            <div class="box-details">
                <div class="box-info">
                    <h3>${boxTitle}</h3>
                    <div class="dimensions">${rec.result.strategy}${
      rec.result.comment ? " - " + rec.result.comment : ""
    }</div>
                </div>
                <div class="box-badges">
                    ${
                      rec.tag
                        ? `<span class="recommendation-badge ${rec.tagClass}">${rec.tag}</span>`
                        : ""
                    }
                </div>
            </div>
            <div class="box-pricing">
                <div class="total-price">$${rec.result.price.toFixed(2)}</div>
                ${boxPriceDisplay}
            </div>
            <div class="action-icons">
                <button class="icon-button" onclick="showBoxLocation('${
                  box.model
                }', '${recId}')" title="Show on Map">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button class="icon-button" onclick="printRecommendation('${recId}', ${index})" title="Print Label">
                    <i class="fas fa-print"></i>
                </button>
            </div>
        `;

    // Store recommendation data for printing
    card.dataset.recommendation = JSON.stringify({
      box: {
        model: box.model,
        dimensions: box.originalDimensions || box.dimensions,
        location: box.location,
        prices: box.prices,
        itemizedPrices: box.itemizedPrices, // Include itemized prices if available
      },
      result: rec.result,
      boxTitle: boxTitle,
      boxPrice: rec.box.itemizedPrices && rec.box.itemizedPrices['box-price'] || null,
      isPreScored: rec.isAlternateDepth,
      cutDepth: rec.cutDepth,
      packingLevel: this.state.selectedPackingLevel,
      packingLevelApi: document.querySelector('.packing-option.selected')?.dataset.apiName || 'Basic',
    });

    return card;
  }
}

// Export for use
if (typeof window !== "undefined") {
  window.WizardUI = WizardUI;
}
