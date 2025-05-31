import os
import re
import shutil
from datetime import datetime, timezone
from typing import Optional, Tuple

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.lib.auth_middleware import get_current_store, get_optional_auth, get_current_auth, get_optional_auth_with_demo
from backend.lib.auth_manager import (
    verify_pin, create_session, delete_session,
    hasAuth as store_has_auth, get_db, get_store_info,
    create_email_verification_code, verify_email_code,
    regenerate_pin
)
from backend.lib.email_service import send_login_code
from backend.lib.rate_limiter import limiter, check_email_rate_limit, check_rate_limit_with_dedup
from backend.models.auth import (
    LoginRequest, EmailCodeRequest, VerifyCodeRequest,
    TokenResponse, UpdateEmailRequest
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, login_request: LoginRequest):
    """Authenticate with store ID and PIN"""
    # Check rate limit with deduplication
    check_rate_limit_with_dedup(
        request, 
        "/api/auth/login", 
        login_request.store_id, 
        login_request.pin
    )
    
    # Always return the same error to prevent enumeration
    generic_error = HTTPException(status_code=401, detail="Invalid store ID or PIN")
    
    # Verify store exists
    yaml_file = f"stores/store{login_request.store_id}.yml"
    if not os.path.exists(yaml_file):
        raise generic_error
    
    # Check if store has auth configured
    if not store_has_auth(login_request.store_id):
        raise generic_error
    
    # Verify PIN
    if not verify_pin(login_request.store_id, login_request.pin):
        raise generic_error
    
    # Create session token
    token = create_session(login_request.store_id, auth_level="user")
    
    return TokenResponse(access_token=token)


@router.post("/send-code")
@limiter.limit("3/minute")
async def send_code(request: Request, code_request: EmailCodeRequest):
    """Send verification code to admin email"""
    # Check email rate limit per store
    check_email_rate_limit(code_request.store_id)
    
    # Always return success to prevent enumeration
    generic_response = {"message": "If the store ID and email are valid, a verification code has been sent"}
    
    # Verify store exists
    yaml_file = f"stores/store{code_request.store_id}.yml"
    if not os.path.exists(yaml_file):
        return generic_response
    
    # Check if store has auth configured
    if not store_has_auth(code_request.store_id):
        return generic_response
    
    try:
        # Create verification code
        code = create_email_verification_code(code_request.store_id, code_request.email)
        
        # Get store info for name
        store_info = get_store_info(code_request.store_id)
        store_name = f"Store {code_request.store_id}"
        
        # Send email
        send_login_code(code_request.email, code, store_name)
        
    except ValueError:
        # Invalid email for this store, but don't reveal this
        pass
    
    return generic_response


@router.post("/verify-code", response_model=TokenResponse)
@limiter.limit("10/minute")
async def verify_code(request: Request, verify_request: VerifyCodeRequest):
    """Verify email code and return admin token"""
    # Check rate limit with deduplication
    check_rate_limit_with_dedup(
        request,
        "/api/auth/verify-code",
        verify_request.store_id,
        verify_request.email,
        verify_request.code
    )
    
    # Verify code
    if not verify_email_code(verify_request.store_id, verify_request.email, verify_request.code):
        raise HTTPException(status_code=401, detail="Invalid or expired code")
    
    # Create admin session token
    token = create_session(verify_request.store_id, auth_level="admin")
    
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


# Store-specific auth endpoints
router_store = APIRouter(prefix="/api/store/{store_id}", tags=["store-auth"])


@router_store.get("/pin")
async def get_pin_info(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
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
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
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
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
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
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
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
async def check_has_auth(store_id: str = Path(..., regex=r"^\d{1,6}$")):
    """Check if store has authentication enabled"""
    # Since all stores now require auth, always return true
    # This prevents store enumeration via 404 errors
    return {"hasAuth": True}


# Demo mode models
class DemoLoginRequest(BaseModel):
    auth_level: str  # "user" or "admin"


# Demo mode endpoints
@router.post("/demo/login", response_model=TokenResponse)
async def demo_login(request: DemoLoginRequest):
    """Login to demo mode"""
    if request.auth_level not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid auth level")
    
    demo_store_path = "stores/store999999.yml"
    demo_template_path = "stores/demo_store.yml"
    needs_reset = False
    
    # Check if demo store needs reset
    if not os.path.exists(demo_store_path):
        # Case A: store999999.yml missing
        needs_reset = True
    else:
        # Read the YAML to check demo_last_reset
        try:
            with open(demo_store_path, 'r') as f:
                data = yaml.safe_load(f)
            
            if 'demo_last_reset' not in data:
                # Case B: demo_last_reset is unset
                needs_reset = True
            else:
                # Case C: Check if last reset was > 1 hour ago
                last_reset_str = data.get('demo_last_reset')
                try:
                    last_reset = datetime.fromisoformat(last_reset_str.replace('Z', '+00:00'))
                    time_since_reset = datetime.now(timezone.utc) - last_reset
                    if time_since_reset.total_seconds() > 3600:  # 1 hour in seconds
                        needs_reset = True
                except (ValueError, AttributeError):
                    # Invalid timestamp format, reset needed
                    needs_reset = True
        except Exception:
            # Error reading file, reset needed
            needs_reset = True
    
    # Perform reset if needed
    if needs_reset:
        # Call the reset logic inline to avoid circular dependency
        if not os.path.exists(demo_template_path):
            raise HTTPException(status_code=500, detail="Demo template not found")
        
        # Clear database customizations for demo store
        with get_db() as db:
            db.execute('DELETE FROM store_packing_rules WHERE store_id = ?', ("999999",))
            db.execute('DELETE FROM store_engine_config WHERE store_id = ?', ("999999",))
            db.commit()
        
        # Reset YAML by copying template
        shutil.copy2(demo_template_path, demo_store_path)
        
        # Add reset timestamp
        with open(demo_store_path, 'r') as f:
            data = yaml.safe_load(f)
        data['demo_last_reset'] = datetime.now(timezone.utc).isoformat()
        with open(demo_store_path, 'w') as f:
            yaml.dump(data, f, sort_keys=False)
    
    # Create demo session
    token = create_session("999999", auth_level=request.auth_level)
    
    return TokenResponse(access_token=token)


@router.post("/demo/reset")
async def demo_reset():
    """Reset demo environment"""
    demo_path = "stores/store999999.yml"
    demo_template_path = "stores/demo_store.yml"
    demo_store_id = "999999"
    
    if not os.path.exists(demo_template_path):
        raise HTTPException(status_code=500, detail="Demo template not found")
    
    # Clear database customizations for demo store
    with get_db() as db:
        # Clear custom packing rules
        db.execute('DELETE FROM store_packing_rules WHERE store_id = ?', (demo_store_id,))
        
        # Clear custom engine config
        db.execute('DELETE FROM store_engine_config WHERE store_id = ?', (demo_store_id,))
        
        db.commit()
    
    # Reset YAML by copying template
    shutil.copy2(demo_template_path, demo_path)
    
    # Add reset timestamp
    with open(demo_path, 'r') as f:
        data = yaml.safe_load(f)
    data['demo_last_reset'] = datetime.now(timezone.utc).isoformat()
    with open(demo_path, 'w') as f:
        yaml.dump(data, f, sort_keys=False)
    
    return {"message": "Demo environment reset successfully"}


