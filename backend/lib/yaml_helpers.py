"""
YAML helper functions for loading and saving store configuration files.
Handles the custom YAML format for box data with validation.
"""

import os
import sys
import yaml
from typing import Optional
from fastapi import HTTPException


def load_store_yaml(store_id: str) -> dict:
    """Load and validate store YAML configuration"""
    yaml_file = f"stores/store{store_id}.yml"

    if not os.path.exists(yaml_file):
        error_msg = f"Store configuration file not found at {yaml_file}"
        print(f"Error: {error_msg}")
        raise HTTPException(status_code=404, detail=error_msg)

    with open(yaml_file, "r") as f:
        try:
            boxes_data = yaml.safe_load(f)
        except Exception as e:
            print(f"YAML parsing error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"YAML parsing error: {str(e)}")

    # Validate the structure of the YAML data
    if not boxes_data or "boxes" not in boxes_data or not isinstance(boxes_data["boxes"], list):
        error_msg = "Invalid YAML structure: must contain a 'boxes' list"
        print(f"Error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

    return boxes_data


def save_store_yaml(store_id: str, data: dict) -> bool:
    """Save store data to YAML file with custom formatting"""
    yaml_file = f"stores/store{store_id}.yml"

    try:
        # Custom YAML writing to maintain the desired format
        with open(yaml_file, "w") as f:
            # Write pricing mode if present
            if "pricing-mode" in data:
                f.write(f"pricing-mode: {data['pricing-mode']}\n")
            
            # Write price group if present
            if "price-group" in data:
                f.write(f"price-group: {data['price-group']}\n")
            
            f.write("boxes:\n")

            # Determine pricing mode
            pricing_mode = data.get("pricing-mode", "standard")

            # Write each box in a nice format
            for box in data["boxes"]:
                # Always write the type
                f.write(f"  - type: {box['type']}\n")

                # Handle supplier field
                if store_id == "1" and "supplier" not in box:
                    # Skip supplier field for store1 if not present to maintain legacy format
                    pass
                else:
                    supplier = box.get('supplier', 'Unknown')
                    f.write(f"    supplier: {supplier}\n")

                # Handle model field
                if store_id == "1" and "model" not in box:
                    # Skip model field for store1 if not present to maintain legacy format
                    pass
                else:
                    model = box.get('model', f"Unknown-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")
                    f.write(f"    model: \"{model}\"\n")

                # Safely format dimensions with square brackets and commas, no spaces
                # Use a safer approach to prevent YAML injection
                if isinstance(box['dimensions'], list) and len(box['dimensions']) == 3:
                    dimensions = [float(d) if isinstance(d, (int, float)) else 0 for d in box['dimensions']]
                    dimensions_str = str(dimensions).replace(" ", "")
                    f.write(f"    dimensions: {dimensions_str}\n")
                else:
                    f.write(f"    dimensions: [0,0,0]\n")

                # Add alternate_depths if present
                if "alternate_depths" in box and isinstance(box['alternate_depths'], list):
                    # Validate depths are numeric and reasonable
                    alt_depths = [float(d) if isinstance(d, (int, float)) and 0 <= d <= 100 else 0 for d in box['alternate_depths']]
                    alt_depths_str = str(alt_depths).replace(" ", "")
                    f.write(f"    alternate_depths: {alt_depths_str}\n")

                # Write prices or itemized-prices based on pricing mode
                if pricing_mode == "standard" and "prices" in box:
                    # Safely format prices with square brackets and commas, no spaces
                    if isinstance(box['prices'], list) and len(box['prices']) == 4:
                        # Validate prices are numeric and in reasonable range
                        prices = [float(p) if isinstance(p, (int, float)) and 0 <= p <= 10000 else 0 for p in box['prices']]
                        prices_str = str(prices).replace(" ", "")
                        f.write(f"    prices: {prices_str}\n")
                    else:
                        f.write(f"    prices: [0.0,0.0,0.0,0.0]\n")
                elif pricing_mode == "itemized" and "itemized-prices" in box:
                    # Write itemized prices
                    ip = box["itemized-prices"]
                    f.write(f"    itemized-prices:\n")
                    f.write(f"      box-price: {ip.get('box-price', 0)}\n")
                    f.write(f"      basic-materials: {ip.get('basic-materials', 0)}\n")
                    f.write(f"      basic-services: {ip.get('basic-services', 0)}\n")
                    f.write(f"      standard-materials: {ip.get('standard-materials', 0)}\n")
                    f.write(f"      standard-services: {ip.get('standard-services', 0)}\n")
                    f.write(f"      fragile-materials: {ip.get('fragile-materials', 0)}\n")
                    f.write(f"      fragile-services: {ip.get('fragile-services', 0)}\n")
                    f.write(f"      custom-materials: {ip.get('custom-materials', 0)}\n")
                    f.write(f"      custom-services: {ip.get('custom-services', 0)}\n")

                # Add location if present
                if store_id == "1" and "location" not in box:
                    # Skip location field for store1 if not present to maintain legacy format
                    pass
                else:
                    location = box.get('location', {})
                    
                    # Handle empty or None locations - skip entirely
                    if location is None or (isinstance(location, dict) and not location):
                        # Skip empty locations completely
                        pass
                    # Handle dictionary with coords
                    elif isinstance(location, dict) and 'coords' in location and location['coords']:
                        # Start location section
                        f.write(f"    location:\n")
                        
                        coords = location['coords']
                        # Ensure coords are floats and valid
                        if isinstance(coords, list) and len(coords) == 2:
                            x = float(coords[0]) if isinstance(coords[0], (int, float)) else 0
                            y = float(coords[1]) if isinstance(coords[1], (int, float)) else 0
                            f.write(f"      coords: [{x}, {y}]\n")
                    # Handle legacy string locations (skip completely)
                    elif isinstance(location, str) and location.strip():
                        # Skip legacy string locations
                        pass

                # Add MPOS_mapping if present
                if "MPOS_mapping" in box and isinstance(box["MPOS_mapping"], dict):
                    mapping = box["MPOS_mapping"]
                    f.write(f"    MPOS_mapping:\n")
                    # Write each mapping field if present
                    for field in ["box", "basic_materials", "basic_service", 
                                 "standard_materials", "standard_service",
                                 "fragile_materials", "fragile_service", 
                                 "custom_materials", "custom_service"]:
                        if field in mapping:
                            f.write(f"      {field}: {mapping[field]}\n")

                f.write("\n")

        return True
    except Exception as e:
        print(f"Error saving YAML: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving YAML: {str(e)}")


def get_box_section(model: str, box_type: Optional[str] = None) -> str:
    """Define box sections based on model patterns or box type"""
    # First try to categorize based on model if it exists
    if model and model.strip():
        if any(model.endswith(suffix) for suffix in ["C-UPS", "C", "Cube"]):
            return "CUBE"
        elif any(x in model for x in ["X 4", "X 3", "X 6", "J-11", "J-14", "J-15", "J-16", "SHIRTB"]):
            return "SMALL"
        elif any(x in model for x in ["J-20", "WREATH", "ST-6", "MIR-3", "MIR-8"]):
            return "MEDIUM"
        elif any(x in model for x in ["J-64", "SUITCASE", "VCR", "24 X 18 X 18"]):
            return "LARGE"
        else:
            # Check if dimensions indicate a cube (all dimensions equal)
            # Model might be like "22x22x22" or "22 X 22 X 22"
            import re
            normalized_model = model.lower().replace(" ", "")
            match = re.match(r'^(\d+)x(\d+)x(\d+)$', normalized_model)
            if match and match.group(1) == match.group(2) == match.group(3):
                return "CUBE"
            return "SPECIALTY"
            
    # If no model or couldn't categorize, use box type
    if box_type:
        if box_type == "NormalBox":
            return "NORMAL"
        elif box_type == "CustomBox":
            return "CUSTOM"
            
    # Fallback
    return "OTHER"


def validate_box_data(box_data: dict, store_id: str, pricing_mode: str = "standard") -> None:
    """Validate box data before saving"""
    # Validate required fields
    if "type" not in box_data:
        raise ValueError("Box missing required 'type' field")
    
    if "dimensions" not in box_data or not isinstance(box_data["dimensions"], list) or len(box_data["dimensions"]) != 3:
        raise ValueError("Box has invalid 'dimensions' (must be list of 3 numbers)")
    
    # Validate pricing data based on pricing mode
    if pricing_mode == "standard":
        if "prices" not in box_data or not isinstance(box_data["prices"], list) or len(box_data["prices"]) != 4:
            raise ValueError("Box has invalid 'prices' (must be list of 4 numbers)")
        
        if "itemized-prices" in box_data:
            raise ValueError("Box has 'itemized-prices' but store is in standard pricing mode")
    else:  # itemized pricing mode
        if "itemized-prices" not in box_data or not isinstance(box_data["itemized-prices"], dict):
            raise ValueError("Box missing 'itemized-prices' (must be an object)")
        
        # Validate required itemized pricing fields
        required_fields = ["box-price", "standard-materials", "standard-services", 
                          "fragile-materials", "fragile-services", 
                          "custom-materials", "custom-services"]
        
        for field in required_fields:
            if field not in box_data["itemized-prices"]:
                raise ValueError(f"Box missing required field '{field}' in itemized-prices")
        
        if "prices" in box_data:
            raise ValueError("Box has 'prices' but store is in itemized pricing mode")
    
    if box_data["type"] == "CustomBox" and "open_dim" not in box_data:
        raise ValueError("Box is CustomBox but missing 'open_dim' field")

    # Optional fields validation
    if "supplier" in box_data and not isinstance(box_data["supplier"], str):
        raise ValueError("Box has invalid 'supplier' (must be a string)")
    
    if "model" in box_data and not isinstance(box_data["model"], str):
        raise ValueError("Box has invalid 'model' (must be a string)")
    
    # Location must be a dictionary, string, or empty/missing
    if "location" in box_data:
        # Handle None or empty value by converting to empty dict
        if box_data["location"] is None:
            box_data["location"] = {}
            
        # Check type
        if not isinstance(box_data["location"], (str, dict)):
            raise ValueError("Box has invalid 'location' (must be a dictionary or string)")
            
        # If location is a dict, validate its structure
        if isinstance(box_data["location"], dict):
            location = box_data["location"]
            
            # If coords are present, validate them
            if "coords" in location and location["coords"] is not None:
                coords = location["coords"]
                if not isinstance(coords, list) or len(coords) != 2:
                    raise ValueError("Box has invalid 'location.coords' (must be a list of 2 numbers)")
                if not all(isinstance(coord, (int, float)) for coord in coords):
                    raise ValueError("Box has invalid coordinate values (must be numbers)")
    
    if "alternate_depths" in box_data:
        if not isinstance(box_data["alternate_depths"], list):
            raise ValueError("Box has invalid 'alternate_depths' (must be a list of numbers)")
        for depth in box_data["alternate_depths"]:
            if not isinstance(depth, (int, float)):
                raise ValueError("Box has invalid value in 'alternate_depths' (must be numbers)")


def validate_packing_guidelines():
    """Validate packing_guidelines.yml exists and has required structure - dies on error"""
    guidelines_path = "stores/packing_guidelines.yml"
    
    if not os.path.exists(guidelines_path):
        print(f"FATAL: {guidelines_path} not found!")
        sys.exit(1)
    
    try:
        with open(guidelines_path) as f:
            guidelines = yaml.safe_load(f)
        
        # Validate recommendation engine config
        if 'recommendation_engine' not in guidelines:
            print(f"FATAL: {guidelines_path} missing 'recommendation_engine' section!")
            sys.exit(1)
        
        engine_config = guidelines['recommendation_engine']
        
        # Validate required sections
        required_sections = ['weights', 'strategy_preferences']
        for section in required_sections:
            if section not in engine_config:
                print(f"FATAL: {guidelines_path} missing 'recommendation_engine.{section}'!")
                sys.exit(1)
        
        # Validate weights exist and sum to 1.0
        weights = engine_config['weights']
        if not isinstance(weights, dict):
            print(f"FATAL: {guidelines_path} 'weights' must be a dictionary!")
            sys.exit(1)
            
        required_weights = ['price', 'efficiency', 'ease']
        for weight in required_weights:
            if weight not in weights:
                print(f"FATAL: {guidelines_path} missing weight '{weight}'!")
                sys.exit(1)
                
        weight_sum = weights.get('price', 0) + weights.get('efficiency', 0) + weights.get('ease', 0)
        if abs(weight_sum - 1.0) > 0.001:
            print(f"FATAL: Weights in {guidelines_path} must sum to 1.0 (current: {weight_sum})")
            sys.exit(1)
        
        # Validate strategy preferences
        strategies = engine_config.get('strategy_preferences', {})
        required_strategies = ['normal', 'prescored', 'flattened', 'manual_cut', 'telescoping', 'cheating']
        for strategy in required_strategies:
            if strategy not in strategies:
                print(f"FATAL: {guidelines_path} missing strategy preference '{strategy}'!")
                sys.exit(1)
            if not isinstance(strategies[strategy], (int, float)) or strategies[strategy] < 0 or strategies[strategy] > 10:
                print(f"FATAL: Strategy '{strategy}' must be a number between 0 and 10!")
                sys.exit(1)
        
        # Validate thresholds
        if 'practically_tight_threshold' not in engine_config:
            print(f"FATAL: {guidelines_path} missing 'practically_tight_threshold'!")
            sys.exit(1)
        if 'max_recommendations' not in engine_config:
            print(f"FATAL: {guidelines_path} missing 'max_recommendations'!")
            sys.exit(1)
        if 'extreme_cut_threshold' not in engine_config:
            print(f"FATAL: {guidelines_path} missing 'extreme_cut_threshold'!")
            sys.exit(1)
            
        # Validate extreme_cut_threshold range
        cut_threshold = engine_config['extreme_cut_threshold']
        if cut_threshold <= 0 or cut_threshold > 1:
            print(f"FATAL: extreme_cut_threshold must be between 0 and 1 (current: {cut_threshold})")
            sys.exit(1)
        
        # Validate packing rules exist
        required_rules = ['basic', 'standard', 'fragile', 'custom']
        for rule in required_rules:
            if rule not in guidelines:
                print(f"FATAL: {guidelines_path} missing '{rule}' packing rule!")
                sys.exit(1)
            
            # Validate each rule has required fields
            rule_data = guidelines[rule]
            required_fields = ['padding_inches', 'wizard_description', 'label_instructions']
            for field in required_fields:
                if field not in rule_data:
                    print(f"FATAL: Packing rule '{rule}' missing field '{field}'!")
                    sys.exit(1)
                
        print(f"✓ {guidelines_path} validated successfully")
        
    except yaml.YAMLError as e:
        print(f"FATAL: Failed to parse {guidelines_path}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"FATAL: Error validating {guidelines_path}: {e}")
        sys.exit(1)