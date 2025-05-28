import os

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse


router = APIRouter(tags=["general"])


@router.get("/api/packing-guidelines", response_class=JSONResponse)
async def get_packing_guidelines():
    """Get packing guidelines"""
    guidelines_path = "stores/packing_guidelines.yml"
    if not os.path.exists(guidelines_path):
        raise HTTPException(status_code=404, detail="Packing guidelines not found")
    
    with open(guidelines_path) as f:
        guidelines = yaml.safe_load(f)
    
    return guidelines
