from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Body, Depends, File, HTTPException, Path, UploadFile
from fastapi.responses import JSONResponse

from backend.lib.auth_middleware import get_current_store, get_current_auth
from backend.lib.excel_import import (
    export_prices_to_excel, import_prices_from_excel,
    analyze_excel_structure, analyze_import_for_matching,
    apply_import_updates, discover_boxes_from_prices
)
from backend.lib.yaml_helpers import load_store_yaml, save_store_yaml

router = APIRouter(prefix="/api/store/{store_id}", tags=["import-export"])


@router.get("/export_prices")
async def export_prices(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_store_id: str = Depends(get_current_store)
):
    """Export prices to Excel"""
    # Load store data
    data = load_store_yaml(store_id)
    return export_prices_to_excel(store_id, data)


@router.post("/import_prices")
async def import_prices(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    file: UploadFile = File(...),
    auth_store_id: str = Depends(get_current_store)
):
    """Import prices from Excel"""
    # Load current store data
    data = load_store_yaml(store_id)
    return await import_prices_from_excel(store_id, file, data, save_store_yaml)


@router.post("/import/analyze")
async def analyze_import(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    file: UploadFile = File(...),
    auth_store_id: str = Depends(get_current_store)
):
    """Import analysis - three-tier matching"""
    # Load store data
    store_data = load_store_yaml(store_id)
    return await analyze_import_for_matching(store_id, file, store_data)


@router.post("/import/apply")
async def apply_import(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    updates: Dict[str, Any] = Body(...),
    auth_store_id: str = Depends(get_current_store)
):
    """Apply import - update prices and mappings"""
    # Load store data
    store_data = load_store_yaml(store_id)
    # Add store_id to updates for the function
    updates['store_id'] = store_id
    return apply_import_updates(store_data, updates, save_store_yaml)


@router.get("/import/excel-items")
async def get_excel_items(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    dimension_filter: Optional[str] = None
):
    """
    Get Excel items from the last analyzed import, optionally filtered by dimension
    """
    # This would typically be cached from the analyze step
    # For now, return empty as this requires session management
    return {
        'items': [],
        'message': 'Excel items would be cached from analyze step'
    }


# General Excel analysis endpoint
general_router = APIRouter(prefix="/api", tags=["import-export"])


@general_router.post("/analyze_excel")
async def analyze_excel(
    file: UploadFile = File(...),
    auth: Tuple[str, str] = Depends(get_current_auth)
):
    """Analyze uploaded Excel file structure"""
    # Any authenticated user can analyze Excel files
    return await analyze_excel_structure(file)


@router.post("/discover_boxes")
async def discover_boxes(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    file: UploadFile = File(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """
    Discover box dimensions from price sheet and suggest matches from library.
    
    This endpoint analyzes an Excel price sheet to:
    1. Extract unique box dimensions from product names
    2. Find exact matches in the box library
    3. Suggest similar boxes for dimensions without exact matches
    4. Identify dimensions that need custom boxes
    
    Returns:
        - discovered_dimensions: All unique dimensions found
        - library_matches: Exact matches from box library
        - similar_boxes: Close matches (within 10% tolerance)
        - unmatched_dimensions: Dimensions needing custom boxes
        - already_in_store: Dimensions already in the store
    """
    auth_store_id, auth_level = auth_info
    
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Load store data
    store_data = load_store_yaml(store_id)
    
    # Discover boxes from price sheet
    results = await discover_boxes_from_prices(file, store_data)
    
    # Track discovery analytics
    from backend.lib.box_analytics import BoxAnalytics
    analytics = BoxAnalytics()
    
    # Log discovery session
    analytics.log_discovery_session(
        store_id=store_id,
        total_found=results['summary']['total_boxes_found'],
        exact_matches=results['summary']['exact_matches'],
        unmatched=results['summary']['unmatched'],
        already_in_store=results['summary']['already_in_store']
    )
    
    return results