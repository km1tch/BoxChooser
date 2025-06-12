import os

import yaml
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Tuple
from backend.lib.auth_middleware import get_current_auth


router = APIRouter(tags=["general"])


@router.get("/api/packing-guidelines", response_class=JSONResponse)
async def get_packing_guidelines(
    auth: Tuple[str, str] = Depends(get_current_auth)
):
    """Get packing guidelines"""
    # Note: This returns global guidelines, not store-specific
    # Any authenticated user can access these
    guidelines_path = "stores/packing_guidelines.yml"
    if not os.path.exists(guidelines_path):
        raise HTTPException(status_code=404, detail="Packing guidelines not found")
    
    with open(guidelines_path) as f:
        guidelines = yaml.safe_load(f)
    
    return guidelines
