"""
FastAPI authentication middleware and decorators

IMPORTANT: All new endpoints MUST use the standard dependency injection pattern.
See docs/authentication-api-patterns.md for the required authentication patterns.

The @require_auth decorator is DEPRECATED and should not be used in new code.
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import wraps
from typing import Optional, Tuple
from backend.lib import auth_manager

# Bearer token security scheme
bearer_scheme = HTTPBearer(auto_error=False)

def _get_current_auth_impl(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Tuple[str, str]:
    """
    Implementation that verifies Bearer token and returns (store_id, auth_level)
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    result = auth_manager.verify_session(token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    store_id, auth_level = result
    
    # Check if store is disabled (unless it's a superadmin)
    if auth_level != 'superadmin':
        from backend.lib.auth_manager import get_db
        with get_db() as db:
            store = db.execute(
                "SELECT status FROM store_auth WHERE store_id = ?",
                (store_id,)
            ).fetchone()
            
            if store and store['status'] != 'active':
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Store is disabled"
                )
    
    return result

def get_current_auth():
    """
    Verify Bearer token and return (store_id, auth_level)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    return Depends(_get_current_auth_impl)

def get_current_auth_with_demo():
    """
    Verify Bearer token and return full session info including is_demo
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    def _get_current_auth_with_demo_impl(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
    ) -> dict:
        token = credentials.credentials
        result = auth_manager.get_session_info(token)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return result
    
    return Depends(_get_current_auth_with_demo_impl)

def get_current_store(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> str:
    """
    Verify Bearer token and return the store_id
    (Backward compatibility - ignores auth level)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
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
    DEPRECATED: DO NOT USE THIS DECORATOR!
    
    This decorator is deprecated and should not be used in new code.
    Instead, use the standard dependency injection pattern:
    
    @router.get("/endpoint")
    async def endpoint(
        store_id: str = Path(..., regex=r"^\d{1,6}$"),
        auth_info: Tuple[str, str] = get_current_auth()
    ):
        auth_store_id, auth_level = auth_info
        if auth_level != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        if auth_store_id != store_id:
            raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    See docs/06-authentication-standards.md for the required patterns.
    
    Args:
        admin: If True, requires admin auth level
    
    Old usage (DEPRECATED):
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


def get_optional_auth() -> Optional[Tuple[str, str]]:
    """
    Get the current (store_id, auth_level) if authenticated, None otherwise
    
    This is useful for endpoints that behave differently when authenticated
    """
    def _get_optional_auth(
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
    ) -> Optional[Tuple[str, str]]:
        if not credentials:
            return None
        
        try:
            token = credentials.credentials
            return auth_manager.verify_session(token)
        except:
            return None
    
    return Depends(_get_optional_auth)

def get_optional_auth_with_demo() -> Optional[dict]:
    """
    Get full session info including is_demo flag if authenticated, None otherwise
    """
    def _get_optional_auth_with_demo(
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
    ) -> Optional[dict]:
        if not credentials:
            return None
        
        try:
            token = credentials.credentials
            return auth_manager.get_session_info(token)
        except:
            return None
    
    return Depends(_get_optional_auth_with_demo)


