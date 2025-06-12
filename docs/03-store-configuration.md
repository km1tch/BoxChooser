# Store Configuration Guide

**Last Updated:** June 2025

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
    model: "10C-UPS"
    dimensions: [10, 10, 10]  # Length, Width, Height
    # ... pricing details
```

### Box Source

Boxes are now sourced from the universal box library (`boxes/library.yml`) rather than vendor catalogs. The system tracks whether a box came from the library or was custom-created, but this is handled internally and not stored in the YAML.

## Pricing Structure

BoxChooser uses itemized pricing that breaks down costs into box, materials, and services:

```yaml
boxes:
  - type: NormalBox
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
  model: "12X10X8"
  dimensions: [12, 10, 8]
```

### Boxes with Alternate Depths

Boxes that can be cut down to alternate heights. Use `alternate_depths` field:

```yaml
- type: NormalBox
  model: "10C-UPS"
  dimensions: [10, 10, 10]
  alternate_depths: [7.5, 5.0]  # Can be cut down to these heights
```


## Optional Fields

### Box Location

For floorplan integration (set via GUI, not YAML):

```yaml
location:
  coords: [0.425, 0.634]  # X, Y coordinates on floorplan
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

## Box Library Migration

### What Changed

The vendor system has been replaced with a universal box library:
- **Before**: Import boxes from specific vendors (ABC, ULINE, etc.)
- **Now**: Search universal library by dimensions, all boxes are vendor-agnostic

### Migration Process

1. **Existing stores**: No action needed, your boxes continue to work
2. **Adding new boxes**: Use "Box Library" instead of vendor import
3. **Supplier field**: Will be ignored for existing boxes, not added to new boxes

### Library Features

- **Dimension matching**: Find boxes by size regardless of supplier
- **Name aliases**: See all common names for the same box
- **Pivot feature**: Start with library box, modify specs as needed
- **Smart filtering**: Hide boxes you already have

## Best Practices

1. **Model naming** - Choose descriptive names when importing from library
2. **Version control** - Commit changes to git with descriptive messages  
3. **Test changes** - Use the packing calculator after making changes
4. **Skip supplier field** - Don't add supplier to new manual entries

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

  # Medium boxes with cut options
  - type: NormalBox
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