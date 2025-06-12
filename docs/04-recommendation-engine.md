# Recommendation Engine Documentation

## Overview

The recommendation engine helps users find the best box for their items by evaluating multiple factors: price, space efficiency, and packing complexity. It uses a simple, transparent scoring algorithm that respects user-configured preferences.

## How It Works

### 1. Filter
Only include box/strategy combinations where the item physically fits (including required padding).

### 2. Score
Each valid combination receives a composite score:

```
compositeScore = (weight_price × normalizedPrice) + 
                 (weight_efficiency × normalizedEfficiency) + 
                 (weight_ease × strategyPenalty)
```

**Important: Lower scores = better recommendations**

### 3. Sort & Tag
Results are sorted by composite score and tagged with descriptive labels based on their characteristics (not prescriptive rankings).

## Score Components

#### Price Score (normalizedPrice)
- Range: 0.0 to 1.0
- 0.0 = cheapest option
- 1.0 = most expensive option
- Normalized across all available options

#### Efficiency Score (normalizedEfficiency)
- Range: 0.0 to 1.0
- 0.0 = tightest fit (least wasted space)
- 1.0 = loosest fit (most wasted space)
- Based on sum of squared dimension differences

#### Strategy Penalty (strategyPenalty)
- Range: 0.0 to 1.0
- Calculated as: `strategy_preference / 10`
- 0.0 = most preferred strategy
- 1.0 = least preferred strategy

## Configurable Parameters

### 1. Weights
Control the importance of each factor (must sum to 1.0):

```yaml
weights:
  price: 0.45        # 45% weight on cost
  efficiency: 0.25   # 25% weight on space utilization
  ease: 0.30         # 30% weight on packing complexity
```

### 2. Strategy Preferences
Rate each packing strategy from 0-10 (lower = more preferred):

```yaml
strategy_preferences:
  normal: 0          # No modifications needed
  prescored: 1       # Pre-scored cuts (easy)
  flattened: 2       # Flat pack for posters
  manual_cut: 5      # Manual cutting required
  telescoping: 6     # Multiple boxes
  cheating: 8        # Diagonal packing
```

### 3. Other Settings

```yaml
max_recommendations: 10            # Maximum results to show
extreme_cut_threshold: 0.5         # Min ratio of box remaining after cut (50%)
```

## How Recommendations Are Generated

1. **Test all strategies**: For each box, try Normal, Cut Down, Telescoping, Cheating, and Flattened strategies
2. **Filter valid options**: Keep only strategies where the item fits with required padding
3. **Calculate scores**: Normalize prices and efficiency scores across all options
4. **Apply weights**: Calculate composite score using user-configured weights
5. **Sort and limit**: Order by composite score and return top N results
6. **Add descriptive tags**: Label each recommendation based on its characteristics:
   - "No Modifications" for normal boxes
   - "Pre-Scored Cut" for boxes with pre-marked cut lines
   - "Manual Cut Required" for custom cutting
   - "Multiple Boxes" for telescoping
   - "Diagonal Pack" for cheating strategy
   - "Flat Pack" for flattened boxes
   - "Lowest Price" if it actually is the cheapest
   - "Tightest Fit" if it has the best efficiency score

## Examples

### Example 1: Cost-Conscious Configuration
```yaml
weights:
  price: 0.70        # Prioritize cheapest
  efficiency: 0.10   # Less concerned about fit
  ease: 0.20         # Some consideration for ease
```

### Example 2: Efficiency-Focused Configuration
```yaml
weights:
  price: 0.20        # Cost less important
  efficiency: 0.60   # Minimize wasted space
  ease: 0.20         # Some consideration for ease
```

### Example 3: Ease-First Configuration
```yaml
weights:
  price: 0.25        # Balanced consideration
  efficiency: 0.25   # Balanced consideration
  ease: 0.50         # Prioritize simple packing

strategy_preferences:
  normal: 0          # Strongly prefer
  prescored: 1       # Also good
  manual_cut: 9      # Strongly avoid
```

## Scoring Example Walkthrough

Let's say we have two options for packing an item:

**Option A: Normal strategy, medium box**
- Price: $5 (normalized: 0.4)
- Efficiency: Good fit (normalized: 0.2)
- Strategy: Normal (preference: 0 → penalty: 0.0)

```
scoreA = (0.45 × 0.4) + (0.25 × 0.2) + (0.30 × 0.0)
       = 0.18 + 0.05 + 0.0
       = 0.23
```

**Option B: Manual cut, cheap box**
- Price: $3 (normalized: 0.0)
- Efficiency: Perfect fit after cut (normalized: 0.0)
- Strategy: Manual cut (preference: 5 → penalty: 0.5)

```
scoreB = (0.45 × 0.0) + (0.25 × 0.0) + (0.30 × 0.5)
       = 0.0 + 0.0 + 0.15
       = 0.15
```

**Result**: Option B scores lower (0.15 < 0.23), so it ranks higher despite requiring manual cutting.

## Customization Guidelines

### For High-Volume Shippers
- Increase `ease` weight
- Set high preferences for `manual_cut` and `telescoping`
- Focus on strategies that minimize labor

### For Specialty/Fragile Items
- Increase `efficiency` weight
- Keep `manual_cut` preference moderate (precision cuts may be worth it)
- Consider lowering strategy preferences for precision strategies

### For Budget-Conscious Operations
- Increase `price` weight to 0.60+
- Accept higher strategy preferences if it saves money
- Consider increasing `extreme_cut_threshold` to allow more aggressive cuts

## Special Behaviors

### Extreme Cut Filtering
Boxes that would be cut down to less than `extreme_cut_threshold` (default 50%) of their original size are automatically excluded. This prevents suggesting absurd modifications like cutting a 24" box down to 6".

### Pre-Scored Boxes
When a box has pre-scored cut lines at specific depths, these are preferred over manual cuts. The engine automatically detects and uses pre-scored options when they meet the item's requirements.

### Descriptive Tags
Each recommendation receives tags that describe its characteristics:
- Strategy-based tags (e.g., "No Modifications", "Pre-Scored Cut", "Manual Cut Required")
- Superlative tags when applicable (e.g., "Lowest Price", "Tightest Fit")
- Multiple tags can be combined (e.g., "Pre-Scored Cut • Lowest Price")

## Store-Specific Overrides

Stores can override any of these settings through the admin interface. Custom settings are stored in the database and take precedence over the defaults in `packing_guidelines.yml`.

Priority order:
1. Store-specific settings (if configured)
2. Default settings from `packing_guidelines.yml`
3. Hard-coded fallbacks (if files are missing)