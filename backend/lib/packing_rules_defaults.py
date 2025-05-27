"""
Default packing rules and recommendation engine config based on packing_guidelines.yml
"""

# Default recommendation engine configuration
DEFAULT_ENGINE_CONFIG = {
    'weights': {
        'price': 0.45,
        'efficiency': 0.25,
        'ease': 0.30
    },
    'strategy_preferences': {
        'normal': 0,
        'prescored': 1,
        'flattened': 2,
        'manual_cut': 5,
        'telescoping': 6,
        'cheating': 8
    },
    'max_recommendations': 10,
    'extreme_cut_threshold': 0.5
}

# Default packing rules - one per packing type
DEFAULT_RULES = {
    'Basic': {
        'padding_inches': 0,
        'wizard_description': 'For non-sensitive items like clothing, toys, books',
        'label_instructions': '- Inflatable void fill as needed'
    },
    'Standard': {
        'padding_inches': 1,
        'wizard_description': 'For electronics, jewelry, and medium-sensitive items',
        'label_instructions': '''- Two (2) layers of large bubble or inflatable air cushioning
- Inflatable void fill as needed
- 1" between item and edge of box'''
    },
    'Fragile': {
        'padding_inches': 2,
        'wizard_description': 'For china, crystal, art, and sensitive equipment',
        'label_instructions': '''- One (1) layer of small bubble or foam wrap
- Two (2) layers of large bubble or inflatable air cushioning
- Inflatable void fill as needed
- Corrugated dividers for layering multiple items
- 2" between item and edge of box'''
    },
    'Custom': {
        'padding_inches': 3,
        'wizard_description': 'Maximum protection for highly sensitive items',
        'label_instructions': '''- 1" foam plank on all sides of the box
- One (1) layer of small bubble or foam wrap
- Two (2) layers of small bubble or foam wrap
- Inflatable void fill as needed
- 3" between item and edge of box'''
    }
}

def get_default_rule(packing_type: str) -> dict:
    """
    Get the default rule for a given packing type
    
    Args:
        packing_type: One of 'Basic', 'Standard', 'Fragile', 'Custom'
        
    Returns:
        Dict with padding_inches, wizard_description, label_instructions
    """
    if packing_type not in DEFAULT_RULES:
        raise ValueError(f"Unknown packing type: {packing_type}")
    return DEFAULT_RULES[packing_type].copy()

def get_all_default_rules():
    """Get all default rules in a format suitable for API responses"""
    rules = []
    for packing_type, rule_data in DEFAULT_RULES.items():
        rules.append({
            'packing_type': packing_type,
            'padding_inches': rule_data['padding_inches'],
            'wizard_description': rule_data['wizard_description'],
            'label_instructions': rule_data['label_instructions'],
            'is_custom': False
        })
    return rules

def get_default_engine_config():
    """Get the default recommendation engine configuration"""
    return DEFAULT_ENGINE_CONFIG.copy()

def get_default_engine_config_value(key, subkey=None):
    """Get a specific value from the default engine config"""
    if subkey:
        return DEFAULT_ENGINE_CONFIG.get(key, {}).get(subkey)
    return DEFAULT_ENGINE_CONFIG.get(key)