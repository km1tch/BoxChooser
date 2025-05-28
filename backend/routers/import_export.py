from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, Path, UploadFile
from fastapi.responses import JSONResponse

from backend.lib.auth_middleware import get_current_store
from backend.lib.excel_import import (
    export_prices_to_excel, import_prices_from_excel,
    analyze_excel_structure, analyze_import_for_matching,
    apply_import_updates
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
async def analyze_excel(file: UploadFile = File(...)):
    """Analyze uploaded Excel file structure"""
    return await analyze_excel_structure(file)