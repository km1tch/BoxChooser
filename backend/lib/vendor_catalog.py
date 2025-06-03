"""Vendor catalog management for box suppliers"""
import os
import logging
from glob import glob
from pathlib import Path
from typing import Dict, List, Optional
import yaml

logger = logging.getLogger(__name__)


def validate_vendor_data(vendor_data: dict, filename: str) -> bool:
    """Validate vendor YAML structure
    
    Args:
        vendor_data: The loaded vendor YAML data
        filename: The filename (without path) for ID validation
    
    Returns:
        bool: True if valid, raises ValueError if invalid
    """
    # Check top-level structure
    if not isinstance(vendor_data, dict):
        raise ValueError("Vendor data must be a dictionary")
    
    # Check required top-level fields
    if 'vendor' not in vendor_data:
        raise ValueError("Missing required field: 'vendor'")
    
    if 'boxes' not in vendor_data:
        raise ValueError("Missing required field: 'boxes'")
    
    # Validate vendor metadata
    vendor_info = vendor_data['vendor']
    if not isinstance(vendor_info, dict):
        raise ValueError("'vendor' field must be a dictionary")
    
    # Check required vendor fields
    required_vendor_fields = ['id', 'name', 'version']
    for field in required_vendor_fields:
        if field not in vendor_info:
            raise ValueError(f"Missing required vendor field: '{field}'")
    
    # Validate that filename matches vendor ID
    expected_filename = f"{vendor_info['id']}.yml"
    if filename != expected_filename:
        raise ValueError(f"Filename '{filename}' must match vendor ID '{vendor_info['id']}' (expected '{expected_filename}')")
    
    # Validate vendor ID format and length
    vendor_id = vendor_info['id']
    if not vendor_id or not vendor_id.replace('-', '').replace('_', '').isalnum():
        raise ValueError(f"Vendor ID '{vendor_id}' must be alphanumeric (dashes and underscores allowed)")
    if len(vendor_id) > 50:
        raise ValueError(f"Vendor ID must be 50 characters or less (got {len(vendor_id)})")
    
    # Validate vendor name length
    vendor_name = vendor_info['name']
    if len(vendor_name) > 100:
        raise ValueError(f"Vendor name must be 100 characters or less (got {len(vendor_name)})")
    
    # Validate boxes
    boxes = vendor_data['boxes']
    if not isinstance(boxes, list):
        raise ValueError("'boxes' field must be a list")
    
    # Validate each box
    for i, box in enumerate(boxes):
        if not isinstance(box, dict):
            raise ValueError(f"Box at index {i} must be a dictionary")
        
        # Required box fields
        if 'model' not in box:
            raise ValueError(f"Box at index {i} missing required field: 'model'")
        
        # Validate model length
        model = box['model']
        if not model or len(str(model)) > 50:
            raise ValueError(f"Box model at index {i} must be 1-50 characters (got {len(str(model))})")
        
        if 'dimensions' not in box:
            raise ValueError(f"Box at index {i} missing required field: 'dimensions'")
        
        # Validate dimensions
        dims = box['dimensions']
        if not isinstance(dims, list) or len(dims) != 3:
            raise ValueError(f"Box at index {i}: dimensions must be a list of 3 numbers")
        
        for j, d in enumerate(dims):
            if not isinstance(d, (int, float)) or d <= 0:
                raise ValueError(f"Box at index {i}: dimensions must be positive numbers")
            # Reasonable bounds: 0.1 to 1000 inches
            if d < 0.1 or d > 1000:
                raise ValueError(f"Box at index {i}, dimension {j}: value {d} must be between 0.1 and 1000 inches")
        
        # Validate optional fields
        if 'alternate_depths' in box:
            alt_depths = box['alternate_depths']
            if not isinstance(alt_depths, list):
                raise ValueError(f"Box at index {i}: alternate_depths must be a list")
            
            for k, depth in enumerate(alt_depths):
                if not isinstance(depth, (int, float)) or depth <= 0:
                    raise ValueError(f"Box at index {i}: alternate depths must be positive numbers")
                # Same bounds as dimensions
                if depth < 0.1 or depth > 1000:
                    raise ValueError(f"Box at index {i}, alternate depth {k}: value {depth} must be between 0.1 and 1000 inches")
        
        if 'category' in box:
            valid_categories = ['cube', 'small', 'medium', 'large', 'specialty']
            if box['category'] not in valid_categories:
                raise ValueError(f"Box at index {i}: category must be one of {valid_categories}")
    
    return True


class VendorCatalog:
    def __init__(self):
        self.vendors: Dict[str, dict] = {}  # Keyed by vendor ID
        self.vendors_by_name: Dict[str, dict] = {}  # For name lookups
        self._load_all_vendors()
    
    def _load_all_vendors(self):
        """Load all vendor YAML files from vendors/ directory"""
        # Use pathlib for robust path handling
        vendor_dir = Path("vendors").resolve()
        
        # Ensure vendor directory exists
        if not vendor_dir.exists():
            logger.warning(f"Vendor directory not found: {vendor_dir}")
            return
            
        vendor_files = vendor_dir.glob("*.yml")
        
        for vendor_file in vendor_files:
            try:
                # Ensure file is within vendor directory (prevent traversal)
                vendor_file_resolved = vendor_file.resolve()
                if not vendor_file_resolved.is_relative_to(vendor_dir):
                    logger.error(f"Security: Attempted to load file outside vendor directory: {vendor_file}")
                    continue
                    
                with open(vendor_file_resolved, 'r') as f:
                    vendor_data = yaml.safe_load(f)
                
                if vendor_data:
                    # Extract filename for validation
                    filename = vendor_file.name
                    
                    # Validate vendor data structure and filename
                    validate_vendor_data(vendor_data, filename)
                    
                    vendor_info = vendor_data['vendor']
                    vendor_id = vendor_info['id']
                    vendor_name = vendor_info['name']
                    
                    # Store by ID (primary key)
                    self.vendors[vendor_id] = vendor_data
                    # Also store by name for backward compatibility
                    self.vendors_by_name[vendor_name] = vendor_data
                    
                    logger.info(f"Loaded vendor catalog: {vendor_name} (ID: {vendor_id}, version {vendor_info['version']})")
            except yaml.YAMLError as e:
                logger.error(f"YAML parsing error in {vendor_file}: {e}")
            except ValueError as e:
                logger.error(f"Validation error in {vendor_file}: {e}")
            except KeyError as e:
                logger.error(f"Missing required field in {vendor_file}: {e}")
            except Exception as e:
                logger.error(f"Unexpected error loading vendor file {vendor_file}: {e}")
    
    def get_vendor_list(self) -> List[dict]:
        """Return list of available vendors with metadata"""
        return [
            {
                'id': v['vendor']['id'],
                'name': v['vendor']['name'],
                'url': v['vendor'].get('url'),
                'version': v['vendor']['version'],
                'box_count': len(v.get('boxes', []))
            }
            for v in self.vendors.values()
        ]
    
    def get_vendor_boxes(self, vendor_id_or_name: str) -> Optional[List[dict]]:
        """Get all boxes for a specific vendor
        
        Args:
            vendor_id_or_name: Either the vendor ID or name (for backward compatibility)
        """
        # Try ID first
        vendor_data = self.vendors.get(vendor_id_or_name)
        # Fall back to name lookup
        if not vendor_data:
            vendor_data = self.vendors_by_name.get(vendor_id_or_name)
        
        if not vendor_data:
            return None
        return vendor_data.get('boxes', [])
    
    def compare_boxes_with_store(self, vendor_id_or_name: str, store_boxes: List[dict]) -> dict:
        """Compare vendor boxes with store's existing boxes
        
        Args:
            vendor_id_or_name: Either the vendor ID or name
            store_boxes: List of boxes from the store's YAML
            
        Returns:
            Dict with comparison results:
            {
                'vendor_id': str,
                'vendor_name': str,
                'vendor_version': str,
                'total_boxes': int,
                'new_boxes': List[dict],  # Boxes not in store
                'existing_boxes': List[dict],  # Boxes already in store
                'updated_boxes': List[dict],  # Boxes with different dimensions/specs
            }
        """
        # Try ID first
        vendor_data = self.vendors.get(vendor_id_or_name)
        # Fall back to name lookup
        if not vendor_data:
            vendor_data = self.vendors_by_name.get(vendor_id_or_name)
        
        if not vendor_data:
            return None
            
        vendor_boxes = vendor_data.get('boxes', [])
        vendor_info = vendor_data['vendor']
        vendor_id = vendor_info['id']
        
        # Create lookup maps for efficient comparison
        # Key by (supplier, model) tuple for exact matching
        store_box_map = {}
        for box in store_boxes:
            key = (box.get('supplier', '').lower(), box.get('model', '').lower())
            store_box_map[key] = box
        
        new_boxes = []
        existing_boxes = []
        updated_boxes = []
        
        for vbox in vendor_boxes:
            # Check if this box exists in store using the vendor ID
            key = (vendor_id.lower(), vbox['model'].lower())
            store_box = store_box_map.get(key)
            
            if not store_box:
                new_boxes.append(vbox)
            else:
                # Box exists - check if it's identical or updated
                # Compare dimensions
                vbox_dims = vbox.get('dimensions', [])
                store_dims = store_box.get('dimensions', [])
                
                # Compare alternate depths (normalize field names)
                vbox_alt = vbox.get('alternate_depths', [])
                store_alt = store_box.get('alternate_depths') or store_box.get('prescored_heights', [])
                
                # Check version
                store_version = store_box.get('supplier_version')
                current_version = vendor_info.get('version', 'unknown')
                
                if vbox_dims != store_dims or set(vbox_alt or []) != set(store_alt or []):
                    # Dimensions or alternate depths differ
                    updated_boxes.append({
                        'vendor_box': vbox,
                        'store_box': store_box,
                        'store_version': store_version,
                        'current_version': current_version,
                        'differences': {
                            'dimensions': vbox_dims != store_dims,
                            'alternate_depths': set(vbox_alt or []) != set(store_alt or [])
                        }
                    })
                elif store_version and store_version != current_version:
                    # Same specs but different version (catalog updated without spec changes)
                    updated_boxes.append({
                        'vendor_box': vbox,
                        'store_box': store_box,
                        'store_version': store_version,
                        'current_version': current_version,
                        'differences': {
                            'version_only': True
                        }
                    })
                else:
                    existing_boxes.append(vbox)
        
        return {
            'vendor_id': vendor_id,
            'vendor_name': vendor_info['name'],
            'vendor_version': vendor_info.get('version', 'unknown'),
            'total_boxes': len(vendor_boxes),
            'new_boxes': new_boxes,
            'existing_boxes': existing_boxes,
            'updated_boxes': updated_boxes,
            'new_count': len(new_boxes),
            'existing_count': len(existing_boxes),
            'updated_count': len(updated_boxes)
        }