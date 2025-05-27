import os
import re
from typing import Optional, Tuple

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.lib.auth_middleware import get_current_store, get_optional_auth, get_current_auth
from backend.lib.auth_manager import (
    verify_pin, create_session, delete_session,
    hasAuth as store_has_auth, get_db, get_store_info,
    create_email_verification_code, verify_email_code,
    regenerate_pin
)
from backend.lib.email_service import send_login_code
from backend.models.auth import (
    LoginRequest, EmailCodeRequest, VerifyCodeRequest,
    TokenResponse, UpdateEmailRequest
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate with store ID and PIN"""
    # Verify store exists
    yaml_file = f"stores/store{request.store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Check if store has auth configured
    if not store_has_auth(request.store_id):
        raise HTTPException(status_code=403, detail="Authentication not configured for this store")
    
    # Verify PIN
    if not verify_pin(request.store_id, request.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
    # Create session token
    token = create_session(request.store_id, auth_level="user")
    
    return TokenResponse(access_token=token)


@router.post("/send-code")
async def send_code(request: EmailCodeRequest):
    """Send verification code to admin email"""
    # Verify store exists
    yaml_file = f"stores/store{request.store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Check if store has auth configured
    if not store_has_auth(request.store_id):
        raise HTTPException(status_code=403, detail="Authentication not configured for this store")
    
    try:
        # Create verification code
        code = create_email_verification_code(request.store_id, request.email)
        
        # Get store info for name
        store_info = get_store_info(request.store_id)
        store_name = f"Store {request.store_id}"
        
        # Send email
        if send_login_code(request.email, code, store_name):
            return {"message": "Verification code sent"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-code", response_model=TokenResponse)
async def verify_code(request: VerifyCodeRequest):
    """Verify email code and return admin token"""
    # Verify code
    if not verify_email_code(request.store_id, request.email, request.code):
        raise HTTPException(status_code=401, detail="Invalid or expired code")
    
    # Create admin session token
    token = create_session(request.store_id, auth_level="admin")
    
    return TokenResponse(access_token=token)


@router.post("/logout")
async def logout(
    auth_header: str = Header(None, alias="Authorization"),
    token: str = Depends(get_current_store)
):
    """Logout and invalidate token"""
    # Token is extracted by get_current_store, but we need the raw token
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        delete_session(token)
    
    return {"message": "Logged out successfully"}


@router.get("/status")
async def auth_status(
    store_id: str = Query(...),
    auth_info: Optional[Tuple[str, str]] = get_optional_auth()
):
    """Check authentication status for a store"""
    # Check if store has auth configured
    has_auth = store_has_auth(store_id)
    
    # Check if authenticated
    is_authenticated = False
    auth_level = None
    
    if auth_info:
        auth_store_id, auth_level = auth_info
        is_authenticated = (auth_store_id == store_id)
    
    # FIXME: TEMPORARY HACK - Remove this auto-login behavior ASAP!
    # CODE SMELL: This is a security vulnerability for migration purposes only
    # If not authenticated, no auth in DB, but YAML exists - fake authentication
    if not is_authenticated and not has_auth:
        yaml_file = f"stores/store{store_id}.yml"
        if os.path.exists(yaml_file):
            # WARNING: This bypasses all security! Remove once all stores have proper auth
            # We can't create a real session without DB records, so we fake being authenticated
            # The client will think they're logged in but have no real token
            print(f"HACK: Auto-login activated for store {store_id} - YAML exists, no auth")
            return {
                "hasAuth": True,          # HACK: Lie about having auth configured
                "isAuthenticated": True,  # HACK: Lie about being authenticated
                "authLevel": "user",      # HACK: Fake user-level access
                "_warning": "AUTO-LOGIN HACK ACTIVE - SECURITY BYPASSED FOR YAML-ONLY STORES"
            }
    
    return {
        "hasAuth": has_auth,
        "isAuthenticated": is_authenticated,
        "authLevel": auth_level if is_authenticated else None
    }


# Store-specific auth endpoints
router_store = APIRouter(prefix="/api/store/{store_id}", tags=["store-auth"])


@router_store.get("/pin")
async def get_pin_info(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Get PIN info (admin only)"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    # PIN is not returned for security - only confirm it exists
    store_info = get_store_info(store_id)
    if not store_info:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return {
        "has_pin": True,
        "updated_at": store_info.get("updated_at")
    }


@router_store.post("/regenerate-pin")
async def regenerate_pin_endpoint(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Regenerate PIN for a store (admin only)"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    if not store_has_auth(store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    
    new_pin = regenerate_pin(store_id)
    
    return {
        "pin": new_pin,
        "message": "PIN regenerated successfully"
    }


@router_store.get("/info")
async def get_store_info_endpoint(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Get store info including admin email (admin only)"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    store_info = get_store_info(store_id)
    if not store_info:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return {
        "store_id": store_id,
        "admin_email": store_info.get("admin_email"),
        "created_at": store_info.get("created_at"),
        "updated_at": store_info.get("updated_at")
    }


@router_store.put("/admin-email")
async def update_admin_email(
    store_id: str = Path(..., regex=r"^\d{1,4}$"),
    request: UpdateEmailRequest = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Update admin email for a store (admin only)"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    if not store_has_auth(store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, request.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Update the email in the database
    with get_db() as db:
        db.execute(
            "UPDATE store_auth SET admin_email = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?",
            (request.email, store_id)
        )
        db.commit()
    
    return {
        "message": "Admin email updated successfully",
        "email": request.email
    }


@router_store.get("/has-auth")
async def check_has_auth(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    """Check if store has authentication enabled"""
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store not found: {store_id}")
    
    # Check if auth is enabled
    has_auth = store_has_auth(store_id)
    
    return {"hasAuth": has_auth}