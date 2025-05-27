"""
FastAPI authentication middleware and decorators
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import wraps
from typing import Optional, Tuple
from lib import auth_manager

# Bearer token security scheme
bearer_scheme = HTTPBearer()

# FIXME: TEMPORARY HACK - Remove when removing auto-login hack
# Optional bearer scheme that doesn't fail on missing auth
# This is only needed to support the auto-login hack in routers/auth.py
# When removing the hack, change this back to: HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)

def _get_current_auth_impl(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> Tuple[str, str]:
    """
    Implementation that verifies Bearer token and returns (store_id, auth_level)
    """
    token = credentials.credentials
    result = auth_manager.verify_session(token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return result

def get_current_auth():
    """
    Verify Bearer token and return (store_id, auth_level)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    return Depends(_get_current_auth_impl)

def get_current_store(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> str:
    """
    Verify Bearer token and return the store_id
    (Backward compatibility - ignores auth level)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    result = auth_manager.verify_session(token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    store_id, _ = result
    return store_id

def require_auth(admin: bool = False):
    """
    Decorator to require authentication
    
    Args:
        admin: If True, requires admin auth level
    
    Usage:
        @app.get("/api/store/{store_id}/data")
        @require_auth()  # User or admin can access
        def get_data(store_id: str):
            pass
            
        @app.post("/api/store/{store_id}/update")
        @require_auth(admin=True)  # Only admin can access
        def update_data(store_id: str):
            pass
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            store_id: str = None,
            auth_info: Tuple[str, str] = Depends(_get_current_auth_impl),
            **kwargs
        ):
            auth_store_id, auth_level = auth_info
            
            # Check if admin is required
            if admin and auth_level != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin access required"
                )
            
            # Verify user has access to this specific store
            if store_id and auth_store_id != store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Not authorized to access store {store_id}"
                )
            
            # Call the original function with auth info
            return await func(
                *args,
                store_id=store_id,
                current_store_id=auth_store_id,
                auth_level=auth_level,
                **kwargs
            )
        
        # Copy over function signature to preserve FastAPI's ability to parse it
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        
        # Preserve the original function's signature for FastAPI
        import inspect
        sig = inspect.signature(func)
        params = list(sig.parameters.values())
        
        # Add auth_info parameter if not present
        auth_param = inspect.Parameter(
            "auth_info",
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            default=Depends(_get_current_auth_impl),
            annotation=Tuple[str, str]
        )
        
        # Find where to insert auth_info (before kwargs if present)
        insert_idx = len(params)
        for i, p in enumerate(params):
            if p.kind == inspect.Parameter.VAR_KEYWORD:
                insert_idx = i
                break
        
        if not any(p.name == "auth_info" for p in params):
            params.insert(insert_idx, auth_param)
        
        wrapper.__signature__ = sig.replace(parameters=params)
        
        return wrapper
    return decorator

def require_store_auth(store_id_param: str = "store_id"):
    """
    Decorator to require authentication for a specific store
    (Backward compatibility wrapper around require_auth)
    """
    return require_auth(admin=False)

def get_optional_auth() -> Optional[Tuple[str, str]]:
    """
    Get the current (store_id, auth_level) if authenticated, None otherwise
    
    This is useful for endpoints that behave differently when authenticated
    """
    def _get_optional_auth(
        request: Request,
        # FIXME: Change back to bearer_scheme when removing auto-login hack
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme)
    ) -> Optional[Tuple[str, str]]:
        if not credentials:
            return None
        
        try:
            token = credentials.credentials
            return auth_manager.verify_session(token)
        except:
            return None
    
    return Depends(_get_optional_auth)


