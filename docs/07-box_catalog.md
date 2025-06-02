# Box Catalog Implementation

## Overview

A vendor-based box catalog system to streamline store onboarding and box management at scale.

## Current Implementation Status (as of 2025-01-06)

### ✅ What We've Built

1. **Vendor Catalog System**

   - YAML files in `/vendors` directory (currently just ABC.yml)
   - Date-based versioning: `version: '2025-05-30'`
   - VendorCatalog service for loading and managing vendor data

2. **Duplicate Detection & Comparison**

   - Smart comparison that detects new/existing/updated boxes
   - Prevents adding duplicate boxes to store inventory
   - Shows "X new boxes not in your store" in UI
   - Version comparison when `supplier_version` is present

3. **Bulk Selection UI**

   - Select All/Select None functionality
   - Checkbox-based multi-select with visual feedback
   - Bulk add selected boxes to inventory

4. **Version Tracking**

   - Added `supplier_version` to store YAML when adding vendor boxes
   - Backend automatically adds version when creating boxes from vendors

5. **Store-Accessible Vendor Endpoints**
   - `/api/vendors` - List all vendors
   - `/api/vendors/{name}/boxes` - Get vendor's boxes
   - `/api/vendors/{name}/compare` - Compare with store inventory

### 🚫 What We Didn't Build (Intentionally)

1. **Update Functionality in UI**

   - Decided vendor catalog updates are a backend/YAML/CLI operation
   - No "Update to latest version" button in the UI
   - Rationale: Catalog updates are infrequent and may need manual review

2. **Historical Version Tracking**

   - No complex change tracking or version history
   - Git handles the full history of vendor files
   - Runtime comparison is sufficient for showing differences

3. **Full Onboarding Wizard**
   - Have the pieces but not composed into a wizard, at least not yet.
   - Current "Add Box" flow is sufficient for now
   - Could be assembled later if needed

### 💭 Key Design Decisions & Rationale

1. **Date-Based Versioning**

   - Simple format: `version: '2025-05-30'`
   - Human-readable, sortable, git-friendly
   - Sufficient for tracking "which version is a store on?"

2. **No Live Change Tracking**

   - Originally considered tracking what changed between versions
   - Decided runtime comparison is simpler and sufficient
   - Git history provides full details when needed

3. **Backend CLI for Updates**

   - Vendor catalog updates happen outside the GUI
   - Gives superadmins control over when to apply updates

## What's Left to Build

### 1. CLI Tool for Vendor Updates

Create a tool to handle vendor catalog updates:

```bash
# When ABC updates their catalog:
tools/update_vendor_catalog.py ABC vendors/ABC.yml.new

# Tool would:
# 1. Diff old vs new catalog
# 2. Show what changed
# 3. Optionally update affected stores
# 4. Commit with meaningful message
```

### 2. Box Status Display

Show update status in the box inventory UI:

- ✓ Current (matches vendor catalog)
- ⚠️ Updated (vendor has newer specs)
- ❌ Discontinued (no longer in vendor catalog)
- ✏️ Custom (not from any vendor)

## How Vendor Catalog Updates Work (Planned)

1. **Receive New Catalog**

   - Vendor sends updated YAML or we scrape their site
   - Save as `vendors/ABC.yml.new`

2. **Review Changes**

   ```bash
   # Compare catalogs
   diff vendors/ABC.yml vendors/ABC.yml.new

   # Or use custom tool to show structured diff
   tools/vendor_catalog_diff.py ABC
   ```

3. **Apply Update**

   ```bash
   # Replace catalog file
   mv vendors/ABC.yml.new vendors/ABC.yml

   # Update version date in file
   # Commit to git with descriptive message
   git add vendors/ABC.yml
   git commit -m "Update ABC catalog: added 3 boxes, updated CHAIR dimensions"
   ```

4. **Store Updates (Manual Process)**
   - Stores continue using their current box specs
   - Admin can review changes and update selectively
   - No automatic updates to avoid surprises

## Example CLI Workflow

```bash
# 1. Check which stores would be affected by catalog update
tools/check_catalog_impact.py ABC

# Output:
# 5 stores use boxes that changed:
# - store123: CHAIR (dimensions changed)
# - store456: 10C-UPS (alternate depths added)
# ...

# 2. Generate update report for a store
tools/store_update_report.py store123

# Output:
# Store 123 has 2 boxes with updates available:
# - CHAIR: dimensions changed from [30,29,32] to [30,29,34]
# - 10C-UPS: added alternate depth 5.0

# 3. Selectively update boxes (future tool)
tools/update_store_boxes.py store123 --models CHAIR,10C-UPS
```

## Data Model Summary

### Vendor Catalog Format

```yaml
# vendors/ABC.yml
vendor:
  name: "America's Box Choice"
  url: https://www.myboxchoice.com
  version: "2025-05-30" # Date when catalog was last updated
boxes:
  - model: "10C-UPS"
    dimensions: [10, 10, 10]
    alternate_depths: [7.5, 5.0]
    category: "cube"
```

### Store Box Format (with vendor tracking)

```yaml
# stores/store4.yml
boxes:
  - type: NormalBox
    supplier: ABC
    supplier_version: "2025-05-30" # Tracks which vendor version
    model: "10C-UPS"
    dimensions: [10, 10, 10]
    alternate_depths: [7.5, 5.0]
```

## Future Considerations

1. **Multi-Vendor Support**

   - System is ready for multiple vendors
   - Just add more YAML files to `/vendors`
   - UI already handles vendor selection

2. **Vendor Discovery**

   - Track custom boxes to identify potential new vendors
   - "5 stores are using custom boxes from 'ULINE'"
   - Helps prioritize which vendors to add

3. **Performance at Scale**
   - Current runtime comparison is fine for < 1000 boxes
   - Could add caching if needed
   - Could pre-compute "update available" flags if needed
