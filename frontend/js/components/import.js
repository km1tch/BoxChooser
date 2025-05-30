// Import management component
let importData = null;
let currentStoreId = null;
let currentPriceData = {};
let mappedDimensions = new Set(); // Track dimensions already mapped for 1:1 mapping

// Initialize import functionality
function initializeImport(storeId) {
    console.log('Initializing import for store:', storeId);
    currentStoreId = storeId;
    setupFileUpload();
    loadStorePriceGroup();
}

// Load store price group info
async function loadStorePriceGroup() {
    try {
        if (!currentStoreId) {
            console.error('Store ID not set');
            document.getElementById('price-group').textContent = 'N/A';
            return;
        }
        
        const token = AuthManager.getToken(currentStoreId);
        if (!token) {
            console.error('No auth token available for store', currentStoreId);
            console.log('Available tokens:', localStorage);
            console.log('AuthManager available?', typeof AuthManager !== 'undefined');
            document.getElementById('price-group').textContent = 'N/A';
            return;
        }
        
        const response = await apiUtils.authenticatedFetch(`/api/store/${currentStoreId}/info`, currentStoreId);
        
        if (!response.ok) {
            // If not admin or endpoint fails, just show N/A
            document.getElementById('price-group').textContent = 'N/A';
            return;
        }
        
        const data = await response.json();
        
        // Get price group from store config
        const priceGroup = data['price-group'] || 'Not Set';
        document.getElementById('price-group').textContent = priceGroup;
    } catch (error) {
        console.error('Error loading store info:', error);
        document.getElementById('price-group').textContent = 'N/A';
    }
}

// Setup file upload handlers
function setupFileUpload() {
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadZone = document.getElementById('upload-zone');
    
    // Button click
    uploadBtn.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('click', () => fileInput.click());
    
    // File selection
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Handle file upload and analysis
async function handleFile(file) {
    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        alert('Please select an Excel file (.xlsx or .xls)');
        return;
    }
    
    // Show loading
    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('loading').classList.add('active');
    document.getElementById('results').style.display = 'none';
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        // Check if user is authenticated
        const token = AuthManager.getToken(currentStoreId);
        if (!token) {
            alert('Please log in to use the import feature.');
            window.location.href = `/login?redirect=/import`;
            return;
        }
        
        const response = await apiUtils.authenticatedFetch(`/api/store/${currentStoreId}/import/analyze`, currentStoreId, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                window.location.href = `/login?redirect=/import`;
                return;
            }
            throw new Error(`Analysis failed: ${response.statusText}`);
        }
        
        importData = await response.json();
        displayResults();
        
    } catch (error) {
        console.error('Error analyzing file:', error);
        alert('Error analyzing file: ' + error.message);
        resetUpload();
    } finally {
        document.getElementById('loading').classList.remove('active');
    }
}

// Display analysis results
function displayResults() {
    document.getElementById('results').style.display = 'block';
    
    // Reset mapped dimensions tracking
    mappedDimensions.clear();
    
    // Track dimensions already matched (perfect and probable matches)
    importData.perfect_matches.forEach(match => {
        if (match.box.dimensions_int) {
            mappedDimensions.add(match.box.dimensions_int);
        }
    });
    
    importData.probable_matches.forEach(match => {
        if (match.box.dimensions_int) {
            mappedDimensions.add(match.box.dimensions_int);
        }
    });
    
    // Also track incomplete matches as they have dimension matches
    if (importData.incomplete_matches) {
        importData.incomplete_matches.forEach(match => {
            if (match.box.dimensions_int) {
                mappedDimensions.add(match.box.dimensions_int);
            }
        });
    }
    
    // Update counts
    document.getElementById('perfect-count').textContent = importData.summary.perfect_matches;
    document.getElementById('probable-count').textContent = importData.summary.probable_matches;
    document.getElementById('incomplete-count').textContent = importData.summary.incomplete_matches || 0;
    document.getElementById('manual-count').textContent = importData.summary.manual_required;
    
    // Create and display progress bar
    displayProgressBar();
    
    // Display perfect matches
    displayPerfectMatches();
    
    // Display probable matches
    displayProbableMatches();
    
    // Display incomplete matches (missing categories)
    displayIncompleteMatches();
    
    // Display manual mapping required
    displayManualMatches();
}

// Display progress bar showing match distribution
function displayProgressBar() {
    const total = importData.summary.total_boxes;
    const perfect = importData.summary.perfect_matches;
    const probable = importData.summary.probable_matches;
    const incomplete = importData.summary.incomplete_matches || 0;
    const manual = importData.summary.manual_required;
    
    const perfectPercent = (perfect / total * 100).toFixed(1);
    const probablePercent = (probable / total * 100).toFixed(1);
    const incompletePercent = (incomplete / total * 100).toFixed(1);
    const manualPercent = (manual / total * 100).toFixed(1);
    
    // Remove any existing progress bar
    const existingProgress = document.querySelector('.match-distribution');
    if (existingProgress) {
        existingProgress.parentElement.remove();
    }
    
    // Create progress bar HTML
    const progressHTML = `
        <div class="match-distribution">
            <h3>Match Distribution</h3>
            <div class="progress-bar">
                <div class="progress-segment perfect" style="width: ${perfectPercent}%">
                    <span class="progress-label">${perfect} (${perfectPercent}%)</span>
                </div>
                <div class="progress-segment probable" style="width: ${probablePercent}%">
                    <span class="progress-label">${probable} (${probablePercent}%)</span>
                </div>
                <div class="progress-segment incomplete" style="width: ${incompletePercent}%">
                    <span class="progress-label">${incomplete} (${incompletePercent}%)</span>
                </div>
                <div class="progress-segment manual" style="width: ${manualPercent}%">
                    <span class="progress-label">${manual} (${manualPercent}%)</span>
                </div>
            </div>
            <div class="progress-legend">
                <div class="legend-item">
                    <span class="legend-color perfect"></span>
                    <span>Perfect Matches</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color probable"></span>
                    <span>Probable Matches</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color incomplete"></span>
                    <span>Incomplete Categories</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color manual"></span>
                    <span>Manual Mapping</span>
                </div>
            </div>
        </div>
    `;
    
    // Insert after the header and before first section
    const resultsDiv = document.getElementById('results');
    const firstSection = resultsDiv.querySelector('.import-section');
    const progressDiv = document.createElement('div');
    progressDiv.innerHTML = progressHTML;
    resultsDiv.insertBefore(progressDiv, firstSection);
}

// Display perfect matches section
function displayPerfectMatches() {
    const section = document.getElementById('perfect-section');
    const container = document.getElementById('perfect-matches');
    const summary = document.getElementById('perfect-summary');
    
    if (importData.perfect_matches.length === 0) {
        // Hide the entire section content except header
        section.querySelector('.section-content').style.display = 'none';
        // Remove the button from header
        const button = section.querySelector('.btn-success');
        if (button) button.style.display = 'none';
        return;
    }
    
    // Show section content
    section.querySelector('.section-content').style.display = 'block';
    
    summary.innerHTML = `
        <p><strong>Summary:</strong> ${importData.perfect_matches.length} boxes matched via item numbers</p>
    `;
    
    // Optionally show detailed list (collapsed by default)
    let html = '<details><summary>View Details</summary><ul>';
    importData.perfect_matches.forEach(match => {
        html += `<li>${match.box.model} (${match.box.dimensions})</li>`;
    });
    html += '</ul></details>';
    container.innerHTML = html;
}

// Display probable matches section
function displayProbableMatches() {
    const section = document.getElementById('probable-section');
    const tbody = document.getElementById('probable-matches');
    
    if (importData.probable_matches.length === 0) {
        // Hide the entire section content except header
        section.querySelector('.section-content').style.display = 'none';
        // Remove the button from header
        const button = section.querySelector('.btn-primary');
        if (button) button.style.display = 'none';
        tbody.innerHTML = '';
        return;
    }
    
    // Show section content
    section.querySelector('.section-content').style.display = 'block';
    tbody.innerHTML = '';
    
    importData.probable_matches.forEach((match, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        // Find box price and name from categories
        const boxItem = match.categories_found.box;
        const boxPrice = boxItem ? boxItem.price : 0;
        const excelBoxName = boxItem ? boxItem.product_name : `${match.box.dimensions} Box`;
        
        row.innerHTML = `
            <td>${match.box.model}</td>
            <td>${match.box.dimensions}</td>
            <td>${excelBoxName}</td>
            <td class="price-preview">
                <span>Box: $${boxPrice.toFixed(2)}</span>
            </td>
            <td>
                <button class="btn btn-sm" onclick="approveProbableMatch(${index})">Approve</button>
                <button class="btn btn-sm" onclick="skipProbableMatch(${index})">Skip</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Display incomplete matches section (missing categories)
function displayIncompleteMatches() {
    const section = document.getElementById('incomplete-section');
    const tbody = document.getElementById('incomplete-matches');
    
    if (!importData.incomplete_matches || importData.incomplete_matches.length === 0) {
        // Hide the entire section content except header
        section.querySelector('.section-content').style.display = 'none';
        tbody.innerHTML = '';
        return;
    }
    
    // Show section content
    section.querySelector('.section-content').style.display = 'block';
    tbody.innerHTML = '';
    
    importData.incomplete_matches.forEach((item, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        // List available categories
        const availableCategories = Object.keys(item.categories_found).map(cat => {
            const catDisplay = cat.replace(/_/g, ' ');
            return `<span class="category-tag">${catDisplay}</span>`;
        }).join(' ');
        
        // List missing categories
        const missingCategories = item.missing_categories.map(cat => {
            const catDisplay = cat.replace(/_/g, ' ');
            return `<span class="category-tag missing">${catDisplay}</span>`;
        }).join(' ');
        
        row.innerHTML = `
            <td>
                <strong>${item.box.model}</strong>
            </td>
            <td>${item.box.dimensions}</td>
            <td>${missingCategories}</td>
            <td>${availableCategories}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="browseForMissingCategories(${index})">Find Missing</button>
                <button class="btn btn-sm" onclick="skipIncompleteMatch(${index})">Skip</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Display manual mapping section (dimension mismatches only)
function displayManualMatches() {
    const section = document.getElementById('manual-section');
    const tbody = document.getElementById('manual-matches');
    
    // Filter to only show dimension mismatches (not incomplete ones)
    const dimensionMismatches = importData.manual_required.filter(item => 
        item.reason === 'no_dimension_match'
    );
    
    if (dimensionMismatches.length === 0) {
        // Hide the entire section content except header
        section.querySelector('.section-content').style.display = 'none';
        tbody.innerHTML = '';
        return;
    }
    
    // Show section content
    section.querySelector('.section-content').style.display = 'block';
    tbody.innerHTML = '';
    
    dimensionMismatches.forEach((item, originalIndex) => {
        // Find the original index in manual_required array
        const index = importData.manual_required.indexOf(item);
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        // Create options for dropdown - try to find similar dimensions
        let options = '<option value="">Select Excel dimension group...</option>';
        
        // Get similar dimensions (within 2 inches on any dimension)
        const boxDims = item.box.dimensions_int.split('x').map(d => parseInt(d));
        const similarDimensions = [];
        
        for (const [dimStr, items] of Object.entries(importData.excel_dimension_groups)) {
            const excelDims = dimStr.split('x').map(d => parseInt(d));
            
            // Check if dimensions are similar (within 2 inches on each dimension)
            const isSimilar = boxDims.every((boxDim, i) => 
                Math.abs(boxDim - excelDims[i]) <= 2
            );
            
            if (isSimilar && items.length > 0) {
                similarDimensions.push({
                    dimension: dimStr,
                    itemCount: items.length,
                    hasAllCategories: _checkHasAllCategories(items)
                });
            }
        }
        
        // Sort by closest match
        similarDimensions.sort((a, b) => {
            const aDims = a.dimension.split('x').map(d => parseInt(d));
            const bDims = b.dimension.split('x').map(d => parseInt(d));
            const aDiff = aDims.reduce((sum, dim, i) => sum + Math.abs(dim - boxDims[i]), 0);
            const bDiff = bDims.reduce((sum, dim, i) => sum + Math.abs(dim - boxDims[i]), 0);
            return aDiff - bDiff;
        });
        
        // Add similar dimensions to dropdown
        similarDimensions.forEach(({ dimension, itemCount, hasAllCategories }) => {
            const completeness = hasAllCategories ? '✓' : '⚠';
            options += `<option value="${dimension}">${dimension} (${itemCount} items) ${completeness}</option>`;
        });
        
        // Add option to browse all dimensions
        options += '<option value="browse">Browse all dimensions...</option>';
        options += '<option value="skip">No match / Skip</option>';
        
        row.innerHTML = `
            <td>
                <strong>${item.box.model}</strong><br>
                <span class="text-muted">${item.box.dimensions}</span>
            </td>
            <td>
                <select class="mapping-select" onchange="handleDimensionMapping(${index}, this)">
                    ${options}
                </select>
            </td>
            <td>
                <button class="btn btn-sm" onclick="mapDimensionMatch(${index})" disabled>Map</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Toggle section visibility
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle('collapsed');
}

// Update all perfect matches
async function updateAllPerfectMatches(event) {
    event.stopPropagation();
    
    if (!confirm('Update all perfect match prices?')) {
        return;
    }
    
    // Mark perfect matches for update
    importData.perfect_matches.forEach(match => {
        match.approved = true;
        // Log what we're approving
    });
    
    alert(`${importData.perfect_matches.length} perfect matches approved for update. Click "Apply Changes" button at the bottom of the page to save to YAML.`);
    
    // Also scroll to the Apply Changes button
    const applyButton = document.querySelector('button[onclick="applyImportChanges()"]');
    if (applyButton) {
        applyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        applyButton.style.backgroundColor = '#ff6b6b';
        applyButton.style.transform = 'scale(1.1)';
        setTimeout(() => {
            applyButton.style.backgroundColor = '';
            applyButton.style.transform = '';
        }, 2000);
    }
}

// Approve single probable match
function approveProbableMatch(index) {
    const match = importData.probable_matches[index];
    match.approved = true;
    
    // Update UI
    const row = document.querySelector(`#probable-matches tr[data-index="${index}"]`);
    row.style.backgroundColor = '#d4edda';
    row.querySelector('button').textContent = 'Approved';
}

// Skip probable match
function skipProbableMatch(index) {
    const match = importData.probable_matches[index];
    match.skipped = true;
    
    // Update UI
    const row = document.querySelector(`#probable-matches tr[data-index="${index}"]`);
    row.style.opacity = '0.5';
}

// Approve all probable matches
async function approveAllProbableMatches(event) {
    event.stopPropagation();
    
    if (!confirm('Approve all probable matches?')) {
        return;
    }
    
    importData.probable_matches.forEach((match, index) => {
        if (!match.skipped) {
            approveProbableMatch(index);
        }
    });
}

// Handle manual mapping selection
function handleManualMapping(index, select) {
    const value = select.value;
    const button = select.parentElement.parentElement.querySelector('button');
    
    if (value === 'browse') {
        // Open browse modal
        openBrowseModal(index);
        select.value = '';
        button.disabled = true;
    } else if (value === 'skip' || value === '') {
        button.disabled = true;
    } else {
        button.disabled = false;
    }
}

// Browse modal functionality
let currentBrowseIndex = null;
let selectedItems = new Set();

function openBrowseModal(manualIndex) {
    currentBrowseIndex = manualIndex;
    selectedItems.clear();
    
    const modal = document.getElementById('browse-modal');
    modal.style.display = 'flex';
    
    // Populate items
    populateBrowseItems();
    
    // Setup search
    const searchInput = document.getElementById('browse-search');
    searchInput.value = '';
    searchInput.addEventListener('input', filterBrowseItems);
    
    // Setup grouping
    const groupBySelect = document.getElementById('browse-group-by');
    groupBySelect.addEventListener('change', populateBrowseItems);
}

function closeBrowseModal() {
    const modal = document.getElementById('browse-modal');
    modal.style.display = 'none';
    currentBrowseIndex = null;
    selectedItems.clear();
    
    // Reset event handlers
    const filterSelect = document.getElementById('browse-filter');
    const searchInput = document.getElementById('browse-search');
    
    if (filterSelect) {
        filterSelect.dataset.initialized = '';
        filterSelect.dataset.categoryInitialized = '';
    }
    
    if (searchInput) {
        searchInput.dataset.initialized = '';
        searchInput.dataset.categoryInitialized = '';
        searchInput.value = '';
    }
    
    // Reset filter options to default
    if (filterSelect) {
        filterSelect.innerHTML = `
            <option value="all">All dimensions</option>
            <option value="unmatched">Unmatched only</option>
            <option value="matched">Already matched</option>
        `;
    }
}

function populateBrowseItems() {
    const container = document.getElementById('browse-items-container');
    const groupBy = document.getElementById('browse-group-by').value;
    
    if (!importData || !importData.excel_dimension_groups) {
        container.innerHTML = '<div class="browse-empty">No Excel items available</div>';
        return;
    }
    
    // Flatten all items
    const allItems = [];
    for (const [dimension, items] of Object.entries(importData.excel_dimension_groups)) {
        items.forEach(item => {
            allItems.push({
                ...item,
                dimension: dimension
            });
        });
    }
    
    // Group items
    let grouped = {};
    if (groupBy === 'dimension') {
        grouped = importData.excel_dimension_groups;
    } else if (groupBy === 'category') {
        allItems.forEach(item => {
            const cat = item.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
    } else {
        grouped['All Items'] = allItems;
    }
    
    // Render grouped items
    let html = '';
    for (const [group, items] of Object.entries(grouped)) {
        html += `<div class="browse-group">`;
        html += `<div class="browse-group-header">${group}</div>`;
        
        items.forEach(item => {
            const categoryClass = item.category === 'box' ? 'box' : 
                                 (item.category && item.category.includes('material')) ? 'materials' : 
                                 (item.category && item.category.includes('service')) ? 'service' : 'other';
            
            const categoryDisplay = item.category ? item.category.replace(/_/g, ' ') : 'other';
            
            html += `
                <div class="browse-item" onclick="toggleBrowseItem('${item.item_id}')">
                    <input type="checkbox" class="browse-item-checkbox" 
                           data-item-id="${item.item_id}" 
                           data-item='${JSON.stringify(item).replace(/'/g, '&apos;')}'>
                    <div class="browse-item-info">
                        <span class="browse-item-id">${item.item_id}</span>
                        <span class="browse-item-name" title="${item.product_name}">${item.product_name}</span>
                        <span class="browse-item-price">$${item.price.toFixed(2)}</span>
                        <span class="browse-item-category ${categoryClass}">${categoryDisplay}</span>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    updateSelectedCount();
}

function toggleBrowseItem(itemId) {
    const checkbox = document.querySelector(`[data-item-id="${itemId}"]`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        const browseItem = checkbox.closest('.browse-item');
        
        if (checkbox.checked) {
            selectedItems.add(itemId);
            browseItem.classList.add('selected');
        } else {
            selectedItems.delete(itemId);
            browseItem.classList.remove('selected');
        }
        
        updateSelectedCount();
    }
}

function updateSelectedCount() {
    document.getElementById('selected-count').textContent = `${selectedItems.size} items selected`;
}

function filterBrowseItems() {
    const searchTerm = document.getElementById('browse-search').value.toLowerCase();
    const items = document.querySelectorAll('.browse-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
    
    // Hide empty groups
    document.querySelectorAll('.browse-group').forEach(group => {
        const visibleItems = group.querySelectorAll('.browse-item[style="display: flex;"], .browse-item:not([style])');
        group.style.display = visibleItems.length > 0 ? 'block' : 'none';
    });
}

function applyBrowseSelection() {
    // Handle dimension group selection
    if (currentBrowseIndex && currentBrowseIndex.startsWith('dimension_')) {
        // This is handled by selectDimensionGroup
        return;
    }
    
    // Handle incomplete category selection
    if (currentBrowseIndex && currentBrowseIndex.startsWith('incomplete_')) {
        if (selectedItems.size === 0) {
            alert('Please select at least one item for each missing category');
            return;
        }
        
        // Get selected items
        const selectedData = [];
        selectedItems.forEach(itemId => {
            const checkbox = document.querySelector(`[data-item-id="${itemId}"]`);
            if (checkbox) {
                const itemData = JSON.parse(checkbox.dataset.item);
                selectedData.push(itemData);
            }
        });
        
        // Store selection for incomplete match
        const index = parseInt(currentBrowseIndex.split('_')[1]);
        if (!importData.incomplete_matches[index].additional_items) {
            importData.incomplete_matches[index].additional_items = [];
        }
        importData.incomplete_matches[index].additional_items = selectedData;
        importData.incomplete_matches[index].resolved = true;
        
        // Update UI
        const row = document.querySelector(`#incomplete-matches tr[data-index="${index}"]`);
        row.style.backgroundColor = '#d4edda';
        const button = row.querySelector('.btn-warning');
        button.textContent = `${selectedData.length} items added`;
        button.disabled = true;
        
        closeBrowseModal();
        return;
    }
    
    // Original manual mapping logic (for backwards compatibility)
    if (selectedItems.size === 0) {
        alert('Please select at least one item');
        return;
    }
    
    // Get selected item data
    const selectedData = [];
    selectedItems.forEach(itemId => {
        const checkbox = document.querySelector(`[data-item-id="${itemId}"]`);
        if (checkbox) {
            const itemData = JSON.parse(checkbox.dataset.item);
            selectedData.push(itemData);
        }
    });
    
    // Store the selection for manual mapping
    if (currentBrowseIndex !== null && typeof currentBrowseIndex === 'number') {
        importData.manual_required[currentBrowseIndex].browse_selection = selectedData;
        
        // Update the UI to show selection
        const select = document.querySelector(`#manual-matches tr[data-index="${currentBrowseIndex}"] select`);
        const button = select.parentElement.parentElement.querySelector('button');
        
        select.innerHTML = `<option value="custom" selected>${selectedData.length} items selected</option>` + select.innerHTML;
        button.disabled = false;
    }
    
    closeBrowseModal();
}

// Map manual match
function mapManualMatch(index) {
    const select = document.querySelector(`#manual-matches tr[data-index="${index}"] select`);
    const value = select.value;
    
    if (!value || value === 'skip') {
        return;
    }
    
    // Store mapping
    importData.manual_required[index].mapped = true;
    
    if (value === 'custom' && importData.manual_required[index].browse_selection) {
        // Use browse selection
        importData.manual_required[index].mapping_type = 'browse';
        importData.manual_required[index].mapping_items = importData.manual_required[index].browse_selection;
    } else {
        // Single item selection
        importData.manual_required[index].mapping_type = 'single';
        importData.manual_required[index].mapping_value = value;
    }
    
    // Update UI
    const row = document.querySelector(`#manual-matches tr[data-index="${index}"]`);
    row.style.backgroundColor = '#d4edda';
}

// Helper function to check if items have all required categories
function _checkHasAllCategories(items) {
    const requiredCategories = ['box', 'standard_materials', 'standard_service',
                               'fragile_materials', 'fragile_service',
                               'custom_materials', 'custom_service'];
    
    const foundCategories = new Set();
    items.forEach(item => {
        if (item.category && item.category !== 'other') {
            foundCategories.add(item.category);
        }
    });
    
    return requiredCategories.every(cat => foundCategories.has(cat));
}

// Handle dimension mapping selection
function handleDimensionMapping(index, select) {
    const value = select.value;
    const button = select.parentElement.parentElement.querySelector('button');
    
    if (value === 'browse') {
        // Open dimension browse modal
        openDimensionBrowseModal(index);
        select.value = '';
        button.disabled = true;
    } else if (value === 'skip' || value === '') {
        button.disabled = true;
    } else {
        button.disabled = false;
    }
}

// Map dimension match
function mapDimensionMatch(index) {
    const select = document.querySelector(`#manual-matches tr[data-index="${index}"] select`);
    const value = select.value;
    
    if (!value || value === 'skip') {
        return;
    }
    
    // Store the dimension mapping
    importData.manual_required[index].mapped = true;
    importData.manual_required[index].mapped_dimension = value;
    
    // Get items from the selected dimension
    const items = importData.excel_dimension_groups[value];
    importData.manual_required[index].mapped_items = items;
    
    // Track this dimension as mapped
    mappedDimensions.add(value);
    
    // Update UI
    const row = document.querySelector(`#manual-matches tr[data-index="${index}"]`);
    row.style.backgroundColor = '#d4edda';
    row.querySelector('button').textContent = 'Mapped';
}

// Browse for missing categories
function browseForMissingCategories(index) {
    const incompleteMatch = importData.incomplete_matches[index];
    
    // Open browse modal with filter for missing categories
    currentBrowseIndex = `incomplete_${index}`;
    selectedItems.clear();
    
    const modal = document.getElementById('browse-modal');
    modal.style.display = 'flex';
    
    // Update modal title
    const modalHeader = modal.querySelector('.modal-header h2');
    modalHeader.textContent = `Find Missing Categories for ${incompleteMatch.box.model}`;
    
    // Update search placeholder
    const searchInput = document.getElementById('browse-search');
    searchInput.placeholder = 'Search product names...';
    searchInput.value = '';
    
    // Update filter options for category context
    const filterSelect = document.getElementById('browse-filter');
    filterSelect.innerHTML = `
        <option value="all">All items</option>
        <option value="missing" selected>Missing categories only</option>
        <option value="box">Box items</option>
        <option value="materials">Materials</option>
        <option value="services">Services</option>
    `;
    
    // Populate items filtered by missing categories
    populateBrowseItemsForMissing(incompleteMatch.missing_categories);
}

// Skip incomplete match
function skipIncompleteMatch(index) {
    importData.incomplete_matches[index].skipped = true;
    
    // Update UI
    const row = document.querySelector(`#incomplete-matches tr[data-index="${index}"]`);
    row.style.opacity = '0.5';
}

// Open dimension browse modal
function openDimensionBrowseModal(manualIndex) {
    currentBrowseIndex = `dimension_${manualIndex}`;
    selectedItems.clear();
    
    const modal = document.getElementById('browse-modal');
    modal.style.display = 'flex';
    
    // Get the box being matched
    const box = importData.manual_required[manualIndex].box;
    
    // Update modal header with box details
    const modalHeader = modal.querySelector('.modal-header');
    modalHeader.innerHTML = `
        <div>
            <h2>Select Dimension for ${box.model}</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
                Store dimensions: ${box.dimensions} (actual values from YAML)
            </p>
        </div>
        <button class="modal-close" onclick="closeBrowseModal()">&times;</button>
    `;
    
    // Show dimension groups instead of individual items
    populateDimensionGroups();
}

// Populate dimension groups for browsing
function populateDimensionGroups() {
    const container = document.getElementById('browse-items-container');
    
    if (!importData || !importData.excel_dimension_groups) {
        container.innerHTML = '<div class="browse-empty">No Excel dimensions available</div>';
        return;
    }
    
    // Set up filter change handler
    const filterSelect = document.getElementById('browse-filter');
    if (!filterSelect.dataset.initialized) {
        filterSelect.addEventListener('change', () => populateDimensionGroups());
        filterSelect.dataset.initialized = 'true';
    }
    
    // Set up search handler
    const searchInput = document.getElementById('browse-search');
    if (!searchInput.dataset.initialized) {
        searchInput.addEventListener('input', () => filterDimensionGroups());
        searchInput.dataset.initialized = 'true';
    }
    
    let html = '<div class="dimension-groups">';
    
    // Get filter value
    const filterValue = filterSelect.value || 'all';
    
    // Sort dimensions by size
    const sortedDimensions = Object.entries(importData.excel_dimension_groups)
        .filter(([dimension]) => {
            // Apply matched/unmatched filter
            const isMatched = mappedDimensions.has(dimension);
            if (filterValue === 'unmatched' && isMatched) return false;
            if (filterValue === 'matched' && !isMatched) return false;
            return true;
        })
        .sort(([a], [b]) => {
            const aDims = a.split('x').map(d => parseInt(d));
            const bDims = b.split('x').map(d => parseInt(d));
            const aVolume = aDims.reduce((acc, d) => acc * d, 1);
            const bVolume = bDims.reduce((acc, d) => acc * d, 1);
            return aVolume - bVolume;
        });
    
    if (sortedDimensions.length === 0) {
        container.innerHTML = '<div class="browse-empty">No dimensions match the current filter</div>';
        return;
    }
    
    sortedDimensions.forEach(([dimension, items]) => {
        const hasAllCategories = _checkHasAllCategories(items);
        const statusClass = hasAllCategories ? 'complete' : 'incomplete';
        const statusIcon = hasAllCategories ? '✓' : '⚠';
        const isMatched = mappedDimensions.has(dimension);
        const matchedClass = isMatched ? 'already-matched' : '';
        
        // Count categories
        const categoryCounts = {};
        items.forEach(item => {
            const cat = item.category || 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        
        const categoryBreakdown = Object.entries(categoryCounts)
            .map(([cat, count]) => `${cat.replace(/_/g, ' ')}: ${count}`)
            .join(', ');
        
        html += `
            <div class="dimension-group-item ${statusClass} ${matchedClass}" data-dimension="${dimension}" onclick="selectDimensionGroup('${dimension}')">
                <div class="dimension-header">
                    <strong>${dimension}</strong>
                    <span class="status-icon">${statusIcon}</span>
                    ${isMatched ? '<span class="matched-badge">Already Matched</span>' : ''}
                </div>
                <div class="dimension-details">
                    <div>${items.length} total items</div>
                    <div class="category-breakdown">${categoryBreakdown}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Filter dimension groups based on search
function filterDimensionGroups() {
    const searchTerm = document.getElementById('browse-search').value.toLowerCase();
    const items = document.querySelectorAll('.dimension-group-item');
    
    items.forEach(item => {
        const dimension = item.dataset.dimension.toLowerCase();
        // Show if dimension contains search term
        item.style.display = dimension.includes(searchTerm) ? 'block' : 'none';
    });
    
    // Check if any items are visible
    const visibleItems = document.querySelectorAll('.dimension-group-item[style="display: block;"], .dimension-group-item:not([style])');
    if (visibleItems.length === 0) {
        const container = document.getElementById('browse-items-container');
        const existingEmpty = container.querySelector('.browse-empty');
        if (!existingEmpty) {
            container.innerHTML += '<div class="browse-empty search-empty">No dimensions match your search</div>';
        }
    } else {
        // Remove empty message if exists
        const emptyMsg = document.querySelector('.search-empty');
        if (emptyMsg) emptyMsg.remove();
    }
}

// Select dimension group
function selectDimensionGroup(dimension) {
    if (currentBrowseIndex && currentBrowseIndex.startsWith('dimension_')) {
        const index = parseInt(currentBrowseIndex.split('_')[1]);
        const select = document.querySelector(`#manual-matches tr[data-index="${index}"] select`);
        const button = select.parentElement.parentElement.querySelector('button');
        
        // Update select to show selected dimension
        const existingOption = select.querySelector(`option[value="${dimension}"]`);
        if (existingOption) {
            select.value = dimension;
        } else {
            // Add the dimension as a new option if not already present
            const newOption = document.createElement('option');
            newOption.value = dimension;
            newOption.textContent = `${dimension} (selected)`;
            newOption.selected = true;
            select.insertBefore(newOption, select.querySelector('option[value="browse"]'));
        }
        
        button.disabled = false;
        closeBrowseModal();
    }
}

// Populate browse items for missing categories
function populateBrowseItemsForMissing(missingCategories) {
    const container = document.getElementById('browse-items-container');
    
    if (!importData || !importData.excel_dimension_groups) {
        container.innerHTML = '<div class="browse-empty">No Excel items available</div>';
        return;
    }
    
    // Set up filter change handler for category browsing
    const filterSelect = document.getElementById('browse-filter');
    if (filterSelect && !filterSelect.dataset.categoryInitialized) {
        filterSelect.removeEventListener('change', populateDimensionGroups); // Remove dimension handler
        filterSelect.addEventListener('change', () => populateBrowseItemsForMissing(missingCategories));
        filterSelect.dataset.categoryInitialized = 'true';
    }
    
    // Set up search handler
    const searchInput = document.getElementById('browse-search');
    if (searchInput && !searchInput.dataset.categoryInitialized) {
        searchInput.removeEventListener('input', filterDimensionGroups); // Remove dimension handler
        searchInput.addEventListener('input', filterBrowseItemsBySearch);
        searchInput.dataset.categoryInitialized = 'true';
    }
    
    // Get filter value
    const filterValue = filterSelect ? filterSelect.value : 'missing';
    
    // Collect all items from all dimensions
    const allItems = [];
    for (const [dimension, items] of Object.entries(importData.excel_dimension_groups)) {
        items.forEach(item => {
            allItems.push({
                ...item,
                dimension: dimension
            });
        });
    }
    
    // Filter items based on selected filter
    let relevantItems = [];
    if (filterValue === 'missing') {
        // Only show items from missing categories
        relevantItems = allItems.filter(item => missingCategories.includes(item.category));
    } else if (filterValue === 'box') {
        relevantItems = allItems.filter(item => item.category === 'box');
    } else if (filterValue === 'materials') {
        relevantItems = allItems.filter(item => item.category && item.category.includes('materials'));
    } else if (filterValue === 'services') {
        relevantItems = allItems.filter(item => item.category && item.category.includes('service'));
    } else {
        relevantItems = allItems;
    }
    
    // Group by category
    const grouped = {};
    relevantItems.forEach(item => {
        const cat = item.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });
    
    // Render grouped items
    let html = '';
    for (const [category, items] of Object.entries(grouped)) {
        const catDisplay = category.replace(/_/g, ' ');
        const isMissing = missingCategories.includes(category);
        
        html += `<div class="browse-group">`;
        html += `<div class="browse-group-header ${isMissing ? 'missing-category' : ''}">${catDisplay} (${items.length} options)</div>`;
        
        items.forEach(item => {
            html += `
                <div class="browse-item" onclick="toggleBrowseItem('${item.item_id}')">
                    <input type="checkbox" class="browse-item-checkbox" 
                           data-item-id="${item.item_id}" 
                           data-item='${JSON.stringify(item).replace(/'/g, '&apos;')}'>
                    <div class="browse-item-info">
                        <span class="browse-item-id">${item.item_id}</span>
                        <span class="browse-item-name" title="${item.product_name}">${item.product_name}</span>
                        <span class="browse-item-price">$${item.price.toFixed(2)}</span>
                        <span class="browse-item-dimension">${item.dimension}</span>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    if (Object.keys(grouped).length === 0) {
        html = '<div class="browse-empty">No items match the current filter</div>';
    }
    
    container.innerHTML = html;
    updateSelectedCount();
}

// Filter browse items by search term
function filterBrowseItemsBySearch() {
    const searchTerm = document.getElementById('browse-search').value.toLowerCase();
    const items = document.querySelectorAll('.browse-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
    
    // Hide empty groups
    document.querySelectorAll('.browse-group').forEach(group => {
        const visibleItems = group.querySelectorAll('.browse-item[style="display: flex;"], .browse-item:not([style])');
        group.style.display = visibleItems.length > 0 ? 'block' : 'none';
    });
}

// Show data issues report
function showDataIssuesReport() {
    if (!importData) return;
    
    let report = "DATA ISSUES REPORT\n";
    report += "==================\n\n";
    
    // Section 1: Missing from Excel (what we have that Excel doesn't)
    report += "MISSING FROM EXCEL (Store boxes not found in Excel)\n";
    report += "---------------------------------------------------\n\n";
    
    // Completely missing dimensions
    if (importData.manual_required.length > 0) {
        report += "Completely missing dimensions:\n";
        importData.manual_required.forEach(item => {
            if (item.reason === 'no_dimension_match') {
                report += `  • ${item.box.model} (${item.box.dimensions})\n`;
            }
        });
        report += "\n";
    }
    
    // Partial matches (dimension exists but missing categories)
    if (importData.incomplete_matches.length > 0) {
        report += "Partial matches (dimension exists but missing categories):\n";
        importData.incomplete_matches.forEach(match => {
            report += `  • ${match.box.model} (${match.box.dimensions})\n`;
            report += `    Missing: ${match.missing_categories.join(', ')}\n`;
            if (match.excel_items && match.excel_items.length > 0) {
                const boxItem = match.excel_items.find(item => item.category === 'box');
                if (boxItem) {
                    report += `    Excel has: "${boxItem.product_name}"\n`;
                }
            }
            report += "\n";
        });
    }
    
    // Section 2: In Excel but not in our system
    report += "\nIN EXCEL BUT NOT IN OUR SYSTEM\n";
    report += "-------------------------------\n\n";
    
    // Find Excel dimensions that don't match any store box
    const storeDimensions = new Set();
    const storeData = importData.perfect_matches.concat(
        importData.probable_matches,
        importData.incomplete_matches,
        importData.manual_required
    );
    
    storeData.forEach(match => {
        if (match.box && match.box.dimensions_int) {
            storeDimensions.add(match.box.dimensions_int);
        }
    });
    
    report += "Excel dimensions with no store match:\n";
    let hasUnmatchedDimensions = false;
    
    Object.entries(importData.excel_dimension_groups).forEach(([dimension, items]) => {
        if (!storeDimensions.has(dimension)) {
            hasUnmatchedDimensions = true;
            const boxItems = items.filter(item => item.category === 'box');
            if (boxItems.length > 0) {
                boxItems.forEach(box => {
                    report += `  • ${dimension}: "${box.product_name}" (ID: ${box.item_id})\n`;
                });
            } else {
                report += `  • ${dimension}: No box items, only packing materials/services\n`;
            }
        }
    });
    
    if (!hasUnmatchedDimensions) {
        report += "  (None found - all Excel dimensions have store matches)\n";
    }
    
    // Items without dimensions
    report += "\n\nExcel items without dimensions:\n";
    // This would need to be tracked during import analysis
    report += "  • Art Med Box Frg Pack Service\n";
    report += "  • (Other items without dimensions would be listed here)\n";
    
    // Section 3: Dimension mismatches
    report += "\n\nDIMENSION MISMATCHES\n";
    report += "--------------------\n";
    report += "These may be typos or formatting differences:\n";
    
    // Look for close matches that might be typos
    importData.manual_required.forEach(item => {
        if (item.reason === 'no_dimension_match') {
            const storeDims = item.box.dimensions_int.split('x').map(d => parseInt(d));
            
            // Check for close matches in Excel
            Object.entries(importData.excel_dimension_groups).forEach(([excelDim, excelItems]) => {
                const excelDims = excelDim.split('x').map(d => parseInt(d));
                
                // Check if dimensions are very close (within 1 unit difference)
                const isClose = storeDims.every((dim, i) => Math.abs(dim - excelDims[i]) <= 1);
                
                if (isClose && storeDims.some((dim, i) => dim !== excelDims[i])) {
                    const boxItem = excelItems.find(item => item.category === 'box');
                    if (boxItem) {
                        report += `  • Store: ${item.box.model} (${item.box.dimensions})\n`;
                        report += `    Excel: "${boxItem.product_name}" (${excelDim})\n\n`;
                    }
                }
            });
        }
    });
    
    // Display the report
    document.getElementById('issues-report-content').textContent = report;
    document.getElementById('issues-modal').style.display = 'flex';
}

// Close issues modal
function closeIssuesModal() {
    document.getElementById('issues-modal').style.display = 'none';
}

// Copy issues report to clipboard
function copyIssuesReport() {
    const reportContent = document.getElementById('issues-report-content').textContent;
    navigator.clipboard.writeText(reportContent).then(() => {
        alert('Report copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = reportContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Report copied to clipboard!');
    });
}

// Make functions globally available for onclick handlers
window.toggleSection = toggleSection;
window.updateAllPerfectMatches = updateAllPerfectMatches;
window.approveProbableMatch = approveProbableMatch;
window.skipProbableMatch = skipProbableMatch;
window.approveAllProbableMatches = approveAllProbableMatches;
window.handleManualMapping = handleManualMapping;
window.mapManualMatch = mapManualMatch;
window.applyImportChanges = applyImportChanges;
window.cancelImport = cancelImport;
window.openBrowseModal = openBrowseModal;
window.closeBrowseModal = closeBrowseModal;
window.toggleBrowseItem = toggleBrowseItem;
window.applyBrowseSelection = applyBrowseSelection;
window.handleDimensionMapping = handleDimensionMapping;
window.mapDimensionMatch = mapDimensionMatch;
window.browseForMissingCategories = browseForMissingCategories;
window.skipIncompleteMatch = skipIncompleteMatch;
window.openDimensionBrowseModal = openDimensionBrowseModal;
window.selectDimensionGroup = selectDimensionGroup;
window.showDataIssuesReport = showDataIssuesReport;
window.closeIssuesModal = closeIssuesModal;
window.copyIssuesReport = copyIssuesReport;

// Apply all import changes
async function applyImportChanges() {
    // Prepare update data
    const updates = {
        perfect_updates: [],
        approved_mappings: [],
        manual_mappings: []
    };
    
    // Collect perfect match updates
    importData.perfect_matches.forEach(match => {
        if (match.approved) {
            const prices = {};
            // Convert mapped items to itemized prices
            if (match.mapped_items.box) {
                prices['box-price'] = match.mapped_items.box.price;
            }
            if (match.mapped_items.basic_materials) {
                prices['basic-materials'] = match.mapped_items.basic_materials.price;
            }
            if (match.mapped_items.basic_service) {
                prices['basic-services'] = match.mapped_items.basic_service.price;
            }
            if (match.mapped_items.standard_materials) {
                prices['standard-materials'] = match.mapped_items.standard_materials.price;
            }
            if (match.mapped_items.standard_service) {
                prices['standard-services'] = match.mapped_items.standard_service.price;
            }
            if (match.mapped_items.fragile_materials) {
                prices['fragile-materials'] = match.mapped_items.fragile_materials.price;
            }
            if (match.mapped_items.fragile_service) {
                prices['fragile-services'] = match.mapped_items.fragile_service.price;
            }
            if (match.mapped_items.custom_materials) {
                prices['custom-materials'] = match.mapped_items.custom_materials.price;
            }
            if (match.mapped_items.custom_service) {
                prices['custom-services'] = match.mapped_items.custom_service.price;
            }
            
            
            updates.perfect_updates.push({
                model: match.box.model,
                prices: prices
            });
        }
    });
    
    // Collect approved probable matches
    importData.probable_matches.forEach(match => {
        if (match.approved && !match.skipped) {
            const mapping = {};
            const prices = {};
            
            // Build mapping and prices from categories found
            Object.entries(match.categories_found).forEach(([category, item]) => {
                mapping[category] = item.item_id;
                
                // Map to itemized price fields
                if (category === 'box') {
                    prices['box-price'] = item.price;
                } else if (category === 'basic_materials') {
                    prices['basic-materials'] = item.price;
                } else if (category === 'basic_service') {
                    prices['basic-services'] = item.price;
                } else if (category === 'standard_materials') {
                    prices['standard-materials'] = item.price;
                } else if (category === 'standard_service') {
                    prices['standard-services'] = item.price;
                } else if (category === 'fragile_materials') {
                    prices['fragile-materials'] = item.price;
                } else if (category === 'fragile_service') {
                    prices['fragile-services'] = item.price;
                } else if (category === 'custom_materials') {
                    prices['custom-materials'] = item.price;
                } else if (category === 'custom_service') {
                    prices['custom-services'] = item.price;
                }
            });
            
            updates.approved_mappings.push({
                model: match.box.model,
                mapping: mapping,
                prices: prices
            });
        }
    });
    
    // Collect incomplete matches that have been resolved
    if (importData.incomplete_matches) {
        importData.incomplete_matches.forEach(match => {
            if (match.resolved && !match.skipped && match.additional_items) {
                const mapping = {};
                const prices = {};
                
                // Start with existing categories
                Object.entries(match.categories_found).forEach(([category, item]) => {
                    mapping[category] = item.item_id;
                    
                    // Map to itemized price fields
                    if (category === 'box') {
                        prices['box-price'] = item.price;
                    } else if (category === 'basic_materials') {
                        prices['basic-materials'] = item.price;
                    } else if (category === 'basic_service') {
                        prices['basic-services'] = item.price;
                    } else if (category === 'standard_materials') {
                        prices['standard-materials'] = item.price;
                    } else if (category === 'standard_service') {
                        prices['standard-services'] = item.price;
                    } else if (category === 'fragile_materials') {
                        prices['fragile-materials'] = item.price;
                    } else if (category === 'fragile_service') {
                        prices['fragile-services'] = item.price;
                    } else if (category === 'custom_materials') {
                        prices['custom-materials'] = item.price;
                    } else if (category === 'custom_service') {
                        prices['custom-services'] = item.price;
                    }
                });
                
                // Add the additional items selected to fill missing categories
                match.additional_items.forEach(item => {
                    if (item.category && item.category !== 'other') {
                        mapping[item.category] = item.item_id;
                        
                        // Map to itemized price fields
                        if (item.category === 'box') {
                            prices['box-price'] = item.price;
                        } else if (item.category === 'basic_materials') {
                            prices['basic-materials'] = item.price;
                        } else if (item.category === 'basic_service') {
                            prices['basic-services'] = item.price;
                        } else if (item.category === 'standard_materials') {
                            prices['standard-materials'] = item.price;
                        } else if (item.category === 'standard_service') {
                            prices['standard-services'] = item.price;
                        } else if (item.category === 'fragile_materials') {
                            prices['fragile-materials'] = item.price;
                        } else if (item.category === 'fragile_service') {
                            prices['fragile-services'] = item.price;
                        } else if (item.category === 'custom_materials') {
                            prices['custom-materials'] = item.price;
                        } else if (item.category === 'custom_service') {
                            prices['custom-services'] = item.price;
                        }
                    }
                });
                
                updates.approved_mappings.push({
                    model: match.box.model,
                    mapping: mapping,
                    prices: prices
                });
            }
        });
    }
    
    // Collect manual dimension mappings
    importData.manual_required.forEach(match => {
        if (match.mapped && match.mapped_dimension && match.mapped_items) {
            const mapping = {};
            const prices = {};
            
            // Process all items from the mapped dimension
            match.mapped_items.forEach(item => {
                if (item.category && item.category !== 'other') {
                    mapping[item.category] = item.item_id;
                    
                    // Map to itemized price fields
                    if (item.category === 'box') {
                        prices['box-price'] = item.price;
                    } else if (item.category === 'basic_materials') {
                        prices['basic-materials'] = item.price;
                    } else if (item.category === 'basic_service') {
                        prices['basic-services'] = item.price;
                    } else if (item.category === 'standard_materials') {
                        prices['standard-materials'] = item.price;
                    } else if (item.category === 'standard_service') {
                        prices['standard-services'] = item.price;
                    } else if (item.category === 'fragile_materials') {
                        prices['fragile-materials'] = item.price;
                    } else if (item.category === 'fragile_service') {
                        prices['fragile-services'] = item.price;
                    } else if (item.category === 'custom_materials') {
                        prices['custom-materials'] = item.price;
                    } else if (item.category === 'custom_service') {
                        prices['custom-services'] = item.price;
                    }
                }
            });
            
            // Check if we have all required categories
            const requiredCategories = ['box', 'basic_materials', 'basic_service',
                                       'standard_materials', 'standard_service',
                                       'fragile_materials', 'fragile_service',
                                       'custom_materials', 'custom_service'];
            const hasAllCategories = requiredCategories.every(cat => mapping[cat]);
            
            if (hasAllCategories) {
                updates.manual_mappings.push({
                    model: match.box.model,
                    mapping: mapping,
                    prices: prices
                });
            }
        } else if (match.mapped && match.browse_selection) {
            // Handle custom browse selections
            const mapping = {};
            const prices = {};
            
            match.browse_selection.forEach(item => {
                if (item.category && item.category !== 'other') {
                    mapping[item.category] = item.item_id;
                    
                    // Map to itemized price fields
                    if (item.category === 'box') {
                        prices['box-price'] = item.price;
                    } else if (item.category === 'basic_materials') {
                        prices['basic-materials'] = item.price;
                    } else if (item.category === 'basic_service') {
                        prices['basic-services'] = item.price;
                    } else if (item.category === 'standard_materials') {
                        prices['standard-materials'] = item.price;
                    } else if (item.category === 'standard_service') {
                        prices['standard-services'] = item.price;
                    } else if (item.category === 'fragile_materials') {
                        prices['fragile-materials'] = item.price;
                    } else if (item.category === 'fragile_service') {
                        prices['fragile-services'] = item.price;
                    } else if (item.category === 'custom_materials') {
                        prices['custom-materials'] = item.price;
                    } else if (item.category === 'custom_service') {
                        prices['custom-services'] = item.price;
                    }
                }
            });
            
            updates.manual_mappings.push({
                model: match.box.model,
                mapping: mapping,
                prices: prices
            });
        }
    });
    
    // Validate we have something to update
    const totalUpdates = updates.perfect_updates.length + 
                        updates.approved_mappings.length + 
                        updates.manual_mappings.length;
    
    if (totalUpdates === 0) {
        alert('No changes to apply. Please approve some matches first.');
        return;
    }
    
    if (!confirm(`Apply ${totalUpdates} box updates?`)) {
        return;
    }
    
    // Apply updates
    try {
        const token = AuthManager.getToken(currentStoreId);
        if (!token) {
            alert('Please log in to apply import changes.');
            window.location.href = `/login?redirect=/import`;
            return;
        }
        
        
        const response = await apiUtils.authenticatedFetch(`/api/store/${currentStoreId}/import/apply`, currentStoreId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                window.location.href = `/login?redirect=/import`;
                return;
            }
            throw new Error(`Update failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        alert(`Successfully updated ${result.updated_count} boxes!`);
        
        // Redirect to price editor or reload
        window.location.href = `/prices`;
        
    } catch (error) {
        console.error('Error applying updates:', error);
        alert('Error applying updates: ' + error.message);
    }
}

// Cancel import
function cancelImport() {
    if (confirm('Cancel import and discard all changes?')) {
        resetUpload();
    }
}

// Reset upload state
function resetUpload() {
    document.getElementById('upload-zone').style.display = 'block';
    document.getElementById('loading').classList.remove('active');
    document.getElementById('results').style.display = 'none';
    document.getElementById('file-input').value = '';
    importData = null;
}