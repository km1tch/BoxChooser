"""Store-accessible vendor endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Tuple, Dict
from backend.lib.vendor_catalog import VendorCatalog
from backend.lib.auth_middleware import get_current_auth
from backend.lib.yaml_helpers import load_store_yaml

router = APIRouter(prefix="/api/vendors", tags=["vendors"])

# Use the same vendor catalog instance
catalog = VendorCatalog()

@router.get("")
async def list_vendors(
    auth_info: Tuple[str, str] = get_current_auth()
) -> List[dict]:
    """Get list of all available box vendors
    
    Returns list with vendor metadata including name, URL, version, and box count.
    Requires store authentication (admin level).
    """
    auth_store_id, auth_level = auth_info
    
    # Only admins can browse vendors (not regular users)
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Use the shared service
    return catalog.get_vendor_list()

@router.get("/{vendor_name}/boxes")
async def get_vendor_boxes(
    vendor_name: str,
    auth_info: Tuple[str, str] = get_current_auth()
) -> List[dict]:
    """Get all boxes for a specific vendor
    
    Returns list of boxes with model, dimensions, alternate depths, and category.
    Requires store admin authentication.
    """
    auth_store_id, auth_level = auth_info
    
    # Only admins can browse vendors (not regular users)
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # URL decode vendor name
    from urllib.parse import unquote
    vendor_name = unquote(vendor_name)
    
    # Use the shared service
    boxes = catalog.get_vendor_boxes(vendor_name)
    if boxes is None:
        raise HTTPException(404, f"Vendor '{vendor_name}' not found")
    
    return boxes


@router.get("/{vendor_name}/compare")
async def compare_vendor_with_store(
    vendor_name: str,
    auth_info: Tuple[str, str] = get_current_auth()
) -> Dict:
    """Compare vendor catalog with store's current inventory
    
    Returns detailed comparison including:
    - Total boxes in vendor catalog
    - New boxes not in store inventory
    - Existing boxes already in store
    - Updated boxes with different specifications
    
    Requires store admin authentication.
    """
    auth_store_id, auth_level = auth_info
    
    # Only admins can browse vendors (not regular users)
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # URL decode vendor name
    from urllib.parse import unquote
    vendor_name = unquote(vendor_name)
    
    # Load store's current boxes
    store_data = load_store_yaml(auth_store_id)
    store_boxes = store_data.get('boxes', [])
    
    # Use the catalog service to compare
    comparison = catalog.compare_boxes_with_store(vendor_name, store_boxes)
    if comparison is None:
        raise HTTPException(404, f"Vendor '{vendor_name}' not found")
    
    return comparison