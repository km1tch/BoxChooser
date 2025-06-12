"""Box library endpoints - vendor-agnostic box catalog"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel, Field, validator

from backend.lib.auth_middleware import get_current_auth
from backend.lib.box_library import get_box_library
from typing import Tuple, Dict

router = APIRouter(prefix="/api/boxes/library", tags=["library"])


class BoxCheckRequest(BaseModel):
    """Request model for checking if a box exists in library"""
    dimensions: List[float] = Field(..., min_items=3, max_items=3)
    alternate_depths: Optional[List[float]] = Field(None, max_items=10)
    
    @validator('dimensions', each_item=True)
    def dimensions_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Each dimension must be greater than 0')
        if v > 1000:
            raise ValueError('Each dimension must be less than 1000 inches')
        return v
    
    @validator('alternate_depths', each_item=True)
    def alternate_depths_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Each alternate depth must be greater than 0')
        return v
    
    @validator('alternate_depths')
    def validate_alternate_depths(cls, v, values):
        if v is None:
            return v
        if 'dimensions' in values and values['dimensions']:
            depth = values['dimensions'][2] if len(values['dimensions']) > 2 else None
            if depth:
                invalid_depths = [d for d in v if d >= depth]
                if invalid_depths:
                    raise ValueError(f'Alternate depths {invalid_depths} must be less than box depth {depth}')
        return v


@router.get("", response_model=List[dict])
async def get_library_boxes(
    auth_info: Tuple[str, str] = Depends(get_current_auth())
) -> List[dict]:
    """
    Get all boxes from the library
    
    Returns complete library for browsing.
    Requires authentication (any level).
    """
    library = get_box_library()
    return library.boxes




@router.post("/check")
async def check_box_exists(
    request: BoxCheckRequest,
    auth_info: Tuple[str, str] = Depends(get_current_auth())
) -> dict:
    """
    Check if a box with specific dimensions exists in the library
    
    Used during custom box creation to suggest existing matches.
    """
    library = get_box_library()
    
    # Try exact match first
    exact_match = library.find_exact_match(
        request.dimensions,
        request.alternate_depths
    )
    
    if exact_match:
        return {
            "exact_match": True,
            "box": exact_match,
            "similar_boxes": []
        }
    
    # Find similar boxes
    similar = library.find_similar_boxes(request.dimensions, tolerance=1.0)
    
    return {
        "exact_match": False,
        "box": None,
        "similar_boxes": similar[:5]  # Return top 5 similar boxes
    }


