"""
Superadmin routes for managing stores and system-wide operations
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import List, Optional
import bcrypt
import json
import os
from pathlib import Path
import shutil
import pyotp
import qrcode
import io
import base64

from backend.lib.auth_manager import get_db, create_session, get_session_info
from backend.lib.auth_middleware import bearer_scheme
from backend.lib.yaml_helpers import load_store_yaml, save_store_yaml
from backend.lib.rate_limiter import limiter, check_rate_limit_with_dedup
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter(prefix="/api/admin", tags=["superadmin"])


class SuperadminLogin(BaseModel):
    username: str
    password: str


class TOTPVerifyRequest(BaseModel):
    username: str
    totp_token: str


class StoreInfo(BaseModel):
    store_id: str
    admin_email: str
    status: str
    created_at: str
    disabled_reason: Optional[str] = None
    disabled_at: Optional[str] = None
    name: Optional[str] = None


class CreateStoreRequest(BaseModel):
    store_id: str
    admin_email: str
    store_name: Optional[str] = None
    copy_from_store: Optional[str] = None


class UpdateStoreMetadataRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TOTPSetupRequest(BaseModel):
    totp_token: str


def require_superadmin(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """Verify the request is from a superadmin"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token = credentials.credentials
    session_info = get_session_info(token)
    
    if not session_info or session_info.get('auth_level') != 'superadmin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    
    return session_info


def audit_superadmin_action(username: str, action: str, target_store_id: str = None, 
                          details: dict = None, success: bool = True):
    """Log superadmin actions for audit trail"""
    with get_db() as db:
        db.execute("""
            INSERT INTO superadmin_audit (superadmin_username, action, target_store_id, details, success)
            VALUES (?, ?, ?, ?, ?)
        """, (username, action, target_store_id, json.dumps(details) if details else None, success))
        db.commit()


@router.post("/login")
@limiter.limit("5/minute")
async def superadmin_login(request: Request, login: SuperadminLogin):
    """Superadmin login endpoint"""
    # Check rate limit with deduplication
    check_rate_limit_with_dedup(
        request,
        "/api/admin/login",
        login.username,
        login.password
    )
    
    with get_db() as db:
        # Get superadmin from database
        result = db.execute(
            "SELECT * FROM superadmins WHERE username = ?",
            (login.username,)
        ).fetchone()
        
        if not result:
            # Log failed attempt
            audit_superadmin_action(login.username, "login", details={"ip": request.client.host}, success=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password
        if not bcrypt.checkpw(login.password.encode('utf-8'), result['password_hash']):
            # Log failed attempt
            audit_superadmin_action(login.username, "login", details={"ip": request.client.host}, success=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if TOTP is enabled
        if result['totp_enabled']:
            # For now, return that TOTP is required
            # In a full implementation, you'd have a separate endpoint for TOTP verification
            return {
                "requires_totp": True,
                "username": login.username,
                "message": "TOTP verification required"
            }
        
        # Update last login
        db.execute(
            "UPDATE superadmins SET last_login = ? WHERE username = ?",
            (datetime.utcnow(), login.username)
        )
        db.commit()
        
        # Create session with superadmin auth level
        # We'll store username in store_id field and mark auth_level as superadmin
        token = create_session(store_id=login.username, auth_level='superadmin')
        
        # Log successful login
        audit_superadmin_action(login.username, "login", details={"ip": request.client.host}, success=True)
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": login.username
        }


@router.post("/login/totp")
@limiter.limit("10/minute")
async def superadmin_totp_verify(request: Request, totp_request: TOTPVerifyRequest):
    """Verify TOTP token for superadmin login"""
    # Check rate limit with deduplication
    check_rate_limit_with_dedup(
        request,
        "/api/admin/login/totp",
        totp_request.username,
        totp_request.totp_token
    )
    
    with get_db() as db:
        # Get superadmin from database
        result = db.execute(
            "SELECT * FROM superadmins WHERE username = ?",
            (totp_request.username,)
        ).fetchone()
        
        if not result:
            # Log failed attempt
            audit_superadmin_action(totp_request.username, "totp_verify", 
                                  details={"ip": request.client.host}, success=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP token"
            )
        
        # Check if TOTP is enabled
        if not result['totp_enabled'] or not result['totp_secret']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="TOTP not enabled for this account"
            )
        
        # Verify TOTP token
        totp = pyotp.TOTP(result['totp_secret'])
        if not totp.verify(totp_request.totp_token, valid_window=1):
            # Log failed attempt
            audit_superadmin_action(totp_request.username, "totp_verify", 
                                  details={"ip": request.client.host}, success=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP token"
            )
        
        # Update last login
        db.execute(
            "UPDATE superadmins SET last_login = ? WHERE username = ?",
            (datetime.utcnow(), totp_request.username)
        )
        db.commit()
        
        # Create session with superadmin auth level
        token = create_session(store_id=totp_request.username, auth_level='superadmin')
        
        # Log successful login
        audit_superadmin_action(totp_request.username, "totp_login", 
                              details={"ip": request.client.host}, success=True)
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": totp_request.username
        }


@router.get("/stores", response_model=List[StoreInfo])
async def list_stores(current_admin: dict = Depends(require_superadmin)):
    """List all stores with their status"""
    with get_db() as db:
        stores = db.execute("""
            SELECT store_id, admin_email, status, created_at, 
                   disabled_reason, disabled_at
            FROM store_auth
            ORDER BY CAST(store_id AS INTEGER)
        """).fetchall()
        
        store_list = []
        for store in stores:
            # Try to get name from YAML
            store_name = None
            try:
                yaml_data = load_store_yaml(store['store_id'])
                store_name = yaml_data.get('name')
            except:
                pass
            
            store_list.append(
                StoreInfo(
                    store_id=store['store_id'],
                    admin_email=store['admin_email'],
                    status=store['status'] or 'active',
                    created_at=store['created_at'],
                    disabled_reason=store['disabled_reason'],
                    disabled_at=store['disabled_at'],
                    name=store_name
                )
            )
        
        return store_list


@router.get("/")
async def admin_dashboard(current_admin: dict = Depends(require_superadmin)):
    """Simple hello world endpoint for testing"""
    return {
        "message": "Hello Superadmin!",
        "username": current_admin['store_id'],  # Username stored in store_id for superadmins
        "auth_level": current_admin['auth_level']
    }


@router.post("/stores/{store_id}/disable")
async def disable_store(store_id: str, reason: str = "", current_admin: dict = Depends(require_superadmin)):
    """Disable a store"""
    with get_db() as db:
        # Check if store exists
        store = db.execute("SELECT * FROM store_auth WHERE store_id = ?", (store_id,)).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Update store status
        db.execute("""
            UPDATE store_auth 
            SET status = 'disabled', 
                disabled_reason = ?, 
                disabled_at = CURRENT_TIMESTAMP,
                disabled_by = ?
            WHERE store_id = ?
        """, (reason, current_admin['store_id'], store_id))
        db.commit()
        
        # Audit log
        audit_superadmin_action(
            current_admin['store_id'], 
            "disable_store", 
            store_id, 
            {"reason": reason}
        )
        
        return {"status": "success", "message": f"Store {store_id} disabled"}


@router.post("/stores/{store_id}/enable")
async def enable_store(store_id: str, current_admin: dict = Depends(require_superadmin)):
    """Enable a store"""
    with get_db() as db:
        # Check if store exists
        store = db.execute("SELECT * FROM store_auth WHERE store_id = ?", (store_id,)).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Update store status
        db.execute("""
            UPDATE store_auth 
            SET status = 'active', 
                disabled_reason = NULL, 
                disabled_at = NULL,
                disabled_by = NULL
            WHERE store_id = ?
        """, (store_id,))
        db.commit()
        
        # Audit log
        audit_superadmin_action(
            current_admin['store_id'], 
            "enable_store", 
            store_id
        )
        
        return {"status": "success", "message": f"Store {store_id} enabled"}


@router.post("/stores/{store_id}/sudo")
async def create_sudo_token(store_id: str, current_admin: dict = Depends(require_superadmin)):
    """Create a sudo session for a store"""
    with get_db() as db:
        # Check if store exists and is active
        store = db.execute("SELECT * FROM store_auth WHERE store_id = ?", (store_id,)).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        if store['status'] != 'active':
            raise HTTPException(status_code=400, detail="Cannot sudo into disabled store")
        
        # Create admin session for the store
        token = create_session(store_id, auth_level='admin', hours=1)  # 1 hour sudo sessions
        
        # Update session to mark it as sudo
        db.execute("""
            UPDATE sessions 
            SET sudo_stores = json_array(?)
            WHERE token = ?
        """, (store_id, token))
        db.commit()
        
        # Audit log
        audit_superadmin_action(
            current_admin['store_id'], 
            "sudo_store", 
            store_id,
            {"session_token": token[:8] + "..."}  # Log partial token for security
        )
        
        return {
            "token": token,
            "store_id": store_id,
            "expires_in": 3600  # 1 hour
        }


@router.put("/stores/{store_id}/metadata")
async def update_store_metadata(
    store_id: str, 
    request: UpdateStoreMetadataRequest,
    current_admin: dict = Depends(require_superadmin)
):
    """Update store metadata (name/description) in YAML file"""
    with get_db() as db:
        # Check if store exists
        store = db.execute("SELECT * FROM store_auth WHERE store_id = ?", (store_id,)).fetchone()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
    
    try:
        # Load current YAML data
        yaml_data = load_store_yaml(store_id)
        
        # Update metadata fields
        if request.name is not None:
            yaml_data["name"] = request.name
        if request.description is not None:
            yaml_data["description"] = request.description
        
        # Save back to YAML
        save_store_yaml(store_id, yaml_data)
        
        # Audit log
        audit_superadmin_action(
            current_admin['store_id'],
            "update_store_metadata",
            store_id,
            {
                "name": request.name,
                "description": request.description
            }
        )
        
        return {
            "status": "success",
            "message": f"Store {store_id} metadata updated",
            "name": yaml_data.get("name"),
            "description": yaml_data.get("description")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {str(e)}")


@router.get("/stores/{store_id}")
async def get_store_details(store_id: str, current_admin: dict = Depends(require_superadmin)):
    """Get detailed information about a store"""
    with get_db() as db:
        # Get store info
        store = db.execute("""
            SELECT s.*, 
                   COUNT(DISTINCT ses.token) as active_sessions,
                   COUNT(DISTINCT al.id) as total_logins
            FROM store_auth s
            LEFT JOIN sessions ses ON s.store_id = ses.store_id 
                AND ses.expires_at > CURRENT_TIMESTAMP
            LEFT JOIN audit_log al ON s.store_id = al.store_id 
                AND al.action IN ('pin_login_success', 'email_login_success')
            WHERE s.store_id = ?
            GROUP BY s.store_id
        """, (store_id,)).fetchone()
        
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Get recent activity from both regular audit_log and superadmin actions
        recent_activity = db.execute("""
            SELECT timestamp, action, details, 'store' as source
            FROM audit_log
            WHERE store_id = ?
            
            UNION ALL
            
            SELECT timestamp, action, 
                   json_object('by', superadmin_username, 'details', details) as details,
                   'superadmin' as source
            FROM superadmin_audit
            WHERE target_store_id = ?
            
            ORDER BY timestamp DESC
            LIMIT 20
        """, (store_id, store_id)).fetchall()
        
        # Try to load store metadata from YAML
        store_metadata = {}
        try:
            yaml_data = load_store_yaml(store_id)
            store_metadata = {
                "name": yaml_data.get("name"),
                "description": yaml_data.get("description")
            }
        except:
            # If YAML doesn't exist or can't be loaded, that's OK
            pass
        
        return {
            "store_id": store['store_id'],
            "admin_email": store['admin_email'],
            "status": store['status'] or 'active',
            "created_at": store['created_at'],
            "updated_at": store['updated_at'],
            "disabled_reason": store['disabled_reason'],
            "disabled_at": store['disabled_at'],
            "disabled_by": store['disabled_by'],
            "active_sessions": store['active_sessions'],
            "name": store_metadata.get("name"),
            "description": store_metadata.get("description"),
            "total_logins": store['total_logins'],
            "recent_activity": [
                {
                    "timestamp": act['timestamp'],
                    "action": act['action'],
                    "details": act['details'],
                    "source": act['source']
                } for act in recent_activity
            ]
        }


@router.get("/audit")
async def get_audit_log(
    current_admin: dict = Depends(require_superadmin),
    limit: int = 50,
    superadmin: Optional[str] = None,
    store_id: Optional[str] = None
):
    """Get superadmin audit log"""
    with get_db() as db:
        query = "SELECT * FROM superadmin_audit WHERE 1=1"
        params = []
        
        if superadmin:
            query += " AND superadmin_username = ?"
            params.append(superadmin)
        
        if store_id:
            query += " AND target_store_id = ?"
            params.append(store_id)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        logs = db.execute(query, params).fetchall()
        
        return [
            {
                "id": log['id'],
                "timestamp": log['timestamp'],
                "superadmin": log['superadmin_username'],
                "action": log['action'],
                "store_id": log['target_store_id'],
                "details": json.loads(log['details']) if log['details'] else None,
                "success": log['success']
            } for log in logs
        ]


@router.post("/stores")
async def create_store(request: CreateStoreRequest, current_admin: dict = Depends(require_superadmin)):
    """Create a new store"""
    from backend.lib.auth_manager import create_store_auth, generate_pin
    
    # Validate store ID
    if not request.store_id.isdigit() or len(request.store_id) > 6:
        raise HTTPException(status_code=400, detail="Store ID must be numeric and up to 6 digits")
    
    # Check if store already exists
    yaml_path = Path(f"stores/store{request.store_id}.yml")
    if yaml_path.exists():
        raise HTTPException(status_code=400, detail=f"Store {request.store_id} already exists")
    
    with get_db() as db:
        existing = db.execute(
            "SELECT store_id FROM store_auth WHERE store_id = ?",
            (request.store_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail=f"Store {request.store_id} already has authentication")
    
    try:
        # Create YAML file
        if request.copy_from_store:
            # Copy from existing store
            source_yaml = Path(f"stores/store{request.copy_from_store}.yml")
            if not source_yaml.exists():
                raise HTTPException(status_code=400, detail=f"Source store {request.copy_from_store} not found")
            shutil.copy(source_yaml, yaml_path)
        else:
            # Use template
            template_path = Path("stores/store1.yml")  # Default template
            if not template_path.exists():
                raise HTTPException(status_code=500, detail="No template store found")
            shutil.copy(template_path, yaml_path)
        
        # If store name was provided, update the YAML
        if request.store_name:
            yaml_data = load_store_yaml(request.store_id)
            yaml_data["name"] = request.store_name
            save_store_yaml(request.store_id, yaml_data)
        
        # Create authentication
        pin = create_store_auth(request.store_id, request.admin_email)
        
        # Audit log
        audit_superadmin_action(
            current_admin['store_id'],
            "create_store",
            request.store_id,
            {
                "admin_email": request.admin_email,
                "copied_from": request.copy_from_store
            }
        )
        
        return {
            "status": "success",
            "store_id": request.store_id,
            "admin_email": request.admin_email,
            "pin": pin,
            "message": f"Store {request.store_id} created successfully"
        }
        
    except Exception as e:
        # Clean up on error
        if yaml_path.exists():
            yaml_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/totp/status")
async def get_totp_status(current_admin: dict = Depends(require_superadmin)):
    """Check if TOTP is enabled for the current superadmin"""
    username = current_admin['store_id']
    
    with get_db() as db:
        admin = db.execute(
            "SELECT totp_enabled FROM superadmins WHERE username = ?",
            (username,)
        ).fetchone()
        
        return {
            "enabled": bool(admin and admin['totp_enabled']),
            "username": username
        }


@router.get("/totp/setup")
async def setup_totp(current_admin: dict = Depends(require_superadmin)):
    """Generate TOTP secret and QR code for 2FA setup"""
    username = current_admin['store_id']
    
    with get_db() as db:
        # Check if TOTP already enabled
        admin = db.execute(
            "SELECT totp_enabled FROM superadmins WHERE username = ?",
            (username,)
        ).fetchone()
        
        if admin and admin['totp_enabled']:
            raise HTTPException(status_code=400, detail="TOTP already enabled")
        
        # Generate secret
        secret = pyotp.random_base32()
        
        # Store secret (not enabled yet)
        db.execute(
            "UPDATE superadmins SET totp_secret = ? WHERE username = ?",
            (secret, username)
        )
        db.commit()
        
        # Generate QR code
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=username,
            issuer_name='PackingWebsite Superadmin'
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img_io = io.BytesIO()
        qr.make_image(fill_color="black", back_color="white").save(img_io, 'PNG')
        img_io.seek(0)
        
        qr_base64 = base64.b64encode(img_io.getvalue()).decode()
        
        return {
            "secret": secret,
            "qr_code": f"data:image/png;base64,{qr_base64}",
            "manual_entry": secret,
            "issuer": "PackingWebsite Superadmin"
        }


@router.post("/totp/verify")
async def verify_totp(request: TOTPSetupRequest, current_admin: dict = Depends(require_superadmin)):
    """Verify TOTP token and enable 2FA"""
    username = current_admin['store_id']
    
    with get_db() as db:
        # Get secret
        admin = db.execute(
            "SELECT totp_secret, totp_enabled FROM superadmins WHERE username = ?",
            (username,)
        ).fetchone()
        
        if not admin or not admin['totp_secret']:
            raise HTTPException(status_code=400, detail="TOTP not set up")
        
        if admin['totp_enabled']:
            raise HTTPException(status_code=400, detail="TOTP already enabled")
        
        # Verify token
        totp = pyotp.TOTP(admin['totp_secret'])
        if not totp.verify(request.totp_token, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid TOTP token")
        
        # Enable TOTP
        db.execute(
            "UPDATE superadmins SET totp_enabled = TRUE WHERE username = ?",
            (username,)
        )
        db.commit()
        
        # Audit log
        audit_superadmin_action(username, "enable_totp")
        
        return {"status": "success", "message": "TOTP enabled successfully"}