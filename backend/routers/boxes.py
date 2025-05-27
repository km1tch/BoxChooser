"""
Box management endpoints.
Handles CRUD operations for boxes, pricing updates, and box sections.
"""

import json
import os
from typing import Dict, Any, Optional

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.lib.auth_middleware import get_current_store, require_auth
from backend.lib.yaml_helpers import load_store_yaml, save_store_yaml, get_box_section, validate_box_data


router = APIRouter(prefix="/api/store/{store_id}", tags=["boxes"])


@router.get("/pricing_mode", response_class=JSONResponse)
async def get_pricing_mode(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Get the pricing mode for a store"""
    data = load_store_yaml(store_id)
    pricing_mode = data.get("pricing-mode", "standard")
    return {"mode": pricing_mode}


@router.get("/boxes", response_class=JSONResponse)
async def get_boxes(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Get all boxes for a store with validation"""
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
async def get_boxes_with_sections(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Get boxes formatted for the editor with sections"""
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
async def get_all_boxes(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Get all boxes at once (bulk endpoint)"""
    data = load_store_yaml(store_id)
    
    # Add model field to all boxes that don't have it
    for box in data["boxes"]:
        if "model" not in box:
            box["model"] = f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}"
    
    return {"pricing_mode": data.get("pricing-mode", "standard"), "boxes": data["boxes"]}


@router.get("/box/{model}", response_class=JSONResponse)
async def get_box_by_model(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    model: str = Path(...)):
    """Get a single box by model"""
    
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
@require_auth(admin=True)
async def update_prices(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    update_data: PriceUpdateRequest = Body(...),
    current_store_id: str = None,
    auth_level: str = None):
    """Update prices for multiple boxes (standard pricing mode)"""
    
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

    # Authentication check is handled by the @require_auth decorator

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
@require_auth(admin=True)
async def update_itemized_prices(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    update_data: ItemizedPriceUpdateRequest = Body(...),
    current_store_id: str = None,
    auth_level: str = None):
    """Update itemized prices for multiple boxes (itemized pricing mode)"""
    
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

    # Authentication check is handled by the @require_auth decorator

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
                # Validate price - must be a positive number within a reasonable range
                if isinstance(new_price, (int, float)) and 0 <= new_price <= 10000:
                    box["itemized-prices"][field] = new_price
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