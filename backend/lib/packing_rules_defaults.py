"""
Default packing rules and recommendation engine config loaded from packing_guidelines.yml
"""

import os
import yaml
import sys

# Load defaults from packing_guidelines.yml - REQUIRED
_guidelines_path = os.path.join(os.path.dirname(__file__), '..', '..', 'stores', 'packing_guidelines.yml')

try:
    with open(_guidelines_path, 'r') as f:
        _guidelines_data = yaml.safe_load(f)
except Exception as e:
    print(f"FATAL: Could not load required packing_guidelines.yml: {e}", file=sys.stderr)
    sys.exit(1)

# Validate required sections exist
if 'recommendation_engine' not in _guidelines_data:
    print("FATAL: packing_guidelines.yml missing 'recommendation_engine' section", file=sys.stderr)
    sys.exit(1)

DEFAULT_ENGINE_CONFIG = _guidelines_data['recommendation_engine']

# Validate engine config has required fields
required_engine_fields = ['weights', 'strategy_preferences', 'practically_tight_threshold', 
                         'max_recommendations', 'extreme_cut_threshold']
for field in required_engine_fields:
    if field not in DEFAULT_ENGINE_CONFIG:
        print(f"FATAL: packing_guidelines.yml missing 'recommendation_engine.{field}'", file=sys.stderr)
        sys.exit(1)

# Build DEFAULT_RULES from the YAML
DEFAULT_RULES = {}
for packing_type in ['basic', 'standard', 'fragile', 'custom']:
    if packing_type not in _guidelines_data:
        print(f"FATAL: packing_guidelines.yml missing '{packing_type}' section", file=sys.stderr)
        sys.exit(1)
    
    rule = _guidelines_data[packing_type]
    required_rule_fields = ['padding_inches', 'wizard_description', 'label_instructions']
    for field in required_rule_fields:
        if field not in rule:
            print(f"FATAL: packing_guidelines.yml missing '{packing_type}.{field}'", file=sys.stderr)
            sys.exit(1)
    
    # Capitalize the packing type for consistency with existing code
    DEFAULT_RULES[packing_type.capitalize()] = rule

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