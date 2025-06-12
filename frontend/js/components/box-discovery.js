/**
 * Box Discovery from Price Sheets
 * Allows discovering and importing boxes from Excel price files
 */

class BoxDiscovery {
  constructor() {
    this.discoveryResults = null;
    this.storeId = null;
  }

  /**
   * Initialize box discovery functionality
   */
  async init(storeId) {
    this.storeId = storeId;
    // No longer need to add button - new unified flow handles it
  }

  /**
   * Handle box discovery from uploaded file
   */
  async handleDiscovery(file) {
    if (!file) return;

    // Show loading
    document.getElementById("loading").style.display = "block";
    document.getElementById("results").style.display = "none";

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await authenticatedFetch(
        `/api/store/${this.storeId}/discover_boxes`,
        this.storeId,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const data = await response.json();

      this.discoveryResults = data;
      this.displayDiscoveryResults();
    } catch (error) {
      console.error("Box discovery failed:", error);
      alert("Failed to discover boxes: " + error.message);
    } finally {
      document.getElementById("loading").style.display = "none";
    }
  }

  /**
   * Display discovery results
   */
  displayDiscoveryResults() {
    const resultsDiv = document.getElementById("results");
    resultsDiv.style.display = "block";

    // Clear existing results
    resultsDiv.innerHTML = "";

    // Add discovery results sections
    resultsDiv.innerHTML = `
            <div class="discovery-results">
                <h2>Box Discovery Results</h2>
                
                <!-- Summary -->
                <div class="discovery-summary">
                    <div class="summary-card">
                        <h3>📊 Summary</h3>
                        <ul>
                            <li>Total boxes found: <strong>${
                              this.discoveryResults.summary.total_boxes_found
                            }</strong></li>
                            <li>Already in store: <strong>${
                              this.discoveryResults.summary.already_in_store
                            }</strong></li>
                            <li>New dimensions: <strong>${
                              this.discoveryResults.summary.new_dimensions
                            }</strong></li>
                            <li>Exact library matches: <strong>${
                              this.discoveryResults.summary.exact_matches
                            }</strong></li>
                            <li>Need custom boxes: <strong>${
                              this.discoveryResults.summary.unmatched
                            }</strong></li>
                        </ul>
                    </div>
                </div>

                <!-- Exact Matches -->
                ${this.renderExactMatches()}
                
                <!-- Unmatched Dimensions -->
                ${this.renderUnmatchedDimensions()}
                
                <!-- Already in Store -->
                ${this.renderAlreadyInStore()}
                
                <!-- Action Buttons -->
                <div class="discovery-actions">
                    <button class="btn btn-primary" onclick="boxDiscovery.importSelectedBoxes()">
                        Import Selected Boxes
                    </button>
                    <button class="btn btn-secondary" onclick="location.reload()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render exact matches section
   */
  renderExactMatches() {
    if (!this.discoveryResults.library_matches.length) {
      return "";
    }

    const matches = this.discoveryResults.library_matches
      .map((match, idx) => {
        const boxes = match.library_boxes;
        const discovered = match.discovered;

        // If only one box variation, auto-select it
        if (boxes.length === 1) {
          const box = boxes[0];
          return `
                    <tr>
                        <td>
                            <input type="checkbox" class="box-select" checked
                                   data-type="library" 
                                   data-dimensions="${box.dimensions.join(",")}"
                                   data-alternate-depths="${(
                                     box.alternate_depths || []
                                   ).join(",")}">
                        </td>
                        <td>${discovered.dimensions_str}</td>
                        <td>${discovered.count}</td>
                        <td>${box.display_name}</td>
                        <td>
                            <select class="name-select" data-dimensions="${
                              discovered.dimensions_str
                            }">
                                <option value="${discovered.dimensions_str}">${
            discovered.dimensions_str
          }</option>
                                ${(box.names || [])
                                  .map(
                                    (name) =>
                                      `<option value="${name}">${name}</option>`
                                  )
                                  .join("")}
                            </select>
                        </td>
                    </tr>
                `;
        }

        // Multiple boxes with same dimensions - user must choose
        return `
                <tr>
                    <td>
                        <input type="checkbox" class="box-select" 
                               data-type="library"
                               data-match-idx="${idx}">
                    </td>
                    <td>${discovered.dimensions_str}</td>
                    <td>${discovered.count}</td>
                    <td colspan="2">
                        <div class="box-variant-selector">
                            <strong>⚠️ Multiple variations found - please select one:</strong>
                            ${boxes
                              .map(
                                (box, boxIdx) => `
                                <div class="box-variant">
                                    <input type="radio" 
                                           name="box-variant-${idx}" 
                                           id="variant-${idx}-${boxIdx}"
                                           value="${boxIdx}"
                                           data-dimensions="${box.dimensions.join(
                                             ","
                                           )}"
                                           data-alternate-depths="${(
                                             box.alternate_depths || []
                                           ).join(",")}"
                                           onchange="boxDiscovery.selectVariant(${idx}, ${boxIdx})">
                                    <label for="variant-${idx}-${boxIdx}">
                                        ${box.display_name}
                                        <br><small>Names: ${(box.names || []).join(
                                          ", "
                                        )}</small>
                                    </label>
                                </div>
                            `
                              )
                              .join("")}
                            <div class="name-select-wrapper" id="name-select-${idx}" style="display:none;">
                                <strong>Choose name:</strong>
                                <select class="name-select" data-dimensions="${
                                  discovered.dimensions_str
                                }">
                                    <!-- Options will be populated when variant is selected -->
                                </select>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join("");

    return `
            <div class="discovery-section">
                <h3>✅ Exact Library Matches</h3>
                <p>These dimensions exactly match boxes in our library:</p>
                <table class="discovery-table">
                    <thead>
                        <tr>
                            <th>Select</th>
                            <th>Dimensions</th>
                            <th>Count in Excel</th>
                            <th>Library Match</th>
                            <th>Choose Name</th>
                        </tr>
                    </thead>
                    <tbody>${matches}</tbody>
                </table>
            </div>
        `;
  }

  /**
   * Handle variant selection for boxes with multiple prescoring options
   */
  selectVariant(matchIdx, boxIdx) {
    const match = this.discoveryResults.library_matches[matchIdx];
    const selectedBox = match.library_boxes[boxIdx];

    // Show name selector
    const nameWrapper = document.getElementById(`name-select-${matchIdx}`);
    nameWrapper.style.display = "block";

    // Populate name options
    const nameSelect = nameWrapper.querySelector(".name-select");
    nameSelect.innerHTML = `
            <option value="${match.discovered.dimensions_str}">${
      match.discovered.dimensions_str
    }</option>
            ${selectedBox.names
              .map((name) => `<option value="${name}">${name}</option>`)
              .join("")}
        `;

    // Store selected box data on checkbox
    const checkbox = document.querySelector(
      `input[data-match-idx="${matchIdx}"]`
    );
    checkbox.dataset.dimensions = selectedBox.dimensions.join(",");
    checkbox.dataset.alternateDepths = (
      selectedBox.alternate_depths || []
    ).join(",");
    checkbox.checked = true;
  }

  /**
   * Render unmatched dimensions section
   */
  renderUnmatchedDimensions() {
    if (!this.discoveryResults.unmatched_dimensions.length) {
      return "";
    }

    const unmatched = this.discoveryResults.unmatched_dimensions
      .map((item) => {
        return `
                <tr>
                    <td>❌</td>
                    <td>${item.dimensions_str}</td>
                    <td>${item.count}</td>
                    <td>${item.models.slice(0, 2).join("<br>")}</td>
                    <td style="color: #666;">No exact match in library</td>
                </tr>
            `;
      })
      .join("");

    return `
            <div class="discovery-section">
                <h3>❌ No Library Match</h3>
                <p>These dimensions have no exact match in our library. Add them manually later:</p>
                <table class="discovery-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Dimensions</th>
                            <th>Count</th>
                            <th>Examples</th>
                            <th>Note</th>
                        </tr>
                    </thead>
                    <tbody>${unmatched}</tbody>
                </table>
            </div>
        `;
  }

  /**
   * Render already in store section
   */
  renderAlreadyInStore() {
    if (!this.discoveryResults.already_in_store.length) {
      return "";
    }

    const existing = this.discoveryResults.already_in_store
      .map((item) => {
        return `
                <tr>
                    <td>✓</td>
                    <td>${item.dimensions_str}</td>
                    <td>${item.count}</td>
                    <td>${
                      item.avg_price ? `$${item.avg_price.toFixed(2)}` : "-"
                    }</td>
                </tr>
            `;
      })
      .join("");

    return `
            <div class="discovery-section">
                <h3>✓ Already in Store</h3>
                <p>These boxes are already in your inventory:</p>
                <table class="discovery-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Dimensions</th>
                            <th>Count in Excel</th>
                            <th>Avg Price</th>
                        </tr>
                    </thead>
                    <tbody>${existing}</tbody>
                </table>
            </div>
        `;
  }

  /**
   * Import selected boxes
   */
  async importSelectedBoxes() {
    // Get the button and check if already processing
    const importBtn = document.querySelector('.discovery-actions .btn-primary');
    if (!importBtn || importBtn.disabled) {
      return; // Already processing or button not found
    }

    // Lock the button immediately
    importBtn.disabled = true;
    const originalText = importBtn.textContent;
    importBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span> Processing...';

    const selectedBoxes = [];

    // Collect selected boxes
    document.querySelectorAll(".box-select:checked").forEach((checkbox) => {
      // Skip if it's for a multi-variant match without selection
      if (
        checkbox.dataset.matchIdx !== undefined &&
        !checkbox.dataset.dimensions
      ) {
        return;
      }

      const row = checkbox.closest("tr");
      const nameSelect = row.querySelector(".name-select");

      if (!nameSelect || !nameSelect.value) {
        return;
      }

      const dimensions = checkbox.dataset.dimensions
        .split(",")
        .map((d) => parseFloat(d));
      const alternateDepths = checkbox.dataset.alternateDepths
        ? checkbox.dataset.alternateDepths.split(",").map((d) => parseFloat(d))
        : [];

      selectedBoxes.push({
        type: "library",
        dimensions: dimensions,
        alternate_depths: alternateDepths,
        model: nameSelect.value,
      });
    });

    if (!selectedBoxes.length) {
      alert("Please select at least one box to import");
      importBtn.disabled = false;
      importBtn.textContent = originalText;
      return;
    }

    // Update progress
    importBtn.innerHTML = `<span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span> Importing ${selectedBoxes.length} boxes...`;

    try {
      // Prepare all boxes for batch import
      const boxPayload = selectedBoxes.map(box => ({
        dimensions: box.dimensions,
        alternate_depths: box.alternate_depths,
        model: box.model,
        from_library: box.type === 'library',
        // Add offered names for analytics if available
        offered_names: box.offered_names || []
      }));

      // Import all boxes in one request
      const response = await authenticatedFetch(
        `/api/store/${this.storeId}/boxes/batch`,
        this.storeId,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(boxPayload),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      
      // Success! Show completion
      importBtn.innerHTML = '✓ Import Complete!';
      importBtn.style.backgroundColor = '#27ae60';
      
      alert(
        `${result.message}!\n\nYou can now import prices for these boxes.`
      );

      // Reload page to show normal import interface
      setTimeout(() => {
        location.reload();
      }, 1000);
    } catch (error) {
      console.error("Failed to import boxes:", error);
      alert("Failed to import boxes: " + error.message);
      
      // Restore button state on error
      importBtn.disabled = false;
      importBtn.textContent = originalText;
      importBtn.style.backgroundColor = '';
    }
  }
}

// Initialize global instance
const boxDiscovery = new BoxDiscovery();

// Add styles
const style = document.createElement("style");
style.textContent = `
.discovery-results {
    padding: 20px;
}

.discovery-summary {
    margin-bottom: 30px;
}

.summary-card {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
}

.discovery-section {
    margin-bottom: 30px;
}

.discovery-section h3 {
    margin-bottom: 10px;
}

.discovery-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}

.discovery-table th,
.discovery-table td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}

.discovery-table th {
    background-color: #f2f2f2;
    font-weight: bold;
}

.discovery-table tr:nth-child(even) {
    background-color: #f9f9f9;
}

.name-select,
.model-input {
    width: 100%;
    padding: 4px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

.discovery-actions {
    margin-top: 30px;
    text-align: center;
}

.discovery-actions .btn {
    margin: 0 10px;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.btn-secondary {
    background: #6c757d;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
}

.btn-secondary:hover {
    background: #5a6268;
}

.box-variant-selector {
    text-align: left;
}

.box-variant {
    margin: 10px 0;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 4px;
}

.box-variant input[type="radio"] {
    margin-right: 10px;
}

.box-variant label {
    cursor: pointer;
    display: inline-block;
}

.name-select-wrapper {
    margin-top: 15px;
    padding: 10px;
    background: #e9ecef;
    border-radius: 4px;
}
`;
document.head.appendChild(style);
