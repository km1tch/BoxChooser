"""
Box management endpoints.
Handles CRUD operations for boxes, pricing updates, and box sections.

Authentication: All endpoints follow the standard pattern defined in
docs/authentication-api-patterns.md - using dependency injection with
get_current_auth() for consistent authentication and authorization.
"""

import json
import logging
import os
from typing import Dict, Any, Optional, List, Tuple

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

from backend.lib.auth_middleware import get_current_auth
from typing import Tuple
from backend.lib.yaml_helpers import load_store_yaml, save_store_yaml, get_box_section, validate_box_data
from backend.lib.box_analytics import BoxAnalytics
from pathlib import Path as PathLib

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/store/{store_id}", tags=["boxes"])




@router.get("/info", response_class=JSONResponse)
async def get_store_info(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Get store configuration info including price group"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = load_store_yaml(store_id)
    return {
        "store_id": store_id,
        "name": data.get("name", "")
    }


@router.get("/boxes", response_class=JSONResponse)
async def get_boxes(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Get all boxes for a store with validation"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    yaml_file = f"stores/store{store_id}.yml"

    if not os.path.exists(yaml_file):
        error_msg = f"Store configuration file not found at {yaml_file}"
        raise HTTPException(status_code=404, detail=error_msg)

    with open(yaml_file, "r") as f:
        try:
            boxes_data = yaml.safe_load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"YAML parsing error: {str(e)}")

    # Validate the structure of the YAML data
    if not boxes_data or "boxes" not in boxes_data or not isinstance(boxes_data["boxes"], list):
        error_msg = "Invalid YAML structure: must contain a 'boxes' list"
        raise HTTPException(status_code=500, detail=error_msg)

    # Validate each box entry
    for i, box in enumerate(boxes_data["boxes"]):
        try:
            validate_box_data(box, store_id)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=f"Box at index {i}: {str(e)}")

    return boxes_data


@router.get("/boxes_with_sections", response_class=JSONResponse)
async def get_boxes_with_sections(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Get boxes formatted for the editor with sections"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    data = load_store_yaml(store_id)
    result = []

    for box in data["boxes"]:
        # Handle legacy format (missing model and location)
        model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")

        # Get section based on model or box type
        box_type = box.get("type")
        section = get_box_section(model, box_type)
        

        dimensions_str = "x".join(str(d) for d in box["dimensions"])
        
        # Always use itemized pricing
        ip = box.get("itemized-prices", {})
        
        # Calculate totals for each level
        box_price = ip.get("box-price", 0)
        basic_total = box_price + ip.get("basic-materials", 0) + ip.get("basic-services", 0)
        standard_total = box_price + ip.get("standard-materials", 0) + ip.get("standard-services", 0)
        fragile_total = box_price + ip.get("fragile-materials", 0) + ip.get("fragile-services", 0) 
        custom_total = box_price + ip.get("custom-materials", 0) + ip.get("custom-services", 0)
        
        box_data = {
            "section": section,
            "model": model,
            "dimensions": dimensions_str,
            "box_price": box_price,
            "basic_materials": ip.get("basic-materials", 0),
            "basic_services": ip.get("basic-services", 0),
            "basic_total": basic_total,
            "standard_materials": ip.get("standard-materials", 0),
            "standard_services": ip.get("standard-services", 0),
            "standard_total": standard_total,
            "fragile_materials": ip.get("fragile-materials", 0),
            "fragile_services": ip.get("fragile-services", 0),
            "fragile_total": fragile_total,
            "custom_materials": ip.get("custom-materials", 0),
            "custom_services": ip.get("custom-services", 0),
            "custom_total": custom_total,
            "location": box.get("location", "???"),
            "pricing_mode": "itemized"
        }

        result.append(box_data)

    # Sort by section and then by model
    result.sort(key=lambda x: (x["section"], x["model"]))

    return result


@router.get("/all_boxes", response_class=JSONResponse)
async def get_all_boxes(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Get all boxes at once (bulk endpoint)"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    data = load_store_yaml(store_id)
    
    # Add model field to all boxes that don't have it
    for box in data["boxes"]:
        if "model" not in box:
            box["model"] = f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}"
    
    return {"boxes": data["boxes"]}


@router.get("/box/{model}", response_class=JSONResponse)
async def get_box_by_model(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    model: str = Path(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Get a single box by model"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = load_store_yaml(store_id)

    for box in data["boxes"]:
        # Handle legacy format and compare with the provided model
        box_model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")

        if box_model == model:
            # For legacy boxes, ensure all fields exist
            if "model" not in box:
                box["model"] = box_model
            if "location" not in box:
                box["location"] = "???"
            
            return box

    raise HTTPException(status_code=404, detail=f"Box with model {model} not found")




class ItemizedPriceUpdateRequest(BaseModel):
    """Request model for itemized price updates"""
    changes: Dict[str, Dict[str, float]]
    csrf_token: str




@router.post("/update_itemized_prices", response_class=JSONResponse)
async def update_itemized_prices(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    update_data: ItemizedPriceUpdateRequest = Body(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Update itemized prices for multiple boxes"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    # Extract data from the request
    changes = update_data.changes

    # Validate CSRF token - normally you would check against a server-stored token
    # This is a simple check to ensure the token is present
    if not update_data.csrf_token or len(update_data.csrf_token) < 10:
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

    data = load_store_yaml(store_id)

    updated_count = 0

    # Update prices for each box in the changes dict
    for box in data["boxes"]:
        # Get the actual model or generate a default one for legacy boxes
        box_model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")

        if box_model in changes:
            price_changes = changes[box_model]
            
            # Ensure itemized-prices exists
            if "itemized-prices" not in box:
                box["itemized-prices"] = {
                    "box-price": 0,
                    "basic-materials": 0,
                    "basic-services": 0,
                    "standard-materials": 0,
                    "standard-services": 0,
                    "fragile-materials": 0,
                    "fragile-services": 0,
                    "custom-materials": 0,
                    "custom-services": 0
                }

            # Apply changes to appropriate fields
            for field, new_price in price_changes.items():
                # Convert underscore field names to hyphenated YAML format
                yaml_field = field.replace('_', '-')
                
                # Validate price - must be a positive number within a reasonable range
                if isinstance(new_price, (int, float)) and 0 <= new_price <= 10000:
                    box["itemized-prices"][yaml_field] = new_price
                    updated_count += 1
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid price value: {new_price}. Prices must be between 0 and 10000.")

            # If this is a legacy box and we're updating it, add the model field
            # so we can reference it again in the future
            if "model" not in box:
                box["model"] = box_model

    # Save the updated YAML file
    save_store_yaml(store_id, data)

    return {"message": f"Updated {updated_count} itemized prices successfully"}


class LocationUpdateRequest(BaseModel):
    """Request model for box location updates"""
    location: Optional[Dict[str, Any]]


@router.put("/box/{model}/location", response_class=JSONResponse)
async def update_box_location(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    model: str = Path(...),
    location_data: LocationUpdateRequest = Body(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Update location for a specific box"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    data = load_store_yaml(store_id)
    
    # Find the box
    box_found = False
    for box in data["boxes"]:
        box_model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")
        
        if box_model == model:
            # Update location
            if location_data.location:
                box["location"] = location_data.location
            else:
                # Remove location if None/null provided
                box.pop("location", None)
            box_found = True
            break
    
    if not box_found:
        raise HTTPException(status_code=404, detail=f"Box with model {model} not found")
    
    # Save the updated YAML file
    save_store_yaml(store_id, data)
    
    return {"message": "Location updated successfully"}


@router.delete("/box/{model}", response_class=JSONResponse)
async def delete_box(
    model: str = Path(...),
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Delete a box from the store inventory"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    data = load_store_yaml(store_id)
    
    # Find and remove the box
    original_count = len(data["boxes"])
    data["boxes"] = [
        box for box in data["boxes"] 
        if box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}") != model
    ]
    
    if len(data["boxes"]) == original_count:
        raise HTTPException(status_code=404, detail=f"Box with model {model} not found")
    
    # Save the updated YAML file
    save_store_yaml(store_id, data)
    
    return {"message": f"Box {model} deleted successfully"}


class CreateBoxRequest(BaseModel):
    """Request model for creating a new box"""
    model: str = Field(..., min_length=1, max_length=50, description="Box model identifier")
    dimensions: List[float] = Field(..., min_items=3, max_items=3, description="Box dimensions [L, W, H]")
    alternate_depths: Optional[List[float]] = Field(None, max_items=10, description="Alternate depths for prescoring")
    location: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    # Analytics tracking fields
    from_library: bool = Field(False, description="Whether box was imported from library")
    offered_names: Optional[List[str]] = Field(None, description="Names offered from library")
    
    @validator('dimensions', each_item=True)
    def validate_dimensions(cls, v):
        if not 0.1 <= v <= 1000:
            raise ValueError('Dimensions must be between 0.1 and 1000 inches')
        return v
    
    @validator('alternate_depths', each_item=True)
    def validate_alternate_depths(cls, v):
        if v is not None and not 0.1 <= v <= 1000:
            raise ValueError('Alternate depths must be between 0.1 and 1000 inches')
        return v
    
    @validator('model')
    def validate_model_no_special_chars(cls, v):
        # Basic sanitization - no SQL special characters
        if any(char in v for char in [';', '--', '/*', '*/', '\x00']):
            raise ValueError('Invalid characters in model')
        return v


@router.post("/boxes/batch", response_class=JSONResponse)
async def create_boxes_batch(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    boxes: List[CreateBoxRequest] = Body(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Add multiple boxes to the store inventory in one request"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    data = load_store_yaml(store_id)
    
    # Check for duplicate models
    existing_models = [box.get("model", "") for box in data["boxes"]]
    new_models = [box.model for box in boxes]
    duplicates = [model for model in new_models if model in existing_models]
    
    if duplicates:
        raise HTTPException(status_code=400, detail=f"Box models already exist: {', '.join(duplicates)}")
    
    # Track analytics
    analytics = BoxAnalytics()
    added_boxes = []
    
    # Add all boxes
    for box_data in boxes:
        # Determine box type based on source (library boxes are NormalBox, others are CustomBox)
        box_type = "NormalBox" if box_data.from_library else "CustomBox"
        
        new_box = {
            "type": box_type,
            "model": box_data.model,
            "dimensions": box_data.dimensions
        }
        
        # NO SUPPLIER FIELD EVER!
        
        # Add optional fields
        if box_data.alternate_depths:
            new_box["alternate_depths"] = box_data.alternate_depths
        
        if box_data.location:
            new_box["location"] = box_data.location
        
        if box_data.notes:
            new_box["notes"] = box_data.notes
        
        # Add default itemized pricing (zeros for now, admin can update later)
        new_box["itemized-prices"] = {
            "box-price": 0,
            "basic-materials": 0,
            "basic-services": 0,
            "standard-materials": 0,
            "standard-services": 0,
            "fragile-materials": 0,
            "fragile-services": 0,
            "custom-materials": 0,
            "custom-services": 0
        }
        
        # Add to store data
        data["boxes"].append(new_box)
        added_boxes.append(new_box)
        
        # Track analytics
        source = "library" if box_data.from_library else "custom"
        analytics.log_box_import(
            store_id=store_id,
            dimensions=box_data.dimensions,
            alternate_depths=box_data.alternate_depths,
            chosen_name=box_data.model,
            source=source
        )
        
        # If from library with offered names, track name selection
        if box_data.from_library and box_data.offered_names:
            analytics.log_name_selection(
                store_id=store_id,
                dimensions=box_data.dimensions,
                offered_names=box_data.offered_names,
                chosen_name=box_data.model
            )
    
    # Save the updated YAML file
    save_store_yaml(store_id, data)
    
    return {
        "message": f"Successfully added {len(added_boxes)} boxes",
        "boxes": added_boxes
    }

@router.post("/box", response_class=JSONResponse)
async def create_box(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    box_data: CreateBoxRequest = Body(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Add a new box to the store inventory"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    data = load_store_yaml(store_id)
    
    # Check if box model already exists
    existing_models = [box.get("model", "") for box in data["boxes"]]
    if box_data.model in existing_models:
        raise HTTPException(status_code=400, detail=f"Box model '{box_data.model}' already exists")
    
    # Build the new box dictionary
    # Determine box type based on source (library boxes are NormalBox, others are CustomBox)
    box_type = "NormalBox" if box_data.from_library else "CustomBox"
    
    new_box = {
        "type": box_type,
        "model": box_data.model,
        "dimensions": box_data.dimensions
    }
    
    # NO SUPPLIER FIELD EVER!
    
    
    # Add optional fields
    if box_data.alternate_depths:
        new_box["alternate_depths"] = box_data.alternate_depths
    
    if box_data.location:
        new_box["location"] = box_data.location
    
    if box_data.notes:
        new_box["notes"] = box_data.notes
    
    # Add default itemized pricing (zeros for now, admin can update later)
    new_box["itemized-prices"] = {
        "box-price": 0,
        "basic-materials": 0,
        "basic-services": 0,
        "standard-materials": 0,
        "standard-services": 0,
        "fragile-materials": 0,
        "fragile-services": 0,
        "custom-materials": 0,
        "custom-services": 0
    }
    
    # Validate the new box
    try:
        validate_box_data(new_box, store_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Add the new box
    data["boxes"].append(new_box)
    
    # Save the updated YAML file
    save_store_yaml(store_id, data)
    
    # Track analytics
    analytics = BoxAnalytics()
    source = "library" if box_data.from_library else "custom"
    analytics.log_box_import(
        store_id=store_id,
        dimensions=box_data.dimensions,
        alternate_depths=box_data.alternate_depths,
        chosen_name=box_data.model,
        source=source
    )
    
    # If from library with offered names, track name selection
    if box_data.from_library and box_data.offered_names:
        analytics.log_name_selection(
            store_id=store_id,
            dimensions=box_data.dimensions,
            offered_names=box_data.offered_names,
            chosen_name=box_data.model
        )
    
    return {"message": "Box added successfully", "box": new_box}


class BoxModificationRequest(BaseModel):
    """Request model for tracking box modifications"""
    original_dimensions: List[float]
    original_alternate_depths: Optional[List[float]] = None
    modified_dimensions: Optional[List[float]] = None
    modified_alternate_depths: Optional[List[float]] = None
    modification_type: str
    

@router.post("/stats/box-modification", response_class=JSONResponse)
async def track_box_modification(
    request: BoxModificationRequest = Body(...),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Track when users modify box specifications during import"""
    auth_store_id, auth_level = auth_info
    
    # Any authenticated user can track modifications
    if not auth_store_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Import BoxAnalytics
    from backend.lib.box_analytics import BoxAnalytics
    analytics = BoxAnalytics()
    
    # Determine modification type
    if request.modification_type == "pivot_from_library":
        mod_type = "both"  # Assume user will modify both dimensions and depths
    elif request.modified_dimensions and request.modified_alternate_depths:
        mod_type = "both"
    elif request.modified_dimensions:
        mod_type = "dimensions"
    elif request.modified_alternate_depths:
        mod_type = "depths"
    else:
        mod_type = "both"
    
    # Log the modification
    analytics.log_box_modification(
        store_id=auth_store_id,
        original_dimensions=request.original_dimensions,
        original_alternate_depths=request.original_alternate_depths,
        modified_dimensions=request.modified_dimensions or request.original_dimensions,
        modified_alternate_depths=request.modified_alternate_depths,
        modification_type=mod_type
    )
    
    return {"message": "Modification tracked successfully"}


@router.get("/stats", response_class=JSONResponse)
async def get_store_stats(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Get store setup statistics for the getting started page"""
    auth_store_id, auth_level = auth_info
    
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Load store data
    store_data = load_store_yaml(store_id)
    boxes = store_data.get("boxes", [])
    
    # Calculate statistics
    total_boxes = len(boxes)
    boxes_with_prices = 0
    
    for box in boxes:
        # Check if box has any price (itemized-prices required)
        if "itemized-prices" in box and box["itemized-prices"]:
            # Check if at least one price field is non-zero
            prices = box["itemized-prices"]
            if any(prices.get(field, 0) > 0 for field in ["box-price", "basic-materials", "basic-services",
                                                          "standard-materials", "standard-services",
                                                          "fragile-materials", "fragile-services",
                                                          "custom-materials", "custom-services"]):
                boxes_with_prices += 1
    
    # Check for floorplan
    floorplan_path = PathLib(f"floorplans/store{store_id}_floorplan.png")
    floorplan_path_jpg = PathLib(f"floorplans/store{store_id}_floorplan.jpg")
    has_floorplan = floorplan_path.exists() or floorplan_path_jpg.exists()
    
    # Count located boxes
    located_boxes = 0
    for box in boxes:
        if "location" in box and box["location"]:
            # Check if location has coords
            if isinstance(box["location"], dict) and "coords" in box["location"] and box["location"]["coords"]:
                located_boxes += 1
    
    return {
        "total_boxes": total_boxes,
        "boxes_with_prices": boxes_with_prices,
        "has_floorplan": has_floorplan,
        "located_boxes": located_boxes,
        "start_screen": store_data.get("start-screen", False)
    }


@router.post("/complete-setup", response_class=JSONResponse)
async def complete_setup(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = Depends(get_current_auth())
):
    """Mark the getting started setup as complete"""
    auth_store_id, auth_level = auth_info
    
    # Verify user has access to this store and is admin
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Load store data
    store_data = load_store_yaml(store_id)
    
    # Remove start-screen property
    if "start-screen" in store_data:
        del store_data["start-screen"]
    
    # Save back to YAML
    save_store_yaml(store_id, store_data)
    
    return {"message": "Setup completed successfully"}