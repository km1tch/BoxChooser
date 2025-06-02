"""Vendor catalog API endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from backend.lib.vendor_catalog import VendorCatalog
from backend.routers.superadmin import require_superadmin, audit_superadmin_action

router = APIRouter(prefix="/api/admin/vendors", tags=["vendor-catalog"])

# Initialize vendor catalog
catalog = VendorCatalog()

@router.get("")
async def list_vendors(current_admin: dict = Depends(require_superadmin)) -> List[dict]:
    """Get list of all available box vendors
    
    Returns list with vendor metadata including name, URL, version, and box count.
    Requires superadmin access.
    """
    # Log access
    audit_superadmin_action(
        current_admin['store_id'],
        "list_vendors",
        details={"endpoint": "vendors"}
    )
    
    return catalog.get_vendor_list()

@router.get("/{vendor_name}/boxes")
async def get_vendor_boxes(
    vendor_name: str,
    current_admin: dict = Depends(require_superadmin)
) -> List[dict]:
    """Get all boxes for a specific vendor
    
    Returns list of boxes with model, dimensions, alternate depths, and category.
    Requires superadmin access.
    """
    # URL decode vendor name (e.g. "America's%20Box%20Choice" -> "America's Box Choice")
    from urllib.parse import unquote
    vendor_name = unquote(vendor_name)
    
    # Log access
    audit_superadmin_action(
        current_admin['store_id'],
        "view_vendor_boxes",
        details={"vendor": vendor_name}
    )
    
    boxes = catalog.get_vendor_boxes(vendor_name)
    if boxes is None:
        raise HTTPException(404, f"Vendor '{vendor_name}' not found")
    
    return boxes