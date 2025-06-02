"""
Box management endpoints.
Handles CRUD operations for boxes, pricing updates, and box sections.

Authentication: All endpoints follow the standard pattern defined in
docs/authentication-api-patterns.md - using dependency injection with
get_current_auth() for consistent authentication and authorization.
"""

import json
import os
from typing import Dict, Any, Optional, List

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

from backend.lib.auth_middleware import get_current_auth
from typing import Tuple
from backend.lib.yaml_helpers import load_store_yaml, save_store_yaml, get_box_section, validate_box_data


router = APIRouter(prefix="/api/store/{store_id}", tags=["boxes"])


@router.get("/pricing_mode", response_class=JSONResponse)
async def get_pricing_mode(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Get the pricing mode for a store"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = load_store_yaml(store_id)
    pricing_mode = data.get("pricing-mode", "standard")
    return {"mode": pricing_mode}


@router.get("/boxes", response_class=JSONResponse)
async def get_boxes(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Get all boxes for a store with validation"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
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

    # Determine pricing mode
    pricing_mode = boxes_data.get("pricing-mode", "standard")

    # Validate each box entry
    for i, box in enumerate(boxes_data["boxes"]):
        try:
            validate_box_data(box, store_id, pricing_mode)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=f"Box at index {i}: {str(e)}")

    return boxes_data


@router.get("/boxes_with_sections", response_class=JSONResponse)
async def get_boxes_with_sections(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Get boxes formatted for the editor with sections"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    data = load_store_yaml(store_id)
    result = []
    
    # Determine pricing mode
    pricing_mode = data.get("pricing-mode", "standard")

    for box in data["boxes"]:
        # Handle legacy format (missing model and location)
        model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")

        # Get section based on model or box type
        box_type = box.get("type")
        section = get_box_section(model, box_type)
        
        # Only print debug info for store1
        if store_id == "1":
            print(f"Store1 - Model: {model}, Type: {box_type}, Section: {section}")

        dimensions_str = "x".join(str(d) for d in box["dimensions"])
        
        # Process based on pricing mode
        if pricing_mode == "standard":
            prices = box.get("prices", [0, 0, 0, 0])
            box_data = {
                "section": section,
                "model": model,
                "dimensions": dimensions_str,
                "box_price": prices[0],
                "standard": prices[1],
                "fragile": prices[2],
                "custom": prices[3],
                "location": box.get("location", "???"),
                "pricing_mode": "standard"
            }
        else:  # itemized pricing mode
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
    auth_info: Tuple[str, str] = get_current_auth()
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
    
    return {"pricing_mode": data.get("pricing-mode", "standard"), "boxes": data["boxes"]}


@router.get("/box/{model}", response_class=JSONResponse)
async def get_box_by_model(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    model: str = Path(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Get a single box by model"""
    auth_store_id, auth_level = auth_info
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = load_store_yaml(store_id)
    pricing_mode = data.get("pricing-mode", "standard")

    for box in data["boxes"]:
        # Handle legacy format and compare with the provided model
        box_model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")

        if box_model == model:
            # For legacy boxes, ensure all fields exist
            if "model" not in box:
                box["model"] = box_model
            if "supplier" not in box:
                box["supplier"] = "Unknown"
            if "location" not in box:
                box["location"] = "???"
                
            # Add pricing mode to the response
            box["pricing_mode"] = pricing_mode
            
            return box

    raise HTTPException(status_code=404, detail=f"Box with model {model} not found")


class PriceUpdateRequest(BaseModel):
    """Request model for standard price updates"""
    changes: Dict[str, Dict[str, float]]
    csrf_token: str


class ItemizedPriceUpdateRequest(BaseModel):
    """Request model for itemized price updates"""
    changes: Dict[str, Dict[str, float]]
    csrf_token: str


@router.post("/update_prices", response_class=JSONResponse)
async def update_prices(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    update_data: PriceUpdateRequest = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Update prices for multiple boxes (standard pricing mode)"""
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
    
    # Check pricing mode
    pricing_mode = data.get("pricing-mode", "standard")
    if pricing_mode != "standard":
        raise HTTPException(status_code=400, detail="This endpoint is for standard pricing mode only. Use /update_itemized_prices for itemized pricing.")

    # Authentication has been verified above

    updated_count = 0

    # Update prices for each box in the changes dict
    for box in data["boxes"]:
        # Get the actual model or generate a default one for legacy boxes
        box_model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")

        if box_model in changes:
            price_changes = changes[box_model]

            for index, new_price in price_changes.items():
                idx = int(index)
                # Validate price - must be a positive number within a reasonable range
                if 0 <= idx < 4 and isinstance(new_price, (int, float)) and 0 <= new_price <= 10000:
                    box["prices"][idx] = new_price
                    updated_count += 1
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid price value: {new_price}. Prices must be between 0 and 10000.")

            # If this is a legacy box and we're updating it, add the model field
            # so we can reference it again in the future
            if "model" not in box:
                box["model"] = box_model

    # Save the updated YAML file
    save_store_yaml(store_id, data)

    return {"message": f"Updated {updated_count} prices successfully"}


@router.post("/update_itemized_prices", response_class=JSONResponse)
async def update_itemized_prices(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    update_data: ItemizedPriceUpdateRequest = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Update itemized prices for multiple boxes (itemized pricing mode)"""
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
    
    # Check pricing mode
    pricing_mode = data.get("pricing-mode", "standard")
    if pricing_mode != "itemized":
        raise HTTPException(status_code=400, detail="This endpoint is for itemized pricing mode only. Use /update_prices for standard pricing.")

    # Authentication has been verified above

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
    auth_info: Tuple[str, str] = get_current_auth()
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
    auth_info: Tuple[str, str] = get_current_auth()
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
    supplier: str = Field(..., min_length=1, max_length=50, description="Supplier name or ID")
    dimensions: List[float] = Field(..., min_items=3, max_items=3, description="Box dimensions [L, W, H]")
    alternate_depths: Optional[List[float]] = Field(None, max_items=10, description="Alternate depths for prescoring")
    location: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    
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
    
    @validator('model', 'supplier')
    def validate_no_special_chars(cls, v):
        # Basic sanitization - no SQL special characters
        if any(char in v for char in [';', '--', '/*', '*/', '\x00']):
            raise ValueError('Invalid characters in field')
        return v


@router.post("/box", response_class=JSONResponse)
async def create_box(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    box_data: CreateBoxRequest = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
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
    pricing_mode = data.get("pricing-mode", "standard")
    
    # Check if box model already exists
    existing_models = [box.get("model", "") for box in data["boxes"]]
    if box_data.model in existing_models:
        raise HTTPException(status_code=400, detail=f"Box model '{box_data.model}' already exists")
    
    # Build the new box dictionary
    new_box = {
        "type": "NormalBox",
        "supplier": box_data.supplier,
        "model": box_data.model,
        "dimensions": box_data.dimensions
    }
    
    # If this is a vendor box, get the vendor version
    if box_data.supplier and box_data.supplier != "Custom":
        from backend.lib.vendor_catalog import VendorCatalog
        catalog = VendorCatalog()
        
        # Look up vendor by ID
        vendor_data = catalog.vendors.get(box_data.supplier)
        
        if vendor_data:
            new_box["supplier_version"] = vendor_data['vendor']['version']
    
    # Add optional fields
    if box_data.alternate_depths:
        new_box["prescored_heights"] = box_data.alternate_depths
    
    if box_data.location:
        new_box["location"] = box_data.location
    
    if box_data.notes:
        new_box["notes"] = box_data.notes
    
    # Add default pricing based on mode (zeros for now, admin can update later)
    if pricing_mode == "standard":
        new_box["prices"] = [0, 0, 0, 0]  # Basic, Standard, Fragile, Custom
    else:  # itemized
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
        validate_box_data(new_box, store_id, pricing_mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Add the new box
    data["boxes"].append(new_box)
    
    # Save the updated YAML file
    save_store_yaml(store_id, data)
    
    return {"message": "Box added successfully", "box": new_box}