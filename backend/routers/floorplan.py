"""
Floorplan management endpoints.
Handles uploading floorplans and managing box locations on the floorplan.
"""

import os
from typing import Dict, Union, Any
from io import BytesIO

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, Body
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image

from backend.lib.auth_middleware import get_current_store
from backend.lib.yaml_helpers import load_store_yaml, save_store_yaml


router = APIRouter(prefix="/api/store/{store_id}", tags=["floorplan"])


@router.get("/floorplan", response_class=FileResponse)
async def get_floorplan(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Get the floorplan image for a store"""
    # Check for existing floorplan files in expected formats
    floorplan_dir = "floorplans"
    extensions = ['.png', '.jpg', '.jpeg']
    
    
    for ext in extensions:
        # Check for simplified naming convention
        patterns = [
            f"store{store_id}_floor{ext}",
            f"store{store_id}_floor1{ext}",  # Legacy support
            f"store{store_id}{ext}"          # Legacy support
        ]
        
        for pattern in patterns:
            file_path = os.path.join(floorplan_dir, pattern)
            if os.path.exists(file_path):
                return FileResponse(
                    file_path,
                    media_type=f"image/{ext[1:]}",
                    headers={"Cache-Control": "max-age=3600"}
                )
    
    # No floorplan found
    raise HTTPException(status_code=404, detail=f"No floorplan found for store {store_id}")


@router.post("/floorplan")
async def upload_floorplan(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    file: UploadFile = File(...),
    auth_store_id: str = Depends(get_current_store)
):
    """Upload a new floorplan for a store - converts all bitmap formats to PNG"""
    # Validate file type - accept common image formats
    allowed_types = [
        "image/png", "image/jpeg", "image/jpg", "image/gif", 
        "image/bmp", "image/tiff", "image/webp"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: PNG, JPEG, GIF, BMP, TIFF, WebP"
        )
    
    # Check file size (5MB limit)
    MAX_SIZE = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: 5MB, uploaded: {len(contents) / 1024 / 1024:.2f}MB"
        )
    
    # Remove any existing floorplans for this store
    floorplan_dir = "floorplans"
    existing_files = os.listdir(floorplan_dir)
    for existing_file in existing_files:
        if existing_file.startswith(f"store{store_id}"):
            os.remove(os.path.join(floorplan_dir, existing_file))
    
    # Convert all formats to PNG
    try:
        # Open image with Pillow
        image = Image.open(BytesIO(contents))
        
        # Always convert to RGB (no transparency needed)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Save as PNG
        filename = f"store{store_id}_floor.png"
        file_path = os.path.join(floorplan_dir, filename)
        
        # Save with reasonable compression
        output = BytesIO()
        image.save(output, format='PNG', optimize=True)
        png_contents = output.getvalue()
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(png_contents)
            
        final_size = len(png_contents)
        final_type = "image/png"
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to process image: {str(e)}"
        )
    
    # Clear all location coordinates for this store
    data = load_store_yaml(store_id)
    locations_cleared = 0
    
    for box in data["boxes"]:
        if "location" in box:
            # Remove location completely instead of setting to empty dict
            del box["location"]
            locations_cleared += 1
    
    # Save the updated YAML if any locations were cleared
    if locations_cleared > 0:
        save_store_yaml(store_id, data)
    
    return {
        "message": f"Floorplan uploaded successfully for store {store_id}",
        "filename": filename,
        "size": final_size,
        "original_type": file.content_type,
        "saved_type": final_type,
        "locations_cleared": locations_cleared
    }


@router.get("/box-locations", response_class=JSONResponse)
async def get_box_locations(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Get all box locations for mapping"""
    data = load_store_yaml(store_id)
    
    locations = []
    for box in data["boxes"]:
        model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")
        
        location_data = {
            "model": model,
            "dimensions": box["dimensions"],
            "type": box.get("type", "NormalBox")
        }
        
        # Get location data
        if "location" in box and isinstance(box["location"], dict) and "coords" in box["location"] and box["location"]["coords"]:
            # Standard dictionary format with valid coords
            location_data["coords"] = box["location"]["coords"]
            # We're not using labels anymore, but maintain API compatibility with empty string
            location_data["label"] = ""
        elif "location" in box and isinstance(box["location"], str) and box["location"].strip():
            # For backwards compatibility, but we'll return empty label
            location_data["label"] = ""
            location_data["coords"] = None
        else:
            # No location, empty location or invalid location
            location_data["label"] = ""
            location_data["coords"] = None
            
        locations.append(location_data)
    
    return locations


class LocationUpdateRequest(BaseModel):
    """Request model for updating box locations"""
    changes: Dict[str, Union[Dict[str, Any], None]]
    csrf_token: str


@router.post("/update-locations", response_class=JSONResponse)
async def update_locations(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    update_data: LocationUpdateRequest = Body(...),
    auth_store_id: str = Depends(get_current_store)
):
    """Update box locations in bulk - clears all boxes at updated coordinates first"""
    # Validate CSRF token
    if not update_data.csrf_token or len(update_data.csrf_token) < 10:
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    
    data = load_store_yaml(store_id)
    
    # Authentication check is handled by the auth_store_id dependency
    
    # First pass: collect all coordinates being updated
    coords_being_updated = set()
    for box_model, location_change in update_data.changes.items():
        if location_change and isinstance(location_change, dict) and "coords" in location_change and location_change["coords"]:
            coords_being_updated.add(tuple(location_change["coords"]))
    
    # Second pass: clear any boxes currently at these coordinates
    cleared_count = 0
    for box in data["boxes"]:
        if "location" in box and isinstance(box["location"], dict) and "coords" in box["location"]:
            if tuple(box["location"]["coords"]) in coords_being_updated:
                del box["location"]
                cleared_count += 1
    
    # Third pass: set the new locations from the changes dict
    updated_count = 0
    for box in data["boxes"]:
        box_model = box.get("model", f"Unknown-{len(box['dimensions'])}-{box['dimensions'][0]}-{box['dimensions'][1]}-{box['dimensions'][2]}")
        
        if box_model in update_data.changes:
            location_change = update_data.changes[box_model]
            
            if location_change is None:
                # Clear location by removing it completely (if not already cleared)
                if "location" in box:
                    del box["location"]
            else:
                # Make sure changes are in dictionary format
                if isinstance(location_change, dict):
                    # Standard dictionary format
                    if "coords" not in location_change or not location_change["coords"]:
                        # No coordinates case - remove location (if not already cleared)
                        if "location" in box:
                            del box["location"]
                    else:
                        # Full location with coordinates
                        box["location"] = {
                            "coords": location_change["coords"]
                        }
                        updated_count += 1
                else:
                    # If non-dictionary was sent (shouldn't happen), remove location
                    if "location" in box:
                        del box["location"]
    
    # Save the updated YAML file
    save_store_yaml(store_id, data)
    
    return {"message": f"Cleared {cleared_count} boxes, assigned {updated_count} boxes successfully"}