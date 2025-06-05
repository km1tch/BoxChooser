# Store Configuration Guide

This guide covers the YAML configuration format for store box inventories and settings.

## Configuration File Location

Each store's configuration is stored in `stores/store{id}.yml` where `{id}` is the store number.

- `stores/store1.yml` - Store 1 configuration
- `stores/store100.yml` - Store 100 configuration
- `stores/store999999.yml` - Demo store (auto-generated)

## Basic Structure

```yaml
# Box inventory
boxes:
  - type: NormalBox
    supplier: ABC
    model: "10C-UPS"
    dimensions: [10, 10, 10]  # Length, Width, Height
    # ... pricing details
```

## Pricing Structure

BoxChooser uses itemized pricing that breaks down costs into box, materials, and services:

```yaml
boxes:
  - type: NormalBox
    supplier: ULINE
    model: "S-4344"
    dimensions: [12, 9, 6]
    itemized-prices:
      box-price: 1.50
      basic-materials: 0.25
      basic-services: 0.75
      standard-materials: 0.50
      standard-services: 1.50
      fragile-materials: 1.00
      fragile-services: 3.00
      custom-materials: 1.50
      custom-services: 4.50
```

## Box Types

### NormalBox

Standard rectangular boxes:

```yaml
- type: NormalBox
  supplier: ABC
  model: "12X10X8"
  dimensions: [12, 10, 8]
```

### NormalBoxWithAlt

Boxes with alternate cutting depths:

```yaml
- type: NormalBoxWithAlt
  supplier: ABC
  model: "10C-UPS"
  dimensions: [10, 10, 10]
  alternate_depths: [7.5, 5.0]  # Can be cut down to these heights
```

### NormalBoxPrescored

Boxes with factory-scored cut lines:

```yaml
- type: NormalBoxPrescored
  supplier: ABC
  model: "VAR5"
  dimensions: [20, 16, 16]
  prescored_heights: [12, 8, 4]  # Pre-scored at these heights
```

### FlatRateEnvelope

Flat rate shipping envelopes:

```yaml
- type: FlatRateEnvelope
  supplier: USPS
  model: "EP13F"
  dimensions: [15, 9.5, 0.75]
```

## Optional Fields

### Box Location

For floorplan integration (set via GUI, not YAML):

```yaml
location:
  coords: [0.425, 0.634]  # X, Y coordinates on floorplan
```

### Supplier Version

Tracks which vendor catalog version:

```yaml
supplier_version: "2025-05-30"  # Added automatically when importing
```

## Packing Guidelines

Default packing rules are stored in `stores/packing_guidelines.yml`:

```yaml
# Protection level definitions
basic:
  padding_inches: 0.5
  wizard_description: "Minimal protection for non-fragile items"
  label_instructions: "PAD: 0.5 inches minimum"

standard:
  padding_inches: 1.0
  wizard_description: "Standard protection for most items"
  label_instructions: "PAD: 1 inch all sides"

fragile:
  padding_inches: 2.0
  wizard_description: "Extra protection for fragile items"
  label_instructions: "FRAGILE: 2 inches padding required"

custom:
  padding_inches: 3.0
  wizard_description: "Maximum protection for extremely fragile items"
  label_instructions: "CUSTOM: 3+ inches specialized packing"

# Recommendation engine configuration
recommendation_engine:
  weights:
    price: 0.4
    efficiency: 0.4
    ease: 0.2
  strategy_preferences:
    normal: 10
    cutdown: 8
    telescoping: 6
    diagonal: 4
    flattened: 2
  practically_tight_threshold: 1.5
  max_recommendations: 10
  extreme_cut_threshold: 0.6
```

## Best Practices

1. **Keep models consistent** - Use the same model numbers as your suppliers
2. **Version control** - Commit changes to git with descriptive messages
3. **Test changes** - Use the packing calculator after making changes
4. **Document custom boxes** - Add comments for non-standard boxes

## Validation

The system validates YAML files on startup. Common errors:

- Missing required fields (type, dimensions, itemized-prices)
- Invalid dimensions (must be positive numbers)
- Missing itemized price fields

## Example: Complete Store Configuration

```yaml
# Store 100 Configuration
# Last updated: 2025-01-06
# Contact: manager@store100.com

boxes:
  # Small boxes
  - type: NormalBox
    supplier: ABC
    model: "06C-UPS"
    dimensions: [6, 6, 6]
    itemized-prices:
      box-price: 0.89
      basic-materials: 0.15
      basic-services: 0.50
      standard-materials: 0.25
      standard-services: 0.75
      fragile-materials: 0.50
      fragile-services: 1.00
      custom-materials: 0.75
      custom-services: 1.50
    supplier_version: "2025-05-30"

  # Medium boxes with cut options
  - type: NormalBoxWithAlt
    supplier: ABC
    model: "10C-UPS"
    dimensions: [10, 10, 10]
    alternate_depths: [7.5, 5.0]
    itemized-prices:
      box-price: 1.52
      basic-materials: 0.20
      basic-services: 0.85
      standard-materials: 0.50
      standard-services: 1.50
      fragile-materials: 1.00
      fragile-services: 2.00
      custom-materials: 1.50
      custom-services: 3.00
    supplier_version: "2025-05-30"

  # Large pre-scored box
  - type: NormalBoxPrescored
    supplier: ABC
    model: "VAR5"
    dimensions: [20, 16, 16]
    prescored_heights: [12, 8, 4]
    itemized-prices:
      box-price: 5.74
      basic-materials: 1.00
      basic-services: 1.00
      standard-materials: 3.25
      standard-services: 2.00
      fragile-materials: 4.25
      fragile-services: 2.25
      custom-materials: 5.25
      custom-services: 3.00
    supplier_version: "2025-05-30"

  # Custom box (not from vendor)
  - type: NormalBox
    supplier: Custom
    model: "CUSTOM-LONG"
    dimensions: [36, 4, 4]
    itemized-prices:
      box-price: 8.00
      basic-materials: 0.50
      basic-services: 2.00
      standard-materials: 1.00
      standard-services: 3.00
      fragile-materials: 2.00
      fragile-services: 4.00
      custom-materials: 3.00
      custom-services: 5.00
```